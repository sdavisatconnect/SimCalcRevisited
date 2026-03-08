import { ChallengeSerializer } from '../io/ChallengeSerializer.js';

/**
 * Manages challenge mode restrictions for students.
 * Activates after a student joins a challenge — locks certain graphs,
 * blocks panel creation if teacher disabled it, adds Submit button.
 */
export class ChallengeMode {
  constructor(bus, workspace, simulation) {
    this.bus = bus;
    this.workspace = workspace;
    this.sim = simulation;
    this.isActive = false;
    this.allowNewPanels = false;
    this.studentInitials = '';
    this.roomCode = '';
    this._panelCreateBlocker = null;
    this._submitBtn = null;
  }

  /**
   * Activate challenge mode with restrictions.
   * @param {object} challengeData - the serialized challenge
   * @param {object} settings - { allowNewPanels }
   * @param {string} initials - student's 3-char initials
   * @param {string} roomCode
   */
  activate(challengeData, settings, initials, roomCode) {
    this.isActive = true;
    this.allowNewPanels = settings.allowNewPanels || false;
    this.studentInitials = initials;
    this.roomCode = roomCode;

    // Apply lock states with student restrictions
    ChallengeSerializer.applyChallengeLockStates(challengeData, this.workspace, true);

    // Rename actors to student's initials
    for (const actor of this.sim.actors) {
      actor.name = initials;
    }
    this.bus.emit('actors:changed');

    // Block panel creation if teacher disabled it
    if (!this.allowNewPanels) {
      this._blockPanelCreation();
    }

    // Hide close buttons on all challenge panels (students shouldn't close them)
    this._hideCloseButtons();

    // Add Submit button to controls bar
    this._addSubmitButton();

    // Add challenge mode indicator
    this._addChallengeIndicator();
  }

  _blockPanelCreation() {
    // Intercept panel:create-request events
    this._panelCreateBlocker = () => {
      // Silently block — or show a message
      console.log('Panel creation blocked in challenge mode');
    };

    // Replace the panel:create-request handler by adding a blocker
    // We'll use a flag on the bus that main.js checks
    this.bus._challengeBlockPanels = true;

    // Also hide the component palette items in the sidebar
    const sidebarComponents = document.querySelectorAll('.sidebar-section-components .sidebar-item');
    for (const item of sidebarComponents) {
      item.style.display = 'none';
    }
    // Hide the components section header too
    const sectionHeaders = document.querySelectorAll('.sidebar-section-title');
    for (const header of sectionHeaders) {
      if (header.textContent.includes('COMPONENTS')) {
        header.style.display = 'none';
      }
    }
  }

  _hideCloseButtons() {
    for (const panel of this.workspace.panels) {
      const closeBtn = panel.el.querySelector('.panel-close-btn');
      if (closeBtn) closeBtn.style.display = 'none';
    }
  }

  _addSubmitButton() {
    const controls = document.getElementById('controls');
    if (!controls) return;

    this._submitBtn = document.createElement('button');
    this._submitBtn.id = 'btn-submit';
    this._submitBtn.className = 'io-btn submit-btn';
    this._submitBtn.textContent = 'Submit';
    this._submitBtn.title = 'Submit your solution';
    controls.appendChild(this._submitBtn);

    // The actual submit handler is wired by main.js after ChallengeMode is activated
  }

  _addChallengeIndicator() {
    const palBar = document.getElementById('palette-bar');
    if (!palBar) return;

    const indicator = document.createElement('div');
    indicator.className = 'challenge-indicator';
    indicator.innerHTML = `<span class="challenge-indicator-dot"></span> Challenge Mode &mdash; Room <strong>${this.roomCode}</strong>`;
    palBar.appendChild(indicator);
  }

  /**
   * Get the Submit button element (for wiring up the click handler externally).
   */
  getSubmitButton() {
    return this._submitBtn;
  }

  deactivate() {
    this.isActive = false;
    this.bus._challengeBlockPanels = false;

    // Remove submit button
    if (this._submitBtn && this._submitBtn.parentNode) {
      this._submitBtn.remove();
    }

    // Remove challenge indicator
    const indicator = document.querySelector('.challenge-indicator');
    if (indicator) indicator.remove();
  }
}
