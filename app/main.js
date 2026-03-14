import { EventBus } from './src/utils/EventBus.js';
import { PiecewiseLinearFunction } from './src/model/PiecewiseLinearFunction.js';
import { Actor } from './src/model/Actor.js';
import { Simulation } from './src/model/Simulation.js';
import { Workspace } from './src/workspace/Workspace.js';
import { PanelFactory } from './src/workspace/PanelFactory.js';
import { ComponentPalette } from './src/workspace/ComponentPalette.js';
import { ActorPalette } from './src/workspace/ActorPalette.js';
import { ToolSidebar } from './src/workspace/ToolSidebar.js';
import { WorldSelector } from './src/workspace/WorldSelector.js';
import { GraphInteractionManager } from './src/graph/GraphInteraction.js';
import { TimeController } from './src/controls/TimeController.js';
import { PlaybackControls } from './src/controls/PlaybackControls.js';
import { TemplateIO } from './src/io/TemplateIO.js';
import { ChallengeSerializer } from './src/io/ChallengeSerializer.js';
import { FIREBASE_CONFIG } from './src/connectivity/FirebaseConfig.js';
import { FirebaseClient } from './src/connectivity/FirebaseClient.js';
import { RoomManager } from './src/connectivity/RoomManager.js';
import { BroadcastDialog } from './src/connectivity/BroadcastDialog.js';
import { RoomCodeOverlay } from './src/connectivity/RoomCodeOverlay.js';
import { JoinDialog } from './src/connectivity/JoinDialog.js';
import { ChallengeMode } from './src/connectivity/ChallengeMode.js';
import { StudentSubmitter } from './src/connectivity/StudentSubmitter.js';
import { ResultsViewController } from './src/connectivity/ResultsViewController.js';
import { PracticeDataGenerator } from './src/connectivity/PracticeDataGenerator.js';
import { ChallengeAuthorMode } from './src/authoring/ChallengeAuthorMode.js';
import { SessionStore } from './src/connectivity/SessionStore.js';
import { RoomCodeBar } from './src/connectivity/RoomCodeBar.js';
import { SessionHistoryDialog } from './src/connectivity/SessionHistoryDialog.js';
import { StudentResultsOverlay } from './src/connectivity/StudentResultsOverlay.js';
import { showImportDialog } from './src/io/VernierImport.js';

// --- Setup ---
const bus = new EventBus();
const sim = new Simulation();

// --- Firebase Connectivity ---
const firebaseClient = new FirebaseClient(FIREBASE_CONFIG.databaseURL);
const roomManager = new RoomManager(firebaseClient);
let activeRoomCode = null;
let activePollInterval = null;

// --- Workspace ---
const workspaceEl = document.getElementById('workspace');
const workspace = new Workspace(workspaceEl, bus);

// --- Graph Interaction Manager ---
const interactionMgr = new GraphInteractionManager(sim, bus, workspace);

// --- Panel Factory ---
const panelFactory = new PanelFactory(sim, bus, interactionMgr);

// Helper: create a panel, add to workspace, link actors
let spawnOffset = 0;
function createPanel(type, { x, y, width, height, actorIds } = {}) {
  // Compute defaults based on actual workspace size and world type
  const wsRect = workspaceEl.getBoundingClientRect();
  const wsW = wsRect.width || 800;
  const wsH = wsRect.height || 600;
  const halfW = Math.floor((wsW - 30) / 2);
  const isVertical = sim.worldType === 'vertical';

  // Vertical world: tall skinny panel on left; graphs fill remaining space to the right
  const vWorldW = 200;
  const graphLeft = vWorldW + 20;
  const graphW = Math.floor((wsW - graphLeft - 20) / 2);

  const defaults = isVertical ? {
    world:        { x: 10, y: 10, w: vWorldW, h: wsH - 20 },
    position:     { x: graphLeft, y: 10, w: graphW, h: Math.floor((wsH - 30) / 2) },
    velocity:     { x: graphLeft + graphW + 10, y: 10, w: graphW, h: Math.floor((wsH - 30) / 2) },
    acceleration: { x: graphLeft, y: Math.floor((wsH - 30) / 2) + 20, w: graphW, h: Math.floor((wsH - 30) / 2) },
  } : {
    world:        { x: 10, y: 10, w: wsW - 20, h: 210 },
    position:     { x: 10, y: 230, w: halfW, h: 280 },
    velocity:     { x: halfW + 20, y: 230, w: halfW, h: 280 },
    acceleration: { x: 10, y: 520, w: halfW, h: 220 },
  };
  const d = defaults[type] || { x: 20, y: 20, w: 400, h: 300 };

  const panel = panelFactory.create(type, {
    x: x ?? d.x + spawnOffset,
    y: y ?? d.y + spawnOffset,
    width: width ?? d.w,
    height: height ?? d.h,
    onClose: (p) => {
      interactionMgr.unregisterGraph(p.id);
      workspace.removePanel(p);
      bus.emit('panel:closed', { panelId: p.id });
    },
    onFocus: (p) => workspace.bringToFront(p),
  });

  workspace.addPanel(panel);
  bus.emit('panel:added', { panel });

  // Link specified actors
  const ids = actorIds || sim.actors.map(a => a.id);
  for (const aid of ids) {
    const actor = sim.getActor(aid);
    if (actor) panel.linkActor(actor);
  }

  return panel;
}

