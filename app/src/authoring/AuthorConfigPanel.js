/**
 * Right-column configuration panel for Challenge Author Mode.
 *
 * Provides controls for:
 *  - Challenge title
 *  - Instructions for students
 *  - Which panels students can see (world, position, velocity, acceleration)
 *  - Which panels students can edit
 *  - Whether students can add new panels
 *  - Results display configuration (overlaid/tiled graph type, reference overlay)
 */
export class AuthorConfigPanel {
  /**
   * @param {HTMLElement} containerEl
   * @param {EventBus} bus
   * @param {object} [options]
   * @param {boolean} [options.hideAcceleration] - Hide acceleration checkboxes (for elementary)
   */
  constructor(containerEl, bus, options = {}) {
    this.container = containerEl;
    this.bus = bus;
    this.hideAcceleration = options.hideAcceleration || false;
    this._build();
  }

  _build() {
    this.container.innerHTML = '';
    this.container.classList.add('author-config-panel');

    const scrollArea = document.createElement('div');
    scrollArea.className = 'author-config-scroll';
    this.container.appendChild(scrollArea);

    // --- Challenge Title ---
    scrollArea.appendChild(this._sectionHeader('Challenge Title'));
    this.titleInput = document.createElement('input');
    this.titleInput.type = 'text';
    this.titleInput.className = 'author-config-input';
    this.titleInput.placeholder = 'e.g. Match the Position Graph';
    this.titleInput.value = '';
    scrollArea.appendChild(this.titleInput);

    // --- Instructions ---
    scrollArea.appendChild(this._sectionHeader('Instructions for Students'));
    this.instructionsInput = document.createElement('textarea');
    this.instructionsInput.className = 'author-config-textarea';
    this.instructionsInput.placeholder = 'Tell students what to do...';
    this.instructionsInput.rows = 4;
    scrollArea.appendChild(this.instructionsInput);

    // --- Student Sees ---
    scrollArea.appendChild(this._sectionHeader('Student Sees'));
    let panelTypes = [
      { key: 'world', label: 'World' },
      { key: 'position', label: 'Position (P/T)' },
      { key: 'velocity', label: 'Velocity (V/T)' },
      { key: 'acceleration', label: 'Acceleration (A/T)' },
    ];
    if (this.hideAcceleration) {
      panelTypes = panelTypes.filter(p => p.key !== 'acceleration');
    }
    this.visibleChecks = {};
    const visGroup = document.createElement('div');
    visGroup.className = 'author-config-check-group';
    for (const { key, label } of panelTypes) {
      const row = this._checkbox(key, label, key === 'world' || key === 'position');
      visGroup.appendChild(row.el);
      this.visibleChecks[key] = row.cb;
    }
    scrollArea.appendChild(visGroup);

    // --- Student Can Edit ---
    scrollArea.appendChild(this._sectionHeader('Student Can Edit'));
    let editableTypes = [
      { key: 'position', label: 'Position (P/T)' },
      { key: 'velocity', label: 'Velocity (V/T)' },
      { key: 'acceleration', label: 'Acceleration (A/T)' },
    ];
    if (this.hideAcceleration) {
      editableTypes = editableTypes.filter(p => p.key !== 'acceleration');
    }
    this.editableChecks = {};
    const editGroup = document.createElement('div');
    editGroup.className = 'author-config-check-group';
    for (const { key, label } of editableTypes) {
      const row = this._checkbox(key, label, key === 'position');
      editGroup.appendChild(row.el);
      this.editableChecks[key] = row.cb;
    }
    scrollArea.appendChild(editGroup);

    // Validation: "can edit" implies "can see"
    for (const key of Object.keys(this.editableChecks)) {
      this.editableChecks[key].addEventListener('change', () => {
        if (this.editableChecks[key].checked && this.visibleChecks[key]) {
          this.visibleChecks[key].checked = true;
        }
      });
    }

    // --- Allow New Panels ---
    const allowRow = this._checkbox('allowNewPanels', 'Allow students to add new panels', false);
    scrollArea.appendChild(allowRow.el);
    this.allowNewPanelsCb = allowRow.cb;

    // --- Results Display ---
    scrollArea.appendChild(this._sectionHeader('Results Display'));

    // Overlaid graph type
    const overlaidRow = document.createElement('div');
    overlaidRow.className = 'author-config-select-row';
    const overlaidLabel = document.createElement('label');
    overlaidLabel.textContent = 'Overlaid graph:';
    overlaidLabel.className = 'author-config-select-label';
    this.overlaidSelect = document.createElement('select');
    this.overlaidSelect.className = 'author-config-select';
    this.overlaidSelect.innerHTML = `
      <option value="position">Position</option>
      <option value="velocity">Velocity</option>
    `;
    overlaidRow.appendChild(overlaidLabel);
    overlaidRow.appendChild(this.overlaidSelect);
    scrollArea.appendChild(overlaidRow);

    // Tiled graph type
    const tiledRow = document.createElement('div');
    tiledRow.className = 'author-config-select-row';
    const tiledLabel = document.createElement('label');
    tiledLabel.textContent = 'Tiled graph:';
    tiledLabel.className = 'author-config-select-label';
    this.tiledSelect = document.createElement('select');
    this.tiledSelect.className = 'author-config-select';
    this.tiledSelect.innerHTML = `
      <option value="position">Position</option>
      <option value="velocity">Velocity</option>
    `;
    tiledRow.appendChild(tiledLabel);
    tiledRow.appendChild(this.tiledSelect);
    scrollArea.appendChild(tiledRow);

    // Show reference in results
    const refRow = this._checkbox('showRef', 'Show reference trace in results', true);
    scrollArea.appendChild(refRow.el);
    this.showRefCb = refRow.cb;

    // --- Target Segments ---
    this._buildTargetSegmentsSection(scrollArea);
  }

