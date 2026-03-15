import { GraphRenderer } from '../graph/GraphRenderer.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Renders all student traces overlaid on a single graph.
 * Supports position and velocity graph types.
 */
export class OverlaidGraphView {
  constructor(container, simulation, students, graphType) {
    this.sim = simulation;
    this.students = students;
    this.graphType = graphType; // 'position' or 'velocity'
    this.visibleIds = new Set(students.map(s => s.id));

    const isElementaryVT = simulation.edition === 'elementary' && graphType === 'velocity';
    const config = graphType === 'position'
      ? { xRange: { ...simulation.timeRange }, yRange: { ...simulation.posRange }, xLabel: 'Time (s)', yLabel: 'Position (m)' }
      : { xRange: { ...simulation.timeRange }, yRange: { ...simulation.velRange }, xLabel: 'Time (s)', yLabel: 'Velocity (m/s)',
          ...(isElementaryVT ? { squareUnits: true } : {}) };

    this.renderer = new GraphRenderer(container, config);
    if (isElementaryVT) {
      this.renderer.xTickStep = 1;
      this.renderer.yTickStep = 1;
      this.renderer.refresh();
    }
    this.redraw();
  }

  setVisibleStudents(visibleIds) {
    this.visibleIds = new Set(visibleIds);
    this.redraw();
  }

  redraw() {
    this.renderer.clearData();
    const group = this.renderer.dataGroup;

    // Draw target segments behind student traces
    if (this.graphType === 'position') {
      this._drawTargetSegments(group);
    }

    for (const student of this.students) {
      const isVisible = this.visibleIds.has(student.id);

      for (const actor of student.actors) {
        const actorGroup = document.createElementNS(SVG_NS, 'g');
        actorGroup.setAttribute('class', 'student-trace');
        actorGroup.setAttribute('data-student-id', student.id);
        if (!isVisible) {
          actorGroup.setAttribute('opacity', '0.1');
        }

        if (this.graphType === 'position') {
          this._drawPositionTrace(actorGroup, actor, student.color);
        } else {
          this._drawVelocityTrace(actorGroup, actor, student.color);
        }

        // Add initials label at the end of the trace
        this._drawInitialsLabel(actorGroup, actor, student);

        group.appendChild(actorGroup);
      }
    }
  }

  _drawPositionTrace(group, actor, color) {
    const pts = actor.positionFn.points;
    if (pts.length < 2) return;

    for (let i = 0; i < pts.length - 1; i++) {
      const a = actor.positionFn.getSegmentAcceleration(i);

      if (Math.abs(a) < 0.0001) {
        const s0 = this.renderer.toScreen(pts[i].t, pts[i].v);
        const s1 = this.renderer.toScreen(pts[i + 1].t, pts[i + 1].v);
        const line = this.renderer.makeLine(s0.x, s0.y, s1.x, s1.y, 'function-line');
        line.setAttribute('stroke', color);
        line.setAttribute('stroke-width', '2');
        group.appendChild(line);
      } else {
        const tStart = pts[i].t;
        const tEnd = pts[i + 1].t;
        const dt = tEnd - tStart;
        const { vStart } = actor.positionFn.getSegmentVelocities(i);
        const pStart = pts[i].v;
        const screenPoints = [];

        for (let s = 0; s <= 24; s++) {
          const frac = s / 24;
          const elapsed = frac * dt;
          const t = tStart + elapsed;
          const p = pStart + vStart * elapsed + 0.5 * a * elapsed * elapsed;
          const screen = this.renderer.toScreen(t, p);
          screenPoints.push(`${screen.x},${screen.y}`);
        }

        const curve = this.renderer.makePolyline(screenPoints.join(' '), 'function-line');
        curve.setAttribute('stroke', color);
        curve.setAttribute('stroke-width', '2');
        group.appendChild(curve);
      }
    }
  }

