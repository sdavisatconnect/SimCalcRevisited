import { GraphRenderer } from './GraphRenderer.js';
import { UnifixBlockModel } from './UnifixBlockModel.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * SVG velocity graph that renders unifix cube blocks on a snap-to-grid layout.
 * Replaces the continuous VelocityGraph for the elementary edition of SimCalc.
 *
 * Each integer time column [t, t+1) can hold a stack of colored blocks
 * representing constant integer velocity during that interval.
 * Positive blocks stack upward from y=0; negative blocks stack downward.
 */
export class UnifixVelocityGraph {
  constructor(container, simulation, bus, linkedActors = []) {
    this.sim = simulation;
    this.bus = bus;
    this.linkedActors = linkedActors;

    // Determine y-range: default -5..5, expand if needed
    const yRange = this._computeYRange();

    this.renderer = new GraphRenderer(container, {
      xRange: { min: 0, max: simulation.timeRange.max || 10 },
      yRange,
      xLabel: 'Time (s)',
      yLabel: `Velocity (${simulation.velocityUnitLabel})`,
      yMaxTicks: 10,
      squareUnits: true
    });

    // Force integer tick marks
    this.renderer.xTickStep = 1;
    this.renderer.yTickStep = 1;
    this.renderer.refresh();

    // Ghost preview state (for drag-over feedback)
    this._ghostGroup = null;

    this.redraw();
  }

  setLinkedActors(actors) {
    this.linkedActors = actors;
    this.redraw();
  }

  redraw() {
    this.renderer.clearData();
    const group = this.renderer.dataGroup;

    // Bold zero-line
    this._drawZeroLine(group);

    // Check for empty state
    const hasBlocks = this.linkedActors.some(a => {
      const model = new UnifixBlockModel(a);
      return model.getColumns().size > 0;
    });

    if (this.linkedActors.length > 0 && !hasBlocks) {
      this._drawHint(group, 'Drag blocks here to set velocity');
    }

    for (const actor of this.linkedActors) {
      const isReadOnly = actor.readOnly;
      const model = new UnifixBlockModel(actor);
      const columns = model.getColumns();

      const actorGroup = document.createElementNS(SVG_NS, 'g');
      actorGroup.setAttribute('class', 'actor-data unifix-blocks');
      actorGroup.setAttribute('data-actor-id', actor.id);

      for (const [t, vel] of columns) {
        this._drawColumn(actorGroup, t, vel, actor.color, isReadOnly);
      }

      group.appendChild(actorGroup);
    }

    // Re-expand y-range if blocks exceed current range
    this._autoExpandYRange();
  }

  /**
   * Draw all blocks in a single column.
   */
  _drawColumn(parent, t, vel, color, isReadOnly) {
    const count = Math.abs(vel);
    const sign = vel > 0 ? 1 : -1;

    for (let i = 1; i <= count; i++) {
      const row = i * sign; // v position of this block (1,2,3... or -1,-2,-3...)
      this._drawBlock(parent, t, row, color, isReadOnly);
    }
  }

