/**
 * Manages all panels in the workspace. Handles z-ordering and panel lifecycle.
 */
export class Workspace {
  constructor(containerEl, bus) {
    this.container = containerEl;
    this.bus = bus;
    this.panels = [];
    this._nextZ = 10;
    this.focusedPanel = null;

    // Track panel focus
    this.bus.on('panel:focused', ({ panel }) => {
      this._setFocused(panel);
    });
  }

  _setFocused(panel) {
    if (this.focusedPanel) {
      this.focusedPanel.el.classList.remove('focused');
    }
    this.focusedPanel = panel;
    if (panel) {
      panel.el.classList.add('focused');
    }
  }

  addPanel(panel) {
    this.panels.push(panel);
    panel.el.style.zIndex = this._nextZ++;
    this.container.appendChild(panel.el);

    // Components need a frame to measure their container after DOM insertion
    requestAnimationFrame(() => {
      if (panel.component && panel.component.refresh) {
        panel.component.refresh();
      }
      if (panel.component && panel.component.redraw) {
        panel.component.redraw();
      }
    });
  }

  removePanel(panel) {
    this.panels = this.panels.filter(p => p !== panel);
    panel.destroy();
  }

  bringToFront(panel) {
    panel.el.style.zIndex = this._nextZ++;
  }

  getPanelById(id) {
    return this.panels.find(p => p.id === id);
  }

  /** Get all panels that have a given actor linked */
  getPanelsForActor(actorId) {
    return this.panels.filter(p => p.linkedActors.some(a => a.id === actorId));
  }

  /** Redraw all panels (after actor edit, time change, etc.) */
  redrawAll() {
    for (const panel of this.panels) {
      if (panel.component && panel.component.redraw) {
        panel.component.redraw();
      }
    }
  }

  /** Update time cursor on all panels */
  drawTimeCursors(t) {
    for (const panel of this.panels) {
      if (panel.component && panel.component.drawTimeCursor) {
        panel.component.drawTimeCursor(t);
      }
    }
  }

  /** Draw animation frame on all world panels */
  drawFrames(t) {
    for (const panel of this.panels) {
      if (panel.component && panel.component.drawFrame) {
        panel.component.drawFrame(t);
      }
    }
  }
}
