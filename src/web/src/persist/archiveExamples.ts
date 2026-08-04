import { createLegacyFriendlyLevelFixture, mixedDemoLevel, revealGuardLevel, warriorStarter } from '../engine/fixtures';
import { formatHeroString, formatLevelString } from './legacy';

export interface ArchiveExample {
  id: string;
  label: string;
  description: string;
  heroPayload: string;
  levelPayload: string;
}

export const ARCHIVE_EXAMPLES: ArchiveExample[] = [
  {
    id: 'starter-hero',
    label: 'Starter HERO',
    description: 'A generated fixture HERO payload for byte-level character inspection.',
    heroPayload: formatHeroString(warriorStarter),
    levelPayload: ''
  },
  {
    id: 'authored-level',
    label: 'Authored LEVEL',
    description: 'A generated authored LEVEL payload with entrance and exit metadata.',
    heroPayload: '',
    levelPayload: formatLevelString(createLegacyFriendlyLevelFixture())
  },
  {
    id: 'record-chunked-level',
    label: 'Record-Chunked LEVEL',
    description: 'The same LEVEL style split into archival 76-byte records.',
    heroPayload: '',
    levelPayload: chunkLevelPayload(formatLevelString(createLegacyFriendlyLevelFixture()))
  },
  {
    id: 'monster-level',
    label: 'Monster LEVEL',
    description: 'A generated LEVEL payload containing legacy monster tile codes.',
    heroPayload: '',
    levelPayload: formatLevelString(revealGuardLevel)
  },
  {
    id: 'snapshot-pair',
    label: 'Mid-Game Snapshot Pair',
    description: 'A generated HERO/LEVEL pair shaped like an archival mid-game save.',
    heroPayload: formatHeroString({
      ...structuredClone(warriorStarter),
      stats: {
        ...warriorStarter.stats,
        strength: 8,
        vitality: 7,
        experience: 2
      },
      gold: 51,
      treasure: 2
    }),
    levelPayload: formatLevelString({
      ...structuredClone(mixedDemoLevel),
      startPosition: { x: 7, y: 6 }
    })
  }
];

export function archiveExampleById(id: string): ArchiveExample | null {
  return ARCHIVE_EXAMPLES.find((example) => example.id === id) ?? null;
}

function chunkLevelPayload(payload: string): string {
  return payload.match(/.{1,76}/g)?.join('\n') ?? payload;
}
