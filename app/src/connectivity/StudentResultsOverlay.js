import { ResultsManager } from './ResultsManager.js';
import { OverlaidGraphView } from './OverlaidGraphView.js';

/**
 * Full-screen overlay that lets students view group results after submitting.
 * Shows all student submissions overlaid on a single graph.
 * Non-destructive — the student's workspace stays intact underneath.
 */
export class StudentResultsOverlay {
  /**
   * @param {RoomManager} roomManager
   * @param {string} roomCode
   * @param {Simulation} simulation
   */
  constructor(roomManager, roomCode, simulation) {
    this.roomManager = roomManager;
    this.roomCode = roomCode;
    this.sim = simulation;
    this.el = null;
    this._graphView = null;
  }

  async show() {
    this._build();
    await this._loadResults();
  }

  _build() {
    this.el = document.createElement('div');
    this.el.className = 'student-results-overlay';

    const card = document.createElement('div');
    card.className = 'student-results-card';

    // Header
    const header = document.createElement('div');
    header.className = 'student-results-header';

    const title = document.createElement('h2');
    title.className = 'student-results-title';
    title.textContent = 'Group Results';
    header.appendChild(title);

    const btnGroup = document.createElement('div');
    btnGroup.className = 'student-results-btns';

    const refreshBtn = document.createElement('button');
    refreshBtn.className = 'broadcast-btn';
    refreshBtn.textContent = 'Refresh';
    refreshBtn.addEventListener('click', () => this._loadResults());
    btnGroup.appendChild(refreshBtn);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'broadcast-btn broadcast-btn-cancel';
    closeBtn.textContent = 'Close';
    closeBtn.addEventListener('click', () => this._dismiss());
    btnGroup.appendChild(closeBtn);

    header.appendChild(btnGroup);
    card.appendChild(header);

    // Graph container
    this._graphContainer = document.createElement('div');
    this._graphContainer.className = 'student-results-graph';
    card.appendChild(this._graphContainer);

    // Status message
    this._statusEl = document.createElement('div');
    this._statusEl.className = 'student-results-status';
    this._statusEl.textContent = 'Loading submissions...';
    card.appendChild(this._statusEl);

    this.el.appendChild(card);
    document.body.appendChild(this.el);
    requestAnimationFrame(() => this.el.classList.add('visible'));
  }

  async _loadResults() {
    this._statusEl.textContent = 'Loading submissions...';
    this._graphContainer.innerHTML = '';

    try {
      const submissions = await this.roomManager.getSubmissions(this.roomCode);
      if (!submissions || Object.keys(submissions).length === 0) {
        this._statusEl.textContent = 'No submissions yet. Try refreshing in a moment.';
        return;
      }

      const mgr = new ResultsManager(this.sim, null);
      const { students } = mgr.parseSubmissions(submissions);

      const count = students.length;
      this._statusEl.textContent = `${count} student${count !== 1 ? 's' : ''} submitted`;

      // Render overlaid graph
      this._graphView = new OverlaidGraphView(
        this._graphContainer,
        this.sim,
        students,
        'position'
      );
    } catch (err) {
      console.error('Failed to load group results:', err);
      this._statusEl.textContent = 'Failed to load results. Try refreshing.';
    }
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
