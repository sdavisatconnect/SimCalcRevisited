import { Panel } from './Panel.js';
import { FrolicWorld } from '../animation/FrolicWorld.js';
import { SeaWorld } from '../animation/SeaWorld.js';
import { UnifixVelocityGraph } from '../graph/UnifixVelocityGraph.js';
import { PositionGraph } from '../graph/PositionGraph.js';
import { GraphScalePopover } from '../graph/GraphScalePopover.js';
import { t } from '../i18n/strings.js';

/**
 * Panel factory for the elementary edition.
 * Creates world, position, and velocity (unifix blocks) panels.
 * No acceleration panel.
 *
 * @param {object} [options]
 * @param {boolean} [options.authorMode] - If true, position graph is editable
 * @param {GraphInteractionManager} [options.graphInteractionManager] - For registering editable graphs
 */
export class ElementaryPanelFactory {
  constructor(sim, bus, blockInteraction, options = {}) {
    this.sim = sim;
    this.bus = bus;
    this.blockInteraction = blockInteraction;
    this.authorMode = options.authorMode || false;
    this.graphInteractionManager = options.graphInteractionManager || null;
  }

  create(type, options = {}) {
    const panel = new Panel({
      id: `panel-${type}-${Date.now()}`,
      title: this._titleFor(type),
      type,
      x: options.x || 10,
      y: options.y || 10,
      width: options.width || 400,
      height: options.height || 300,
      onClose: options.onClose,
      onFocus: options.onFocus,
      bus: this.bus,
      simulation: this.sim,
    });

    let component;

    switch (type) {
      case 'world': {
        const canvas = document.createElement('canvas');
        panel.contentEl.appendChild(canvas);
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        if (this.sim.worldType === 'sea') {
          component = new SeaWorld(canvas, this.sim, this.bus, []);
        } else {
          component = new FrolicWorld(canvas, this.sim, this.bus, []);
        }
        break;
      }

      case 'position': {
        const posOpts = this.authorMode ? {} : { readOnly: true };
        component = new PositionGraph(panel.contentEl, this.sim, this.bus, [], posOpts);
        if (this.authorMode && this.graphInteractionManager) {
          this.graphInteractionManager.registerGraph(panel.id, component, 'position');
        }
        // Gear icon: present in author mode, hidden for students
        if (!this.authorMode && component.scalePopover) {
          component.scalePopover.gearBtn.style.display = 'none';
          component.scalePopover.lockBtn.style.display = 'none';
        }
        break;
      }

      case 'velocity': {
        component = new UnifixVelocityGraph(panel.contentEl, this.sim, this.bus, []);
        // Register with block interaction handler
        if (this.blockInteraction) {
          this.blockInteraction.registerGraph(panel.id, component.renderer.svg, component);
        }
        // Gear icon for author mode
        if (this.authorMode) {
          component.scalePopover = new GraphScalePopover(panel.contentEl, component.renderer, () => component.redraw());
        }
        break;
      }

      default:
        console.warn('ElementaryPanelFactory: unknown type', type);
        return panel;
    }

    panel.component = component;
    panel.graphType = type === 'world' ? null : type;

    return panel;
  }

  _titleFor(type) {
    switch (type) {
      case 'world': return this.sim.worldType === 'sea' ? t('panelSeaWorld') : t('panelFrolicWorld');
      case 'position': return t('positionVsTime');
      case 'velocity': return t('velocityVsTime');
      default: return type;
    }
  }
}
