import type { HeroState, SpellSlot, Stats } from '../engine/types';

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

export function parseHeroDocument(input: string): ModernHeroDocument {
  const parsed = JSON.parse(input) as unknown;

  if (!isObject(parsed)) {
    throw new Error('Modern hero document must be an object.');
  }

  if (parsed.kind !== 'dungeon-of-doom.hero') {
    throw new Error('Modern hero document has an unsupported kind.');
  }

  if (parsed.version !== 1) {
    throw new Error('Modern hero document has an unsupported version.');
  }

  if (!isHeroState(parsed.hero)) {
    throw new Error('Modern hero document has an invalid hero payload.');
  }

  return {
    kind: parsed.kind,
    version: parsed.version,
    hero: parsed.hero
  };
}

function isHeroState(value: unknown): value is HeroState {
  if (!isObject(value)) {
    return false;
  }

  return (
    typeof value.name === 'string' &&
    typeof value.displayLabel === 'string' &&
    typeof value.classId === 'string' &&
    isStats(value.stats) &&
    isStats(value.baseStats) &&
    Number.isFinite(value.gold) &&
    Number.isFinite(value.treasure) &&
    typeof value.facing === 'string' &&
    isPoint(value.position) &&
    isInventorySlots(value.inventorySlots) &&
    isSpellCharges(value.spellCharges) &&
    Number.isFinite(value.lightUses) &&
    isObject(value.status)
  );
}

function isStats(value: unknown): value is Stats {
  return (
    isObject(value) &&
    Number.isFinite(value.strength) &&
    Number.isFinite(value.vitality) &&
    Number.isFinite(value.agility) &&
    Number.isFinite(value.intelligence) &&
    Number.isFinite(value.experience) &&
    Number.isFinite(value.luck) &&
    Number.isFinite(value.aura) &&
    Number.isFinite(value.morality)
  );
}

function isInventorySlots(value: unknown): value is Record<number, number> {
  if (!isObject(value)) {
    return false;
  }

  for (let slot = 1; slot <= 24; slot += 1) {
    if (!Number.isFinite(value[slot])) {
      return false;
    }
  }

  return true;
}

function isSpellCharges(value: unknown): value is Record<SpellSlot, number> {
  if (!isObject(value)) {
    return false;
  }

  for (let slot = 1; slot <= 6; slot += 1) {
    if (!Number.isFinite(value[slot])) {
      return false;
    }
  }

  return true;
}

function isPoint(value: unknown): value is { x: number; y: number } {
  return isObject(value) && Number.isInteger(value.x) && Number.isInteger(value.y);
}

function isObject(value: unknown): value is Record<string | number, unknown> {
  return typeof value === 'object' && value !== null;
}
