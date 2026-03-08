/**
 * Generates simulated student submissions for practice/demo mode.
 * Creates varied but plausible responses based on the teacher's current
 * simulation state — no Firebase needed.
 */

// Pool of realistic 3-character initials
const INITIALS_POOL = [
  'AAB', 'BCS', 'CJR', 'DLM', 'EMW', 'FKH', 'GNP', 'HRT', 'JDS', 'KLB',
  'LMC', 'MJK', 'NRS', 'PAD', 'QWE', 'RJT', 'SAM', 'TKN', 'VLS', 'WDC',
  'AJH', 'BRK', 'CMP', 'DTS', 'ELR', 'FJW', 'GMB', 'HKS', 'JLN', 'KAP',
];

/**
 * Variation strategies applied to the teacher's actor function.
 * Each returns modified positionPoints.
 */
const STRATEGIES = [
  // Close to correct — small perturbations on position values
  {
    name: 'perturbed',
    weight: 30,
    apply(points, posRange) {
      const range = posRange.max - posRange.min;
      return points.map((p, i) => ({
        t: p.t,
        v: i === 0 ? p.v : clamp(p.v + (Math.random() - 0.5) * range * 0.3, posRange.min, posRange.max),
      }));
    },
  },
  // Scaled — multiply all positions by a factor
  {
    name: 'scaled',
    weight: 20,
    apply(points, posRange) {
      const factor = 0.5 + Math.random();  // 0.5 to 1.5
      return points.map((p, i) => ({
        t: p.t,
        v: i === 0 ? p.v : clamp(p.v * factor, posRange.min, posRange.max),
      }));
    },
  },
  // Simplified — just start, maybe a midpoint, and end
  {
    name: 'simplified',
    weight: 15,
    apply(points, posRange) {
      if (points.length <= 2) return points.map(p => ({ ...p }));
      const first = { ...points[0] };
      const last = { ...points[points.length - 1] };
      // Random end position
      last.v = clamp(last.v + (Math.random() - 0.5) * (posRange.max - posRange.min) * 0.4,
        posRange.min, posRange.max);
      if (Math.random() > 0.5) {
        // Include a midpoint
        const midT = (first.t + last.t) / 2;
        const midV = clamp((first.v + last.v) / 2 + (Math.random() - 0.5) * (posRange.max - posRange.min) * 0.3,
          posRange.min, posRange.max);
        return [first, { t: midT, v: midV }, last];
      }
      return [first, last];
    },
  },
  // Flat line — constant position (common student mistake)
  {
    name: 'flat',
    weight: 10,
    apply(points, posRange) {
      const constVal = posRange.min + Math.random() * (posRange.max - posRange.min) * 0.5;
      const first = { t: points[0].t, v: points[0].v };
      const last = { t: points[points.length - 1].t, v: constVal };
      return [first, last];
    },
  },
  // Reversed — slopes go the wrong direction
  {
    name: 'reversed',
    weight: 10,
    apply(points, posRange) {
      const maxT = points[points.length - 1].t;
      return points.map(p => ({
        t: p.t,
        v: clamp(posRange.max - p.v + posRange.min, posRange.min, posRange.max),
      }));
    },
  },
  // Overshoot — correct shape but exaggerated
  {
    name: 'overshoot',
    weight: 15,
    apply(points, posRange) {
      const factor = 1.3 + Math.random() * 0.7;  // 1.3 to 2.0
      const baseV = points[0].v;
      return points.map((p, i) => ({
        t: p.t,
        v: i === 0 ? p.v : clamp(baseV + (p.v - baseV) * factor, posRange.min, posRange.max),
      }));
    },
  },
];

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

/**
 * Pick a strategy using weighted random selection.
 */
function pickStrategy() {
  const totalWeight = STRATEGIES.reduce((sum, s) => sum + s.weight, 0);
  let r = Math.random() * totalWeight;
  for (const strategy of STRATEGIES) {
    r -= strategy.weight;
    if (r <= 0) return strategy;
  }
  return STRATEGIES[0];
}

export class PracticeDataGenerator {
  /**
   * Generate simulated student submissions.
   * @param {Simulation} simulation - current simulation with teacher's actors
   * @param {number} count - number of students to simulate (5–30)
   * @returns {object} submissions in Firebase format for ResultsManager.parseSubmissions()
   */
  static generate(simulation, count = 10) {
    const submissions = {};
    const posRange = simulation.posRange;

    // Shuffle initials pool and take what we need
    const shuffled = [...INITIALS_POOL].sort(() => Math.random() - 0.5);

    for (let i = 0; i < count; i++) {
      const initials = shuffled[i % shuffled.length];
      const studentId = `${initials}-${1000 + i}`;

      // Generate varied actors based on teacher's actors
      const actors = simulation.actors.map(actor => {
        const teacherPoints = actor.positionFn.points.map(p => ({ t: p.t, v: p.v }));
        const strategy = pickStrategy();
        const variedPoints = strategy.apply(teacherPoints, posRange);

        // Round to 1 decimal for cleaner data
        const cleanPoints = variedPoints.map(p => ({
          t: Math.round(p.t * 10) / 10,
          v: Math.round(p.v * 10) / 10,
        }));

        return {
          id: actor.id,
          name: initials,
          color: actor.color,
          positionPoints: cleanPoints,
          accelerations: new Array(Math.max(0, cleanPoints.length - 1)).fill(0),
        };
      });

      submissions[studentId] = {
        initials,
        data: { actors },
        timestamp: Date.now() - Math.floor(Math.random() * 60000), // stagger timestamps
        version: 1,
      };
    }

    return submissions;
  }
}
