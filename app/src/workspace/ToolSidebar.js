/**
 * Right-side context-sensitive toolbar.
 * Components section: draggable buttons — drag onto workspace to create panels.
 * Edit Tools section: always visible with all tools.
 *   - Mode tools (click-to-select): pointer, eraser
 *   - Draggable tools (drag onto graph): position add-point, velocity add-segment
 * Info/Tips: context-sensitive help.
 */

// --- SVG Icon definitions ---
const ICONS = {
  pointer: `<svg viewBox="0 0 16 16" width="16" height="16"><path d="M4 1v12l3.5-3.5L11 14l2-1-3.5-4.5L14 7z" fill="currentColor"/></svg>`,

  positionAdd: `<svg viewBox="0 0 24 16" width="22" height="16">
    <text x="0" y="13" font-size="12" font-weight="700" fill="currentColor" font-family="sans-serif">P</text>
    <line x1="12" y1="14" x2="22" y2="3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    <circle cx="17" cy="8.5" r="2.5" fill="currentColor"/>
  </svg>`,

  velHorizontal: `<svg viewBox="0 0 24 16" width="22" height="16">
    <text x="0" y="13" font-size="12" font-weight="700" fill="currentColor" font-family="sans-serif">V</text>
    <line x1="12" y1="8" x2="22" y2="8" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
    <circle cx="17" cy="8" r="3" fill="currentColor"/>
    <line x1="17" y1="5.5" x2="17" y2="10.5" stroke="#16213e" stroke-width="1.5"/>
    <line x1="14.5" y1="8" x2="19.5" y2="8" stroke="#16213e" stroke-width="1.5"/>
  </svg>`,

  velRampUp: `<svg viewBox="0 0 24 16" width="22" height="16">
    <text x="0" y="13" font-size="12" font-weight="700" fill="currentColor" font-family="sans-serif">V</text>
    <line x1="12" y1="13" x2="22" y2="3" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
    <polygon points="12,16 12,13 22,3 22,16" fill="currentColor" opacity="0.2"/>
    <circle cx="17" cy="8" r="3" fill="currentColor"/>
  </svg>`,

  velRampDown: `<svg viewBox="0 0 24 16" width="22" height="16">
    <text x="0" y="13" font-size="12" font-weight="700" fill="currentColor" font-family="sans-serif">V</text>
    <line x1="12" y1="3" x2="22" y2="13" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
    <polygon points="12,16 12,3 22,13 22,16" fill="currentColor" opacity="0.2"/>
    <circle cx="17" cy="8" r="3" fill="currentColor"/>
  </svg>`,

  eraser: `<svg viewBox="0 0 16 16" width="16" height="16">
    <path d="M13.5 5.5L7.5 11.5L3.5 11.5L2 10L6.5 5.5L5 4L10.5 2.5z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>
    <path d="M3.5 11.5L6.5 8.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
    <line x1="2" y1="13" x2="14" y2="13" stroke="currentColor" stroke-width="1" opacity="0.4"/>
  </svg>`,
};

// All edit tools — always shown
const MODE_TOOLS = [
  { tool: 'pointer', svg: ICONS.pointer, tooltip: 'Select & Drag', mode: true },
  { tool: 'eraser', svg: ICONS.eraser, tooltip: 'Eraser', mode: true },
];

const DRAGGABLE_TOOLS = [
  {
    tool: 'add-point',
    targetGraphType: 'position',
    svg: ICONS.positionAdd,
    tooltip: 'Drag to Position graph',
    label: 'Add Point',
  },
  {
    tool: 'add-segment',
    targetGraphType: 'velocity',
    svg: ICONS.velHorizontal,
    tooltip: 'Drag to Velocity graph',
    label: 'Add Segment',
  },
  {
    tool: 'add-ramp-up',
    targetGraphType: 'velocity',
    svg: ICONS.velRampUp,
    tooltip: 'Drag to Velocity graph (accelerate)',
    label: 'Ramp Up',
  },
  {
    tool: 'add-ramp-down',
    targetGraphType: 'velocity',
    svg: ICONS.velRampDown,
    tooltip: 'Drag to Velocity graph (decelerate)',
    label: 'Ramp Down',
  },
];

export class ToolSidebar {
  constructor(containerEl, bus, workspace) {
    this.container = containerEl;
    this.bus = bus;
    this.workspace = workspace;
    this.focusedPanel = null;
    this.activeTool = 'pointer';
    this.toolButtonEls = {};

    this._build();
    this._listenForEvents();
  }

