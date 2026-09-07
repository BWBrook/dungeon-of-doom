export const APP_TEMPLATE = String.raw`
    <main class="shell">
      <header class="masthead">
        <div class="hero-copy">
          <p class="eyebrow">Lamp-lit terminal edition</p>
          <h1>Dungeon of Doom</h1>
        </div>
        <div class="top-chrome">
          <nav class="mode-switch" aria-label="Application mode">
            <button data-role="mode-play-button" type="button">Play</button>
            <button data-role="mode-editor-button" type="button">Editor</button>
            <button data-role="mode-creator-button" type="button">Creator</button>
            <button data-role="mode-archive-button" type="button">Archive</button>
          </nav>
          <div class="sensory-controls" aria-label="Sensory controls">
            <button data-role="sound-toggle" type="button" aria-pressed="true">Sound On</button>
            <button data-role="motion-toggle" type="button" aria-pressed="true">Motion On</button>
          </div>
        </div>
      </header>
      <section data-role="play-mode">
        <section class="toolbar">
          <label>
            Journey
            <select data-role="play-kind-select">
              <option value="adventure">Adventure</option>
              <option value="single">Single Dungeon</option>
            </select>
          </label>
          <label>
            Hero
            <select data-role="hero-select"></select>
          </label>
          <label data-role="adventure-field">
            Adventure
            <select data-role="adventure-select"></select>
          </label>
          <label data-role="level-field" hidden>
            Level
            <select data-role="level-select"></select>
          </label>
          <label>
            Seed
            <input data-role="seed-input" type="number" min="1" step="1" value="1984" />
          </label>
          <button data-role="start-button" type="button">Begin Adventure</button>
          <button data-role="save-button" type="button">Save Run</button>
          <button data-role="resume-button" type="button">Resume Saved</button>
        </section>
        <section class="panel adventure-progress" data-role="adventure-progress" hidden>
          <div class="adventure-progress-copy">
            <p class="run-kicker">Quest Progress</p>
            <h2 data-role="adventure-progress-title">The Lost Idol</h2>
            <p data-role="adventure-progress-detail"></p>
          </div>
          <div class="adventure-stage-readout">
            <strong data-role="adventure-progress-stage">Level 1 of 3</strong>
            <div class="adventure-markers" data-role="adventure-progress-markers" aria-label="Adventure stages"></div>
          </div>
        </section>
        <section class="playframe">
          <div class="canvas-frame">
            <canvas data-role="canvas" aria-label="Dungeon grid"></canvas>
          </div>
          <aside class="sidebar">
            <section class="panel outcome-panel" data-role="outcome-panel" hidden>
              <div>
                <p class="run-kicker" data-role="outcome-subline">Run complete</p>
                <h2 data-role="outcome-title">Outcome</h2>
                <p data-role="outcome-body"></p>
              </div>
              <div class="outcome-actions">
                <button data-role="outcome-continue-button" type="button" hidden>Descend</button>
                <button data-role="outcome-start-button" type="button">Start Run</button>
                <button data-role="outcome-export-hero-button" type="button">Export Hero</button>
                <button data-role="outcome-export-level-button" type="button">Export Level</button>
              </div>
            </section>
            <section class="panel run-brief">
              <p class="run-kicker" data-role="run-subline">Select a hero and level.</p>
              <h2 data-role="run-headline">Choose thy quest</h2>
              <p class="latest-event" data-role="latest-event" aria-live="polite">The dungeon awaits.</p>
            </section>
            <section class="panel">
              <h2>Status</h2>
              <dl class="hud" data-role="hud"></dl>
            </section>
            <section class="panel command-panel">
              <h2>Commands</h2>
              <div class="command-grid" data-role="command-grid"></div>
              <div class="spell-chooser" data-role="spell-chooser" hidden>
                <p>Choose a spell from thy lore.</p>
                <div data-role="spell-buttons"></div>
              </div>
              <p class="save-status" data-role="save-status" aria-live="polite">No run saved this session.</p>
            </section>
            <section class="panel">
              <h2>Controls</h2>
              <p>B/N turn, M move, A attack, G get, P restore, R reveal, C conjure, 1-6 quick-cast, . wait, S save.</p>
            </section>
            <section class="panel">
              <h2>Messages</h2>
              <ol class="messages" data-role="messages" aria-live="polite"></ol>
            </section>
          </aside>
        </section>
        <section class="panel legacy-panel" aria-labelledby="legacy-heading">
          <div class="legacy-header">
            <h2 id="legacy-heading">Legacy Interop</h2>
            <p class="legacy-status" data-role="legacy-status" data-state="idle" aria-live="polite">
              Paste packed HERO or LEVEL text to import archival data.
            </p>
          </div>
          <div class="legacy-grid">
            <label class="payload-field">
              Hero Payload
              <textarea data-role="hero-payload" spellcheck="false" rows="5"></textarea>
            </label>
            <label class="payload-field">
              Level Payload
              <textarea data-role="level-payload" spellcheck="false" rows="5"></textarea>
            </label>
          </div>
          <div class="legacy-actions">
            <button data-role="import-hero-button" type="button">Import Hero</button>
            <button data-role="import-level-button" type="button">Import Level</button>
            <button data-role="export-hero-button" type="button">Export Hero</button>
            <button data-role="export-level-button" type="button">Export Level</button>
            <button data-role="clear-legacy-button" type="button">Clear Legacy</button>
          </div>
        </section>
      </section>
      <section data-role="editor-mode" hidden>
        <section class="editor-workbench">
          <div class="canvas-frame editor-canvas-frame">
            <canvas data-role="editor-canvas" aria-label="Dungeon editor grid"></canvas>
          </div>
          <aside class="sidebar editor-sidebar">
            <section class="panel">
              <h2>Editor Tools</h2>
              <div class="tool-palette" data-role="editor-tool-palette"></div>
            </section>
            <section class="panel">
              <h2>Editor Controls</h2>
              <div class="editor-actions">
                <button data-role="editor-new-button" type="button">New Level</button>
                <button data-role="editor-edit-selected-button" type="button">Edit Selected Level</button>
                <button data-role="editor-validate-button" type="button">Validate</button>
                <button data-role="editor-play-button" type="button">Play Authored Level</button>
                <button data-role="editor-export-json-button" type="button">Export JSON</button>
                <button data-role="editor-export-legacy-button" type="button">Export Legacy Level</button>
                <button data-role="editor-clear-output-button" type="button">Clear Editor Output</button>
              </div>
            </section>
            <section class="panel">
              <h2>Editor Status</h2>
              <p class="editor-status" data-role="editor-status" data-state="idle" aria-live="polite">
                Paint a level, then validate or launch it.
              </p>
              <ul class="editor-messages" data-role="editor-messages"></ul>
            </section>
          </aside>
        </section>
        <section class="panel editor-output-panel" aria-labelledby="editor-output-heading">
          <h2 id="editor-output-heading">Editor Output</h2>
          <textarea data-role="editor-output" spellcheck="false" rows="7"></textarea>
        </section>
      </section>
      <section data-role="creator-mode" hidden>
        <section class="creator-workbench">
          <section class="panel creator-panel">
            <h2>Roll Hero</h2>
            <div class="creator-form">
              <label>
                Creator Seed
                <input data-role="creator-seed-input" type="number" min="1" step="1" value="1984" />
              </label>
              <label>
                Hero Name
                <input data-role="creator-name-input" maxlength="10" value="Hero" />
              </label>
              <button data-role="creator-roll-button" type="button">Roll Hero</button>
            </div>
            <dl class="creator-summary" data-role="creator-summary"></dl>
            <div class="stat-editor" data-role="creator-stats"></div>
          </section>
          <section class="panel creator-shop-panel">
            <h2>Shop</h2>
            <div class="store-pages" data-role="creator-store-pages"></div>
            <label class="creator-offer">
              Bargain Offer
              <input data-role="creator-bargain-offer" type="number" min="0" step="1" value="0" />
            </label>
            <div class="store-items" data-role="creator-store-items"></div>
          </section>
          <aside class="sidebar creator-sidebar">
            <section class="panel">
              <h2>Creator Controls</h2>
              <div class="creator-actions">
                <button data-role="creator-validate-button" type="button">Validate</button>
                <button data-role="creator-play-button" type="button">Play Created Hero</button>
                <button data-role="creator-export-json-button" type="button">Export JSON</button>
                <button data-role="creator-export-legacy-button" type="button">Export Legacy Hero</button>
                <button data-role="creator-clear-output-button" type="button">Clear Creator Output</button>
              </div>
            </section>
            <section class="panel">
              <h2>Creator Status</h2>
              <p class="creator-status" data-role="creator-status" data-state="idle" aria-live="polite">
                Roll a hero, spend points, buy gear, then launch.
              </p>
              <ul class="creator-messages" data-role="creator-messages"></ul>
            </section>
          </aside>
        </section>
        <section class="panel creator-output-panel" aria-labelledby="creator-output-heading">
          <h2 id="creator-output-heading">Creator Output</h2>
          <textarea data-role="creator-output" spellcheck="false" rows="7"></textarea>
        </section>
      </section>
      <section data-role="archive-mode" hidden>
        <section class="archive-workbench">
          <section class="panel archive-panel">
            <h2>Archive Inspector</h2>
            <p>
              Inspect packed HERO and LEVEL strings, round-trip them through the modern codecs,
              or convert an archival mid-game pair into a modern run.
            </p>
            <label class="archive-example-picker">
              Example Payload
              <select data-role="archive-example-select"></select>
            </label>
            <div class="archive-actions">
              <button data-role="archive-load-example-button" type="button">Load Example</button>
              <button data-role="archive-inspect-hero-button" type="button">Inspect Hero</button>
              <button data-role="archive-inspect-level-button" type="button">Inspect Level</button>
              <button data-role="archive-roundtrip-hero-button" type="button">Round-Trip Hero</button>
              <button data-role="archive-roundtrip-level-button" type="button">Round-Trip Level</button>
              <button data-role="archive-inspect-snapshot-button" type="button">Inspect Snapshot Pair</button>
              <button data-role="archive-convert-snapshot-button" type="button">Convert Snapshot To Run</button>
              <button data-role="archive-clear-button" type="button">Clear Archive</button>
            </div>
          </section>
          <section class="panel archive-status-panel">
            <h2>Archive Status</h2>
            <p class="archive-status" data-role="archive-status" data-state="idle" aria-live="polite">
              Load or paste archival payloads to inspect them.
            </p>
            <ul class="archive-messages" data-role="archive-messages"></ul>
          </section>
        </section>
        <section class="panel archive-payload-panel" aria-labelledby="archive-payload-heading">
          <h2 id="archive-payload-heading">Archive Payloads</h2>
          <div class="legacy-grid">
            <label class="payload-field">
              Hero Payload
              <textarea data-role="archive-hero-payload" spellcheck="false" rows="7"></textarea>
            </label>
            <label class="payload-field">
              Level Payload
              <textarea data-role="archive-level-payload" spellcheck="false" rows="7"></textarea>
            </label>
          </div>
        </section>
        <section class="panel archive-output-panel" aria-labelledby="archive-output-heading">
          <h2 id="archive-output-heading">Archive Report / Round-Trip Output</h2>
          <textarea data-role="archive-output" spellcheck="false" rows="10"></textarea>
        </section>
      </section>
    </main>
`;