  /**
   * Draw a single unifix cube block at grid position (col, row).
   * Block spans [col, col+1] x [row-1, row] (positive) or [row, row+1] (negative).
   */
  _drawBlock(parent, col, row, color, isReadOnly) {
    // Determine data-space rectangle
    let yTop, yBottom;
    if (row > 0) {
      yTop = row;
      yBottom = row - 1;
    } else {
      yTop = row + 1;
      yBottom = row;
    }

    const topLeft = this.renderer.toScreen(col, yTop);
    const bottomRight = this.renderer.toScreen(col + 1, yBottom);

    // Leave a 1px gap between blocks
    const gap = 1;
    const x = topLeft.x + gap;
    const y = topLeft.y + gap;
    const w = Math.max(0, bottomRight.x - topLeft.x - gap * 2);
    const h = Math.max(0, bottomRight.y - topLeft.y - gap * 2);

    // Block group
    const blockGroup = document.createElementNS(SVG_NS, 'g');
    blockGroup.setAttribute('class', 'unifix-block');
    blockGroup.setAttribute('data-col', col);
    blockGroup.setAttribute('data-row', row);

    // Main fill rectangle
    const rect = this.renderer.makeRect(x, y, w, h, 'unifix-block-fill');
    rect.setAttribute('fill', color);
    rect.setAttribute('data-col', col);
    rect.setAttribute('data-row', row);

    if (isReadOnly) {
      rect.setAttribute('opacity', '0.35');
      blockGroup.appendChild(rect);
      parent.appendChild(blockGroup);
      return;
    }

    blockGroup.appendChild(rect);

    // 3D bevel edges
    const lighter30 = this._blendColor(color, '#ffffff', 0.3);
    const lighter20 = this._blendColor(color, '#ffffff', 0.2);
    const darker30 = this._blendColor(color, '#000000', 0.3);
    const darker20 = this._blendColor(color, '#000000', 0.2);

    const bevelWidth = 2;

    // Top edge (lighter 30%)
    const topEdge = this.renderer.makeLine(x, y, x + w, y, 'unifix-bevel');
    topEdge.setAttribute('stroke', lighter30);
    topEdge.setAttribute('stroke-width', bevelWidth);
    blockGroup.appendChild(topEdge);

    // Left edge (lighter 20%)
    const leftEdge = this.renderer.makeLine(x, y, x, y + h, 'unifix-bevel');
    leftEdge.setAttribute('stroke', lighter20);
    leftEdge.setAttribute('stroke-width', bevelWidth);
    blockGroup.appendChild(leftEdge);

    // Bottom edge (darker 30%)
    const bottomEdge = this.renderer.makeLine(x, y + h, x + w, y + h, 'unifix-bevel');
    bottomEdge.setAttribute('stroke', darker30);
    bottomEdge.setAttribute('stroke-width', bevelWidth);
    blockGroup.appendChild(bottomEdge);

    // Right edge (darker 20%)
    const rightEdge = this.renderer.makeLine(x + w, y, x + w, y + h, 'unifix-bevel');
    rightEdge.setAttribute('stroke', darker20);
    rightEdge.setAttribute('stroke-width', bevelWidth);
    blockGroup.appendChild(rightEdge);

    parent.appendChild(blockGroup);
  }

  /**
   * Draw a bold horizontal line at y=0 to clearly show the positive/negative boundary.
   */
  _drawZeroLine(group) {
    const left = this.renderer.toScreen(this.renderer.xRange.min, 0);
    const right = this.renderer.toScreen(this.renderer.xRange.max, 0);
    const line = this.renderer.makeLine(left.x, left.y, right.x, right.y, 'unifix-zero-line');
    line.setAttribute('stroke', '#333');
    line.setAttribute('stroke-width', '2');
    group.appendChild(line);
  }

  /**
   * Draw a hint message in the center of the graph.
   */
  _drawHint(group, message) {
    const cx = this.renderer.plotArea.x + this.renderer.plotArea.w / 2;
    const cy = this.renderer.plotArea.y + this.renderer.plotArea.h / 2;
    const hint = document.createElementNS(SVG_NS, 'text');
    hint.setAttribute('x', cx);
    hint.setAttribute('y', cy);
    hint.setAttribute('class', 'empty-graph-hint');
    hint.textContent = message;
    group.appendChild(hint);
  }

  // ---- Ghost preview for drag-over feedback ----

