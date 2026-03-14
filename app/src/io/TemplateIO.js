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

      // Restore custom graph ranges
      if (pd.customRanges && panel.component && panel.component.renderer) {
        panel.component.renderer.setRanges(pd.customRanges.xRange, pd.customRanges.yRange);
        if (panel.component.redraw) panel.component.redraw();
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

    // 8. Redraw everything
    workspace.redrawAll();
    workspace.drawTimeCursors(sim.currentTime);
    workspace.drawFrames(sim.currentTime);
    bus.emit('time:update', { currentTime: sim.currentTime });
  }
}
