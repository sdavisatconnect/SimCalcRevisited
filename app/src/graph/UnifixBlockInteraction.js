import { UnifixBlockModel } from './UnifixBlockModel.js';

/**
 * Handles mouse and drag events for unifix cube block manipulation.
 * Interaction modes:
 *  1. Drag from sidebar: drop a single block on the next available slot
 *  2. Pointer mode: click-and-drag existing blocks to reposition
 *  3. Eraser mode: click on a block to remove it
 *  4. Drag-over feedback: single ghost block at the next available slot
 */
export class UnifixBlockInteraction {
  constructor(simulation, bus) {
    this.sim = simulation;
    this.bus = bus;
    this.graphs = new Map(); // panelId -> { svg, component, listeners }
    this._activeTool = 'pointer'; // 'pointer' or 'eraser'
    this._dragState = null; // { actor, sourceCol, sourceRow, entry }

    bus.on('tool:changed', ({ tool }) => {
      this._activeTool = tool;
    });
  }

  /**
   * Register a UnifixVelocityGraph for interaction.
   */
  registerGraph(panelId, svg, graphComponent) {
    const entry = {
      svg,
      component: graphComponent,
      listeners: {}
    };

    // Sidebar drag-and-drop handlers
    entry.listeners.dragover = (e) => this._handleToolDragOver(e, entry);
    entry.listeners.dragleave = (e) => this._handleToolDragLeave(e, entry);
    entry.listeners.drop = (e) => this._handleToolDrop(e, entry);

    // Mouse handlers for block manipulation (drag-to-move + eraser click)
    entry.listeners.mousedown = (e) => this._handleMouseDown(e, entry);
    entry.listeners.mousemove = (e) => this._handleMouseMove(e, entry);
    entry.listeners.mouseup = (e) => this._handleMouseUp(e, entry);
    entry.listeners.mouseleave = (e) => this._handleMouseLeave(e, entry);

    svg.addEventListener('dragover', entry.listeners.dragover);
    svg.addEventListener('dragleave', entry.listeners.dragleave);
    svg.addEventListener('drop', entry.listeners.drop);
    svg.addEventListener('mousedown', entry.listeners.mousedown);
    svg.addEventListener('mousemove', entry.listeners.mousemove);
    svg.addEventListener('mouseup', entry.listeners.mouseup);
    svg.addEventListener('mouseleave', entry.listeners.mouseleave);

    this.graphs.set(panelId, entry);
  }

  unregisterGraph(panelId) {
    const entry = this.graphs.get(panelId);
    if (!entry) return;
    for (const [evt, fn] of Object.entries(entry.listeners)) {
      entry.svg.removeEventListener(evt, fn);
    }
    this.graphs.delete(panelId);
  }

  // ──── Sidebar drag-over: single ghost block ────

