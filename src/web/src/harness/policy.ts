import {
  FACING_ORDER,
  FACING_VECTORS,
  LEGACY_CODES,
  RELIC_SLOT,
  REST_CEILING,
  isSpellAvailableFromInventory,
  monsterPowerFromLegacyCode
} from '../engine/catalog';
import type {
  Action,
  BaseTileKind,
  Facing,
  HeroState,
  Point,
  SerializedRun,
  Snapshot
} from '../engine/types';

export type PolicyStyle = 'careful' | 'reckless' | 'completionist';

export const POLICY_STYLES: PolicyStyle[] = ['careful', 'reckless', 'completionist'];

export interface KnownMonster {
  id: string;
  position: Point;
  hp: number;
  legacyTileCode: number;
}

export interface BotView {
  hero: HeroState;
  width: number;
  height: number;
  tiles: Array<BaseTileKind | null>;
  monsters: KnownMonster[];
  activeMonsterId: string | null;
  exitExperienceTarget: number;
}

export type RelicIntent = 'heed' | 'seek';

export const RELIC_INTENTS: RelicIntent[] = ['heed', 'seek'];

export interface VerseKnowledge {
  relic: Point | null;
  wardens: KnownMonster[];
}

export interface PolicyContext {
  view: BotView;
  isFinalStage: boolean;
  style?: PolicyStyle;
  lightFloor?: number;
  relicIntent?: RelicIntent;
  explorerSeed?: number;
}

const AURA_RESERVE = 1;
const MONSTER_PATH_COST = 25;
const UNKNOWN_STEP_COST = 2;
const EXPLORE_TURN_PENALTY = 1.5;
const REVEAL_UNKNOWN_NEIGHBOURS = 6;
const REVEAL_MIN_STRENGTH_SHARE = REST_CEILING * 0.95;
const EXHAUSTION_LINE = 1.5;
const EXPLORE_JITTER = 1;
const REST_LINE_CAREFUL = REST_CEILING * 0.75;
const REST_LINE_RECKLESS = REST_CEILING * 0.5;

const STEP_COSTS: Partial<Record<BaseTileKind, number>> = {
  floor: 1,
  entrance: 1,
  safe: 1,
  trap: 8,
  vase: 3,
  chest: 3,
  idol: 3,
  relic: 3
};

export function omniscientView(run: SerializedRun): BotView {
  return {
    hero: run.hero,
    width: run.level.width,
    height: run.level.height,
    tiles: run.level.cells.map((cell) => cell.kind),
    monsters: run.monsters.filter((monster) => monster.state !== 'dead'),
    activeMonsterId: run.activeMonsterId,
    exitExperienceTarget: run.exitExperienceTarget
  };
}

export function fogView(snapshot: Snapshot): BotView {
  const monsters: KnownMonster[] = [];

  for (const cell of snapshot.levelView.cells) {
    if (!cell.monster) {
      continue;
    }

    monsters.push({
      id: cell.monster.id,
      position: cell.position,
      hp: cell.monster.hp,
      legacyTileCode: cell.monster.legacyTileCode
    });
  }

  return {
    hero: snapshot.hero,
    width: snapshot.levelView.width,
    height: snapshot.levelView.height,
    tiles: snapshot.levelView.cells.map((cell) => cell.tile),
    monsters,
    activeMonsterId: snapshot.activeMonster?.id ?? null,
    exitExperienceTarget: snapshot.exitExperienceTarget
  };
}

export function withVerseKnowledge(view: BotView, knowledge: VerseKnowledge): BotView {
  const tiles = [...view.tiles];
  const monsters = [...view.monsters];

  if (knowledge.relic && tiles[knowledge.relic.y * view.width + knowledge.relic.x] === null) {
    tiles[knowledge.relic.y * view.width + knowledge.relic.x] = 'relic';
  }

  for (const warden of knowledge.wardens) {
    const index = warden.position.y * view.width + warden.position.x;

    if (tiles[index] === null && !monsters.some((monster) => monster.id === warden.id)) {
      monsters.push(warden);
    }
  }

  return { ...view, tiles, monsters };
}

