import { GraphRenderer } from './GraphRenderer.js';
import { GraphScaleInteraction } from './GraphScaleInteraction.js';
import { GraphScalePopover } from './GraphScalePopover.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

export class PositionGraph {
  constructor(container, simulation, bus, linkedActors = []) {
    this.sim = simulation;
    this.bus = bus;
    this.linkedActors = linkedActors;
    this.renderer = new GraphRenderer(container, {
      xRange: simulation.timeRange,
      yRange: simulation.posRange,
      xLabel: 'Time (s)',
      yLabel: 'Position (m)'
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
    const hasMotion = this.linkedActors.some(a => a.positionFn.points.length >= 2);
    if (this.linkedActors.length > 0 && !hasMotion) {
      this._drawHint(group, "Drag 'Add Point' here");
    }

    for (const actor of this.linkedActors) {
      const actorGroup = document.createElementNS(SVG_NS, 'g');
      actorGroup.setAttribute('class', 'actor-data');
      actorGroup.setAttribute('data-actor-id', actor.id);
      const isReadOnly = actor.readOnly;

      const pts = actor.positionFn.points;

      if (pts.length >= 2) {
        // Draw per-segment: straight lines for a=0, parabolic curves for a≠0
        for (let i = 0; i < pts.length - 1; i++) {
          const a = actor.positionFn.getSegmentAcceleration(i);

          if (Math.abs(a) < 0.0001) {
            // Linear segment — straight line
            const s0 = this.renderer.toScreen(pts[i].t, pts[i].v);
            const s1 = this.renderer.toScreen(pts[i + 1].t, pts[i + 1].v);
            const line = this.renderer.makeLine(s0.x, s0.y, s1.x, s1.y, 'function-line');
            line.setAttribute('stroke', actor.color);
            if (isReadOnly) {
              line.setAttribute('stroke-dasharray', '6 4');
              line.setAttribute('opacity', '0.6');
            }
            actorGroup.appendChild(line);
          } else {
            // Quadratic segment — sample points along the parabola
            const tStart = pts[i].t;
            const tEnd = pts[i + 1].t;
            const dt = tEnd - tStart;
            const { vStart } = actor.positionFn.getSegmentVelocities(i);
            const pStart = pts[i].v;
            const numSamples = 24;
            const screenPoints = [];

            for (let s = 0; s <= numSamples; s++) {
              const frac = s / numSamples;
              const elapsed = frac * dt;
              const t = tStart + elapsed;
              const p = pStart + vStart * elapsed + 0.5 * a * elapsed * elapsed;
              const screen = this.renderer.toScreen(t, p);
              screenPoints.push(`${screen.x},${screen.y}`);
            }

            const curve = this.renderer.makePolyline(screenPoints.join(' '), 'function-line');
            curve.setAttribute('stroke', actor.color);
            if (isReadOnly) {
              curve.setAttribute('stroke-dasharray', '6 4');
              curve.setAttribute('opacity', '0.6');
            }
            actorGroup.appendChild(curve);
          }
        }
      }

      // Draw control points — skip for read-only actors (no editing)
      if (!isReadOnly) {
        pts.forEach((p, i) => {
          const s = this.renderer.toScreen(p.t, p.v);
          const circle = this.renderer.makeCircle(s.x, s.y, 6, 'control-point');
          circle.setAttribute('fill', actor.color);
          circle.setAttribute('stroke', '#fff');
          circle.setAttribute('stroke-width', '2');
          circle.setAttribute('data-actor-id', actor.id);
          circle.setAttribute('data-point-index', i);
          actorGroup.appendChild(circle);
        });
      }

      group.appendChild(actorGroup);
    }

    // Draw target segments (orange overlays) on top
    this._drawTargetSegments(group);
  }

  _drawTargetSegments(group) {
    const segments = this.sim.targetSegments;
    if (!segments || segments.length === 0) return;

    const targetGroup = document.createElementNS(SVG_NS, 'g');
    targetGroup.setAttribute('class', 'target-segments');

    for (const seg of segments) {
      if (seg.endTime <= seg.startTime) continue;

      const s0 = this.renderer.toScreen(seg.startTime, seg.startPosition);
      const s1 = this.renderer.toScreen(seg.endTime, seg.endPosition);

      const line = document.createElementNS(SVG_NS, 'line');
      line.setAttribute('x1', s0.x);
      line.setAttribute('y1', s0.y);
      line.setAttribute('x2', s1.x);
      line.setAttribute('y2', s1.y);
      line.setAttribute('stroke', '#ff9f43');
      line.setAttribute('stroke-width', '4');
      line.setAttribute('stroke-linecap', 'round');
      line.setAttribute('opacity', '0.85');
      line.setAttribute('class', 'target-segment-line');
      targetGroup.appendChild(line);

      // Endpoint dots
      for (const pt of [s0, s1]) {
        const dot = document.createElementNS(SVG_NS, 'circle');
        dot.setAttribute('cx', pt.x);
        dot.setAttribute('cy', pt.y);
        dot.setAttribute('r', '4');
        dot.setAttribute('fill', '#ff9f43');
        dot.setAttribute('stroke', '#fff');
        dot.setAttribute('stroke-width', '1.5');
        dot.setAttribute('class', 'target-segment-dot');
        targetGroup.appendChild(dot);
      }
    }

    group.appendChild(targetGroup);
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
