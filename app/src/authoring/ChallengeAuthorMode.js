import { EventBus } from '../utils/EventBus.js';
import { Simulation } from '../model/Simulation.js';
import { Actor } from '../model/Actor.js';
import { PiecewiseLinearFunction } from '../model/PiecewiseLinearFunction.js';
import { Workspace } from '../workspace/Workspace.js';
import { PanelFactory } from '../workspace/PanelFactory.js';
import { ActorPalette } from '../workspace/ActorPalette.js';
import { ToolSidebar } from '../workspace/ToolSidebar.js';
import { GraphInteractionManager } from '../graph/GraphInteraction.js';
import { TimeController } from '../controls/TimeController.js';
import { PlaybackControls } from '../controls/PlaybackControls.js';
import { AuthorConfigPanel } from './AuthorConfigPanel.js';
import { ChallengeTemplateIO } from './ChallengeTemplateIO.js';

/**
 * Full-screen Challenge Author Mode.
 *
 * Creates an isolated workspace (own EventBus, Simulation, Workspace,
 * PanelFactory, GraphInteractionManager) for the teacher to build the
 * seed scenario. A right-column config panel lets the teacher set
 * visibility, editability, instructions, and results display options.
 *
 * Entry: WorldSelector "Author a Challenge" button.
 * Exit: Cancel button or after broadcasting.
 */
export class ChallengeAuthorMode {
  /**
   * @param {HTMLElement} appShellEl - The .app-shell container
   * @param {object} callbacks
   *   { onBroadcast(challengeData), onPractice(challengeData, count), onExit() }
   */
  constructor(appShellEl, callbacks) {
    this.appShell = appShellEl;
    this.callbacks = callbacks;

    // Isolated instances for the author workspace
    this.bus = new EventBus();
    this.sim = new Simulation();

    // DOM
    this.rootEl = null;
    this.workspaceEl = null;
    this.workspace = null;
    this.panelFactory = null;
    this.interactionMgr = null;
    this.actorPalette = null;
    this.toolSidebar = null;
    this.configPanel = null;
    this.timeController = null;
    this.playbackControls = null;

    // Track which actors are reference vs student template
    this._referenceActorIds = new Set();
    this._studentActorId = null;
  }

  /**
   * Enter author mode with a specific world type.
   * @param {'horizontal'|'vertical'} worldType
   */
  enter(worldType) {
    // Hide the main app UI
    for (const child of this.appShell.children) {
      child._authorHidden = true;
      child.style.display = 'none';
    }

    // Set up isolated simulation
    this.sim.worldType = worldType;

    // Build the author UI
    this._buildUI();

    // Create default actors: one reference + one student template
    this._createDefaultActors();

    // Create default panels: world + position + velocity
    this._createDefaultPanels();
  }

  /**
   * Enter author mode with a pre-loaded challenge template.
   * @param {object} challengeData - v2 challenge data
   */
  enterWithChallenge(challengeData) {
    for (const child of this.appShell.children) {
      child._authorHidden = true;
      child.style.display = 'none';
    }

    // Restore simulation from seed
    const seed = challengeData.seed;
    this.sim.worldType = seed.worldType;
    this.sim.timeRange = { ...seed.timeRange };
    this.sim.posRange = { ...seed.posRange };
    this.sim.velRange = { ...seed.velRange };
    this.sim.accelRange = { ...seed.accelRange };
    this.sim.targetSegments = (challengeData.targetSegments || []).map(s => ({ ...s }));

    this._buildUI();

    // Recreate reference actors
    for (const ad of challengeData.referenceActors) {
      const plf = new PiecewiseLinearFunction(
        ad.positionPoints.map(p => ({ t: p.t, v: p.v })),
        ad.accelerations || []
      );
      const actor = new Actor({
        id: ad.id, name: ad.name, color: ad.color,
        positionFunction: plf,
        // NOT readOnly in author mode — teacher needs to edit reference actors
      });
      this.sim.addActor(actor);
      this._referenceActorIds.add(actor.id);
    }

    // Recreate student template actor
    const st = challengeData.studentActorTemplate;
    const stPlf = new PiecewiseLinearFunction(
      st.positionPoints.map(p => ({ t: p.t, v: p.v })),
      st.accelerations || []
    );
    const studentActor = new Actor({
      id: 'student-template',
      name: 'Student',
      color: '#2ecc71',
      positionFunction: stPlf,
    });
    this.sim.addActor(studentActor);
    this._studentActorId = studentActor.id;

    this.bus.emit('actors:changed');

    // Create panels for all visible panel types
    const visible = new Set(challengeData.studentConfig.visiblePanels || ['world', 'position']);
    this._createDefaultPanels(visible);

    // Restore config panel values
    if (this.configPanel) {
      this.configPanel.loadFromChallenge(challengeData);
    }
  }

