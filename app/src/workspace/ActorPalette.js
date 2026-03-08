import { PiecewiseLinearFunction } from '../model/PiecewiseLinearFunction.js';
import { Actor } from '../model/Actor.js';

const COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#9b59b6', '#e67e22', '#1abc9c', '#f39c12', '#e84393'];
let actorCounter = 0;

/**
 * Actor palette: shows actor chips (draggable), add/delete actors, edit name/color.
 */
export class ActorPalette {
  constructor(containerEl, simulation, bus) {
    this.container = containerEl;
    this.sim = simulation;
    this.bus = bus;

    this._render();

    // Re-render when actors change
    bus.on('actors:changed', () => this._render());
  }

  _render() {
    this.container.innerHTML = '';

    const label = document.createElement('span');
    label.className = 'palette-label';
    label.textContent = 'Actors:';
    this.container.appendChild(label);

    for (const actor of this.sim.actors) {
      const chip = document.createElement('div');
      chip.className = 'actor-chip';
      chip.style.backgroundColor = actor.color;
      chip.draggable = true;
      chip.title = `Drag onto a panel to link ${actor.name}`;

      const nameSpan = document.createElement('span');
      nameSpan.className = 'actor-chip-name';
      nameSpan.textContent = actor.name;
      nameSpan.contentEditable = true;
      nameSpan.spellcheck = false;
      nameSpan.addEventListener('blur', () => {
        const newName = nameSpan.textContent.trim();
        if (newName && newName !== actor.name) {
          actor.name = newName;
          this.bus.emit('actors:changed');
        }
      });
      nameSpan.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); nameSpan.blur(); }
      });
      // Prevent drag when editing name
      nameSpan.addEventListener('mousedown', (e) => e.stopPropagation());
      chip.appendChild(nameSpan);

      // Color cycle on right-click
      chip.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const currentIdx = COLORS.indexOf(actor.color);
        actor.color = COLORS[(currentIdx + 1) % COLORS.length];
        this.bus.emit('actors:changed');
      });

      // Delete button
      const delBtn = document.createElement('span');
      delBtn.className = 'actor-chip-delete';
      delBtn.textContent = '\u00D7';
      delBtn.title = `Remove ${actor.name}`;
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.sim.removeActor(actor.id);
        this.bus.emit('actors:changed');
        this.bus.emit('actor:removed', { actorId: actor.id });
      });
      chip.appendChild(delBtn);

      // Drag start
      chip.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/actor-id', actor.id);
        e.dataTransfer.effectAllowed = 'link';
        chip.classList.add('chip-dragging');
      });
      chip.addEventListener('dragend', () => {
        chip.classList.remove('chip-dragging');
      });

      this.container.appendChild(chip);
    }

    // Add actor button
    const addBtn = document.createElement('button');
    addBtn.className = 'actor-add-btn';
    addBtn.textContent = '+';
    addBtn.title = 'Add a new actor';
    addBtn.addEventListener('click', () => this._addActor());
    this.container.appendChild(addBtn);
  }

  _addActor() {
    const usedColors = this.sim.actors.map(a => a.color);
    const color = COLORS.find(c => !usedColors.includes(c)) || COLORS[actorCounter % COLORS.length];
    actorCounter++;
    const id = 'actor-' + Date.now();
    const name = `Actor ${this.sim.actors.length + 1}`;
    const timeMax = this.sim.timeRange.max;

    // Single point at origin — no motion defined yet.
    // User builds motion by dragging segments onto graphs.
    const actor = new Actor({
      id,
      name,
      color,
      positionFunction: new PiecewiseLinearFunction([
        { t: 0, v: 0 }
      ])
    });

    this.sim.addActor(actor);
    this.bus.emit('actors:changed');
    this.bus.emit('actor:added', { actorId: id });
  }
}
