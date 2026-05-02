import {
  DEFAULT_LIGHT_USES,
  FACING_ORDER,
  FACING_VECTORS,
  GRID_SIZE,
  ITEM_CATALOG,
  LEGACY_CODES,
  MESSAGE_LIMIT,
  MESSAGE_TEXT,
  clonePoint,
  computeSpellChargesFromInventory,
  createEmptySpellCharges,
  isLegacyMonsterCode,
  isSpellAvailableFromInventory,
  legacyCodeToTileKind,
  monsterHpFromLegacyCode,
  monsterPowerFromLegacyCode,
  monsterStepSizeFromLegacyCode,
  pointKey,
  tileKindToLegacyCode
} from './catalog';
import { Rng } from './rng';
import type {
  Action,
  BaseTileKind,
  GameInit,
  HeroState,
  LevelCell,
  LevelDefinition,
  MonsterState,
  Point,
  RunStatus,
  SerializedRun,
  Snapshot,
  SnapshotCell,
  SpellSlot,
  StepResult
} from './types';

const HERO_ATTACK_SLOTS = [1, 2, 3, 4, 5, 7, 8];
const HERO_DEFENSE_SLOTS = [9, 10, 11, 12, 13, 14];
const BREAKABLE_SLOTS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

export class Game {
  private seed: number;
  private rng: Rng;
  private hero: HeroState;
  private level: LevelDefinition;
  private monsters: MonsterState[];
  private explored: Set<string>;
  private visible: Set<string>;
  private messages: string[];
  private activeMonsterId: string | null;
  private runStatus: RunStatus;
  private score: number | null;
  private turnCount: number;

  constructor(init: GameInit) {
    this.seed = init.seed >>> 0;
    this.rng = new Rng(this.seed);
    this.hero = structuredClone(init.hero);
    this.level = structuredClone(init.level);
    this.monsters = init.level.monsterSpawns.map((spawn) => ({
      id: spawn.id,
      legacyTileCode: spawn.legacyTileCode,
      position: clonePoint(spawn.position),
      hp: monsterHpFromLegacyCode(spawn.legacyTileCode),
      stepSize: monsterStepSizeFromLegacyCode(spawn.legacyTileCode),
      state: 'dormant'
    }));
    this.explored = new Set<string>();
    this.visible = new Set<string>();
    this.messages = [];
    this.activeMonsterId = null;
    this.runStatus = 'playing';
    this.score = null;
    this.turnCount = 0;
    this.hero.position = clonePoint(this.level.startPosition);
    this.hero.status.trapped = false;
    this.hero.status.won = false;
    this.hero.status.dead = false;
    this.hero.status.escaped = false;
    this.hero.lightUses =
      (this.hero.inventorySlots[16] ?? 0) > 0 ? DEFAULT_LIGHT_USES : this.hero.lightUses;
    this.hero.spellCharges = structuredClone(this.hero.spellCharges);
    this.revealPoint(this.hero.position);
    this.refreshActiveMonster();
  }

  static fromSerializedRun(serialized: SerializedRun): Game {
    const game = Object.create(Game.prototype) as Game;

    game.seed = serialized.seed >>> 0;
    game.rng = new Rng(game.seed);
    game.rng.setState(serialized.rngState);
    game.hero = structuredClone(serialized.hero);
    game.level = structuredClone(serialized.level);
    game.monsters = structuredClone(serialized.monsters);
    game.explored = new Set(serialized.exploredKeys);
    game.visible = new Set(serialized.visibleKeys);
    game.messages = [...serialized.messages];
    game.activeMonsterId = serialized.activeMonsterId;
    game.runStatus = serialized.runStatus;
    game.score = serialized.score;
    game.turnCount = serialized.turnCount;

    return game;
  }

