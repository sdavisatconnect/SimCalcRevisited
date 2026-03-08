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

// --- Setup ---
const bus = new EventBus();
const sim = new Simulation();

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

  // Remove all panels
  const panelsCopy = [...workspace.panels];
  for (const panel of panelsCopy) {
    interactionMgr.unregisterGraph(panel.id);
    workspace.removePanel(panel);
  }

  // Remove all actors
  sim.actors = [];
  sim.worldType = null;
  bus.emit('actors:changed');

  // Reset speed
  sim.playbackSpeed = 1.0;
  speedSlider.value = 1;
  speedValue.textContent = '1\u00D7';

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

// Initial time cursors
workspace.drawTimeCursors(0);

// Debug: expose for console testing
window._sim = sim;
window._bus = bus;
window._workspace = workspace;
window._timeController = timeController;
window._toolSidebar = toolSidebar;
