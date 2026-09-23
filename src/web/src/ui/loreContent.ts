export const LORE_TEMPLATE = String.raw`
    <section class="lore">
      <article class="panel lore-panel">
        <h2>The Quest</h2>
        <p>
          Somewhere beneath the ruins lies the Lost Idol. A single hero descends through a
          series of dungeon levels, each fifteen squares across, each darker and more dangerous
          than the last. Take the Idol and the quest is won. Run out of strength and the descent
          ends where you fall.
        </p>
        <p>
          Every level begins in darkness. Squares light up as you walk through them and stay lit.
          The exit only opens once you have earned enough experience on that level, so you cannot
          simply run for the stairs.
        </p>
      </article>
      <article class="panel lore-panel">
        <h2>Keys</h2>
        <dl class="lore-keys">
          <div><dt>B / N</dt><dd>Turn anticlockwise or clockwise. You only move the way you face.</dd></div>
          <div><dt>M</dt><dd>Move one square forward. Walls stop you and sap a little strength.</dd></div>
          <div><dt>A</dt><dd>Attack the active monster. Keep pressing while the fight lasts.</dd></div>
          <div><dt>G</dt><dd>Get whatever is in the square ahead: a vase, a chest, or the Idol.</dd></div>
          <div><dt>R</dt><dd>Reveal the three-by-three area around you. Costs one light.</dd></div>
          <div><dt>P</dt><dd>Take a potion and a salve to restore strength and vitality.</dd></div>
          <div><dt>C</dt><dd>Conjure. Opens the spell list if you carry the Necronomicon or the Scrolls.</dd></div>
          <div><dt>1 to 6</dt><dd>Cast that spell directly.</dd></div>
          <div><dt>.</dt><dd>Wait a turn. Standing still recovers strength very slowly.</dd></div>
          <div><dt>S</dt><dd>Save the run, or the whole adventure, to this browser.</dd></div>
        </dl>
      </article>
      <article class="panel lore-panel">
        <h2>Attributes</h2>
        <dl class="lore-keys">
          <div><dt>Strength</dt><dd>Your health and your hitting power. Every action wears it down a little; monster blows wear it down a lot. At zero you die.</dd></div>
          <div><dt>Vitality</dt><dd>How quickly strength recovers while you rest. Monster hits erode it slowly.</dd></div>
          <div><dt>Agility and Luck</dt><dd>Together they decide whether your blows land. Agility also lets you slip some monster blows. Luck helps you break free of traps and can save your gear from breaking.</dd></div>
          <div><dt>Aura</dt><dd>Magical power. Spell charges come from aura multiplied by the value of your magic items. Superzap, Powersurge, and Healing each burn one aura when cast, and Superzap can fail when aura runs low.</dd></div>
          <div><dt>Experience</dt><dd>Grows in fractions with each blow, kill, and spell. When it passes the next whole number the exit opens. A level cannot be deeper than your experience.</dd></div>
          <div><dt>Intelligence and Morality</dt><dd>Shape which character type you are when the hero is created.</dd></div>
        </dl>
      </article>
      <article class="panel lore-panel">
        <h2>Character Types</h2>
        <p>
          Five types emerge from the attribute scores. The Barbarian is all strength and no magic.
          The Warrior is strong with a little magic. The Wanderer sits in the middle. The Cleric is
          weaker in arms but strong in aura, and the Mage lives almost entirely by spells. The shop
          refuses some items to some types, so buy with your type in mind.
        </p>
        <p>
          Weapons add their value to every blow. Armour divides the damage a monster does. Gear can
          break under a heavy hit, starting with your best weapon, so a spare is not wasted gold.
          A torch gives twenty reveals. Potions and salves stack; everything else you buy once.
        </p>
      </article>
      <article class="panel lore-panel">
        <h2>Monsters and Traps</h2>
        <p>
          Monsters sleep in the dark until light falls on them or you walk into them. Once woken,
          the nearest one chases you square for square and strikes every turn it stands beside you.
          Fleeing rarely helps. Fight, or stand on a safe square where no monster can touch you.
          Stronger monsters hit harder and take longer to kill, but weak ones are more likely to
          break your gear.
        </p>
        <p>
          Traps are sticky. Cross one and it holds your feet until a lucky, well-rested effort pulls
          you free. Keep pressing Move. A potion first helps.
        </p>
      </article>
      <article class="panel lore-panel">
        <h2>Magicks</h2>
        <p>The Necronomicon holds the first three spells; the Scrolls hold the last three.</p>
        <dl class="lore-keys">
          <div><dt>I Superzap</dt><dd>Slays the active monster outright, usually. The lower your aura, the more often it fizzles. Costs one aura.</dd></div>
          <div><dt>II Sanctuary</dt><dd>Turns the empty square you stand on into a safe place.</dd></div>
          <div><dt>III Teleport</dt><dd>Moves you somewhere random. If the destination is a wall or a monster, nothing happens.</dd></div>
          <div><dt>IV Powersurge</dt><dd>Boosts strength and vitality for the fight ahead. Costs one aura.</dd></div>
          <div><dt>V Metamorphosis</dt><dd>Transforms the active monster into a vase, chest, trap, or safe place. One time in five it becomes another monster.</dd></div>
          <div><dt>VI Healing</dt><dd>Restores strength and vitality to their starting values. Costs one aura.</dd></div>
        </dl>
      </article>
      <article class="panel lore-panel">
        <h2>Making Your Own</h2>
        <p>
          The Editor paints a level and can save it to your library in this browser. The Quest
          Builder below it orders saved levels into a series; put the Idol only in the last level.
          The Creator rolls a hero, lets you spend points, and sends you shopping. Any hero can be
          taken into any quest, and quests can be exported as JSON to share.
        </p>
        <p>
          The Archive is for the packed hero and level strings the original cassette programs
          wrote. Paste them in to inspect or convert them.
        </p>
      </article>
    </section>
`;
