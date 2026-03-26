/**
 * A draggable, resizable panel container.
 * Each panel has a title bar (drag to move), content area, resize handle, and close button.
 * The title bar has an actor dropdown selector: pick which actors to display, and which is
 * the "active" actor for editing (Add Pt / Del Pt apply to the active actor).
 */
export class Panel {
  constructor({ id, title, type, x, y, width, height, onClose, onFocus, bus, simulation }) {
    this.id = id;
    this.title = title;
    this.type = type; // 'world', 'position', 'velocity'
    this.linkedActors = [];
    this.activeActorId = null; // which actor is selected for editing
    this.component = null; // set after creation by PanelFactory
    this.bus = bus;
    this.sim = simulation;
    this.onClose = onClose;
    this.onFocus = onFocus;
    this._collapsed = false;
    this._savedHeight = height;
    this._dropdownOpen = false;

    // Build DOM
    this.el = document.createElement('div');
    this.el.className = 'panel';
    this.el.style.left = x + 'px';
    this.el.style.top = y + 'px';
    this.el.style.width = width + 'px';
    this.el.style.height = height + 'px';
    this.el.dataset.panelId = id;

    // Title bar
    this.titleBar = document.createElement('div');
    this.titleBar.className = 'panel-titlebar';

    this.titleText = document.createElement('span');
    this.titleText.className = 'panel-title-text';
    this.titleText.textContent = title;
    this.titleBar.appendChild(this.titleText);

    // Actor selector area (dropdown trigger + dropdown menu)
    this.actorSelectorEl = document.createElement('div');
    this.actorSelectorEl.className = 'panel-actor-selector';
    this.titleBar.appendChild(this.actorSelectorEl);

    // The dropdown trigger button (shows current actors)
    this.actorTrigger = document.createElement('button');
    this.actorTrigger.className = 'actor-selector-trigger';
    this.actorTrigger.title = 'Select actors to display';
    this.actorTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      this._toggleDropdown();
    });
    this.actorSelectorEl.appendChild(this.actorTrigger);

    // Dropdown menu (hidden by default)
    this.dropdownEl = document.createElement('div');
    this.dropdownEl.className = 'actor-dropdown';
    this.actorSelectorEl.appendChild(this.dropdownEl);

    // Close button
    this.closeBtn = document.createElement('button');
    this.closeBtn.className = 'panel-close-btn';
    this.closeBtn.textContent = '\u00D7';
    this.closeBtn.title = 'Close panel';
    this.closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.onClose) this.onClose(this);
    });
    this.titleBar.appendChild(this.closeBtn);

    this.el.appendChild(this.titleBar);

    // Content area
    this.contentEl = document.createElement('div');
    this.contentEl.className = 'panel-content';
    this.el.appendChild(this.contentEl);

    // Resize handle
    this.resizeHandle = document.createElement('div');
    this.resizeHandle.className = 'panel-resize-handle';
    this.el.appendChild(this.resizeHandle);

    // --- Drag to move ---
    this._setupDrag();

    // --- Resize ---
    this._setupResize();

    // --- Drop target for actor chips from palette ---
    this._setupDropTarget();

    // --- Focus on click/touch ---
    this.el.addEventListener('pointerdown', () => {
      if (this.onFocus) this.onFocus(this);
      if (this.bus) this.bus.emit('panel:focused', { panel: this });
    });

    // Double-click title bar to collapse/expand
    this.titleBar.addEventListener('dblclick', () => this.toggleCollapse());

    // Close dropdown when clicking outside
    this._globalClickHandler = (e) => {
      if (this._dropdownOpen && !this.actorSelectorEl.contains(e.target)) {
        this._closeDropdown();
      }
    };
    document.addEventListener('pointerdown', this._globalClickHandler);

    // Re-render trigger when actors change globally
    if (this.bus) {
      this.bus.on('actors:changed', () => {
        this._renderTrigger();
        if (this._dropdownOpen) this._renderDropdownItems();
      });
    }

    // Initial render
    this._renderTrigger();
  }

  _setupDrag() {
    let startX, startY, startLeft, startTop;
    let dragPending = false;
    const DRAG_THRESHOLD = 6; // px — must move this far before drag commits

    const onPointerDown = (e) => {
      // Never drag from close button or open dropdown
      if (e.target === this.closeBtn
        || e.target.closest('.actor-dropdown.open')) return;
      // Record start position but don't commit to drag yet —
      // a short tap should still open the actor dropdown
      startX = e.clientX;
      startY = e.clientY;
      startLeft = parseInt(this.el.style.left);
      startTop = parseInt(this.el.style.top);
      dragPending = true;
      this.titleBar.setPointerCapture(e.pointerId);
      e.preventDefault(); // Prevent iOS Safari from stealing the touch for scrolling
    };

    const onPointerMove = (e) => {
      if (!dragPending && !this.el.classList.contains('dragging')) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      if (dragPending) {
        // Only commit to drag after moving beyond threshold
        if (Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) return;
        dragPending = false;
        this.el.classList.add('dragging');
      }

      this.el.style.left = (startLeft + dx) + 'px';
      this.el.style.top = Math.max(0, startTop + dy) + 'px';
    };

    const onPointerUp = () => {
      dragPending = false;
      this.el.classList.remove('dragging');
    };

    this.titleBar.addEventListener('pointerdown', onPointerDown);
    this.titleBar.addEventListener('pointermove', onPointerMove);
    this.titleBar.addEventListener('pointerup', onPointerUp);
    this.titleBar.addEventListener('lostpointercapture', onPointerUp);
  }

  _setupResize() {
    let startX, startY, startW, startH;

    const onPointerDown = (e) => {
      e.preventDefault();
      e.stopPropagation();
      startX = e.clientX;
      startY = e.clientY;
      startW = this.el.offsetWidth;
      startH = this.el.offsetHeight;
      this.el.classList.add('resizing');
      this.resizeHandle.setPointerCapture(e.pointerId);
    };

    const onPointerMove = (e) => {
      if (!this.el.classList.contains('resizing')) return;
      const w = Math.max(200, startW + (e.clientX - startX));
      const h = Math.max(120, startH + (e.clientY - startY));
      this.el.style.width = w + 'px';
      this.el.style.height = h + 'px';
    };

    const onPointerUp = () => {
      this.el.classList.remove('resizing');
      this._savedHeight = this.el.offsetHeight;
      if (this.component && this.component.refresh) {
        this.component.refresh();
      }
    };

    this.resizeHandle.addEventListener('pointerdown', onPointerDown);
    this.resizeHandle.addEventListener('pointermove', onPointerMove);
    this.resizeHandle.addEventListener('pointerup', onPointerUp);
    this.resizeHandle.addEventListener('lostpointercapture', onPointerUp);
  }

  _setupDropTarget() {
    this.el.addEventListener('dragover', (e) => {
      // Only accept actor-id drags at the panel level.
      // Graph-tool drags must pass through to the SVG inside.
      if (!e.dataTransfer.types.includes('text/actor-id')) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'link';
      this.el.classList.add('drop-target');
    });

    this.el.addEventListener('dragleave', () => {
      this.el.classList.remove('drop-target');
    });

    this.el.addEventListener('drop', (e) => {
      this.el.classList.remove('drop-target');
      const actorId = e.dataTransfer.getData('text/actor-id');
      if (actorId) {
        e.preventDefault();
        this.bus.emit('actor:link-request', { actorId, panelId: this.id });
      }
    });
  }

  // --- Actor Dropdown ---

  _toggleDropdown() {
    this._dropdownOpen ? this._closeDropdown() : this._openDropdown();
  }

  _openDropdown() {
    this._dropdownOpen = true;
    this.dropdownEl.classList.add('open');
    this._renderDropdownItems();
  }

  _closeDropdown() {
    this._dropdownOpen = false;
    this.dropdownEl.classList.remove('open');
  }

  _renderDropdownItems() {
    this.dropdownEl.innerHTML = '';
    const allActors = this.sim ? this.sim.actors : [];

    if (allActors.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'dropdown-empty';
      empty.textContent = 'No actors';
      this.dropdownEl.appendChild(empty);
      return;
    }

    for (const actor of allActors) {
      const isLinked = this.linkedActors.some(a => a.id === actor.id);
      const isActive = this.activeActorId === actor.id;

      const row = document.createElement('div');
      row.className = 'dropdown-actor-row';
      if (isActive) row.classList.add('active-actor');

      // Checkbox for show/hide
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = isLinked;
      checkbox.className = 'dropdown-checkbox';
      checkbox.addEventListener('change', (e) => {
        e.stopPropagation();
        if (checkbox.checked) {
          this._linkActorById(actor.id);
        } else {
          this._unlinkActorById(actor.id);
        }
        this._renderDropdownItems();
      });
      row.appendChild(checkbox);

      // Color dot
      const dot = document.createElement('span');
      dot.className = 'dropdown-color-dot';
      dot.style.backgroundColor = actor.color;
      row.appendChild(dot);

      // Actor name — clicking sets as edit target
      const name = document.createElement('span');
      name.className = 'dropdown-actor-name';
      name.textContent = actor.name;
      row.appendChild(name);

      // Edit indicator
      if (isActive) {
        const edit = document.createElement('span');
        edit.className = 'dropdown-edit-badge';
        edit.textContent = 'edit';
        row.appendChild(edit);
      }

      // Clicking the row (not checkbox) sets this as active editing actor
      row.addEventListener('click', (e) => {
        if (e.target === checkbox) return;
        // If not linked, link first
        if (!this.linkedActors.some(a => a.id === actor.id)) {
          this._linkActorById(actor.id);
        }
        this.setActiveActor(actor.id);
        this._renderDropdownItems();
      });

      this.dropdownEl.appendChild(row);
    }
  }

  _renderTrigger() {
    this.actorTrigger.innerHTML = '';

    if (this.linkedActors.length === 0) {
      this.actorTrigger.textContent = 'Actors \u25BE';
      this.actorTrigger.classList.add('empty');
      return;
    }
    this.actorTrigger.classList.remove('empty');

    for (const actor of this.linkedActors) {
      const chip = document.createElement('span');
      chip.className = 'trigger-actor-chip';
      chip.style.backgroundColor = actor.color;
      if (this.activeActorId === actor.id) {
        chip.classList.add('active-editing');
      }
      chip.textContent = actor.name;
      this.actorTrigger.appendChild(chip);
    }

    const arrow = document.createElement('span');
    arrow.className = 'trigger-arrow';
    arrow.textContent = '\u25BE';
    this.actorTrigger.appendChild(arrow);
  }

  // --- Actor linking ---

  _linkActorById(actorId) {
    const actor = this.sim ? this.sim.getActor(actorId) : null;
    if (actor) this.linkActor(actor);
  }

  _unlinkActorById(actorId) {
    this.unlinkActor(actorId);
  }

  /** Link an actor to this panel */
  linkActor(actor) {
    if (this.linkedActors.find(a => a.id === actor.id)) return;
    this.linkedActors.push(actor);
    if (!this.activeActorId || this.linkedActors.length === 1) {
      this.activeActorId = actor.id;
    }
    this._renderTrigger();
    if (this.component && this.component.setLinkedActors) {
      this.component.setLinkedActors(this.linkedActors);
    }
  }

  /** Unlink an actor from this panel */
  unlinkActor(actorId) {
    this.linkedActors = this.linkedActors.filter(a => a.id !== actorId);
    if (this.activeActorId === actorId) {
      this.activeActorId = this.linkedActors.length > 0 ? this.linkedActors[0].id : null;
    }
    this._renderTrigger();
    if (this.component && this.component.setLinkedActors) {
      this.component.setLinkedActors(this.linkedActors);
    }
  }

  /** Set which actor is being edited */
  setActiveActor(actorId) {
    this.activeActorId = actorId;
    this._renderTrigger();
    if (this.bus) {
      this.bus.emit('panel:active-actor-changed', { panelId: this.id, actorId });
    }
  }

  /** Get the active actor object (for editing tools) */
  getActiveActor() {
    if (!this.activeActorId) return null;
    return this.linkedActors.find(a => a.id === this.activeActorId) || null;
  }

  toggleCollapse() {
    this._collapsed = !this._collapsed;
    if (this._collapsed) {
      this._savedHeight = this.el.offsetHeight;
      this.contentEl.style.display = 'none';
      this.resizeHandle.style.display = 'none';
      this.el.style.height = 'auto';
    } else {
      this.contentEl.style.display = '';
      this.resizeHandle.style.display = '';
      this.el.style.height = this._savedHeight + 'px';
      if (this.component && this.component.refresh) {
        this.component.refresh();
      }
    }
  }

  destroy() {
    document.removeEventListener('pointerdown', this._globalClickHandler);
    if (this.component && this.component.destroy) {
      this.component.destroy();
    }
    this.el.remove();
  }
}
