import { GraphRenderer } from './GraphRenderer.js';
import { GraphScaleInteraction } from './GraphScaleInteraction.js';
import { GraphScalePopover } from './GraphScalePopover.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

export class VelocityGraph {
  constructor(container, simulation, bus, linkedActors = []) {
    this.sim = simulation;
    this.bus = bus;
    this.linkedActors = linkedActors;
    this.renderer = new GraphRenderer(container, {
      xRange: simulation.timeRange,
      yRange: simulation.velRange,
      xLabel: 'Time (s)',
      yLabel: 'Velocity (m/s)',
      yMaxTicks: 20
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

    // Check if we should show empty-graph hint
    const hasSegments = this.linkedActors.some(a => a.positionFn.points.length >= 2);
    if (this.linkedActors.length > 0 && !hasSegments) {
      this._drawHint(group, "Drag 'Add Segment' here");
    }

    for (const actor of this.linkedActors) {
      const actorGroup = document.createElementNS(SVG_NS, 'g');
      actorGroup.setAttribute('class', 'actor-data');
      actorGroup.setAttribute('data-actor-id', actor.id);
      const isReadOnly = actor.readOnly;

      const pts = actor.positionFn.points;
      const numSegs = pts.length - 1;

      for (let i = 0; i < numSegs; i++) {
        const tStart = pts[i].t;
        const tEnd = pts[i + 1].t;
        const { vStart, vEnd } = actor.positionFn.getSegmentVelocities(i);
        const vAvg = (vStart + vEnd) / 2;

        const screenStart = this.renderer.toScreen(tStart, vStart);
        const screenEnd = this.renderer.toScreen(tEnd, vEnd);

        // Shaded area (trapezoid/polygon from zero line to velocity line)
        const zeroStart = this.renderer.toScreen(tStart, 0);
        const zeroEnd = this.renderer.toScreen(tEnd, 0);
        const areaPath = `M ${zeroStart.x},${zeroStart.y} L ${screenStart.x},${screenStart.y} L ${screenEnd.x},${screenEnd.y} L ${zeroEnd.x},${zeroEnd.y} Z`;
        const area = this.renderer.makePath(areaPath, 'velocity-area');
        area.setAttribute('fill', actor.color);
        if (isReadOnly) area.setAttribute('opacity', '0.08');
        actorGroup.appendChild(area);

        // Velocity line (horizontal for constant, sloped for accelerating)
        const line = this.renderer.makeLine(
          screenStart.x, screenStart.y, screenEnd.x, screenEnd.y, 'velocity-line'
        );
        line.setAttribute('stroke', actor.color);
        if (isReadOnly) {
          line.setAttribute('stroke-dasharray', '6 4');
          line.setAttribute('opacity', '0.6');
        }
        actorGroup.appendChild(line);

        // Vertical connector to next segment (at velocity discontinuities)
        if (i < numSegs - 1) {
          const { vStart: nextVStart } = actor.positionFn.getSegmentVelocities(i + 1);
          if (Math.abs(vEnd - nextVStart) > 0.001) {
            const nextScreenStart = this.renderer.toScreen(tEnd, nextVStart);
            const connector = this.renderer.makeLine(
              screenEnd.x, screenEnd.y,
              nextScreenStart.x, nextScreenStart.y,
              'velocity-line'
            );
            connector.setAttribute('stroke', actor.color);
            connector.setAttribute('stroke-width', '1.5');
            connector.setAttribute('opacity', isReadOnly ? '0.3' : '0.5');
            if (isReadOnly) connector.setAttribute('stroke-dasharray', '4 3');
            actorGroup.appendChild(connector);
          }
        }

        // Drag handles — skip for read-only actors
        if (!isReadOnly) {
          // Drag handle at midpoint (average velocity) — for vertical value dragging
          const midT = (tStart + tEnd) / 2;
          const midScreen = this.renderer.toScreen(midT, vAvg);
          const handle = this.renderer.makeCircle(midScreen.x, midScreen.y, 6, 'control-point');
          handle.setAttribute('fill', actor.color);
          handle.setAttribute('stroke', '#fff');
          handle.setAttribute('stroke-width', '2');
          handle.setAttribute('data-actor-id', actor.id);
          handle.setAttribute('data-segment-index', i);
          handle.setAttribute('data-graph-type', 'velocity');
          actorGroup.appendChild(handle);

          // Right-edge endpoint handle (duration — horizontal drag)
          if (i < numSegs - 1 || numSegs >= 1) {
            const endpoint = this.renderer.makeCircle(screenEnd.x, screenEnd.y, 5, 'control-point vel-endpoint');
            endpoint.setAttribute('fill', '#fff');
            endpoint.setAttribute('stroke', actor.color);
            endpoint.setAttribute('stroke-width', '2');
            endpoint.setAttribute('data-actor-id', actor.id);
            endpoint.setAttribute('data-segment-index', i);
            endpoint.setAttribute('data-drag-mode', 'endpoint');
            actorGroup.appendChild(endpoint);
          }
        }
      }

      group.appendChild(actorGroup);
    }
  }

  /** Draw a hint message in the center of the graph */
  _drawHint(group, message) {
    const cx = this.renderer.plotArea.x + this.renderer.plotArea.w / 2;
    const cy = this.renderer.plotArea.y + this.renderer.plotArea.h / 2;
    const hint = document.createElementNS(SVG_NS, 'text');
    hint.setAttribute('x', cx);
    hint.setAttribute('y', cy);
    hint.setAttribute('class', 'empty-graph-hint');
    hint.textContent = message;
    group.appendChild(hint);
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