// --- Reset to blank state ---
function resetToBlank() {
  // Stop playback
  timeController.stop();
  sim.currentTime = 0;
  sim.isPlaying = false;
  bus.emit('time:update', { currentTime: 0 });

  // Exit results mode if active
  if (activeResultsCtrl) {
    activeResultsCtrl.exitResultsMode();
    activeResultsCtrl = null;
  }

  // Remove all panels
  const panelsCopy = [...workspace.panels];
  for (const panel of panelsCopy) {
    interactionMgr.unregisterGraph(panel.id);
    workspace.removePanel(panel);
  }

  // Clean up any leftover results panel elements
  const leftoverResults = workspaceEl.querySelectorAll('.results-panel');
  for (const el of leftoverResults) el.remove();

  // Remove all actors
  sim.actors = [];
  sim.worldType = null;
  sim.targetSegments = [];
  bus.emit('actors:changed');

  // Reset speed
  sim.playbackSpeed = 1.0;
  speedSlider.value = 1;
  speedValue.textContent = '1\u00D7';

  // Reset challenge mode flags
  bus._challengeBlockPanels = false;
  activeChallengeMode = null;
  activeSubmitter = null;

  // Restore sidebar to default
  toolSidebar.restore();

  // Show broadcast button (may have been hidden in student mode)
  const broadcastBtn = document.getElementById('btn-broadcast');
  if (broadcastBtn) broadcastBtn.style.display = '';

  // Hide Collect Again button and clear stored room code / practice state
  activeResultsRoomCode = null;
  practiceCount = 0;
  const collectBtn = document.getElementById('btn-collect-again');
  if (collectBtn) collectBtn.style.display = 'none';

  // Remove room code bar if showing
  if (activeRoomCodeBar) {
    activeRoomCodeBar.remove();
    activeRoomCodeBar = null;
  }

  // Show world selector overlay again
  new WorldSelector(workspaceEl, sim, bus);
}

// --- Blank start: show world selector overlay ---
// No default panels are created. User must pick a world type first.
const worldSelector = new WorldSelector(workspaceEl, sim, bus);

// When a world type is selected, create the world panel automatically
bus.on('world:type-selected', ({ type }) => {
  createPanel('world');
});

// Quick start: create world + graphs + 2 actors, all linked
bus.on('world:quick-start', ({ type }) => {
  const colors = ['#e74c3c', '#3498db'];
  for (let i = 0; i < 2; i++) {
    const id = 'actor-' + Date.now() + '-' + i;
    const actor = new Actor({
      id,
      name: `Actor ${i + 1}`,
      color: colors[i],
      positionFunction: new PiecewiseLinearFunction([{ t: 0, v: 0 }])
    });
    sim.addActor(actor);
  }
  bus.emit('actors:changed');

  createPanel('world');
  createPanel('position');
  createPanel('velocity');
});

// --- Actor Palette (top bar, actors only) ---
const palette = new ComponentPalette(document.getElementById('palette-bar'), bus);
const actorPalette = new ActorPalette(palette.actorContainer, sim, bus);

// --- Right-side Tool Sidebar ---
const toolSidebar = new ToolSidebar(document.getElementById('tool-sidebar'), bus, workspace);