  exit() {
    // Stop playback
    if (this.timeController) this.timeController.stop();

    // Clean up workspace panels
    if (this.workspace) {
      const panelsCopy = [...this.workspace.panels];
      for (const panel of panelsCopy) {
        this.interactionMgr.unregisterGraph(panel.id);
        this.workspace.removePanel(panel);
      }
    }

    // Remove author UI
    if (this.rootEl) {
      this.rootEl.remove();
      this.rootEl = null;
    }

    // Restore the main app UI
    for (const child of this.appShell.children) {
      if (child._authorHidden) {
        child.style.display = '';
        delete child._authorHidden;
      }
    }

    if (this.callbacks.onExit) this.callbacks.onExit();
  }

  // --- UI Construction ---

  _buildUI() {
    this.rootEl = document.createElement('div');
    this.rootEl.className = 'author-mode';
    this.appShell.appendChild(this.rootEl);

    // Top bar: actor palette + action buttons
    const topBar = document.createElement('div');
    topBar.className = 'author-top-bar';
    this.rootEl.appendChild(topBar);

    // Actor palette container
    const actorPaletteEl = document.createElement('div');
    actorPaletteEl.className = 'author-actor-palette';
    topBar.appendChild(actorPaletteEl);
    this.actorPalette = new ActorPalette(actorPaletteEl, this.sim, this.bus, {
      renderBadge: (actor) => {
        if (this._referenceActorIds.has(actor.id)) return 'Ref';
        if (actor.id === this._studentActorId) return 'Student';
        return null;
      },
    });

    // Top bar buttons
    const topBtns = document.createElement('div');
    topBtns.className = 'author-top-btns';
    topBar.appendChild(topBtns);

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'author-btn author-btn-cancel';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => this.exit());
    topBtns.appendChild(cancelBtn);

    // Main area: workspace (left) + config panel (right)
    const mainArea = document.createElement('div');
    mainArea.className = 'author-main-area';
    this.rootEl.appendChild(mainArea);

    // Left: workspace + tool sidebar
    const leftCol = document.createElement('div');
    leftCol.className = 'author-left-col';
    mainArea.appendChild(leftCol);

    // Workspace
    this.workspaceEl = document.createElement('div');
    this.workspaceEl.className = 'author-workspace workspace';
    leftCol.appendChild(this.workspaceEl);

    this.workspace = new Workspace(this.workspaceEl, this.bus);
    this.interactionMgr = new GraphInteractionManager(this.sim, this.bus, this.workspace);
    this.panelFactory = new PanelFactory(this.sim, this.bus, this.interactionMgr);

    // Tool sidebar inside left column
    const toolSidebarEl = document.createElement('div');
    toolSidebarEl.className = 'author-tool-sidebar tool-sidebar';
    leftCol.appendChild(toolSidebarEl);
    this.toolSidebar = new ToolSidebar(toolSidebarEl, this.bus, this.workspace);

    // Right: config panel
    const rightCol = document.createElement('div');
    rightCol.className = 'author-right-col';
    mainArea.appendChild(rightCol);
    this.configPanel = new AuthorConfigPanel(rightCol, this.bus);

