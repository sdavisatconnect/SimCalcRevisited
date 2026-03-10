import { SessionStore } from './SessionStore.js';

/**
 * Modal dialog showing recent challenge sessions from localStorage.
 * Teachers can re-open past sessions to view results, or remove entries.
 */
export class SessionHistoryDialog {
  /**
   * @param {RoomManager} roomManager
   * @param {function} onReopen - called with { roomCode, challengeData, submissions, settings } when a session is re-opened
   */
  constructor(roomManager, onReopen) {
    this.roomManager = roomManager;
    this.onReopen = onReopen;
    this.el = null;
  }

  show() {
    this._build();
  }

  _build() {
    const sessions = SessionStore.getSessions();

    this.el = document.createElement('div');
    this.el.className = 'session-history-overlay';

    const card = document.createElement('div');
    card.className = 'session-history-card';

    // Title
    const title = document.createElement('h2');
    title.className = 'session-history-title';
    title.textContent = 'My Sessions';
    card.appendChild(title);

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.className = 'about-close';
    closeBtn.textContent = '\u00D7';
    closeBtn.addEventListener('click', () => this._dismiss());
    card.appendChild(closeBtn);

    if (sessions.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'session-history-empty';
      empty.textContent = 'No saved sessions yet. Sessions are saved when you broadcast a challenge.';
      card.appendChild(empty);
    } else {
      const list = document.createElement('div');
      list.className = 'session-history-list';

      for (const session of sessions) {
        list.appendChild(this._createRow(session, list));
      }

      card.appendChild(list);
    }

    this.el.appendChild(card);
    document.body.appendChild(this.el);
    requestAnimationFrame(() => this.el.classList.add('visible'));
  }

  _createRow(session, listEl) {
    const row = document.createElement('div');
    row.className = 'session-row';

    // Room code
    const codeEl = document.createElement('div');
    codeEl.className = 'session-row-code';
    codeEl.textContent = session.roomCode;
    row.appendChild(codeEl);

    // Title
    const titleEl = document.createElement('div');
    titleEl.className = 'session-row-title';
    titleEl.textContent = session.title || 'Untitled';
    row.appendChild(titleEl);

    // Time ago
    const timeEl = document.createElement('div');
    timeEl.className = 'session-row-time';
    timeEl.textContent = this._timeAgo(session.lastAccessedAt || session.createdAt);
    row.appendChild(timeEl);

    // Submission count (loaded lazily)
    const countEl = document.createElement('div');
    countEl.className = 'session-row-count';
    countEl.textContent = '...';
    row.appendChild(countEl);
    this.roomManager.getSubmissionCount(session.roomCode)
      .then(count => {
        countEl.textContent = `${count} sub${count !== 1 ? 's' : ''}`;
      })
      .catch(() => {
        countEl.textContent = '?';
      });

    // Action buttons
    const actions = document.createElement('div');
    actions.className = 'session-row-actions';

    const reopenBtn = document.createElement('button');
    reopenBtn.className = 'session-row-btn session-row-btn-reopen';
    reopenBtn.textContent = 'Re-open';
    reopenBtn.addEventListener('click', () => this._handleReopen(session, reopenBtn));
    actions.appendChild(reopenBtn);

    const removeBtn = document.createElement('button');
    removeBtn.className = 'session-row-btn session-row-btn-remove';
    removeBtn.textContent = 'Remove';
    removeBtn.addEventListener('click', () => {
      SessionStore.removeSession(session.roomCode);
      row.remove();
      // If list is now empty, show empty message
      if (listEl.children.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'session-history-empty';
        empty.textContent = 'No saved sessions.';
        listEl.parentNode.replaceChild(empty, listEl);
      }
    });
    actions.appendChild(removeBtn);

    row.appendChild(actions);
    return row;
  }

  async _handleReopen(session, btn) {
    btn.disabled = true;
    btn.textContent = 'Loading...';

    try {
      // Verify ownership
      const metadata = await this.roomManager.getRoomMetadata(session.roomCode);
      if (!metadata) {
        btn.textContent = 'Room not found';
        return;
      }
      if (metadata.ownerToken && metadata.ownerToken !== session.ownerToken) {
        btn.textContent = 'Access denied';
        return;
      }

      // Fetch challenge and submissions
      const [challengeData, submissions, settings] = await Promise.all([
        this.roomManager.getChallenge(session.roomCode),
        this.roomManager.getSubmissions(session.roomCode),
        this.roomManager.getSettings(session.roomCode),
      ]);

      if (!challengeData) {
        btn.textContent = 'No data';
        return;
      }

      SessionStore.updateLastAccessed(session.roomCode);

      this._dismiss();
      this.onReopen({
        roomCode: session.roomCode,
        challengeData,
        submissions: submissions || {},
        settings: settings || { allowNewPanels: false },
      });
    } catch (err) {
      console.error('Failed to re-open session:', err);
      btn.disabled = false;
      btn.textContent = 'Error — Retry';
    }
  }

  _timeAgo(timestamp) {
    if (!timestamp) return '';
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    const weeks = Math.floor(days / 7);
    if (weeks < 5) return `${weeks}w ago`;
    return new Date(timestamp).toLocaleDateString();
  }

  _dismiss() {
    if (this.el) {
      this.el.classList.remove('visible');
      setTimeout(() => {
        this.el.remove();
        this.el = null;
      }, 200);
    }
  }
}
