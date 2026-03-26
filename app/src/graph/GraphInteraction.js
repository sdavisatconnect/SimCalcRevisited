/**
 * Manages drag interactions across all graph panels in the workspace.
 * Each graph panel registers itself here. Edits on any graph propagate to all
 * panels that share the same actor.
 *
 * Supports three tool modes:
 *  - 'pointer': drag control points to edit values (default)
 *  - 'eraser': click on a control point / segment handle to erase it
 *
 * Registered graph types: 'position', 'velocity', 'acceleration'
 *
 * Add-point is handled via drag-and-drop from the sidebar (not a click mode).
 */
export class GraphInteractionManager {
  constructor(simulation, bus, workspace) {
    this.sim = simulation;
    this.bus = bus;
    this.workspace = workspace;
    this.graphs = []; // { panelId, component, type }
    this.dragState = null;
    this.activeTool = 'pointer';

    // Drag-from-sidebar state (bus-based since HTML5 drag security
    // prevents reading dataTransfer during dragover)
    this._dragToolTarget = null;

    this._onPointerMove = this._handlePointerMove.bind(this);
    this._onPointerUp = this._handlePointerUp.bind(this);

    // Listen for tool changes from ToolSidebar
    this.bus.on('tool:changed', ({ tool }) => {
      this.activeTool = tool;
      this._updateGraphCursors();
    });

    // Listen for sidebar tool drag start/end
    this.bus.on('tool:drag-start', ({ targetGraphType }) => {
      this._dragToolTarget = targetGraphType;
    });

    this.bus.on('tool:drag-end', () => {
      this._dragToolTarget = null;
      // Clean up any lingering CSS classes
      for (const entry of this.graphs) {
        entry.component.svg.classList.remove('drop-valid', 'drop-invalid');
      }
    });
  }

  registerGraph(panelId, component, type) {
    const entry = { panelId, component, type };
    this.graphs.push(entry);

    const svg = component.svg;
    svg.addEventListener('pointerdown', (e) => this._handlePointerDown(e, entry));
    svg.addEventListener('click', (e) => this._handleClick(e, entry));

    // Drag-and-drop from sidebar tools
    svg.addEventListener('dragover', (e) => this._handleToolDragOver(e, entry));
    svg.addEventListener('dragleave', (e) => this._handleToolDragLeave(e, entry));
    svg.addEventListener('drop', (e) => this._handleToolDrop(e, entry));
  }

  unregisterGraph(panelId) {
    this.graphs = this.graphs.filter(g => g.panelId !== panelId);
  }

  /** Update CSS classes on graph SVGs to reflect current tool */
  _updateGraphCursors() {
    for (const entry of this.graphs) {
      const svg = entry.component.svg;
      svg.classList.toggle('delete-mode', this.activeTool === 'eraser');
    }
  }

  // --- Drag-and-drop from sidebar tools ---

