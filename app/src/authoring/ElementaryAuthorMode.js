import { EventBus } from '../utils/EventBus.js';
import { Simulation } from '../model/Simulation.js';
import { Actor } from '../model/Actor.js';
import { PiecewiseLinearFunction } from '../model/PiecewiseLinearFunction.js';
import { Workspace } from '../workspace/Workspace.js';
import { ElementaryPanelFactory } from '../workspace/ElementaryPanelFactory.js';
import { ElementaryActorPalette } from '../workspace/ElementaryActorPalette.js';
import { ToolSidebar } from '../workspace/ToolSidebar.js';
import { GraphInteractionManager } from '../graph/GraphInteraction.js';
import { UnifixBlockInteraction } from '../graph/UnifixBlockInteraction.js';
import { TimeController } from '../controls/TimeController.js';
import { AuthorConfigPanel } from './AuthorConfigPanel.js';
import { ChallengeTemplateIO } from './ChallengeTemplateIO.js';
import { UnifixBlockModel } from '../graph/UnifixBlockModel.js';

const ANIMAL_TYPES = [
  'puppy', 'kitten', 'bunny', 'duck', 'penguin',
  'elephant', 'horse', 'cow', 'frog', 'bear',
];

/**
 * Full-screen Challenge Author Mode for the Elementary edition.
 *
 * Same workflow as ChallengeAuthorMode but uses elementary graphics:
 * baby animals in the world, unifix blocks for velocity, no acceleration.
 */
export class ElementaryAuthorMode {
  constructor(appShellEl, callbacks) {
    this.appShell = appShellEl;
    this.callbacks = callbacks;

    this.bus = new EventBus();
    this.sim = new Simulation();
    this.sim.edition = 'elementary';

    this.rootEl = null;
    this.workspaceEl = null;
    this.workspace = null;
    this.panelFactory = null;
    this.interactionMgr = null;
    this.blockInteraction = null;
    this.actorPalette = null;
    this.toolSidebar = null;
    this.configPanel = null;
    this.timeController = null;

    this._referenceActorIds = new Set();
    this._studentActorId = null;
    this._animalIndex = 0;
  }

  enter(worldType) {
    for (const child of this.appShell.children) {
      child._authorHidden = true;
      child.style.display = 'none';
    }

    this.sim.worldType = worldType || 'frolic';
    this._buildUI();
    this._createDefaultActors();
    this._createDefaultPanels();
  }

