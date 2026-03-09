import { PiecewiseLinearFunction } from '../model/PiecewiseLinearFunction.js';

/**
 * Vernier GoDirect Motion Detector CSV import.
 * Parses CSV files exported from Vernier Graphical Analysis
 * and imports position-vs-time data into a SimCalc actor.
 */

/**
 * Parse a Vernier-style CSV file containing time and position data.
 * Handles various header formats from Graphical Analysis exports.
 *
 * @param {string} csvText - Raw CSV file contents
 * @returns {{ times: number[], positions: number[], error: string|null }}
 */
export function parseVernierCSV(csvText) {
  const lines = csvText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);

  if (lines.length < 2) {
    return { times: [], positions: [], error: 'File is empty or has no data rows.' };
  }

  // Find the header row: look for a line containing time-like and position-like column names
  let headerIdx = -1;
  let timeCol = -1;
  let posCol = -1;

  const timePatterns = [/\btime\b/i, /\bt\s*\(/i];
  const posPatterns = [/\bposition\b/i, /\bdistance\b/i, /\bmotion\b/i, /\bpos\b/i];

  for (let i = 0; i < Math.min(lines.length, 20); i++) {
    const cols = splitCSVLine(lines[i]);
    let foundTime = -1;
    let foundPos = -1;

    for (let c = 0; c < cols.length; c++) {
      const col = cols[c].toLowerCase();
      if (foundTime < 0 && timePatterns.some(p => p.test(cols[c]))) {
        foundTime = c;
      }
      if (foundPos < 0 && posPatterns.some(p => p.test(cols[c]))) {
        foundPos = c;
      }
    }

    if (foundTime >= 0 && foundPos >= 0) {
      headerIdx = i;
      timeCol = foundTime;
      posCol = foundPos;
      break;
    }
  }

  // Fallback: if no labeled header found, try to detect two-column numeric data
  if (headerIdx < 0) {
    // Check if first row is numeric (headerless CSV)
    const firstCols = splitCSVLine(lines[0]);
    if (firstCols.length >= 2 && !isNaN(parseFloat(firstCols[0])) && !isNaN(parseFloat(firstCols[1]))) {
      headerIdx = -1; // no header
      timeCol = 0;
      posCol = 1;
    } else {
      // Try using first row as header with generic column detection
      headerIdx = 0;
      timeCol = 0;
      posCol = 1;
    }
  }

  // Parse data rows
  const startRow = headerIdx + 1;
  const times = [];
  const positions = [];

  for (let i = startRow; i < lines.length; i++) {
    const cols = splitCSVLine(lines[i]);
    if (cols.length <= Math.max(timeCol, posCol)) continue;

    const t = parseFloat(cols[timeCol]);
    const p = parseFloat(cols[posCol]);

    if (isNaN(t) || isNaN(p)) continue;

    times.push(t);
    positions.push(p);
  }

  if (times.length < 2) {
    return { times: [], positions: [], error: 'Could not find at least 2 valid data rows with time and position values.' };
  }

  // Sort by time (should already be sorted, but just in case)
  const indices = times.map((_, i) => i).sort((a, b) => times[a] - times[b]);
  const sortedTimes = indices.map(i => times[i]);
  const sortedPositions = indices.map(i => positions[i]);

  return { times: sortedTimes, positions: sortedPositions, error: null };
}