  _drawVelocityTrace(group, actor, color) {
    // Elementary edition: draw unifix blocks instead of lines
    if (this.sim.edition === 'elementary') {
      this._drawVelocityBlocks(group, actor, color);
      return;
    }

    const pts = actor.positionFn.points;
    if (pts.length < 2) return;

    // Compute velocity segments
    for (let i = 0; i < pts.length - 1; i++) {
      const { vStart, vEnd } = actor.positionFn.getSegmentVelocities(i);
      const tStart = pts[i].t;
      const tEnd = pts[i + 1].t;
      const s0 = this.renderer.toScreen(tStart, vStart);
      const s1 = this.renderer.toScreen(tEnd, vEnd);
      const line = this.renderer.makeLine(s0.x, s0.y, s1.x, s1.y, 'function-line');
      line.setAttribute('stroke', color);
      line.setAttribute('stroke-width', '2');
      group.appendChild(line);
    }
  }

  _drawVelocityBlocks(group, actor, color) {
    const pts = actor.positionFn.points;
    if (pts.length < 2) return;

    const tMin = Math.floor(pts[0].t);
    const tMax = Math.ceil(pts[pts.length - 1].t);

    for (let col = tMin; col < tMax; col++) {
      const vel = this._getColumnVelocity(actor.positionFn, col);
      if (vel === 0) continue;

      const count = Math.abs(vel);
      const sign = vel > 0 ? 1 : -1;

      for (let i = 1; i <= count; i++) {
        const row = i * sign;
        const yTop = row > 0 ? row : row + 1;
        const yBottom = row > 0 ? row - 1 : row;

        const topLeft = this.renderer.toScreen(col, yTop);
        const bottomRight = this.renderer.toScreen(col + 1, yBottom);

        const gap = 1;
        const x = topLeft.x + gap;
        const y = topLeft.y + gap;
        const w = Math.max(0, bottomRight.x - topLeft.x - gap * 2);
        const h = Math.max(0, bottomRight.y - topLeft.y - gap * 2);

        const rect = this.renderer.makeRect(x, y, w, h, 'unifix-block-fill');
        rect.setAttribute('fill', color);
        rect.setAttribute('opacity', '0.7');
        group.appendChild(rect);
      }
    }
  }

  _getColumnVelocity(plf, t) {
    const pts = plf.points;
    for (let i = 0; i < pts.length - 1; i++) {
      const tStart = pts[i].t;
      const tEnd = pts[i + 1].t;
      if (t >= tStart && t + 1 <= tEnd + 0.001) {
        const dt = tEnd - tStart;
        if (dt === 0) return 0;
        return Math.round((pts[i + 1].v - pts[i].v) / dt);
      }
    }
    return 0;
  }

  _drawInitialsLabel(group, actor, student) {
    const pts = actor.positionFn.points;
    if (pts.length < 1) return;

    const lastPt = pts[pts.length - 1];
    let yVal;
    if (this.graphType === 'position') {
      yVal = lastPt.v;
    } else {
      // Use velocity at last point
      if (pts.length >= 2) {
        const { vEnd } = actor.positionFn.getSegmentVelocities(pts.length - 2);
        yVal = vEnd;
      } else {
        yVal = 0;
      }
    }

    const screen = this.renderer.toScreen(lastPt.t, yVal);
    const text = document.createElementNS(SVG_NS, 'text');
    text.setAttribute('x', screen.x + 4);
    text.setAttribute('y', screen.y - 4);
    text.setAttribute('font-size', '9');
    text.setAttribute('font-weight', '600');
    text.setAttribute('fill', student.color);
    text.setAttribute('font-family', 'sans-serif');
    text.textContent = student.initials;
    group.appendChild(text);
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
      line.setAttribute('stroke-width', '3');
      line.setAttribute('stroke-linecap', 'round');
      line.setAttribute('opacity', '0.7');
      line.setAttribute('class', 'target-segment-line');
      targetGroup.appendChild(line);

      for (const pt of [s0, s1]) {
        const dot = document.createElementNS(SVG_NS, 'circle');
        dot.setAttribute('cx', pt.x);
        dot.setAttribute('cy', pt.y);
        dot.setAttribute('r', '3.5');
        dot.setAttribute('fill', '#ff9f43');
        dot.setAttribute('stroke', '#fff');
        dot.setAttribute('stroke-width', '1');
        dot.setAttribute('class', 'target-segment-dot');
        targetGroup.appendChild(dot);
      }
    }

    group.appendChild(targetGroup);
  }

  drawTimeCursor(t) {
    this.renderer.drawTimeCursor(t);
  }

  refresh() {
    this.renderer.refresh();
    this.redraw();
  }
}
