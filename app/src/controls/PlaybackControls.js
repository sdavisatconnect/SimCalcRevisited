export class PlaybackControls {
  constructor(container, simulation, timeController, bus) {
    this.sim = simulation;
    this.tc = timeController;
    this.bus = bus;

    this.btnPlay = container.querySelector('#btn-play');
    this.btnReset = container.querySelector('#btn-reset');
    this.btnStepBack = container.querySelector('#btn-step-back');
    this.btnStepFwd = container.querySelector('#btn-step-fwd');
    this.timeValue = container.querySelector('#time-value');

    this.btnPlay.addEventListener('click', () => this.tc.toggle());
    this.btnReset.addEventListener('click', () => this.tc.reset());
    this.btnStepBack.addEventListener('click', () => this.tc.stepBackward());
    this.btnStepFwd.addEventListener('click', () => this.tc.stepForward());

    // Update button icon based on play state
    bus.on('playback:play', () => {
      this.btnPlay.textContent = '\u23F8'; // pause icon
    });
    bus.on('playback:pause', () => {
      this.btnPlay.textContent = '\u25B6'; // play icon
    });
    bus.on('playback:ended', () => {
      this.btnPlay.textContent = '\u25B6';
    });
    bus.on('playback:reset', () => {
      this.btnPlay.textContent = '\u25B6';
    });

    // Update time display
    bus.on('time:update', ({ currentTime }) => {
      this.timeValue.textContent = currentTime.toFixed(1);
    });
  }
}
