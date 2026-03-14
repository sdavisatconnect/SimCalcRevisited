import { drawAnimalCharacter } from '../animation/AnimalSprites.js';
import { SessionStore } from '../connectivity/SessionStore.js';

const ANIMALS = [
  { type: 'puppy',    label: 'Puppy' },
  { type: 'kitten',   label: 'Kitten' },
  { type: 'bunny',    label: 'Bunny' },
  { type: 'duck',     label: 'Duck' },
  { type: 'penguin',  label: 'Penguin' },
  { type: 'elephant', label: 'Elephant' },
  { type: 'horse',    label: 'Horse' },
  { type: 'cow',      label: 'Cow' },
  { type: 'frog',     label: 'Frog' },
  { type: 'bear',     label: 'Bear' },
];

const COLORS = [
  '#e74c3c', '#3498db', '#2ecc71', '#9b59b6',
  '#e67e22', '#1abc9c', '#f39c12', '#e84393',
];

/**
 * Elementary edition startup screen.
 * Step 1: Pick your world (Frolic or Sea)
 * Step 2: Pick your animal
 * Step 3: Pick your color
 * Then: "Let's Go!" button
 */
export class ElementaryWorldSelector {
  constructor(parentEl, simulation, bus) {
    this.parentEl = parentEl;
    this.sim = simulation;
    this.bus = bus;

    this.selectedWorld = null;
    this.selectedAnimal = null;
    this.selectedColor = null;

    this._build();
  }