/** Split a CSV line respecting quoted fields */
function splitCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if ((ch === ',' || ch === '\t') && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * Show the import dialog modal.
 * @param {Simulation} simulation
 * @param {Workspace} workspace
 * @param {EventBus} bus
 */
export function showImportDialog(simulation, workspace, bus) {
  // Don't open multiple
  if (document.querySelector('.import-overlay')) return;

  let parsedData = null;

  const overlay = document.createElement('div');
  overlay.className = 'import-overlay';

  const card = document.createElement('div');
  card.className = 'import-card';

  card.innerHTML = `
    <button class="about-close import-close" title="Close">&times;</button>
    <h2 class="import-title">Import Motion Data</h2>

    <div class="import-field">
      <label class="import-label">Import into Actor</label>
      <select class="import-actor-select"></select>
    </div>

    <div class="import-field">
      <label class="import-label">CSV File</label>
      <div class="import-file-row">
        <button type="button" class="import-file-btn">Choose CSV File...</button>
        <span class="import-file-name">No file selected</span>
      </div>
      <input type="file" class="import-file-input" accept=".csv,.txt,.tsv,text/csv,text/plain" style="display:none" />
    </div>

    <div class="import-preview" style="display:none">
      <div class="import-preview-title">Preview</div>
      <div class="import-preview-stats"></div>
    </div>

    <div class="import-error" style="display:none"></div>

    <div class="import-info" style="display:none">
      Data will be imported as the position function for the selected actor.
      Time range and graph axes will adjust automatically.
    </div>

    <div class="import-actions">
      <button type="button" class="import-cancel-btn">Cancel</button>
      <button type="button" class="import-confirm-btn" disabled>Import Data</button>
    </div>
  `;

  overlay.appendChild(card);

  // Populate actor dropdown
  const actorSelect = card.querySelector('.import-actor-select');
  for (const actor of simulation.actors) {
    const opt = document.createElement('option');
    opt.value = actor.id;
    opt.textContent = actor.name;
    actorSelect.appendChild(opt);
  }

  if (simulation.actors.length === 0) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = '(No actors — add one first)';
    actorSelect.appendChild(opt);
  }

  // File picker
  const fileInput = card.querySelector('.import-file-input');
  const fileBtn = card.querySelector('.import-file-btn');
  const fileName = card.querySelector('.import-file-name');
  const previewEl = card.querySelector('.import-preview');
  const previewStats = card.querySelector('.import-preview-stats');
  const errorEl = card.querySelector('.import-error');
  const infoEl = card.querySelector('.import-info');
  const confirmBtn = card.querySelector('.import-confirm-btn');

  fileBtn.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (!file) return;

    fileName.textContent = file.name;
    errorEl.style.display = 'none';
    previewEl.style.display = 'none';
    infoEl.style.display = 'none';
    confirmBtn.disabled = true;
    parsedData = null;

    const reader = new FileReader();
    reader.onload = () => {
      const result = parseVernierCSV(reader.result);

      if (result.error) {
        errorEl.textContent = result.error;
        errorEl.style.display = 'block';
        return;
      }

      parsedData = result;

      const tMin = result.times[0].toFixed(2);
      const tMax = result.times[result.times.length - 1].toFixed(2);
      const pMin = Math.min(...result.positions).toFixed(3);
      const pMax = Math.max(...result.positions).toFixed(3);

      previewStats.innerHTML = `
        <div><strong>${result.times.length}</strong> data points</div>
        <div>Time: ${tMin}s &ndash; ${tMax}s</div>
        <div>Position: ${pMin}m &ndash; ${pMax}m</div>
      `;
      previewEl.style.display = 'block';
      infoEl.style.display = 'block';
      confirmBtn.disabled = false;
    };
    reader.readAsText(file);
  });

  // Close handlers
  const close = () => {
    overlay.classList.add('dismissing');
    overlay.addEventListener('animationend', () => overlay.remove());
  };

  card.querySelector('.import-close').addEventListener('click', close);
  card.querySelector('.import-cancel-btn').addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  // Import confirm
  confirmBtn.addEventListener('click', () => {
    if (!parsedData || !actorSelect.value) return;

    const actor = simulation.getActor(actorSelect.value);
    if (!actor) return;

    // Build position function from imported data
    const points = parsedData.times.map((t, i) => ({ t, v: parsedData.positions[i] }));
    const accelerations = new Array(points.length - 1).fill(0);
    actor.positionFn = new PiecewiseLinearFunction(points, accelerations);

    // Adjust simulation time range to fit data
    const maxTime = parsedData.times[parsedData.times.length - 1];
    simulation.timeRange = { min: 0, max: Math.ceil(maxTime) };

    // Adjust position range to fit data with padding
    const posMin = Math.min(...parsedData.positions);
    const posMax = Math.max(...parsedData.positions);
    const posPad = Math.max(0.5, (posMax - posMin) * 0.1);
    simulation.posRange = {
      min: Math.floor((posMin - posPad) * 2) / 2,
      max: Math.ceil((posMax + posPad) * 2) / 2,
    };

    // Update all graph panel renderers with new ranges
    for (const panel of workspace.panels) {
      if (!panel.component || !panel.component.renderer) continue;

      if (panel.type === 'position') {
        panel.component.renderer.setRanges(
          { ...simulation.timeRange },
          { ...simulation.posRange }
        );
      } else if (panel.type === 'velocity') {
        panel.component.renderer.setRanges(
          { ...simulation.timeRange },
          { ...simulation.velRange }
        );
      } else if (panel.type === 'acceleration') {
        panel.component.renderer.setRanges(
          { ...simulation.timeRange },
          { ...simulation.accelRange }
        );
      } else if (panel.type === 'world' && panel.component.setWorldRange) {
        panel.component.setWorldRange(simulation.posRange);
      }

      if (panel.component.redraw) {
        panel.component.redraw();
      }
    }

    // Emit events to trigger full redraw
    bus.emit('actor:edited', { actorId: actor.id });
    bus.emit('actors:changed');

    // Reset playback to start
    simulation.currentTime = 0;
    simulation.isPlaying = false;
    bus.emit('time:update', { currentTime: 0 });

    close();
  });

  document.body.appendChild(overlay);
}