  /** Show visual feedback when dragging a tool over a graph */
  _handleToolDragOver(e, graphEntry) {
    if (!this._dragToolTarget) return;

    // Check type compatibility
    const isValid = this._dragToolTarget === graphEntry.type;

    if (isValid) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      graphEntry.component.svg.classList.add('drop-valid');
      graphEntry.component.svg.classList.remove('drop-invalid');
    } else {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'none';
      graphEntry.component.svg.classList.add('drop-invalid');
      graphEntry.component.svg.classList.remove('drop-valid');
    }
  }

  /** Remove visual feedback when leaving a graph */
  _handleToolDragLeave(e, graphEntry) {
    // Only remove if actually leaving the SVG (not entering a child)
    const svg = graphEntry.component.svg;
    if (!svg.contains(e.relatedTarget)) {
      svg.classList.remove('drop-valid', 'drop-invalid');
    }
  }

  /** Handle dropping a tool onto a graph — appends a 1-second segment */
  _handleToolDrop(e, graphEntry) {
    const svg = graphEntry.component.svg;
    svg.classList.remove('drop-valid', 'drop-invalid');

    // Don't allow adding segments to locked graphs
    if (this._isGraphLocked(graphEntry)) return;

    const toolData = e.dataTransfer.getData('text/graph-tool');
    if (!toolData) return;

    let parsed;
    try {
      parsed = JSON.parse(toolData);
    } catch {
      return;
    }

    // Validate type match
    if (parsed.targetGraphType !== graphEntry.type) return;

    e.preventDefault();
    e.stopPropagation();

    const panel = this.workspace.getPanelById(graphEntry.panelId);
    if (!panel || panel.linkedActors.length === 0) return;

    // Find the target actor — use the first linked actor (or the active one)
    const actor = panel.getActiveActor ? panel.getActiveActor() : panel.linkedActors[0];
    if (!actor || actor.readOnly) return;

    // Get the drop position in data coordinates
    const renderer = graphEntry.component.graphRenderer;
    const rect = graphEntry.component.svg.getBoundingClientRect();
    const svgX = e.clientX - rect.left;
    const svgY = e.clientY - rect.top;
    const { v: dropV } = renderer.toData(svgX, svgY);

    if (graphEntry.type === 'position') {
      this._handleAppendPositionSegment(actor, dropV);
    } else if (graphEntry.type === 'velocity') {
      if (parsed.tool === 'add-ramp-up') {
        this._handleAppendVelocityRamp(actor, dropV, 'up');
      } else if (parsed.tool === 'add-ramp-down') {
        this._handleAppendVelocityRamp(actor, dropV, 'down');
      } else {
        this._handleAppendVelocitySegment(actor, dropV);
      }
    }
  }

  /**
   * Append a 1-second position segment.
   * The ending position value is determined by dropV.
   */
  _handleAppendPositionSegment(actor, dropV) {
    const plf = actor.positionFn;
    const lastV = plf.points[plf.points.length - 1].v;
    const deltaV = dropV - lastV;
    plf.appendSegment(1, deltaV);
    this.bus.emit('actor:edited', { actorId: actor.id });
  }

  /**
   * Append a 1-second velocity segment.
   * dropV = the constant velocity value for the new segment.
   * This translates to a position change of velocity * 1s.
   */
  _handleAppendVelocitySegment(actor, velocity) {
    const plf = actor.positionFn;
    const deltaPos = velocity * 1; // velocity * duration(1s) = position change
    plf.appendSegment(1, deltaPos);
    this.bus.emit('actor:edited', { actorId: actor.id });
  }

  /**
   * Append a 1-second sloped velocity segment (ramp).
   * direction = 'up' (positive acceleration) or 'down' (negative acceleration).
   * Both use the same fixed acceleration magnitude of 1 (matching the original
   * SimCalc 45-degree ramps). Adjust via the acceleration graph after dropping.
   */
  _handleAppendVelocityRamp(actor, dropV, direction) {
    const plf = actor.positionFn;

    // Get the previous ending velocity
    const numSegs = plf.points.length - 1;
    let vPrev = 0;
    if (numSegs > 0) {
      const { vEnd } = plf.getSegmentVelocities(numSegs - 1);
      vPrev = vEnd;
    }

    // Fixed acceleration magnitude — same for both directions
    const acceleration = direction === 'up' ? 1 : -1;
    const endV = vPrev + acceleration;

    // The ramp goes from vPrev to endV over 1 second
    // Average velocity = (vPrev + endV) / 2
    // Position change = average velocity * duration
    const deltaPos = (vPrev + endV) / 2 * 1;
    plf.appendSegment(1, deltaPos);

    // Set the acceleration on the new segment
    const newSegIndex = plf.points.length - 2;
    plf.setSegmentAcceleration(newSegIndex, acceleration);

    this.bus.emit('actor:edited', { actorId: actor.id });
  }

  // --- Click handlers ---

  /** Handle click events (eraser tool erases points/segments) */
  _handleClick(e, graphEntry) {
    if (this.activeTool === 'eraser') {
      this._handleErase(e, graphEntry);
    }
  }

  /** Eraser behavior per graph type:
   *  - position: erase a control point
   *  - velocity: merge segments (remove position point)
   *  - acceleration: reset acceleration to 0 (don't delete the segment)
   */
  _handleErase(e, graphEntry) {
    // Don't allow erasing on locked graphs
    if (this._isGraphLocked(graphEntry)) return;

    const target = e.target;
    if (!target.classList.contains('control-point')) return;

    const actorId = target.getAttribute('data-actor-id');
    const actor = this.sim.getActor(actorId);
    if (!actor || actor.readOnly) return;

    if (graphEntry.type === 'position') {
      const pointIndex = parseInt(target.getAttribute('data-point-index'));
      // Can erase any point except the first (index 0) and when it's the only point
      if (pointIndex > 0 && actor.positionFn.points.length > 1) {
        actor.positionFn.removePoint(pointIndex);
        this.bus.emit('actor:edited', { actorId: actor.id });
      }
    } else if (graphEntry.type === 'velocity') {
      // Deleting a velocity segment handle = removing a position point to merge segments
      const segmentIndex = parseInt(target.getAttribute('data-segment-index'));
      const posPointIndex = segmentIndex + 1;
      if (posPointIndex > 0 && actor.positionFn.points.length > 1) {
        actor.positionFn.removePoint(posPointIndex);
        this.bus.emit('actor:edited', { actorId: actor.id });
      }
    } else if (graphEntry.type === 'acceleration') {
      // Eraser on acceleration graph: reset acceleration to 0
      const segmentIndex = parseInt(target.getAttribute('data-segment-index'));
      actor.positionFn.setSegmentAcceleration(segmentIndex, 0);
      this.bus.emit('actor:edited', { actorId: actor.id });
    }
  }

  // --- Pointer drag (control point editing) ---

  /** Check if a graph is locked for editing */
  _isGraphLocked(graphEntry) {
    const comp = graphEntry.component;
    return comp.scalePopover && comp.scalePopover.isLocked;
  }

  _handlePointerDown(e, graphEntry) {
    // Only drag in pointer mode
    if (this.activeTool !== 'pointer') return;
    // Don't allow editing on locked graphs
    if (this._isGraphLocked(graphEntry)) return;

    const target = e.target;
    if (!target.classList.contains('control-point')) return;

    e.preventDefault();
    target.classList.add('dragging');

    const actorId = target.getAttribute('data-actor-id');
    const actor = this.sim.getActor(actorId);
    if (!actor || actor.readOnly) return;

    if (graphEntry.type === 'position') {
      const pointIndex = parseInt(target.getAttribute('data-point-index'));
      this.dragState = {
        graphEntry, actorId, pointIndex, element: target, actor
      };
    } else if (graphEntry.type === 'velocity') {
      const segmentIndex = parseInt(target.getAttribute('data-segment-index'));
      const dragMode = target.getAttribute('data-drag-mode'); // 'endpoint' or null (value)

      // For endpoint drag: save initial velocity and acceleration at drag start
      // so we can maintain them consistently during the drag
      let initialVelocity = 0;
      let initialAccel = 0;
      if (dragMode === 'endpoint') {
        const { vStart } = actor.positionFn.getSegmentVelocities(segmentIndex);
        initialVelocity = vStart;
        initialAccel = actor.positionFn.getSegmentAcceleration(segmentIndex);
      }

      this.dragState = {
        graphEntry, actorId, segmentIndex, dragMode, element: target, actor,
        initialVelocity, initialAccel
      };
    } else if (graphEntry.type === 'acceleration') {
      const segmentIndex = parseInt(target.getAttribute('data-segment-index'));
      this.dragState = {
        graphEntry, actorId, segmentIndex, element: target, actor
      };
    }

    // Use pointer capture on the SVG so move/up events stay with this element
    graphEntry.component.svg.setPointerCapture(e.pointerId);
    graphEntry.component.svg.addEventListener('pointermove', this._onPointerMove);
    graphEntry.component.svg.addEventListener('pointerup', this._onPointerUp);
  }

  _handlePointerMove(e) {
    if (!this.dragState) return;
    e.preventDefault();

    const { graphEntry, actor } = this.dragState;

    if (graphEntry.type === 'position') {
      this._handlePositionDrag(e);
    } else if (graphEntry.type === 'acceleration') {
      this._handleAccelerationDrag(e);
    } else if (this.dragState.dragMode === 'endpoint') {
      this._handleVelocityEndpointDrag(e);
    } else {
      this._handleVelocityValueDrag(e);
    }

    // Redraw ALL panels that have this actor linked
    this.bus.emit('actor:edited', { actorId: actor.id });
  }

  /** Position graph: drag a control point to move it */
  _handlePositionDrag(e) {
    const { graphEntry, actor } = this.dragState;
    const renderer = graphEntry.component.graphRenderer;
    const rect = graphEntry.component.svg.getBoundingClientRect();
    const svgX = e.clientX - rect.left;
    const svgY = e.clientY - rect.top;
    const { t, v } = renderer.toData(svgX, svgY);
    actor.updatePositionPoint(this.dragState.pointIndex, t, v);
  }

  /** Acceleration graph: drag a handle to change segment acceleration */
  _handleAccelerationDrag(e) {
    const { graphEntry, actor } = this.dragState;
    const renderer = graphEntry.component.graphRenderer;
    const rect = graphEntry.component.svg.getBoundingClientRect();
    const svgY = e.clientY - rect.top;
    const { v: newAccel } = renderer.toData(0, svgY);
    actor.updateSegmentAcceleration(this.dragState.segmentIndex, newAccel);
  }

  /** Velocity graph endpoint drag: change duration while preserving velocity and acceleration */
  _handleVelocityEndpointDrag(e) {
    const { graphEntry, actor } = this.dragState;
    const renderer = graphEntry.component.graphRenderer;
    const rect = graphEntry.component.svg.getBoundingClientRect();
    const svgX = e.clientX - rect.left;
    let { t: newT } = renderer.toData(svgX, 0);

    const segIdx = this.dragState.segmentIndex;
    const posPointIndex = segIdx + 1;
    const pts = actor.positionFn.points;
    if (posPointIndex > 0 && posPointIndex < pts.length) {
      // Enforce minimum segment duration of 0.2s on both sides
      const MIN_SEG = 0.2;
      const prevT = pts[segIdx].t;
      const nextT = posPointIndex < pts.length - 1 ? pts[posPointIndex + 1].t : null;
      newT = Math.max(newT, prevT + MIN_SEG);
      if (nextT !== null) {
        newT = Math.min(newT, nextT - MIN_SEG);
      }

      // Use the initial velocity and acceleration saved at drag start
      // to compute the new position endpoint
      const newDt = newT - pts[segIdx].t;
      const v0 = this.dragState.initialVelocity;
      const a = this.dragState.initialAccel;
      const newV = pts[segIdx].v + v0 * newDt + 0.5 * a * newDt * newDt;
      actor.updatePositionPoint(posPointIndex, newT, newV);
    }
  }

  /** Velocity graph value drag: change average velocity (shifts position endpoint) */
  _handleVelocityValueDrag(e) {
    const { graphEntry, actor } = this.dragState;
    const renderer = graphEntry.component.graphRenderer;
    const rect = graphEntry.component.svg.getBoundingClientRect();
    const svgY = e.clientY - rect.top;
    let { v } = renderer.toData(0, svgY);

    // Snap to zero when dragged close — prevents tiny residual velocities
    // that cause the animation to show walking-in-place artifacts
    if (Math.abs(v) < 0.15) v = 0;

    const velFn = actor.getVelocityFunction();
    velFn.moveSegmentValue(this.dragState.segmentIndex, v);
    actor.updateFromVelocity(velFn);
  }

  _handlePointerUp(e) {
    if (this.dragState) {
      if (this.dragState.element) {
        this.dragState.element.classList.remove('dragging');
      }
      const svg = this.dragState.graphEntry.component.svg;
      svg.removeEventListener('pointermove', this._onPointerMove);
      svg.removeEventListener('pointerup', this._onPointerUp);
    }
    this.dragState = null;
  }
}
