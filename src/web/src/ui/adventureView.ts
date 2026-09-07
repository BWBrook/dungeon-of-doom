import type { AdventureSnapshot } from '../adventure/model';
import type { Snapshot } from '../engine/types';

export interface AdventureProgressViewRefs {
  panel: HTMLElement;
  title: HTMLHeadingElement;
  detail: HTMLParagraphElement;
  stage: HTMLElement;
  markers: HTMLDivElement;
}

export interface AdventureOutcomeViewRefs {
  panel: HTMLElement;
  subline: HTMLParagraphElement;
  title: HTMLHeadingElement;
  body: HTMLParagraphElement;
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
  } else if (snapshot.status === 'abandoned') {
    refs.detail.textContent = 'The final vault was left without the Idol.';
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
    return;
  }

  refs.subline.textContent = `${adventure.title} - ${adventure.cumulativeTurns} turns`;

  if (adventure.status === 'won') {
    refs.title.textContent = 'The Lost Idol Is Thine';
    refs.body.textContent = `Quest score ${run.score ?? '--'} with ${run.hero.treasure} treasure and ${run.hero.gold} gold.`;
    return;
  }

  if (adventure.status === 'abandoned') {
    refs.title.textContent = 'The Quest Is Left Unfinished';
    refs.body.textContent = `Thou escaped the Idol Vault with EXP ${run.hero.stats.experience.toFixed(2)}, but without the Idol.`;
    return;
  }

  refs.title.textContent = 'The Descent Claims Thee';
  refs.body.textContent = `Fallen in ${adventure.stageTitle}. Final STR ${Math.floor(run.hero.stats.strength)}, VIT ${Math.floor(run.hero.stats.vitality)}.`;
}
