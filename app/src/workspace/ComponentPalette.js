/**
 * Actor palette bar (top of screen). Component creation buttons have moved to the right sidebar.
 * This now only contains the actor palette area and the About button (far right).
 */
export class ComponentPalette {
  constructor(containerEl, bus) {
    this.container = containerEl;
    this.bus = bus;

    // Actor palette container (filled by ActorPalette)
    this.actorContainer = document.createElement('div');
    this.actorContainer.className = 'actor-palette';
    this.container.appendChild(this.actorContainer);

    // Spacer to push About button to the right
    const spacer = document.createElement('div');
    spacer.style.flex = '1';
    this.container.appendChild(spacer);

    // About button
    const aboutBtn = document.createElement('button');
    aboutBtn.className = 'about-btn';
    aboutBtn.textContent = 'About';
    aboutBtn.title = 'About SimCalc Revisited';
    aboutBtn.addEventListener('click', () => this._showAboutModal());
    this.container.appendChild(aboutBtn);
  }

  _showAboutModal() {
    // Don't open multiple
    if (document.querySelector('.about-overlay')) return;

    const overlay = document.createElement('div');
    overlay.className = 'about-overlay';

    const card = document.createElement('div');
    card.className = 'about-card';

    card.innerHTML = `
      <button class="about-close" title="Close">&times;</button>
      <h2 class="about-title">SimCalc Revisited</h2>
      <div class="about-body">
        <div class="about-photo-section">
          <img src="assets/jim-kaput.jpg" alt="Jim Kaput" class="about-photo" onerror="this.style.display='none'"/>
          <div class="about-photo-caption">James J. Kaput (1942 &ndash; 2005)</div>
        </div>
        <div class="about-text">
          <p>
            <strong>SimCalc MathWorlds</strong> was created by
            <strong>James J. Kaput</strong>, a mathematics education
            professor at the University of Massachusetts Dartmouth.
            Beginning in the late 1980s, Jim envisioned
            <em>"democratizing access to the mathematics of change"</em>
            &mdash; making calculus concepts like rate, accumulation,
            and the relationship between position, velocity, and
            acceleration accessible to all students, not just those
            in advanced courses.
          </p>
          <p>
            SimCalc linked animated worlds to editable graphs,
            letting students build intuition by dragging velocity
            segments and watching characters move. Across
            large-scale studies in Texas, SimCalc demonstrated
            significant gains in student learning of advanced
            mathematical concepts.
          </p>
          <p>
            Jim passed away in 2005, but his vision lives on through
            the <strong>Kaput Center for Research and Innovation in
            STEM Education</strong> at UMass Dartmouth and in the
            continuing influence of his ideas.
          </p>
          <p>
            <strong>SimCalc Revisited</strong> is a modern web
            reimplementation, built to keep Jim's vision alive and
            accessible in today's browsers &mdash; no downloads or
            installs required.
          </p>
        </div>
        <div class="about-credit">
          <img src="assets/davis.jpg" alt="Sarah M. Davis" class="about-credit-photo" onerror="this.style.display='none'"/>
          <p class="about-credit-text">
            This website has been created by <strong>Sarah M. Davis</strong>
            who wishes she had been able to learn from him longer.
          </p>
        </div>
      </div>
    `;

    overlay.appendChild(card);

    // Close handlers
    const closeBtn = card.querySelector('.about-close');
    const close = () => {
      overlay.classList.add('dismissing');
      overlay.addEventListener('animationend', () => overlay.remove());
    };
    closeBtn.addEventListener('click', close);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });

    document.body.appendChild(overlay);
  }
}
