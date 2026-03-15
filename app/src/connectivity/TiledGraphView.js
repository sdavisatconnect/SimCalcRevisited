import { GraphRenderer } from '../graph/GraphRenderer.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Auto-sized grid of mini-graphs, one per student, all fitting in the visible space.
 * No scrolling — grid auto-calculates rows × cols to fill the container.
 */
export class TiledGraphView {
  constructor(container, simulation, students, graphType) {
    this.container = container;
    this.sim = simulation;
    this.students = students;
    this.graphType = graphType; // 'position' or 'velocity'
    this.visibleIds = new Set(students.map(s => s.id));

    this.el = document.createElement('div');
    this.el.className = 'tiled-graph-container';
    container.appendChild(this.el);

    this._resizeObserver = new ResizeObserver(() => this.render());
    this._resizeObserver.observe(container);

    this.render();
  }

  setVisibleStudents(visibleIds) {
    this.visibleIds = new Set(visibleIds);
    this._updateVisibility();
  }

  render() {
    this.el.innerHTML = '';
    const n = this.students.length;
    if (n === 0) return;

    const rect = this.container.getBoundingClientRect();
    const W = rect.width;
    const H = rect.height;
    if (W === 0 || H === 0) return;

    // Calculate optimal grid dimensions
    const { cols, rows } = this._calculateGrid(n, W, H);
    const tileW = Math.floor(W / cols);
    const tileH = Math.floor(H / rows);

    this.el.style.display = 'grid';
    this.el.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    this.el.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
    this.el.style.width = '100%';
    this.el.style.height = '100%';
    this.el.style.gap = '2px';

    this.tiles = [];

    for (const student of this.students) {
      const tile = document.createElement('div');
      tile.className = 'tiled-graph-tile';
      tile.dataset.studentId = student.id;

      if (!this.visibleIds.has(student.id)) {
        tile.classList.add('dimmed');
      }

      // Title bar with initials
      const titleBar = document.createElement('div');
      titleBar.className = 'tile-title';
      titleBar.style.color = student.color;
      titleBar.textContent = student.initials;
      tile.appendChild(titleBar);

      // Graph container
      const graphContainer = document.createElement('div');
      graphContainer.className = 'tile-graph';
      tile.appendChild(graphContainer);

      this.el.appendChild(tile);

      // Create a mini GraphRenderer for this tile
      // Defer to allow DOM layout
      requestAnimationFrame(() => {
        this._renderMiniGraph(graphContainer, student);
      });

      this.tiles.push({ tile, student });
    }
  }

  _renderMiniGraph(container, student) {
    const isElementaryVT = this.sim.edition === 'elementary' && this.graphType === 'velocity';
    const config = this.graphType === 'position'
      ? { xRange: { ...this.sim.timeRange }, yRange: { ...this.sim.posRange }, xLabel: '', yLabel: '' }
      : { xRange: { ...this.sim.timeRange }, yRange: { ...this.sim.velRange }, xLabel: '', yLabel: '',
          ...(isElementaryVT ? { squareUnits: true } : {}) };

    // Smaller padding for mini graphs
    const renderer = new GraphRenderer(container, config);
    renderer.padding = { top: 4, right: 4, bottom: 4, left: 4 };
    if (isElementaryVT) {
      renderer.xTickStep = 1;
      renderer.yTickStep = 1;
    }
    renderer.refresh();

    for (const actor of student.actors) {
      const group = renderer.dataGroup;

      if (this.graphType === 'position') {
        this._drawPositionTrace(renderer, group, actor, student.color);
      } else {
        this._drawVelocityTrace(renderer, group, actor, student.color);
      }
    }
  }

  _drawPositionTrace(renderer, group, actor, color) {
    const pts = actor.positionFn.points;
    if (pts.length < 2) return;

    for (let i = 0; i < pts.length - 1; i++) {
      const a = actor.positionFn.getSegmentAcceleration(i);

      if (Math.abs(a) < 0.0001) {
        const s0 = renderer.toScreen(pts[i].t, pts[i].v);
        const s1 = renderer.toScreen(pts[i + 1].t, pts[i + 1].v);
        const line = renderer.makeLine(s0.x, s0.y, s1.x, s1.y, 'function-line');
        line.setAttribute('stroke', color);
        line.setAttribute('stroke-width', '2');
        group.appendChild(line);
      } else {
        const tStart = pts[i].t;
        const tEnd = pts[i + 1].t;
        const dt = tEnd - tStart;
        const { vStart } = actor.positionFn.getSegmentVelocities(i);
        const pStart = pts[i].v;
        const screenPoints = [];

        for (let s = 0; s <= 16; s++) {
          const frac = s / 16;
          const elapsed = frac * dt;
          const t = tStart + elapsed;
          const p = pStart + vStart * elapsed + 0.5 * a * elapsed * elapsed;
          const screen = renderer.toScreen(t, p);
          screenPoints.push(`${screen.x},${screen.y}`);
        }

        const curve = renderer.makePolyline(screenPoints.join(' '), 'function-line');
        curve.setAttribute('stroke', color);
        curve.setAttribute('stroke-width', '2');
        group.appendChild(curve);
      }
    }
  }

