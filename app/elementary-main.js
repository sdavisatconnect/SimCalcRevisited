/**
 * SimCalc Elementary Edition — Main bootstrap
 * Separate entry point from main.js, sharing core model/Firebase modules.
 */
import { EventBus } from './src/utils/EventBus.js';
import { PiecewiseLinearFunction } from './src/model/PiecewiseLinearFunction.js';
import { Actor } from './src/model/Actor.js';
import { Simulation } from './src/model/Simulation.js';
import { Workspace } from './src/workspace/Workspace.js';
import { ElementaryPanelFactory } from './src/workspace/ElementaryPanelFactory.js';
import { ElementaryWorldSelector } from './src/workspace/ElementaryWorldSelector.js';
import { ElementarySidebar } from './src/workspace/ElementarySidebar.js';
import { ElementaryActorPalette } from './src/workspace/ElementaryActorPalette.js';
import { UnifixBlockInteraction } from './src/graph/UnifixBlockInteraction.js';
import { UnifixBlockModel } from './src/graph/UnifixBlockModel.js';
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
import { SessionStore } from './src/connectivity/SessionStore.js';
import { RoomCodeBar } from './src/connectivity/RoomCodeBar.js';
import { SessionHistoryDialog } from './src/connectivity/SessionHistoryDialog.js';
import { StudentResultsOverlay } from './src/connectivity/StudentResultsOverlay.js';
import { ElementaryHowTo } from './src/workspace/ElementaryHowTo.js';
import { ElementaryAuthorMode } from './src/authoring/ElementaryAuthorMode.js';
import { PracticeDataGenerator } from './src/connectivity/PracticeDataGenerator.js';
import { t, getLanguage, setLanguage } from './src/i18n/strings.js';

// --- Setup ---
const bus = new EventBus();
const sim = new Simulation();

// --- Firebase ---
const firebaseClient = new FirebaseClient(FIREBASE_CONFIG.databaseURL);
const roomManager = new RoomManager(firebaseClient);
let activeRoomCode = null;
let activePollInterval = null;

// --- Workspace ---
const workspaceEl = document.getElementById('workspace');
const workspace = new Workspace(workspaceEl, bus);

// --- Block Interaction ---
const blockInteraction = new UnifixBlockInteraction(sim, bus);

// --- Panel Factory ---
const panelFactory = new ElementaryPanelFactory(sim, bus, blockInteraction);

// --- Create panel helper ---
function createPanel(type, { x, y, width, height, actorIds } = {}) {
  const wsRect = workspaceEl.getBoundingClientRect();
  const wsW = wsRect.width || 800;
  const wsH = wsRect.height || 600;
  const halfW = Math.floor((wsW - 30) / 2);
  const isSea = sim.worldType === 'sea';

  // Fixed layout for elementary: world top, position bottom-left, velocity bottom-right
  const worldH = Math.floor(wsH * 0.38);
  const graphH = wsH - worldH - 10;

  const defaults = isSea ? {
    world:    { x: 10, y: 10, w: 200, h: wsH - 20 },
    position: { x: 220, y: 10, w: halfW - 110, h: Math.floor((wsH - 30) / 2) },
    velocity: { x: 220 + halfW - 100, y: 10, w: halfW - 110, h: Math.floor((wsH - 30) / 2) },
  } : {
    world:    { x: 10, y: 10, w: wsW - 20, h: worldH },
    position: { x: 10, y: worldH + 20, w: halfW, h: graphH },
    velocity: { x: halfW + 20, y: worldH + 20, w: halfW, h: graphH },
  };

  const d = defaults[type] || { x: 20, y: 20, w: 400, h: 300 };

  const panel = panelFactory.create(type, {
    x: x ?? d.x,
    y: y ?? d.y,
    width: width ?? d.w,
    height: height ?? d.h,
    onClose: (p) => {
      blockInteraction.unregisterGraph(p.id);
      workspace.removePanel(p);
      bus.emit('panel:closed', { panelId: p.id });
    },
    onFocus: (p) => workspace.bringToFront(p),
  });

  workspace.addPanel(panel);
  bus.emit('panel:added', { panel });

  const ids = actorIds || sim.actors.map(a => a.id);
  for (const aid of ids) {
    const actor = sim.getActor(aid);
    if (actor) panel.linkActor(actor);
  }

  return panel;
}

