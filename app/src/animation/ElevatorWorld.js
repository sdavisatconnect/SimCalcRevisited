import { drawCharacter } from './CharacterSprites.js';
import { mapRange } from '../utils/MathUtils.js';

/**
 * Vertical elevator world renderer.
 * Same public API as AnimationWorld so PanelFactory can instantiate either.
 * Each linked actor gets its own elevator shaft. Position maps to vertical Y.
 */
export class ElevatorWorld {
  constructor(canvas, simulation, bus, linkedActors = []) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.sim = simulation;
    this.bus = bus;
    this.linkedActors = linkedActors;

    this._resize();
    this._resizeObserver = new ResizeObserver(() => this._resize());
    this._resizeObserver.observe(canvas.parentElement);

    this.drawFrame(0);
  }

  setLinkedActors(actors) {
    this.linkedActors = actors;
    this.drawFrame(this.sim.currentTime);
  }

  refresh() {
    this._resize();
  }

  _resize() {
    const parent = this.canvas.parentElement;
    const rect = parent.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.canvas.style.width = rect.width + 'px';
    this.canvas.style.height = rect.height + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.displayWidth = rect.width;
    this.displayHeight = rect.height;

    // Building layout
    this.labelWidth = 36;
    this.buildingTop = this.displayHeight * 0.06;
    this.buildingBottom = this.displayHeight * 0.92;
    const posRange = this.sim.posRange;
    const span = (posRange.max - posRange.min) || 1;
    this.floorHeight = (this.buildingBottom - this.buildingTop) / span;
    this.shaftWidth = this.floorHeight * 0.6 + 16;  // car width + gap

    this.drawFrame(this.sim.currentTime);
  }

  /** Map a simulation position value to screen Y (higher position = higher on screen = lower Y) */
  posToScreenY(pos) {
    return mapRange(pos,
      this.sim.posRange.min, this.sim.posRange.max,
      this.buildingBottom, this.buildingTop
    );
  }

  /** Get the X center for the nth shaft */
  _shaftCenterX(index, count) {
    const availW = this.displayWidth - this.labelWidth - 20;
    if (count <= 1) return this.labelWidth + availW / 2;
    const spacing = Math.min(this.shaftWidth + 20, availW / count);
    const totalW = spacing * count;
    const startX = this.labelWidth + (availW - totalW) / 2 + spacing / 2;
    return startX + index * spacing;
  }

  drawFrame(currentTime) {
    const ctx = this.ctx;
    const w = this.displayWidth;
    const h = this.displayHeight;
    if (!w || !h) return;

    ctx.clearRect(0, 0, w, h);

    // Sky background
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#87CEEB');
    sky.addColorStop(0.7, '#b0e0f0');
    sky.addColorStop(1, '#98c8d8');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    // Building facade
    const bLeft = this.labelWidth;
    const bRight = w - 10;
    ctx.fillStyle = '#7a7268';
    ctx.fillRect(bLeft, this.buildingTop - 8, bRight - bLeft, this.buildingBottom - this.buildingTop + 16);

    // Building inner wall
    ctx.fillStyle = '#8a8278';
    ctx.fillRect(bLeft + 4, this.buildingTop - 4, bRight - bLeft - 8, this.buildingBottom - this.buildingTop + 8);

    // Floor lines and labels
    const posRange = this.sim.posRange;
    const span = posRange.max - posRange.min;
    const posStep = 1;  // label every floor

    ctx.font = '10px sans-serif';
    ctx.textAlign = 'right';

    for (let d = posRange.min; d <= posRange.max; d += posStep) {
      const y = this.posToScreenY(d);

      // Floor line across building
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(bLeft + 4, y);
      ctx.lineTo(bRight - 4, y);
      ctx.stroke();

      // Tick on left edge
      ctx.strokeStyle = '#ddd';
      ctx.beginPath();
      ctx.moveTo(bLeft - 2, y);
      ctx.lineTo(bLeft + 6, y);
      ctx.stroke();

      // Label
      ctx.fillStyle = '#ddd';
      ctx.fillText(d, bLeft - 5, y + 3);
    }

    // Draw elevator shafts and actors
    const actors = this.linkedActors;
    const n = actors.length;

    for (let i = 0; i < n; i++) {
      const actor = actors[i];
      const cx = this._shaftCenterX(i, n);
      const halfW = this.shaftWidth / 2;

      // Shaft walls
      ctx.strokeStyle = 'rgba(200,200,200,0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx - halfW, this.buildingTop);
      ctx.lineTo(cx - halfW, this.buildingBottom);
      ctx.moveTo(cx + halfW, this.buildingTop);
      ctx.lineTo(cx + halfW, this.buildingBottom);
      ctx.stroke();

      // Shaft background (slightly darker)
      ctx.fillStyle = 'rgba(0,0,0,0.08)';
      ctx.fillRect(cx - halfW, this.buildingTop, this.shaftWidth, this.buildingBottom - this.buildingTop);

      // Elevator car at current position
      const pos = actor.getPositionAt(currentTime);
      const carY = this.posToScreenY(pos);  // bottom of car (floor level)
      const carH = this.floorHeight;        // exactly 1 floor tall
      const carW = carH * 0.6;              // narrower than tall (rectangular elevator)

      const carLeft = cx - carW / 2;
      const carTop = carY - carH;

      // Cable line from car top to building top
      ctx.strokeStyle = 'rgba(150,150,150,0.5)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx, carTop);
      ctx.lineTo(cx, this.buildingTop);
      ctx.stroke();

      // Car body — enclosed box
      // Back wall
      ctx.fillStyle = 'rgba(60,60,60,0.6)';
      ctx.fillRect(carLeft, carTop, carW, carH);

      // Interior gradient (slightly lighter in center for depth)
      const interiorGrad = ctx.createLinearGradient(carLeft, 0, carLeft + carW, 0);
      interiorGrad.addColorStop(0, 'rgba(40,40,40,0.4)');
      interiorGrad.addColorStop(0.5, 'rgba(80,80,80,0.15)');
      interiorGrad.addColorStop(1, 'rgba(40,40,40,0.4)');
      ctx.fillStyle = interiorGrad;
      ctx.fillRect(carLeft, carTop, carW, carH);

      // Character standing inside the car (on the car floor)
      const charScale = Math.min((carH - 4) / 40, 0.55);
      drawCharacter(ctx, cx, carY, actor.color, actor.name, charScale);

      // Car frame — outer walls, ceiling, floor
      ctx.strokeStyle = actor.color;
      ctx.lineWidth = 2;
      // Left wall
      ctx.beginPath();
      ctx.moveTo(carLeft, carTop);
      ctx.lineTo(carLeft, carY);
      ctx.stroke();
      // Right wall
      ctx.beginPath();
      ctx.moveTo(carLeft + carW, carTop);
      ctx.lineTo(carLeft + carW, carY);
      ctx.stroke();
      // Ceiling
      ctx.beginPath();
      ctx.moveTo(carLeft, carTop);
      ctx.lineTo(carLeft + carW, carTop);
      ctx.stroke();
      // Floor
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(carLeft, carY);
      ctx.lineTo(carLeft + carW, carY);
      ctx.stroke();

      // Door seam — vertical line in the center
      ctx.strokeStyle = 'rgba(200,200,200,0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx, carTop + 4);
      ctx.lineTo(cx, carY - 2);
      ctx.stroke();

      // Car roof hardware (pulley bracket)
      ctx.fillStyle = '#666';
      ctx.fillRect(cx - 4, carTop - 3, 8, 4);
    }

    // Ground line at position 0 (if visible)
    if (posRange.min <= 0 && posRange.max >= 0) {
      const groundY = this.posToScreenY(0);
      ctx.strokeStyle = '#5a9e4b';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(bLeft, groundY);
      ctx.lineTo(bRight, groundY);
      ctx.stroke();
    }

    // Time display badge
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(8, 8, 80, 24);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`t = ${currentTime.toFixed(1)}s`, 14, 24);
  }

  redraw() {
    this.drawFrame(this.sim.currentTime);
  }

  destroy() {
    if (this._resizeObserver) this._resizeObserver.disconnect();
  }
}
