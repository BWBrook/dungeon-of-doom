import {
  FACING_ORDER,
  FACING_VECTORS,
  isSpellAvailableFromInventory,
  monsterPowerFromLegacyCode
} from '../engine/catalog';
import type { Action, BaseTileKind, Facing, MonsterState, Point, SerializedRun } from '../engine/types';

export type PolicyStyle = 'careful' | 'reckless' | 'completionist';

export const POLICY_STYLES: PolicyStyle[] = ['careful', 'reckless', 'completionist'];

export interface PolicyContext {
  run: SerializedRun;
  isFinalStage: boolean;
  style?: PolicyStyle;
}

const AURA_RESERVE = 1;
const MONSTER_PATH_COST = 25;

const STEP_COSTS: Partial<Record<BaseTileKind, number>> = {
  floor: 1,
  entrance: 1,
  safe: 1,
  trap: 8,
  vase: 3,
  chest: 3,
  idol: 3
};

export function chooseAction(context: PolicyContext): Action {
  const { run } = context;
  const style = context.style ?? 'careful';
  const reckless = style === 'reckless';
  const hero = run.hero;
  const activeMonster = run.monsters.find((monster) => monster.id === run.activeMonsterId) ?? null;
  const dangerLine = expectedIncomingHit(run) * 2 + 0.5;
  const lowStrength = reckless
    ? hero.stats.strength < dangerLine
    : hero.stats.strength < dangerLine || hero.stats.strength < hero.baseStats.strength * 0.5;
  const hasPotion = (hero.inventorySlots[24] ?? 0) > 0;
  const auraCost = (slot: number) => slot === 1 || slot === 4 || slot === 6;
  const canCast = (slot: 1 | 2 | 3 | 4 | 5 | 6, emergency = false) =>
    isSpellAvailableFromInventory(hero, slot) &&
    hero.spellCharges[slot] > 0 &&
    (!auraCost(slot) || emergency || hero.stats.aura > AURA_RESERVE);

  if (activeMonster && chebyshev(activeMonster.position, hero.position) <= 1) {
    const nextHitKills = hero.stats.strength - expectedIncomingHit(run) < 1.2;
    const canRecover = hero.stats.strength < hero.baseStats.strength - 0.5;

    if (nextHitKills && canRecover && hasPotion) {
      return { type: 'useRestorative' };
    }

    if (!meleeViable(run, activeMonster)) {
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
    if (lowStrength && hasPotion) {
      return { type: 'useRestorative' };
    }

    return { type: 'moveForward' };
  }

  if (lowStrength && hasPotion && hero.stats.strength < hero.baseStats.strength - 0.5) {
    return { type: 'useRestorative' };
  }

  if (lowStrength && !hasPotion && canCast(6) && hero.stats.strength < hero.baseStats.strength - 0.5) {
    return { type: 'castSpell', slot: 6 };
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

      if (!reckless && target.kind === 'wake' && hero.stats.strength < hero.baseStats.strength * 0.6) {
        if (hasPotion) {
          return { type: 'useRestorative' };
        }

        if (canCast(6)) {
          return { type: 'castSpell', slot: 6 };
        }
      }

      return target.kind === 'get' ? { type: 'get' } : { type: 'moveForward' };
    }
  }

  const path = findPath(run, hero.position, target.point, target.kind !== 'walk');

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

type Target = { kind: 'walk' | 'get' | 'wake'; point: Point };

function chooseTarget(context: PolicyContext): Target | null {
  const { run } = context;
  const hero = run.hero;
  const cells = run.level.cells;
  const monstersRemain = run.monsters.some((monster) => monster.state !== 'dead');
  const isFinalStage =
    context.isFinalStage && !(context.style === 'completionist' && monstersRemain);
  const width = run.level.width;
  const find = (kind: BaseTileKind): Point[] => {
    const points: Point[] = [];

    cells.forEach((cell, index) => {
      if (cell.kind === kind) {
        points.push({ x: index % width, y: Math.floor(index / width) });
      }
    });

    return points;
  };
  const nearestReachable = (points: Point[], adjacent: boolean): Point | null => {
    let best: { point: Point; length: number } | null = null;

    for (const point of points) {
      const path = findPath(run, hero.position, point, adjacent);

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

  if (isFinalStage) {
    const idol = nearestReachable(find('idol'), true);

    if (idol) {
      return { kind: 'get', point: idol };
    }

    const blocker = find('idol')
      .map((point) => firstMonsterOnPath(run, hero.position, point))
      .find((monster): monster is Point => monster !== null);

    if (blocker) {
      return { kind: 'wake', point: blocker };
    }
  }

  if (!context.isFinalStage && hero.stats.experience >= run.exitExperienceTarget) {
    const exit = nearestReachable(find('exit'), false);

    if (exit) {
      return { kind: 'walk', point: exit };
    }
  }

  const chest = nearestReachable(find('chest'), true);

  if (chest) {
    return { kind: 'get', point: chest };
  }

  const dormant = run.monsters
    .filter((monster) => monster.state !== 'dead')
    .map((monster) => monster.position);
  const monster = nearestReachable(dormant, true);

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

  return null;
}

export function findPath(
  run: SerializedRun,
  from: Point,
  to: Point,
  stopAdjacent: boolean,
  throughMonsters = false
): Point[] | null {
  const width = run.level.width;
  const height = run.level.height;
  const blocked = new Set<string>();
  const occupied = new Set<string>();

  for (const monster of run.monsters) {
    if (monster.state !== 'dead') {
      (throughMonsters ? occupied : blocked).add(key(monster.position));
    }
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

      const cell = run.level.cells[next.y * width + next.x]!;
      const isGoalCell = !stopAdjacent && next.x === to.x && next.y === to.y;
      const stepCost = STEP_COSTS[cell.kind];

      if (blocked.has(key(next)) || (stepCost === undefined && !isGoalCell)) {
        continue;
      }

      if (cell.kind === 'exit' && !isGoalCell) {
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

function reconstruct(previous: Map<string, Point>, from: Point, end: Point): Point[] {
  const path = [end];
  let cursor = end;

  while (!(cursor.x === from.x && cursor.y === from.y)) {
    cursor = previous.get(key(cursor))!;
    path.unshift(cursor);
  }

  return path;
}

function firstMonsterOnPath(run: SerializedRun, from: Point, to: Point): Point | null {
  const path = findPath(run, from, to, true, true);

  if (!path) {
    return null;
  }

  const alive = run.monsters.filter((monster) => monster.state !== 'dead');

  for (const point of path) {
    const monster = alive.find((entry) => entry.position.x === point.x && entry.position.y === point.y);

    if (monster) {
      return monster.position;
    }
  }

  return null;
}

function meleeViable(run: SerializedRun, monster: MonsterState): boolean {
  const hero = run.hero;
  const weapon = [1, 2, 3, 4, 5, 7, 8].reduce((total, slot) => total + (hero.inventorySlots[slot] ?? 0), 0);
  const blow = hero.stats.strength + weapon + Math.max(1, hero.stats.luck) / 2;
  const rounds = Math.ceil(monster.hp / Math.max(1, blow));
  const armour = [9, 10, 11, 12, 13, 14].reduce((total, slot) => total + (hero.inventorySlots[slot] ?? 0), 0);
  const incoming = (monsterPowerFromLegacyCode(monster.legacyTileCode) * 0.5) / (3 + armour);

  return rounds * incoming < hero.stats.strength * 0.4;
}

function expectedIncomingHit(run: SerializedRun): number {
  const armour = [9, 10, 11, 12, 13, 14].reduce(
    (total, slot) => total + (run.hero.inventorySlots[slot] ?? 0),
    0
  );
  const strongest = run.monsters
    .filter((monster) => monster.state !== 'dead')
    .reduce((best, monster) => Math.max(best, monsterPowerFromLegacyCode(monster.legacyTileCode)), 0);

  return (strongest * 0.5) / (3 + armour);
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

export function monsterIsAdjacent(monster: MonsterState, hero: Point): boolean {
  return chebyshev(monster.position, hero) <= 1;
}
