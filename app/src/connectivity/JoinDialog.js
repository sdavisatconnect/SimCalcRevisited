import { ProfanityFilter } from './ProfanityFilter.js';
import { FIREBASE_CONFIG } from './FirebaseConfig.js';
import { FirebaseClient } from './FirebaseClient.js';
import { RoomManager } from './RoomManager.js';
import { drawAnimalCharacter } from '../animation/AnimalSprites.js';
import { t } from '../i18n/strings.js';

const ANIMALS = [
  { type: 'puppy',    key: 'puppy' },
  { type: 'kitten',   key: 'kitten' },
  { type: 'bunny',    key: 'bunny' },
  { type: 'duck',     key: 'duck' },
  { type: 'penguin',  key: 'penguin' },
  { type: 'elephant', key: 'elephant' },
  { type: 'horse',    key: 'horse' },
  { type: 'cow',      key: 'cow' },
  { type: 'frog',     key: 'frog' },
  { type: 'bear',     key: 'bear' },
];

const COLORS = [
  '#e74c3c', '#3498db', '#2ecc71', '#9b59b6',
  '#e67e22', '#1abc9c', '#f39c12', '#e84393',
];

/**
 * Modal dialog for students to join a challenge.
 * Step 1: Room code + initials
 * Step 2: Pick your animal (elementary only)
 * Step 3: Pick your color + preview (elementary only)
 * For non-elementary challenges, skips steps 2-3.
 */
export class JoinDialog {
  constructor() {
    this.el = null;
    this._resolve = null;
    this.fb = new FirebaseClient(FIREBASE_CONFIG.databaseURL);
    this.roomManager = new RoomManager(this.fb);
    this._selectedAnimal = null;
    this._selectedColor = null;
    this._challengeData = null;
    this._settings = null;
    this._initials = null;
    this._roomCode = null;
  }

  /**
   * Show the join dialog.
   * @returns {Promise<{ roomCode, initials, challengeData, settings, animalType?, color? } | null>}
   */
  show() {
    return new Promise((resolve) => {
      this._resolve = resolve;
      this._prefillCode = null;
      this._build();
    });
  }

