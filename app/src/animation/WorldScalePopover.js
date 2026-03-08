/**
 * Gear icon (⚙) overlaid on the world panel canvas.
 * On click, shows a popover to set the position range (min/max).
 * Changes update sim.posRange and trigger a world redraw.
 */
export class WorldScalePopover {
  constructor(container, simulation, worldComponent) {
    this.container = container;
    this.sim = simulation;
    this.world = worldComponent;
    this.isOpen = false;

    this._build();
    this._onDocClick = this._onDocClick.bind(this);
  }

  _build() {
    // Gear icon button
    this.gearBtn = document.createElement('button');
    this.gearBtn.className = 'graph-scale-gear';
    this.gearBtn.textContent = '\u2699';
    this.gearBtn.title = 'Set world range';
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
    title.textContent = 'World Range';
    this.popover.appendChild(title);

    // Position range row
    const posRow = this._makeRow('Position', 'posMin', 'posMax');
    this.popover.appendChild(posRow);

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

  toggle() {
    this.isOpen ? this.close() : this.open();
  }

  open() {
    this.posMinInput.value = this.sim.posRange.min;
    this.posMaxInput.value = this.sim.posRange.max;

    this.popover.classList.add('open');
    this.gearBtn.classList.add('active');
    this.isOpen = true;

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
    const posMin = parseFloat(this.posMinInput.value);
    const posMax = parseFloat(this.posMaxInput.value);

    if (isNaN(posMin) || isNaN(posMax)) return;
    if (posMin >= posMax) return;

    this.sim.posRange = { min: posMin, max: posMax };

    // Refresh the world component (recalculates layout from sim.posRange)
    if (this.world.refresh) this.world.refresh();
    if (this.world.drawFrame) this.world.drawFrame(this.sim.currentTime);

    this.close();
  }

  /** Get current ranges for save/load */
  getRanges() {
    return { posRange: { ...this.sim.posRange } };
  }

  destroy() {
    document.removeEventListener('click', this._onDocClick);
    if (this.gearBtn.parentNode) this.gearBtn.remove();
    if (this.popover.parentNode) this.popover.remove();
  }
}
