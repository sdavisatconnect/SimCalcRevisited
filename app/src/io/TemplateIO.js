import { PiecewiseLinearFunction } from '../model/PiecewiseLinearFunction.js';
import { Actor } from '../model/Actor.js';

/**
 * Save/Load template serialization.
 * Converts the full application state to/from a JSON-compatible object.
 */
export class TemplateIO {

  /**
   * Serialize the full app state into a plain object.
   */
  static serialize(simulation, workspace) {
    const data = {
      version: 1,
      simulation: {
        worldType: simulation.worldType,
        timeRange: { ...simulation.timeRange },
        posRange: { ...simulation.posRange },
        velRange: { ...simulation.velRange },
        accelRange: { ...simulation.accelRange },
        currentTime: simulation.currentTime,
        playbackSpeed: simulation.playbackSpeed,
      },
      actors: simulation.actors.map(actor => ({
        id: actor.id,
        name: actor.name,
        color: actor.color,
        animalType: actor.animalType || null,
        positionPoints: actor.positionFn.points.map(p => ({ t: p.t, v: p.v })),
        accelerations: actor.positionFn.accelerations || [],
      })),
      panels: workspace.panels.map(panel => {
        const rect = panel.el.getBoundingClientRect();
        const parentRect = panel.el.parentElement.getBoundingClientRect();
        const panelData = {
          type: panel.type,
          x: parseInt(panel.el.style.left) || 0,
          y: parseInt(panel.el.style.top) || 0,
          width: panel.el.offsetWidth,
          height: panel.el.offsetHeight,
          linkedActorIds: panel.linkedActors.map(a => a.id),
          activeActorId: panel.activeActorId,
          collapsed: panel._collapsed,
        };

        // Save custom graph ranges and lock state if component has a scalePopover
        if (panel.component && panel.component.scalePopover) {
          panelData.customRanges = panel.component.scalePopover.getRanges();
          panelData.isLocked = panel.component.scalePopover.isLocked;
        }

        return panelData;
      }),
    };
    return data;
  }

