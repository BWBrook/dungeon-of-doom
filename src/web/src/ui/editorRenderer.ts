import { GRID_SIZE } from '../engine/catalog';
import type { EditorDraft } from '../editor/model';
import type { BaseTileKind } from '../engine/types';
import { CELL_SIZE, GRID_PIXELS, LAMP_TERMINAL_THEME, MONSTER_VISUALS, TILE_VISUALS } from './visualCatalog';

export class EditorRenderer {
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

  draw(draft: EditorDraft) {
    this.context.clearRect(0, 0, GRID_PIXELS, GRID_PIXELS);
    this.context.fillStyle = LAMP_TERMINAL_THEME.canvasBack;
    this.context.fillRect(0, 0, GRID_PIXELS, GRID_PIXELS);

    for (let index = 0; index < draft.cells.length; index += 1) {
      const cell = draft.cells[index];

      if (!cell) {
        continue;
      }

      const x = index % draft.width;
      const y = Math.floor(index / draft.width);

      this.drawCell(x, y, cell.kind, cell.monsterLegacyCode);
    }

    this.drawStart(draft.startPosition.x, draft.startPosition.y);
  }

  pointFromPointer(event: PointerEvent) {
    const rect = this.canvas.getBoundingClientRect();
    const x = Math.floor(((event.clientX - rect.left) / rect.width) * GRID_SIZE);
    const y = Math.floor(((event.clientY - rect.top) / rect.height) * GRID_SIZE);

    if (x < 0 || y < 0 || x >= GRID_SIZE || y >= GRID_SIZE) {
      return null;
    }

    return { x, y };
  }

  private drawCell(x: number, y: number, kind: BaseTileKind, monsterLegacyCode: number | null) {
    const left = x * CELL_SIZE;
    const top = y * CELL_SIZE;
    const visual = TILE_VISUALS[kind];

    this.context.fillStyle = visual.lit;
    this.context.fillRect(left + 1, top + 1, CELL_SIZE - 2, CELL_SIZE - 2);
    this.drawTileTexture(left, top, x, y);
    this.context.strokeStyle = LAMP_TERMINAL_THEME.gridStrong;
    this.context.strokeRect(left + 0.5, top + 0.5, CELL_SIZE, CELL_SIZE);
    this.context.font = '18px Menlo, Monaco, Consolas, monospace';
    this.context.textAlign = 'center';
    this.context.textBaseline = 'middle';

    if (monsterLegacyCode !== null) {
      const monsterVisual = monsterLegacyCode > 112 ? MONSTER_VISUALS.elder : MONSTER_VISUALS.dormant;

      this.context.fillStyle = monsterVisual.fill;
      this.context.fillRect(left + 6, top + 6, CELL_SIZE - 12, CELL_SIZE - 12);
      this.context.fillStyle = monsterVisual.ink;
      this.context.fillText(monsterVisual.glyph.toUpperCase(), left + CELL_SIZE / 2, top + CELL_SIZE / 2 + 1);
      return;
    }

    this.context.fillStyle = visual.ink;
    this.context.fillText(visual.glyph, left + CELL_SIZE / 2, top + CELL_SIZE / 2);
  }

  private drawTileTexture(left: number, top: number, x: number, y: number) {
    const offset = ((x * 17 + y * 31 + x * y * 7) % 9) + 4;

    this.context.save();
    this.context.globalAlpha = 0.18;
    this.context.strokeStyle = '#f4d58e';
    this.context.beginPath();
    this.context.moveTo(left + offset, top + 4);
    this.context.lineTo(left + Math.min(CELL_SIZE - 4, offset + 8), top + 4);
    this.context.moveTo(left + 5, top + CELL_SIZE - offset);
    this.context.lineTo(left + 12, top + CELL_SIZE - offset);
    this.context.stroke();
    this.context.restore();
  }

  private drawStart(x: number, y: number) {
    const left = x * CELL_SIZE;
    const top = y * CELL_SIZE;

    this.context.strokeStyle = LAMP_TERMINAL_THEME.brass;
    this.context.lineWidth = 3;
    this.context.strokeRect(left + 5, top + 5, CELL_SIZE - 10, CELL_SIZE - 10);
    this.context.lineWidth = 1;
    this.context.fillStyle = LAMP_TERMINAL_THEME.brass;
    this.context.font = '18px Menlo, Monaco, Consolas, monospace';
    this.context.textAlign = 'center';
    this.context.textBaseline = 'middle';
    this.context.fillText('@', left + CELL_SIZE / 2, top + CELL_SIZE / 2 + 1);
  }
}
