export class Simulation {
  constructor() {
    this.actors = [];
    this.timeRange = { min: 0, max: 10 };
    this.posRange = { min: -2, max: 20 };
    this.velRange = { min: -10, max: 10 };
    this.accelRange = { min: -10, max: 10 };
    this.worldType = null; // 'horizontal' or 'vertical' — set by WorldSelector
    this.currentTime = 0;
    this.isPlaying = false;
    this.playbackSpeed = 1.0;
  }

  addActor(actor) {
    this.actors.push(actor);
  }

  removeActor(id) {
    this.actors = this.actors.filter(a => a.id !== id);
  }

  getActor(id) {
    return this.actors.find(a => a.id === id);
  }

  tick(deltaTime) {
    this.currentTime += deltaTime * this.playbackSpeed;
    if (this.currentTime >= this.timeRange.max) {
      this.currentTime = this.timeRange.max;
      this.isPlaying = false;
      return false; // reached end
    }
    return true; // still playing
  }

  reset() {
    this.currentTime = 0;
    this.isPlaying = false;
  }
}
