/**
 * Save/Load challenge templates in the v2 format.
 * Handles serialization of challenge-specific data (reference actors,
 * student template, panel visibility/editability, instructions, results config).
 */
export class ChallengeTemplateIO {

  /**
   * Serialize the author mode state into a v2 challenge object.
   *
   * @param {object} opts
   * @param {Simulation} opts.simulation - The author mode's simulation
   * @param {Actor[]} opts.referenceActors - Actors marked as reference
   * @param {Actor|null} opts.studentTemplateActor - The student template actor (or null for blank)
   * @param {object} opts.config - From AuthorConfigPanel
   *   { title, instructions, visiblePanels, editablePanels, allowNewPanels,
   *     overlaidGraphType, tiledGraphType, showReferenceInResults }
   */
  static serialize({ simulation, referenceActors, studentTemplateActor, config, workspace }) {
    const serializeActor = (actor) => {
      const data = {
        id: actor.id,
        name: actor.name,
        color: actor.color,
        positionPoints: actor.positionFn.points.map(p => ({ t: p.t, v: p.v })),
        accelerations: actor.positionFn.accelerations || [],
      };
      if (actor.animalType) data.animalType = actor.animalType;
      return data;
    };

    return {
      version: 2,
      meta: {
        title: config.title || 'Untitled Challenge',
        instructions: config.instructions || '',
        createdAt: Date.now(),
      },
      seed: {
        worldType: simulation.worldType,
        edition: simulation.edition || 'standard',
        timeRange: { ...simulation.timeRange },
        posRange: { ...simulation.posRange },
        velRange: { ...simulation.velRange },
        accelRange: { ...simulation.accelRange },
      },
      referenceActors: referenceActors.map(serializeActor),
      studentActorTemplate: studentTemplateActor
        ? {
            positionPoints: studentTemplateActor.positionFn.points.map(p => ({ t: p.t, v: p.v })),
            accelerations: studentTemplateActor.positionFn.accelerations || [],
            ...(studentTemplateActor.animalType ? { animalType: studentTemplateActor.animalType } : {}),
          }
        : {
            // Default blank: flat at position 0 over the full time range
            positionPoints: [
              { t: simulation.timeRange.min, v: 0 },
              { t: simulation.timeRange.max, v: 0 },
            ],
            accelerations: [0],
          },
      studentConfig: {
        visiblePanels: config.visiblePanels || ['world', 'position'],
        editablePanels: config.editablePanels || ['position'],
        allowNewPanels: config.allowNewPanels || false,
      },
      // Per-panel actor linkage: which actors are linked to each panel type
      panelActorLinkage: workspace ? ChallengeTemplateIO._buildPanelActorLinkage(workspace) : {},
      // Per-graph scale settings (axis ranges and tick steps)
      graphScales: workspace ? ChallengeTemplateIO._buildGraphScales(workspace) : {},
      resultsConfig: {
        overlaidGraphType: config.overlaidGraphType || 'position',
        tiledGraphType: config.tiledGraphType || 'position',
        showReferenceInResults: config.showReferenceInResults !== false,
      },
      targetSegments: (config.targetSegments || []).map(seg => ({
        startTime: seg.startTime,
        startPosition: seg.startPosition,
        endTime: seg.endTime,
        endPosition: seg.endPosition,
      })),
    };
  }

  /**
   * Trigger a JSON file download of a challenge template.
   */
  static saveToFile(challengeData) {
    const json = JSON.stringify(challengeData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeName = (challengeData.meta?.title || 'challenge')
      .replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    a.download = `simcalc-challenge-${safeName}-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Open a file picker and return the parsed challenge JSON.
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
            if (data.version === 2) {
              resolve(data);
            } else {
              console.warn('Loaded file is not a v2 challenge template');
              resolve(null);
            }
          } catch (e) {
            console.error('Failed to parse challenge file:', e);
            resolve(null);
          }
        };
        reader.onerror = () => resolve(null);
        reader.readAsText(file);
      });
      input.addEventListener('cancel', () => resolve(null));
      input.click();
    });
  }

  /**
   * Check if a data object is a v2 challenge.
   */
  static isV2Challenge(data) {
    return data && data.version === 2 && data.seed && data.studentConfig;
  }

  /**
   * Build a map of panel type → linked actor IDs from the workspace.
   * If multiple panels of the same type exist, merge their linked actors.
   */
  /**
   * Build a map of panel type → graph scale settings from the workspace.
   * Captures axis ranges and tick steps for each graph panel.
   */
  static _buildGraphScales(workspace) {
    const scales = {};
    for (const panel of workspace.panels) {
      if (panel.type === 'world') continue;
      const renderer = panel.component && panel.component.renderer;
      if (!renderer) continue;
      scales[panel.type] = {
        xRange: { ...renderer.xRange },
        yRange: { ...renderer.yRange },
        xTickStep: renderer.xTickStep || null,
        yTickStep: renderer.yTickStep || null,
      };
    }
    return scales;
  }

  static _buildPanelActorLinkage(workspace) {
    const linkage = {};
    for (const panel of workspace.panels) {
      const type = panel.type;
      const ids = panel.linkedActors.map(a => a.id);
      console.log(`[DEBUG _buildPanelActorLinkage] panel type="${type}" linkedActorIds=`, ids);
      if (!linkage[type]) {
        linkage[type] = ids;
      } else {
        // Merge (union) if multiple panels of same type
        const existing = new Set(linkage[type]);
        for (const id of ids) existing.add(id);
        linkage[type] = [...existing];
      }
    }
    console.log('[DEBUG _buildPanelActorLinkage] final linkage:', JSON.stringify(linkage));
    return linkage;
  }
}