  _handleToolDragOver(e, entry) {
    if (!this._isBlockToolDrag(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    entry.svg.classList.add('unifix-drop-target');

    const { col } = this._screenToGridCell(e, entry);
    if (col < 0) return;

    const actor = this._getEditableActor(entry);
    if (!actor) return;

    // Compute next available slot (on top of existing stack)
    const data = this._screenToData(e, entry);
    const sign = data.v >= 0 ? 1 : -1;
    const model = new UnifixBlockModel(actor);
    const currentHeight = model.getBlockCount(col);
    let targetRow;

    if (currentHeight === 0) {
      // Empty column — place at ±1
      targetRow = sign;
    } else if (Math.sign(currentHeight) === sign) {
      // Same sign — stack on top
      targetRow = currentHeight + sign;
    } else {
      // Hovering on opposite side of existing blocks — place at ±1 on that side
      targetRow = sign;
    }

    entry.component.showGhost(col, targetRow, actor.color);
  }

  _handleToolDragLeave(e, entry) {
    if (entry.svg.contains(e.relatedTarget)) return;
    entry.svg.classList.remove('unifix-drop-target');
    entry.component.clearGhost();
  }

  // ──── Sidebar drop: place single block ────

  _handleToolDrop(e, entry) {
    entry.svg.classList.remove('unifix-drop-target');
    entry.component.clearGhost();

    const toolData = e.dataTransfer.getData('text/graph-tool');
    if (!toolData) return;
    let parsed;
    try { parsed = JSON.parse(toolData); } catch { return; }
    const blockTools = ['add-block', 'add-segment', 'add-ramp-up', 'add-ramp-down'];
    if (!blockTools.includes(parsed.tool)) return;

    e.preventDefault();
    e.stopPropagation();

    const actor = this._getEditableActor(entry);
    if (!actor) return;

    const { col } = this._screenToGridCell(e, entry);
    const data = this._screenToData(e, entry);
    const sign = data.v >= 0 ? 1 : -1;

    const model = new UnifixBlockModel(actor);
    const currentHeight = model.getBlockCount(col);

    let targetRow;
    if (model.hasConflict(col)) {
      // Already conflicting — add to existing conflict
      const conflict = model.getConflicts().get(col);
      if (sign > 0) conflict.pos++;
      else conflict.neg++;
      model.setConflict(col, conflict.pos, conflict.neg);
      model.rebuildPLF();
    } else if (currentHeight === 0) {
      targetRow = sign;
      model.setColumn(col, targetRow);
      model.rebuildPLF();
    } else if (Math.sign(currentHeight) === sign) {
      targetRow = currentHeight + sign;
      model.setColumn(col, targetRow);
      model.rebuildPLF();
    } else {
      // Opposite side — create conflict instead of clearing
      const posCount = currentHeight > 0 ? Math.abs(currentHeight) : 1;
      const negCount = currentHeight < 0 ? Math.abs(currentHeight) : 1;
      model.setConflict(col, posCount, negCount);
      model.rebuildPLF();
    }

    this.bus.emit('actor:edited', { actorId: actor.id });
    entry.component.redraw();
  }

  // ──── Mouse: block drag-to-move (pointer) / click-to-remove (eraser) ────

  _handleMouseDown(e, entry) {
    // Find which block was clicked
    const block = this._findBlockAt(e, entry);

    const actor = this._getEditableActor(entry);
    if (!actor) return;

    // Click on empty space in pointer mode → place a new block
    if (!block && this._activeTool === 'pointer') {
      const { col, row } = this._screenToGridCell(e, entry);
      if (col < 0 || col >= (this.sim.timeRange.max || 10)) return;
      // Only place if within the plot area
      const data = this._screenToData(e, entry);
      const plotArea = entry.component.graphRenderer.plotArea;
      const rect = entry.svg.getBoundingClientRect();
      const localX = e.clientX - rect.left;
      const localY = e.clientY - rect.top;
      if (localX < plotArea.x || localX > plotArea.x + plotArea.w) return;
      if (localY < plotArea.y || localY > plotArea.y + plotArea.h) return;

      const sign = data.v >= 0 ? 1 : -1;
      const model = new UnifixBlockModel(actor);
      const currentHeight = model.getBlockCount(col);

      if (model.hasConflict(col)) {
        const conflict = model.getConflicts().get(col);
        if (sign > 0) conflict.pos++;
        else conflict.neg++;
        model.setConflict(col, conflict.pos, conflict.neg);
      } else if (currentHeight === 0) {
        model.setColumn(col, sign);
      } else if (Math.sign(currentHeight) === sign) {
        model.setColumn(col, currentHeight + sign);
      } else {
        const posCount = currentHeight > 0 ? Math.abs(currentHeight) : 1;
        const negCount = currentHeight < 0 ? Math.abs(currentHeight) : 1;
        model.setConflict(col, posCount, negCount);
      }
      model.rebuildPLF();
      this.bus.emit('actor:edited', { actorId: actor.id });
      entry.component.redraw();
      e.preventDefault();
      return;
    }

    if (!block) return;

    const { col, row } = block;
    const model = new UnifixBlockModel(actor);
    const currentHeight = model.getBlockCount(col);

    if (this._activeTool === 'eraser') {
      // Eraser on conflict block: remove from conflict
      if (model.hasConflict(col)) {
        const conflict = model.getConflicts().get(col);
        if (row > 0) {
          conflict.pos = Math.max(0, row - 1);
        } else {
          conflict.neg = Math.max(0, Math.abs(row) - 1);
        }
        if (conflict.pos === 0 && conflict.neg === 0) {
          model.clearConflict(col);
        } else if (conflict.pos === 0) {
          model.clearConflict(col);
          model.setColumn(col, -conflict.neg);
        } else if (conflict.neg === 0) {
          model.clearConflict(col);
          model.setColumn(col, conflict.pos);
        } else {
          model.setConflict(col, conflict.pos, conflict.neg);
        }
        model.rebuildPLF();
      } else {
        model.removeFromColumn(col, row);
        model.rebuildPLF();
      }
      this.bus.emit('actor:edited', { actorId: actor.id });
      entry.component.redraw();
      return;
    }

    // Pointer mode: allow dragging from conflict columns to resolve them
    if (model.hasConflict(col)) {
      const conflict = model.getConflicts().get(col);
      // Only allow dragging the topmost block on the clicked side
      if (row > 0 && row !== conflict.pos) return;
      if (row < 0 && Math.abs(row) !== conflict.neg) return;

      this._dragState = { actor, sourceCol: col, sourceRow: row, entry };

      // Remove one block from the clicked side
      if (row > 0) {
        conflict.pos--;
      } else {
        conflict.neg--;
      }
      // Check if conflict is resolved
      if (conflict.pos === 0 && conflict.neg === 0) {
        model.clearConflict(col);
      } else if (conflict.pos === 0) {
        model.clearConflict(col);
        model.setColumn(col, -conflict.neg);
      } else if (conflict.neg === 0) {
        model.clearConflict(col);
        model.setColumn(col, conflict.pos);
      } else {
        model.setConflict(col, conflict.pos, conflict.neg);
      }
      model.rebuildPLF();
      entry.component.redraw();
      entry.component.showGhost(col, row, actor.color);
      entry.svg.style.cursor = 'grabbing';
      e.preventDefault();
      return;
    }

    // Only allow dragging the topmost block
    if (row !== currentHeight) return;

    // Start drag
    this._dragState = { actor, sourceCol: col, sourceRow: row, entry };

    // Visually remove the top block from source column
    const newHeight = currentHeight > 0 ? currentHeight - 1 : currentHeight + 1;
    model.setColumn(col, newHeight === 0 ? 0 : newHeight);
    model.rebuildPLF();
    entry.component.redraw();

    // Show ghost at current position
    entry.component.showGhost(col, row, actor.color);
    entry.svg.style.cursor = 'grabbing';

    e.preventDefault();
  }

  _handleMouseMove(e, entry) {
    if (!this._dragState || this._dragState.entry !== entry) return;

    const { col } = this._screenToGridCell(e, entry);
    const data = this._screenToData(e, entry);
    const sign = data.v >= 0 ? 1 : -1;

    const model = new UnifixBlockModel(this._dragState.actor);
    const currentHeight = model.getBlockCount(col);

    let targetRow;
    if (currentHeight === 0) {
      targetRow = sign;
    } else if (Math.sign(currentHeight) === sign) {
      targetRow = currentHeight + sign;
    } else {
      targetRow = sign;
    }

    entry.component.showGhost(col, targetRow, this._dragState.actor.color);
  }

  _handleMouseUp(e, entry) {
    if (!this._dragState || this._dragState.entry !== entry) return;

    entry.component.clearGhost();
    entry.svg.style.cursor = '';

    const { actor } = this._dragState;
    const { col } = this._screenToGridCell(e, entry);
    const data = this._screenToData(e, entry);
    const sign = data.v >= 0 ? 1 : -1;

    const model = new UnifixBlockModel(actor);
    const currentHeight = model.getBlockCount(col);

    if (model.hasConflict(col)) {
      const conflict = model.getConflicts().get(col);
      if (sign > 0) conflict.pos++;
      else conflict.neg++;
      model.setConflict(col, conflict.pos, conflict.neg);
    } else if (currentHeight === 0) {
      model.setColumn(col, sign);
    } else if (Math.sign(currentHeight) === sign) {
      model.setColumn(col, currentHeight + sign);
    } else {
      const posCount = currentHeight > 0 ? Math.abs(currentHeight) : 1;
      const negCount = currentHeight < 0 ? Math.abs(currentHeight) : 1;
      model.setConflict(col, posCount, negCount);
    }
    model.rebuildPLF();

    this._dragState = null;

    this.bus.emit('actor:edited', { actorId: actor.id });
    entry.component.redraw();
  }

  _handleMouseLeave(e, entry) {
    if (!this._dragState || this._dragState.entry !== entry) return;

    // Cancel drag — return block to source
    entry.component.clearGhost();
    entry.svg.style.cursor = '';

    const { actor, sourceCol, sourceRow } = this._dragState;
    const model = new UnifixBlockModel(actor);
    // Restore: return block to source column
    const currentHeight = model.getBlockCount(sourceCol);
    if (model.hasConflict(sourceCol)) {
      // Re-add to conflict
      const conflict = model.getConflicts().get(sourceCol);
      if (sourceRow > 0) conflict.pos++;
      else conflict.neg++;
      model.setConflict(sourceCol, conflict.pos, conflict.neg);
    } else if (currentHeight !== 0 && Math.sign(currentHeight) !== Math.sign(sourceRow)) {
      // Would create a new conflict
      const posCount = sourceRow > 0 ? 1 : Math.abs(currentHeight);
      const negCount = sourceRow < 0 ? 1 : Math.abs(currentHeight);
      model.setConflict(sourceCol, posCount, negCount);
    } else {
      model.setColumn(sourceCol, sourceRow);
    }
    model.rebuildPLF();

    this._dragState = null;

    this.bus.emit('actor:edited', { actorId: actor.id });
    entry.component.redraw();
  }

  // ──── Helpers ────

  _isBlockToolDrag(e) {
    return e.dataTransfer.types.includes('text/graph-tool');
  }

  /**
   * Convert event to grid cell {col, row}.
   */
  _screenToGridCell(e, entry) {
    const data = this._screenToData(e, entry);
    const col = Math.floor(data.t);
    let row = Math.round(data.v);
    if (row === 0) row = data.v >= 0 ? 1 : -1;
    const yRange = entry.component.graphRenderer.yRange;
    row = Math.max(yRange.min, Math.min(yRange.max, row));
    return { col: Math.max(0, col), row };
  }

  /**
   * Convert event to raw data coordinates {t, v} (not snapped).
   */
  _screenToData(e, entry) {
    const renderer = entry.component.graphRenderer;
    const rect = entry.svg.getBoundingClientRect();
    return renderer.toData(e.clientX - rect.left, e.clientY - rect.top);
  }

  /**
   * Find block data-col/data-row at the click target.
   */
  _findBlockAt(e, entry) {
    let target = e.target;
    while (target && target !== entry.svg) {
      if (target.hasAttribute('data-col') && target.hasAttribute('data-row')) {
        const col = parseInt(target.getAttribute('data-col'), 10);
        const row = parseInt(target.getAttribute('data-row'), 10);
        if (!isNaN(col) && !isNaN(row) && row !== 0) {
          return { col, row };
        }
      }
      target = target.parentNode;
    }
    return null;
  }

  _getEditableActor(entry) {
    for (const actor of entry.component.linkedActors) {
      if (!actor.readOnly) return actor;
    }
    return null;
  }
}
