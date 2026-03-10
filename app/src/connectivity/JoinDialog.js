import { ProfanityFilter } from './ProfanityFilter.js';
import { FIREBASE_CONFIG } from './FirebaseConfig.js';
import { FirebaseClient } from './FirebaseClient.js';
import { RoomManager } from './RoomManager.js';

/**
 * Modal dialog for students to join a challenge.
 * Collects room code + 3-char initials, validates, fetches challenge data.
 */
export class JoinDialog {
  constructor() {
    this.el = null;
    this._resolve = null;
    this.fb = new FirebaseClient(FIREBASE_CONFIG.databaseURL);
    this.roomManager = new RoomManager(this.fb);
  }

  /**
   * Show the join dialog.
   * @returns {Promise<{ roomCode: string, initials: string, challengeData: object, settings: object } | null>}
   */
  show() {
    return new Promise((resolve) => {
      this._resolve = resolve;
      this._prefillCode = null;
      this._build();
    });
  }

  /**
   * Show the join dialog with a pre-filled room code (from a shareable link).
   * Code input is read-only; focus goes to initials input.
   * @param {string} code - the room code to pre-fill
   * @returns {Promise<{ roomCode: string, initials: string, challengeData: object, settings: object } | null>}
   */
  showWithCode(code) {
    return new Promise((resolve) => {
      this._resolve = resolve;
      this._prefillCode = code;
      this._build();
    });
  }

  _build() {
    this.el = document.createElement('div');
    this.el.className = 'join-dialog-overlay';

    const card = document.createElement('div');
    card.className = 'join-dialog-card';

    // Title
    const title = document.createElement('h2');
    title.className = 'join-dialog-title';
    title.textContent = 'Join a Challenge';
    card.appendChild(title);

    // Room code input
    const codeLabel = document.createElement('label');
    codeLabel.className = 'join-dialog-label';
    codeLabel.textContent = 'Room Code';
    card.appendChild(codeLabel);

    this._codeInput = document.createElement('input');
    this._codeInput.type = 'text';
    this._codeInput.className = 'join-dialog-input join-dialog-code-input';
    this._codeInput.placeholder = 'Enter room code';
    this._codeInput.maxLength = 6;
    this._codeInput.inputMode = 'numeric';
    this._codeInput.pattern = '[0-9]*';
    this._codeInput.addEventListener('input', () => {
      // Allow only digits
      this._codeInput.value = this._codeInput.value.replace(/\D/g, '');
      this._clearError();
    });
    card.appendChild(this._codeInput);

    // Initials input
    const initialsLabel = document.createElement('label');
    initialsLabel.className = 'join-dialog-label';
    initialsLabel.textContent = 'Your Initials (3 letters)';
    card.appendChild(initialsLabel);

    this._initialsInput = document.createElement('input');
    this._initialsInput.type = 'text';
    this._initialsInput.className = 'join-dialog-input join-dialog-initials-input';
    this._initialsInput.placeholder = 'ABC';
    this._initialsInput.maxLength = 3;
    this._initialsInput.style.textTransform = 'uppercase';
    this._initialsInput.style.letterSpacing = '4px';
    this._initialsInput.style.textAlign = 'center';
    this._initialsInput.style.fontSize = '20px';
    this._initialsInput.addEventListener('input', () => {
      // Allow only letters
      this._initialsInput.value = this._initialsInput.value.replace(/[^a-zA-Z]/g, '').toUpperCase();
      this._clearError();
    });
    card.appendChild(this._initialsInput);

    // Error message area
    this._errorEl = document.createElement('div');
    this._errorEl.className = 'join-dialog-error';
    card.appendChild(this._errorEl);

    // Buttons
    const btnRow = document.createElement('div');
    btnRow.className = 'join-dialog-buttons';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'broadcast-btn broadcast-btn-cancel';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => this._dismiss(null));

    this._joinBtn = document.createElement('button');
    this._joinBtn.className = 'broadcast-btn broadcast-btn-go';
    this._joinBtn.textContent = 'Join';
    this._joinBtn.addEventListener('click', () => this._handleJoin());

    btnRow.appendChild(cancelBtn);
    btnRow.appendChild(this._joinBtn);
    card.appendChild(btnRow);

    this.el.appendChild(card);
    document.body.appendChild(this.el);

    // Pre-fill room code if provided via shareable link
    if (this._prefillCode) {
      this._codeInput.value = this._prefillCode;
      this._codeInput.readOnly = true;
      this._codeInput.classList.add('prefilled');
    }

    requestAnimationFrame(() => {
      this.el.classList.add('visible');
      if (this._prefillCode) {
        this._initialsInput.focus();
      } else {
        this._codeInput.focus();
      }
    });

    // Allow Enter key to submit
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this._handleJoin();
    });
  }

  async _handleJoin() {
    const code = this._codeInput.value.trim();
    const initials = this._initialsInput.value.trim().toUpperCase();

    // Validate room code
    if (!code || code.length < 4) {
      this._showError('Enter a 4-digit room code.');
      return;
    }

    // Validate initials
    if (!initials || initials.length !== 3) {
      this._showError('Enter exactly 3 letters for your initials.');
      return;
    }

    // Profanity check
    if (ProfanityFilter.isBlocked(initials)) {
      this._showError('Those initials are not allowed. Try different ones.');
      return;
    }

    // Disable button while loading
    this._joinBtn.disabled = true;
    this._joinBtn.textContent = 'Joining...';

    try {
      // Fetch challenge from Firebase
      const challengeData = await this.roomManager.getChallenge(code);
      if (!challengeData) {
        this._showError('Room not found. Check the code and try again.');
        this._joinBtn.disabled = false;
        this._joinBtn.textContent = 'Join';
        return;
      }

      const settings = await this.roomManager.getSettings(code);

      this._dismiss({
        roomCode: code,
        initials,
        challengeData,
        settings: settings || { allowNewPanels: false },
      });

    } catch (err) {
      console.error('Join error:', err);
      this._showError('Connection error. Check your internet and try again.');
      this._joinBtn.disabled = false;
      this._joinBtn.textContent = 'Join';
    }
  }

  _showError(msg) {
    this._errorEl.textContent = msg;
    this._errorEl.classList.add('visible');
  }

  _clearError() {
    this._errorEl.textContent = '';
    this._errorEl.classList.remove('visible');
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
