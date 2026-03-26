import { drawAnimalCharacter } from './AnimalSprites.js';
import { mapRange } from '../utils/MathUtils.js';

/**
 * Vertical ocean world for the elementary edition.
 * Same public API as ElevatorWorld so PanelFactory can instantiate either.
 * Position 0 is the water surface. Positive = above water (sky), negative = underwater.
 * Animals float/swim freely in their column with no elevator shaft.
 */
export class SeaWorld {
  constructor(canvas, simulation, bus, linkedActors = [], options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.sim = simulation;
    this.bus = bus;
    this.linkedActors = linkedActors;

    // Seed-based background creatures (deterministic from index)
    this._bgCreatures = this._generateBgCreatures();

    // Bubble particle state — keyed by actor id/name
    // Each bubble lives in position-space so it's independent of animal movement
    this._bubbleParticles = new Map();

    // Panning state
    this._panState = null;
    this._setupPanning();

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

    // Layout
    this.labelWidth = 36;
    this.areaTop = this.displayHeight * 0.06;
    this.areaBottom = this.displayHeight * 0.92;
    const posRange = this.sim.posRange;
    const span = (posRange.max - posRange.min) || 1;
    this.unitHeight = (this.areaBottom - this.areaTop) / span;

    // Column width for actors (like ElevatorWorld shaft sizing)
    const numActors = Math.max(this.linkedActors.length, 1);
    const availW = this.displayWidth - this.labelWidth - 20;
    this.columnWidth = Math.max(16, Math.min(this.unitHeight * 0.6 + 16, Math.floor(availW / numActors) - 4));

    this.drawFrame(this.sim.currentTime);
  }

  /** Map simulation position to screen Y (higher pos = higher on screen = lower Y) */
  posToScreenY(pos) {
    return mapRange(pos,
      this.sim.posRange.min, this.sim.posRange.max,
      this.areaBottom, this.areaTop
    );
  }

  /** Get the X center for the nth actor column */
  _columnCenterX(index, count) {
    const availW = this.displayWidth - this.labelWidth - 20;
    if (count <= 1) return this.labelWidth + availW / 2;
    const spacing = Math.min(this.columnWidth + 20, availW / count);
    const totalW = spacing * count;
    const startX = this.labelWidth + (availW - totalW) / 2 + spacing / 2;
    return startX + index * spacing;
  }

  // ── Background creatures (deterministic from index) ─────

  _generateBgCreatures() {
    const creatures = [];
    // Fish (6)
    for (let i = 0; i < 6; i++) {
      creatures.push({
        type: 'fish',
        baseX: (i * 137 + 50) % 300 + 50,  // fractional positions, mapped to screen at draw time
        baseY: 0.15 + (i * 0.12),           // fraction of underwater depth
        speed: 0.3 + (i % 3) * 0.2,
        amplitude: 8 + (i % 4) * 4,
        size: 5 + (i % 3) * 2,
        color: ['#e74c3c', '#3498db', '#f39c12', '#2ecc71', '#e67e22', '#9b59b6'][i],
        direction: i % 2 === 0 ? 1 : -1,
      });
    }
    // Seahorses (2)
    for (let i = 0; i < 2; i++) {
      creatures.push({
        type: 'seahorse',
        baseX: 80 + i * 200,
        baseY: 0.3 + i * 0.25,
        bobSpeed: 0.5 + i * 0.3,
        bobAmount: 6 + i * 4,
        size: 6 + i * 2,
        color: i === 0 ? '#f1c40f' : '#e88e5a',
      });
    }
    // Bubbles (4)
    for (let i = 0; i < 4; i++) {
      creatures.push({
        type: 'bubble',
        baseX: 60 + i * 90,
        riseSpeed: 15 + (i % 3) * 8,
        size: 2 + (i % 3),
        cycleDuration: 6 + i * 2,
      });
    }
    return creatures;
  }

  // ── Drawing ─────────────────────────────────────────────

  drawFrame(currentTime) {
    const ctx = this.ctx;
    const w = this.displayWidth;
    const h = this.displayHeight;
    if (!w || !h) return;

    ctx.clearRect(0, 0, w, h);

    const posRange = this.sim.posRange;
    // Screen Y of position 0 (water surface)
    const surfaceY = this.posToScreenY(0);
    // Clamp surface to visible area
    const surfaceOnScreen = Math.max(this.areaTop, Math.min(this.areaBottom, surfaceY));

    const now = Date.now() / 1000; // real time for background animation

    // ── Sky (above water) ──
    if (surfaceOnScreen > this.areaTop) {
      const sky = ctx.createLinearGradient(0, 0, 0, surfaceOnScreen);
      sky.addColorStop(0, '#87CEEB');
      sky.addColorStop(1, '#b0e0f0');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, surfaceOnScreen);

      // Clouds
      this._drawClouds(ctx, w, surfaceOnScreen, now);
    }