  /**
   * Trigger a JSON file download of the serialized state.
   */
  static saveToFile(simulation, workspace) {
    const data = TemplateIO.serialize(simulation, workspace);
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const worldName = simulation.worldType || 'template';
    a.download = `simcalc-${worldName}-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Open a file picker and return the parsed JSON.
   * @returns {Promise<object|null>}
   */
  static loadFromFile() {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,application/json';
      input.addEventListener('change', () => {
        const file = input.files[0];
        if (!file) { resolve(null); return; }
        const reader = new FileReader();
        reader.onload = () => {
          try {
            const data = JSON.parse(reader.result);
            resolve(data);
          } catch (e) {
            console.error('Failed to parse template file:', e);
            resolve(null);
          }
        };
        reader.onerror = () => resolve(null);
        reader.readAsText(file);
      });
      // User cancelled the file picker
      input.addEventListener('cancel', () => resolve(null));
      input.click();
    });
  }

  /**
   * Convert a v2 challenge (from ChallengeTemplateIO) into the v1 format
   * that reconstruct() expects.
   *
   * @param {object} v2 - v2 challenge data with seed, referenceActors, studentActorTemplate, studentConfig
   * @returns {object} v1-compatible data with simulation, actors, panels
   */
  static challengeV2toV1(v2) {
    const seed = v2.seed || {};
    const simulation = {
      worldType: seed.worldType || 'frolic',
      timeRange: seed.timeRange || { min: 0, max: 10 },
      posRange: seed.posRange || { min: -20, max: 20 },
      velRange: seed.velRange || { min: -5, max: 5 },
      accelRange: seed.accelRange || { min: -5, max: 5 },
      currentTime: 0,
      playbackSpeed: 1,
    };

    // Build actors: reference actors (read-only) + one student actor from template
    const actors = [];

    // Reference actors
    for (const ref of (v2.referenceActors || [])) {
      actors.push({
        id: ref.id || 'ref-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
        name: ref.name || 'Reference',
        color: ref.color || '#e74c3c',
        animalType: ref.animalType || null,
        positionPoints: ref.positionPoints || [{ t: 0, v: 0 }],
        accelerations: ref.accelerations || [],
      });
    }

    // Student actor from template
    const tmpl = v2.studentActorTemplate || {};
    actors.push({
      id: 'student-' + Date.now(),
      name: 'Student',
      color: '#27ae60',
      animalType: tmpl.animalType || (actors[0] && actors[0].animalType) || 'puppy',
      positionPoints: tmpl.positionPoints || [{ t: 0, v: 0 }],
      accelerations: tmpl.accelerations || [],
    });

    // Build panels from studentConfig.visiblePanels
    const visiblePanels = (v2.studentConfig && v2.studentConfig.visiblePanels) || ['world', 'position', 'velocity'];
    const editablePanels = (v2.studentConfig && v2.studentConfig.editablePanels) || ['velocity'];
    const linkage = v2.panelActorLinkage || {};
    console.log('[DEBUG v2toV1] panelActorLinkage from challenge:', JSON.stringify(linkage));
    console.log('[DEBUG v2toV1] visiblePanels:', visiblePanels);

    // Map old author actor IDs to the new actor IDs created above
    const refIdMap = {};
    const oldRefActors = v2.referenceActors || [];
    const newRefActors = actors.filter(a => a.name === 'Reference' || a.id.startsWith('ref-'));
    for (let i = 0; i < oldRefActors.length && i < newRefActors.length; i++) {
      refIdMap[oldRefActors[i].id] = newRefActors[i].id;
    }
    const studentActor = actors.find(a => a.id.startsWith('student-'));
    const oldStudentId = 'student-template';
    const allActorIds = actors.map(a => a.id);

    const graphScales = v2.graphScales || {};

    const panels = visiblePanels.map(type => {
      let linkedActorIds;
      if (linkage[type]) {
        // Remap author-time IDs to the newly created actor IDs
        linkedActorIds = linkage[type]
          .map(oldId => {
            const mapped = refIdMap[oldId] || (oldId === oldStudentId && studentActor ? studentActor.id : null);
            console.log(`[DEBUG v2toV1] panel=${type} oldId=${oldId} → mapped=${mapped}`);
            return mapped;
          })
          .filter(Boolean);
      } else {
        // No linkage saved — default: all actors on all panels
        console.log(`[DEBUG v2toV1] panel=${type} NO linkage, using all actors`);
        linkedActorIds = allActorIds;
      }
      const panelData = {
        type,
        linkedActorIds,
        isLocked: !editablePanels.includes(type),
      };
      // Carry per-graph scale settings (axis ranges + tick steps)
      if (graphScales[type]) {
        panelData.graphScale = graphScales[type];
      }
      return panelData;
    });

    return { simulation, actors, panels };
  }

  /**
   * Reconstruct the full application state from loaded data.
   *
   * @param {object} data - Parsed JSON from loadFromFile
   * @param {Simulation} sim
   * @param {Workspace} workspace
   * @param {PanelFactory} panelFactory
   * @param {GraphInteractionManager} interactionMgr
   * @param {EventBus} bus
   * @param {Function} createPanelFn - (type, opts) => Panel
   */
  static reconstruct(data, sim, workspace, panelFactory, interactionMgr, bus, createPanelFn) {
    // Auto-convert v2 challenge data to v1 format
    if (data && data.version === 2 && data.seed && !data.simulation) {
      data = TemplateIO.challengeV2toV1(data);
    }

    if (!data || !data.simulation || !data.actors) {
      console.error('Invalid template data');
      return;
    }

    // 1. Stop playback
    sim.isPlaying = false;
    bus.emit('playback:stopped');

    // 2. Clear all existing panels
    const panelsCopy = [...workspace.panels];
    for (const panel of panelsCopy) {
      interactionMgr.unregisterGraph(panel.id);
      workspace.removePanel(panel);
    }

    // 3. Clear all existing actors
    sim.actors = [];

    // 4. Restore simulation properties
    const sd = data.simulation;
    sim.worldType = sd.worldType;
    sim.timeRange = { ...sd.timeRange };
    sim.posRange = { ...sd.posRange };
    sim.velRange = { ...sd.velRange };
    sim.accelRange = { ...sd.accelRange };
    sim.currentTime = sd.currentTime || 0;
    sim.playbackSpeed = sd.playbackSpeed || 1.0;

    // 5. Recreate actors
    for (const actorData of data.actors) {
      const points = actorData.positionPoints.map(p => ({ t: p.t, v: p.v }));
      // Restore accelerations (backward compatible with old saves that have none)
      const accels = actorData.accelerations || new Array(Math.max(0, points.length - 1)).fill(0);
      const plf = new PiecewiseLinearFunction(points, accels);
      const actor = new Actor({
        id: actorData.id,
        name: actorData.name,
        color: actorData.color,
        animalType: actorData.animalType || null,
        positionFunction: plf,
      });
      sim.addActor(actor);
    }

    // 6. Notify that actors changed (updates palette)
    bus.emit('actors:changed');

    // 7. Recreate panels
    // Collect deferred scale settings — Workspace.addPanel() schedules a
    // requestAnimationFrame that calls component.refresh(), which in some
    // components (e.g. UnifixVelocityGraph) resets ranges.  We must apply
    // custom graph scales AFTER that rAF fires.
    const deferredScales = [];

    for (const pd of data.panels) {
      const panel = createPanelFn(pd.type, {
        x: pd.x,
        y: pd.y,
        width: pd.width,
        height: pd.height,
        actorIds: pd.linkedActorIds || [],
      });

      // Set active actor
      if (pd.activeActorId) {
        panel.setActiveActor(pd.activeActorId);
      }

      // Defer custom graph ranges — will apply after rAF refresh
      const scale = pd.customRanges || pd.graphScale;
      if (scale && panel.component && panel.component.renderer) {
        deferredScales.push({ panel, scale });
      }

      // Restore collapsed state
      if (pd.collapsed && !panel._collapsed) {
        panel.toggleCollapse();
      }

      // Restore lock state
      if (pd.isLocked && panel.component && panel.component.scalePopover) {
        if (!panel.component.scalePopover.isLocked) {
          panel.component.scalePopover.toggleLock();
        }
      }
    }

    // Apply graph scales after the addPanel rAF refresh has fired
    if (deferredScales.length > 0) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          for (const { panel, scale } of deferredScales) {
            panel.component.renderer.setRanges(
              scale.xRange,
              scale.yRange,
              { xTickStep: scale.xTickStep || null, yTickStep: scale.yTickStep || null }
            );
            if (panel.component.redraw) panel.component.redraw();
          }
        });
      });
    }

    // 8. Redraw everything
    workspace.redrawAll();
    workspace.drawTimeCursors(sim.currentTime);
    workspace.drawFrames(sim.currentTime);
    bus.emit('time:update', { currentTime: sim.currentTime });
  }
}
