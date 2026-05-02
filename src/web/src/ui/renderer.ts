import type { BaseTileKind, Facing, Snapshot, SnapshotCell } from '../engine/types';

const CELL_SIZE = 32;
const GRID_PIXELS = CELL_SIZE * 15;

const TILE_COLORS: Record<BaseTileKind, string> = {
  floor: '#1c221b',
  wall: '#65543d',
  vase: '#375e77',
  chest: '#7a4d1d',
  idol: '#ae8e2a',
  entrance: '#24533a',
  exit: '#58662f',
  trap: '#6b2331',
  safe: '#224e6a'
};

const TILE_GLYPHS: Record<BaseTileKind, string> = {
  floor: '.',
  wall: '#',
  vase: 'V',
  chest: '$',
  idol: '*',
  entrance: 'E',
  exit: 'X',
  trap: '!',
  safe: '+'
};

const HERO_GLYPHS: Record<Facing, string> = {
  N: '^',
  E: '>',
  S: 'v',
  W: '<'
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

  draw(snapshot: Snapshot) {
    this.context.clearRect(0, 0, GRID_PIXELS, GRID_PIXELS);
    this.context.fillStyle = '#0f120f';
    this.context.fillRect(0, 0, GRID_PIXELS, GRID_PIXELS);

    for (const cell of snapshot.levelView.cells) {
      this.drawCell(cell);
    }

    this.drawHero(snapshot.hero.position.x, snapshot.hero.position.y, snapshot.hero.facing);
  }

  private drawCell(cell: SnapshotCell) {
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
      return;
    }

    this.context.fillText(TILE_GLYPHS[cell.tile], left + CELL_SIZE / 2, top + CELL_SIZE / 2);
  }

  private drawHero(x: number, y: number, facing: Facing) {
    const left = x * CELL_SIZE;
    const top = y * CELL_SIZE;

    this.context.fillStyle = '#e8d369';
    this.context.fillRect(left + 4, top + 4, CELL_SIZE - 8, CELL_SIZE - 8);
    this.context.fillStyle = '#1a1205';
    this.context.font = '20px Menlo, monospace';
    this.context.textAlign = 'center';
    this.context.textBaseline = 'middle';
    this.context.fillText(HERO_GLYPHS[facing], left + CELL_SIZE / 2, top + CELL_SIZE / 2 + 1);
  }
}