  step(action: Action): StepResult {
    const result = this.createStepResult();
    const skipStrengthDecay =
      action.type === 'useRestorative' || (action.type === 'castSpell' && action.slot === 6);

    if (this.runStatus !== 'playing') {
      return result;
    }

    const previousPosition = clonePoint(this.hero.position);

    switch (action.type) {
      case 'turnLeft':
        this.rotateFacing(-1);
        result.heroChanged = true;
        break;
      case 'turnRight':
        this.rotateFacing(1);
        result.heroChanged = true;
        break;
      case 'moveForward':
        this.handleMoveForward(result);
        break;
      case 'attack':
        this.handleAttack(result);
        break;
      case 'get':
        this.handleGet(result);
        break;
      case 'useRestorative':
        this.handleUseRestorative(result);
        break;
      case 'reveal':
        this.handleReveal(result);
        break;
      case 'castSpell':
        this.handleCastSpell(action.slot, result);
        break;
      case 'wait':
        break;
    }

    if (this.runStatus === 'playing' && action.type !== 'wait' && !skipStrengthDecay) {
      this.hero.stats.strength *= 0.99;
      result.heroChanged = true;
    }

    if (this.runStatus === 'playing' && this.hero.stats.strength < this.hero.baseStats.strength) {
      this.hero.stats.strength = Math.min(
        this.hero.baseStats.strength,
        this.hero.stats.strength + this.hero.stats.vitality / 1100
      );
      result.heroChanged = true;
    }

    this.revealPoint(this.hero.position, result);
    this.refreshActiveMonster();

    if (this.runStatus === 'playing') {
      this.handleMonsterTurn(result);
    }

    if (this.runStatus === 'playing') {
      this.resolveExit(previousPosition, result);
    }

    if (this.runStatus === 'playing' && this.hero.stats.strength < 1) {
      this.markDead(result);
    }

    if (this.runStatus !== 'playing') {
      result.runStatusChanged = true;
    }

    this.turnCount += 1;

    return result;
  }

  snapshot(): Snapshot {
    const cells: SnapshotCell[] = [];
    const visibleCells: Point[] = [];

    for (let y = 0; y < this.level.height; y += 1) {
      for (let x = 0; x < this.level.width; x += 1) {
        const position = { x, y };
        const explored = this.explored.has(pointKey(position));
        const visible = this.visible.has(pointKey(position));
        const monster = this.getMonsterAt(position);

        if (visible) {
          visibleCells.push(position);
        }

        cells.push({
          position,
          visible,
          explored,
          tile: explored ? this.getCell(position).kind : null,
          monster:
            explored && monster
              ? {
                  id: monster.id,
                  hp: monster.hp,
                  active: monster.id === this.activeMonsterId
                }
              : null
        });
      }
    }

    return {
      hero: structuredClone(this.hero),
      levelView: {
        width: this.level.width,
        height: this.level.height,
        cells
      },
      visibleCells,
      activeMonster: this.getActiveMonster() ? structuredClone(this.getActiveMonster()!) : null,
      messages: [...this.messages],
      runStatus: this.runStatus,
      score: this.score,
      turnCount: this.turnCount
    };
  }

  serializeRun(): SerializedRun {
    return {
      version: 1,
      seed: this.seed,
      rngState: this.rng.getState(),
      hero: structuredClone(this.hero),
      level: structuredClone(this.level),
      monsters: structuredClone(this.monsters),
      exploredKeys: [...this.explored],
      visibleKeys: [...this.visible],
      messages: [...this.messages],
      activeMonsterId: this.activeMonsterId,
      runStatus: this.runStatus,
      score: this.score,
      turnCount: this.turnCount
    };
  }

  private createStepResult(): StepResult {
    return {
      messages: [],
      sounds: [],
      cellsChanged: [],
      heroChanged: false,
      monsterChanged: false,
      runStatusChanged: false
    };
  }

  private rotateFacing(delta: number) {
    const currentIndex = FACING_ORDER.indexOf(this.hero.facing);
    const nextIndex = (currentIndex + delta + FACING_ORDER.length) % FACING_ORDER.length;

    this.hero.facing = FACING_ORDER[nextIndex]!;
  }