    // Bottom bar: save/load/practice/broadcast
    const bottomBar = document.createElement('div');
    bottomBar.className = 'author-bottom-bar';
    this.rootEl.appendChild(bottomBar);

    const saveBtn = document.createElement('button');
    saveBtn.className = 'author-btn';
    saveBtn.textContent = '\u{1F4BE} Save Challenge';
    saveBtn.addEventListener('click', () => this._handleSave());
    bottomBar.appendChild(saveBtn);

    const loadBtn = document.createElement('button');
    loadBtn.className = 'author-btn';
    loadBtn.textContent = '\u{1F4C2} Load Challenge';
    loadBtn.addEventListener('click', () => this._handleLoad());
    bottomBar.appendChild(loadBtn);

    const spacer = document.createElement('div');
    spacer.style.flex = '1';
    bottomBar.appendChild(spacer);

    const practiceBtn = document.createElement('button');
    practiceBtn.className = 'author-btn author-btn-practice';
    practiceBtn.textContent = '\u{1F9EA} Practice (10 students)';
    practiceBtn.addEventListener('click', () => this._handlePractice());
    bottomBar.appendChild(practiceBtn);

    const broadcastBtn = document.createElement('button');
    broadcastBtn.className = 'author-btn author-btn-broadcast';
    broadcastBtn.textContent = '\u{1F4E1} Broadcast to Students';
    broadcastBtn.addEventListener('click', () => this._handleBroadcast());
    bottomBar.appendChild(broadcastBtn);

    // Playback controls at very bottom of left column
    const controlsEl = document.createElement('div');
    controlsEl.className = 'author-controls controls';
    controlsEl.innerHTML = `
      <button class="author-ctrl-reset" data-tooltip="Reset">&#9198;</button>
      <button class="author-ctrl-step-back" data-tooltip="Step Back">&#9664;&#9646;</button>
      <button class="author-ctrl-play" data-tooltip="Play / Pause">&#9654;</button>
      <button class="author-ctrl-step-fwd" data-tooltip="Step Forward">&#9646;&#9654;</button>
      <span class="time-display">Time: <span class="author-ctrl-time-value">0.0</span>s</span>
      <label class="speed-control">
        Speed:
        <input type="range" class="author-ctrl-speed-slider" min="0.25" max="3" step="0.25" value="1">
        <span class="author-ctrl-speed-value">1&times;</span>
      </label>
    `;
    leftCol.appendChild(controlsEl);

    // Wire up playback manually (PlaybackControls expects specific IDs, so we wire manually)
    this.timeController = new TimeController(this.sim, this.bus);

    const playBtn = controlsEl.querySelector('.author-ctrl-play');
    const resetBtn = controlsEl.querySelector('.author-ctrl-reset');
    const stepBackBtn = controlsEl.querySelector('.author-ctrl-step-back');
    const stepFwdBtn = controlsEl.querySelector('.author-ctrl-step-fwd');
    const timeValueEl = controlsEl.querySelector('.author-ctrl-time-value');
    const speedSlider = controlsEl.querySelector('.author-ctrl-speed-slider');
    const speedValueEl = controlsEl.querySelector('.author-ctrl-speed-value');

    playBtn.addEventListener('click', () => this.timeController.toggle());
    resetBtn.addEventListener('click', () => this.timeController.reset());
    stepBackBtn.addEventListener('click', () => this.timeController.stepBackward());
    stepFwdBtn.addEventListener('click', () => this.timeController.stepForward());

    this.bus.on('playback:play', () => { playBtn.textContent = '\u23F8'; });
    this.bus.on('playback:pause', () => { playBtn.textContent = '\u25B6'; });
    this.bus.on('playback:ended', () => { playBtn.textContent = '\u25B6'; });
    this.bus.on('playback:reset', () => { playBtn.textContent = '\u25B6'; });
    this.bus.on('time:update', ({ currentTime }) => {
      timeValueEl.textContent = currentTime.toFixed(1);
    });

