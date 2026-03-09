import { GraphRenderer } from './GraphRenderer.js';
import { GraphScaleInteraction } from './GraphScaleInteraction.js';
import { GraphScalePopover } from './GraphScalePopover.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Acceleration graph: shows acceleration as horizontal bars per segment (editable)
 * plus impulse arrows at velocity discontinuities (read-only).
 *
 * Each segment's acceleration is stored in actor.positionFn.accelerations[i].
 * Dragging a bar handle vertically changes the acceleration for that segment
 * while keeping position endpoints fixed.
 */
export class AccelerationGraph {
  constructor(container, simulation, bus, linkedActors = []) {
    this.sim = simulation;
    this.bus = bus;
    this.linkedActors = linkedActors;
    this.renderer = new GraphRenderer(container, {
      xRange: simulation.timeRange,
      yRange: simulation.accelRange,
      xLabel: 'Time (s)',
      yLabel: 'Accel (m/s\u00B2)'
    });

    // Scale controls
    this.scaleInteraction = new GraphScaleInteraction(this.renderer, () => this.redraw());
    this.scalePopover = new GraphScalePopover(container, this.renderer, () => this.redraw());

    this.redraw();
  }

  setLinkedActors(actors) {
    this.linkedActors = actors;
    this.redraw();
  }

  redraw() {
    this.renderer.clearData();
    const group = this.renderer.dataGroup;

    for (const actor of this.linkedActors) {
      const actorGroup = document.createElementNS(SVG_NS, 'g');
      actorGroup.setAttribute('class', 'actor-data');
      actorGroup.setAttribute('data-actor-id', actor.id);
      const isReadOnly = actor.readOnly;

      const pts = actor.positionFn.points;
      const numSegs = pts.length - 1;

      // Draw acceleration bars for each segment
      for (let i = 0; i < numSegs; i++) {
        const tStart = pts[i].t;
        const tEnd = pts[i + 1].t;
        const accel = actor.positionFn.getSegmentAcceleration(i);

        const screenStart = this.renderer.toScreen(tStart, accel);
        const screenEnd = this.renderer.toScreen(tEnd, accel);
        const zeroStart = this.renderer.toScreen(tStart, 0);
        const zeroEnd = this.renderer.toScreen(tEnd, 0);

        // Shaded area between bar and zero line
        const areaPath = `M ${zeroStart.x},${zeroStart.y} L ${screenStart.x},${screenStart.y} L ${screenEnd.x},${screenEnd.y} L ${zeroEnd.x},${zeroEnd.y} Z`;
        const area = this.renderer.makePath(areaPath, 'accel-area');
        area.setAttribute('fill', actor.color);
        area.setAttribute('opacity', isReadOnly ? '0.1' : '0.25');
        actorGroup.appendChild(area);

        // Horizontal acceleration line
        const line = this.renderer.makeLine(
          screenStart.x, screenStart.y, screenEnd.x, screenEnd.y, 'accel-line'
        );
        line.setAttribute('stroke', actor.color);
        line.setAttribute('stroke-width', '2.5');
        if (isReadOnly) {
          line.setAttribute('stroke-dasharray', '6 4');
          line.setAttribute('opacity', '0.6');
        }
        actorGroup.appendChild(line);

        // Drag handle at midpoint — skip for read-only actors
        if (!isReadOnly) {
          const midT = (tStart + tEnd) / 2;
          const midScreen = this.renderer.toScreen(midT, accel);
          const handle = this.renderer.makeCircle(midScreen.x, midScreen.y, 6, 'control-point accel-handle');
          handle.setAttribute('fill', actor.color);
          handle.setAttribute('stroke', '#fff');
          handle.setAttribute('stroke-width', '2');
          handle.setAttribute('data-actor-id', actor.id);
          handle.setAttribute('data-segment-index', i);
          handle.setAttribute('data-graph-type', 'acceleration');
          actorGroup.appendChild(handle);
        }
      }

      // Draw impulse arrows at velocity discontinuities
      for (let i = 0; i < numSegs - 1; i++) {
        const { vEnd } = actor.positionFn.getSegmentVelocities(i);
        const { vStart: nextVStart } = actor.positionFn.getSegmentVelocities(i + 1);
        const dv = nextVStart - vEnd;
        if (Math.abs(dv) < 0.001) continue;

        const t = pts[i + 1].t;
        const screenBase = this.renderer.toScreen(t, 0);
        const screenTip = this.renderer.toScreen(t, dv);

        // Impulse stem
        const stem = this.renderer.makeLine(
          screenBase.x, screenBase.y,
          screenTip.x, screenTip.y,
          'accel-impulse'
        );
        stem.setAttribute('stroke', actor.color);
        stem.setAttribute('stroke-width', '3');
        stem.setAttribute('stroke-linecap', 'round');
        stem.setAttribute('opacity', '0.6');
        actorGroup.appendChild(stem);

        // Arrowhead
        const arrowSize = 6;
        const tipX = screenTip.x;
        const tipY = screenTip.y;
        const dir = dv > 0 ? -1 : 1;
        const arrowhead = document.createElementNS(SVG_NS, 'polygon');
        arrowhead.setAttribute('points',
          `${tipX},${tipY} ${tipX - arrowSize},${tipY + dir * arrowSize * 1.5} ${tipX + arrowSize},${tipY + dir * arrowSize * 1.5}`
        );
        arrowhead.setAttribute('fill', actor.color);
        arrowhead.setAttribute('opacity', '0.6');
        actorGroup.appendChild(arrowhead);

        // Delta-v label
        const labelX = tipX + 10;
        const labelY = tipY + (dv > 0 ? -2 : 12);
        const label = this.renderer.makeText(
          labelX, labelY,
          '\u0394v=' + dv.toFixed(1),
          'accel-label'
        );
        label.setAttribute('fill', actor.color);
        label.setAttribute('font-size', '9');
        label.setAttribute('opacity', '0.7');
        actorGroup.appendChild(label);
      }

      // Dashed zero line
      const zeroLeft = this.renderer.toScreen(this.renderer.xRange.min, 0);
      const zeroRight = this.renderer.toScreen(this.renderer.xRange.max, 0);
      const zeroLine = this.renderer.makeLine(
        zeroLeft.x, zeroLeft.y, zeroRight.x, zeroRight.y, 'accel-zero'
      );
      zeroLine.setAttribute('stroke', actor.color);
      zeroLine.setAttribute('stroke-width', '1');
      zeroLine.setAttribute('opacity', '0.3');
      zeroLine.setAttribute('stroke-dasharray', '4 3');
      actorGroup.appendChild(zeroLine);

      group.appendChild(actorGroup);
    }
  }

  drawTimeCursor(t) {
    this.renderer.drawTimeCursor(t);
  }

  refresh() {
    this.renderer.refresh();
    this.redraw();
  }

  get svg() {
    return this.renderer.svg;
  }

  get graphRenderer() {
    return this.renderer;
  }
}