  /**
   * Show a single semi-transparent ghost block at the target grid position.
   */
  showGhost(col, targetRow, color) {
    this.clearGhost();
    if (targetRow === 0) return;

    this._ghostGroup = document.createElementNS(SVG_NS, 'g');
    this._ghostGroup.setAttribute('class', 'unifix-ghost');
    this._ghostGroup.setAttribute('opacity', '0.4');

    let yTop, yBottom;
    if (targetRow > 0) {
      yTop = targetRow;
      yBottom = targetRow - 1;
    } else {
      yTop = targetRow + 1;
      yBottom = targetRow;
    }

    const topLeft = this.renderer.toScreen(col, yTop);
    const bottomRight = this.renderer.toScreen(col + 1, yBottom);

    const gap = 1;
    const rect = this.renderer.makeRect(
      topLeft.x + gap,
      topLeft.y + gap,
      Math.max(0, bottomRight.x - topLeft.x - gap * 2),
      Math.max(0, bottomRight.y - topLeft.y - gap * 2),
      'unifix-ghost-block'
    );
    rect.setAttribute('fill', color);
    rect.setAttribute('stroke', color);
    rect.setAttribute('stroke-width', '1');
    rect.setAttribute('stroke-dasharray', '3 2');
    this._ghostGroup.appendChild(rect);

    this.renderer.dataGroup.appendChild(this._ghostGroup);
  }

  /**
   * Remove the ghost preview.
   */
  clearGhost() {
    if (this._ghostGroup && this._ghostGroup.parentNode) {
      this._ghostGroup.parentNode.removeChild(this._ghostGroup);
    }
    this._ghostGroup = null;
  }

  // ---- Time cursor ----

  drawTimeCursor(t) {
    this.renderer.drawTimeCursor(t);
  }

  // ---- Lifecycle ----

  refresh() {
    // Ensure x-axis stays fixed at 0-10 seconds
    this.renderer.xRange = { min: 0, max: this.sim.timeRange.max || 10 };
    this._autoExpandYRange();
    this.renderer.xTickStep = 1;
    this.renderer.yTickStep = 1;
    this.renderer.refresh();
    this.redraw();
  }

  get svg() {
    return this.renderer.svg;
  }

  get graphRenderer() {
    return this.renderer;
  }

  destroy() {
    this.clearGhost();
    if (this.renderer._resizeObserver) {
      this.renderer._resizeObserver.disconnect();
    }
  }

  // ---- Internal helpers ----

  /**
   * Compute a y-range that accommodates all current block heights.
   * Default is -5..5; expands symmetrically if any column exceeds that.
   */
  _computeYRange() {
    let maxAbs = 5;
    for (const actor of this.linkedActors) {
      const model = new UnifixBlockModel(actor);
      const cols = model.getColumns();
      for (const vel of cols.values()) {
        maxAbs = Math.max(maxAbs, Math.abs(vel) + 1);
      }
    }
    return { min: -maxAbs, max: maxAbs };
  }

  /**
   * If blocks exceed the current y-range, expand and refresh.
   */
  _autoExpandYRange() {
    const needed = this._computeYRange();
    const current = this.renderer.yRange;
    if (needed.min < current.min || needed.max > current.max) {
      this.renderer.setRanges(null, needed, { yTickStep: 1, xTickStep: 1 });
    }
  }

  /**
   * Blend two hex colors by a ratio (0 = all baseColor, 1 = all blendColor).
   */
  _blendColor(baseColor, blendColor, ratio) {
    const base = this._parseHex(baseColor);
    const blend = this._parseHex(blendColor);
    if (!base || !blend) return baseColor;

    const r = Math.round(base.r + (blend.r - base.r) * ratio);
    const g = Math.round(base.g + (blend.g - base.g) * ratio);
    const b = Math.round(base.b + (blend.b - base.b) * ratio);
    return `rgb(${r},${g},${b})`;
  }

  /**
   * Parse a hex color string (#rgb or #rrggbb) to {r, g, b}.
   * Also handles named CSS colors by returning null (falls back gracefully).
   */
  _parseHex(hex) {
    if (!hex || hex.charAt(0) !== '#') return null;
    hex = hex.slice(1);
    if (hex.length === 3) {
      hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    if (hex.length !== 6) return null;
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16)
    };
  }
}