  _buildTargetSegmentsSection(scrollArea) {
    scrollArea.appendChild(this._sectionHeader('Target Segments'));

    const info = document.createElement('div');
    info.className = 'target-segment-info';
    info.textContent = 'Orange line segments shown on the position graph that students must match.';
    scrollArea.appendChild(info);

    this._targetSegments = [];
    this._targetSegmentsList = document.createElement('div');
    this._targetSegmentsList.className = 'target-segment-list';
    scrollArea.appendChild(this._targetSegmentsList);

    const addBtn = document.createElement('button');
    addBtn.className = 'target-segment-add-btn';
    addBtn.textContent = '+ Add Segment';
    addBtn.addEventListener('click', () => {
      const seg = { startTime: 0, startPosition: 0, endTime: 1, endPosition: 0 };
      this._targetSegments.push(seg);
      this._addSegmentRow(seg, this._targetSegments.length - 1);
      this._emitTargetSegmentsChanged();
    });
    scrollArea.appendChild(addBtn);
  }

  _addSegmentRow(seg, index) {
    const row = document.createElement('div');
    row.className = 'target-segment-row';

    const fields = [
      { key: 'startTime', label: 't\u2081', value: seg.startTime },
      { key: 'startPosition', label: 'p\u2081', value: seg.startPosition },
      { key: 'endTime', label: 't\u2082', value: seg.endTime },
      { key: 'endPosition', label: 'p\u2082', value: seg.endPosition },
    ];

    for (const { key, label, value } of fields) {
      const lbl = document.createElement('label');
      lbl.textContent = label;
      row.appendChild(lbl);

      const input = document.createElement('input');
      input.type = 'number';
      input.step = '0.5';
      input.className = 'target-segment-input';
      input.value = value;
      input.addEventListener('change', () => {
        const val = parseFloat(input.value);
        if (!isNaN(val)) {
          seg[key] = val;
          this._emitTargetSegmentsChanged();
        }
      });
      row.appendChild(input);
    }

    const removeBtn = document.createElement('button');
    removeBtn.className = 'target-segment-remove';
    removeBtn.textContent = '\u2715';
    removeBtn.title = 'Remove segment';
    removeBtn.addEventListener('click', () => {
      const idx = this._targetSegments.indexOf(seg);
      if (idx !== -1) this._targetSegments.splice(idx, 1);
      row.remove();
      this._emitTargetSegmentsChanged();
    });
    row.appendChild(removeBtn);

    this._targetSegmentsList.appendChild(row);
  }

