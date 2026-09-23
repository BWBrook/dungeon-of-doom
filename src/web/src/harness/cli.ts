import { writeFileSync } from 'node:fs';

import { adventureById, lostIdolAdventure } from '../content/adventures';
import { ARCHETYPES, buildArchetypeHero } from './heroes';
import { POLICY_STYLES } from './policy';
import type { PolicyStyle } from './policy';
import { formatSummaryTable, simulateAdventure, summarizeRuns } from './simulate';
import type { RunRecord } from './simulate';

interface CliOptions {
  seeds: number;
  firstSeed: number;
  questId: string;
  out: string | null;
  classes: string[] | null;
  styles: PolicyStyle[];
  maxTurnsPerStage: number;
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    seeds: 30,
    firstSeed: 1,
    questId: lostIdolAdventure.id,
    out: null,
    classes: null,
    styles: [...POLICY_STYLES],
    maxTurnsPerStage: 600
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]!;
    const value = argv[index + 1];

    switch (arg) {
      case '--seeds':
        options.seeds = Number(value);
        index += 1;
        break;
      case '--first-seed':
        options.firstSeed = Number(value);
        index += 1;
        break;
      case '--quest':
        options.questId = value ?? options.questId;
        index += 1;
        break;
      case '--out':
        options.out = value ?? null;
        index += 1;
        break;
      case '--classes':
        options.classes = (value ?? '').split(',').filter(Boolean);
        index += 1;
        break;
      case '--styles':
        options.styles = (value ?? '')
          .split(',')
          .filter((entry): entry is PolicyStyle => POLICY_STYLES.includes(entry as PolicyStyle));
        index += 1;
        break;
      case '--max-turns':
        options.maxTurnsPerStage = Number(value);
        index += 1;
        break;
      default:
        throw new Error(`Unknown argument ${arg}`);
    }
  }

  return options;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const definition = adventureById(options.questId);

  if (!definition) {
    throw new Error(`Unknown bundled quest ${options.questId}.`);
  }

  const archetypes = ARCHETYPES.filter(
    (archetype) => options.classes === null || options.classes.includes(archetype.classId)
  );
  const records: RunRecord[] = [];
  const started = Date.now();

  for (const archetype of archetypes) {
    const hero = buildArchetypeHero(archetype);

    for (const style of options.styles) {
      for (let offset = 0; offset < options.seeds; offset += 1) {
        records.push(
          simulateAdventure(hero, definition, options.firstSeed + offset, {
            maxTurnsPerStage: options.maxTurnsPerStage,
            style
          })
        );
      }
    }
  }

  const summaries = summarizeRuns(records, definition.stages.length);
  const elapsed = ((Date.now() - started) / 1000).toFixed(1);
  const lines = [
    `# Balance report: ${definition.title}`,
    '',
    `Generated ${new Date().toISOString().slice(0, 10)} with seeds ${options.firstSeed}..${options.firstSeed + options.seeds - 1}, ${options.maxTurnsPerStage} turn cap per level, ${elapsed}s.`,
    '',
    'All bots know the map, collect vases first, take chests, and wake and fight monsters until the exit opens. Careful drinks below half strength and tops up before fights; reckless drinks only when the next hit would be fatal; completionist plays carefully but clears the final level before taking the Idol. Death % is per level entered.',
    '',
    formatSummaryTable(summaries, definition.stages.length),
    '',
    '## Archetypes',
    '',
    ...archetypes.map((archetype) => {
      const hero = buildArchetypeHero(archetype);
      const gear = Object.entries(hero.inventorySlots)
        .filter(([, value]) => value > 0)
        .map(([slot, value]) => `${slot}:${value}`)
        .join(' ');
      const stats = hero.stats;

      return `- ${archetype.classId} (${archetype.name}): STR ${stats.strength} VIT ${stats.vitality} AGI ${stats.agility} INT ${stats.intelligence} LUCK ${stats.luck} AUR ${stats.aura} MOR ${stats.morality}; gold left ${hero.gold}; slots ${gear}`;
    }),
    ''
  ];
  const report = lines.join('\n');

  console.log(report);

  if (options.out) {
    writeFileSync(options.out, report);
    console.log(`\nWritten to ${options.out}`);
  }
}

main();