// --- Playback ---
const timeController = new TimeController(sim, bus);
const playbackControls = new PlaybackControls(
  document.getElementById('controls'), sim, timeController, bus
);

// Speed slider
const speedSlider = document.getElementById('speed-slider');
const speedValue = document.getElementById('speed-value');
speedSlider.addEventListener('input', () => {
  sim.playbackSpeed = parseFloat(speedSlider.value);
  speedValue.textContent = sim.playbackSpeed + '\u00D7';
});

// --- Event wiring ---

// Time updates: redraw all panels
bus.on('time:update', ({ currentTime }) => {
  workspace.drawTimeCursors(currentTime);
  workspace.drawFrames(currentTime);
});

// Actor edited: redraw all panels that show this actor
bus.on('actor:edited', ({ actorId }) => {
  for (const panel of workspace.panels) {
    if (panel.linkedActors.some(a => a.id === actorId)) {
      if (panel.component && panel.component.redraw) {
        panel.component.redraw();
      }
    }
  }
});

// Actor link/unlink requests (from drag-and-drop)
bus.on('actor:link-request', ({ actorId, panelId }) => {
  const actor = sim.getActor(actorId);
  const panel = workspace.getPanelById(panelId);
  if (actor && panel) {
    panel.linkActor(actor);
  }
});

bus.on('actor:unlink-request', ({ actorId, panelId }) => {
  const panel = workspace.getPanelById(panelId);
  if (panel) {
    panel.unlinkActor(actorId);
  }
});

// Actor added/removed: update all panels + re-render palette
bus.on('actors:changed', () => {
  // Redraw all panels (actor colors/names may have changed)
  workspace.redrawAll();
  workspace.drawFrames(sim.currentTime);
});

bus.on('actor:removed', ({ actorId }) => {
  // Unlink from all panels
  for (const panel of workspace.panels) {
    panel.unlinkActor(actorId);
  }
});

// Panel creation from sidebar click or drag
bus.on('panel:create-request', ({ type, x, y }) => {
  // Block panel creation in challenge mode if teacher disabled it
  if (bus._challengeBlockPanels) return;
  spawnOffset = (spawnOffset + 30) % 150;
  createPanel(type, {
    x: x ?? 50 + spawnOffset,
    y: y ?? 30 + spawnOffset,
    actorIds: [], // new panels start empty — use dropdown to pick actors
  });
});

// --- Workspace drop target for dragging components from sidebar ---
workspaceEl.addEventListener('dragover', (e) => {
  if (e.dataTransfer.types.includes('text/component-type')) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    workspaceEl.classList.add('drop-hover');
  }
});

workspaceEl.addEventListener('dragleave', (e) => {
  // Only remove highlight when actually leaving workspace
  if (!workspaceEl.contains(e.relatedTarget)) {
    workspaceEl.classList.remove('drop-hover');
  }
});

workspaceEl.addEventListener('drop', (e) => {
  workspaceEl.classList.remove('drop-hover');
  const type = e.dataTransfer.getData('text/component-type');
  if (type) {
    e.preventDefault();
    // Place the panel where it was dropped
    const wsRect = workspaceEl.getBoundingClientRect();
    const dropX = e.clientX - wsRect.left - 100; // offset so cursor is near center
    const dropY = e.clientY - wsRect.top - 20;
    bus.emit('panel:create-request', {
      type,
      x: Math.max(0, dropX),
      y: Math.max(0, dropY),
    });
  }
});

// --- New / Save / Load ---
document.getElementById('btn-new').addEventListener('click', () => {
  resetToBlank();
});

document.getElementById('btn-save').addEventListener('click', () => {
  TemplateIO.saveToFile(sim, workspace);
});

document.getElementById('btn-load').addEventListener('click', async () => {
  const data = await TemplateIO.loadFromFile();
  if (!data) return;

  // Dismiss the world selector overlay if it's showing (e.g. after clicking New)
  const overlay = workspaceEl.querySelector('.world-selector-overlay');
  if (overlay) overlay.remove();

  TemplateIO.reconstruct(data, sim, workspace, panelFactory, interactionMgr, bus, createPanel);
  // Update speed slider to match loaded state
  speedSlider.value = sim.playbackSpeed;
  speedValue.textContent = sim.playbackSpeed + '\u00D7';
});

