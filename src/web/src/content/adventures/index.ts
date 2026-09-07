import type { AdventureDefinition } from '../../adventure/model';
import { lostIdolAdventure } from './lostIdol';

export const adventureCatalog: Record<string, AdventureDefinition> = {
  [lostIdolAdventure.id]: lostIdolAdventure
};

export function adventureById(id: string): AdventureDefinition | null {
  return adventureCatalog[id] ?? null;
}

export { lostIdolAdventure };
