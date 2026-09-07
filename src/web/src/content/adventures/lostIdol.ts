import type { AdventureDefinition } from '../../adventure/model';
import { defineLevelFromRows } from '../../engine/levelBuilder';

const shatteredGate = defineLevelFromRows({
  id: 1,
  rows: [
    '###############',
    '#E............#',
    '#..###...###..#',
    '#..1.....1....#',
    '#.....V.......#',
    '#.###.....###.#',
    '#.....C.......#',
    '#..1.....1....#',
    '#.....S.......#',
    '#.###.....###.#',
    '#.............#',
    '#..1......V...#',
    '#.............#',
    '#............X#',
    '###############'
  ]
});

const blackGalleries = defineLevelFromRows({
  id: 2,
  rows: [
    '###############',
    '#E..#.........#',
    '#...#..1..T...#',
    '#...#.........#',
    '#...#####.###.#',
    '#1.....V......#',
    '#.###.....###.#',
    '#....2.S......#',
    '#.###.....###.#',
    '#......T......#',
    '#..1.....2....#',
    '#......C......#',
    '#...V.........#',
    '#............X#',
    '###############'
  ]
});

const idolVault = defineLevelFromRows({
  id: 3,
  rows: [
    '###############',
    '#E....#.......#',
    '#..2..#..T....#',
    '#.....#.......#',
    '#.#####.#####.#',
    '#..1.....2....#',
    '#.....V.......#',
    '#..###.S.###..#',
    '#....3........#',
    '#..###...###..#',
    '#....2.....1..#',
    '#......C......#',
    '#..........I..#',
    '#............X#',
    '###############'
  ]
});

export const lostIdolAdventure: AdventureDefinition = {
  id: 'lost-idol',
  title: 'The Lost Idol',
  description: 'Descend beneath ruined Crekkan and recover the Idol from the deepest vault.',
  stages: [
    { id: 'shattered-gate', title: 'The Shattered Gate', level: shatteredGate },
    { id: 'black-galleries', title: 'The Black Galleries', level: blackGalleries },
    { id: 'idol-vault', title: 'The Idol Vault', level: idolVault }
  ]
};