// --- Broadcast Challenge ---
document.getElementById('btn-broadcast').addEventListener('click', async () => {
  // Must have a world type and at least one panel
  if (!sim.worldType) {
    alert('Set up a world and graphs before broadcasting.');
    return;
  }

  const dialog = new BroadcastDialog();
  const settings = await dialog.show(workspace);
  if (!settings) return; // cancelled

  // Practice mode — generate fake submissions locally, skip Firebase
  if (settings.practiceMode) {
    const submissions = PracticeDataGenerator.generate(sim, settings.practiceCount);
    bus.emit('challenge:show-results', { submissions, challengeData: null, roomCode: 'practice' });
    return;
  }

  try {
    const challengeData = ChallengeSerializer.serializeChallenge(sim, workspace, settings);
    const ownerToken = SessionStore.generateOwnerToken();
    const title = settings.title || 'Broadcast';
    const roomCode = await roomManager.createRoom(challengeData, settings, { ownerToken, title });
    activeRoomCode = roomCode;
    SessionStore.addSession({ roomCode, ownerToken, title, createdAt: Date.now() });

    const overlay = new RoomCodeOverlay();
    overlay.show(
      roomCode,
      // Show Results callback
      async () => {
        if (activePollInterval) {
          clearInterval(activePollInterval);
          activePollInterval = null;
        }
        const submissions = await roomManager.getSubmissions(roomCode);
        bus.emit('challenge:show-results', { submissions, challengeData, roomCode });
      },
      // Cancel callback
      () => {
        if (activePollInterval) {
          clearInterval(activePollInterval);
          activePollInterval = null;
        }
        activeRoomCode = null;
      }
    );

    // Poll for submission count every 7 seconds
    activePollInterval = setInterval(async () => {
      try {
        const count = await roomManager.getSubmissionCount(roomCode);
        overlay.updateSubmissionCount(count);
      } catch (e) {
        console.warn('Polling error:', e);
      }
    }, 7000);

  } catch (err) {
    console.error('Failed to broadcast challenge:', err);
    alert('Failed to broadcast. Check your connection and try again.');
  }
});

// --- Student Join Challenge ---
let activeChallengeMode = null;
let activeSubmitter = null;

bus.on('challenge:join-request', async () => {
  const joinDialog = new JoinDialog();
  const result = await joinDialog.show();
  if (!result) {
    // Cancelled — show world selector again
    new WorldSelector(workspaceEl, sim, bus);
    return;
  }

  const { roomCode, initials, challengeData, settings } = result;

  // Set target segments on simulation (if any)
  sim.targetSegments = (challengeData.targetSegments || []).map(s => ({ ...s }));

  // Reconstruct the challenge workspace
  TemplateIO.reconstruct(challengeData, sim, workspace, panelFactory, interactionMgr, bus, createPanel);

  // Update speed slider to match
  speedSlider.value = sim.playbackSpeed;
  speedValue.textContent = sim.playbackSpeed + '\u00D7';

  // Activate challenge mode (locks, restrictions, submit button)
  activeChallengeMode = new ChallengeMode(bus, workspace, sim);
  activeChallengeMode.activate(challengeData, settings, initials, roomCode);

  // Create student submitter
  const studentId = `${initials}-${Date.now()}`;
  activeSubmitter = new StudentSubmitter(firebaseClient, roomCode, studentId, initials);

  // Wire up the submit button
  const submitBtn = activeChallengeMode.getSubmitButton();
  let viewResultsBtn = null;
  if (submitBtn) {
    submitBtn.addEventListener('click', async () => {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Submitting...';
      try {
        await activeSubmitter.submit(sim);
        submitBtn.textContent = activeSubmitter.version > 1 ? 'Resubmitted \u2713' : 'Submitted \u2713';
        submitBtn.classList.add('submit-success');
        setTimeout(() => {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Resubmit';
          submitBtn.classList.remove('submit-success');
        }, 2000);

        // Add "View Results" button after first successful submit
        if (!viewResultsBtn && submitBtn.parentNode) {
          viewResultsBtn = document.createElement('button');
          viewResultsBtn.className = 'challenge-btn challenge-view-results';
          viewResultsBtn.textContent = 'View Results';
          viewResultsBtn.addEventListener('click', () => {
            const overlay = new StudentResultsOverlay(roomManager, roomCode, sim);
            overlay.show();
          });
          submitBtn.parentNode.insertBefore(viewResultsBtn, submitBtn.nextSibling);
        }
      } catch (err) {
        console.error('Submit failed:', err);
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit (retry)';
        submitBtn.classList.add('submit-error');
        setTimeout(() => submitBtn.classList.remove('submit-error'), 2000);
      }
    });
  }

  // Hide broadcast button in student mode
  const broadcastBtn = document.getElementById('btn-broadcast');
  if (broadcastBtn) broadcastBtn.style.display = 'none';
});