  _build() {
    this.container.innerHTML = '';

    // --- Components Section (draggable) ---
    const compSection = this._createSection('Components');

    const compButtons = [
      { type: 'world', icon: '\u{1F30D}', label: 'World' },
      { type: 'position', icon: '\u{1F4C8}', label: 'Position' },
      { type: 'velocity', icon: '\u{1F4CA}', label: 'Velocity' },
      { type: 'acceleration', icon: '\u26A1', label: 'Accel' },
    ];

    for (const { type, icon, label } of compButtons) {
      const btn = this._createDraggableComponent(type, icon, label);
      compSection.content.appendChild(btn);
    }
    // Import CSV button (click-only, not draggable)
    const importBtn = document.createElement('button');
    importBtn.className = 'sidebar-tool-btn sidebar-import-btn';
    importBtn.title = 'Import motion data from a CSV file';
    const importIcon = document.createElement('span');
    importIcon.className = 'tool-icon';
    importIcon.textContent = '\u{1F4C2}';
    importBtn.appendChild(importIcon);
    const importLabel = document.createElement('span');
    importLabel.className = 'tool-label';
    importLabel.textContent = 'Import CSV';
    importBtn.appendChild(importLabel);
    importBtn.addEventListener('click', () => this.bus.emit('import:request'));
    compSection.content.appendChild(importBtn);

    this.container.appendChild(compSection.el);

    // --- Edit Tools Section (always visible) ---
    this.graphToolsSection = this._createSection('Edit Tools');
    this._buildEditTools();
    this.container.appendChild(this.graphToolsSection.el);

    // --- Info Section ---
    this.infoSection = this._createSection('Info');
    this.infoContent = document.createElement('div');
    this.infoContent.className = 'sidebar-info-content';
    this.infoContent.textContent = 'Drag a component to the workspace';
    this.infoSection.content.appendChild(this.infoContent);
    this.container.appendChild(this.infoSection.el);

    // --- Help Tips ---
    this.helpSection = this._createSection('Tips');
    this.helpContent = document.createElement('div');
    this.helpContent.className = 'sidebar-help-content';
    this.helpContent.innerHTML = `
      <div class="tip">Drag components to workspace</div>
      <div class="tip">Drag tools onto matching graphs</div>
      <div class="tip">Use dropdown to pick actors</div>
      <div class="tip">Double-click title to collapse</div>
    `;
    this.helpSection.content.appendChild(this.helpContent);
    this.container.appendChild(this.helpSection.el);
  }

  _createSection(title) {
    const el = document.createElement('div');
    el.className = 'sidebar-section';

    const header = document.createElement('div');
    header.className = 'sidebar-section-header';
    header.textContent = title;
    el.appendChild(header);

    const content = document.createElement('div');
    content.className = 'sidebar-section-content';
    el.appendChild(content);

    return { el, header, content };
  }

