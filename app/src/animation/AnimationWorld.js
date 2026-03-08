import { drawCharacter } from './CharacterSprites.js';
import { mapRange } from '../utils/MathUtils.js';

export class AnimationWorld {
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

    this.trackPadding = { left: 60, right: 30 };
    this.groundY = this.displayHeight * 0.78;

    this.drawFrame(this.sim.currentTime);
  }

  posToScreenX(pos) {
    return mapRange(pos,
      this.sim.posRange.min, this.sim.posRange.max,
      this.trackPadding.left, this.displayWidth - this.trackPadding.right
    );
  }

  drawFrame(currentTime) {
    const ctx = this.ctx;
    const w = this.displayWidth;
    const h = this.displayHeight;
    if (!w || !h) return;

    ctx.clearRect(0, 0, w, h);

    // Sky
    const sky = ctx.createLinearGradient(0, 0, 0, this.groundY);
    sky.addColorStop(0, '#87CEEB');
    sky.addColorStop(1, '#b0e0f0');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, this.groundY);

    // Ground
    const ground = ctx.createLinearGradient(0, this.groundY, 0, h);
    ground.addColorStop(0, '#5a9e4b');
    ground.addColorStop(0.3, '#4a8c3f');
    ground.addColorStop(1, '#3d7a34');
    ctx.fillStyle = ground;
    ctx.fillRect(0, this.groundY, w, h - this.groundY);

    // Track line
    ctx.strokeStyle = '#8B7355';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(this.trackPadding.left, this.groundY);
    ctx.lineTo(w - this.trackPadding.right, this.groundY);
    ctx.stroke();

    // Distance markers
    ctx.fillStyle = '#555';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    const posStep = this.sim.posRange.max <= 10 ? 1 : (this.sim.posRange.max <= 20 ? 2 : 5);
    for (let d = this.sim.posRange.min; d <= this.sim.posRange.max; d += posStep) {
      const x = this.posToScreenX(d);
      ctx.strokeStyle = '#8B7355';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, this.groundY);
      ctx.lineTo(x, this.groundY + 6);
      ctx.stroke();
      ctx.fillStyle = '#ddd';
      ctx.fillText(d + 'm', x, this.groundY + 16);
    }

    // Draw linked actors only
    const actors = this.linkedActors;
    const actorPositions = actors.map(a => ({
      actor: a,
      pos: a.getPositionAt(currentTime),
      vel: a.getVelocityAt(currentTime),
    }));
    for (let i = 0; i < actorPositions.length; i++) {
      const { actor, pos, vel } = actorPositions[i];
      let screenX = this.posToScreenX(pos);
      for (let j = 0; j < i; j++) {
        const otherX = this.posToScreenX(actorPositions[j].pos);
        if (Math.abs(screenX - otherX) < 24) {
          screenX += (i - j) * 24;
        }
      }

      // Determine facing direction and walk cycle phase from velocity
      let motion = null;
      if (Math.abs(vel) > 0.001) {
        const facing = vel > 0 ? 1 : -1;
        // Walk cycle: ~3 steps per second, phase driven by time
        const walkPhase = (currentTime * 3) % 1;
        motion = { facing, walkPhase };
      }

      drawCharacter(ctx, screenX, this.groundY, actor.color, actor.name, 1, motion);
    }

    // Time display
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