  _emitTargetSegmentsChanged() {
    // Filter out invalid segments (endTime must be > startTime)
    const valid = this._targetSegments.filter(s => s.endTime > s.startTime);
    this.bus.emit('targetSegments:changed', { segments: [...valid] });
  }

  _sectionHeader(text) {
    const h = document.createElement('div');
    h.className = 'author-config-section-header';
    h.textContent = text;
    return h;
  }

  _checkbox(key, label, checked = false) {
    const row = document.createElement('label');
    row.className = 'author-config-check-row';

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.className = 'author-config-checkbox';
    cb.checked = checked;
    cb.dataset.key = key;

    const span = document.createElement('span');
    span.textContent = label;

    row.appendChild(cb);
    row.appendChild(span);

    return { el: row, cb };
  }

  /**
   * Get the current config values.
   * @returns {object}
   */
  getConfig() {
    const visiblePanels = [];
    for (const [key, cb] of Object.entries(this.visibleChecks)) {
      if (cb.checked) visiblePanels.push(key);
    }

    const editablePanels = [];
    for (const [key, cb] of Object.entries(this.editableChecks)) {
      if (cb.checked) editablePanels.push(key);
    }

    return {
      title: this.titleInput.value.trim() || 'Untitled Challenge',
      instructions: this.instructionsInput.value.trim(),
      visiblePanels,
      editablePanels,
      allowNewPanels: this.allowNewPanelsCb.checked,
      overlaidGraphType: this.overlaidSelect.value,
      tiledGraphType: this.tiledSelect.value,
      showReferenceInResults: this.showRefCb.checked,
      targetSegments: this._targetSegments.filter(s => s.endTime > s.startTime),
    };
  }

  /**
   * Restore config values from a loaded challenge template.
   * @param {object} challengeData - v2 challenge data
   */
  loadFromChallenge(challengeData) {
    // Title and instructions
    if (challengeData.meta) {
      this.titleInput.value = challengeData.meta.title || '';
      this.instructionsInput.value = challengeData.meta.instructions || '';
    }

    // Visible panels
    const vis = new Set(challengeData.studentConfig?.visiblePanels || []);
    for (const [key, cb] of Object.entries(this.visibleChecks)) {
      cb.checked = vis.has(key);
    }

    // Editable panels
    const edit = new Set(challengeData.studentConfig?.editablePanels || []);
    for (const [key, cb] of Object.entries(this.editableChecks)) {
      cb.checked = edit.has(key);
    }

    // Allow new panels
    this.allowNewPanelsCb.checked = challengeData.studentConfig?.allowNewPanels || false;

    // Results config
    if (challengeData.resultsConfig) {
      this.overlaidSelect.value = challengeData.resultsConfig.overlaidGraphType || 'position';
      this.tiledSelect.value = challengeData.resultsConfig.tiledGraphType || 'position';
      this.showRefCb.checked = challengeData.resultsConfig.showReferenceInResults !== false;
    }

    // Target segments
    this._targetSegments = [];
    this._targetSegmentsList.innerHTML = '';
    if (challengeData.targetSegments) {
      for (const seg of challengeData.targetSegments) {
        const copy = { ...seg };
        this._targetSegments.push(copy);
        this._addSegmentRow(copy, this._targetSegments.length - 1);
      }
    }
  }
}