export function isWarden(monster: KnownMonster): boolean {
  return monster.legacyTileCode >= LEGACY_CODES.warden;
}

export function chooseAction(context: PolicyContext): Action {
  const { view } = context;
  const style = context.style ?? 'careful';
  const reckless = style === 'reckless';
  const hero = view.hero;
  const activeMonster = view.monsters.find((monster) => monster.id === view.activeMonsterId) ?? null;
  const dangerLine = Math.max(EXHAUSTION_LINE, expectedIncomingHit(view) * 2 + 0.5);
  const lowStrength = reckless
    ? hero.stats.strength < dangerLine
    : hero.stats.strength < dangerLine || hero.stats.strength < hero.baseStats.strength * 0.5;
  const hasPotion = (hero.inventorySlots[24] ?? 0) > 0;
  const onSafeSquare = view.tiles[hero.position.y * view.width + hero.position.x] === 'safe';
  const canRest = view.activeMonsterId === null || onSafeSquare;
  const restLine = Math.min(
    hero.baseStats.strength * REST_CEILING * 0.99,
    Math.max(dangerLine, hero.baseStats.strength * (reckless ? REST_LINE_RECKLESS : REST_LINE_CAREFUL))
  );
  const auraCost = (slot: number) => slot === 1 || slot === 4 || slot === 6;
  const canCast = (slot: 1 | 2 | 3 | 4 | 5 | 6, emergency = false) =>
    isSpellAvailableFromInventory(hero, slot) &&
    hero.spellCharges[slot] > 0 &&
    (!auraCost(slot) || emergency || hero.stats.aura > AURA_RESERVE);

  if (activeMonster && chebyshev(activeMonster.position, hero.position) <= 1 && onSafeSquare) {
    if (hero.stats.strength < hero.baseStats.strength * REST_CEILING) {
      return { type: 'rest' };
    }

    if (!meleeViable(hero, activeMonster) && canCast(5)) {
      return { type: 'castSpell', slot: 5 };
    }

    if (!meleeViable(hero, activeMonster) && canCast(1)) {
      return { type: 'castSpell', slot: 1 };
    }

    const exit = stepOffSafeSquare(view, activeMonster);

    if (!exit) {
      return { type: 'rest' };
    }

    const facing = facingToward(hero.position, exit);

    return facing === hero.facing ? { type: 'moveForward' } : turnToward(hero.facing, facing);
  }

  if (activeMonster && chebyshev(activeMonster.position, hero.position) <= 1) {
    const nextHitKills = hero.stats.strength - expectedIncomingHit(view) < 1.2;
    const canRecover = hero.stats.strength < hero.baseStats.strength - 0.5;

    if (nextHitKills && canRecover && hasPotion) {
      return { type: 'useRestorative' };
    }

    if (!meleeViable(hero, activeMonster)) {
      if (nextHitKills && canCast(1, true)) {
        return { type: 'castSpell', slot: 1 };
      }

      if (canCast(5)) {
        return { type: 'castSpell', slot: 5 };
      }

      if (canCast(1, nextHitKills)) {
        return { type: 'castSpell', slot: 1 };
      }
    }

    if (lowStrength && canRecover && hasPotion) {
      return { type: 'useRestorative' };
    }

    if ((nextHitKills || lowStrength) && canRecover && canCast(6, nextHitKills)) {
      return { type: 'castSpell', slot: 6 };
    }

    if (canCast(4) && hero.stats.strength < hero.baseStats.strength * 0.7) {
      return { type: 'castSpell', slot: 4 };
    }

    return { type: 'attack' };
  }

  if (hero.status.trapped) {
    if (canRest && hero.stats.strength < hero.baseStats.strength * REST_CEILING) {
      return { type: 'rest' };
    }

    if (lowStrength && hasPotion) {
      return { type: 'useRestorative' };
    }

    return { type: 'moveForward' };
  }

  if (canRest && hero.stats.strength < restLine) {
    return { type: 'rest' };
  }

  if (!canRest && lowStrength && hasPotion && hero.stats.strength < hero.baseStats.strength - 0.5) {
    return { type: 'useRestorative' };
  }

  if (!canRest && lowStrength && !hasPotion && canCast(6) && hero.stats.strength < hero.baseStats.strength - 0.5) {
    return { type: 'castSpell', slot: 6 };
  }

  if (shouldReveal(context, reckless)) {
    return { type: 'reveal' };
  }

  const target = chooseTarget(context);

  if (!target) {
    return { type: 'wait' };
  }

  if (target.kind === 'get' || target.kind === 'wake') {
    if (chebyshev(target.point, hero.position) === 1 && isOrthogonal(target.point, hero.position)) {
      const facing = facingToward(hero.position, target.point);

      if (facing !== hero.facing) {
        return turnToward(hero.facing, facing);
      }

      if (
        !reckless &&
        target.kind === 'wake' &&
        canRest &&
        hero.stats.strength < hero.baseStats.strength * REST_CEILING * 0.95
      ) {
        return { type: 'rest' };
      }

      const sleeper =
        target.kind === 'wake'
          ? view.monsters.find(
              (monster) => monster.position.x === target.point.x && monster.position.y === target.point.y
            )
          : undefined;

      if (sleeper && hasPotion && hero.stats.strength - incomingHit(hero, sleeper.legacyTileCode) < 1.2) {
        return { type: 'useRestorative' };
      }

      return target.kind === 'get' ? { type: 'get' } : { type: 'moveForward' };
    }
  }

  const path = target.path ?? findPath(view, hero.position, target.point, target.kind !== 'walk');

  if (!path || path.length < 2) {
    if (canCast(3) && target.kind === 'walk') {
      return { type: 'castSpell', slot: 3 };
    }

    return { type: 'wait' };
  }

  const next = path[1]!;
  const facing = facingToward(hero.position, next);

  if (facing !== hero.facing) {
    return turnToward(hero.facing, facing);
  }

  return { type: 'moveForward' };
}