// --- Reset ---
let activeResultsCtrl = null;
let activeResultsRoomCode = null;
let activeRoomCodeBar = null;
let activeChallengeMode = null;
let activeSubmitter = null;

function resetToBlank() {
  timeController.stop();
  sim.currentTime = 0;
  sim.isPlaying = false;
  bus.emit('time:update', { currentTime: 0 });

  if (activeResultsCtrl) {
    activeResultsCtrl.exitResultsMode();
    activeResultsCtrl = null;
  }

  const panelsCopy = [...workspace.panels];
  for (const panel of panelsCopy) {
    blockInteraction.unregisterGraph(panel.id);
    workspace.removePanel(panel);
  }

  const leftoverResults = workspaceEl.querySelectorAll('.results-panel');
  for (const el of leftoverResults) el.remove();

  sim.actors = [];
  sim.worldType = null;
  sim.targetSegments = [];
  bus.emit('actors:changed');

  sim.playbackSpeed = 1.0;
  speedSlider.value = 1;
  speedValue.textContent = '1\u00D7';

  bus._challengeBlockPanels = false;
  activeChallengeMode = null;
  activeSubmitter = null;
  activeResultsRoomCode = null;

  if (activeRoomCodeBar) {
    activeRoomCodeBar.remove();
    activeRoomCodeBar = null;
  }

  sidebar.restore();
  sidebarEl.style.display = 'none';

  new ElementaryWorldSelector(workspaceEl, sim, bus);
}

// --- Show world selector on start ---
new ElementaryWorldSelector(workspaceEl, sim, bus);

// --- Quick start: create single actor + panels ---
bus.on('world:quick-start', ({ type, animalType, color }) => {
  sim.worldType = type || 'frolic';

  const id = 'actor-' + Date.now();
  const actor = new Actor({
    id,
    name: animalType ? animalType.charAt(0).toUpperCase() + animalType.slice(1) : 'Animal',
    color: color || '#e74c3c',
    positionFunction: new PiecewiseLinearFunction([{ t: 0, v: 0 }]),
    animalType: animalType || 'puppy',
  });
  sim.addActor(actor);
  bus.emit('actors:changed');

  createPanel('world');
  createPanel('position');
  createPanel('velocity');

  // Show sidebar now that workspace is active
  sidebarEl.style.display = '';
});

// --- Top bar: actor palette + About/HowTo ---
const paletteBar = document.getElementById('palette-bar');

// Actor container
const actorContainer = document.createElement('div');
actorContainer.className = 'actor-palette-container';
actorContainer.style.cssText = 'display:flex; align-items:center; gap:8px; padding:4px 12px; flex:1;';
paletteBar.appendChild(actorContainer);

const actorPalette = new ElementaryActorPalette(actorContainer, sim, bus);

// Right-side buttons
const btnContainer = document.createElement('div');
btnContainer.style.cssText = 'display:flex; gap:8px; padding:4px 12px;';

const howToBtn = document.createElement('button');
howToBtn.className = 'elementary-secondary-btn';
howToBtn.style.cssText = 'font-size:12px; padding:4px 12px; border-color:rgba(255,255,255,0.5); color:#fff; background:transparent;';
howToBtn.textContent = t('howTo');
howToBtn.addEventListener('click', () => bus.emit('howto:show'));
btnContainer.appendChild(howToBtn);

const aboutBtn = document.createElement('button');
aboutBtn.className = 'elementary-secondary-btn';
aboutBtn.style.cssText = 'font-size:12px; padding:4px 12px; border-color:rgba(255,255,255,0.5); color:#fff; background:transparent;';
aboutBtn.textContent = t('about');
aboutBtn.addEventListener('click', () => bus.emit('about:show'));
btnContainer.appendChild(aboutBtn);

paletteBar.appendChild(btnContainer);

// --- How To & About modals ---
new ElementaryHowTo(bus);

// --- Right-side sidebar (hidden until workspace loads) ---
const sidebarEl = document.getElementById('tool-sidebar');
sidebarEl.style.display = 'none';
const sidebar = new ElementarySidebar(sidebarEl, bus);

// --- Playback ---
const timeController = new TimeController(sim, bus);
const playbackControls = new PlaybackControls(
  document.getElementById('controls'), sim, timeController, bus
);

const speedSlider = document.getElementById('speed-slider');
const speedValue = document.getElementById('speed-value');
speedSlider.addEventListener('input', () => {
  sim.playbackSpeed = parseFloat(speedSlider.value);
  speedValue.textContent = sim.playbackSpeed + '\u00D7';
});