    // ── Water (below surface) ──
    if (surfaceOnScreen < h) {
      const water = ctx.createLinearGradient(0, surfaceOnScreen, 0, h);
      water.addColorStop(0, '#3fa8d4');
      water.addColorStop(0.3, '#2980b9');
      water.addColorStop(0.7, '#1a5276');
      water.addColorStop(1, '#0d2f4a');
      ctx.fillStyle = water;
      ctx.fillRect(0, surfaceOnScreen, w, h - surfaceOnScreen);

      // Background creatures (only in water region)
      this._drawBgCreatures(ctx, w, h, surfaceOnScreen, now);

      // Seaweed at the bottom
      this._drawSeaweed(ctx, w, h, now);
    }

    // ── Water surface (wavy line with foam) ──
    if (surfaceOnScreen > this.areaTop - 10 && surfaceOnScreen < this.areaBottom + 10) {
      this._drawWaterSurface(ctx, w, surfaceOnScreen, now);
    }

    // ── Dock/pier at the left edge ──
    if (surfaceOnScreen > this.areaTop && surfaceOnScreen < this.areaBottom) {
      this._drawDock(ctx, surfaceOnScreen);
    }

    // ── Distance markers on left side (always at integer positions) ──
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'right';
    const dMin = Math.ceil(posRange.min);
    const dMax = Math.floor(posRange.max);
    for (let d = dMin; d <= dMax; d++) {
      const y = this.posToScreenY(d);

      // Tick
      ctx.strokeStyle = '#ddd';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(this.labelWidth - 2, y);
      ctx.lineTo(this.labelWidth + 6, y);
      ctx.stroke();

      // Horizontal guide line (subtle)
      ctx.strokeStyle = d === 0 ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.1)';
      ctx.lineWidth = d === 0 ? 1.5 : 0.5;
      ctx.beginPath();
      ctx.moveTo(this.labelWidth + 6, y);
      ctx.lineTo(w - 10, y);
      ctx.stroke();

