import { UnifixBlockModel } from './UnifixBlockModel.js';

/**
 * Handles mouse and drag events for unifix cube block manipulation.
 * Simplified interaction manager specifically for the snap-to-grid
 * unifix block velocity graph in the elementary SimCalc edition.
 *
 * Interaction modes:
 *  1. Drag from sidebar: drop a block tool to add blocks to a column
 *  2. Click to remove: click an existing block to remove it and everything above/below
 *  3. Drag-over feedback: ghost preview of where blocks would be placed
 */
export class UnifixBlockInteraction {
  constructor(simulation, bus) {
    this.sim = simulation;
    this.bus = bus;
    this.graphs = new Map(); // panelId -> { svg, component, listeners }
  }

  /**
   * Register a UnifixVelocityGraph for interaction.
   * @param {string} panelId
   * @param {SVGElement} svg
   * @param {import('./UnifixVelocityGraph.js').UnifixVelocityGraph} graphComponent
   */
  registerGraph(panelId, svg, graphComponent) {
    // Build bound handlers so we can remove them later
    const entry = {
      svg,
      component: graphComponent,
      listeners: {}
    };

    entry.listeners.dragover = (e) => this._handleToolDragOver(e, entry);
    entry.listeners.dragleave = (e) => this._handleToolDragLeave(e, entry);
    entry.listeners.drop = (e) => this._handleToolDrop(e, entry);
    entry.listeners.click = (e) => this._handleClick(e, entry);

    svg.addEventListener('dragover', entry.listeners.dragover);
    svg.addEventListener('dragleave', entry.listeners.dragleave);
    svg.addEventListener('drop', entry.listeners.drop);
    svg.addEventListener('click', entry.listeners.click);

    this.graphs.set(panelId, entry);
  }

  /**
   * Unregister a graph panel and remove its event listeners.
   */
  unregisterGraph(panelId) {
    const entry = this.graphs.get(panelId);
    if (!entry) return;

    entry.svg.removeEventListener('dragover', entry.listeners.dragover);
    entry.svg.removeEventListener('dragleave', entry.listeners.dragleave);
    entry.svg.removeEventListener('drop', entry.listeners.drop);
    entry.svg.removeEventListener('click', entry.listeners.click);

    this.graphs.delete(panelId);
  }

  // ---- Drag-over: ghost preview ----

  _handleToolDragOver(e, entry) {
    // Check whether this is a valid block tool drag
    if (!this._isBlockToolDrag(e)) return;

    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    entry.svg.classList.add('unifix-drop-target');

    // Compute target grid cell
    const { col, row } = this._screenToGridCell(e, entry);
    if (col < 0) return;

    // Find the first editable actor
    const actor = this._getEditableActor(entry);
    if (!actor) return;

    entry.component.showGhost(col, row, actor.color);
  }

  _handleToolDragLeave(e, entry) {
    // Only act when truly leaving the SVG (not entering a child element)
    if (entry.svg.contains(e.relatedTarget)) return;

    entry.svg.classList.remove('unifix-drop-target');
    entry.component.clearGhost();
  }

  // ---- Drop: place blocks ----

  _handleToolDrop(e, entry) {
    entry.svg.classList.remove('unifix-drop-target');
    entry.component.clearGhost();

    // Validate tool type
    const toolData = e.dataTransfer.getData('text/graph-tool');
    if (!toolData) return;

    let parsed;
    try {
      parsed = JSON.parse(toolData);
    } catch {
      return;
    }

    if (parsed.tool !== 'add-block') return;

    e.preventDefault();
    e.stopPropagation();

    const actor = this._getEditableActor(entry);
    if (!actor) return;

    const { col, row } = this._screenToGridCell(e, entry);
    if (row === 0) return; // dropping on zero line does nothing

    const model = new UnifixBlockModel(actor);
    model.addBlocksToColumn(col, row);
    model.rebuildPLF();

    this.bus.emit('actor:edited', { actorId: actor.id });
    entry.component.redraw();
  }

  // ---- Click: remove blocks ----

  _handleClick(e, entry) {
    // Walk up from the click target to find a unifix-block element
    let target = e.target;
    let col = null;
    let row = null;

    // Check the target and its ancestors (within the SVG) for data attributes
    while (target && target !== entry.svg) {
      if (target.hasAttribute('data-col') && target.hasAttribute('data-row')) {
        col = parseInt(target.getAttribute('data-col'), 10);
        row = parseInt(target.getAttribute('data-row'), 10);
        break;
      }
      target = target.parentNode;
    }

    if (col === null || row === null) return;
    if (isNaN(col) || isNaN(row) || row === 0) return;

    const actor = this._getEditableActor(entry);
    if (!actor) return;

    const model = new UnifixBlockModel(actor);
    model.removeFromColumn(col, row);
    model.rebuildPLF();

    this.bus.emit('actor:edited', { actorId: actor.id });
    entry.component.redraw();
  }

  // ---- Helpers ----

  /**
   * Check whether the current drag event carries a valid block tool payload.
   * During dragover, dataTransfer content is not readable (browser security),
   * so we check the available types instead.
   */
  _isBlockToolDrag(e) {
    return e.dataTransfer.types.includes('text/graph-tool');
  }

  /**
   * Convert a mouse/drag event position to the nearest integer grid cell.
   * Returns {col, row} where col = time column (integer) and row = velocity row (integer).
   * Row is clamped to the current y-range.
   */
  _screenToGridCell(e, entry) {
    const renderer = entry.component.graphRenderer;
    const rect = entry.svg.getBoundingClientRect();
    const svgX = e.clientX - rect.left;
    const svgY = e.clientY - rect.top;
    const data = renderer.toData(svgX, svgY);

    const col = Math.floor(data.t);
    let row = Math.round(data.v);

    // Don't allow row = 0 from rounding; nudge to +1 or -1 based on actual position
    if (row === 0) {
      row = data.v >= 0 ? 1 : -1;
    }

    // Clamp to the current y-axis range
    const yRange = renderer.yRange;
    row = Math.max(yRange.min, Math.min(yRange.max, row));

    return { col: Math.max(0, col), row };
  }

  /**
   * Find the first editable (non-readonly) linked actor for a graph entry.
   */
  _getEditableActor(entry) {
    const actors = entry.component.linkedActors;
    for (const actor of actors) {
      if (!actor.readOnly) return actor;
    }
    return null;
  }
}
