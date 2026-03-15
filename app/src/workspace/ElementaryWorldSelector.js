import { drawAnimalCharacter } from '../animation/AnimalSprites.js';
import { SessionStore } from '../connectivity/SessionStore.js';
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
    title1.textContent = t('pickWorld');
    step1.appendChild(title1);

    const subtitle1 = document.createElement('div');
    subtitle1.className = 'elementary-selector-subtitle';
    subtitle1.textContent = t('pickWorldSub');
    step1.appendChild(subtitle1);

    const worldRow = document.createElement('div');
    worldRow.className = 'world-choice-row';

    const frolicBtn = this._createWorldBtn('frolic', '🌳', t('frolicWorld'), t('frolicDesc'));
    const seaBtn = this._createWorldBtn('sea', '🌊', t('seaWorld'), t('seaDesc'));

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
    title2.textContent = t('pickAnimal');
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
      label.textContent = t(animal.key);
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
    back2.textContent = t('back');
    back2.addEventListener('click', () => this._showStep('step-world'));
    step2.appendChild(back2);

    card.appendChild(step2);

    // --- Step 3: Pick Your Color ---
    const step3 = document.createElement('div');
    step3.className = 'selector-step';
    step3.id = 'step-color';

    const title3 = document.createElement('div');
    title3.className = 'elementary-selector-title';
    title3.textContent = t('pickColor');
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
    startBtn.textContent = t('letsGo');
    startBtn.disabled = true;
    startBtn.addEventListener('click', () => this._start());
    this._startBtn = startBtn;
    step3.appendChild(startBtn);

    // Back button
    const back3 = document.createElement('button');
    back3.className = 'elementary-secondary-btn';
    back3.textContent = t('back');
    back3.style.marginTop = '12px';
    back3.addEventListener('click', () => this._showStep('step-animal'));
    step3.appendChild(back3);

    card.appendChild(step3);

    // --- Secondary actions (Join, Broadcast, Sessions) ---
    const secondaryRow = document.createElement('div');
    secondaryRow.className = 'elementary-secondary-row';

    const joinBtn = document.createElement('button');
    joinBtn.className = 'elementary-secondary-btn';
    joinBtn.textContent = t('joinChallenge');
    joinBtn.addEventListener('click', () => {
      this.dismiss();
      this.bus.emit('challenge:join-request');
    });
    secondaryRow.appendChild(joinBtn);

    const broadcastBtn = document.createElement('button');
    broadcastBtn.className = 'elementary-secondary-btn';
    broadcastBtn.textContent = t('broadcastChallenge');
    broadcastBtn.addEventListener('click', () => {
      this.dismiss();
      this.bus.emit('challenge:author-start', {
        type: this.selectedWorld || 'frolic',
      });
    });
    secondaryRow.appendChild(broadcastBtn);

    // Sessions button (if any exist)
    const sessions = SessionStore.getSessions();
    if (sessions.length > 0) {
      const sessionsBtn = document.createElement('button');
      sessionsBtn.className = 'elementary-secondary-btn';
      sessionsBtn.textContent = t('mySessions');
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

    const canvas = document.createElement('canvas');

    if (type === 'sea') {
      // Sea World: tall skinny canvas on the left, text on the right
      btn.style.cssText = 'display:flex; flex-direction:row; align-items:center; gap:10px; text-align:left;';

      canvas.width = 50;
      canvas.height = 120;
      canvas.style.cssText = 'width:50px; height:120px; border-radius:8px; flex-shrink:0;';
      btn.appendChild(canvas);

      const textWrap = document.createElement('div');
      textWrap.style.cssText = 'display:flex; flex-direction:column; justify-content:center;';

      const labelEl = document.createElement('div');
      labelEl.className = 'world-choice-label';
      labelEl.textContent = label;
      textWrap.appendChild(labelEl);

      const descEl = document.createElement('div');
      descEl.className = 'world-choice-desc';
      descEl.textContent = desc;
      textWrap.appendChild(descEl);

      btn.appendChild(textWrap);
    } else {
      // Frolic World: wide canvas on top, text below
      canvas.width = 140;
      canvas.height = 80;
      canvas.style.cssText = 'width:140px; height:80px; border-radius:8px; display:block; margin:0 auto 6px;';
      btn.appendChild(canvas);

      const labelEl = document.createElement('div');
      labelEl.className = 'world-choice-label';
      labelEl.textContent = label;
      btn.appendChild(labelEl);

      const descEl = document.createElement('div');
      descEl.className = 'world-choice-desc';
      descEl.textContent = desc;
      btn.appendChild(descEl);
    }

    setTimeout(() => {
      const ctx = canvas.getContext('2d');
      if (type === 'frolic') this._drawFrolicPreview(ctx, canvas.width, canvas.height);
      else this._drawSeaPreview(ctx, canvas.width, canvas.height);
    }, 0);

    btn.addEventListener('click', () => {
      this.overlay.querySelectorAll('.world-choice-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      this.selectedWorld = type;
      this._showStep('step-animal');
    });

    return btn;
  }

  _drawFrolicPreview(ctx, w, h) {
    // Sky gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, h * 0.6);
    skyGrad.addColorStop(0, '#87CEEB');
    skyGrad.addColorStop(1, '#c8e6f8');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, h);

    // Rolling hills
    ctx.fillStyle = '#5aad5a';
    ctx.beginPath();
    ctx.moveTo(0, h * 0.55);
    ctx.quadraticCurveTo(w * 0.25, h * 0.42, w * 0.5, h * 0.52);
    ctx.quadraticCurveTo(w * 0.75, h * 0.62, w, h * 0.5);
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fill();

    // Grass ground
    const grassGrad = ctx.createLinearGradient(0, h * 0.65, 0, h);
    grassGrad.addColorStop(0, '#4a9e4a');
    grassGrad.addColorStop(1, '#3a8a3a');
    ctx.fillStyle = grassGrad;
    ctx.fillRect(0, h * 0.65, w, h * 0.35);

    // Path strip
    ctx.fillStyle = '#d4b896';
    ctx.fillRect(0, h * 0.72, w, h * 0.12);

    // Trees
    this._drawMiniTree(ctx, w * 0.2, h * 0.42, 8);
    this._drawMiniTree(ctx, w * 0.7, h * 0.38, 10);
    this._drawMiniTree(ctx, w * 0.45, h * 0.46, 6);

    // Flowers
    const flowerColors = ['#e74c3c', '#f39c12', '#e84393', '#3498db'];
    for (let i = 0; i < 8; i++) {
      const fx = 10 + (i * 14) % w;
      const fy = h * 0.62 + (i * 7) % 8;
      ctx.fillStyle = flowerColors[i % flowerColors.length];
      ctx.beginPath();
      ctx.arc(fx, fy, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  _drawMiniTree(ctx, x, y, size) {
    // Trunk
    ctx.fillStyle = '#8B6914';
    ctx.fillRect(x - size * 0.15, y, size * 0.3, size * 0.8);
    // Canopy
    ctx.fillStyle = '#2d7d2d';
    ctx.beginPath();
    ctx.arc(x, y - size * 0.1, size * 0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#35913a';
    ctx.beginPath();
    ctx.arc(x - size * 0.25, y + size * 0.05, size * 0.45, 0, Math.PI * 2);
    ctx.fill();
  }

  _drawSeaPreview(ctx, w, h) {
    // Sky at top (~20% for tall skinny)
    const waterLine = h * 0.2;
    const skyGrad = ctx.createLinearGradient(0, 0, 0, waterLine);
    skyGrad.addColorStop(0, '#87CEEB');
    skyGrad.addColorStop(1, '#a8d8f0');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, waterLine);

    // Water gradient (80% of height)
    const waterGrad = ctx.createLinearGradient(0, waterLine, 0, h);
    waterGrad.addColorStop(0, '#4a9be6');
    waterGrad.addColorStop(0.5, '#2a6cb8');
    waterGrad.addColorStop(1, '#1a4a80');
    ctx.fillStyle = waterGrad;
    ctx.fillRect(0, waterLine, w, h - waterLine);

    // Cloud
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath();
    ctx.ellipse(w * 0.5, h * 0.08, w * 0.3, h * 0.03, 0, 0, Math.PI * 2);
    ctx.fill();

    // Water surface wave
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, waterLine);
    for (let x = 0; x <= w; x += 3) {
      ctx.lineTo(x, waterLine + Math.sin(x * 0.15) * 2);
    }
    ctx.stroke();

    // Dock post + plank at water line
    ctx.fillStyle = '#8B6914';
    ctx.fillRect(w * 0.1, waterLine - h * 0.08, 4, h * 0.12);
    ctx.fillStyle = '#a07832';
    ctx.fillRect(0, waterLine - h * 0.08, w * 0.35, 3);

    // Depth markers (like the actual SeaWorld ruler)
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 0.5;
    for (let y = waterLine + h * 0.1; y < h - 10; y += h * 0.12) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Seaweed from bottom
    ctx.strokeStyle = '#2d8a4e';
    ctx.lineWidth = 2;
    const seaweedX = [w * 0.2, w * 0.55, w * 0.8];
    for (const sx of seaweedX) {
      ctx.beginPath();
      ctx.moveTo(sx, h);
      ctx.quadraticCurveTo(sx + 4, h * 0.85, sx - 2, h * 0.72);
      ctx.stroke();
    }

    // Fish (smaller for narrow canvas)
    this._drawMiniFish(ctx, w * 0.55, h * 0.4, '#f39c12', 0.6);
    this._drawMiniFish(ctx, w * 0.35, h * 0.58, '#e74c3c', 0.5);

    // Bubbles
    ctx.fillStyle = 'rgba(150, 220, 255, 0.4)';
    ctx.strokeStyle = 'rgba(100, 180, 240, 0.3)';
    ctx.lineWidth = 0.5;
    for (const b of [{x: w*0.4, y: h*0.35, r: 2}, {x: w*0.6, y: h*0.5, r: 1.5}, {x: w*0.3, y: h*0.65, r: 2}]) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }

  _drawMiniFish(ctx, x, y, color, scale = 1) {
    const s = scale;
    // Body
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(x, y, 8 * s, 5 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    // Tail
    ctx.beginPath();
    ctx.moveTo(x - 8 * s, y);
    ctx.lineTo(x - 14 * s, y - 4 * s);
    ctx.lineTo(x - 14 * s, y + 4 * s);
    ctx.closePath();
    ctx.fill();
    // Eye
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(x + 3 * s, y - 1 * s, 1.5 * s, 0, Math.PI * 2);
    ctx.fill();
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