  private handleMoveForward(result: StepResult) {
    if (this.hero.status.trapped) {
      const released =
        this.hero.stats.strength > this.hero.baseStats.strength * 0.8 &&
        this.rng.int(1, 8) < this.hero.stats.luck;

      if (released) {
        this.hero.status.trapped = false;
        this.pushMessage(result, MESSAGE_TEXT.trapFreed);
      } else {
        this.pushMessage(result, MESSAGE_TEXT.trapHeld);
      }

      result.heroChanged = true;
      return;
    }

    const target = this.frontPosition();

    if (target.x === this.hero.position.x && target.y === this.hero.position.y) {
      return;
    }

    const blockingMonster = this.getMonsterAt(target);

    if (blockingMonster) {
      this.pushMessage(result, MESSAGE_TEXT.blockedByMonster);
      return;
    }

    const targetCell = this.getCell(target);

    if (targetCell.kind === 'wall') {
      this.hero.stats.strength -= 0.03;
      this.pushMessage(result, 'THOU STRIKEST A WALL');
      this.pushSound(result, 'bump');
      result.heroChanged = true;
      return;
    }

    this.hero.position = target;
    this.revealPoint(target, result);
    result.heroChanged = true;

    if (targetCell.kind === 'trap') {
      this.hero.status.trapped = true;
      this.pushMessage(result, 'A TRAP GRASPS THY FEET');
      this.pushSound(result, 'trap');
    }
  }

  private handleAttack(result: StepResult) {
    const monster = this.getActiveMonster();

    if (!monster) {
      this.pushMessage(result, MESSAGE_TEXT.noMonster);
      return;
    }

    const hitPower =
      this.hero.stats.strength +
      HERO_ATTACK_SLOTS.reduce((total, slot) => total + (this.hero.inventorySlots[slot] ?? 0), 0) +
      this.rng.int(1, Math.max(1, Math.floor(this.hero.stats.luck)));
    const monsterPower = monsterPowerFromLegacyCode(monster.legacyTileCode);
    const misses = this.hero.stats.agility + this.hero.stats.luck < this.rng.int(1, monsterPower) + 2;

    if (misses) {
      this.pushMessage(result, MESSAGE_TEXT.miss);
      this.pushSound(result, 'attack-miss');
    } else {
      monster.hp -= hitPower;
      this.pushMessage(result, this.rng.pick([MESSAGE_TEXT.hit1, MESSAGE_TEXT.hit2, MESSAGE_TEXT.hit3]));
      this.pushSound(result, 'attack-hit');
      result.monsterChanged = true;
    }

    this.hero.stats.strength -= hitPower / 100;
    this.hero.stats.experience += 0.05;
    result.heroChanged = true;

    if (monster.hp < 1) {
      this.killMonster(monster, result);
    }
  }

  private handleGet(result: StepResult) {
    const target = this.frontPosition();
    const targetCell = this.getCell(target);

    switch (targetCell.kind) {
      case 'vase':
        this.hero.inventorySlots[23] = (this.hero.inventorySlots[23] ?? 0) + 1;
        this.hero.inventorySlots[24] = (this.hero.inventorySlots[24] ?? 0) + 1;
        this.setCell(target, 'floor');
        this.pushMessage(result, 'THOU FINDEST RESTORATIVES');
        this.pushSound(result, 'pickup');
        result.heroChanged = true;
        break;
      case 'chest':
        this.hero.treasure += 1;
        this.setCell(target, 'floor');
        this.pushMessage(result, 'TREASURE IS THINE');
        this.pushSound(result, 'pickup');
        result.heroChanged = true;
        break;
      case 'idol':
        this.hero.position = clonePoint(target);
        this.revealPoint(target, result);
        this.winRun(result);
        result.heroChanged = true;
        break;
      default:
        this.pushMessage(result, MESSAGE_TEXT.nothingToGet);
        break;
    }
  }

  private handleUseRestorative(result: StepResult) {
    let usedAny = false;

    if ((this.hero.inventorySlots[24] ?? 0) > 0 && this.hero.stats.strength < this.hero.baseStats.strength) {
      this.hero.stats.strength = this.hero.baseStats.strength;
      this.hero.inventorySlots[24] = (this.hero.inventorySlots[24] ?? 0) - 1;
      usedAny = true;
    }

    if ((this.hero.inventorySlots[23] ?? 0) > 0 && this.hero.stats.vitality < this.hero.baseStats.vitality) {
      this.hero.stats.vitality = this.hero.baseStats.vitality;
      this.hero.inventorySlots[23] = (this.hero.inventorySlots[23] ?? 0) - 1;
      usedAny = true;
    }

    if (usedAny) {
      this.pushMessage(result, 'THY BODY IS RESTORED');
      this.pushSound(result, 'pickup');
      result.heroChanged = true;
    }
  }