// --- Event wiring ---

bus.on('time:update', ({ currentTime }) => {
  workspace.drawTimeCursors(currentTime);
  workspace.drawFrames(currentTime);
});

bus.on('actor:edited', ({ actorId }) => {
  for (const panel of workspace.panels) {
    if (panel.linkedActors.some(a => a.id === actorId)) {
      if (panel.component && panel.component.redraw) {
        panel.component.redraw();
      }
    }
  }
});

bus.on('actors:changed', () => {
  // Auto-link new actors to panels (only if not in challenge mode)
  if (!activeChallengeMode) {
    for (const actor of sim.actors) {
      for (const panel of workspace.panels) {
        panel.linkActor(actor); // deduplicates internally
      }
    }
  }
  workspace.redrawAll();
  workspace.drawFrames(sim.currentTime);
});

// When the world is panned, redraw world panels only.
// Position graph keeps its own fixed range — panning the world is just for
// looking around, it shouldn't shift the graph axis numbers.
bus.on('posrange:changed', () => {
  workspace.drawFrames(sim.currentTime);
});

bus.on('actor:removed', ({ actorId }) => {
  for (const panel of workspace.panels) {
    panel.unlinkActor(actorId);
  }
});

// Clear all blocks
bus.on('blocks:clear-all', () => {
  for (const actor of sim.actors) {
    if (actor.readOnly) continue;
    const model = new UnifixBlockModel(actor);
    model.clearAll();
    model.rebuildPLF();
    bus.emit('actor:edited', { actorId: actor.id });
  }
});

// --- Save / Load / New buttons ---
document.getElementById('btn-save').addEventListener('click', () => {
  TemplateIO.saveToFile(sim, workspace);
});

document.getElementById('btn-load').addEventListener('click', async () => {
  const data = await TemplateIO.loadFromFile();
  if (!data) return;

  // Dismiss world selector overlay if showing
  const overlay = workspaceEl.querySelector('.elementary-selector-overlay');
  if (overlay) overlay.remove();

  TemplateIO.reconstruct(data, sim, workspace, panelFactory, blockInteraction, bus, createPanel);

  // Update speed slider to match loaded state
  speedSlider.value = sim.playbackSpeed;
  speedValue.textContent = sim.playbackSpeed + '\u00D7';

  // Show sidebar if it was hidden (from selector phase)
  sidebarEl.style.display = '';
});

document.getElementById('btn-new').addEventListener('click', () => {
  resetToBlank();
});

// --- Language toggle ---
const langBtn = document.getElementById('btn-lang');
function updateLangButton() {
  langBtn.textContent = getLanguage().toUpperCase();
}
updateLangButton();

langBtn.addEventListener('click', () => {
  const next = getLanguage() === 'en' ? 'es' : 'en';
  setLanguage(next);
  updateLangButton();

  // Update controls bar labels
  _updateControlsLabels();

  // Update palette bar buttons
  howToBtn.textContent = t('howTo');
  aboutBtn.textContent = t('about');

  // Notify all components to re-render
  bus.emit('language:changed');
});

// Update translatable labels in the controls bar (HTML-defined elements)
function _updateControlsLabels() {
  document.getElementById('btn-reset').dataset.tooltip = t('reset');
  document.getElementById('btn-step-back').dataset.tooltip = t('stepBack');
  document.getElementById('btn-play').dataset.tooltip = t('playPause');
  document.getElementById('btn-step-fwd').dataset.tooltip = t('stepForward');
  document.getElementById('btn-save').dataset.tooltip = t('save');
  document.getElementById('btn-load').dataset.tooltip = t('open');
  document.getElementById('btn-new').dataset.tooltip = t('newBtn');

  // Time and Speed labels
  const timeDisplay = document.querySelector('.time-display');
  if (timeDisplay) {
    const timeVal = document.getElementById('time-value');
    timeDisplay.firstChild.textContent = t('time') + ' ';
  }
  const speedLabel = document.querySelector('.speed-control');
  if (speedLabel) {
    speedLabel.firstChild.textContent = t('speed') + ' ';
  }
}

// Set initial labels from current language
_updateControlsLabels();

// --- Challenge Author Mode ---
let activeAuthorMode = null;
const appShell = document.querySelector('.app-shell');