  /**
   * Show with a pre-filled room code (from a shareable link).
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

    this._card = document.createElement('div');
    this._card.className = 'join-dialog-card';

    this._buildStep1();
    this._buildStep2();
    this._buildStep3();

    this.el.appendChild(this._card);
    document.body.appendChild(this.el);

    // Pre-fill room code if provided via shareable link
    if (this._prefillCode) {
      this._codeInput.value = this._prefillCode;
      this._codeInput.readOnly = true;
      this._codeInput.classList.add('prefilled');
    }

    this._showStep('step1');

    requestAnimationFrame(() => {
      this.el.classList.add('visible');
      if (this._prefillCode) {
        this._initialsInput.focus();
      } else {
        this._codeInput.focus();
      }
    });
  }

  // --- Step 1: Room Code + Initials ---
  _buildStep1() {
    const step = document.createElement('div');
    step.className = 'join-dialog-step';
    step.id = 'join-step1';

    const title = document.createElement('h2');
    title.className = 'join-dialog-title';
    title.textContent = 'Join a Challenge';
    step.appendChild(title);

    // Room code input
    const codeLabel = document.createElement('label');
    codeLabel.className = 'join-dialog-label';
    codeLabel.textContent = 'Room Code';
    step.appendChild(codeLabel);

    this._codeInput = document.createElement('input');
    this._codeInput.type = 'text';
    this._codeInput.className = 'join-dialog-input join-dialog-code-input';
    this._codeInput.placeholder = 'Enter room code';
    this._codeInput.maxLength = 6;
    this._codeInput.inputMode = 'numeric';
    this._codeInput.pattern = '[0-9]*';
    this._codeInput.addEventListener('input', () => {
      this._codeInput.value = this._codeInput.value.replace(/\D/g, '');
      this._clearError();
    });
    step.appendChild(this._codeInput);

    // Initials input
    const initialsLabel = document.createElement('label');
    initialsLabel.className = 'join-dialog-label';
    initialsLabel.textContent = 'Your Initials (3 letters)';
    step.appendChild(initialsLabel);

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
      this._initialsInput.value = this._initialsInput.value.replace(/[^a-zA-Z]/g, '').toUpperCase();
      this._clearError();
    });
    step.appendChild(this._initialsInput);

    // Error message area
    this._errorEl = document.createElement('div');
    this._errorEl.className = 'join-dialog-error';
    step.appendChild(this._errorEl);

    // Buttons
    const btnRow = document.createElement('div');
    btnRow.className = 'join-dialog-buttons';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'broadcast-btn broadcast-btn-cancel';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => this._dismiss(null));

    this._nextBtn = document.createElement('button');
    this._nextBtn.className = 'broadcast-btn broadcast-btn-go';
    this._nextBtn.textContent = 'Next';
    this._nextBtn.addEventListener('click', () => this._handleStep1Next());

    btnRow.appendChild(cancelBtn);
    btnRow.appendChild(this._nextBtn);
    step.appendChild(btnRow);

    // Allow Enter key to submit
    step.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this._handleStep1Next();
    });

    this._card.appendChild(step);
  }

  // --- Step 2: Pick Your Animal ---
  _buildStep2() {
    const step = document.createElement('div');
    step.className = 'join-dialog-step';
    step.id = 'join-step2';

    const title = document.createElement('h2');
    title.className = 'join-dialog-title';
    title.textContent = 'Pick Your Animal';
    step.appendChild(title);

    const grid = document.createElement('div');
    grid.className = 'animal-choice-grid';

    for (const animal of ANIMALS) {
      const btn = document.createElement('div');
      btn.className = 'animal-choice-btn';
      btn.dataset.animal = animal.type;

      const canvas = document.createElement('canvas');
      canvas.width = 60;
      canvas.height = 60;
      btn.appendChild(canvas);

      setTimeout(() => {
        try {
          const ctx = canvas.getContext('2d');
          drawAnimalCharacter(ctx, 30, 55, '#5a9be6', '', 0.8, null, animal.type, false);
        } catch (e) { /* sprites may not be ready */ }
      }, 0);

      const label = document.createElement('div');
      label.className = 'animal-choice-label';
      label.textContent = t(animal.key) || animal.type.charAt(0).toUpperCase() + animal.type.slice(1);
      btn.appendChild(label);

      btn.addEventListener('click', () => {
        grid.querySelectorAll('.animal-choice-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        this._selectedAnimal = animal.type;
        this._showStep('step3');
        this._updateColorPreviews();
      });

      grid.appendChild(btn);
    }
    step.appendChild(grid);

    // Back button
    const backBtn = document.createElement('button');
    backBtn.className = 'elementary-secondary-btn';
    backBtn.style.marginTop = '12px';
    backBtn.textContent = 'Back';
    backBtn.addEventListener('click', () => this._showStep('step1'));
    step.appendChild(backBtn);

    this._card.appendChild(step);
  }

  // --- Step 3: Pick Your Color ---
  _buildStep3() {
    const step = document.createElement('div');
    step.className = 'join-dialog-step';
    step.id = 'join-step3';

    const title = document.createElement('h2');
    title.className = 'join-dialog-title';
    title.textContent = 'Pick Your Color';
    step.appendChild(title);

    const colorGrid = document.createElement('div');
    colorGrid.className = 'color-choice-grid';

    for (const color of COLORS) {
      const btn = document.createElement('div');
      btn.className = 'color-choice-btn';
      btn.style.background = color;
      btn.dataset.color = color;

      btn.addEventListener('click', () => {
        colorGrid.querySelectorAll('.color-choice-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        this._selectedColor = color;
        this._goBtn.disabled = false;
        this._drawPreview();
      });

      colorGrid.appendChild(btn);
    }
    step.appendChild(colorGrid);

    // Animal preview with selected color
    const previewCanvas = document.createElement('canvas');
    previewCanvas.width = 120;
    previewCanvas.height = 100;
    previewCanvas.style.cssText = 'display:block; margin: 16px auto;';
    this._previewCanvas = previewCanvas;
    step.appendChild(previewCanvas);

    // "Let's Go!" button
    this._goBtn = document.createElement('button');
    this._goBtn.className = 'elementary-start-btn';
    this._goBtn.textContent = "Let's Go!";
    this._goBtn.disabled = true;
    this._goBtn.addEventListener('click', () => this._handleFinalJoin());
    step.appendChild(this._goBtn);

    // Back button
    const backBtn = document.createElement('button');
    backBtn.className = 'elementary-secondary-btn';
    backBtn.style.marginTop = '12px';
    backBtn.textContent = 'Back';
    backBtn.addEventListener('click', () => this._showStep('step2'));
    step.appendChild(backBtn);

    this._card.appendChild(step);
  }

  _showStep(stepId) {
    const steps = this._card.querySelectorAll('.join-dialog-step');
    for (const s of steps) {
      s.style.display = s.id === `join-${stepId}` ? 'block' : 'none';
    }
  }

  async _handleStep1Next() {
    const code = this._codeInput.value.trim();
    const initials = this._initialsInput.value.trim().toUpperCase();

    if (!code || code.length < 4) {
      this._showError('Enter a 4-digit room code.');
      return;
    }

    if (!initials || initials.length !== 3) {
      this._showError('Enter exactly 3 letters for your initials.');
      return;
    }

    if (ProfanityFilter.isBlocked(initials)) {
      this._showError('Those initials are not allowed. Try different ones.');
      return;
    }

    this._nextBtn.disabled = true;
    this._nextBtn.textContent = 'Connecting...';

    try {
      const challengeData = await this.roomManager.getChallenge(code);
      if (!challengeData) {
        this._showError('Room not found. Check the code and try again.');
        this._nextBtn.disabled = false;
        this._nextBtn.textContent = 'Next';
        return;
      }

      const settings = await this.roomManager.getSettings(code);

      this._roomCode = code;
      this._initials = initials;
      this._challengeData = challengeData;
      this._settings = settings || { allowNewPanels: false };

      // If elementary edition, show animal/color picker
      const edition = challengeData.seed?.edition;
      if (edition === 'elementary') {
        this._nextBtn.disabled = false;
        this._nextBtn.textContent = 'Next';
        this._showStep('step2');
      } else {
        // Non-elementary: skip to join immediately
        this._dismiss({
          roomCode: code,
          initials,
          challengeData,
          settings: this._settings,
        });
      }

    } catch (err) {
      console.error('Join error:', err);
      this._showError('Connection error. Check your internet and try again.');
      this._nextBtn.disabled = false;
      this._nextBtn.textContent = 'Next';
    }
  }

  _handleFinalJoin() {
    this._dismiss({
      roomCode: this._roomCode,
      initials: this._initials,
      challengeData: this._challengeData,
      settings: this._settings,
      animalType: this._selectedAnimal,
      color: this._selectedColor,
    });
  }

  _updateColorPreviews() {
    // Redraw color swatch buttons with the selected animal if desired
    // For now just clear preview
    if (this._previewCanvas) {
      const ctx = this._previewCanvas.getContext('2d');
      ctx.clearRect(0, 0, 120, 100);
    }
    this._selectedColor = null;
    this._goBtn.disabled = true;
    // Deselect any previously selected color
    const colorBtns = this._card.querySelectorAll('#join-step3 .color-choice-btn');
    for (const b of colorBtns) b.classList.remove('selected');
  }

  _drawPreview() {
    if (!this._previewCanvas || !this._selectedAnimal || !this._selectedColor) return;
    const ctx = this._previewCanvas.getContext('2d');
    ctx.clearRect(0, 0, 120, 100);
    try {
      drawAnimalCharacter(ctx, 60, 90, this._selectedColor, '', 1.2, null, this._selectedAnimal, false);
    } catch (e) { /* ok */ }
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