  private handleReveal(result: StepResult) {
    if (this.hero.lightUses < 1) {
      this.pushMessage(result, MESSAGE_TEXT.noLight);
      return;
    }

    for (let y = this.hero.position.y - 1; y <= this.hero.position.y + 1; y += 1) {
      for (let x = this.hero.position.x - 1; x <= this.hero.position.x + 1; x += 1) {
        if (this.isInBounds({ x, y })) {
          this.revealPoint({ x, y }, result);
        }
      }
    }

    this.hero.lightUses -= 1;
    result.heroChanged = true;
  }

  private handleCastSpell(slot: SpellSlot, result: StepResult) {
    if (!isSpellAvailableFromInventory(this.hero, slot)) {
      this.pushMessage(result, MESSAGE_TEXT.noMagic);
      return;
    }

    if (this.hero.spellCharges[slot] < 1) {
      this.pushMessage(result, MESSAGE_TEXT.spellExhausted);
      return;
    }

    this.hero.spellCharges[slot] -= 1;
    this.pushSound(result, 'spell');
    result.heroChanged = true;

    switch (slot) {
      case 1:
        this.castSuperzap(result);
        break;
      case 2:
        this.castSanctuary(result);
        break;
      case 3:
        this.castTeleport(result);
        break;
      case 4:
        this.castPowersurge(result);
        break;
      case 5:
        this.castMetamorphosis(result);
        break;
      case 6:
        this.castHealing(result);
        break;
    }

    if (this.runStatus === 'playing') {
      this.hero.stats.experience += 0.2;
      result.heroChanged = true;
    }
  }

  private castSuperzap(result: StepResult) {
    const monster = this.getActiveMonster();

    if (!monster) {
      this.pushMessage(result, MESSAGE_TEXT.spellFades);
      return;
    }

    this.killMonster(monster, result);
  }

  private castSanctuary(result: StepResult) {
    const currentCell = this.getCell(this.hero.position);

    if (currentCell.kind === 'floor') {
      this.setCell(this.hero.position, 'safe');
      this.pushMessage(result, 'SANCTUARY IS MADE');
    } else {
      this.pushMessage(result, MESSAGE_TEXT.spellFades);
    }
  }

  private castTeleport(result: StepResult) {
    const target = {
      x: this.rng.int(0, GRID_SIZE - 1),
      y: this.rng.int(0, GRID_SIZE - 1)
    };
    const targetCell = this.getCell(target);

    if (targetCell.kind === 'wall' || this.getMonsterAt(target)) {
      this.pushMessage(result, MESSAGE_TEXT.spellFades);
      return;
    }

    this.hero.position = target;
    this.revealPoint(target, result);
    this.pushMessage(result, 'THOU ART TRANSPORTED');
    result.heroChanged = true;
  }

  private castPowersurge(result: StepResult) {
    const remainingCharge = Math.max(1, this.hero.spellCharges[4]);

    this.hero.stats.vitality += this.rng.int(1, remainingCharge);
    this.hero.stats.strength += this.rng.int(1, remainingCharge);
    this.hero.stats.aura = Math.max(0, this.hero.stats.aura - 1);
    this.pushMessage(result, 'POWER SURGES WITHIN THEE');
    result.heroChanged = true;
  }