bus.on('challenge:author-start', ({ type }) => {
  activeAuthorMode = new ElementaryAuthorMode(appShell, {
    onBroadcast: async (challengeData) => {
      try {
        const ownerToken = SessionStore.generateOwnerToken();
        const title = challengeData.meta?.title || 'Elementary Challenge';
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
            sim.targetSegments = (challengeData.targetSegments || []).map(s => ({ ...s }));
            if (activeAuthorMode) {
              activeAuthorMode.exit({ skipOnExit: true });
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
      sim.targetSegments = (challengeData.targetSegments || []).map(s => ({ ...s }));
      if (activeAuthorMode) {
        activeAuthorMode.exit({ skipOnExit: true });
        activeAuthorMode = null;
      }
      bus.emit('challenge:show-results', { submissions, challengeData, roomCode: 'practice' });
    },

    onExit: () => {
      activeAuthorMode = null;
      new ElementaryWorldSelector(workspaceEl, sim, bus);
    },
  });

  activeAuthorMode.enter(type);
  window._authorMode = activeAuthorMode;
});

// --- Student Join ---
bus.on('challenge:join-request', async () => {
  const joinDialog = new JoinDialog();
  const result = await joinDialog.show();
  if (!result) {
    new ElementaryWorldSelector(workspaceEl, sim, bus);
    return;
  }

  const { roomCode, initials, challengeData, settings, animalType, color } = result;
  sim.targetSegments = (challengeData.targetSegments || []).map(s => ({ ...s }));

  TemplateIO.reconstruct(challengeData, sim, workspace, panelFactory, blockInteraction, bus, createPanel);
  speedSlider.value = sim.playbackSpeed;
  speedValue.textContent = sim.playbackSpeed + '\u00D7';
  sidebarEl.style.display = '';

  // Apply student's chosen animal/color to their actor(s)
  if (animalType || color) {
    const refIds = new Set((challengeData.referenceActors || []).map(r => r.id));
    for (const actor of sim.actors) {
      if (!refIds.has(actor.id)) {
        if (animalType) actor.animalType = animalType;
        if (color) actor.color = color;
      }
    }
    // Don't emit actors:changed here — it would re-link all actors to all
    // panels (since activeChallengeMode isn't set yet), undoing per-panel
    // linkage from the challenge. Just redraw to pick up the new color/animal.
    workspace.redrawAll();
    workspace.drawFrames(sim.currentTime);
  }

  activeChallengeMode = new ChallengeMode(bus, workspace, sim);
  activeChallengeMode.activate(challengeData, settings, initials, roomCode);

  const studentId = `${initials}-${Date.now()}`;
  activeSubmitter = new StudentSubmitter(firebaseClient, roomCode, studentId, initials);

  const submitBtn = activeChallengeMode.getSubmitButton();
  let viewResultsBtn = null;
  if (submitBtn) {
    submitBtn.addEventListener('click', async () => {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Submitting...';
      try {
        await activeSubmitter.submit(sim);
        submitBtn.textContent = activeSubmitter.version > 1 ? 'Resubmitted ✓' : 'Submitted ✓';
        submitBtn.classList.add('submit-success');
        setTimeout(() => {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Resubmit';
          submitBtn.classList.remove('submit-success');
        }, 2000);

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
      }
    });
  }
});

// --- Results display ---
bus.on('challenge:show-results', ({ submissions, challengeData, roomCode }) => {
  if (!submissions) { alert('No submissions yet.'); return; }

  activeResultsCtrl = new ResultsViewController(bus, workspace, sim, createPanel, blockInteraction);
  activeResultsCtrl.enterResultsMode(submissions, challengeData?.resultsConfig);

  if (roomCode && roomCode !== 'practice') {
    activeResultsRoomCode = roomCode;
    if (activeRoomCodeBar) activeRoomCodeBar.remove();
    activeRoomCodeBar = new RoomCodeBar(workspaceEl, roomCode, {
      onCollectAgain: async () => {
        const subs = await roomManager.getSubmissions(roomCode);
        if (!subs) { alert('No submissions found.'); return; }
        if (activeResultsCtrl) activeResultsCtrl.exitResultsMode();
        activeResultsCtrl = new ResultsViewController(bus, workspace, sim, createPanel, blockInteraction);
        activeResultsCtrl.enterResultsMode(subs, challengeData?.resultsConfig);
      },
      onCloseRoom: async () => {
        await roomManager.closeRoom(roomCode);
      },
    });
    activeRoomCodeBar.startPolling(
      () => roomManager.getSubmissionCount(roomCode),
      15000
    );
    SessionStore.updateLastAccessed(roomCode);
  }
});

// --- Session re-open ---
bus.on('session:reopen-request', () => {
  const dialog = new SessionHistoryDialog(roomManager, ({ roomCode, challengeData, submissions }) => {
    TemplateIO.reconstruct(challengeData, sim, workspace, panelFactory, blockInteraction, bus, createPanel);
    speedSlider.value = sim.playbackSpeed;
    speedValue.textContent = sim.playbackSpeed + '\u00D7';
    sim.targetSegments = (challengeData.targetSegments || []).map(s => ({ ...s }));

    activeResultsCtrl = new ResultsViewController(bus, workspace, sim, createPanel, blockInteraction);
    activeResultsCtrl.enterResultsMode(submissions, challengeData?.resultsConfig);

    activeResultsRoomCode = roomCode;
    if (activeRoomCodeBar) activeRoomCodeBar.remove();
    activeRoomCodeBar = new RoomCodeBar(workspaceEl, roomCode, {
      onCollectAgain: async () => {
        const subs = await roomManager.getSubmissions(roomCode);
        if (!subs) { alert('No submissions found.'); return; }
        if (activeResultsCtrl) activeResultsCtrl.exitResultsMode();
        activeResultsCtrl = new ResultsViewController(bus, workspace, sim, createPanel, blockInteraction);
        activeResultsCtrl.enterResultsMode(subs, challengeData?.resultsConfig);
      },
      onCloseRoom: async () => {
        await roomManager.closeRoom(roomCode);
      },
    });
    activeRoomCodeBar.startPolling(
      () => roomManager.getSubmissionCount(roomCode),
      15000
    );
  });
  dialog.show();
});

// --- URL join: ?join=XXXX ---
{
  const params = new URLSearchParams(window.location.search);
  const joinCode = params.get('join');
  if (joinCode && /^\d{4,6}$/.test(joinCode)) {
    const cleanUrl = window.location.origin + window.location.pathname;
    history.replaceState(null, '', cleanUrl);

    const wsOverlay = workspaceEl.querySelector('.elementary-selector-overlay');
    if (wsOverlay) wsOverlay.remove();

    const joinDialog = new JoinDialog();
    joinDialog.showWithCode(joinCode).then(result => {
      if (!result) {
        new ElementaryWorldSelector(workspaceEl, sim, bus);
        return;
      }
      const { roomCode, initials, challengeData, settings, animalType, color } = result;
      sim.targetSegments = (challengeData.targetSegments || []).map(s => ({ ...s }));
      TemplateIO.reconstruct(challengeData, sim, workspace, panelFactory, blockInteraction, bus, createPanel);
      speedSlider.value = sim.playbackSpeed;
      speedValue.textContent = sim.playbackSpeed + '\u00D7';
      sidebarEl.style.display = '';

      // Apply student's chosen animal/color
      if (animalType || color) {
        const refIds = new Set((challengeData.referenceActors || []).map(r => r.id));
        for (const actor of sim.actors) {
          if (!refIds.has(actor.id)) {
            if (animalType) actor.animalType = animalType;
            if (color) actor.color = color;
          }
        }
        workspace.redrawAll();
        workspace.drawFrames(sim.currentTime);
      }

      activeChallengeMode = new ChallengeMode(bus, workspace, sim);
      activeChallengeMode.activate(challengeData, settings, initials, roomCode);
      const studentId = `${initials}-${Date.now()}`;
      activeSubmitter = new StudentSubmitter(firebaseClient, roomCode, studentId, initials);
      const submitBtn = activeChallengeMode.getSubmitButton();
      if (submitBtn) {
        submitBtn.addEventListener('click', async () => {
          submitBtn.disabled = true;
          submitBtn.textContent = 'Submitting...';
          try {
            await activeSubmitter.submit(sim);
            submitBtn.textContent = 'Submitted ✓';
            submitBtn.classList.add('submit-success');
            setTimeout(() => {
              submitBtn.disabled = false;
              submitBtn.textContent = 'Resubmit';
              submitBtn.classList.remove('submit-success');
            }, 2000);
          } catch (err) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Submit (retry)';
          }
        });
      }
    });
  }
}

// --- Tooltips ---
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

workspace.drawTimeCursors(0);

// Debug
window._sim = sim;
window._bus = bus;
window._workspace = workspace;
