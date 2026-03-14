import { Panel } from './Panel.js';
import { FrolicWorld } from '../animation/FrolicWorld.js';
import { SeaWorld } from '../animation/SeaWorld.js';
import { UnifixVelocityGraph } from '../graph/UnifixVelocityGraph.js';
import { PositionGraph } from '../graph/PositionGraph.js';
import { t } from '../i18n/strings.js';

/**
 * Panel factory for the elementary edition.
 * Creates world, position (read-only), and velocity (unifix blocks) panels.
 * No acceleration panel.
 */
export class ElementaryPanelFactory {
  constructor(sim, bus, blockInteraction) {
    this.sim = sim;
    this.bus = bus;
    this.blockInteraction = blockInteraction;
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
    });

    const canvas = document.createElement('canvas');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');

    let component;

    switch (type) {
      case 'world': {
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
        panel.contentEl.appendChild(svg);
        svg.style.width = '100%';
        svg.style.height = '100%';
        component = new PositionGraph(svg, this.sim, this.bus, [], { readOnly: true });
        // Position graph is read-only in elementary — no interaction registered
        break;
      }

      case 'velocity': {
        panel.contentEl.appendChild(svg);
        svg.style.width = '100%';
        svg.style.height = '100%';
        component = new UnifixVelocityGraph(svg, this.sim, this.bus, []);
        // Register with block interaction handler
        if (this.blockInteraction) {
          this.blockInteraction.registerGraph(panel.id, svg, component);
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
