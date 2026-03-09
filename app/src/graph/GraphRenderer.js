import { mapRange } from '../utils/MathUtils.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Base SVG graph renderer: axes, gridlines, tick labels, coordinate transforms.
 * PositionGraph and VelocityGraph both use this.
 */
export class GraphRenderer {
  constructor(container, { xRange, yRange, xLabel, yLabel, yMaxTicks }) {
    this.container = container;
    this.xRange = xRange;
    this.yRange = yRange;
    this.xLabel = xLabel;
    this.yLabel = yLabel;
    this.yMaxTicks = yMaxTicks || 8;
    // Custom tick steps (null = auto via niceStep)
    this.xTickStep = null;
    this.yTickStep = null;

    // Padding for axis labels and ticks
    this.padding = { top: 28, right: 16, bottom: 32, left: 48 };

    this.svg = document.createElementNS(SVG_NS, 'svg');
    this.svg.setAttribute('preserveAspectRatio', 'none');
    container.appendChild(this.svg);

    // Layer groups
    this.gridGroup = this.createGroup('grid');
    this.axisGroup = this.createGroup('axes');
    this.dataGroup = this.createGroup('data');
    this.cursorGroup = this.createGroup('cursor');
    this.labelGroup = this.createGroup('labels');

    this.timeCursorLine = null;

    this._resize();
    this._resizeObserver = new ResizeObserver(() => this._resize());
    this._resizeObserver.observe(container);
  }

  createGroup(className) {
    const g = document.createElementNS(SVG_NS, 'g');
    g.setAttribute('class', className);
    this.svg.appendChild(g);
    return g;
  }

  _resize() {
    const rect = this.container.getBoundingClientRect();
    this.width = rect.width;
    this.height = rect.height;
    this.svg.setAttribute('viewBox', `0 0 ${this.width} ${this.height}`);
    this.svg.setAttribute('width', this.width);
    this.svg.setAttribute('height', this.height);

    this.plotArea = {
      x: this.padding.left,
      y: this.padding.top,
      w: this.width - this.padding.left - this.padding.right,
      h: this.height - this.padding.top - this.padding.bottom
    };

    this.drawGrid();
    this.drawAxes();
    this.drawLabels();
  }

  /** Convert data coordinates to SVG pixel coordinates */
  toScreen(t, v) {
    const x = mapRange(t, this.xRange.min, this.xRange.max,
      this.plotArea.x, this.plotArea.x + this.plotArea.w);
    const y = mapRange(v, this.yRange.min, this.yRange.max,
      this.plotArea.y + this.plotArea.h, this.plotArea.y);
    return { x, y };
  }

  /** Convert SVG pixel coordinates to data coordinates */
  toData(screenX, screenY) {
    const t = mapRange(screenX, this.plotArea.x, this.plotArea.x + this.plotArea.w,
      this.xRange.min, this.xRange.max);
    const v = mapRange(screenY, this.plotArea.y + this.plotArea.h, this.plotArea.y,
      this.yRange.min, this.yRange.max);
    return { t, v };
  }

  drawGrid() {
    this.gridGroup.innerHTML = '';
    const p = this.plotArea;

    // Vertical gridlines (time axis)
    const xStep = this.xTickStep || this.niceStep(this.xRange.max - this.xRange.min, 10);
    for (let t = Math.ceil(this.xRange.min / xStep) * xStep; t <= this.xRange.max; t += xStep) {
      const { x } = this.toScreen(t, 0);
      this.gridGroup.appendChild(this.makeLine(x, p.y, x, p.y + p.h, 'grid-line'));
    }

    // Horizontal gridlines (value axis)
    const yStep = this.yTickStep || this.niceStep(this.yRange.max - this.yRange.min, this.yMaxTicks);
    for (let v = Math.ceil(this.yRange.min / yStep) * yStep; v <= this.yRange.max; v += yStep) {
      const { y } = this.toScreen(0, v);
      this.gridGroup.appendChild(this.makeLine(p.x, y, p.x + p.w, y, 'grid-line'));
    }
  }

  drawAxes() {
    this.axisGroup.innerHTML = '';
    const p = this.plotArea;

    // X-axis (at v=0 if visible, otherwise at bottom)
    const yZero = this.yRange.min <= 0 && this.yRange.max >= 0
      ? this.toScreen(0, 0).y
      : p.y + p.h;
    this.axisGroup.appendChild(this.makeLine(p.x, yZero, p.x + p.w, yZero, 'axis-line'));

    // Y-axis (at t=0)
    const xZero = this.toScreen(0, 0).x;
    this.axisGroup.appendChild(this.makeLine(xZero, p.y, xZero, p.y + p.h, 'axis-line'));

    // Tick labels - X
    const xStep = this.xTickStep || this.niceStep(this.xRange.max - this.xRange.min, 10);
    for (let t = Math.ceil(this.xRange.min / xStep) * xStep; t <= this.xRange.max; t += xStep) {
      const { x } = this.toScreen(t, 0);
      const label = this.makeText(x, p.y + p.h + 14, this.formatTick(t), 'tick-label');
      label.setAttribute('text-anchor', 'middle');
      this.axisGroup.appendChild(label);
    }

    // Tick labels - Y
    const yStep = this.yTickStep || this.niceStep(this.yRange.max - this.yRange.min, this.yMaxTicks);
    for (let v = Math.ceil(this.yRange.min / yStep) * yStep; v <= this.yRange.max; v += yStep) {
      const { y } = this.toScreen(0, v);
      const label = this.makeText(p.x - 6, y + 3, this.formatTick(v), 'tick-label');
      label.setAttribute('text-anchor', 'end');
      this.axisGroup.appendChild(label);
    }
  }