  /** Create a draggable component button */
  _createDraggableComponent(type, icon, label) {
    const btn = document.createElement('div');
    btn.className = 'sidebar-tool-btn sidebar-draggable';
    btn.draggable = true;
    btn.title = `Drag to workspace to create ${label} panel`;

    const iconSpan = document.createElement('span');
    iconSpan.className = 'tool-icon';
    iconSpan.textContent = icon;
    btn.appendChild(iconSpan);

    const labelSpan = document.createElement('span');
    labelSpan.className = 'tool-label';
    labelSpan.textContent = label;
    btn.appendChild(labelSpan);

    const grip = document.createElement('span');
    grip.className = 'drag-grip';
    grip.textContent = '\u2630';
    btn.appendChild(grip);

    btn.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/component-type', type);
      e.dataTransfer.effectAllowed = 'copy';
      btn.classList.add('comp-dragging');
    });
    btn.addEventListener('dragend', () => {
      btn.classList.remove('comp-dragging');
    });

    btn.addEventListener('click', () => {
      this.bus.emit('panel:create-request', { type });
    });

    return btn;
  }

  /** Build all edit tools: mode tools (click) + draggable tools (drag-to-graph) */
  _buildEditTools() {
    this.graphToolsSection.content.innerHTML = '';
    this.toolButtonEls = {};

    // --- Mode tools (click-to-select) ---
    const modeLabel = document.createElement('div');
    modeLabel.className = 'tool-group-label';
    modeLabel.textContent = 'Mode';
    this.graphToolsSection.content.appendChild(modeLabel);

    for (const { tool, svg, tooltip } of MODE_TOOLS) {
      const btn = document.createElement('button');
      btn.className = 'sidebar-tool-btn sidebar-icon-btn';
      btn.title = tooltip;
      btn.dataset.tool = tool;

      const iconSpan = document.createElement('span');
      iconSpan.className = 'tool-icon-svg';
      iconSpan.innerHTML = svg;
      btn.appendChild(iconSpan);

      const labelSpan = document.createElement('span');
      labelSpan.className = 'tool-label-short';
      labelSpan.textContent = tooltip;
      btn.appendChild(labelSpan);

      btn.addEventListener('click', () => {
        this.setActiveTool(tool);
      });

      this.toolButtonEls[tool] = btn;
      this.graphToolsSection.content.appendChild(btn);
    }

    // --- Draggable tools (drag onto graph) ---
    const dragLabel = document.createElement('div');
    dragLabel.className = 'tool-group-label';
    dragLabel.textContent = 'Drag to Graph';
    this.graphToolsSection.content.appendChild(dragLabel);

    for (const { tool, targetGraphType, svg, tooltip, label } of DRAGGABLE_TOOLS) {
      const btn = document.createElement('div');
      btn.className = 'sidebar-tool-btn sidebar-icon-btn sidebar-draggable-tool';
      btn.draggable = true;
      btn.title = tooltip;
      btn.dataset.tool = tool;
      btn.dataset.targetGraphType = targetGraphType;

      const iconSpan = document.createElement('span');
      iconSpan.className = 'tool-icon-svg';
      iconSpan.innerHTML = svg;
      btn.appendChild(iconSpan);

      const grip = document.createElement('span');
      grip.className = 'drag-grip';
      grip.textContent = '\u2630';
      btn.appendChild(grip);

      // Drag handlers
      btn.addEventListener('dragstart', (e) => {
        const payload = JSON.stringify({ tool, targetGraphType });
        e.dataTransfer.setData('text/graph-tool', payload);
        e.dataTransfer.effectAllowed = 'copy';
        btn.classList.add('tool-dragging');
        // Emit on bus so GraphInteractionManager knows what's being dragged
        this.bus.emit('tool:drag-start', { targetGraphType });
      });

      btn.addEventListener('dragend', () => {
        btn.classList.remove('tool-dragging');
        this.bus.emit('tool:drag-end');
      });

      this.graphToolsSection.content.appendChild(btn);
    }

    this._updateToolHighlight();
  }

  _listenForEvents() {
    this.bus.on('panel:focused', ({ panel }) => {
      this.focusedPanel = panel;
      this._updateForPanel(panel);
    });

    this.bus.on('panel:closed', ({ panelId }) => {
      if (this.focusedPanel && this.focusedPanel.id === panelId) {
        this.focusedPanel = null;
        this._updateForPanel(null);
      }
    });

    this.bus.on('panel:active-actor-changed', () => {
      if (this.focusedPanel) this._updateForPanel(this.focusedPanel);
    });
  }

  _updateForPanel(panel) {
    if (!panel) {
      this.infoContent.textContent = 'Drag a component to the workspace';
      this._updateHelpForContext(null);
      return;
    }

    const activeActor = panel.getActiveActor ? panel.getActiveActor() : null;
    const actorNames = panel.linkedActors.map(a => a.name).join(', ') || 'none';
    const editTarget = activeActor ? activeActor.name : 'none';
    this.infoContent.innerHTML = `
      <div class="info-row"><span class="info-key">Panel:</span> ${panel.title}</div>
      <div class="info-row"><span class="info-key">Actors:</span> ${actorNames}</div>
      <div class="info-row"><span class="info-key">Editing:</span> ${editTarget}</div>
    `;

    this._updateHelpForContext(panel.type);
  }

  _updateHelpForContext(type) {
    if (!type) {
      this.helpContent.innerHTML = `
        <div class="tip">Drag components to workspace</div>
        <div class="tip">Drag tools onto matching graphs</div>
        <div class="tip">Use dropdown to pick actors</div>
        <div class="tip">Double-click title to collapse</div>
      `;
      return;
    }

    if (type === 'position') {
      this.helpContent.innerHTML = `
        <div class="tip"><b>Pointer:</b> Drag points to edit</div>
        <div class="tip"><b>Add:</b> Drag "Add Point" onto graph</div>
        <div class="tip"><b>Eraser:</b> Click a point to erase it</div>
      `;
    } else if (type === 'velocity') {
      this.helpContent.innerHTML = `
        <div class="tip"><b>Pointer:</b> Drag bars to change</div>
        <div class="tip"><b>Add:</b> Drag segment for constant</div>
        <div class="tip"><b>Ramps:</b> Up = accelerate, Down = decelerate</div>
        <div class="tip"><b>Eraser:</b> Click a segment to merge</div>
      `;
    } else if (type === 'acceleration') {
      this.helpContent.innerHTML = `
        <div class="tip"><b>Pointer:</b> Drag bars to set acceleration</div>
        <div class="tip"><b>Eraser:</b> Click to reset accel to zero</div>
        <div class="tip">Impulse arrows show velocity jumps</div>
      `;
    } else if (type === 'world') {
      this.helpContent.innerHTML = `
        <div class="tip">Characters move along track</div>
        <div class="tip">Position from graphs</div>
        <div class="tip">Use playback to animate</div>
      `;
    }
  }

  setActiveTool(tool) {
    this.activeTool = tool;
    this._updateToolHighlight();
    this.bus.emit('tool:changed', { tool });
  }

  _updateToolHighlight() {
    if (!this.toolButtonEls) return;
    for (const [toolName, btn] of Object.entries(this.toolButtonEls)) {
      btn.classList.toggle('active', toolName === this.activeTool);
    }
  }

  getActiveTool() {
    return this.activeTool;
  }
}
