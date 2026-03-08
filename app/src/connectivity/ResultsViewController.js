import { ResultsManager } from './ResultsManager.js';
import { OverlaidGraphView } from './OverlaidGraphView.js';
import { TiledGraphView } from './TiledGraphView.js';
import { VisibilityPanel } from './VisibilityPanel.js';

/**
 * Coordinates the teacher's results display mode.
 * Creates world panel with all student actors, overlaid graph, tiled graph,
 * and visibility controls. Handles linked visibility across all views.
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
    this.overlaidView = null;
    this.tiledView = null;
    this.visibilityPanel = null;
    this._visibilityHandler = null;
  }

  /**
   * Enter results display mode.
   * Clears existing workspace and builds the results layout.
   * @param {object} submissions - raw Firebase submissions
   */
  enterResultsMode(submissions) {
    const resultsMgr = new ResultsManager(this.sim, this.bus);
    const { students } = resultsMgr.parseSubmissions(submissions);
    this.students = students;

    // Collect all student actors
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

    // Clear existing actors and add student actors
    this.sim.actors = [];
    for (const { actor } of this.allStudentActors) {
      this.sim.addActor(actor);
    }
    this.bus.emit('actors:changed');

    // Build results layout
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

    // Layout: world panel across top, overlaid graph left, tiled graph right
    // Visibility panel in the sidebar

    // 1. World panel (top, full width)
    const worldH = Math.floor(wsH * 0.3);
    this.worldPanel = this.createPanel('world', {
      x: 10, y: 10,
      width: wsW - 20,
      height: worldH,
      actorIds: this.allStudentActors.map(a => a.actor.id),
    });

    // 2. Results panels container (below world)
    const graphTop = worldH + 20;
    const graphH = wsH - graphTop - 10;
    const halfW = Math.floor((wsW - 30) / 2);

    // Create overlaid graph panel (position)
    this._createOverlaidPanel(10, graphTop, halfW, graphH, 'position');

    // Create tiled graph panel (position)
    this._createTiledPanel(halfW + 20, graphTop, halfW, graphH, 'position');

    // 3. Visibility panel in the sidebar
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
    // Create a lightweight panel-like div (not a full Panel, to avoid interaction manager complexity)
    const el = document.createElement('div');
    el.className = 'results-panel overlaid-panel';
    el.style.cssText = `position: absolute; left: ${x}px; top: ${y}px; width: ${w}px; height: ${h}px;`;

    const titleBar = document.createElement('div');
    titleBar.className = 'results-panel-title';
    const typeName = graphType === 'position' ? 'Position (P/T)' : 'Velocity (V/T)';
    titleBar.textContent = `All Students — ${typeName} (Overlaid)`;
    el.appendChild(titleBar);

    const content = document.createElement('div');
    content.className = 'results-panel-content';
    el.appendChild(content);

    this.workspace.container.appendChild(el);

    this.overlaidView = new OverlaidGraphView(content, this.sim, this.students, graphType);
  }

  _createTiledPanel(x, y, w, h, graphType) {
    const el = document.createElement('div');
    el.className = 'results-panel tiled-panel';
    el.style.cssText = `position: absolute; left: ${x}px; top: ${y}px; width: ${w}px; height: ${h}px;`;

    const titleBar = document.createElement('div');
    titleBar.className = 'results-panel-title';
    const typeName = graphType === 'position' ? 'Position (P/T)' : 'Velocity (V/T)';
    titleBar.textContent = `All Students — ${typeName} (Tiled)`;
    el.appendChild(titleBar);

    const content = document.createElement('div');
    content.className = 'results-panel-content';
    el.appendChild(content);

    this.workspace.container.appendChild(el);

    this.tiledView = new TiledGraphView(content, this.sim, this.students, graphType);
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

    // Clean up results panels
    const resultsPanels = this.workspace.container.querySelectorAll('.results-panel');
    for (const el of resultsPanels) el.remove();

    // Restore sidebar
    const sidebar = document.getElementById('tool-sidebar');
    if (sidebar) sidebar.innerHTML = '';
  }
}