  private castMetamorphosis(result: StepResult) {
    const monster = this.getActiveMonster();

    if (!monster) {
      this.pushMessage(result, MESSAGE_TEXT.spellFades);
      return;
    }

    const transformedCode = this.rng.int(LEGACY_CODES.vase, LEGACY_CODES.monster1);

    if (isLegacyMonsterCode(transformedCode)) {
      monster.legacyTileCode = transformedCode;
      monster.hp = monsterHpFromLegacyCode(transformedCode);
      monster.stepSize = monsterStepSizeFromLegacyCode(transformedCode);
      monster.state = 'active';
      this.pushMessage(result, 'THE MONSTER CHANGES FORM');
      result.monsterChanged = true;
      return;
    }

    this.setCell(monster.position, legacyCodeToTileKind(transformedCode));
    monster.state = 'dead';
    this.activeMonsterId = null;
    this.pushMessage(result, 'THE MONSTER IS TRANSFORMED');
    result.monsterChanged = true;
  }

  private castHealing(result: StepResult) {
    this.hero.stats.vitality = this.hero.baseStats.vitality;
    this.hero.stats.strength = this.hero.baseStats.strength;
    this.hero.stats.aura = Math.max(0, this.hero.stats.aura - 1);
    this.pushMessage(result, 'THY WOUNDS ARE HEALED');
    result.heroChanged = true;
  }

  private handleMonsterTurn(result: StepResult) {
    const monster = this.getActiveMonster();

    if (!monster) {
      return;
    }

    const currentDistance = this.chebyshevDistance(monster.position, this.hero.position);
    const dx = monster.position.x - this.hero.position.x;
    const dy = monster.position.y - this.hero.position.y;
    const nextPosition = {
      x: monster.position.x - Math.sign(dx) * monster.stepSize,
      y: monster.position.y - Math.sign(dy) * monster.stepSize
    };

    if (
      this.isInBounds(nextPosition) &&
      this.isMonsterPassable(nextPosition) &&
      !(nextPosition.x === this.hero.position.x && nextPosition.y === this.hero.position.y)
    ) {
      monster.position = nextPosition;
      result.monsterChanged = true;
      this.revealPoint(nextPosition, result);
    }

    if (currentDistance > 1 && this.chebyshevDistance(monster.position, this.hero.position) > 1) {
      return;
    }

    if (this.getCell(this.hero.position).kind === 'safe') {
      return;
    }

    let hitPower = monsterPowerFromLegacyCode(monster.legacyTileCode) * 0.5;

    if (hitPower * 12 < this.hero.stats.luck + this.hero.stats.agility) {
      return;
    }

    hitPower /= 3 + HERO_DEFENSE_SLOTS.reduce((total, slot) => total + (this.hero.inventorySlots[slot] ?? 0), 0);
    this.hero.stats.strength -= hitPower;
    this.hero.stats.vitality -= hitPower / 101;
    this.pushMessage(result, MESSAGE_TEXT.monsterHit);
    this.pushSound(result, 'monster-hit');
    result.heroChanged = true;

    const breakRoll = this.rng.int(1, monsterPowerFromLegacyCode(monster.legacyTileCode));

    if (breakRoll === 1) {
      for (const slot of BREAKABLE_SLOTS) {
        if ((this.hero.inventorySlots[slot] ?? 0) > 0) {
          this.hero.inventorySlots[slot] = 0;
          this.pushMessage(
            result,
            `${MESSAGE_TEXT.broken} ${(ITEM_CATALOG[slot]?.shortName ?? 'GEAR').toUpperCase()}`
          );
          result.heroChanged = true;
          break;
        }
      }
    }

    if (this.hero.stats.strength < 1 || this.hero.stats.vitality < 1) {
      this.markDead(result);
    }
  }

  private resolveExit(previousPosition: Point, result: StepResult) {
    if (this.getCell(this.hero.position).kind !== 'exit') {
      return;
    }

    if (this.hero.stats.experience < this.hero.baseStats.experience + 1) {
      this.hero.position = previousPosition;
      this.pushMessage(result, MESSAGE_TEXT.needExperience);
      result.heroChanged = true;
      return;
    }

    this.runStatus = 'escaped';
    this.hero.status.escaped = true;
    this.pushMessage(result, MESSAGE_TEXT.exitLevel);
    this.pushSound(result, 'escape');
  }

  private winRun(result: StepResult) {
    this.runStatus = 'won';
    this.hero.status.won = true;
    this.score = this.computeScore();
    this.pushMessage(result, MESSAGE_TEXT.questOver);
    this.pushSound(result, 'win');
  }