// --- Teacher Results Display ---
let activeResultsCtrl = null;
let activeResultsRoomCode = null;  // Firebase room code, or null
let practiceCount = 0;             // practice mode student count (0 = not practice)
let activeRoomCodeBar = null;      // persistent room code banner during results

const collectAgainBtn = document.getElementById('btn-collect-again');

bus.on('challenge:show-results', ({ submissions, challengeData, roomCode }) => {
  if (!submissions) {
    alert('No submissions yet.');
    return;
  }

  activeResultsCtrl = new ResultsViewController(bus, workspace, sim, createPanel, interactionMgr);
  activeResultsCtrl.enterResultsMode(submissions);

  // Show "Collect Again" for both live broadcasts and practice mode
  if (roomCode === 'practice') {
    activeResultsRoomCode = null;
    practiceCount = Object.keys(submissions).length;
    collectAgainBtn.style.display = '';
  } else if (roomCode) {
    activeResultsRoomCode = roomCode;
    practiceCount = 0;
    // Hide the old collect-again button; the RoomCodeBar has its own
    collectAgainBtn.style.display = 'none';

    // Create persistent room code bar
    if (activeRoomCodeBar) activeRoomCodeBar.remove();
    activeRoomCodeBar = new RoomCodeBar(workspaceEl, roomCode, {
      onCollectAgain: async () => {
        const subs = await roomManager.getSubmissions(roomCode);
        if (!subs) { alert('No submissions found.'); return; }
        if (activeResultsCtrl) activeResultsCtrl.exitResultsMode();
        activeResultsCtrl = new ResultsViewController(bus, workspace, sim, createPanel, interactionMgr);
        activeResultsCtrl.enterResultsMode(subs);
      },
      onCloseRoom: async () => {
        await roomManager.closeRoom(roomCode);
      },
    });

    // Poll for submission count every 15 seconds
    activeRoomCodeBar.startPolling(
      () => roomManager.getSubmissionCount(roomCode),
      15000
    );

    // Update session last-accessed timestamp
    SessionStore.updateLastAccessed(roomCode);
  }
});

// --- Collect Again: re-fetch from Firebase or regenerate practice data ---
collectAgainBtn.addEventListener('click', async () => {
  collectAgainBtn.disabled = true;

  try {
    let submissions;

    if (practiceCount > 0) {
      // Practice mode: regenerate with a few extra "late arrivals"
      const extraStudents = Math.floor(Math.random() * 3) + 1; // 1–3 new students
      practiceCount += extraStudents;
      submissions = PracticeDataGenerator.generate(sim, practiceCount);
    } else if (activeResultsRoomCode) {
      // Live mode: re-fetch from Firebase
      submissions = await roomManager.getSubmissions(activeResultsRoomCode);
    } else {
      return;
    }

    if (!submissions) {
      alert('No submissions found.');
      return;
    }

    // Exit current results and re-enter with fresh data
    if (activeResultsCtrl) {
      activeResultsCtrl.exitResultsMode();
    }
    activeResultsCtrl = new ResultsViewController(bus, workspace, sim, createPanel, interactionMgr);
    activeResultsCtrl.enterResultsMode(submissions);
  } catch (err) {
    console.error('Failed to collect submissions:', err);
    alert('Failed to collect. Check your connection and try again.');
  } finally {
    collectAgainBtn.disabled = false;
  }
});

// --- Challenge Author Mode ---
let activeAuthorMode = null;
const appShell = document.querySelector('.app-shell');

