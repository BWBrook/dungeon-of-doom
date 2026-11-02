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
    '#..1.....2....#',
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
    '#...#..2..T...#',
    '#...#.........#',
    '#...#####.###.#',
    '#2.....V......#',
    '#.###.....###.#',
    '#....2.S......#',
    '#.###.....###.#',
    '#......T......#',
    '#..3.....2....#',
    '#......C......#',
    '###.V.........#',
    '#RW..........X#',
    '###############'
  ]
});

const idolVault = defineLevelFromRows({
  id: 3,
  rows: [
    '###############',
    '#E....#.......#',
    '#..V..#..T....#',
    '#.....#.......#',
    '#.#####.#####.#',
    '#..1..........#',
    '#.....V.......#',
    '#..###.S.###..#',
    '#.............#',
    '#..###...###..#',
    '#..........1..#',
    '#......C..###3#',
    '#.........#I..#',
    '#.........#..X#',
    '###############'
  ]
});

export const lostIdolAdventure: AdventureDefinition = {
  id: 'lost-idol',
  title: 'The Lost Idol',
  description: 'Descend beneath ruined Crekkan and recover the Idol from the deepest vault.',
  stages: [
    { id: 'shattered-gate', title: 'The Shattered Gate', level: shatteredGate },
    {
      id: 'black-galleries',
      title: 'The Black Galleries',
      level: blackGalleries,
      verse: [
        'In the western dark a relic lies,',
        'Its warden sleeps with open eyes.',
        'Take heart, and it may serve thee well,',
        'Or leave it be and live to tell.'
      ].join('\n')
    },
    { id: 'idol-vault', title: 'The Idol Vault', level: idolVault }
  ]
};
