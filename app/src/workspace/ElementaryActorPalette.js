import { drawAnimalCharacter } from '../animation/AnimalSprites.js';
import { Actor } from '../model/Actor.js';
import { PiecewiseLinearFunction } from '../model/PiecewiseLinearFunction.js';
import { t } from '../i18n/strings.js';

const COLORS = [
  '#e74c3c', '#3498db', '#2ecc71', '#9b59b6',
  '#e67e22', '#1abc9c', '#f39c12', '#e84393',
];

const ANIMAL_TYPES = [
  'puppy', 'kitten', 'bunny', 'duck', 'penguin',
  'elephant', 'horse', 'cow', 'frog', 'bear',
];

/**
 * Simplified actor palette for elementary edition.
 * Shows animal icon + name chip for each actor, plus a "+" button
 * to add additional characters.
 */
export class ElementaryActorPalette {
  constructor(containerEl, sim, bus) {
    this.el = containerEl;
    this.sim = sim;
    this.bus = bus;
    this._popup = null;

    bus.on('actors:changed', () => this.render());
    this.render();
  }

  render() {
    this.el.innerHTML = '';

    for (const actor of this.sim.actors) {
      const chip = document.createElement('span');
      chip.className = 'elementary-actor-chip';
      chip.style.background = actor.color;

      // Small canvas preview of the animal
      if (actor.animalType) {
        const canvas = document.createElement('canvas');
        canvas.width = 24;
        canvas.height = 24;
        const ctx = canvas.getContext('2d');
        try {
          drawAnimalCharacter(ctx, 12, 22, actor.color, '', 0.35, null, actor.animalType, false);
        } catch (e) {
          // AnimalSprites may not be loaded yet
        }
        chip.appendChild(canvas);
      }

      const nameSpan = document.createElement('span');
      nameSpan.textContent = actor.name;
      chip.appendChild(nameSpan);

      // Double-click to rename
      chip.addEventListener('dblclick', () => {
        const newName = prompt('Rename:', actor.name);
        if (newName && newName.trim()) {
          actor.name = newName.trim();
          this.bus.emit('actors:changed');
        }
      });

      // Right-click to cycle color
      chip.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const idx = COLORS.indexOf(actor.color);
        actor.color = COLORS[(idx + 1) % COLORS.length];
        this.bus.emit('actors:changed');
      });

