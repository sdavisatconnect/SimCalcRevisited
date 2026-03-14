/**
 * Simplified sidebar for elementary edition.
 * Contains: velocity block drag tool, eraser mode, clear all, tips.
 */
import { t, getLanguage } from '../i18n/strings.js';

export class ElementarySidebar {
  constructor(containerEl, bus) {
    this.el = containerEl;
    this.bus = bus;
    this.activeTool = 'pointer'; // 'pointer' or 'eraser'
    this._build();

    bus.on('language:changed', () => this._build());
  }

  _build() {
    this.el.innerHTML = '';

    // --- Velocity section ---
    const blocksSection = this._createSection(t('velocitySection'));

    // Velocity block draggable tool
    const cubeTool = document.createElement('div');
    cubeTool.className = 'elementary-cube-tool';
    cubeTool.draggable = true;

    const cubeLabel = document.createElement('span');
    cubeLabel.innerHTML = '<div class="elementary-cube-icon"></div> ' + t('velocityBlock');
    cubeTool.appendChild(cubeLabel);

    // Pronunciation button
    const speakBtn = document.createElement('button');
    speakBtn.className = 'velocity-speak-btn';
    speakBtn.textContent = '🔊';
    speakBtn.title = t('hearVelocity');
    speakBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      const utterance = new SpeechSynthesisUtterance(t('velocityWord'));
      utterance.lang = getLanguage() === 'es' ? 'es-ES' : 'en-US';
      utterance.rate = 0.8;
      speechSynthesis.speak(utterance);
    });
    cubeTool.appendChild(speakBtn);

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
    const toolsSection = this._createSection(t('toolsSection'));

    // Pointer button
    const pointerBtn = document.createElement('button');
    pointerBtn.className = 'sidebar-tool-btn' + (this.activeTool === 'pointer' ? ' active' : '');
    pointerBtn.textContent = t('selectTool');
    pointerBtn.addEventListener('click', () => {
      this.setActiveTool('pointer');
    });
    this._pointerBtn = pointerBtn;
    toolsSection.appendChild(pointerBtn);

    // Eraser button
    const eraserBtn = document.createElement('button');
    eraserBtn.className = 'sidebar-tool-btn' + (this.activeTool === 'eraser' ? ' active' : '');
    eraserBtn.textContent = t('eraserTool');
    eraserBtn.addEventListener('click', () => {
      this.setActiveTool('eraser');
    });
    this._eraserBtn = eraserBtn;
    toolsSection.appendChild(eraserBtn);

    // Clear All button
    const clearBtn = document.createElement('button');
    clearBtn.className = 'elementary-clear-btn';
    clearBtn.textContent = t('clearAll');
    clearBtn.addEventListener('click', () => {
      this.bus.emit('blocks:clear-all');
    });
    toolsSection.appendChild(clearBtn);
    this.el.appendChild(toolsSection);

    // --- Tips section ---
    const tipsSection = this._createSection(t('tipsSection'));
    const tips = document.createElement('div');
    tips.className = 'elementary-tips';
    tips.innerHTML = `
      <p>${t('tip1')}</p>
      <p>${t('tip4')}</p>
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
