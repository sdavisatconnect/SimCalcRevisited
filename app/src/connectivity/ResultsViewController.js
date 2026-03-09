import { Panel } from '../workspace/Panel.js';
import { ResultsManager } from './ResultsManager.js';
import { OverlaidGraphView } from './OverlaidGraphView.js';
import { TiledGraphView } from './TiledGraphView.js';
import { VisibilityPanel } from './VisibilityPanel.js';

/**
 * Coordinates the teacher's results display mode.
 * Creates world panel with all student actors, overlaid graph, tiled graph,
 * and visibility controls. Handles linked visibility across all views.
 *
 * Teacher's sim.actors are NOT modified — the actor palette continues to show
 * the original teacher actors. Student visibility is controlled via the sidebar.
 * Overlaid and tiled graph panels are full Panel instances (draggable/resizable).
 */
export class ResultsViewController {
  constructor(bus, workspace, simulation, createPanelFn, interactionMgr) {
    this.bus = bus;
    this.workspace = workspace;
    this.sim = simulation;
    this.createPanel = createPanelFn;
    this.interactionMgr = interactionMgr;
    this.students = [];
    this.allStudentActors = [];
    this.worldPanel = null;
    this.overlaidPanel = null;
    this.tiledPanel = null;
    this.overlaidView = null;
    this.tiledView = null;
    this.visibilityPanel = null;
    this._visibilityHandler = null;
  }

  /**
   * Enter results display mode.
   * Clears existing workspace and builds the results layout.
   * Does NOT modify sim.actors — teacher palette stays clean.
   * @param {object} submissions - raw Firebase submissions
   */
  enterResultsMode(submissions) {
    const resultsMgr = new ResultsManager(this.sim, this.bus);
    const { students } = resultsMgr.parseSubmissions(submissions);
    this.students = students;

    // Collect all student actors (kept separate from sim.actors)
    this.allStudentActors = [];
    for (const student of students) {
      for (const actor of student.actors) {
        this.allStudentActors.push({ actor, studentId: student.id });
      }
    }

    // Clear existing panels
    const panelsCopy = [...this.workspace.panels];
    for (const panel of panelsCopy) {
      this.interactionMgr.unregisterGraph(panel.id);
      this.workspace.removePanel(panel);
    }

    // Remove any lingering overlays (world selector, etc.)
    const overlay = this.workspace.container.querySelector('.world-selector-overlay');
    if (overlay) overlay.remove();

    // Build results layout (sim.actors unchanged — teacher actors stay in palette)
    this._buildLayout();

    // Listen for visibility changes
    this._visibilityHandler = ({ visibleIds }) => this._onVisibilityChanged(visibleIds);
    this.bus.on('results:visibility-changed', this._visibilityHandler);
  }

  _buildLayout() {
    const wsEl = this.workspace.container;
    const wsRect = wsEl.getBoundingClientRect();
    const wsW = wsRect.width;
    const wsH = wsRect.height;

    // 1. World panel (top, full width)
    const worldH = Math.floor(wsH * 0.3);
    this.worldPanel = this.createPanel('world', {
      x: 10, y: 10,
      width: wsW - 20,
      height: worldH,
      actorIds: [], // don't link via Panel's actor dropdown
    });
    // Set world component actors directly (bypasses actor dropdown UI)
    const allActors = this.allStudentActors.map(a => a.actor);
    this.worldPanel.component.setLinkedActors(allActors);
    // Hide actor selector — students are controlled via sidebar visibility panel
    this.worldPanel.actorSelectorEl.style.display = 'none';

    // 2. Overlaid graph panel (real Panel — draggable & resizable)
    const graphTop = worldH + 20;
    const graphH = wsH - graphTop - 10;
    const halfW = Math.floor((wsW - 30) / 2);
    this._createOverlaidPanel(10, graphTop, halfW, graphH, 'position');

    // 3. Tiled graph panel (real Panel — draggable & resizable)
    this._createTiledPanel(halfW + 20, graphTop, halfW, graphH, 'position');

    // 4. Visibility panel in the sidebar
    const sidebar = document.getElementById('tool-sidebar');
    if (sidebar) {
      sidebar.innerHTML = '';
      const visContainer = document.createElement('div');
      visContainer.className = 'results-visibility-container';
      sidebar.appendChild(visContainer);
      this.visibilityPanel = new VisibilityPanel(visContainer, this.bus, this.students);
    }
  }