  _build() {
    this.overlay = document.createElement('div');
    this.overlay.className = 'elementary-selector-overlay';

    const card = document.createElement('div');
    card.className = 'elementary-selector-card';

    // --- Step 1: Pick Your World ---
    const step1 = document.createElement('div');
    step1.className = 'selector-step active';
    step1.id = 'step-world';

    const title1 = document.createElement('div');
    title1.className = 'elementary-selector-title';
    title1.textContent = 'Pick Your World!';
    step1.appendChild(title1);

    const subtitle1 = document.createElement('div');
    subtitle1.className = 'elementary-selector-subtitle';
    subtitle1.textContent = 'Where should your animal play?';
    step1.appendChild(subtitle1);

    const worldRow = document.createElement('div');
    worldRow.className = 'world-choice-row';

    const frolicBtn = this._createWorldBtn('frolic', '🌳', 'Frolic World',
      'Run through fields and meadows!');
    const seaBtn = this._createWorldBtn('sea', '🌊', 'Sea World',
      'Swim up and dive deep!');

    worldRow.appendChild(frolicBtn);
    worldRow.appendChild(seaBtn);
    step1.appendChild(worldRow);

    card.appendChild(step1);

    // --- Step 2: Pick Your Animal ---
    const step2 = document.createElement('div');
    step2.className = 'selector-step';
    step2.id = 'step-animal';

    const title2 = document.createElement('div');
    title2.className = 'elementary-selector-title';
    title2.textContent = 'Pick Your Animal!';
    step2.appendChild(title2);

    const animalGrid = document.createElement('div');
    animalGrid.className = 'animal-choice-grid';

    for (const animal of ANIMALS) {
      const btn = document.createElement('div');
      btn.className = 'animal-choice-btn';
      btn.dataset.animal = animal.type;

      // Canvas preview
      const canvas = document.createElement('canvas');
      canvas.width = 60;
      canvas.height = 60;
      btn.appendChild(canvas);

      // Draw preview after a tick (so AnimalSprites is loaded)
      setTimeout(() => {
        try {
          const ctx = canvas.getContext('2d');
          drawAnimalCharacter(ctx, 30, 55, '#5a9be6', '', 0.8, null, animal.type, false);
        } catch (e) { /* sprites may not be ready */ }
      }, 0);

      const label = document.createElement('div');
      label.className = 'animal-choice-label';
      label.textContent = animal.label;
      btn.appendChild(label);

      btn.addEventListener('click', () => {
        animalGrid.querySelectorAll('.animal-choice-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        this.selectedAnimal = animal.type;
        this._showStep('step-color');
        this._updateColorPreviews();
      });

      animalGrid.appendChild(btn);
    }
    step2.appendChild(animalGrid);

    // Back button
    const back2 = document.createElement('button');
    back2.className = 'elementary-secondary-btn';
    back2.textContent = '← Back';
    back2.addEventListener('click', () => this._showStep('step-world'));
    step2.appendChild(back2);

    card.appendChild(step2);

    // --- Step 3: Pick Your Color ---
    const step3 = document.createElement('div');
    step3.className = 'selector-step';
    step3.id = 'step-color';

    const title3 = document.createElement('div');
    title3.className = 'elementary-selector-title';
    title3.textContent = 'Pick Your Color!';
    step3.appendChild(title3);

    const colorGrid = document.createElement('div');
    colorGrid.className = 'color-choice-grid';
    this._colorGrid = colorGrid;

    for (const color of COLORS) {
      const btn = document.createElement('div');
      btn.className = 'color-choice-btn';
      btn.style.background = color;
      btn.dataset.color = color;

      btn.addEventListener('click', () => {
        colorGrid.querySelectorAll('.color-choice-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        this.selectedColor = color;
        this._startBtn.disabled = false;
        this._drawPreview();
      });

      colorGrid.appendChild(btn);
    }
    step3.appendChild(colorGrid);

    // Animal preview with selected color
    const previewCanvas = document.createElement('canvas');
    previewCanvas.width = 120;
    previewCanvas.height = 100;
    previewCanvas.style.cssText = 'display:block; margin: 16px auto;';
    this._previewCanvas = previewCanvas;
    step3.appendChild(previewCanvas);

    // Start button
    const startBtn = document.createElement('button');
    startBtn.className = 'elementary-start-btn';
    startBtn.textContent = "Let's Go!";
    startBtn.disabled = true;
    startBtn.addEventListener('click', () => this._start());
    this._startBtn = startBtn;
    step3.appendChild(startBtn);

    // Back button
    const back3 = document.createElement('button');
    back3.className = 'elementary-secondary-btn';
    back3.textContent = '← Back';
    back3.style.marginTop = '12px';
    back3.addEventListener('click', () => this._showStep('step-animal'));
    step3.appendChild(back3);

    card.appendChild(step3);

    // --- Secondary actions (Join, Broadcast, Sessions) ---
    const secondaryRow = document.createElement('div');
    secondaryRow.className = 'elementary-secondary-row';

    const joinBtn = document.createElement('button');
    joinBtn.className = 'elementary-secondary-btn';
    joinBtn.textContent = '🔗 Join a Challenge';
    joinBtn.addEventListener('click', () => {
      this.dismiss();
      this.bus.emit('challenge:join-request');
    });
    secondaryRow.appendChild(joinBtn);

    const broadcastBtn = document.createElement('button');
    broadcastBtn.className = 'elementary-secondary-btn';
    broadcastBtn.textContent = '📡 Broadcast a Challenge';
    broadcastBtn.addEventListener('click', () => {
      // Start with default world/animal/color for teacher
      this.selectedWorld = this.selectedWorld || 'frolic';
      this.selectedAnimal = this.selectedAnimal || 'puppy';
      this.selectedColor = this.selectedColor || '#e74c3c';
      this._start();
    });
    secondaryRow.appendChild(broadcastBtn);

    // Sessions button (if any exist)
    const sessions = SessionStore.getSessions();
    if (sessions.length > 0) {
      const sessionsBtn = document.createElement('button');
      sessionsBtn.className = 'elementary-secondary-btn';
      sessionsBtn.textContent = '📋 My Sessions';
      sessionsBtn.addEventListener('click', () => {
        this.dismiss();
        this.bus.emit('session:reopen-request');
      });
      secondaryRow.appendChild(sessionsBtn);
    }

    card.appendChild(secondaryRow);

    this.overlay.appendChild(card);
    this.parentEl.appendChild(this.overlay);
  }

  _createWorldBtn(type, icon, label, desc) {
    const btn = document.createElement('div');
    btn.className = 'world-choice-btn';

    const iconEl = document.createElement('div');
    iconEl.className = 'world-choice-icon';
    iconEl.textContent = icon;
    btn.appendChild(iconEl);

    const labelEl = document.createElement('div');
    labelEl.className = 'world-choice-label';
    labelEl.textContent = label;
    btn.appendChild(labelEl);

    const descEl = document.createElement('div');
    descEl.className = 'world-choice-desc';
    descEl.textContent = desc;
    btn.appendChild(descEl);

    btn.addEventListener('click', () => {
      this.overlay.querySelectorAll('.world-choice-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      this.selectedWorld = type;
      this._showStep('step-animal');
    });

    return btn;
  }

  _showStep(stepId) {
    this.overlay.querySelectorAll('.selector-step').forEach(s => s.classList.remove('active'));
    const step = this.overlay.querySelector(`#${stepId}`);
    if (step) step.classList.add('active');
  }

  _updateColorPreviews() {
    // Update the color grid to show animal previews would be nice but
    // let's keep it simple — just color swatches. The preview canvas updates on color pick.
    if (this._previewCanvas && this.selectedAnimal) {
      this._drawPreview();
    }
  }

  _drawPreview() {
    const canvas = this._previewCanvas;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const color = this.selectedColor || '#5a9be6';
    try {
      drawAnimalCharacter(ctx, 60, 90, color, '', 1.2, null, this.selectedAnimal, false);
    } catch (e) { /* sprites may not be ready */ }
  }

  _start() {
    const worldType = this.selectedWorld || 'frolic';
    const animalType = this.selectedAnimal || 'puppy';
    const color = this.selectedColor || '#e74c3c';

    this.sim.worldType = worldType;
    this.dismiss();

    this.bus.emit('world:quick-start', {
      type: worldType,
      animalType,
      color,
    });
  }

  dismiss() {
    if (this.overlay && this.overlay.parentNode) {
      this.overlay.style.animation = 'fadeOut 0.3s ease';
      setTimeout(() => {
        if (this.overlay.parentNode) this.overlay.remove();
      }, 300);
    }
  }
}
