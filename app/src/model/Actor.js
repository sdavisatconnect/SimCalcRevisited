import { PiecewiseLinearFunction } from './PiecewiseLinearFunction.js';

export class Actor {
  constructor({ id, name, color, positionFunction, readOnly = false }) {
    this.id = id;
    this.name = name;
    this.color = color;
    this.positionFn = positionFunction;
    /** When true, graph components render dashed lines and skip drag handles */
    this.readOnly = readOnly;
  }

  getPositionAt(t) {
    return this.positionFn.evaluate(t);
  }

  getVelocityFunction() {
    return this.positionFn.derivative();
  }

  getVelocityAt(t) {
    // Compute velocity at time t directly from position function
    const pts = this.positionFn.points;
    if (pts.length < 2) return 0;

    // Find the segment
    let segIdx = -1;
    for (let i = 0; i < pts.length - 1; i++) {
      if (t >= pts[i].t && t <= pts[i + 1].t) {
        segIdx = i;
        break;
      }
    }
    if (segIdx < 0) {
      // Before first or after last point
      return 0;
    }

    const { vStart, vEnd } = this.positionFn.getSegmentVelocities(segIdx);
    const dt = pts[segIdx + 1].t - pts[segIdx].t;
    if (dt === 0) return 0;
    const a = this.positionFn.getSegmentAcceleration(segIdx);
    const elapsed = t - pts[segIdx].t;
    return vStart + a * elapsed;
  }

  /** Get acceleration at time t */
  getAccelerationAt(t) {
    const pts = this.positionFn.points;
    if (pts.length < 2) return 0;

    for (let i = 0; i < pts.length - 1; i++) {
      if (t >= pts[i].t && t <= pts[i + 1].t) {
        return this.positionFn.getSegmentAcceleration(i);
      }
    }
    return 0;
  }

  /** Called when user edits the position graph directly */
  updatePositionPoint(index, newT, newV) {
    this.positionFn.movePoint(index, newT, newV);
  }

  /** Called when user changes acceleration on the acceleration graph.
   *  Position endpoints stay fixed; velocity adjusts automatically.
   */
  updateSegmentAcceleration(segmentIndex, newAccel) {
    this.positionFn.setSegmentAcceleration(segmentIndex, newAccel);
  }

  /** Called when user edits the velocity graph - recompute position via integration.
   *  The integral now handles both constant and linear velocity segments,
   *  producing position functions with appropriate accelerations.
   */
  updateFromVelocity(velocityFn) {
    const startPos = this.positionFn.points[0].v;
    this.positionFn = velocityFn.integral(startPos);
  }
}
