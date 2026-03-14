import { PiecewiseLinearFunction } from '../model/PiecewiseLinearFunction.js';

/**
 * Translation layer between integer unifix-block state and PiecewiseLinearFunction.
 *
 * Each "column" at integer time t has an integer velocity v.
 * Positive v means blocks stacked from y=1 up to y=v.
 * Negative v means blocks stacked from y=-1 down to y=v.
 * Zero means no blocks (gap — velocity is 0 during that interval).
 *
 * The underlying PLF stores position, so every mutation rebuilds the
 * position function via integration of the step-velocity profile.
 */
export class UnifixBlockModel {
  /**
   * @param {import('../model/Actor.js').Actor} actor
   */
  constructor(actor) {
    this.actor = actor;
  }

  // ---- Read helpers ----

  /**
   * Return the integer velocity active during the interval [t, t+1).
   * Reads from the actor's position function by computing the slope of
   * the segment that covers integer time column t.
   */
  getBlockCount(t) {
    t = Math.round(t);
    const pts = this.actor.positionFn.points;
    if (pts.length < 2) return 0;

    // Walk segments looking for one that covers [t, t+1]
    for (let i = 0; i < pts.length - 1; i++) {
      const tStart = pts[i].t;
      const tEnd = pts[i + 1].t;
      if (t >= tStart && t + 1 <= tEnd + 0.001) {
        const dt = tEnd - tStart;
        if (dt === 0) return 0;
        const vel = (pts[i + 1].v - pts[i].v) / dt;
        return Math.round(vel);
      }
    }
    return 0;
  }

  /**
   * Return a Map<int, int> of every non-zero column (time -> velocity).
   */
  getColumns() {
    const cols = new Map();
    const range = this.getTimeRange();
    for (let t = range.min; t < range.max; t++) {
      const v = this.getBlockCount(t);
      if (v !== 0) {
        cols.set(t, v);
      }
    }
    return cols;
  }

  /**
   * Return {min, max} of active columns, or {min:0, max:10} if empty.
   */
  getTimeRange() {
    const pts = this.actor.positionFn.points;
    if (pts.length < 2) return { min: 0, max: 10 };
    const min = Math.floor(pts[0].t);
    const max = Math.ceil(pts[pts.length - 1].t);
    return { min, max: Math.max(max, min + 1) };
  }

  // ---- Mutators ----

  /**
   * Set the velocity for column [t, t+1].  0 removes the column.
   */
  setColumn(t, velocity) {
    t = Math.round(t);
    velocity = Math.round(velocity);
    this._mutateColumns((cols) => {
      if (velocity === 0) {
        cols.delete(t);
      } else {
        cols.set(t, velocity);
      }
    });
  }

  /**
   * Auto-fill blocks from y=0 to targetV (enforces stacking — no gaps).
   * targetV is rounded to the nearest integer.
   */
  addBlocksToColumn(t, targetV) {
    t = Math.round(t);
    targetV = Math.round(targetV);
    if (targetV === 0) {
      this.setColumn(t, 0);
      return;
    }
    // Stacking: column velocity is simply targetV (blocks from 0 to targetV)
    this.setColumn(t, targetV);
  }

  /**
   * Remove the block at row v and everything above (positive) or below (negative).
   * If v has the same sign as the current column velocity, this truncates to v-sign.
   * If |v| === 1, the whole column is removed.
   */
  removeFromColumn(t, fromV) {
    t = Math.round(t);
    fromV = Math.round(fromV);
    if (fromV === 0) return;

    const cols = this.getColumns();
    const current = cols.get(t);
    if (current === undefined) return;

    // Determine new height: everything below the clicked block stays
    let newV;
    if (fromV > 0) {
      newV = fromV - 1; // keep blocks 1..fromV-1
    } else {
      newV = fromV + 1; // keep blocks -1..fromV+1
    }

    this.setColumn(t, newV);
  }

  /**
   * Clear all blocks (reset to a single point at origin).
   */
  clearAll() {
    this.actor.positionFn = new PiecewiseLinearFunction(
      [{ t: 0, v: this.actor.positionFn.points[0].v }]
    );
  }

  // ---- PLF rebuild ----

  /**
   * Rebuild the actor's position function from current block state.
   * Walks columns left-to-right, accumulating position.
   * All accelerations = 0 (constant velocity per block).
   */
  rebuildPLF() {
    const cols = this.getColumns();
    if (cols.size === 0) {
      // Keep just the starting position
      const startPos = this.actor.positionFn.points[0].v;
      this.actor.positionFn = new PiecewiseLinearFunction([{ t: 0, v: startPos }]);
      return;
    }

    const times = Array.from(cols.keys()).sort((a, b) => a - b);
    const tMin = Math.min(0, times[0]);
    const tMax = times[times.length - 1] + 1;

    const startPos = this.actor.positionFn.points[0].v;
    const points = [{ t: tMin, v: startPos }];
    const accels = [];
    let pos = startPos;

    for (let t = tMin; t < tMax; t++) {
      const vel = cols.get(t) || 0;
      pos += vel;
      points.push({ t: t + 1, v: pos });
      accels.push(0);
    }

    this.actor.positionFn = new PiecewiseLinearFunction(points, accels);
  }

  // ---- Static utility ----

  /**
   * Round all non-integer PLF data to nearest integers.
   * Returns a new PLF (does not mutate the original).
   */
  static snapToGrid(plf) {
    const snappedPoints = plf.points.map(p => ({
      t: Math.round(p.t),
      v: Math.round(p.v)
    }));
    const snappedAccels = plf.accelerations.map(() => 0);
    return new PiecewiseLinearFunction(snappedPoints, snappedAccels);
  }

  // ---- Internal ----

  /**
   * Read current columns, apply a mutation function, then rebuild the PLF.
   */
  _mutateColumns(mutationFn) {
    // Snapshot current columns
    const cols = this.getColumns();
    mutationFn(cols);
    // Rebuild from the mutated column map
    this._rebuildFromMap(cols);
  }

  /**
   * Rebuild the PLF from a columns Map.
   */
  _rebuildFromMap(cols) {
    if (cols.size === 0) {
      const startPos = this.actor.positionFn.points[0].v;
      this.actor.positionFn = new PiecewiseLinearFunction([{ t: 0, v: startPos }]);
      return;
    }

    const times = Array.from(cols.keys()).sort((a, b) => a - b);
    const tMin = Math.min(0, times[0]);
    const tMax = times[times.length - 1] + 1;

    const startPos = this.actor.positionFn.points[0].v;
    const points = [{ t: tMin, v: startPos }];
    const accels = [];
    let pos = startPos;

    for (let t = tMin; t < tMax; t++) {
      const vel = cols.get(t) || 0;
      pos += vel;
      points.push({ t: t + 1, v: pos });
      accels.push(0);
    }

    this.actor.positionFn = new PiecewiseLinearFunction(points, accels);
  }
}
