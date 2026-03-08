import { PiecewiseLinearFunction } from '../model/PiecewiseLinearFunction.js';
import { Actor } from '../model/Actor.js';

/**
 * Extended color palette for distinguishing up to 30+ students.
 */
const STUDENT_COLORS = [
  '#e74c3c', '#3498db', '#2ecc71', '#9b59b6', '#e67e22', '#1abc9c',
  '#f39c12', '#e84393', '#00b894', '#6c5ce7', '#fd79a8', '#00cec9',
  '#fab1a0', '#74b9ff', '#a29bfe', '#ff7675', '#55efc4', '#81ecec',
  '#ffeaa7', '#dfe6e9', '#b2bec3', '#636e72', '#fdcb6e', '#e17055',
  '#d63031', '#0984e3', '#6ab04c', '#eb4d4b', '#7ed6df', '#f9ca24',
];

/**
 * Parses Firebase submissions into structured student data with Actor objects.
 */
export class ResultsManager {
  constructor(simulation, bus) {
    this.sim = simulation;
    this.bus = bus;
  }

  /**
   * Parse raw Firebase submissions into student objects.
   * @param {object} submissions - { studentId: { initials, data, timestamp, version } }
   * @returns {{ students: Array<{ id, initials, color, actors: Actor[], visible: boolean }> }}
   */
  parseSubmissions(submissions) {
    if (!submissions) return { students: [] };

    const entries = Object.entries(submissions);
    const students = entries.map(([studentId, sub], idx) => {
      const color = STUDENT_COLORS[idx % STUDENT_COLORS.length];
      const initials = sub.initials || '???';

      // Reconstruct actors from submission data
      const actors = (sub.data?.actors || []).map((actorData, actorIdx) => {
        const points = (actorData.positionPoints || []).map(p => ({ t: p.t, v: p.v }));
        const accels = actorData.accelerations || new Array(Math.max(0, points.length - 1)).fill(0);
        const plf = new PiecewiseLinearFunction(points, accels);

        return new Actor({
          id: `${studentId}-actor-${actorIdx}`,
          name: initials,
          color: color,
          positionFunction: plf,
        });
      });

      return {
        id: studentId,
        initials,
        color,
        actors,
        visible: true,
      };
    });

    return { students };
  }
}