type Target = { kind: 'walk' | 'get' | 'wake'; point: Point; path?: Point[] };

function shouldReveal(context: PolicyContext, reckless: boolean): boolean {
  const { view } = context;
  const hero = view.hero;

  if (hero.lightUses <= (context.lightFloor ?? hero.lightUses) || view.activeMonsterId !== null) {
    return false;
  }

  if (!reckless && hero.stats.strength < hero.baseStats.strength * REVEAL_MIN_STRENGTH_SHARE) {
    return false;
  }

  if (view.monsters.some((monster) => isWarden(monster) && chebyshev(monster.position, hero.position) <= 1)) {
    return false;
  }

  let unknown = 0;

  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      const x = hero.position.x + dx;
      const y = hero.position.y + dy;

      if ((dx !== 0 || dy !== 0) && x >= 0 && y >= 0 && x < view.width && y < view.height) {
        unknown += view.tiles[y * view.width + x] === null ? 1 : 0;
      }
    }
  }

  return unknown >= REVEAL_UNKNOWN_NEIGHBOURS;
}

function explorationTarget(view: BotView, explorerSeed: number | undefined): Target | null {
  const hero = view.hero;
  const blocked = new Set(view.monsters.map((monster) => key(monster.position)));
  const distance = new Map<string, number>([[key(hero.position), 0]]);
  const previous = new Map<string, Point>();
  const frontier: Array<{ point: Point; cost: number }> = [];
  const enter = (from: Point, next: Point, cost: number) => {
    if (next.x < 0 || next.y < 0 || next.x >= view.width || next.y >= view.height || blocked.has(key(next))) {
      return;
    }

    const tile = view.tiles[next.y * view.width + next.x] ?? null;
    const stepCost = tile === null ? unknownStepCost(view, next) : STEP_COSTS[tile];

    if (stepCost === undefined) {
      return;
    }

    const total = cost + stepCost + explorerPreference(explorerSeed, next);
    const known = distance.get(key(next));

    if (known !== undefined && known <= total) {
      return;
    }

    distance.set(key(next), total);
    previous.set(key(next), from);
    frontier.push({ point: next, cost: total });
  };

  for (const facing of FACING_ORDER) {
    const vector = FACING_VECTORS[facing];
    const turns = Math.min(
      (FACING_ORDER.indexOf(facing) - FACING_ORDER.indexOf(hero.facing) + 4) % 4,
      (FACING_ORDER.indexOf(hero.facing) - FACING_ORDER.indexOf(facing) + 4) % 4
    );

    enter(hero.position, { x: hero.position.x + vector.x, y: hero.position.y + vector.y }, turns * EXPLORE_TURN_PENALTY);
  }

  while (frontier.length > 0) {
    frontier.sort((left, right) => left.cost - right.cost);
    const current = frontier.shift()!;

    if ((view.tiles[current.point.y * view.width + current.point.x] ?? null) === null) {
      return { kind: 'walk', point: current.point, path: reconstruct(previous, hero.position, current.point) };
    }

    for (const facing of FACING_ORDER) {
      const vector = FACING_VECTORS[facing];

      enter(current.point, { x: current.point.x + vector.x, y: current.point.y + vector.y }, current.cost);
    }
  }

  return null;
}

