import type { AdventureSnapshot } from '../adventure/model';
import type { Snapshot } from '../engine/types';

export const CLERIC_BLESSING =
  'Warmth floods the vault as the Idol leaves its plinth, and the god thou hast served all thy days speaks at last: well done, my faithful one. Few clerics come so far.';

export interface AdventureProgressViewRefs {
  panel: HTMLElement;
  title: HTMLHeadingElement;
  detail: HTMLParagraphElement;
  verse: HTMLParagraphElement;
  stage: HTMLElement;
  markers: HTMLDivElement;
}

export interface AdventureOutcomeViewRefs {
  panel: HTMLElement;
  subline: HTMLParagraphElement;
  title: HTMLHeadingElement;
  body: HTMLParagraphElement;
  verse: HTMLParagraphElement;
  continueButton: HTMLButtonElement;
}

export function renderAdventureProgress(
  refs: AdventureProgressViewRefs,
  snapshot: AdventureSnapshot | null
) {
  if (!snapshot) {
    refs.panel.hidden = true;
    return;
  }

  refs.panel.hidden = false;
  refs.title.textContent = snapshot.title;
  refs.verse.hidden = !(snapshot.status === 'playing' && snapshot.stageVerse);
  refs.verse.textContent = snapshot.stageVerse ?? '';
  refs.stage.textContent = `Level ${snapshot.stageIndex + 1} of ${snapshot.stageCount}`;
  refs.markers.innerHTML = Array.from({ length: snapshot.stageCount }, (_, index) => {
    const completed = snapshot.completedStages.some((stage) => stage.stageIndex === index);
    const state = completed ? 'completed' : index === snapshot.stageIndex ? 'current' : 'pending';

    return `<span data-state="${state}" aria-label="Level ${index + 1} ${state}">${index + 1}</span>`;
  }).join('');

  if (snapshot.status === 'betweenLevels') {
    refs.detail.textContent = `${snapshot.stageTitle} is cleared. Thy depleted resources carry into the descent.`;
  } else if (snapshot.status === 'won') {
    refs.detail.textContent = `The Idol is recovered after ${snapshot.cumulativeTurns} turns.`;
  } else if (snapshot.status === 'dead') {
    refs.detail.textContent = `The descent ends in ${snapshot.stageTitle}.`;
  } else if (snapshot.stageIndex === snapshot.stageCount - 1) {
    refs.detail.textContent = `${snapshot.stageTitle}. Find the Idol; the way out is barred without it. ${snapshot.cumulativeTurns} cumulative turns.`;
  } else {
    refs.detail.textContent = `${snapshot.stageTitle}. Exit opens at EXP ${snapshot.currentRun.exitExperienceTarget}; ${snapshot.cumulativeTurns} cumulative turns.`;
  }
}

export function renderAdventureOutcome(
  refs: AdventureOutcomeViewRefs,
  adventure: AdventureSnapshot,
  run: Snapshot
) {
  refs.continueButton.hidden = true;
  refs.verse.hidden = true;

  if (adventure.status === 'playing') {
    refs.panel.hidden = true;
    return;
  }

  refs.panel.hidden = false;

  if (adventure.status === 'betweenLevels') {
    const cleared = adventure.completedStages.at(-1);

    refs.subline.textContent = `Level ${adventure.stageIndex + 1} of ${adventure.stageCount} complete`;
    refs.title.textContent = 'The Way Below Opens';
    refs.body.textContent = cleared
      ? `${cleared.turns} turns, EXP +${cleared.experienceGained.toFixed(2)}, treasure +${cleared.treasureGained}. Strength, light, and magicks will not be restored.`
      : 'The level is cleared. Prepare to descend.';
    refs.continueButton.hidden = false;
    refs.continueButton.textContent = `Descend To Level ${adventure.stageIndex + 2}`;

    if (adventure.nextStageVerse) {
      refs.body.textContent += ' Words are carved above the stair down.';
      refs.verse.textContent = adventure.nextStageVerse;
      refs.verse.hidden = false;
    }
    return;
  }

  refs.subline.textContent = `${adventure.title} - ${adventure.cumulativeTurns} turns`;

  if (adventure.status === 'won') {
    refs.title.textContent = 'The Lost Idol Is Thine';
    refs.body.textContent = `Quest score ${run.score ?? '--'} with ${run.hero.treasure} treasure and ${run.hero.gold} gold.${run.hero.classId === 'cleric' ? ` ${CLERIC_BLESSING}` : ''}`;
    return;
  }

  refs.title.textContent = 'The Descent Claims Thee';
  refs.body.textContent = `Fallen in ${adventure.stageTitle}. Final STR ${Math.floor(run.hero.stats.strength)}, VIT ${Math.floor(run.hero.stats.vitality)}.`;
}
