import type { BaseTileKind, Facing } from '../engine/types';

export const CELL_SIZE = 32;
export const GRID_PIXELS = CELL_SIZE * 15;

export const TILE_COLORS: Record<BaseTileKind, string> = {
  floor: '#1c221b',
  wall: '#65543d',
  vase: '#375e77',
  chest: '#7a4d1d',
  idol: '#ae8e2a',
  entrance: '#24533a',
  exit: '#58662f',
  trap: '#6b2331',
  safe: '#224e6a'
};

export const TILE_GLYPHS: Record<BaseTileKind, string> = {
  floor: '.',
  wall: '#',
  vase: 'V',
  chest: '$',
  idol: '*',
  entrance: 'E',
  exit: 'X',
  trap: '!',
  safe: '+'
};

export const HERO_GLYPHS: Record<Facing, string> = {
  N: '^',
  E: '>',
  S: 'v',
  W: '<'
};