bus.on('challenge:author-start', ({ type }) => {
  activeAuthorMode = new ChallengeAuthorMode(appShell, {
    onBroadcast: async (challengeData) => {
      // Use existing broadcast flow
      try {
        const ownerToken = SessionStore.generateOwnerToken();
        const title = challengeData.meta?.title || 'Authored Challenge';
        const roomCode = await roomManager.createRoom(challengeData, {}, { ownerToken, title });
        activeRoomCode = roomCode;
        SessionStore.addSession({ roomCode, ownerToken, title, createdAt: Date.now() });

        const overlay = new RoomCodeOverlay();
        overlay.show(
          roomCode,
          async () => {
            if (activePollInterval) {
              clearInterval(activePollInterval);
              activePollInterval = null;
            }
            const submissions = await roomManager.getSubmissions(roomCode);
            // Transfer target segments to main sim before exiting author mode
            sim.targetSegments = (challengeData.targetSegments || []).map(s => ({ ...s }));
            // Exit author mode and show results
            if (activeAuthorMode) {
              activeAuthorMode.exit();
              activeAuthorMode = null;
            }
            bus.emit('challenge:show-results', { submissions, challengeData, roomCode });
          },
          () => {
            if (activePollInterval) {
              clearInterval(activePollInterval);
              activePollInterval = null;
            }
            activeRoomCode = null;
          }
        );

        activePollInterval = setInterval(async () => {
          try {
            const count = await roomManager.getSubmissionCount(roomCode);
            overlay.updateSubmissionCount(count);
          } catch (e) {
            console.warn('Polling error:', e);
          }
        }, 7000);

      } catch (err) {
        console.error('Failed to broadcast from author mode:', err);
        alert('Failed to broadcast. Check your connection and try again.');
      }
    },

    onPractice: (challengeData, count) => {
      const submissions = PracticeDataGenerator.generate(sim, count);
      // Transfer target segments to main sim before exiting author mode
      sim.targetSegments = (challengeData.targetSegments || []).map(s => ({ ...s }));
      // Exit author mode first, then show results
      if (activeAuthorMode) {
        activeAuthorMode.exit();
        activeAuthorMode = null;
      }
      bus.emit('challenge:show-results', { submissions, challengeData, roomCode: 'practice' });
    },

    onExit: () => {
      activeAuthorMode = null;
      // Show the world selector again
      new WorldSelector(workspaceEl, sim, bus);
    },
  });

  activeAuthorMode.enter(type);
  window._authorMode = activeAuthorMode; // debug
});

// --- Session Re-open ---
bus.on('session:reopen-request', () => {
  const dialog = new SessionHistoryDialog(roomManager, ({ roomCode, challengeData, submissions, settings }) => {
    // Reconstruct workspace from challenge data
    TemplateIO.reconstruct(challengeData, sim, workspace, panelFactory, interactionMgr, bus, createPanel);
    speedSlider.value = sim.playbackSpeed;
    speedValue.textContent = sim.playbackSpeed + '\u00D7';

    // Set target segments if any
    sim.targetSegments = (challengeData.targetSegments || []).map(s => ({ ...s }));

    // Enter results mode
    activeResultsCtrl = new ResultsViewController(bus, workspace, sim, createPanel, interactionMgr);
    activeResultsCtrl.enterResultsMode(submissions);

    // Show room code bar
    activeResultsRoomCode = roomCode;
    if (activeRoomCodeBar) activeRoomCodeBar.remove();
    activeRoomCodeBar = new RoomCodeBar(workspaceEl, roomCode, {
      onCollectAgain: async () => {
        const subs = await roomManager.getSubmissions(roomCode);
        if (!subs) { alert('No submissions found.'); return; }
        if (activeResultsCtrl) activeResultsCtrl.exitResultsMode();
        activeResultsCtrl = new ResultsViewController(bus, workspace, sim, createPanel, interactionMgr);
        activeResultsCtrl.enterResultsMode(subs);
      },
      onCloseRoom: async () => {
        await roomManager.closeRoom(roomCode);
      },
    });
    activeRoomCodeBar.startPolling(
      () => roomManager.getSubmissionCount(roomCode),
      15000
    );

    // Hide Collect Again since the bar handles it
    collectAgainBtn.style.display = 'none';
  });
  dialog.show();
});


// --- Vernier CSV Import ---
bus.on('import:request', () => {
  if (!sim.worldType) return; // need a world set up first
  showImportDialog(sim, workspace, bus);
});

