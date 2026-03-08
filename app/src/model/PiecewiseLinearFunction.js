import { clamp } from '../utils/MathUtils.js';

/**
 * A piecewise function defined by an ordered array of {t, v} control points.
 * Supports two interpolation modes per segment:
 *   - Linear (acceleration = 0): straight line between points (Phase A/B behavior)
 *   - Quadratic (acceleration ≠ 0): parabolic curve with constant acceleration
 *
 * The accelerations[] array stores one acceleration value per segment.
 * When absent or all zeros, this behaves identically to the original
 * piecewise-linear function.
 */
export class PiecewiseLinearFunction {
  constructor(points, accelerations) {
    // points: [{t: number, v: number}, ...] sorted by t
    this.points = points.map(p => ({ ...p }));
    // accelerations: one per segment (length = points.length - 1), default 0
    if (accelerations && accelerations.length > 0) {
      this.accelerations = [...accelerations];
    } else {
      this.accelerations = new Array(Math.max(0, this.points.length - 1)).fill(0);
    }
  }

  clone() {
    return new PiecewiseLinearFunction(this.points, this.accelerations);
  }

  // --- Segment velocity helpers ---

  /**
   * Compute start and end velocities for segment i.
   * For segment from (t_i, p_i) to (t_{i+1}, p_{i+1}) with acceleration a_i:
   *   v_start = (p_{i+1} - p_i) / dt  -  0.5 * a_i * dt
   *   v_end   = v_start + a_i * dt
   */
  getSegmentVelocities(i) {
    const pts = this.points;
    if (i < 0 || i >= pts.length - 1) return { vStart: 0, vEnd: 0 };
    const dt = pts[i + 1].t - pts[i].t;
    if (dt === 0) return { vStart: 0, vEnd: 0 };
    const a = this.accelerations[i] || 0;
    const vStart = (pts[i + 1].v - pts[i].v) / dt - 0.5 * a * dt;
    const vEnd = vStart + a * dt;
    return { vStart, vEnd };
  }

  /** Get acceleration for segment i */
  getSegmentAcceleration(i) {
    if (i < 0 || i >= this.accelerations.length) return 0;
    return this.accelerations[i] || 0;
  }

  /** Set acceleration for segment i (position endpoints stay fixed) */
  setSegmentAcceleration(i, a) {
    if (i < 0 || i >= this.accelerations.length) return;
    this.accelerations[i] = a;
  }

  // --- Evaluation ---

  /** Evaluate the function at a given time (supports quadratic segments) */
  evaluate(t) {
    const pts = this.points;
    if (pts.length === 0) return 0;
    if (t <= pts[0].t) return pts[0].v;
    if (t >= pts[pts.length - 1].t) return pts[pts.length - 1].v;

    // Find the segment containing t
    for (let i = 0; i < pts.length - 1; i++) {
      if (t >= pts[i].t && t <= pts[i + 1].t) {
        const dt = pts[i + 1].t - pts[i].t;
        if (dt === 0) return pts[i].v;

        const a = this.accelerations[i] || 0;
        if (a === 0) {
          // Linear interpolation (original behavior)
          const frac = (t - pts[i].t) / dt;
          return pts[i].v + frac * (pts[i + 1].v - pts[i].v);
        } else {
          // Quadratic: p(t) = p_i + v_start * elapsed + 0.5 * a * elapsed²
          const vStart = (pts[i + 1].v - pts[i].v) / dt - 0.5 * a * dt;
          const elapsed = t - pts[i].t;
          return pts[i].v + vStart * elapsed + 0.5 * a * elapsed * elapsed;
        }
      }
    }
    return pts[pts.length - 1].v;
  }

  /** Get the time of the last control point (end of defined motion) */
  getEndTime() {
    if (this.points.length === 0) return 0;
    return this.points[this.points.length - 1].t;
  }

  // --- Mutation ---

  /**
   * Append a new segment of the given duration.
   * The new point is placed at {t: lastT + duration, v: lastV + deltaV}.
   * New segment has acceleration = 0 by default.
   */
  appendSegment(duration, deltaV) {
    const last = this.points[this.points.length - 1];
    if (!last) return;
    const newT = last.t + duration;
    const newV = last.v + deltaV;
    this.points.push({ t: newT, v: newV });
    this.accelerations.push(0);
  }

  /** Insert a new control point by splitting the segment at time t.
   *  The acceleration is split: both new segments get acceleration 0
   *  (since the existing parabola through the split point is now two linear segments
   *   that pass through the same curve point).
   */
  insertPoint(t) {
    const v = this.evaluate(t);
    const pts = this.points;

    for (let i = 0; i < pts.length - 1; i++) {
      if (t > pts[i].t && t < pts[i + 1].t) {
        pts.splice(i + 1, 0, { t, v });
        // Replace one acceleration with two zeros (splitting resets acceleration)
        this.accelerations.splice(i, 1, 0, 0);
        return i + 1;
      }
    }
    return -1;
  }

  /** Remove a control point. Cannot remove the first point or the only remaining point.
   *  Last point CAN be removed (shrinks the function).
   *  When removing an interior point, the merged segment gets acceleration = 0.
   */
  removePoint(index) {
    if (this.points.length <= 1) return;       // never remove the only point
    if (index <= 0) return;                     // never remove the first point
    if (index >= this.points.length) return;    // out of bounds

    this.points.splice(index, 1);

    // Remove the acceleration entries for the affected segments
    if (index < this.accelerations.length) {
      // Removing interior point: merge two segments → remove one accel, set merged to 0
      this.accelerations.splice(index - 1, 2, 0);
    } else {
      // Removing last point: remove last acceleration
      this.accelerations.splice(index - 1, 1);
    }
  }

