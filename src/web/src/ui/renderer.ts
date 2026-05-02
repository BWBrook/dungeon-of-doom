import type { Facing, Snapshot, SnapshotCell } from '../engine/types';
import { CELL_SIZE, GRID_PIXELS, HERO_GLYPHS, TILE_COLORS, TILE_GLYPHS } from './visualCatalog';

export interface RenderEffects {
  changedCells: Array<{ x: number; y: number }>;
  effect: 'idle' | 'bump' | 'damage' | 'pickup' | 'spell' | 'trap' | 'save' | 'win' | 'escape' | 'dead';
}

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
    const availableWidth = this.canvas.parentElement?.clientWidth ?? GRID_PIXELS;
    const displayPixels = Math.max(1, Math.min(GRID_PIXELS, availableWidth));
    const logicalScale = (displayPixels / GRID_PIXELS) * scale;

    this.canvas.width = displayPixels * scale;
    this.canvas.height = displayPixels * scale;
    this.canvas.style.width = `${displayPixels}px`;
    this.canvas.style.height = `${displayPixels}px`;
    this.context.setTransform(logicalScale, 0, 0, logicalScale, 0, 0);
    this.context.imageSmoothingEnabled = false;
  }

  draw(snapshot: Snapshot, effects: RenderEffects = { changedCells: [], effect: 'idle' }) {
    this.context.clearRect(0, 0, GRID_PIXELS, GRID_PIXELS);
    this.context.fillStyle = '#0f120f';
    this.context.fillRect(0, 0, GRID_PIXELS, GRID_PIXELS);

    for (const cell of snapshot.levelView.cells) {
      this.drawCell(cell, effects.changedCells.some((point) => point.x === cell.position.x && point.y === cell.position.y));
    }

    this.drawHero(snapshot.hero.position.x, snapshot.hero.position.y, snapshot.hero.facing, effects.effect);
  }

  private drawCell(cell: SnapshotCell, changed: boolean) {
    const left = cell.position.x * CELL_SIZE;
    const top = cell.position.y * CELL_SIZE;

    this.context.strokeStyle = 'rgba(244, 237, 212, 0.08)';
    this.context.strokeRect(left + 0.5, top + 0.5, CELL_SIZE, CELL_SIZE);

    if (!cell.explored || !cell.tile) {
      this.context.fillStyle = '#090a09';
      this.context.fillRect(left + 1, top + 1, CELL_SIZE - 2, CELL_SIZE - 2);
      return;
    }

    this.context.fillStyle = cell.visible ? TILE_COLORS[cell.tile] : '#171915';
    this.context.fillRect(left + 1, top + 1, CELL_SIZE - 2, CELL_SIZE - 2);
    this.context.font = '18px Menlo, monospace';
    this.context.textAlign = 'center';
    this.context.textBaseline = 'middle';
    this.context.fillStyle = cell.visible ? '#f7efc8' : '#6d6a5d';

    if (cell.monster) {
      this.context.fillStyle = cell.monster.active ? '#ff9277' : '#d96d54';
      this.context.fillText('M', left + CELL_SIZE / 2, top + CELL_SIZE / 2);
      if (cell.monster.active) {
        this.context.strokeStyle = '#ffd176';
        this.context.lineWidth = 2;
        this.context.strokeRect(left + 3, top + 3, CELL_SIZE - 6, CELL_SIZE - 6);
        this.context.lineWidth = 1;
      }
      if (changed) {
        this.drawChangeHighlight(left, top);
      }
      return;
    }

    this.context.fillText(TILE_GLYPHS[cell.tile], left + CELL_SIZE / 2, top + CELL_SIZE / 2);

    if (changed) {
      this.drawChangeHighlight(left, top);
    }
  }

  private drawHero(x: number, y: number, facing: Facing, effect: RenderEffects['effect']) {
    const left = x * CELL_SIZE;
    const top = y * CELL_SIZE;
    const pulse = effectColor(effect);

    if (pulse) {
      this.context.fillStyle = pulse;
      this.context.fillRect(left + 1, top + 1, CELL_SIZE - 2, CELL_SIZE - 2);
    }

    this.context.fillStyle = '#e8d369';
    this.context.fillRect(left + 4, top + 4, CELL_SIZE - 8, CELL_SIZE - 8);
    this.context.fillStyle = '#1a1205';
    this.context.font = '20px Menlo, monospace';
    this.context.textAlign = 'center';
    this.context.textBaseline = 'middle';
    this.context.fillText(HERO_GLYPHS[facing], left + CELL_SIZE / 2, top + CELL_SIZE / 2 + 1);
  }

  private drawChangeHighlight(left: number, top: number) {
    this.context.strokeStyle = 'rgba(255, 209, 118, 0.75)';
    this.context.lineWidth = 2;
    this.context.strokeRect(left + 2, top + 2, CELL_SIZE - 4, CELL_SIZE - 4);
    this.context.lineWidth = 1;
  }
}

function effectColor(effect: RenderEffects['effect']): string | null {
  switch (effect) {
    case 'damage':
    case 'dead':
      return 'rgba(220, 79, 61, 0.55)';
    case 'pickup':
    case 'save':
    case 'win':
      return 'rgba(255, 209, 118, 0.45)';
    case 'spell':
      return 'rgba(112, 194, 255, 0.42)';
    case 'trap':
    case 'bump':
      return 'rgba(181, 83, 66, 0.42)';
    case 'escape':
      return 'rgba(153, 196, 91, 0.42)';
    case 'idle':
      return null;
  }
}
