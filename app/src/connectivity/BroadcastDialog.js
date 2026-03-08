/**
 * Modal dialog shown when the teacher clicks "Broadcast Challenge".
 * Summarizes lock states and lets teacher configure challenge settings.
 */
export class BroadcastDialog {
  constructor() {
    this.el = null;
    this._resolve = null;
  }

  /**
   * Show the broadcast dialog.
   * @param {Workspace} workspace - to read panel lock states
   * @returns {Promise<{ allowNewPanels: boolean } | null>} settings, or null if cancelled
   */
  show(workspace) {
    return new Promise((resolve) => {
      this._resolve = resolve;
      this._build(workspace);
    });
  }

  _build(workspace) {
    // Overlay
    this.el = document.createElement('div');
    this.el.className = 'broadcast-dialog-overlay';

    const card = document.createElement('div');
    card.className = 'broadcast-dialog-card';

    // Title
    const title = document.createElement('h2');
    title.className = 'broadcast-dialog-title';
    title.textContent = 'Broadcast Challenge';
    card.appendChild(title);

    // Lock state summary
    const summaryTitle = document.createElement('h3');
    summaryTitle.className = 'broadcast-dialog-section';
    summaryTitle.textContent = 'Graph Lock States';
    card.appendChild(summaryTitle);

    const summaryList = document.createElement('div');
    summaryList.className = 'broadcast-lock-summary';

    const graphPanels = workspace.panels.filter(
      p => p.type !== 'world' && p.component && p.component.scalePopover
    );

    if (graphPanels.length === 0) {
      const note = document.createElement('div');
      note.className = 'broadcast-lock-note';
      note.textContent = 'No graph panels in workspace. Students will only see the world.';
      summaryList.appendChild(note);
    } else {
      for (const panel of graphPanels) {
        const row = document.createElement('div');
        row.className = 'broadcast-lock-row broadcast-lock-toggle';

        const icon = document.createElement('span');
        icon.className = 'broadcast-lock-icon';
        const isLocked = panel.component.scalePopover.isLocked;
        icon.textContent = isLocked ? '\uD83D\uDD12' : '\uD83D\uDD13';

        const label = document.createElement('span');
        label.className = 'broadcast-lock-label';
        const typeNames = {
          position: 'Position (P/T)',
          velocity: 'Velocity (V/T)',
          acceleration: 'Acceleration (A/T)',
        };
        label.textContent = typeNames[panel.type] || panel.type;

        const status = document.createElement('span');
        status.className = 'broadcast-lock-status ' + (isLocked ? 'locked' : 'editable');
        status.textContent = isLocked ? 'Locked (view only)' : 'Editable';

        // Click to toggle lock state
        row.addEventListener('click', () => {
          panel.component.scalePopover.toggleLock();
          const nowLocked = panel.component.scalePopover.isLocked;
          icon.textContent = nowLocked ? '\uD83D\uDD12' : '\uD83D\uDD13';
          status.textContent = nowLocked ? 'Locked (view only)' : 'Editable';
          status.className = 'broadcast-lock-status ' + (nowLocked ? 'locked' : 'editable');
        });

        row.appendChild(icon);
        row.appendChild(label);
        row.appendChild(status);
        summaryList.appendChild(row);
      }
    }
    card.appendChild(summaryList);

    // Tip
    const tip = document.createElement('p');
    tip.className = 'broadcast-dialog-tip';
    tip.textContent = 'Click a graph row above to toggle its lock state.';
    card.appendChild(tip);

    // Settings section
    const settingsTitle = document.createElement('h3');
    settingsTitle.className = 'broadcast-dialog-section';
    settingsTitle.textContent = 'Student Permissions';
    card.appendChild(settingsTitle);

    // Allow new panels toggle
    const toggleRow = document.createElement('label');
    toggleRow.className = 'broadcast-toggle-row';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'broadcast-toggle-checkbox';
    checkbox.checked = false;
    this._allowNewPanelsCheckbox = checkbox;

    const toggleLabel = document.createElement('span');
    toggleLabel.textContent = 'Allow students to add new graph panels';

    toggleRow.appendChild(checkbox);
    toggleRow.appendChild(toggleLabel);
    card.appendChild(toggleRow);

    // Buttons
    const btnRow = document.createElement('div');
    btnRow.className = 'broadcast-dialog-buttons';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'broadcast-btn broadcast-btn-cancel';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => this._dismiss(null));

    const broadcastBtn = document.createElement('button');
    broadcastBtn.className = 'broadcast-btn broadcast-btn-go';
    broadcastBtn.textContent = '\uD83D\uDCE1 Broadcast';
    broadcastBtn.addEventListener('click', () => {
      this._dismiss({
        allowNewPanels: this._allowNewPanelsCheckbox.checked,
      });
    });

    btnRow.appendChild(cancelBtn);
    btnRow.appendChild(broadcastBtn);
    card.appendChild(btnRow);

    this.el.appendChild(card);
    document.body.appendChild(this.el);

    // Animate in
    requestAnimationFrame(() => this.el.classList.add('visible'));
  }

  _dismiss(result) {
    if (this.el) {
      this.el.classList.remove('visible');
      setTimeout(() => {
        this.el.remove();
        this.el = null;
      }, 200);
    }
    if (this._resolve) {
      this._resolve(result);
      this._resolve = null;
    }
  }
}
