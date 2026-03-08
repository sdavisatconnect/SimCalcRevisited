/**
 * Full-screen overlay showing the room code (projector-friendly),
 * a submission counter, and a "Show Results" button.
 */
export class RoomCodeOverlay {
  constructor() {
    this.el = null;
    this._pollInterval = null;
    this._onShowResults = null;
    this._onCancel = null;
  }

  /**
   * Show the room code overlay.
   * @param {string} roomCode
   * @param {Function} onShowResults - called when teacher clicks "Show Results"
   * @param {Function} onCancel - called when teacher cancels
   */
  show(roomCode, onShowResults, onCancel) {
    this._onShowResults = onShowResults;
    this._onCancel = onCancel;
    this._build(roomCode);
  }

  _build(roomCode) {
    this.el = document.createElement('div');
    this.el.className = 'roomcode-overlay';

    const card = document.createElement('div');
    card.className = 'roomcode-card';

    // Title
    const title = document.createElement('div');
    title.className = 'roomcode-title';
    title.textContent = 'Challenge Broadcast';
    card.appendChild(title);

    // Instruction
    const instruction = document.createElement('div');
    instruction.className = 'roomcode-instruction';
    instruction.textContent = 'Share this code with your students:';
    card.appendChild(instruction);

    // Room code display (large, projector-friendly)
    const codeDisplay = document.createElement('div');
    codeDisplay.className = 'roomcode-code';
    // Add letter spacing for readability
    codeDisplay.textContent = roomCode.split('').join(' ');
    card.appendChild(codeDisplay);

    // Submission counter
    this._counterEl = document.createElement('div');
    this._counterEl.className = 'roomcode-counter';
    this._counterEl.textContent = '0 submissions';
    card.appendChild(this._counterEl);

    // Buttons row
    const btnRow = document.createElement('div');
    btnRow.className = 'roomcode-buttons';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'broadcast-btn broadcast-btn-cancel';
    cancelBtn.textContent = 'Cancel Challenge';
    cancelBtn.addEventListener('click', () => this._dismiss('cancel'));

    this._showResultsBtn = document.createElement('button');
    this._showResultsBtn.className = 'broadcast-btn broadcast-btn-go';
    this._showResultsBtn.textContent = 'Show Results';
    this._showResultsBtn.disabled = true;
    this._showResultsBtn.addEventListener('click', () => this._dismiss('results'));

    btnRow.appendChild(cancelBtn);
    btnRow.appendChild(this._showResultsBtn);
    card.appendChild(btnRow);

    this.el.appendChild(card);
    document.body.appendChild(this.el);

    requestAnimationFrame(() => this.el.classList.add('visible'));
  }

  /**
   * Update the submission counter display.
   * @param {number} count
   */
  updateSubmissionCount(count) {
    if (!this._counterEl) return;
    const plural = count === 1 ? 'submission' : 'submissions';
    this._counterEl.textContent = `${count} ${plural}`;

    // Enable "Show Results" when at least one submission exists
    if (this._showResultsBtn && count > 0) {
      this._showResultsBtn.disabled = false;
    }
  }

  _dismiss(reason) {
    if (this._pollInterval) {
      clearInterval(this._pollInterval);
      this._pollInterval = null;
    }

    if (this.el) {
      this.el.classList.remove('visible');
      setTimeout(() => {
        this.el.remove();
        this.el = null;
      }, 200);
    }

    if (reason === 'results' && this._onShowResults) {
      this._onShowResults();
    } else if (reason === 'cancel' && this._onCancel) {
      this._onCancel();
    }
  }
}
