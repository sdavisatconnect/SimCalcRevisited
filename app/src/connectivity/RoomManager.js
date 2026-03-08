/**
 * Manages room lifecycle: creation, code generation, submission retrieval.
 */
export class RoomManager {
  constructor(firebaseClient) {
    this.fb = firebaseClient;
  }

  /**
   * Generate a unique 4-digit room code.
   * Checks Firebase for collisions; expands to 5 then 6 digits after retries.
   * @returns {Promise<string>} the room code
   */
  async generateRoomCode() {
    let digits = 4;
    let attempts = 0;

    while (attempts < 10) {
      const min = Math.pow(10, digits - 1);
      const max = Math.pow(10, digits) - 1;
      const code = String(Math.floor(Math.random() * (max - min + 1)) + min);

      // Check if this code already exists
      const existing = await this.fb.get(`rooms/${code}`, { shallow: true });
      if (existing === null) {
        return code;
      }

      attempts++;
      // After 3 failed attempts at this digit count, try more digits
      if (attempts % 3 === 0 && digits < 6) {
        digits++;
      }
    }

    // Fallback: timestamp-based code
    return String(Date.now()).slice(-6);
  }

  /**
   * Create a room in Firebase with challenge data and settings.
   * @param {object} challengeData - serialized workspace from ChallengeSerializer
   * @param {{ allowNewPanels: boolean }} settings
   * @returns {Promise<string>} the room code
   */
  async createRoom(challengeData, settings) {
    const roomCode = await this.generateRoomCode();

    await this.fb.put(`rooms/${roomCode}`, {
      challenge: challengeData,
      settings: {
        allowNewPanels: settings.allowNewPanels || false,
      },
      createdAt: { '.sv': 'timestamp' },
    });

    return roomCode;
  }

  /**
   * Get the challenge data for a room.
   * @param {string} roomCode
   * @returns {Promise<object|null>} challenge data, or null if room not found
   */
  async getChallenge(roomCode) {
    return this.fb.get(`rooms/${roomCode}/challenge`);
  }

  /**
   * Get the settings for a room.
   * @param {string} roomCode
   * @returns {Promise<object|null>}
   */
  async getSettings(roomCode) {
    return this.fb.get(`rooms/${roomCode}/settings`);
  }

  /**
   * Get all submissions for a room.
   * @param {string} roomCode
   * @returns {Promise<object|null>} { studentId: { initials, data, timestamp, version }, ... }
   */
  async getSubmissions(roomCode) {
    return this.fb.get(`rooms/${roomCode}/submissions`);
  }

  /**
   * Get the count of submissions using Firebase shallow query.
   * @param {string} roomCode
   * @returns {Promise<number>}
   */
  async getSubmissionCount(roomCode) {
    const shallow = await this.fb.get(`rooms/${roomCode}/submissions`, { shallow: true });
    if (!shallow) return 0;
    return Object.keys(shallow).length;
  }
}
