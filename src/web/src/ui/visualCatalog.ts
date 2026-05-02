import type { BaseTileKind, Facing } from '../engine/types';

export const CELL_SIZE = 32;
export const GRID_PIXELS = CELL_SIZE * 15;

export const VISUAL_EFFECTS = [
  'idle',
  'bump',
  'damage',
  'pickup',
  'spell',
  'trap',
  'save',
  'win',
  'escape',
  'dead'
] as const;

export type VisualEffectKind = (typeof VISUAL_EFFECTS)[number];

export interface TileVisual {
  glyph: string;
  lit: string;
  dim: string;
  ink: string;
  accent: string;
}

export const LAMP_TERMINAL_THEME = {
  canvasBack: '#070706',
  fog: '#080907',
  explored: '#161710',
  grid: 'rgba(244, 222, 170, 0.12)',
  gridStrong: 'rgba(255, 211, 127, 0.35)',
  glyphLit: '#ffe6a3',
  glyphDim: '#8a7c5d',
  brass: '#d7ad55',
  parchment: '#f4edd4',
  ember: '#e06d42',
  moss: '#6d8147',
  arcane: '#74d3ff'
} as const;

export const TILE_VISUALS: Record<BaseTileKind, TileVisual> = {
  floor: {
    glyph: '.',
    lit: '#1d2618',
    dim: '#151811',
    ink: '#c3b47e',
    accent: '#6f7949'
  },
  wall: {
    glyph: '#',
    lit: '#665238',
    dim: '#272017',
    ink: '#f4d596',
    accent: '#a67d45'
  },
  vase: {
    glyph: 'V',
    lit: '#285f76',
    dim: '#15262b',
    ink: '#d5eef2',
    accent: '#74d3ff'
  },
  chest: {
    glyph: '$',
    lit: '#7d4f1d',
    dim: '#2f2111',
    ink: '#ffe098',
    accent: '#d7ad55'
  },
  idol: {
    glyph: '*',
    lit: '#af902f',
    dim: '#352b11',
    ink: '#fff0b8',
    accent: '#ffd35d'
  },
  entrance: {
    glyph: 'E',
    lit: '#23563a',
    dim: '#122318',
    ink: '#d6f0c7',
    accent: '#99c45b'
  },
  exit: {
    glyph: 'X',
    lit: '#5c692d',
    dim: '#202411',
    ink: '#edf0b1',
    accent: '#c8c56c'
  },
  trap: {
    glyph: '!',
    lit: '#742634',
    dim: '#2b1118',
    ink: '#ffb0a0',
    accent: '#e06d42'
  },
  safe: {
    glyph: '+',
    lit: '#22526f',
    dim: '#12232d',
    ink: '#d5edf7',
    accent: '#7fb7d7'
  }
};

export const HERO_GLYPHS: Record<Facing, string> = {
  N: '^',
  E: '>',
  S: 'v',
  W: '<'
};

export const TILE_COLORS: Record<BaseTileKind, string> = {
  floor: TILE_VISUALS.floor.lit,
  wall: TILE_VISUALS.wall.lit,
  vase: TILE_VISUALS.vase.lit,
  chest: TILE_VISUALS.chest.lit,
  idol: TILE_VISUALS.idol.lit,
  entrance: TILE_VISUALS.entrance.lit,
  exit: TILE_VISUALS.exit.lit,
  trap: TILE_VISUALS.trap.lit,
  safe: TILE_VISUALS.safe.lit
};

export const TILE_GLYPHS: Record<BaseTileKind, string> = {
  floor: TILE_VISUALS.floor.glyph,
  wall: TILE_VISUALS.wall.glyph,
  vase: TILE_VISUALS.vase.glyph,
  chest: TILE_VISUALS.chest.glyph,
  idol: TILE_VISUALS.idol.glyph,
  entrance: TILE_VISUALS.entrance.glyph,
  exit: TILE_VISUALS.exit.glyph,
  trap: TILE_VISUALS.trap.glyph,
  safe: TILE_VISUALS.safe.glyph
};

export const MONSTER_VISUALS = {
  dormant: {
    glyph: 'm',
    fill: '#9a4d3d',
    ink: '#ffd0ba',
    outline: 'rgba(224, 109, 66, 0.35)'
  },
  active: {
    glyph: 'M',
    fill: '#c64f38',
    ink: '#fff0d0',
    outline: '#ffd35d'
  },
  elder: {
    glyph: 'M',
    fill: '#e06d42',
    ink: '#fff7d3',
    outline: '#ffef9f'
  }
} as const;

export const EFFECT_COLORS: Record<VisualEffectKind, string | null> = {
  idle: null,
  bump: 'rgba(208, 88, 54, 0.46)',
  damage: 'rgba(224, 72, 52, 0.58)',
  pickup: 'rgba(255, 211, 93, 0.46)',
  spell: 'rgba(116, 211, 255, 0.5)',
  trap: 'rgba(179, 54, 72, 0.52)',
  save: 'rgba(215, 173, 85, 0.42)',
  win: 'rgba(255, 227, 127, 0.58)',
  escape: 'rgba(153, 196, 91, 0.48)',
  dead: 'rgba(160, 32, 32, 0.62)'
};
