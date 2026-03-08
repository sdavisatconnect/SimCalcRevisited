export class TimeController {
  constructor(simulation, bus) {
    this.sim = simulation;
    this.bus = bus;
    this._rafId = null;
    this._lastTimestamp = null;
  }

  start() {
    if (this._rafId) return;
    this.sim.isPlaying = true;

    // If at the end, restart from beginning
    if (this.sim.currentTime >= this.sim.timeRange.max) {
      this.sim.currentTime = 0;
    }

    this._lastTimestamp = null;
    this._rafId = requestAnimationFrame(this._tick.bind(this));
    this.bus.emit('playback:play');
  }

  stop() {
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
    this.sim.isPlaying = false;
    this._lastTimestamp = null;
    this.bus.emit('playback:pause');
  }

  reset() {
    this.stop();
    this.sim.reset();
    this.bus.emit('time:update', { currentTime: 0 });
    this.bus.emit('playback:reset');
  }

  toggle() {
    if (this.sim.isPlaying) {
      this.stop();
    } else {
      this.start();
    }
  }

  /** Scrub to a specific time (for click-on-graph seeking) */
  seekTo(t) {
    this.sim.currentTime = Math.max(this.sim.timeRange.min,
      Math.min(this.sim.timeRange.max, t));
    this.bus.emit('time:update', { currentTime: this.sim.currentTime });
  }

  /** Step forward by dt seconds (default 0.5) */
  stepForward(dt = 0.5) {
    if (this.sim.isPlaying) this.stop();
    const t = Math.min(this.sim.currentTime + dt, this.sim.timeRange.max);
    this.sim.currentTime = t;
    this.bus.emit('time:update', { currentTime: t });
    if (t >= this.sim.timeRange.max) {
      this.bus.emit('playback:ended');
    }
  }

  /** Step backward by dt seconds (default 0.5) */
  stepBackward(dt = 0.5) {
    if (this.sim.isPlaying) this.stop();
    const t = Math.max(this.sim.currentTime - dt, this.sim.timeRange.min);
    this.sim.currentTime = t;
    this.bus.emit('time:update', { currentTime: t });
  }

  _tick(timestamp) {
    if (!this.sim.isPlaying) return;

    if (this._lastTimestamp === null) {
      this._lastTimestamp = timestamp;
    }

    const deltaMs = timestamp - this._lastTimestamp;
    this._lastTimestamp = timestamp;

    // Convert to seconds, cap at 100ms to avoid jumps on tab-switch
    const deltaSec = Math.min(deltaMs / 1000, 0.1);

    const stillPlaying = this.sim.tick(deltaSec);
    this.bus.emit('time:update', { currentTime: this.sim.currentTime });

    if (stillPlaying) {
      this._rafId = requestAnimationFrame(this._tick.bind(this));
    } else {
      this._rafId = null;
      this.bus.emit('playback:ended');
    }
  }
}
