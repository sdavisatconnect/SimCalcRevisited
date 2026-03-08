import { Panel } from './Panel.js';
import { PositionGraph } from '../graph/PositionGraph.js';
import { VelocityGraph } from '../graph/VelocityGraph.js';
import { AccelerationGraph } from '../graph/AccelerationGraph.js';
import { AnimationWorld } from '../animation/AnimationWorld.js';
import { ElevatorWorld } from '../animation/ElevatorWorld.js';
import { WorldScalePopover } from '../animation/WorldScalePopover.js';

let panelCounter = 0;

/**
 * Creates panels with the right component inside based on type.
 */
export class PanelFactory {
  constructor(simulation, bus, graphInteractionManager) {
    this.sim = simulation;
    this.bus = bus;
    this.graphInteractionManager = graphInteractionManager;
  }

  create(type, { x = 20, y = 20, width = 400, height = 300, onClose, onFocus } = {}) {
    const id = `panel-${++panelCounter}`;
    const worldTitle = this.sim.worldType === 'vertical' ? 'Elevator World' : 'Walking World';
    const titles = {
      world: worldTitle,
      position: 'Position vs Time',
      velocity: 'Velocity vs Time',
      acceleration: 'Acceleration'
    };

    const panel = new Panel({
      id,
      title: titles[type] || type,
      type,
      x, y, width, height,
      onClose,
      onFocus,
      bus: this.bus,
      simulation: this.sim
    });

    // Create the component inside the panel's content area
    let component;
    if (type === 'world') {
      const canvas = document.createElement('canvas');
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      canvas.style.display = 'block';
      panel.contentEl.appendChild(canvas);
      component = this.sim.worldType === 'vertical'
        ? new ElevatorWorld(canvas, this.sim, this.bus, [])
        : new AnimationWorld(canvas, this.sim, this.bus, []);
      component.scalePopover = new WorldScalePopover(panel.contentEl, this.sim, component);
    } else if (type === 'position') {
      component = new PositionGraph(panel.contentEl, this.sim, this.bus, []);
      if (this.graphInteractionManager) {
        this.graphInteractionManager.registerGraph(panel.id, component, 'position');
      }
    } else if (type === 'velocity') {
      component = new VelocityGraph(panel.contentEl, this.sim, this.bus, []);
      if (this.graphInteractionManager) {
        this.graphInteractionManager.registerGraph(panel.id, component, 'velocity');
      }
    } else if (type === 'acceleration') {
      component = new AccelerationGraph(panel.contentEl, this.sim, this.bus, []);
      if (this.graphInteractionManager) {
        this.graphInteractionManager.registerGraph(panel.id, component, 'acceleration');
      }
    }

    panel.component = component;
    return panel;
  }
}