// --- Tooltips for toolbar buttons ---
// Uses fixed-position DOM elements appended to body (avoids stacking context issues)
{
  let tip = null;
  for (const btn of document.querySelectorAll('[data-tooltip]')) {
    btn.addEventListener('mouseenter', () => {
      tip = document.createElement('div');
      tip.className = 'btn-tooltip';
      tip.textContent = btn.dataset.tooltip;
      document.body.appendChild(tip);
      const rect = btn.getBoundingClientRect();
      const tipRect = tip.getBoundingClientRect();
      tip.style.left = Math.min(rect.right - tipRect.width, window.innerWidth - tipRect.width - 4) + 'px';
      tip.style.top = (rect.top - tipRect.height - 6) + 'px';
    });
    btn.addEventListener('mouseleave', () => {
      if (tip) { tip.remove(); tip = null; }
    });
  }
}

// Initial time cursors
workspace.drawTimeCursors(0);

// --- URL-based join: ?join=XXXX ---
{
  const params = new URLSearchParams(window.location.search);
  const joinCode = params.get('join');
  if (joinCode && /^\d{4,6}$/.test(joinCode)) {
    // Clean the URL without reloading
    const cleanUrl = window.location.origin + window.location.pathname;
    history.replaceState(null, '', cleanUrl);

    // Dismiss world selector if present
    const wsOverlay = workspaceEl.querySelector('.world-selector-overlay');
    if (wsOverlay) wsOverlay.remove();

    // Open join dialog with pre-filled code
    const joinDialog = new JoinDialog();
    joinDialog.showWithCode(joinCode).then(result => {
      if (!result) {
        // Cancelled — show world selector again
        new WorldSelector(workspaceEl, sim, bus);
        return;
      }
      // Emit the same join event data that the normal flow uses
      const { roomCode, initials, challengeData, settings } = result;
      sim.targetSegments = (challengeData.targetSegments || []).map(s => ({ ...s }));
      TemplateIO.reconstruct(challengeData, sim, workspace, panelFactory, interactionMgr, bus, createPanel);
      speedSlider.value = sim.playbackSpeed;
      speedValue.textContent = sim.playbackSpeed + '\u00D7';
      activeChallengeMode = new ChallengeMode(bus, workspace, sim);
      activeChallengeMode.activate(challengeData, settings, initials, roomCode);
      const studentId = `${initials}-${Date.now()}`;
      activeSubmitter = new StudentSubmitter(firebaseClient, roomCode, studentId, initials);
      const submitBtn = activeChallengeMode.getSubmitButton();
      let urlViewResultsBtn = null;
      if (submitBtn) {
        submitBtn.addEventListener('click', async () => {
          submitBtn.disabled = true;
          submitBtn.textContent = 'Submitting...';
          try {
            await activeSubmitter.submit(sim);
            submitBtn.textContent = activeSubmitter.version > 1 ? 'Resubmitted \u2713' : 'Submitted \u2713';
            submitBtn.classList.add('submit-success');
            setTimeout(() => {
              submitBtn.disabled = false;
              submitBtn.textContent = 'Resubmit';
              submitBtn.classList.remove('submit-success');
            }, 2000);
            // Add "View Results" button after first successful submit
            if (!urlViewResultsBtn && submitBtn.parentNode) {
              urlViewResultsBtn = document.createElement('button');
              urlViewResultsBtn.className = 'challenge-btn challenge-view-results';
              urlViewResultsBtn.textContent = 'View Results';
              urlViewResultsBtn.addEventListener('click', () => {
                const overlay = new StudentResultsOverlay(roomManager, roomCode, sim);
                overlay.show();
              });
              submitBtn.parentNode.insertBefore(urlViewResultsBtn, submitBtn.nextSibling);
            }
          } catch (err) {
            console.error('Submit failed:', err);
            submitBtn.disabled = false;
            submitBtn.textContent = 'Submit (retry)';
            submitBtn.classList.add('submit-error');
            setTimeout(() => submitBtn.classList.remove('submit-error'), 2000);
          }
        });
      }
      const broadcastBtn = document.getElementById('btn-broadcast');
      if (broadcastBtn) broadcastBtn.style.display = 'none';
    });
  }
}

// Debug: expose for console testing
window._sim = sim;
window._bus = bus;
window._workspace = workspace;
window._timeController = timeController;
window._toolSidebar = toolSidebar;