  _createOverlaidPanel(x, y, w, h, graphType) {
    const typeName = graphType === 'position' ? 'Position (P/T)' : 'Velocity (V/T)';

    const panel = new Panel({
      id: 'results-overlaid-' + Date.now(),
      title: `Overlaid — ${typeName}`,
      type: 'results-overlaid',
      x, y, width: w, height: h,
      onClose: null,
      onFocus: (p) => this.workspace.bringToFront(p),
      bus: this.bus,
      simulation: this.sim,
    });

    // Hide actor selector and close button — not needed for results panels
    panel.actorSelectorEl.style.display = 'none';
    panel.closeBtn.style.display = 'none';

    // Create the overlaid graph view component
    this.overlaidView = new OverlaidGraphView(panel.contentEl, this.sim, this.students, graphType);
    panel.component = this.overlaidView;

    // Add to workspace (triggers refresh after DOM insertion)
    this.workspace.addPanel(panel);
    this.overlaidPanel = panel;
  }

  _createTiledPanel(x, y, w, h, graphType) {
    const typeName = graphType === 'position' ? 'Position (P/T)' : 'Velocity (V/T)';

    const panel = new Panel({
      id: 'results-tiled-' + Date.now(),
      title: `All Students — ${typeName}`,
      type: 'results-tiled',
      x, y, width: w, height: h,
      onClose: null,
      onFocus: (p) => this.workspace.bringToFront(p),
      bus: this.bus,
      simulation: this.sim,
    });

    // Hide actor selector and close button — not needed for results panels
    panel.actorSelectorEl.style.display = 'none';
    panel.closeBtn.style.display = 'none';

    // Create the tiled graph view component
    this.tiledView = new TiledGraphView(panel.contentEl, this.sim, this.students, graphType);
    panel.component = this.tiledView;

    // Add to workspace (triggers refresh after DOM insertion)
    this.workspace.addPanel(panel);
    this.tiledPanel = panel;
  }

  _onVisibilityChanged(visibleIds) {
    const visibleSet = new Set(visibleIds);

    // Update world panel linked actors
    if (this.worldPanel && this.worldPanel.component) {
      const visibleActors = this.allStudentActors
        .filter(a => visibleSet.has(a.studentId))
        .map(a => a.actor);
      this.worldPanel.component.setLinkedActors(visibleActors);
    }

    // Update overlaid view
    if (this.overlaidView) {
      this.overlaidView.setVisibleStudents(visibleIds);
    }

    // Update tiled view
    if (this.tiledView) {
      this.tiledView.setVisibleStudents(visibleIds);
    }
  }

  exitResultsMode() {
    if (this._visibilityHandler) {
      this.bus.off('results:visibility-changed', this._visibilityHandler);
    }

    // Remove all results panels from workspace (proper Panel cleanup)
    const panelsToRemove = [this.worldPanel, this.overlaidPanel, this.tiledPanel].filter(Boolean);
    for (const panel of panelsToRemove) {
      this.interactionMgr.unregisterGraph(panel.id);
      this.workspace.removePanel(panel);
    }
    this.worldPanel = null;
    this.overlaidPanel = null;
    this.tiledPanel = null;
    this.overlaidView = null;
    this.tiledView = null;

    // Restore sidebar
    const sidebar = document.getElementById('tool-sidebar');
    if (sidebar) sidebar.innerHTML = '';
  }
}
