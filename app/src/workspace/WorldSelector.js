/**
 * Full-screen overlay shown when the app starts blank.
 * User picks a world type (horizontal walking or vertical elevator).
 * On selection, emits 'world:type-selected' on the bus and removes itself.
 */
export class WorldSelector {
  constructor(parentEl, simulation, bus) {
    this.parentEl = parentEl;
    this.sim = simulation;
    this.bus = bus;
    this.el = null;

    this._build();
  }

  _build() {
    this.el = document.createElement('div');
    this.el.className = 'world-selector-overlay';

    const card = document.createElement('div');
    card.className = 'world-selector-card';

    const title = document.createElement('h2');
    title.className = 'world-selector-title';
    title.textContent = 'Choose a World';
    card.appendChild(title);

    const subtitle = document.createElement('p');
    subtitle.className = 'world-selector-subtitle';
    subtitle.textContent = 'Select the type of motion world to begin';
    card.appendChild(subtitle);

    const options = document.createElement('div');
    options.className = 'world-selector-options';

    // Horizontal world column (main button + quick start)
    const hCol = document.createElement('div');
    hCol.className = 'world-option-column';
    hCol.appendChild(this._createOption({
      type: 'horizontal',
      icon: '\u{1F6B6}',
      label: 'Horizontal World',
      description: 'Characters walk along a track',
      enabled: true,
    }));
    hCol.appendChild(this._createQuickStart('horizontal', 'Horizontal World Quickstart'));
    options.appendChild(hCol);

    // Vertical world column (main button + quick start)
    const vCol = document.createElement('div');
    vCol.className = 'world-option-column';
    vCol.appendChild(this._createOption({
      type: 'vertical',
      icon: '\u{1F6D7}',
      label: 'Vertical World',
      description: 'Elevator moves up and down',
      enabled: true,
    }));
    vCol.appendChild(this._createQuickStart('vertical', 'Vertical World Quickstart'));
    options.appendChild(vCol);

    card.appendChild(options);

    // Divider
    const divider = document.createElement('div');
    divider.className = 'world-selector-divider';
    divider.textContent = 'or';
    card.appendChild(divider);

    // Author & Join row
    const actionRow = document.createElement('div');
    actionRow.className = 'world-selector-action-row';

    // Author a Challenge button — reveals world type picker
    const authorBtn = document.createElement('button');
    authorBtn.className = 'world-option-author';
    authorBtn.innerHTML = '\u270F\uFE0F Author a Challenge';
    actionRow.appendChild(authorBtn);

    // Hidden world type picker for authoring
    const authorPicker = document.createElement('div');
    authorPicker.className = 'author-world-picker';
    authorPicker.style.display = 'none';

    const pickerLabel = document.createElement('span');
    pickerLabel.className = 'author-picker-label';
    pickerLabel.textContent = 'Choose world type:';
    authorPicker.appendChild(pickerLabel);

    const hBtn = document.createElement('button');
    hBtn.className = 'author-picker-btn';
    hBtn.textContent = '\uD83D\uDEB6 Horizontal';
    hBtn.addEventListener('click', () => {
      this.bus.emit('challenge:author-start', { type: 'horizontal' });
      this.dismiss();
    });
    authorPicker.appendChild(hBtn);

    const vBtn = document.createElement('button');
    vBtn.className = 'author-picker-btn';
    vBtn.textContent = '\uD83D\uDED7 Vertical';
    vBtn.addEventListener('click', () => {
      this.bus.emit('challenge:author-start', { type: 'vertical' });
      this.dismiss();
    });
    authorPicker.appendChild(vBtn);

    authorBtn.addEventListener('click', () => {
      authorPicker.style.display = authorPicker.style.display === 'none' ? 'flex' : 'none';
    });

    actionRow.appendChild(authorPicker);

    // Join a Challenge button
    const joinBtn = document.createElement('button');
    joinBtn.className = 'world-option-join';
    joinBtn.innerHTML = '\uD83D\uDD17 Join a Challenge';
    joinBtn.addEventListener('click', () => {
      this.bus.emit('challenge:join-request');
      this.dismiss();
    });
    actionRow.appendChild(joinBtn);

    card.appendChild(actionRow);

    this.el.appendChild(card);
    this.parentEl.appendChild(this.el);
  }

  _createOption({ type, icon, label, description, enabled, badge }) {
    const btn = document.createElement('button');
    btn.className = 'world-option' + (enabled ? '' : ' disabled');
    btn.disabled = !enabled;

    const iconEl = document.createElement('div');
    iconEl.className = 'world-option-icon';
    iconEl.textContent = icon;
    btn.appendChild(iconEl);

    const labelEl = document.createElement('div');
    labelEl.className = 'world-option-label';
    labelEl.textContent = label;
    btn.appendChild(labelEl);

    const descEl = document.createElement('div');
    descEl.className = 'world-option-desc';
    descEl.textContent = description;
    btn.appendChild(descEl);

    if (badge) {
      const badgeEl = document.createElement('span');
      badgeEl.className = 'world-option-badge';
      badgeEl.textContent = badge;
      btn.appendChild(badgeEl);
    }

    if (enabled) {
      btn.addEventListener('click', () => {
        this.sim.worldType = type;
        this.bus.emit('world:type-selected', { type });
        this.dismiss();
      });
    }

    return btn;
  }

  _createQuickStart(type, label) {
    const btn = document.createElement('button');
    btn.className = 'world-option-quickstart';
    btn.textContent = label;
    btn.addEventListener('click', () => {
      this.sim.worldType = type;
      this.bus.emit('world:quick-start', { type });
      this.dismiss();
    });
    return btn;
  }

  dismiss() {
    if (this.el && this.el.parentNode) {
      this.el.classList.add('dismissing');
      // Allow CSS transition to play
      setTimeout(() => {
        this.el.remove();
        this.el = null;
      }, 300);
    }
  }
}
