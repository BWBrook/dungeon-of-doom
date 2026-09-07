import { CLASS_LABELS } from '../engine/catalog';
import type { LevelDefinition, Snapshot } from '../engine/types';

export type CommandId =
  | 'turnLeft'
  | 'turnRight'
  | 'moveForward'
  | 'attack'
  | 'get'
  | 'restore'
  | 'reveal'
  | 'conjure'
  | 'wait'
  | 'save';

export type RunOutcome = 'won' | 'escaped' | 'dead' | null;

export interface CommandState {
  id: CommandId;
  label: string;
  hotkey: string;
  enabled: boolean;
  hint: string;
}

export interface RunResource {
  label: string;
  value: string;
}

export interface RunPresentation {
  headline: string;
  subline: string;
  resources: RunResource[];
  commandStates: CommandState[];
  latestMessage: string;
  logRows: string[];
  outcome: RunOutcome;
}

export interface RunPresentationOptions {
  saveAllowedAfterRun?: boolean;
  turnMessages?: string[];
}

const COMMANDS: Array<Omit<CommandState, 'enabled' | 'hint'>> = [
  { id: 'turnLeft', label: 'Turn Left', hotkey: 'B' },
  { id: 'turnRight', label: 'Turn Right', hotkey: 'N' },
  { id: 'moveForward', label: 'Move', hotkey: 'M' },
  { id: 'attack', label: 'Attack', hotkey: 'A' },
  { id: 'get', label: 'Get', hotkey: 'G' },
  { id: 'restore', label: 'Restore', hotkey: 'P' },
  { id: 'reveal', label: 'Reveal', hotkey: 'R' },
  { id: 'conjure', label: 'Conjure', hotkey: 'C' },
  { id: 'wait', label: 'Wait', hotkey: '.' },
  { id: 'save', label: 'Save', hotkey: 'S' }
];

export function createRunPresentation(
  snapshot: Snapshot | null,
  level: LevelDefinition | null,
  fallbackMessages: string[] = [],
  options: RunPresentationOptions = {}
): RunPresentation {
  if (!snapshot) {
    return {
      headline: 'Choose thy quest',
      subline: 'Select a hero and level, then start a run.',
      resources: [],
      commandStates: COMMANDS.map((command) => ({
        ...command,
        enabled: false,
        hint: 'Start a run first.'
      })),
      latestMessage: fallbackMessages.at(-1) ?? 'The dungeon awaits.',
      logRows: fallbackMessages.length > 0 ? fallbackMessages : ['The dungeon awaits.'],
      outcome: null
    };
  }

  const outcome: RunOutcome = snapshot.runStatus === 'playing' ? null : snapshot.runStatus;
  const canAct = snapshot.runStatus === 'playing';
  const hero = snapshot.hero;
  const hasRestorative = (hero.inventorySlots[23] ?? 0) > 0 || (hero.inventorySlots[24] ?? 0) > 0;
  const hasMagicSource = (hero.inventorySlots[17] ?? 0) > 0 || (hero.inventorySlots[18] ?? 0) > 0;
  const hasLight = hero.lightUses > 0;
  const turnMessages = options.turnMessages ?? [];
  const latestMessage =
    turnMessages.length > 0
      ? turnMessages.join(' \u00b7 ')
      : snapshot.messages.at(-1) ?? fallbackMessages.at(-1) ?? 'The dungeon awaits.';

  return {
    headline: `${hero.name} the ${CLASS_LABELS[hero.classId]}`,
    subline: `Level ${level?.id ?? '?'} - turn ${snapshot.turnCount} - ${formatRunStatus(snapshot.runStatus)}`,
    resources: [
      { label: 'STR', value: formatNumber(hero.stats.strength) },
      { label: 'VIT', value: formatNumber(hero.stats.vitality) },
      { label: 'AUR', value: formatNumber(hero.stats.aura) },
      { label: 'EXP', value: formatNumber(hero.stats.experience) },
      { label: 'NEXT EXP', value: String(snapshot.exitExperienceTarget) },
      { label: 'FACE', value: hero.facing },
      { label: 'RUN', value: snapshot.runStatus.toUpperCase() },
      { label: 'LIGHT', value: String(hero.lightUses) },
      { label: 'SALVE', value: String(hero.inventorySlots[23] ?? 0) },
      { label: 'POTION', value: String(hero.inventorySlots[24] ?? 0) },
      { label: 'MAGIC', value: magicLabel(hero.inventorySlots[17] ?? 0, hero.inventorySlots[18] ?? 0) },
      { label: 'ACTIVE', value: snapshot.activeMonster ? `${Math.ceil(snapshot.activeMonster.hp)} HP` : 'NONE' },
      { label: 'SCORE', value: snapshot.score === null ? '--' : String(snapshot.score) }
    ],
    commandStates: commandStates(
      canAct,
      options.saveAllowedAfterRun ?? false,
      hasRestorative,
      hasMagicSource,
      hasLight,
      snapshot.activeMonster !== null
    ),
    latestMessage,
    logRows: snapshot.messages.length > 0 ? snapshot.messages : [latestMessage],
    outcome
  };
}

function commandStates(
  canAct: boolean,
  saveAllowedAfterRun: boolean,
  hasRestorative: boolean,
  hasMagicSource: boolean,
  hasLight: boolean,
  hasActiveMonster: boolean
): CommandState[] {
  return COMMANDS.map((command) => {
    if (!canAct) {
      if (command.id === 'save' && saveAllowedAfterRun) {
        return { ...command, enabled: true, hint: 'Save adventure progress.' };
      }

      return { ...command, enabled: false, hint: 'Run has ended.' };
    }

    switch (command.id) {
      case 'attack':
        return { ...command, enabled: hasActiveMonster, hint: hasActiveMonster ? 'Strike the active monster.' : 'No active monster.' };
      case 'restore':
        return { ...command, enabled: hasRestorative, hint: hasRestorative ? 'Use salves or potions.' : 'No restoratives.' };
      case 'reveal':
        return { ...command, enabled: hasLight, hint: hasLight ? 'Spend one light use.' : 'No light remains.' };
      case 'conjure':
        return { ...command, enabled: hasMagicSource, hint: hasMagicSource ? 'Choose a spell.' : 'No magicks available.' };
      default:
        return { ...command, enabled: true, hint: command.label };
    }
  });
}

function formatRunStatus(status: Snapshot['runStatus']): string {
  switch (status) {
    case 'playing':
      return 'exploring';
    case 'won':
      return 'quest complete';
    case 'escaped':
      return 'escaped';
    case 'dead':
      return 'fallen';
  }
}

function formatNumber(value: number): string {
  return String(Math.floor(value));
}

function magicLabel(necronomicon: number, scrolls: number): string {
  if (necronomicon > 0 && scrolls > 0) {
    return 'BOOK+SCROLLS';
  }

  if (necronomicon > 0) {
    return 'BOOK';
  }

  if (scrolls > 0) {
    return 'SCROLLS';
  }

  return 'NONE';
}