  /** Move a control point, keeping time ordering. Returns the actual new index.
   *  First point: time is locked (always t=0). Last point: time is draggable
   *  so users can extend/shorten the last segment.
   *  Acceleration values stay fixed — the velocities recalculate automatically.
   */
  movePoint(index, newT, newV) {
    const pts = this.points;
    if (index < 0 || index >= pts.length) return index;

    // First point: lock time at 0, only value changes
    if (index === 0) {
      pts[index].v = newV;
      return index;
    }

    // Clamp time between neighbors (don't allow reordering)
    const minT = pts[index - 1].t + 0.01;
    const maxT = index < pts.length - 1 ? pts[index + 1].t - 0.01 : Infinity;

    pts[index].t = clamp(newT, minT, maxT);
    pts[index].v = newV;

    return index;
  }

  // --- Derivative (velocity from position) ---

  /**
   * Compute the derivative (velocity from position).
   * For segments with acceleration = 0: velocity is constant (paired points with same value).
   * For segments with acceleration ≠ 0: velocity is linear (paired points with different values).
   * Returns a PLF with pairs of points per segment: (tStart, vStart), (tEnd, vEnd).
   */
  derivative() {
    const pts = this.points;
    if (pts.length < 2) {
      return new PiecewiseLinearFunction([]);
    }

    const result = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const { vStart, vEnd } = this.getSegmentVelocities(i);
      result.push({ t: pts[i].t, v: vStart });
      result.push({ t: pts[i + 1].t, v: vEnd });
    }

    return new PiecewiseLinearFunction(result);
  }

  // --- Integral (position from velocity) ---

  /**
   * Integrate a velocity function to get position.
   * Handles both constant segments (rectangular integration) and
   * linear segments (trapezoidal integration).
   * Velocity is stored as paired points: (tStart, vStart), (tEnd, vEnd).
   */
  integral(initialValue = 0) {
    const pts = this.points;
    if (pts.length < 2) {
      return new PiecewiseLinearFunction([{ t: 0, v: initialValue }]);
    }

    const resultPoints = [];
    const resultAccels = [];
    let accumulated = initialValue;

    // Process pairs of points as segments
    for (let i = 0; i < pts.length - 1; i += 2) {
      if (i + 1 >= pts.length) break;

      const tStart = pts[i].t;
      const tEnd = pts[i + 1].t;
      const vStart = pts[i].v;
      const vEnd = pts[i + 1].v;
      const dt = tEnd - tStart;

      if (resultPoints.length === 0) {
        resultPoints.push({ t: tStart, v: accumulated });
      }

      // Trapezoidal integration: area = (vStart + vEnd) / 2 * dt
      accumulated += (vStart + vEnd) / 2 * dt;
      resultPoints.push({ t: tEnd, v: accumulated });

      // Compute acceleration for this segment: a = (vEnd - vStart) / dt
      const accel = dt !== 0 ? (vEnd - vStart) / dt : 0;
      resultAccels.push(accel);
    }

    if (resultPoints.length === 0) {
      resultPoints.push({ t: 0, v: initialValue });
    }

    return new PiecewiseLinearFunction(resultPoints, resultAccels);
  }

  // --- Segment extraction ---

  /**
   * Extract velocity segments from the derivative representation.
   * Each segment has tStart, tEnd, and value (constant velocity).
   * For backward compatibility, this returns constant segments
   * (using the average velocity for segments with acceleration).
   */
  getConstantSegments() {
    const pts = this.points;
    const segments = [];

    for (let i = 0; i < pts.length - 1; i += 2) {
      if (i + 1 < pts.length) {
        segments.push({
          tStart: pts[i].t,
          tEnd: pts[i + 1].t,
          value: pts[i].v  // For constant segments, start and end are the same
        });
      }
    }

    return segments;
  }

  /**
   * Extract linear velocity segments from the derivative representation.
   * Each segment has tStart, tEnd, vStart, vEnd.
   */
  getLinearSegments() {
    const pts = this.points;
    const segments = [];

    for (let i = 0; i < pts.length - 1; i += 2) {
      if (i + 1 < pts.length) {
        segments.push({
          tStart: pts[i].t,
          tEnd: pts[i + 1].t,
          vStart: pts[i].v,
          vEnd: pts[i + 1].v
        });
      }
    }

    return segments;
  }

  /** Move only the value of a step segment (for velocity editing).
   *  Shifts both start and end velocity by the same amount,
   *  effectively changing the average velocity (position endpoint changes)
   *  while keeping the acceleration fixed.
   */
  moveSegmentValue(segmentIndex, newValue) {
    const i = segmentIndex * 2;
    if (i >= 0 && i + 1 < this.points.length) {
      // For constant segments (old behavior): both points get same value
      // For linear segments: shift both by the difference from old average
      const oldAvg = (this.points[i].v + this.points[i + 1].v) / 2;
      const delta = newValue - oldAvg;
      this.points[i].v += delta;
      this.points[i + 1].v += delta;
    }
  }
}