  private markDead(result: StepResult) {
    this.runStatus = 'dead';
    this.hero.status.dead = true;
    this.hero.stats.strength = 0;
    this.pushMessage(result, 'THOU HAST EXPIRED!');
    result.heroChanged = true;
  }

  private killMonster(monster: MonsterState, result: StepResult) {
    monster.state = 'dead';
    this.hero.stats.experience += 0.1;
    this.activeMonsterId = null;
    this.pushMessage(result, MESSAGE_TEXT.monsterSlain);
    this.pushSound(result, 'monster-kill');
    result.heroChanged = true;
    result.monsterChanged = true;
    this.refreshActiveMonster();
  }

  private revealPoint(point: Point, result?: StepResult) {
    if (!this.isInBounds(point)) {
      return;
    }

    const key = pointKey(point);

    this.explored.add(key);
    this.visible.add(key);

    const monster = this.getMonsterAt(point);

    if (monster && monster.state === 'dormant') {
      monster.state = 'revealed';
      if (result) {
        result.monsterChanged = true;
      }
    }

    if (result) {
      this.recordCellChange(result, point);
    }
  }

  private refreshActiveMonster() {
    const aliveRevealed = this.monsters.filter(
      (monster) => monster.state !== 'dead' && monster.state !== 'dormant'
    );

    if (aliveRevealed.length === 0) {
      this.activeMonsterId = null;
      return;
    }

    aliveRevealed.sort((left, right) => {
      const distanceDiff =
        this.manhattanDistance(left.position, this.hero.position) -
        this.manhattanDistance(right.position, this.hero.position);

      if (distanceDiff !== 0) {
        return distanceDiff;
      }

      if (left.position.y !== right.position.y) {
        return left.position.y - right.position.y;
      }

      return left.position.x - right.position.x;
    });

    const activeMonster = aliveRevealed[0]!;

    for (const monster of aliveRevealed) {
      monster.state = monster.id === activeMonster.id ? 'active' : 'revealed';
    }

    this.activeMonsterId = activeMonster.id;
  }

  private getActiveMonster(): MonsterState | null {
    if (!this.activeMonsterId) {
      return null;
    }

    return this.monsters.find((monster) => monster.id === this.activeMonsterId) ?? null;
  }

  private getMonsterAt(point: Point): MonsterState | null {
    return (
      this.monsters.find(
        (monster) =>
          monster.state !== 'dead' &&
          monster.position.x === point.x &&
          monster.position.y === point.y
      ) ?? null
    );
  }

  private getCell(point: Point): LevelCell {
    const index = point.y * this.level.width + point.x;

    return this.level.cells[index]!;
  }

  private setCell(point: Point, kind: BaseTileKind) {
    const index = point.y * this.level.width + point.x;

    this.level.cells[index] = {
      kind,
      legacyCode: tileKindToLegacyCode(kind)
    };
  }

  private frontPosition(): Point {
    const vector = FACING_VECTORS[this.hero.facing];

    return {
      x: this.clampCoordinate(this.hero.position.x + vector.x),
      y: this.clampCoordinate(this.hero.position.y + vector.y)
    };
  }

  private clampCoordinate(value: number): number {
    if (value < 0) {
      return 0;
    }

    if (value >= GRID_SIZE) {
      return GRID_SIZE - 1;
    }

    return value;
  }

  private isInBounds(point: Point): boolean {
    return point.x >= 0 && point.y >= 0 && point.x < this.level.width && point.y < this.level.height;
  }

  private isMonsterPassable(point: Point): boolean {
    const cell = this.getCell(point);

    return cell.kind === 'floor';
  }

  private manhattanDistance(left: Point, right: Point): number {
    return Math.abs(left.x - right.x) + Math.abs(left.y - right.y);
  }

  private chebyshevDistance(left: Point, right: Point): number {
    return Math.max(Math.abs(left.x - right.x), Math.abs(left.y - right.y));
  }

