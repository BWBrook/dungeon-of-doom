export type ClassId = 'wanderer' | 'cleric' | 'mage' | 'warrior' | 'barbarian';

export type Facing = 'N' | 'E' | 'S' | 'W';

export type RunStatus = 'playing' | 'won' | 'dead' | 'escaped';

export type SoundCue =
  | 'attack-hit'
  | 'attack-miss'
  | 'monster-hit'
  | 'monster-kill'
  | 'pickup'
  | 'spell'
  | 'trap'
  | 'bump'
  | 'save'
  | 'win'
  | 'escape';

export type SpellSlot = 1 | 2 | 3 | 4 | 5 | 6;

export type BaseTileKind =
  | 'floor'
  | 'wall'
  | 'vase'
  | 'chest'
  | 'idol'
  | 'entrance'
  | 'exit'
  | 'trap'
  | 'safe';

export interface Point {
  x: number;
  y: number;
}

export interface Stats {
  strength: number;
  vitality: number;
  agility: number;
  intelligence: number;
  experience: number;
  luck: number;
  aura: number;
  morality: number;
}

export interface HeroStatus {
  trapped: boolean;
  won: boolean;
  dead: boolean;
  escaped: boolean;
}

export interface HeroState {
  name: string;
  displayLabel: string;
  classId: ClassId;
  stats: Stats;
  baseStats: Stats;
  gold: number;
  treasure: number;
  facing: Facing;
  position: Point;
  inventorySlots: Record<number, number>;
  spellCharges: Record<SpellSlot, number>;
  lightUses: number;
  status: HeroStatus;
}

export interface LevelCell {
  kind: BaseTileKind;
  legacyCode: number;
}

export interface MonsterSpawn {
  id: string;
  position: Point;
  legacyTileCode: number;
}

export interface LevelDefinition {
  id: number;
  width: number;
  height: number;
  cells: LevelCell[];
  startPosition: Point;
  authoredEntrancePosition: Point;
  monsterSpawns: MonsterSpawn[];
}

export type MonsterStateFlag = 'dormant' | 'revealed' | 'active' | 'dead';

export interface MonsterState {
  id: string;
  legacyTileCode: number;
  position: Point;
  hp: number;
  stepSize: number;
  state: MonsterStateFlag;
}

export type Action =
  | { type: 'turnLeft' }
  | { type: 'turnRight' }
  | { type: 'moveForward' }
  | { type: 'attack' }
  | { type: 'get' }
  | { type: 'useRestorative' }
  | { type: 'reveal' }
  | { type: 'castSpell'; slot: SpellSlot }
  | { type: 'wait' };

export interface GameInit {
  hero: HeroState;
  level: LevelDefinition;
  seed: number;
  exitExperienceTarget: number;
}

export interface StepResult {
  messages: string[];
  sounds: SoundCue[];
  cellsChanged: Point[];
  heroChanged: boolean;
  monsterChanged: boolean;
  runStatusChanged: boolean;
}

export interface SnapshotCell {
  position: Point;
  visible: boolean;
  explored: boolean;
  tile: BaseTileKind | null;
  monster: {
    id: string;
    hp: number;
    active: boolean;
  } | null;
}

export interface Snapshot {
  hero: HeroState;
  levelView: {
    width: number;
    height: number;
    cells: SnapshotCell[];
  };
  visibleCells: Point[];
  activeMonster: MonsterState | null;
  messages: string[];
  runStatus: RunStatus;
  score: number | null;
  turnCount: number;
  exitExperienceTarget: number;
}

export interface SerializedRun {
  version: 2;
  seed: number;
  rngState: number;
  hero: HeroState;
  level: LevelDefinition;
  monsters: MonsterState[];
  exploredKeys: string[];
  visibleKeys: string[];
  messages: string[];
  activeMonsterId: string | null;
  runStatus: RunStatus;
  score: number | null;
  turnCount: number;
  exitExperienceTarget: number;
}
