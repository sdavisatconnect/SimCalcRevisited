/**
 * Manages session history in localStorage so teachers can re-access
 * previously broadcast challenges and their submissions.
 *
 * Each session entry: { roomCode, ownerToken, title, createdAt, lastAccessedAt }
 * Capped at 50 most recent entries.
 */
const STORAGE_KEY = 'simcalc-sessions';
const MAX_SESSIONS = 50;

export class SessionStore {

  /**
   * Get all stored sessions, sorted by lastAccessedAt descending (most recent first).
   * @returns {Array<{roomCode: string, ownerToken: string, title: string, createdAt: number, lastAccessedAt: number}>}
   */
  static getSessions() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const sessions = JSON.parse(raw);
      if (!Array.isArray(sessions)) return [];
      return sessions.sort((a, b) => (b.lastAccessedAt || 0) - (a.lastAccessedAt || 0));
    } catch (e) {
      console.warn('SessionStore: failed to read sessions', e);
      return [];
    }
  }

  /**
   * Add a new session. If a session with the same roomCode exists, it is replaced.
   * Caps total sessions at MAX_SESSIONS.
   * @param {{roomCode: string, ownerToken: string, title: string, createdAt: number}} entry
   */
  static addSession({ roomCode, ownerToken, title, createdAt }) {
    const sessions = SessionStore.getSessions();
    // Remove existing entry for this room code (if any)
    const filtered = sessions.filter(s => s.roomCode !== roomCode);
    filtered.unshift({
      roomCode,
      ownerToken,
      title: title || 'Untitled',
      createdAt: createdAt || Date.now(),
      lastAccessedAt: Date.now(),
    });
    // Cap at max
    SessionStore._save(filtered.slice(0, MAX_SESSIONS));
  }

  /**
   * Update the lastAccessedAt timestamp for a session.
   * @param {string} roomCode
   */
  static updateLastAccessed(roomCode) {
    const sessions = SessionStore.getSessions();
    const session = sessions.find(s => s.roomCode === roomCode);
    if (session) {
      session.lastAccessedAt = Date.now();
      SessionStore._save(sessions);
    }
  }

  /**
   * Remove a session from localStorage by room code.
   * @param {string} roomCode
   */
  static removeSession(roomCode) {
    const sessions = SessionStore.getSessions();
    SessionStore._save(sessions.filter(s => s.roomCode !== roomCode));
  }

  /**
   * Find a session by room code.
   * @param {string} roomCode
   * @returns {{roomCode: string, ownerToken: string, title: string, createdAt: number, lastAccessedAt: number}|null}
   */
  static getSession(roomCode) {
    return SessionStore.getSessions().find(s => s.roomCode === roomCode) || null;
  }

  /**
   * Generate a unique owner token (UUID v4).
   * Uses crypto.randomUUID() where available, falls back to Math.random.
   * @returns {string}
   */
  static generateOwnerToken() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    // Fallback: pseudo-random UUID v4
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  /** @private */
  static _save(sessions) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
    } catch (e) {
      console.warn('SessionStore: failed to save sessions', e);
    }
  }
}