  private computeScore(): number {
    return Math.floor(
      this.hero.treasure * 10 +
        this.hero.gold * this.hero.stats.experience +
        this.hero.stats.strength +
        this.hero.stats.vitality +
        this.hero.stats.agility
    );
  }

  private pushMessage(result: StepResult, message: string) {
    this.messages.push(message);
    this.messages = this.messages.slice(-MESSAGE_LIMIT);
    result.messages.push(message);
  }

  private pushSound(result: StepResult, sound: StepResult['sounds'][number]) {
    result.sounds.push(sound);
  }

  private recordCellChange(result: StepResult, point: Point) {
    if (!result.cellsChanged.some((entry) => entry.x === point.x && entry.y === point.y)) {
      result.cellsChanged.push(clonePoint(point));
    }
  }
}

export function createGameInit(hero: HeroState, level: LevelDefinition, seed: number): GameInit {
  return {
    hero: structuredClone(hero),
    level: structuredClone(level),
    seed
  };
}

export function resetHeroRuntime(hero: HeroState, level: LevelDefinition): HeroState {
  const runtimeHero = structuredClone(hero);

  runtimeHero.position = clonePoint(level.startPosition);
  runtimeHero.facing = 'N';
  runtimeHero.status.trapped = false;
  runtimeHero.status.won = false;
  runtimeHero.status.dead = false;
  runtimeHero.status.escaped = false;
  runtimeHero.lightUses = (runtimeHero.inventorySlots[16] ?? 0) > 0 ? DEFAULT_LIGHT_USES : 0;
  runtimeHero.spellCharges =
    runtimeHero.spellCharges[1] === 0 &&
    runtimeHero.spellCharges[2] === 0 &&
    runtimeHero.spellCharges[3] === 0 &&
    runtimeHero.spellCharges[4] === 0 &&
    runtimeHero.spellCharges[5] === 0 &&
    runtimeHero.spellCharges[6] === 0
      ? computeSpellChargesFromInventory(runtimeHero)
      : structuredClone(runtimeHero.spellCharges);

  return runtimeHero;
}

export function createHeroFromLegacyLoad(hero: HeroState): HeroState {
  const loadedHero = structuredClone(hero);

  loadedHero.baseStats = {
    strength: loadedHero.stats.strength,
    vitality: loadedHero.stats.vitality,
    agility: loadedHero.stats.agility,
    intelligence: loadedHero.stats.intelligence,
    experience: loadedHero.stats.experience,
    luck: loadedHero.stats.luck,
    aura: loadedHero.stats.aura,
    morality: loadedHero.stats.morality
  };
  loadedHero.spellCharges = computeSpellChargesFromInventory(loadedHero);
  loadedHero.lightUses = (loadedHero.inventorySlots[16] ?? 0) > 0 ? DEFAULT_LIGHT_USES : 0;
  loadedHero.status.trapped = false;
  loadedHero.status.won = false;
  loadedHero.status.dead = false;
  loadedHero.status.escaped = false;

  return loadedHero;
}

export function createEmptyHero(): HeroState {
  return {
    name: 'Hero',
    displayLabel: 'Hero -wanderer',
    classId: 'wanderer',
    stats: {
      strength: 5,
      vitality: 5,
      agility: 5,
      intelligence: 5,
      experience: 1,
      luck: 5,
      aura: 1,
      morality: 5
    },
    baseStats: {
      strength: 5,
      vitality: 5,
      agility: 5,
      intelligence: 5,
      experience: 1,
      luck: 5,
      aura: 1,
      morality: 5
    },
    gold: 0,
    treasure: 0,
    facing: 'N',
    position: { x: 0, y: 0 },
    inventorySlots: {
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
      6: 0,
      7: 0,
      8: 0,
      9: 0,
      10: 0,
      11: 0,
      12: 0,
      13: 0,
      14: 0,
      15: 0,
      16: 0,
      17: 0,
      18: 0,
      19: 0,
      20: 0,
      21: 0,
      22: 0,
      23: 0,
      24: 0
    },
    spellCharges: createEmptySpellCharges(),
    lightUses: 0,
    status: {
      trapped: false,
      won: false,
      dead: false,
      escaped: false
    }
  };
}
