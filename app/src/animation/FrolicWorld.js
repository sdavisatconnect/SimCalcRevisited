import { drawAnimalCharacter } from './AnimalSprites.js';
import { mapRange } from '../utils/MathUtils.js';

/**
 * Horizontal "frolic" world for the elementary edition.
 * Same public API as AnimationWorld so PanelFactory can instantiate either.
 * Features a nature/field theme with baby animal characters walking along a path.
 */
export class FrolicWorld {
  constructor(canvas, simulation, bus, linkedActors = []) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.sim = simulation;
    this.bus = bus;
    this.linkedActors = linkedActors;

    // Offscreen canvas for cached background
    this._bgCanvas = null;
    this._bgDirty = true;

    this._lastFacing = {};

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

    this.trackPadding = { left: 60, right: 30 };
    this.groundY = this.displayHeight * 0.78;

    this._bgDirty = true;
    this.drawFrame(this.sim.currentTime);
  }

  posToScreenX(pos) {
    return mapRange(pos,
      this.sim.posRange.min, this.sim.posRange.max,
      this.trackPadding.left, this.displayWidth - this.trackPadding.right
    );
  }

  // ── Background caching ──────────────────────────────────

  _ensureBgCanvas() {
    const w = this.displayWidth;
    const h = this.displayHeight;
    if (!w || !h) return;

    if (!this._bgCanvas || this._bgDirty) {
      if (!this._bgCanvas) {
        this._bgCanvas = document.createElement('canvas');
      }
      const dpr = window.devicePixelRatio || 1;
      this._bgCanvas.width = w * dpr;
      this._bgCanvas.height = h * dpr;
      const bg = this._bgCanvas.getContext('2d');
      bg.setTransform(dpr, 0, 0, dpr, 0, 0);
      this._drawBackground(bg, w, h);
      this._bgDirty = false;
    }
  }

  _drawBackground(ctx, w, h) {
    const groundY = this.groundY;

    // ── Sky gradient ──
    const sky = ctx.createLinearGradient(0, 0, 0, groundY);
    sky.addColorStop(0, '#87CEEB');
    sky.addColorStop(0.6, '#a8dcf0');
    sky.addColorStop(1, '#c5eafc');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, groundY);

    // ── Distant rolling hills ──
    const hillY = groundY * 0.68;
    ctx.fillStyle = '#7dba6e';
    ctx.beginPath();
    ctx.moveTo(0, hillY + 20);
    ctx.quadraticCurveTo(w * 0.15, hillY - 15, w * 0.3, hillY + 10);
    ctx.quadraticCurveTo(w * 0.45, hillY - 25, w * 0.6, hillY + 5);
    ctx.quadraticCurveTo(w * 0.75, hillY - 20, w * 0.9, hillY + 15);
    ctx.quadraticCurveTo(w * 0.95, hillY + 5, w, hillY + 10);
    ctx.lineTo(w, groundY);
    ctx.lineTo(0, groundY);
    ctx.closePath();
    ctx.fill();

    // ── Trees (drawn at different scales for depth) ──
    const trees = [
      { x: w * 0.08, y: hillY + 10, s: 0.6 },
      { x: w * 0.25, y: hillY - 5, s: 0.8 },
      { x: w * 0.52, y: hillY + 2, s: 0.7 },
      { x: w * 0.78, y: hillY - 8, s: 0.9 },
      { x: w * 0.93, y: hillY + 8, s: 0.65 },
    ];
    for (const t of trees) {
      this._drawTree(ctx, t.x, t.y, t.s);
    }

    // ── Grass ground ──
    const grass = ctx.createLinearGradient(0, groundY, 0, h);
    grass.addColorStop(0, '#5cb846');
    grass.addColorStop(0.3, '#4ca83a');
    grass.addColorStop(1, '#3d8a2e');
    ctx.fillStyle = grass;
    ctx.fillRect(0, groundY, w, h - groundY);

    // ── Path (lighter dirt strip where animals walk) ──
    const pathH = 10;
    const pathY = groundY - pathH / 2;
    const path = ctx.createLinearGradient(0, pathY, 0, pathY + pathH);
    path.addColorStop(0, '#c4a96a');
    path.addColorStop(0.5, '#d4bc82');
    path.addColorStop(1, '#b89d5e');
    ctx.fillStyle = path;
    ctx.fillRect(this.trackPadding.left - 10, pathY, w - this.trackPadding.left - this.trackPadding.right + 20, pathH);

    // Small stones along path edges
    ctx.fillStyle = '#bfae88';
    for (let sx = this.trackPadding.left; sx < w - this.trackPadding.right; sx += 18 + (sx * 7 % 11)) {
      const r = 1.5 + (sx * 3 % 2);
      ctx.beginPath();
      ctx.arc(sx, pathY + 1 + (sx * 5 % 3), r, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(sx + 5, pathY + pathH - 1 - (sx * 7 % 3), r * 0.8, 0, Math.PI * 2);
      ctx.fill();
    }

    // ── Flowers scattered in grass ──
    const flowerColors = ['#e74c3c', '#f1c40f', '#e67e22', '#9b59b6', '#e84393', '#fd79a8'];
    for (let i = 0; i < 30; i++) {
      // Deterministic pseudo-random positions from index
      const fx = (i * 137.5 + 42) % w;
      const fy = groundY + 8 + ((i * 73 + 19) % (h - groundY - 16));
      // Skip flowers on the path
      if (fy < pathY + pathH + 4 && fy > pathY - 4) continue;
      const fc = flowerColors[i % flowerColors.length];
      const fr = 2 + (i % 3);
      // Stem
      ctx.strokeStyle = '#3d8a2e';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      ctx.lineTo(fx, fy + 5);
      ctx.stroke();
      // Petals
      ctx.fillStyle = fc;
      ctx.beginPath();
      ctx.arc(fx, fy, fr, 0, Math.PI * 2);
      ctx.fill();
      // Center
      ctx.fillStyle = '#f9e74a';
      ctx.beginPath();
      ctx.arc(fx, fy, fr * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }

    // ── Distance markers along the path ──
    ctx.fillStyle = '#555';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    const posStep = this.sim.posRange.max <= 10 ? 1 : (this.sim.posRange.max <= 20 ? 2 : 5);
    for (let d = this.sim.posRange.min; d <= this.sim.posRange.max; d += posStep) {
      const x = this.posToScreenX(d);
      // Tick mark
      ctx.strokeStyle = '#a08555';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, groundY + 4);
      ctx.lineTo(x, groundY + 10);
      ctx.stroke();
      // Label
      ctx.fillStyle = '#ddd';
      ctx.fillText(d + 'm', x, groundY + 20);
    }
  }

  _drawTree(ctx, x, baseY, scale) {
    const s = scale;
    // Trunk
    const trunkW = 6 * s;
    const trunkH = 28 * s;
    ctx.fillStyle = '#6b4226';
    ctx.fillRect(x - trunkW / 2, baseY - trunkH, trunkW, trunkH);

    // Canopy layers (overlapping circles for a bushy look)
    ctx.fillStyle = '#3a7d2c';
    const canopyR = 16 * s;
    ctx.beginPath();
    ctx.arc(x, baseY - trunkH - canopyR * 0.4, canopyR, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#4a9e3a';
    ctx.beginPath();
    ctx.arc(x - canopyR * 0.4, baseY - trunkH - canopyR * 0.1, canopyR * 0.75, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + canopyR * 0.45, baseY - trunkH - canopyR * 0.15, canopyR * 0.7, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── Main draw ───────────────────────────────────────────

  drawFrame(currentTime) {
    const ctx = this.ctx;
    const w = this.displayWidth;
    const h = this.displayHeight;
    if (!w || !h) return;

    ctx.clearRect(0, 0, w, h);

    // Composite cached background
    this._ensureBgCanvas();
    if (this._bgCanvas) {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(this._bgCanvas, 0, 0);
      ctx.restore();
    }

    // ── Draw actors with depth perspective ──
    const actors = this.linkedActors;
    const actorPositions = actors.map((a, i) => ({
      actor: a,
      pos: a.getPositionAt(currentTime),
      vel: a.getVelocityAt(currentTime),
      lane: i,
    }));

    const numActors = actors.length;
    const laneOffset = Math.min(14, 120 / Math.max(numActors, 1));
    const laneScale = Math.min(0.12, 0.8 / Math.max(numActors, 1));

    // Draw back-to-front
    const sorted = [...actorPositions].sort((a, b) => b.lane - a.lane);
    for (const { actor, pos, vel, lane } of sorted) {
      const screenX = this.posToScreenX(pos);
      const depthScale = 1 - lane * laneScale;
      const depthGroundY = this.groundY - lane * laneOffset;

      let motion = null;
      if (Math.abs(vel) > 0.1) {
        const facing = vel > 0 ? 1 : -1;
        this._lastFacing[actor.id] = facing;
        const walkPhase = (currentTime * 3) % 1;
        motion = { facing, walkPhase };
      } else if (this._lastFacing[actor.id]) {
        motion = { facing: this._lastFacing[actor.id], walkPhase: 0 };
      }

      drawAnimalCharacter(ctx, screenX, depthGroundY, actor.color, actor.name, depthScale, motion, actor.animalType, false);
    }

    // ── Time badge ──
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