      // Label
      ctx.fillStyle = '#ddd';
      ctx.fillText(d + (this.sim.unitLabel || 'm'), this.labelWidth - 5, y + 3);
    }

    // ── Draw actors ──
    const actors = this.linkedActors;
    const n = actors.length;

    for (let i = 0; i < n; i++) {
      const actor = actors[i];
      const cx = this._columnCenterX(i, n);
      const pos = actor.getPositionAt(currentTime);
      const animalY = this.posToScreenY(pos);
      const underwater = pos < 0;
      const flying = pos > 0;

      // SeaWorld: always front-facing (vertical motion, not horizontal)
      // Use walkPhase for swim/bob animation but no left/right facing
      const vel = actor.getVelocityAt ? actor.getVelocityAt(currentTime) : 0;
      let motion = null;
      if (Math.abs(vel) > 0.1) {
        const walkPhase = (currentTime * 3) % 1;
        motion = { facing: 0, walkPhase };
      }

      // Scale animals similarly to ElevatorWorld
      const floorScale = Math.min((this.unitHeight - 4) / 40, 0.55);
      const charScale = n > 10 ? Math.max(0.2, floorScale * (10 / n)) : floorScale;

      drawAnimalCharacter(ctx, cx, animalY, actor.color, actor.name, charScale, motion, actor.animalType, underwater, flying);

      // ── Underwater bubbles (position-based particles) ──
      if (underwater) {
        this._spawnAndDrawBubbles(ctx, actor, cx, pos, currentTime, charScale);
      }
    }

    // ── Time badge ──
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(8, 8, 80, 24);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`t = ${currentTime.toFixed(1)}s`, 14, 24);
  }

  // ── Background drawing helpers ──────────────────────────

  _drawClouds(ctx, w, maxY, t) {
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    const clouds = [
      { x: 0.15, y: 0.2, w: 50, h: 18 },
      { x: 0.45, y: 0.12, w: 65, h: 22 },
      { x: 0.75, y: 0.25, w: 45, h: 16 },
      { x: 0.9, y: 0.15, w: 55, h: 20 },
    ];
    for (const c of clouds) {
      const cx = (c.x * w + t * 3) % (w + 80) - 40; // slow drift
      const cy = maxY * c.y;
      // Cloud as overlapping rounded rects
      const r = c.h / 2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, c.w / 2, c.h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx - c.w * 0.25, cy + 2, c.w * 0.3, c.h * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx + c.w * 0.25, cy + 1, c.w * 0.35, c.h * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  _drawWaterSurface(ctx, w, surfaceY, t) {
    // Wavy surface line
    ctx.strokeStyle = '#5bc0de';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let x = 0; x <= w; x += 4) {
      const waveY = surfaceY + Math.sin(x * 0.04 + t * 2) * 3 + Math.sin(x * 0.02 + t * 1.3) * 2;
      if (x === 0) ctx.moveTo(x, waveY);
      else ctx.lineTo(x, waveY);
    }
    ctx.stroke();

    // Foam / white highlights
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    for (let x = 10; x < w; x += 25 + (x * 7 % 15)) {
      const foamY = surfaceY + Math.sin(x * 0.05 + t * 2.5) * 2;
      ctx.beginPath();
      ctx.ellipse(x, foamY - 1, 6 + (x % 5), 2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  _drawDock(ctx, surfaceY) {
    const dockX = this.labelWidth + 2;
    const dockW = 28;
    const dockH = 6;
    const dockY = surfaceY - dockH;

    // Planks
    ctx.fillStyle = '#8B6914';
    ctx.fillRect(dockX, dockY, dockW, dockH);
    // Plank lines
    ctx.strokeStyle = '#6b4f10';
    ctx.lineWidth = 0.5;
    for (let px = dockX + 7; px < dockX + dockW; px += 7) {
      ctx.beginPath();
      ctx.moveTo(px, dockY);
      ctx.lineTo(px, dockY + dockH);
      ctx.stroke();
    }

    // Posts
    ctx.fillStyle = '#6b4f10';
    ctx.fillRect(dockX + 2, dockY + dockH, 3, 14);
    ctx.fillRect(dockX + dockW - 5, dockY + dockH, 3, 14);
  }

  _drawBgCreatures(ctx, w, h, surfaceY, t) {
    const waterH = h - surfaceY;
    if (waterH <= 0) return;

    for (const c of this._bgCreatures) {
      if (c.type === 'fish') {
        this._drawFish(ctx, c, w, surfaceY, waterH, t);
      } else if (c.type === 'seahorse') {
        this._drawSeahorse(ctx, c, w, surfaceY, waterH, t);
      } else if (c.type === 'bubble') {
        this._drawBubble(ctx, c, w, surfaceY, waterH, t);
      }
    }
  }

  _drawFish(ctx, fish, w, surfaceY, waterH, t) {
    // Fish swims horizontally in a sine wave
    const usableW = w - this.labelWidth - 40;
    const x = this.labelWidth + 20 + ((fish.baseX + fish.direction * t * fish.speed * 40) % usableW + usableW) % usableW;
    const baseScreenY = surfaceY + fish.baseY * waterH;
    const y = baseScreenY + Math.sin(t * fish.speed * 2 + fish.baseX) * fish.amplitude;
    const s = fish.size;
    const dir = fish.direction;

    // Body (oval)
    ctx.fillStyle = fish.color;
    ctx.beginPath();
    ctx.ellipse(x, y, s * 1.5, s, 0, 0, Math.PI * 2);
    ctx.fill();

    // Tail (triangle)
    ctx.beginPath();
    ctx.moveTo(x - dir * s * 1.5, y);
    ctx.lineTo(x - dir * s * 2.5, y - s * 0.8);
    ctx.lineTo(x - dir * s * 2.5, y + s * 0.8);
    ctx.closePath();
    ctx.fill();

    // Eye
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(x + dir * s * 0.6, y - s * 0.2, s * 0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(x + dir * s * 0.7, y - s * 0.2, s * 0.12, 0, Math.PI * 2);
    ctx.fill();
  }

  _drawSeahorse(ctx, sh, w, surfaceY, waterH, t) {
    const usableW = w - this.labelWidth - 40;
    const x = this.labelWidth + 20 + (sh.baseX % usableW);
    const baseScreenY = surfaceY + sh.baseY * waterH;
    const y = baseScreenY + Math.sin(t * sh.bobSpeed) * sh.bobAmount;
    const s = sh.size;

    ctx.fillStyle = sh.color;

    // Head (circle)
    ctx.beginPath();
    ctx.arc(x, y - s * 1.2, s * 0.5, 0, Math.PI * 2);
    ctx.fill();

    // Snout
    ctx.fillRect(x + s * 0.3, y - s * 1.3, s * 0.6, s * 0.2);

    // Body (curved shape approximated with ellipse)
    ctx.beginPath();
    ctx.ellipse(x, y, s * 0.4, s * 1.0, 0, 0, Math.PI * 2);
    ctx.fill();

    // Curled tail
    ctx.strokeStyle = sh.color;
    ctx.lineWidth = s * 0.25;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(x - s * 0.3, y + s * 1.2, s * 0.5, -Math.PI * 0.5, Math.PI * 0.8);
    ctx.stroke();
    ctx.lineCap = 'butt';

    // Eye
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(x + s * 0.15, y - s * 1.3, s * 0.12, 0, Math.PI * 2);
    ctx.fill();
  }

  _drawBubble(ctx, bub, w, surfaceY, waterH, t) {
    const usableW = w - this.labelWidth - 40;
    const x = this.labelWidth + 20 + (bub.baseX % usableW);
    // Rise from bottom, cycle back
    const cycle = bub.cycleDuration;
    const phase = ((t * bub.riseSpeed / waterH) % cycle) / cycle; // 0 to 1
    const y = surfaceY + waterH * (1 - phase);

    if (y < surfaceY || y > surfaceY + waterH) return;

    const wobble = Math.sin(t * 3 + bub.baseX) * 3;

    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 0.8;
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.beginPath();
    ctx.arc(x + wobble, y, bub.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Highlight
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath();
    ctx.arc(x + wobble - bub.size * 0.3, y - bub.size * 0.3, bub.size * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }

  _drawSeaweed(ctx, w, h, t) {
    const bottomY = h;
    const seaweedPositions = [0.12, 0.28, 0.45, 0.58, 0.72, 0.88];

    for (let i = 0; i < seaweedPositions.length; i++) {
      const x = this.labelWidth + (w - this.labelWidth - 20) * seaweedPositions[i];
      const height = 20 + (i % 3) * 12;
      const sway = Math.sin(t * 0.8 + i * 1.5) * 6;

      ctx.strokeStyle = i % 2 === 0 ? '#27ae60' : '#2ecc71';
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x, bottomY);
      // Wavy line upward with sway
      const cp1x = x + sway * 0.5;
      const cp1y = bottomY - height * 0.4;
      const cp2x = x + sway;
      const cp2y = bottomY - height * 0.7;
      const endX = x + sway * 0.8;
      const endY = bottomY - height;
      ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, endX, endY);
      ctx.stroke();

      // Second frond offset slightly
      ctx.strokeStyle = '#2ecc71';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + 3, bottomY);
      const s2 = Math.sin(t * 0.9 + i * 1.8) * 5;
      ctx.bezierCurveTo(
        x + 3 + s2 * 0.4, bottomY - height * 0.3,
        x + 3 + s2, bottomY - height * 0.6,
        x + 3 + s2 * 0.7, bottomY - height * 0.85
      );
      ctx.stroke();
      ctx.lineCap = 'butt';
    }
  }

  // ── Panning (drag to shift position 0 up/down) ────────

  _setupPanning() {
    const canvas = this.canvas;

    canvas.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || e.ctrlKey || e.shiftKey) return;
      this._panState = {
        startY: e.clientY,
        startMin: this.sim.posRange.min,
        startMax: this.sim.posRange.max,
      };
      canvas.style.cursor = 'grabbing';
      canvas.setPointerCapture(e.pointerId);
      e.preventDefault();
    });

    canvas.addEventListener('pointermove', (e) => {
      if (!this._panState) {
        canvas.style.cursor = 'grab';
        return;
      }
      const dy = e.clientY - this._panState.startY;
      const areaH = this.areaBottom - this.areaTop;
      const span = this._panState.startMax - this._panState.startMin;
      // Dragging down = shifting view down = increasing position values shown
      const dataDy = (dy / areaH) * span;

      this.sim.posRange.min = this._panState.startMin + dataDy;
      this.sim.posRange.max = this._panState.startMax + dataDy;
      this._resize(); // recalculates layout from updated posRange
      this.bus.emit('posrange:changed', { posRange: this.sim.posRange });
    });

    const endPan = () => {
      if (!this._panState) return;
      this._panState = null;
      canvas.style.cursor = 'grab';
    };
    canvas.addEventListener('pointerup', endPan);
    canvas.addEventListener('lostpointercapture', endPan);

    canvas.style.cursor = 'grab';
  }

  redraw() {
    this.drawFrame(this.sim.currentTime);
  }

  // ── Bubble particle system ──────────────────────────────
  // Bubbles exist in POSITION SPACE (simulation units), not screen space.
  // They rise at a fixed rate (units per second) independently of the animal.
  // If the animal zooms upward past its own bubbles, the bubbles stay put.

  /** Bubble rise speed in position-units per second of simulation time */
  static BUBBLE_RISE_SPEED = 0.8; // 0.8 ft/s — slow leisurely rise

  /**
   * Spawn a burst of bubbles every 2s while underwater, then draw all
   * live bubbles for this actor.
   */
  _spawnAndDrawBubbles(ctx, actor, columnX, actorPos, time, charScale) {
    const key = actor.id || actor.name;
    if (!this._bubbleParticles.has(key)) {
      this._bubbleParticles.set(key, { bubbles: [], lastBurstIndex: -1 });
    }
    const state = this._bubbleParticles.get(key);

    // If time went backwards (rewind), prune future bubbles
    state.bubbles = state.bubbles.filter(b => b.spawnTime <= time);
    if (time < (state.lastBurstIndex * 2)) {
      state.lastBurstIndex = Math.floor(time / 2) - 1;
    }

    // Spawn a burst every 2 simulation-seconds while underwater
    const burstIndex = Math.floor(time / 2);
    if (burstIndex > state.lastBurstIndex) {
      state.lastBurstIndex = burstIndex;
      const burstTime = burstIndex * 2;
      // Spawn 5 bubbles at the actor's CURRENT position with slight offsets
      const defs = [
        { dPos: 0.1, dxFrac: -0.12, delay: 0.0,  wobble: 0,   r: 8.0 },
        { dPos: 0.2, dxFrac: 0.15,  delay: 0.15, wobble: 1.5, r: 5.5 },
        { dPos: 0.05, dxFrac: -0.2,  delay: 0.25, wobble: 3.0, r: 9.0 },
        { dPos: 0.25, dxFrac: 0.08,  delay: 0.4,  wobble: 4.5, r: 6.5 },
        { dPos: 0.15, dxFrac: -0.05, delay: 0.6,  wobble: 2.0, r: 7.0 },
      ];
      for (const d of defs) {
        state.bubbles.push({
          spawnPos: actorPos + d.dPos, // position (sim units) where bubble was born
          spawnX: columnX + d.dxFrac * this.unitHeight, // screen X (column stays fixed)
          spawnTime: burstTime + d.delay,
          wobblePhase: d.wobble,
          baseRadius: d.r,
        });
      }
    }

    // Draw all live bubbles
    const riseSpeed = SeaWorld.BUBBLE_RISE_SPEED;
    const toRemove = [];

    for (let i = 0; i < state.bubbles.length; i++) {
      const b = state.bubbles[i];
      const age = time - b.spawnTime;
      if (age < 0) continue; // delayed, not emitted yet

      // Bubble's current position in simulation space — rises independently
      const bubblePos = b.spawnPos + age * riseSpeed;

      // Remove if it reached the surface (position >= 0)
      if (bubblePos >= 0) {
        toRemove.push(i);
        continue;
      }

      // Convert to screen coordinates
      const by = this.posToScreenY(bubblePos);
      const wobble = Math.sin(age * Math.PI * 3 + b.wobblePhase) * 4 * charScale;
      const bx = b.spawnX + wobble;

      // Grow slightly as they rise (pressure decreases)
      const radius = b.baseRadius * charScale * (1 + age * 0.12);

      ctx.fillStyle = 'rgba(200, 230, 255, 0.45)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(bx, by, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Glossy highlight
      if (radius > 2) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.beginPath();
        ctx.arc(bx - radius * 0.2, by - radius * 0.25, radius * 0.35, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Prune dead bubbles (reverse order so splice indices stay valid)
    for (let i = toRemove.length - 1; i >= 0; i--) {
      state.bubbles.splice(toRemove[i], 1);
    }
  }

  destroy() {
    if (this._resizeObserver) this._resizeObserver.disconnect();
  }
}
