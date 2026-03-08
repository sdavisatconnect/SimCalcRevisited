/**
 * Sidebar panel with per-student visibility toggles.
 * Select All / Deselect All buttons at top.
 * Emits 'results:visibility-changed' on the bus.
 */
export class VisibilityPanel {
  constructor(container, bus, students) {
    this.container = container;
    this.bus = bus;
    this.students = students; // [{ id, initials, color, visible }]

    this.render();
  }

  render() {
    this.container.innerHTML = '';

    // Title
    const title = document.createElement('div');
    title.className = 'visibility-title';
    title.textContent = 'STUDENTS';
    this.container.appendChild(title);

    // Bulk buttons
    const bulkRow = document.createElement('div');
    bulkRow.className = 'visibility-bulk-row';

    const selectAllBtn = document.createElement('button');
    selectAllBtn.className = 'visibility-bulk-btn';
    selectAllBtn.textContent = 'Select All';
    selectAllBtn.addEventListener('click', () => this._selectAll());

    const deselectAllBtn = document.createElement('button');
    deselectAllBtn.className = 'visibility-bulk-btn';
    deselectAllBtn.textContent = 'Deselect All';
    deselectAllBtn.addEventListener('click', () => this._deselectAll());

    bulkRow.appendChild(selectAllBtn);
    bulkRow.appendChild(deselectAllBtn);
    this.container.appendChild(bulkRow);

    // Student list
    const list = document.createElement('div');
    list.className = 'visibility-list';

    for (const student of this.students) {
      const row = document.createElement('label');
      row.className = 'visibility-row' + (student.visible ? '' : ' dimmed');
      row.dataset.studentId = student.id;

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = student.visible;
      checkbox.className = 'visibility-checkbox';
      checkbox.addEventListener('change', () => {
        student.visible = checkbox.checked;
        row.classList.toggle('dimmed', !student.visible);
        this._emitChange();
      });

      const dot = document.createElement('span');
      dot.className = 'visibility-dot';
      dot.style.backgroundColor = student.color;

      const label = document.createElement('span');
      label.className = 'visibility-label';
      label.textContent = student.initials;

      row.appendChild(checkbox);
      row.appendChild(dot);
      row.appendChild(label);
      list.appendChild(row);
    }

    this.container.appendChild(list);
  }

  _selectAll() {
    this.students.forEach(s => s.visible = true);
    this._emitChange();
    this.render();
  }

  _deselectAll() {
    this.students.forEach(s => s.visible = false);
    this._emitChange();
    this.render();
  }

  _emitChange() {
    const visibleIds = this.students.filter(s => s.visible).map(s => s.id);
    this.bus.emit('results:visibility-changed', { visibleIds });
  }
}
