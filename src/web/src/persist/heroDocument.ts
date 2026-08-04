import type { HeroState } from '../engine/types';

export interface ModernHeroDocument {
  kind: 'dungeon-of-doom.hero';
  version: 1;
  hero: HeroState;
}

export function formatHeroDocument(hero: HeroState): string {
  const document: ModernHeroDocument = {
    kind: 'dungeon-of-doom.hero',
    version: 1,
    hero
  };

  return JSON.stringify(document, null, 2);
}
