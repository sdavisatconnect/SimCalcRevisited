/**
 * Handles serializing and posting student solutions to Firebase.
 */
export class StudentSubmitter {
  constructor(firebaseClient, roomCode, studentId, initials) {
    this.fb = firebaseClient;
    this.roomCode = roomCode;
    this.studentId = studentId;
    this.initials = initials;
    this.version = 0;
    this.hasSubmitted = false;
  }

  /**
   * Serialize actor data and submit to Firebase.
   * Only sends actor motion data (not full workspace template).
   * @param {Simulation} simulation
   */
  async submit(simulation) {
    this.version++;

    const submissionData = {
      initials: this.initials,
      data: {
        actors: simulation.actors.map(actor => ({
          id: actor.id,
          name: this.initials,
          color: actor.color,
          positionPoints: actor.positionFn.points.map(p => ({ t: p.t, v: p.v })),
          accelerations: actor.positionFn.accelerations || [],
        })),
      },
      timestamp: { '.sv': 'timestamp' },
      version: this.version,
    };

    await this.fb.put(
      `rooms/${this.roomCode}/submissions/${this.studentId}`,
      submissionData
    );

    this.hasSubmitted = true;
  }
}