  drawLabels() {
    this.labelGroup.innerHTML = '';
    const p = this.plotArea;

    // X-axis label
    const xLbl = this.makeText(p.x + p.w / 2, p.y + p.h + 28, this.xLabel, 'axis-label');
    xLbl.setAttribute('text-anchor', 'middle');
    this.labelGroup.appendChild(xLbl);

    // Y-axis label (rotated)
    const yLbl = this.makeText(14, p.y + p.h / 2, this.yLabel, 'axis-label');
    yLbl.setAttribute('text-anchor', 'middle');
    yLbl.setAttribute('transform', `rotate(-90, 14, ${p.y + p.h / 2})`);
    this.labelGroup.appendChild(yLbl);
  }

  /** Draw or update the vertical time cursor */
  drawTimeCursor(t) {
    if (!this.timeCursorLine) {
      this.timeCursorLine = this.makeLine(0, 0, 0, 0, 'time-cursor');
      this.cursorGroup.appendChild(this.timeCursorLine);
    }
    const { x } = this.toScreen(t, 0);
    const p = this.plotArea;
    this.timeCursorLine.setAttribute('x1', x);
    this.timeCursorLine.setAttribute('y1', p.y);
    this.timeCursorLine.setAttribute('x2', x);
    this.timeCursorLine.setAttribute('y2', p.y + p.h);
    this.timeCursorLine.style.display = t > this.xRange.min ? '' : 'none';
  }

  /** Clear the data layer for redrawing */
  clearData() {
    this.dataGroup.innerHTML = '';
  }

  // --- SVG helpers ---

  makeLine(x1, y1, x2, y2, className) {
    const line = document.createElementNS(SVG_NS, 'line');
    line.setAttribute('x1', x1);
    line.setAttribute('y1', y1);
    line.setAttribute('x2', x2);
    line.setAttribute('y2', y2);
    if (className) line.setAttribute('class', className);
    return line;
  }

  makeCircle(cx, cy, r, className) {
    const circle = document.createElementNS(SVG_NS, 'circle');
    circle.setAttribute('cx', cx);
    circle.setAttribute('cy', cy);
    circle.setAttribute('r', r);
    if (className) circle.setAttribute('class', className);
    return circle;
  }

  makePolyline(pointsStr, className) {
    const pl = document.createElementNS(SVG_NS, 'polyline');
    pl.setAttribute('points', pointsStr);
    if (className) pl.setAttribute('class', className);
    return pl;
  }

  makeRect(x, y, w, h, className) {
    const rect = document.createElementNS(SVG_NS, 'rect');
    rect.setAttribute('x', x);
    rect.setAttribute('y', y);
    rect.setAttribute('width', Math.max(0, w));
    rect.setAttribute('height', Math.max(0, h));
    if (className) rect.setAttribute('class', className);
    return rect;
  }

  makePath(d, className) {
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', d);
    if (className) path.setAttribute('class', className);
    return path;
  }

  makeText(x, y, text, className) {
    const t = document.createElementNS(SVG_NS, 'text');
    t.setAttribute('x', x);
    t.setAttribute('y', y);
    t.textContent = text;
    if (className) t.setAttribute('class', className);
    return t;
  }

  niceStep(range, maxTicks) {
    const rough = range / maxTicks;
    const pow = Math.pow(10, Math.floor(Math.log10(rough)));
    const normalized = rough / pow;
    let step;
    if (normalized <= 1) step = 1;
    else if (normalized <= 2) step = 2;
    else if (normalized <= 5) step = 5;
    else step = 10;
    return step * pow;
  }

  formatTick(value) {
    return Math.abs(value) < 0.001 ? '0' : Number(value.toPrecision(3)).toString();
  }

  /** Update axis ranges and redraw grid/axes */
  setRanges(xRange, yRange, tickSteps) {
    if (xRange) this.xRange = { ...xRange };
    if (yRange) this.yRange = { ...yRange };
    if (tickSteps) {
      this.xTickStep = tickSteps.xTickStep || null;
      this.yTickStep = tickSteps.yTickStep || null;
    }
    this._resize();
  }

  /** Force a redraw of grid/axes (call after range changes) */
  refresh() {
    this._resize();
  }
}