  enterWithChallenge(challengeData) {
    for (const child of this.appShell.children) {
      child._authorHidden = true;
      child.style.display = 'none';
    }

    const seed = challengeData.seed;
    this.sim.worldType = seed.worldType;
    this.sim.edition = 'elementary';
    this.sim.timeRange = { ...seed.timeRange };
    this.sim.posRange = { ...seed.posRange };
    this.sim.velRange = { ...seed.velRange };
    this.sim.accelRange = { ...seed.accelRange };
    this.sim.targetSegments = (challengeData.targetSegments || []).map(s => ({ ...s }));

    this._buildUI();

    for (const ad of challengeData.referenceActors) {
      const plf = new PiecewiseLinearFunction(
        ad.positionPoints.map(p => ({ t: p.t, v: p.v })),
        ad.accelerations || []
      );
      const actor = new Actor({
        id: ad.id, name: ad.name, color: ad.color,
        positionFunction: plf,
        animalType: ad.animalType || this._nextAnimalType(),
      });
      this.sim.addActor(actor);
      this._referenceActorIds.add(actor.id);
    }

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
      animalType: st.animalType || 'kitten',
    });
    this.sim.addActor(studentActor);
    this._studentActorId = studentActor.id;

    this.bus.emit('actors:changed');

    const visible = new Set(challengeData.studentConfig.visiblePanels || ['world', 'position']);
    this._createDefaultPanels(visible, challengeData.panelActorLinkage);

    if (this.configPanel) {
      this.configPanel.loadFromChallenge(challengeData);
    }
  }

  exit({ skipOnExit = false } = {}) {
    if (this.timeController) this.timeController.stop();

    if (this.workspace) {
      const panelsCopy = [...this.workspace.panels];
      for (const panel of panelsCopy) {
        if (this.interactionMgr) this.interactionMgr.unregisterGraph(panel.id);
        if (this.blockInteraction) this.blockInteraction.unregisterGraph(panel.id);
        this.workspace.removePanel(panel);
      }
    }

    if (this.rootEl) {
      this.rootEl.remove();
      this.rootEl = null;
    }

    for (const child of this.appShell.children) {
      if (child._authorHidden) {
        child.style.display = '';
        delete child._authorHidden;
      }
    }

    if (!skipOnExit && this.callbacks.onExit) this.callbacks.onExit();
  }

  _nextAnimalType() {
    const type = ANIMAL_TYPES[this._animalIndex % ANIMAL_TYPES.length];
    this._animalIndex++;
    return type;
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

    const actorPaletteEl = document.createElement('div');
    actorPaletteEl.className = 'author-actor-palette';
    actorPaletteEl.style.cssText = 'display:flex; align-items:center; gap:8px; flex:1;';
    topBar.appendChild(actorPaletteEl);
    this.actorPalette = new ElementaryActorPalette(actorPaletteEl, this.sim, this.bus);

    const topBtns = document.createElement('div');
    topBtns.className = 'author-top-btns';
    topBar.appendChild(topBtns);

    const howToBtn = document.createElement('button');
    howToBtn.className = 'author-btn';
    howToBtn.textContent = 'How To';
    howToBtn.addEventListener('click', () => this._showAuthorHowTo());
    topBtns.appendChild(howToBtn);

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'author-btn author-btn-cancel';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => this.exit());
    topBtns.appendChild(cancelBtn);

    // Main area: workspace (left) + config panel (right)
    const mainArea = document.createElement('div');
    mainArea.className = 'author-main-area';
    this.rootEl.appendChild(mainArea);

    const leftCol = document.createElement('div');
    leftCol.className = 'author-left-col';
    mainArea.appendChild(leftCol);

    // Workspace
    this.workspaceEl = document.createElement('div');
    this.workspaceEl.className = 'author-workspace workspace';
    leftCol.appendChild(this.workspaceEl);

    this.workspace = new Workspace(this.workspaceEl, this.bus);
    this.interactionMgr = new GraphInteractionManager(this.sim, this.bus, this.workspace);
    this.blockInteraction = new UnifixBlockInteraction(this.sim, this.bus);
    this.panelFactory = new ElementaryPanelFactory(this.sim, this.bus, this.blockInteraction, {
      authorMode: true,
      graphInteractionManager: this.interactionMgr,
    });

    // Tool sidebar
    const toolSidebarEl = document.createElement('div');
    toolSidebarEl.className = 'author-tool-sidebar tool-sidebar';
    leftCol.appendChild(toolSidebarEl);
    this.toolSidebar = new ToolSidebar(toolSidebarEl, this.bus, this.workspace);

    // Hide acceleration and CSV buttons (not used in elementary)
    for (const btn of toolSidebarEl.querySelectorAll('.sidebar-tool-btn')) {
      const title = btn.title || '';
      const text = btn.textContent || '';
      if (title.includes('Accel') || text.includes('Accel')) btn.style.display = 'none';
      if (title.includes('CSV') || text.includes('Import CSV')) btn.style.display = 'none';
    }

    // Right: config panel
    const rightCol = document.createElement('div');
    rightCol.className = 'author-right-col';
    mainArea.appendChild(rightCol);
    this.configPanel = new AuthorConfigPanel(rightCol, this.bus, { hideAcceleration: true });

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

    // Playback controls
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

    // Time updates → draw
    this.bus.on('time:update', ({ currentTime }) => {
      this.workspace.drawTimeCursors(currentTime);
      this.workspace.drawFrames(currentTime);
    });

    // Actor edited
    this.bus.on('actor:edited', () => {
      this.workspace.redrawAll();
    });

    // Target segments changed
    this.bus.on('targetSegments:changed', ({ segments }) => {
      this.sim.targetSegments = segments;
      this.workspace.redrawAll();
    });

    // Panel create requests (from ToolSidebar component drag)
    this._spawnOffset = 0;
    this.bus.on('panel:create-request', ({ type, x, y }) => {
      // No acceleration in elementary
      if (type === 'acceleration') return;
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

    // Panning — only redraw world panels, not graphs
    this.bus.on('posrange:changed', () => {
      this.workspace.drawFrames(this.sim.currentTime);
    });

    // Clear all blocks
    this.bus.on('blocks:clear-all', () => {
      for (const actor of this.sim.actors) {
        if (actor.readOnly) continue;
        const model = new UnifixBlockModel(actor);
        model.clearAll();
        model.rebuildPLF();
        this.bus.emit('actor:edited', { actorId: actor.id });
      }
    });
  }

  _showAuthorHowTo() {
    if (document.querySelector('.about-overlay')) return;

    const overlay = document.createElement('div');
    overlay.className = 'about-overlay';

    const card = document.createElement('div');
    card.className = 'about-card';
    card.style.maxWidth = '660px';

    card.innerHTML = `
      <button class="about-close" title="Close">&times;</button>
      <h2 class="about-title">How To Author an Elementary Challenge</h2>
      <div class="about-text">

        <p style="color:#8ab4f8;font-weight:600;font-size:14px;margin-bottom:4px;">1. Set Up the Scenario</p>
        <p>
          You start with two animal actors:
          a <strong>Reference</strong> animal (red) and a <strong>Student</strong> animal (green).
          The Reference is what students see but cannot edit.
          The Student is the starting template each student receives.
        </p>

        <p style="color:#8ab4f8;font-weight:600;font-size:14px;margin-bottom:4px;">2. Build the Reference Motion</p>
        <p>
          Use the graph tools to create motion for the Reference animal.
          On the <strong>Position</strong> graph, drag points or use "Add Point" from the sidebar.
          On the <strong>Velocity</strong> graph, drag unifix blocks to set speed.
          You can add more reference animals with the <strong>+</strong> button.
        </p>

        <p style="color:#8ab4f8;font-weight:600;font-size:14px;margin-bottom:4px;">3. Set Up the Student Template</p>
        <p>
          Edit the <strong>Student</strong> actor to define the starting motion students will see.
          Leave it flat (at zero) so students build from scratch, or give them a
          partial solution to complete.
        </p>

        <p style="color:#8ab4f8;font-weight:600;font-size:14px;margin-bottom:4px;">4. Configure the Challenge</p>
        <p>
          Use the <strong>right-side config panel</strong> to control what students see and can do:
        </p>
        <ul style="margin:4px 0 12px 18px;font-size:13px;color:#bbc;line-height:1.7;">
          <li><strong>Challenge Title</strong> &mdash; give your challenge a descriptive name</li>
          <li><strong>Instructions</strong> &mdash; tell students what to do</li>
          <li><strong>Student Sees</strong> &mdash; choose which panels are visible (World, Position, Velocity)</li>
          <li><strong>Student Can Edit</strong> &mdash; choose which graphs students can modify</li>
          <li><strong>Results Display</strong> &mdash; pick which graph to overlay or tile in the results view</li>
        </ul>

        <p style="color:#8ab4f8;font-weight:600;font-size:14px;margin-bottom:4px;">5. Add Target Segments (Optional)</p>
        <p>
          Target segments are orange guide lines shown on the position graph that students
          must try to match. Click <strong>+ Add Segment</strong> in the config panel.
        </p>

        <p style="color:#8ab4f8;font-weight:600;font-size:14px;margin-bottom:4px;">6. Preview &amp; Test</p>
        <p>
          Use the <strong>playback controls</strong> to preview the animation.
          Click <strong>Practice (10 students)</strong> to simulate a class and
          see how the results view will look.
        </p>

        <p style="color:#8ab4f8;font-weight:600;font-size:14px;margin-bottom:4px;">7. Save or Broadcast</p>
        <ul style="margin:4px 0 12px 18px;font-size:13px;color:#bbc;line-height:1.7;">
          <li><strong>Save Challenge</strong> &mdash; download as a .json file</li>
          <li><strong>Load Challenge</strong> &mdash; open a previously saved challenge</li>
          <li><strong>Broadcast to Students</strong> &mdash; send live to all connected students</li>
        </ul>

        <p style="color:#8ab4f8;font-weight:600;font-size:14px;margin-bottom:4px;">Tips</p>
        <ul style="margin:4px 0 0 18px;font-size:13px;color:#bbc;line-height:1.7;">
          <li>Panels can be <strong>dragged</strong> by their title bar and <strong>resized</strong> from the bottom-right corner</li>
          <li>Use the <strong>Components</strong> sidebar to add World, Position, and Velocity panels</li>
          <li>Use the actor dropdown in each panel to toggle which animals are shown</li>
          <li>Right-click an actor chip to cycle its color</li>
          <li>Double-click an actor chip to rename it</li>
        </ul>

      </div>
    `;

    overlay.appendChild(card);

    const closeBtn = card.querySelector('.about-close');
    const close = () => {
      overlay.classList.add('dismissing');
      overlay.addEventListener('animationend', () => overlay.remove());
    };
    closeBtn.addEventListener('click', close);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });

    document.body.appendChild(overlay);
  }

  _createPanel(type, { x, y, width, height, actorIds } = {}) {
    const wsRect = this.workspaceEl.getBoundingClientRect();
    const wsW = wsRect.width || 600;
    const wsH = wsRect.height || 400;
    const halfW = Math.floor((wsW - 30) / 2);
    const isSea = this.sim.worldType === 'sea';

    const seaWorldW = 200;
    const graphLeft = seaWorldW + 20;
    const graphW = Math.floor((wsW - graphLeft - 20) / 2);
    const halfH = Math.floor((wsH - 30) / 2);
    const worldH = Math.floor(wsH * 0.35);
    const graphH = wsH - worldH - 20;

    const defaults = isSea ? {
      world:    { x: 10, y: 10, w: seaWorldW, h: wsH - 20 },
      position: { x: graphLeft, y: 10, w: graphW, h: halfH },
      velocity: { x: graphLeft + graphW + 10, y: 10, w: graphW, h: halfH },
    } : {
      world:    { x: 10, y: 10, w: wsW - 20, h: worldH },
      position: { x: 10, y: worldH + 20, w: halfW, h: graphH },
      velocity: { x: halfW + 20, y: worldH + 20, w: halfW, h: graphH },
    };

    const d = defaults[type] || defaults.position;
    const panel = this.panelFactory.create(type, {
      x: x ?? d.x,
      y: y ?? d.y,
      width: width ?? d.w,
      height: height ?? d.h,
      onClose: (p) => {
        this.interactionMgr.unregisterGraph(p.id);
        this.blockInteraction.unregisterGraph(p.id);
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
    // Reference actor (red puppy)
    const refPlf = new PiecewiseLinearFunction([{ t: 0, v: 0 }]);
    const refActor = new Actor({
      id: 'ref-' + Date.now(),
      name: 'Reference',
      color: '#e74c3c',
      positionFunction: refPlf,
      animalType: 'puppy',
    });
    this.sim.addActor(refActor);
    this._referenceActorIds.add(refActor.id);
    this._animalIndex = 1; // puppy used

    // Student template actor (green kitten)
    const stuPlf = new PiecewiseLinearFunction([{ t: 0, v: 0 }]);
    const stuActor = new Actor({
      id: 'student-template',
      name: 'Student',
      color: '#2ecc71',
      positionFunction: stuPlf,
      animalType: 'kitten',
    });
    this.sim.addActor(stuActor);
    this._studentActorId = stuActor.id;
    this._animalIndex = 2; // kitten used

    this.bus.emit('actors:changed');
  }

  _createDefaultPanels(visibleSet, panelActorLinkage) {
    const types = visibleSet || new Set(['world', 'position', 'velocity']);
    const allIds = this.sim.actors.map(a => a.id);
    for (const type of ['world', 'position', 'velocity']) {
      if (!types.has(type)) continue;
      const ids = (panelActorLinkage && panelActorLinkage[type]) || allIds;
      this._createPanel(type, { actorIds: ids });
    }
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
      workspace: this.workspace,
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
      this.blockInteraction.unregisterGraph(panel.id);
      this.workspace.removePanel(panel);
    }
    this.sim.actors = [];
    this._referenceActorIds.clear();
    this._studentActorId = null;

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
        animalType: ad.animalType || this._nextAnimalType(),
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
      animalType: st.animalType || 'kitten',
    });
    this.sim.addActor(studentActor);
    this._studentActorId = studentActor.id;

    this.bus.emit('actors:changed');

    const visible = new Set(data.studentConfig.visiblePanels || ['world', 'position']);
    this._createDefaultPanels(visible, data.panelActorLinkage);

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

  getReferenceActors() {
    return this.sim.actors.filter(a => this._referenceActorIds.has(a.id));
  }
}