function chooseTarget(context: PolicyContext): Target | null {
  const { view } = context;
  const hero = view.hero;
  const monstersRemain = view.monsters.some((monster) => !isWarden(monster));
  const isFinalStage =
    context.isFinalStage && !(context.style === 'completionist' && monstersRemain);
  const find = (kind: BaseTileKind): Point[] => {
    const points: Point[] = [];

    view.tiles.forEach((tile, index) => {
      if (tile === kind) {
        points.push({ x: index % view.width, y: Math.floor(index / view.width) });
      }
    });

    return points;
  };
  const nearestReachable = (points: Point[], adjacent: boolean): Point | null => {
    let best: { point: Point; length: number } | null = null;

    for (const point of points) {
      const path = findPath(view, hero.position, point, adjacent);

      if (path && (!best || path.length < best.length)) {
        best = { point, length: path.length };
      }
    }

    return best?.point ?? null;
  };

  const needsRestoratives = (hero.inventorySlots[24] ?? 0) + (hero.inventorySlots[23] ?? 0) < 4;
  const vase = needsRestoratives ? nearestReachable(find('vase'), true) : null;

  if (vase) {
    return { kind: 'get', point: vase };
  }

  if (context.relicIntent === 'seek' && (hero.inventorySlots[RELIC_SLOT] ?? 0) === 0) {
    const relics = find('relic');
    const relic = nearestReachable(relics, true);

    if (relic) {
      return { kind: 'get', point: relic };
    }

    const guard = relics
      .map((point) => firstMonsterOnPath(view, hero.position, point))
      .find((monster): monster is Point => monster !== null);

    if (guard) {
      return { kind: 'wake', point: guard };
    }
  }

  if (isFinalStage) {
    const unseenIdol = find('idol').length === 0 ? explorationTarget(view, context.explorerSeed) : null;

    if (unseenIdol) {
      return unseenIdol;
    }

    const idol = nearestReachable(find('idol'), true);

    if (idol) {
      return { kind: 'get', point: idol };
    }

    const blocker = find('idol')
      .map((point) => firstMonsterOnPath(view, hero.position, point))
      .find((monster): monster is Point => monster !== null);

    if (blocker) {
      return { kind: 'wake', point: blocker };
    }
  }

  if (!context.isFinalStage && hero.stats.experience >= view.exitExperienceTarget) {
    const unseenExit = find('exit').length === 0 ? explorationTarget(view, context.explorerSeed) : null;

    if (unseenExit) {
      return unseenExit;
    }

    const exit = nearestReachable(find('exit'), false);

    if (exit) {
      return { kind: 'walk', point: exit };
    }
  }

  const chest = nearestReachable(find('chest'), true);

  if (chest) {
    return { kind: 'get', point: chest };
  }

  const monster = nearestReachable(
    view.monsters.filter((entry) => !isWarden(entry)).map((entry) => entry.position),
    true
  );

  if (monster) {
    return { kind: 'wake', point: monster };
  }

  const anyVase = nearestReachable(find('vase'), true);

  if (anyVase) {
    return { kind: 'get', point: anyVase };
  }

  if (context.isFinalStage) {
    const idol = nearestReachable(find('idol'), true);

    if (idol) {
      return { kind: 'get', point: idol };
    }
  }

  return explorationTarget(view, context.explorerSeed);
}

