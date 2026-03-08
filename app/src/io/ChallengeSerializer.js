import { TemplateIO } from './TemplateIO.js';

/**
 * Extends TemplateIO serialization with challenge-specific fields:
 * - Lock states per panel (which graphs are editable vs read-only)
 * - Challenge settings (can students add new panels?)
 */
export class ChallengeSerializer {

  /**
   * Serialize workspace state plus challenge settings.
   * @param {Simulation} simulation
   * @param {Workspace} workspace
   * @param {{ allowNewPanels: boolean }} challengeSettings
   * @returns {object} Full challenge payload
   */
  static serializeChallenge(simulation, workspace, challengeSettings) {
    const data = TemplateIO.serialize(simulation, workspace);
    data.challengeSettings = {
      allowNewPanels: challengeSettings.allowNewPanels || false,
    };
    return data;
  }

  /**
   * After TemplateIO.reconstruct() has rebuilt the workspace,
   * apply challenge-specific lock states and restrictions.
   *
   * @param {object} data - The challenge payload (from serializeChallenge)
   * @param {Workspace} workspace - The reconstructed workspace
   * @param {boolean} isStudent - If true, make locks immutable (students can't unlock)
   */
  static applyChallengeLockStates(data, workspace, isStudent = false) {
    if (!data.panels) return;

    for (let i = 0; i < data.panels.length; i++) {
      const pd = data.panels[i];
      const panel = workspace.panels[i];
      if (!panel || !panel.component || !panel.component.scalePopover) continue;

      const popover = panel.component.scalePopover;

      // Ensure lock state matches the challenge data
      if (pd.isLocked && !popover.isLocked) {
        popover.toggleLock();
      }

      // In student mode, prevent unlocking locked graphs and hide the lock button
      if (isStudent && pd.isLocked) {
        popover.setLockImmutable(true);
        popover.hideLockButton();
      }
    }
  }
}
