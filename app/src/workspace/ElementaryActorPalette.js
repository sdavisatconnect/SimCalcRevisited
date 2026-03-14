import { drawAnimalCharacter } from '../animation/AnimalSprites.js';

const COLORS = [
  '#e74c3c', '#3498db', '#2ecc71', '#9b59b6',
  '#e67e22', '#1abc9c', '#f39c12', '#e84393',
];

/**
 * Simplified actor palette for elementary edition.
 * Shows animal icon + name chip for each actor.
 */
export class ElementaryActorPalette {
  constructor(containerEl, sim, bus) {
    this.el = containerEl;
    this.sim = sim;
    this.bus = bus;

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
  }
}