export function findPath(
  view: BotView,
  from: Point,
  to: Point,
  stopAdjacent: boolean,
  throughMonsters = false
): Point[] | null {
  const width = view.width;
  const height = view.height;
  const blocked = new Set<string>();
  const occupied = new Set<string>();

  for (const monster of view.monsters) {
    (throughMonsters ? occupied : blocked).add(key(monster.position));
  }

  const goal = (point: Point) =>
    stopAdjacent
      ? chebyshev(point, to) === 1 && isOrthogonal(point, to)
      : point.x === to.x && point.y === to.y;

  if (goal(from)) {
    return [from];
  }

  const distance = new Map<string, number>([[key(from), 0]]);
  const previous = new Map<string, Point>();
  const frontier: Array<{ point: Point; cost: number }> = [{ point: from, cost: 0 }];

  while (frontier.length > 0) {
    frontier.sort((left, right) => left.cost - right.cost);
    const current = frontier.shift()!;

    if (goal(current.point)) {
      return reconstruct(previous, from, current.point);
    }

    for (const facing of FACING_ORDER) {
      const vector = FACING_VECTORS[facing];
      const next = { x: current.point.x + vector.x, y: current.point.y + vector.y };

      if (next.x < 0 || next.y < 0 || next.x >= width || next.y >= height) {
        continue;
      }

      const tile = view.tiles[next.y * width + next.x] ?? null;
      const isGoalCell = !stopAdjacent && next.x === to.x && next.y === to.y;
      const stepCost = tile === null ? unknownStepCost(view, next) : STEP_COSTS[tile];

      if (blocked.has(key(next)) || (stepCost === undefined && !isGoalCell)) {
        continue;
      }

      if (tile === 'exit' && !isGoalCell) {
        continue;
      }

      const cost = current.cost + (stepCost ?? 1) + (occupied.has(key(next)) ? MONSTER_PATH_COST : 0);
      const known = distance.get(key(next));

      if (known !== undefined && known <= cost) {
        continue;
      }

      distance.set(key(next), cost);
      previous.set(key(next), current.point);
      frontier.push({ point: next, cost });
    }
  }

  return null;
}

function stepOffSafeSquare(view: BotView, monster: KnownMonster): Point | null {
  const hero = view.hero;
  const occupied = new Set(view.monsters.map((entry) => key(entry.position)));
  const exits = FACING_ORDER.map((facing) => ({
    x: hero.position.x + FACING_VECTORS[facing].x,
    y: hero.position.y + FACING_VECTORS[facing].y
  })).filter((point) => {
    const tile = view.tiles[point.y * view.width + point.x] ?? null;

    return (
      point.x >= 0 &&
      point.y >= 0 &&
      point.x < view.width &&
      point.y < view.height &&
      !occupied.has(key(point)) &&
      (tile === 'floor' || tile === 'entrance')
    );
  });

  return exits.find((point) => chebyshev(point, monster.position) <= 1) ?? exits[0] ?? null;
}

