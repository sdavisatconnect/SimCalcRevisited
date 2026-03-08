/**
 * Axis drag interaction for graphs.
 * Detects clicks in axis margin regions:
 * - Click+drag: pan the range
 * - Shift+click+drag: zoom (shrink/expand) the range
 *
 * X-axis region (below plot area): horizontal drag
 * Y-axis region (left of plot area): vertical drag
 */
export class GraphScaleInteraction {
  constructor(renderer, onRangeChanged) {
    this.renderer = renderer;
    this.onRangeChanged = onRangeChanged;
    this._dragging = null; // null | 'x' | 'y'
    this._mode = null;     // 'pan' | 'zoom'
    this._startMouse = null;
    this._startRange = null;

    this._onMouseDown = this._onMouseDown.bind(this);
    this._onMouseMove = this._onMouseMove.bind(this);
    this._onMouseUp = this._onMouseUp.bind(this);
    this._onMouseMoveHover = this._onMouseMoveHover.bind(this);

    this.renderer.svg.addEventListener('mousedown', this._onMouseDown);
    this.renderer.svg.addEventListener('mousemove', this._onMouseMoveHover);
  }

  _hitRegion(e) {
    const rect = this.renderer.svg.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const p = this.renderer.plotArea;

    // X-axis region: below the plot area, within horizontal bounds
    if (my > p.y + p.h && mx >= p.x && mx <= p.x + p.w) {
      return 'x';
    }
    // Y-axis region: left of the plot area, within vertical bounds
    if (mx < p.x && my >= p.y && my <= p.y + p.h) {
      return 'y';
    }
    return null;
  }

  _onMouseMoveHover(e) {
    if (this._dragging) return;
    const region = this._hitRegion(e);
    if (region === 'x') {
      this.renderer.svg.style.cursor = e.shiftKey ? 'col-resize' : 'ew-resize';
    } else if (region === 'y') {
      this.renderer.svg.style.cursor = e.shiftKey ? 'row-resize' : 'ns-resize';
    } else {
      this.renderer.svg.style.cursor = '';
    }
  }

  _onMouseDown(e) {
    // Don't intercept clicks on control points — let the graph interaction handle those
    if (e.target.classList.contains('control-point')) return;

    const region = this._hitRegion(e);
    if (!region) return;

    e.preventDefault();
    e.stopPropagation();

    this._dragging = region;
    this._mode = e.shiftKey ? 'zoom' : 'pan';
    this._startMouse = { x: e.clientX, y: e.clientY };

    if (region === 'x') {
      this._startRange = { ...this.renderer.xRange };
      this.renderer.svg.style.cursor = this._mode === 'zoom' ? 'col-resize' : 'ew-resize';
    } else {
      this._startRange = { ...this.renderer.yRange };
      this.renderer.svg.style.cursor = this._mode === 'zoom' ? 'row-resize' : 'ns-resize';
    }

    window.addEventListener('mousemove', this._onMouseMove);
    window.addEventListener('mouseup', this._onMouseUp);
  }

  _onMouseMove(e) {
    if (!this._dragging) return;

    const p = this.renderer.plotArea;

    if (this._mode === 'pan') {
      this._doPan(e, p);
    } else {
      this._doZoom(e, p);
    }

    this.onRangeChanged();
  }

  _doPan(e, p) {
    if (this._dragging === 'x') {
      const dx = e.clientX - this._startMouse.x;
      const span = this._startRange.max - this._startRange.min;
      const dataPerPx = span / p.w;
      const shift = -dx * dataPerPx;
      this.renderer.setRanges(
        { min: this._startRange.min + shift, max: this._startRange.max + shift },
        null
      );
    } else {
      const dy = e.clientY - this._startMouse.y;
      const span = this._startRange.max - this._startRange.min;
      const dataPerPx = span / p.h;
      const shift = dy * dataPerPx;
      this.renderer.setRanges(
        null,
        { min: this._startRange.min + shift, max: this._startRange.max + shift }
      );
    }
  }

  _doZoom(e, p) {
    const center = (this._startRange.min + this._startRange.max) / 2;
    const halfSpan = (this._startRange.max - this._startRange.min) / 2;

    if (this._dragging === 'x') {
      // Drag right = zoom out (expand range), drag left = zoom in (shrink range)
      const dx = e.clientX - this._startMouse.x;
      const scale = Math.pow(2, -dx / 150);  // 150px of drag = 2x zoom
      const newHalf = Math.max(0.1, halfSpan * scale);
      this.renderer.setRanges(
        { min: center - newHalf, max: center + newHalf },
        null
      );
    } else {
      // Drag up = zoom in (shrink range), drag down = zoom out (expand range)
      const dy = e.clientY - this._startMouse.y;
      const scale = Math.pow(2, dy / 150);
      const newHalf = Math.max(0.1, halfSpan * scale);
      this.renderer.setRanges(
        null,
        { min: center - newHalf, max: center + newHalf }
      );
    }
  }

  _onMouseUp() {
    this._dragging = null;
    this._mode = null;
    this._startMouse = null;
    this._startRange = null;
    this.renderer.svg.style.cursor = '';
    window.removeEventListener('mousemove', this._onMouseMove);
    window.removeEventListener('mouseup', this._onMouseUp);
  }

  destroy() {
    this.renderer.svg.removeEventListener('mousedown', this._onMouseDown);
    this.renderer.svg.removeEventListener('mousemove', this._onMouseMoveHover);
    window.removeEventListener('mousemove', this._onMouseMove);
    window.removeEventListener('mouseup', this._onMouseUp);
  }
}
