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
  constructor(containerEl, bus) {
    this.container = containerEl;
    this.bus = bus;
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
    const panelTypes = [
      { key: 'world', label: 'World' },
      { key: 'position', label: 'Position (P/T)' },
      { key: 'velocity', label: 'Velocity (V/T)' },
      { key: 'acceleration', label: 'Acceleration (A/T)' },
    ];
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
    const editableTypes = [
      { key: 'position', label: 'Position (P/T)' },
      { key: 'velocity', label: 'Velocity (V/T)' },
      { key: 'acceleration', label: 'Acceleration (A/T)' },
    ];
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
  }
}