function explorerPreference(explorerSeed: number | undefined, point: Point): number {
  if (explorerSeed === undefined) {
    return 0;
  }

  let hash = Math.imul(explorerSeed ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(point.x + 1, 0xc2b2ae35) ^ Math.imul(point.y + 1, 0x27d4eb2f);

  hash = Math.imul(hash ^ (hash >>> 15), 0x2c1b3c6d);
  hash ^= hash >>> 12;

  return ((hash >>> 0) % 1000) / 1000 * EXPLORE_JITTER;
}

function unknownStepCost(view: BotView, point: Point): number | undefined {
  const onBorder =
    point.x === 0 || point.y === 0 || point.x === view.width - 1 || point.y === view.height - 1;

  return onBorder ? undefined : UNKNOWN_STEP_COST;
}

function reconstruct(previous: Map<string, Point>, from: Point, end: Point): Point[] {
  const path = [end];
  let cursor = end;

  while (!(cursor.x === from.x && cursor.y === from.y)) {
    cursor = previous.get(key(cursor))!;
    path.unshift(cursor);
  }

  return path;
}

function firstMonsterOnPath(view: BotView, from: Point, to: Point): Point | null {
  const path = findPath(view, from, to, true, true);

  if (!path) {
    return null;
  }

  for (const point of path) {
    const monster = view.monsters.find(
      (entry) => entry.position.x === point.x && entry.position.y === point.y
    );

    if (monster) {
      return monster.position;
    }
  }

  return null;
}

function meleeViable(hero: HeroState, monster: KnownMonster): boolean {
  const weapon = [1, 2, 3, 4, 5, 7, 8].reduce((total, slot) => total + (hero.inventorySlots[slot] ?? 0), 0);
  const blow = hero.stats.strength + weapon + Math.max(1, hero.stats.luck) / 2;
  const rounds = Math.ceil(monster.hp / Math.max(1, blow));
  const armour = [9, 10, 11, 12, 13, 14].reduce((total, slot) => total + (hero.inventorySlots[slot] ?? 0), 0);
  const incoming = (monsterPowerFromLegacyCode(monster.legacyTileCode) * 0.5) / (3 + armour);

  return rounds * incoming < hero.stats.strength * 0.4;
}

function expectedIncomingHit(view: BotView): number {
  const strongest = view.monsters
    .filter((monster) => !isWarden(monster) || monster.id === view.activeMonsterId)
    .reduce((best, monster) => Math.max(best, monster.legacyTileCode), LEGACY_CODES.vase);

  return incomingHit(view.hero, strongest);
}

function incomingHit(hero: HeroState, legacyTileCode: number): number {
  const armour = [9, 10, 11, 12, 13, 14].reduce(
    (total, slot) => total + (hero.inventorySlots[slot] ?? 0),
    0
  );

  return (monsterPowerFromLegacyCode(legacyTileCode) * 0.5) / (3 + armour);
}

export function facingToward(from: Point, to: Point): Facing {
  if (to.x > from.x) {
    return 'E';
  }

  if (to.x < from.x) {
    return 'W';
  }

  if (to.y > from.y) {
    return 'S';
  }

  return 'N';
}

export function turnToward(current: Facing, desired: Facing): Action {
  const delta = (FACING_ORDER.indexOf(desired) - FACING_ORDER.indexOf(current) + 4) % 4;

  return delta === 3 ? { type: 'turnLeft' } : { type: 'turnRight' };
}

export function chebyshev(left: Point, right: Point): number {
  return Math.max(Math.abs(left.x - right.x), Math.abs(left.y - right.y));
}

function isOrthogonal(left: Point, right: Point): boolean {
  return left.x === right.x || left.y === right.y;
}

function key(point: Point): string {
  return `${point.x},${point.y}`;
}