  _drawVelocityTrace(renderer, group, actor, color) {
    // Elementary edition: draw unifix blocks instead of lines
    if (this.sim.edition === 'elementary') {
      this._drawVelocityBlocks(renderer, group, actor, color);
      return;
    }

    const pts = actor.positionFn.points;
    if (pts.length < 2) return;

    for (let i = 0; i < pts.length - 1; i++) {
      const { vStart, vEnd } = actor.positionFn.getSegmentVelocities(i);
      const tStart = pts[i].t;
      const tEnd = pts[i + 1].t;
      const s0 = renderer.toScreen(tStart, vStart);
      const s1 = renderer.toScreen(tEnd, vEnd);
      const line = renderer.makeLine(s0.x, s0.y, s1.x, s1.y, 'function-line');
      line.setAttribute('stroke', color);
      line.setAttribute('stroke-width', '2');
      group.appendChild(line);
    }
  }

  /**
   * Draw unifix-style velocity blocks for elementary edition.
   */
  _drawVelocityBlocks(renderer, group, actor, color) {
    const pts = actor.positionFn.points;
    if (pts.length < 2) return;

    const tMin = Math.floor(pts[0].t);
    const tMax = Math.ceil(pts[pts.length - 1].t);

    for (let col = tMin; col < tMax; col++) {
      const vel = this._getColumnVelocity(actor.positionFn, col);
      if (vel === 0) continue;

      const count = Math.abs(vel);
      const sign = vel > 0 ? 1 : -1;

      for (let i = 1; i <= count; i++) {
        const row = i * sign;
        const yTop = row > 0 ? row : row + 1;
        const yBottom = row > 0 ? row - 1 : row;

        const topLeft = renderer.toScreen(col, yTop);
        const bottomRight = renderer.toScreen(col + 1, yBottom);

        const gap = 1;
        const x = topLeft.x + gap;
        const y = topLeft.y + gap;
        const w = Math.max(0, bottomRight.x - topLeft.x - gap * 2);
        const h = Math.max(0, bottomRight.y - topLeft.y - gap * 2);

        const rect = renderer.makeRect(x, y, w, h, 'unifix-block-fill');
        rect.setAttribute('fill', color);
        rect.setAttribute('opacity', '0.8');
        group.appendChild(rect);
      }
    }
  }

  _getColumnVelocity(plf, t) {
    const pts = plf.points;
    for (let i = 0; i < pts.length - 1; i++) {
      const tStart = pts[i].t;
      const tEnd = pts[i + 1].t;
      if (t >= tStart && t + 1 <= tEnd + 0.001) {
        const dt = tEnd - tStart;
        if (dt === 0) return 0;
        return Math.round((pts[i + 1].v - pts[i].v) / dt);
      }
    }
    return 0;
  }

  _calculateGrid(n, W, H) {
    // Find cols/rows that best fit n tiles in W×H
    const aspect = W / H;
    let bestCols = 1;
    let bestRows = n;
    let bestWaste = Infinity;

    for (let cols = 1; cols <= n; cols++) {
      const rows = Math.ceil(n / cols);
      const tileAspect = (W / cols) / (H / rows);
      // Prefer roughly square tiles
      const waste = Math.abs(tileAspect - 1.5) + (cols * rows - n) * 0.1;
      if (waste < bestWaste) {
        bestWaste = waste;
        bestCols = cols;
        bestRows = rows;
      }
    }

    return { cols: bestCols, rows: bestRows };
  }

  _updateVisibility() {
    if (!this.tiles) return;
    for (const { tile, student } of this.tiles) {
      if (this.visibleIds.has(student.id)) {
        tile.classList.remove('dimmed');
      } else {
        tile.classList.add('dimmed');
      }
    }
  }

  /** Called by Panel after resize to re-render the grid */
  refresh() {
    this.render();
  }

  destroy() {
    if (this._resizeObserver) this._resizeObserver.disconnect();
    this.el.remove();
  }
}
