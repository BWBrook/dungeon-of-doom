import { LEGACY_CODES } from '../engine/catalog';
import type { Facing, Snapshot, SnapshotCell } from '../engine/types';
import {
  CELL_SIZE,
  GRID_PIXELS,
  HERO_GLYPHS,
  LAMP_TERMINAL_THEME,
  MONSTER_VISUALS,
  TILE_VISUALS
} from './visualCatalog';
import type { VisualEffectKind } from './visualCatalog';
import { visualEffectState } from './visualEffects';

export interface RenderEffects {
  changedCells: Array<{ x: number; y: number }>;
  effect: VisualEffectKind;
  elapsedMs: number;
  motionEnabled: boolean;
}

const MAX_DISPLAY_PIXELS = GRID_PIXELS * 1.5;

const DEFAULT_RENDER_EFFECTS: RenderEffects = {
  changedCells: [],
  effect: 'idle',
  elapsedMs: 0,
  motionEnabled: true
};

export class DungeonRenderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D;

  constructor(canvas: HTMLCanvasElement) {
    const context = canvas.getContext('2d');

    if (!context) {
      throw new Error('Canvas 2D context not available.');
    }

    this.canvas = canvas;
    this.context = context;
    this.resize();
  }

  resize() {
    const scale = window.devicePixelRatio || 1;
    const displayPixels = Math.max(1, Math.min(MAX_DISPLAY_PIXELS, this.availableWidth()));
    const logicalScale = (displayPixels / GRID_PIXELS) * scale;

    this.canvas.width = displayPixels * scale;
    this.canvas.height = displayPixels * scale;
    this.canvas.style.width = `${displayPixels}px`;
    this.canvas.style.height = `${displayPixels}px`;
    this.context.setTransform(logicalScale, 0, 0, logicalScale, 0, 0);
    this.context.imageSmoothingEnabled = false;
  }

  private availableWidth(): number {
    const parent = this.canvas.parentElement;

    if (!parent) {
      return GRID_PIXELS;
    }

    const style = getComputedStyle(parent);

    return parent.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
  }

  draw(snapshot: Snapshot, effects: RenderEffects = DEFAULT_RENDER_EFFECTS) {
    const effectState = visualEffectState(effects.effect, effects.elapsedMs, effects.motionEnabled);

    this.context.clearRect(0, 0, GRID_PIXELS, GRID_PIXELS);
    this.drawBackground(snapshot.hero.position.x, snapshot.hero.position.y);

    for (const cell of snapshot.levelView.cells) {
      this.drawCell(
        cell,
        effects.changedCells.some((point) => point.x === cell.position.x && point.y === cell.position.y),
        effectState.intensity
      );
    }

    this.drawHeroHalo(snapshot.hero.position.x, snapshot.hero.position.y, effectState.intensity);
    this.drawHero(snapshot.hero.position.x, snapshot.hero.position.y, snapshot.hero.facing, effectState);
    this.drawScanlines();
    this.drawVignette();
  }

  private drawBackground(heroX: number, heroY: number) {
    this.context.fillStyle = LAMP_TERMINAL_THEME.canvasBack;
    this.context.fillRect(0, 0, GRID_PIXELS, GRID_PIXELS);

    const gradient = this.context.createRadialGradient(
      (heroX + 0.5) * CELL_SIZE,
      (heroY + 0.5) * CELL_SIZE,
      CELL_SIZE,
      (heroX + 0.5) * CELL_SIZE,
      (heroY + 0.5) * CELL_SIZE,
      CELL_SIZE * 6
    );

    gradient.addColorStop(0, 'rgba(215, 173, 85, 0.16)');
    gradient.addColorStop(0.46, 'rgba(90, 58, 28, 0.08)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    this.context.fillStyle = gradient;
    this.context.fillRect(0, 0, GRID_PIXELS, GRID_PIXELS);
  }

  private drawCell(cell: SnapshotCell, changed: boolean, effectIntensity: number) {
    const left = cell.position.x * CELL_SIZE;
    const top = cell.position.y * CELL_SIZE;

    this.context.strokeStyle = LAMP_TERMINAL_THEME.grid;
    this.context.strokeRect(left + 0.5, top + 0.5, CELL_SIZE, CELL_SIZE);

    if (!cell.explored || !cell.tile) {
      this.context.fillStyle = LAMP_TERMINAL_THEME.fog;
      this.context.fillRect(left + 1, top + 1, CELL_SIZE - 2, CELL_SIZE - 2);
      this.drawTileTexture(left, top, cell.position.x, cell.position.y, 0.08);
      return;
    }

    const visual = TILE_VISUALS[cell.tile];

    this.context.fillStyle = cell.visible ? visual.lit : visual.dim;
    this.context.fillRect(left + 1, top + 1, CELL_SIZE - 2, CELL_SIZE - 2);
    this.drawTileTexture(left, top, cell.position.x, cell.position.y, cell.visible ? 0.2 : 0.1);
    this.context.font = '18px Menlo, Monaco, Consolas, monospace';
    this.context.textAlign = 'center';
    this.context.textBaseline = 'middle';
    this.context.fillStyle = cell.visible ? visual.ink : LAMP_TERMINAL_THEME.glyphDim;

    if (cell.monster) {
      this.drawMonster(left, top, cell.monster, cell.visible);
      if (cell.monster.active) {
        this.drawActiveMonsterOutline(left, top, effectIntensity);
      }
      if (changed) {
        this.drawChangeHighlight(left, top, effectIntensity);
      }
      return;
    }

    this.context.fillText(visual.glyph, left + CELL_SIZE / 2, top + CELL_SIZE / 2);

    if (changed) {
      this.drawChangeHighlight(left, top, effectIntensity);
    }
  }

  private drawMonster(left: number, top: number, monster: NonNullable<SnapshotCell['monster']>, visible: boolean) {
    const monsterVisual =
      monster.legacyTileCode >= LEGACY_CODES.warden
        ? MONSTER_VISUALS.warden
        : monster.active
          ? MONSTER_VISUALS.active
          : monster.hp >= 14
            ? MONSTER_VISUALS.elder
            : MONSTER_VISUALS.dormant;

    this.context.fillStyle = visible ? monsterVisual.fill : '#4a2a23';
    this.context.fillRect(left + 6, top + 6, CELL_SIZE - 12, CELL_SIZE - 12);
    this.context.fillStyle = visible ? monsterVisual.ink : LAMP_TERMINAL_THEME.glyphDim;
    this.context.fillText(monsterVisual.glyph, left + CELL_SIZE / 2, top + CELL_SIZE / 2 + 1);
  }

  private drawActiveMonsterOutline(left: number, top: number, effectIntensity: number) {
    this.context.strokeStyle = MONSTER_VISUALS.active.outline;
    this.context.lineWidth = 2 + effectIntensity;
    this.context.strokeRect(left + 3, top + 3, CELL_SIZE - 6, CELL_SIZE - 6);
    this.context.strokeStyle = 'rgba(255, 239, 159, 0.55)';
    this.context.lineWidth = 1;
    this.context.strokeRect(left + 7, top + 7, CELL_SIZE - 14, CELL_SIZE - 14);
  }

  private drawHeroHalo(x: number, y: number, effectIntensity: number) {
    const centerX = (x + 0.5) * CELL_SIZE;
    const centerY = (y + 0.5) * CELL_SIZE;
    const radius = CELL_SIZE * (1.45 + effectIntensity * 0.35);
    const gradient = this.context.createRadialGradient(centerX, centerY, 4, centerX, centerY, radius);

    gradient.addColorStop(0, 'rgba(255, 218, 124, 0.22)');
    gradient.addColorStop(0.46, 'rgba(215, 128, 54, 0.1)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    this.context.fillStyle = gradient;
    this.context.fillRect(centerX - radius, centerY - radius, radius * 2, radius * 2);
  }

  private drawHero(x: number, y: number, facing: Facing, effect: { color: string | null; intensity: number }) {
    const left = x * CELL_SIZE;
    const top = y * CELL_SIZE;

    if (effect.color && effect.intensity > 0) {
      this.context.save();
      this.context.globalAlpha = effect.intensity;
      this.context.fillStyle = effect.color;
      this.context.fillRect(left + 1, top + 1, CELL_SIZE - 2, CELL_SIZE - 2);
      this.context.restore();
    }

    this.context.fillStyle = '#e8c665';
    this.context.fillRect(left + 5, top + 5, CELL_SIZE - 10, CELL_SIZE - 10);
    this.context.strokeStyle = 'rgba(255, 239, 190, 0.72)';
    this.context.lineWidth = 1.5;
    this.context.strokeRect(left + 4.5, top + 4.5, CELL_SIZE - 9, CELL_SIZE - 9);
    this.context.lineWidth = 1;
    this.context.fillStyle = '#1a1205';
    this.context.font = '20px Menlo, Monaco, Consolas, monospace';
    this.context.textAlign = 'center';
    this.context.textBaseline = 'middle';
    this.context.fillText(HERO_GLYPHS[facing], left + CELL_SIZE / 2, top + CELL_SIZE / 2 + 1);
  }

  private drawTileTexture(left: number, top: number, x: number, y: number, alpha: number) {
    const offset = ((x * 17 + y * 31 + x * y * 7) % 9) + 4;

    this.context.save();
    this.context.globalAlpha = alpha;
    this.context.strokeStyle = '#f4d58e';
    this.context.beginPath();
    this.context.moveTo(left + offset, top + 4);
    this.context.lineTo(left + Math.min(CELL_SIZE - 4, offset + 8), top + 4);
    this.context.moveTo(left + 5, top + CELL_SIZE - offset);
    this.context.lineTo(left + 12, top + CELL_SIZE - offset);
    this.context.stroke();
    this.context.restore();
  }

  private drawChangeHighlight(left: number, top: number, effectIntensity: number) {
    this.context.strokeStyle = `rgba(255, 211, 93, ${0.45 + effectIntensity * 0.45})`;
    this.context.lineWidth = 2;
    this.context.strokeRect(left + 2, top + 2, CELL_SIZE - 4, CELL_SIZE - 4);
    this.context.lineWidth = 1;
  }

  private drawScanlines() {
    this.context.save();
    this.context.globalAlpha = 0.08;
    this.context.fillStyle = '#ffd88a';

    for (let y = 1; y < GRID_PIXELS; y += 4) {
      this.context.fillRect(0, y, GRID_PIXELS, 1);
    }

    this.context.restore();
  }

  private drawVignette() {
    const radius = GRID_PIXELS * 0.72;
    const gradient = this.context.createRadialGradient(
      GRID_PIXELS / 2,
      GRID_PIXELS / 2,
      GRID_PIXELS * 0.15,
      GRID_PIXELS / 2,
      GRID_PIXELS / 2,
      radius
    );

    gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
    gradient.addColorStop(0.72, 'rgba(0, 0, 0, 0.12)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0.55)');
    this.context.fillStyle = gradient;
    this.context.fillRect(0, 0, GRID_PIXELS, GRID_PIXELS);
  }
}
