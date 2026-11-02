import { writeFileSync } from 'node:fs';

import { adventureById, lostIdolAdventure } from '../content/adventures';
import { ARCHETYPES, buildArchetypeHero } from './heroes';
import { POLICY_STYLES, RELIC_INTENTS } from './policy';
import type { PolicyStyle, RelicIntent } from './policy';
import { VISIONS, formatSummaryTable, simulateAdventure, summarizeRuns } from './simulate';
import type { RunRecord, Vision } from './simulate';

interface CliOptions {
  seeds: number;
  firstSeed: number;
  questId: string;
  out: string | null;
  classes: string[] | null;
  styles: PolicyStyle[];
  visions: Vision[];
  relicIntents: RelicIntent[];
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
    visions: [...VISIONS],
    relicIntents: ['heed'],
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
      case '--vision':
        options.visions = (value ?? '')
          .split(',')
          .filter((entry): entry is Vision => VISIONS.includes(entry as Vision));
        index += 1;
        break;
      case '--relic':
        options.relicIntents = (value ?? '')
          .split(',')
          .filter((entry): entry is RelicIntent => RELIC_INTENTS.includes(entry as RelicIntent));
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

    for (const vision of options.visions) {
      for (const relicIntent of options.relicIntents) {
        for (const style of options.styles) {
          for (let offset = 0; offset < options.seeds; offset += 1) {
            records.push(
              simulateAdventure(hero, definition, options.firstSeed + offset, {
                maxTurnsPerStage: options.maxTurnsPerStage,
                style,
                vision,
                relicIntent
              })
            );
          }
        }
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
    'Omniscient bots read the whole level; fog bots see only what the play screen shows, explore by walking on into the dark along a route that varies with the seed, and ration reveals across the levels ahead. Careful rests below half strength and before deliberate fights, and drinks in a fight below half strength; reckless rests below a third and drinks only when the next hit would be fatal; neither drinks outside a fight while it can rest. Completionist fights every known monster on the final level before taking the Idol. A heeding bot leaves a verse\'s relic alone; a seeking bot wakes its warden and takes it. Death % is per level entered; Light and Bumps are per run; Relic taken and Saved are % of runs.',
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
