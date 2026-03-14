/**
 * Simplified sidebar for elementary edition.
 * Contains: unifix cube drag tool, eraser mode, clear all, tips.
 */
export class ElementarySidebar {
  constructor(containerEl, bus) {
    this.el = containerEl;
    this.bus = bus;
    this.activeTool = 'pointer'; // 'pointer' or 'eraser'
    this._build();
  }

  _build() {
    this.el.innerHTML = '';

    // --- Blocks section ---
    const blocksSection = this._createSection('Blocks');

    // Unifix cube draggable tool
    const cubeTool = document.createElement('div');
    cubeTool.className = 'elementary-cube-tool';
    cubeTool.draggable = true;
    cubeTool.innerHTML = '<div class="elementary-cube-icon"></div> Drag a Block';
    cubeTool.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/graph-tool', JSON.stringify({
        tool: 'add-block',
        targetGraphType: 'velocity',
      }));
      e.dataTransfer.effectAllowed = 'copy';
      cubeTool.style.opacity = '0.4';
      this.bus.emit('tool:drag-start', { targetGraphType: 'velocity' });
    });
    cubeTool.addEventListener('dragend', () => {
      cubeTool.style.opacity = '';
      this.bus.emit('tool:drag-end');
    });
    blocksSection.appendChild(cubeTool);
    this.el.appendChild(blocksSection);

    // --- Tools section ---
    const toolsSection = this._createSection('Tools');

    // Pointer button
    const pointerBtn = document.createElement('button');
    pointerBtn.className = 'sidebar-tool-btn active';
    pointerBtn.textContent = '👆 Select';
    pointerBtn.addEventListener('click', () => {
      this.setActiveTool('pointer');
    });
    this._pointerBtn = pointerBtn;
    toolsSection.appendChild(pointerBtn);

    // Eraser button
    const eraserBtn = document.createElement('button');
    eraserBtn.className = 'sidebar-tool-btn';
    eraserBtn.textContent = '🧹 Eraser';
    eraserBtn.addEventListener('click', () => {
      this.setActiveTool('eraser');
    });
    this._eraserBtn = eraserBtn;
    toolsSection.appendChild(eraserBtn);

    // Clear All button
    const clearBtn = document.createElement('button');
    clearBtn.className = 'elementary-clear-btn';
    clearBtn.textContent = '✕ Clear All';
    clearBtn.addEventListener('click', () => {
      this.bus.emit('blocks:clear-all');
    });
    toolsSection.appendChild(clearBtn);
    this.el.appendChild(toolsSection);

    // --- Tips section ---
    const tipsSection = this._createSection('Tips');
    const tips = document.createElement('div');
    tips.className = 'elementary-tips';
    tips.innerHTML = `
      <p>🧱 Drag blocks onto the speed graph!</p>
      <p>📈 Stack higher to go faster!</p>
      <p>⬇️ Blocks below the line go backward!</p>
      <p>▶️ Press Play to watch!</p>
    `;
    tipsSection.appendChild(tips);
    this.el.appendChild(tipsSection);
  }

  _createSection(title) {
    const section = document.createElement('div');
    section.className = 'sidebar-section';

    const header = document.createElement('div');
    header.className = 'sidebar-section-header';
    header.textContent = title;
    section.appendChild(header);

    const content = document.createElement('div');
    content.className = 'sidebar-section-content';
    section.appendChild(content);

    // Return the content div so children are appended there
    return section;
  }

  setActiveTool(tool) {
    this.activeTool = tool;
    this._pointerBtn.classList.toggle('active', tool === 'pointer');
    this._eraserBtn.classList.toggle('active', tool === 'eraser');
    this.bus.emit('tool:changed', { tool });
  }

  /** Restore to default state */
  restore() {
    this.setActiveTool('pointer');
  }
}
