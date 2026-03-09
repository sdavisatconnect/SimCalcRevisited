/**
 * Gear icon (⚙) in the lower-left of a graph panel content area.
 * On click, shows a popover with 4 numeric inputs for X min, X max, Y min, Y max.
 * Apply validates min < max and calls renderer.setRanges(), then fires onRangeChanged.
 *
 * Also provides a lock toggle button (🔒/🔓) to prevent editing on this graph.
 */
export class GraphScalePopover {
  constructor(container, renderer, onRangeChanged) {
    this.container = container;
    this.renderer = renderer;
    this.onRangeChanged = onRangeChanged;
    this.isOpen = false;
    this.isLocked = false;

    this._build();
    this._onDocClick = this._onDocClick.bind(this);
  }

  _build() {
    // Lock toggle button
    this.lockBtn = document.createElement('button');
    this.lockBtn.className = 'graph-lock-btn';
    this.lockBtn.textContent = '\uD83D\uDD13'; // 🔓 unlocked
    this.lockBtn.title = 'Lock editing on this graph';
    this.lockBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleLock();
    });
    this.container.appendChild(this.lockBtn);

    // Gear icon button
    this.gearBtn = document.createElement('button');
    this.gearBtn.className = 'graph-scale-gear';
    this.gearBtn.textContent = '\u2699';
    this.gearBtn.title = 'Set axis ranges';
    this.gearBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggle();
    });
    this.container.appendChild(this.gearBtn);

    // Popover panel
    this.popover = document.createElement('div');
    this.popover.className = 'graph-scale-popover';
    this.popover.addEventListener('click', (e) => e.stopPropagation());

    const title = document.createElement('div');
    title.className = 'popover-title';
    title.textContent = 'Axis Ranges';
    this.popover.appendChild(title);

    // X range row
    const xRow = this._makeRow('Time (X)', 'xMin', 'xMax');
    this.popover.appendChild(xRow);

    // X tick step row
    const xTickRow = this._makeTickRow('X Ticks', 'xTick');
    this.popover.appendChild(xTickRow);

    // Y range row
    const yRow = this._makeRow('Value (Y)', 'yMin', 'yMax');
    this.popover.appendChild(yRow);

    // Y tick step row
    const yTickRow = this._makeTickRow('Y Ticks', 'yTick');
    this.popover.appendChild(yTickRow);

    // Apply button
    const applyBtn = document.createElement('button');
    applyBtn.className = 'popover-apply-btn';
    applyBtn.textContent = 'Apply';
    applyBtn.addEventListener('click', () => this._apply());
    this.popover.appendChild(applyBtn);

    this.container.appendChild(this.popover);
  }

  _makeRow(label, minKey, maxKey) {
    const row = document.createElement('div');
    row.className = 'popover-row';

    const lbl = document.createElement('span');
    lbl.className = 'popover-label';
    lbl.textContent = label;
    row.appendChild(lbl);

    const minInput = document.createElement('input');
    minInput.type = 'number';
    minInput.className = 'popover-input';
    minInput.step = 'any';
    minInput.placeholder = 'min';
    this[minKey + 'Input'] = minInput;
    row.appendChild(minInput);

    const dash = document.createElement('span');
    dash.className = 'popover-dash';
    dash.textContent = '–';
    row.appendChild(dash);

    const maxInput = document.createElement('input');
    maxInput.type = 'number';
    maxInput.className = 'popover-input';
    maxInput.step = 'any';
    maxInput.placeholder = 'max';
    this[maxKey + 'Input'] = maxInput;
    row.appendChild(maxInput);

    return row;
  }

  _makeTickRow(label, key) {
    const row = document.createElement('div');
    row.className = 'popover-row popover-tick-row';

    const lbl = document.createElement('span');
    lbl.className = 'popover-label';
    lbl.textContent = label;
    row.appendChild(lbl);

    const input = document.createElement('input');
    input.type = 'number';
    input.className = 'popover-input popover-tick-input';
    input.step = 'any';
    input.min = '0.01';
    input.placeholder = 'auto';
    this[key + 'Input'] = input;
    row.appendChild(input);

    return row;
  }

  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  open() {
    // Populate with current values
    this.xMinInput.value = this.renderer.xRange.min;
    this.xMaxInput.value = this.renderer.xRange.max;
    this.yMinInput.value = this.renderer.yRange.min;
    this.yMaxInput.value = this.renderer.yRange.max;
    this.xTickInput.value = this.renderer.xTickStep || '';
    this.yTickInput.value = this.renderer.yTickStep || '';

    this.popover.classList.add('open');
    this.gearBtn.classList.add('active');
    this.isOpen = true;

    // Close on outside click (delay to avoid immediate close)
    setTimeout(() => {
      document.addEventListener('click', this._onDocClick);
    }, 0);
  }

  close() {
    this.popover.classList.remove('open');
    this.gearBtn.classList.remove('active');
    this.isOpen = false;
    document.removeEventListener('click', this._onDocClick);
  }

  _onDocClick() {
    this.close();
  }

  _apply() {
    const xMin = parseFloat(this.xMinInput.value);
    const xMax = parseFloat(this.xMaxInput.value);
    const yMin = parseFloat(this.yMinInput.value);
    const yMax = parseFloat(this.yMaxInput.value);

    // Validate ranges
    if (isNaN(xMin) || isNaN(xMax) || isNaN(yMin) || isNaN(yMax)) return;
    if (xMin >= xMax || yMin >= yMax) return;

    // Tick steps: blank/0/NaN = auto (null), otherwise use the value
    const xTick = parseFloat(this.xTickInput.value);
    const yTick = parseFloat(this.yTickInput.value);

    this.renderer.setRanges(
      { min: xMin, max: xMax },
      { min: yMin, max: yMax },
      {
        xTickStep: (xTick > 0) ? xTick : null,
        yTickStep: (yTick > 0) ? yTick : null,
      }
    );
    this.onRangeChanged();
    this.close();
  }

  /** Get current custom ranges (for save/load) */
  getRanges() {
    return {
      xRange: { ...this.renderer.xRange },
      yRange: { ...this.renderer.yRange }
    };
  }

  /** Prevent lock state from being changed (for challenge mode) */
  setLockImmutable(immutable) {
    this._lockImmutable = !!immutable;
  }

  /** Hide the lock toggle button (for students on locked graphs) */
  hideLockButton() {
    if (this.lockBtn) this.lockBtn.style.display = 'none';
  }

  /** Toggle the edit lock on this graph */
  toggleLock() {
    if (this._lockImmutable) return;
    this.isLocked = !this.isLocked;
    this.lockBtn.textContent = this.isLocked ? '\uD83D\uDD12' : '\uD83D\uDD13'; // 🔒 or 🔓
    this.lockBtn.title = this.isLocked ? 'Unlock editing on this graph' : 'Lock editing on this graph';
    this.lockBtn.classList.toggle('locked', this.isLocked);

    // Add a visual locked indicator on the SVG
    this.renderer.svg.classList.toggle('graph-locked', this.isLocked);
  }

  destroy() {
    document.removeEventListener('click', this._onDocClick);
    if (this.lockBtn.parentNode) this.lockBtn.remove();
    if (this.gearBtn.parentNode) this.gearBtn.remove();
    if (this.popover.parentNode) this.popover.remove();
  }
}