    speedSlider.addEventListener('input', () => {
      this.sim.playbackSpeed = parseFloat(speedSlider.value);
      speedValueEl.textContent = this.sim.playbackSpeed + '\u00D7';
    });

    // Time updates
    this.bus.on('time:update', ({ currentTime }) => {
      this.workspace.drawTimeCursors(currentTime);
      this.workspace.drawFrames(currentTime);
    });

    // Actor edited
    this.bus.on('actor:edited', () => {
      this.workspace.redrawAll();
    });

    // Target segments changed (from config panel)
    this.bus.on('targetSegments:changed', ({ segments }) => {
      this.sim.targetSegments = segments;
      this.workspace.redrawAll();
    });

    // Panel create requests
    this._spawnOffset = 0;
    this.bus.on('panel:create-request', ({ type, x, y }) => {
      this._spawnOffset = (this._spawnOffset + 30) % 150;
      this._createPanel(type, {
        x: x ?? 50 + this._spawnOffset,
        y: y ?? 30 + this._spawnOffset,
        actorIds: this.sim.actors.map(a => a.id),
      });
    });

    // Workspace drop target
    this.workspaceEl.addEventListener('dragover', (e) => {
      if (e.dataTransfer.types.includes('text/component-type')) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
      }
    });
    this.workspaceEl.addEventListener('drop', (e) => {
      const type = e.dataTransfer.getData('text/component-type');
      if (type) {
        e.preventDefault();
        const wsRect = this.workspaceEl.getBoundingClientRect();
        this.bus.emit('panel:create-request', {
          type,
          x: Math.max(0, e.clientX - wsRect.left - 100),
          y: Math.max(0, e.clientY - wsRect.top - 20),
        });
      }
    });
  }

  _createPanel(type, { x, y, width, height, actorIds } = {}) {
    const wsRect = this.workspaceEl.getBoundingClientRect();
    const wsW = wsRect.width || 600;
    const wsH = wsRect.height || 400;
    const halfW = Math.floor((wsW - 30) / 2);

    const defaults = {
      world:        { x: 10, y: 10, w: wsW - 20, h: Math.floor(wsH * 0.3) },
      position:     { x: 10, y: Math.floor(wsH * 0.3) + 20, w: halfW, h: Math.floor(wsH * 0.6) },
      velocity:     { x: halfW + 20, y: Math.floor(wsH * 0.3) + 20, w: halfW, h: Math.floor(wsH * 0.6) },
      acceleration: { x: 10, y: Math.floor(wsH * 0.65), w: halfW, h: Math.floor(wsH * 0.3) },
    };

    const d = defaults[type] || defaults.position;
    const panel = this.panelFactory.create(type, {
      x: x ?? d.x,
      y: y ?? d.y,
      width: width ?? d.w,
      height: height ?? d.h,
      onClose: (p) => {
        this.interactionMgr.unregisterGraph(p.id);
        this.workspace.removePanel(p);
      },
      onFocus: (p) => this.workspace.bringToFront(p),
    });

    this.workspace.addPanel(panel);

    // Link actors
    const ids = actorIds || this.sim.actors.map(a => a.id);
    for (const id of ids) {
      const actor = this.sim.getActor(id);
      if (actor) panel.linkActor(actor);
    }

    return panel;
  }

  _createDefaultActors() {
    // Reference actor (red) — editable in author mode; readOnly set on student side
    const refPlf = new PiecewiseLinearFunction([
      { t: 0, v: 0 },
      { t: this.sim.timeRange.max, v: 0 },
    ], [0]);
    const refActor = new Actor({
      id: 'ref-' + Date.now(),
      name: 'Reference',
      color: '#e74c3c',
      positionFunction: refPlf,
    });
    this.sim.addActor(refActor);
    this._referenceActorIds.add(refActor.id);

    // Student template actor (green, editable)
    const stuPlf = new PiecewiseLinearFunction([
      { t: 0, v: 0 },
      { t: this.sim.timeRange.max, v: 0 },
    ], [0]);
    const stuActor = new Actor({
      id: 'student-template',
      name: 'Student',
      color: '#2ecc71',
      positionFunction: stuPlf,
    });
    this.sim.addActor(stuActor);
    this._studentActorId = stuActor.id;

    this.bus.emit('actors:changed');
  }

  _createDefaultPanels(visibleSet) {
    const types = visibleSet || new Set(['world', 'position', 'velocity']);
    const allIds = this.sim.actors.map(a => a.id);
    if (types.has('world'))    this._createPanel('world',    { actorIds: allIds });
    if (types.has('position')) this._createPanel('position', { actorIds: allIds });
    if (types.has('velocity')) this._createPanel('velocity', { actorIds: allIds });
    if (types.has('acceleration')) this._createPanel('acceleration', { actorIds: allIds });
  }

  // --- Serialization ---

  _serializeChallenge() {
    const refActors = this.sim.actors.filter(a => this._referenceActorIds.has(a.id));
    const studentActor = this.sim.actors.find(a => a.id === this._studentActorId) || null;
    const config = this.configPanel.getConfig();

    return ChallengeTemplateIO.serialize({
      simulation: this.sim,
      referenceActors: refActors,
      studentTemplateActor: studentActor,
      config,
    });
  }

  // --- Button handlers ---

  _handleSave() {
    const data = this._serializeChallenge();
    ChallengeTemplateIO.saveToFile(data);
  }

  async _handleLoad() {
    const data = await ChallengeTemplateIO.loadFromFile();
    if (!data) return;

    // Clean up current state
    const panelsCopy = [...this.workspace.panels];
    for (const panel of panelsCopy) {
      this.interactionMgr.unregisterGraph(panel.id);
      this.workspace.removePanel(panel);
    }
    this.sim.actors = [];
    this._referenceActorIds.clear();
    this._studentActorId = null;

    // Restore from loaded data
    const seed = data.seed;
    this.sim.worldType = seed.worldType;
    this.sim.timeRange = { ...seed.timeRange };
    this.sim.posRange = { ...seed.posRange };
    this.sim.velRange = { ...seed.velRange };
    this.sim.accelRange = { ...seed.accelRange };
    this.sim.targetSegments = (data.targetSegments || []).map(s => ({ ...s }));

    for (const ad of data.referenceActors) {
      const plf = new PiecewiseLinearFunction(
        ad.positionPoints.map(p => ({ t: p.t, v: p.v })),
        ad.accelerations || []
      );
      const actor = new Actor({
        id: ad.id, name: ad.name, color: ad.color,
        positionFunction: plf,
      });
      this.sim.addActor(actor);
      this._referenceActorIds.add(actor.id);
    }

    const st = data.studentActorTemplate;
    const stPlf = new PiecewiseLinearFunction(
      st.positionPoints.map(p => ({ t: p.t, v: p.v })),
      st.accelerations || []
    );
    const studentActor = new Actor({
      id: 'student-template',
      name: 'Student',
      color: '#2ecc71',
      positionFunction: stPlf,
    });
    this.sim.addActor(studentActor);
    this._studentActorId = studentActor.id;

    this.bus.emit('actors:changed');

    const visible = new Set(data.studentConfig.visiblePanels || ['world', 'position']);
    this._createDefaultPanels(visible);

    if (this.configPanel) {
      this.configPanel.loadFromChallenge(data);
    }
  }

  _handleBroadcast() {
    const data = this._serializeChallenge();
    if (this.callbacks.onBroadcast) {
      this.callbacks.onBroadcast(data);
    }
  }

  _handlePractice() {
    const data = this._serializeChallenge();
    if (this.callbacks.onPractice) {
      this.callbacks.onPractice(data, 10);
    }
  }

  /**
   * Get reference actors (for results display reference overlay).
   */
  getReferenceActors() {
    return this.sim.actors.filter(a => this._referenceActorIds.has(a.id));
  }
}