      // Close button
      const closeBtn = document.createElement('span');
      closeBtn.textContent = '×';
      closeBtn.style.cssText = 'cursor:pointer; margin-left:4px; font-size:16px; opacity:0.7;';
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.sim.removeActor(actor.id);
        this.bus.emit('actor:removed', { actorId: actor.id });
        this.bus.emit('actors:changed');
      });
      chip.appendChild(closeBtn);

      this.el.appendChild(chip);
    }

    // "+" button to add another actor
    const addBtn = document.createElement('span');
    addBtn.className = 'elementary-actor-chip elementary-add-actor-btn';
    addBtn.textContent = '+';
    addBtn.title = t('addAnother');
    addBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this._showAddPopup(addBtn);
    });
    this.el.appendChild(addBtn);
  }

  _showAddPopup(anchorEl) {
    // Close any existing popup
    if (this._popup) {
      this._popup.remove();
      this._popup = null;
      return;
    }

    const popup = document.createElement('div');
    popup.className = 'add-actor-popup';

    // --- Title ---
    const title = document.createElement('div');
    title.style.cssText = 'font-weight:bold; font-size:14px; margin-bottom:8px; text-align:center;';
    title.textContent = t('addAnAnimal');
    popup.appendChild(title);

    // --- State ---
    let selectedAnimal = null;
    const usedColors = this.sim.actors.map(a => a.color);
    let selectedColor = COLORS.find(c => !usedColors.includes(c)) || COLORS[0];

    // --- Animal grid ---
    const animalGrid = document.createElement('div');
    animalGrid.style.cssText = 'display:grid; grid-template-columns:repeat(5,1fr); gap:4px; margin-bottom:8px;';

    for (const animalType of ANIMAL_TYPES) {
      const btn = document.createElement('div');
      btn.style.cssText = 'width:44px; height:52px; display:flex; flex-direction:column; align-items:center; justify-content:center; cursor:pointer; border:2px solid transparent; border-radius:8px; background:rgba(0,0,0,0.03);';

      const canvas = document.createElement('canvas');
      canvas.width = 36;
      canvas.height = 36;
      canvas.style.cssText = 'width:36px; height:36px;';
      btn.appendChild(canvas);

      setTimeout(() => {
        try {
          const ctx = canvas.getContext('2d');
          drawAnimalCharacter(ctx, 18, 33, selectedColor, '', 0.5, null, animalType, false);
        } catch (e) { /* not ready */ }
      }, 0);

      const label = document.createElement('div');
      label.style.cssText = 'font-size:9px; text-align:center; line-height:1;';
      label.textContent = t(animalType);
      btn.appendChild(label);

      btn.addEventListener('click', () => {
        selectedAnimal = animalType;
        animalGrid.querySelectorAll('div').forEach(d => {
          if (d.parentElement === animalGrid) d.style.borderColor = 'transparent';
        });
        btn.style.borderColor = '#4a90d9';
        updatePreview();
        addBtnEl.disabled = false;
      });

      animalGrid.appendChild(btn);
    }
    popup.appendChild(animalGrid);

    // --- Color swatches ---
    const colorRow = document.createElement('div');
    colorRow.style.cssText = 'display:flex; gap:4px; justify-content:center; margin-bottom:8px;';

    for (const color of COLORS) {
      const swatch = document.createElement('div');
      swatch.style.cssText = `width:22px; height:22px; border-radius:50%; background:${color}; cursor:pointer; border:2px solid ${color === selectedColor ? '#333' : 'transparent'};`;
      swatch.addEventListener('click', () => {
        selectedColor = color;
        colorRow.querySelectorAll('div').forEach(d => d.style.borderColor = 'transparent');
        swatch.style.borderColor = '#333';
        // Redraw animal canvases with new color
        animalGrid.querySelectorAll('canvas').forEach((c, i) => {
          const ctx = c.getContext('2d');
          ctx.clearRect(0, 0, 36, 36);
          try {
            drawAnimalCharacter(ctx, 18, 33, selectedColor, '', 0.5, null, ANIMAL_TYPES[i], false);
          } catch (e) { /* */ }
        });
        updatePreview();
      });
      colorRow.appendChild(swatch);
    }
    popup.appendChild(colorRow);

    // --- Preview ---
    const previewCanvas = document.createElement('canvas');
    previewCanvas.width = 60;
    previewCanvas.height = 60;
    previewCanvas.style.cssText = 'display:block; margin:0 auto 8px;';
    popup.appendChild(previewCanvas);

    const updatePreview = () => {
      const ctx = previewCanvas.getContext('2d');
      ctx.clearRect(0, 0, 60, 60);
      if (selectedAnimal) {
        try {
          drawAnimalCharacter(ctx, 30, 55, selectedColor, '', 0.8, null, selectedAnimal, false);
        } catch (e) { /* */ }
      }
    };

    // --- Add button ---
    const addBtnEl = document.createElement('button');
    addBtnEl.textContent = t('addBtn');
    addBtnEl.disabled = true;
    addBtnEl.style.cssText = 'display:block; margin:0 auto; padding:6px 24px; background:#4a90d9; color:#fff; border:none; border-radius:8px; font-weight:bold; font-size:13px; cursor:pointer;';
    addBtnEl.addEventListener('click', () => {
      if (!selectedAnimal) return;

      const id = 'actor-' + Date.now();
      const name = t(selectedAnimal);
      const actor = new Actor({
        id,
        name,
        color: selectedColor,
        positionFunction: new PiecewiseLinearFunction([{ t: 0, v: 0 }]),
        animalType: selectedAnimal,
      });

      this.sim.addActor(actor);
      this._closePopup();
      this.bus.emit('actors:changed');
    });
    popup.appendChild(addBtnEl);

    // Position popup below the palette bar
    document.body.appendChild(popup);
    this._popup = popup;

    // Close on click outside
    const closeOnOutside = (e) => {
      if (!popup.contains(e.target) && e.target !== anchorEl) {
        this._closePopup();
        document.removeEventListener('mousedown', closeOnOutside);
      }
    };
    setTimeout(() => document.addEventListener('mousedown', closeOnOutside), 0);
  }

  _closePopup() {
    if (this._popup) {
      this._popup.remove();
      this._popup = null;
    }
  }
}
