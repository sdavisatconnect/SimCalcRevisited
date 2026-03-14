/**
 * How To and About modals for the elementary edition.
 * Provides K-5-friendly instructions and reuses the standard About content.
 * Uses about-overlay/about-card CSS classes (already styled in style.css)
 * with elementary-edition overrides in elementary-style.css.
 */
export class ElementaryHowTo {
  constructor(bus) {
    this.bus = bus;
    bus.on('howto:show', () => this._showHowTo());
    bus.on('about:show', () => this._showAbout());
  }

  _showHowTo() {
    if (document.querySelector('.about-overlay')) return;

    const overlay = document.createElement('div');
    overlay.className = 'about-overlay';

    const card = document.createElement('div');
    card.className = 'about-card';

    card.innerHTML = `
      <button class="about-close" title="Close">&times;</button>
      <h2 class="about-title">How To Play</h2>
      <div class="about-body">

        <div class="howto-step">
          <h3>📚 What is Velocity?</h3>
          <p>
            <strong>Velocity</strong> means how fast something is going
            and which direction! Positive velocity = forward.
            Negative velocity = backward. You can click 🔊 in the
            sidebar to hear the word!
          </p>
        </div>

        <div class="howto-step">
          <h3>🌍 1. Pick Your World</h3>
          <p>
            Choose <strong>Frolic World</strong> to run through fields, or
            <strong>Sea World</strong> to swim up and dive deep!
          </p>
        </div>

        <div class="howto-step">
          <h3>🐾 2. Pick Your Animal</h3>
          <p>
            Choose your favorite baby animal and pick a color.
            Your animal will move based on the blocks you place!
          </p>
        </div>

        <div class="howto-step">
          <h3>🧱 3. Drag Blocks</h3>
          <p>
            Drag the <strong>block tool</strong> from the sidebar onto
            the <strong>Speed graph</strong>. Blocks stack up from zero
            &mdash; the higher you stack, the faster your animal goes!
          </p>
        </div>

        <div class="howto-step">
          <h3>⬇️ 4. Go Backward!</h3>
          <p>
            Drop blocks <strong>below the line</strong> to make your
            animal go backward (or dive underwater in Sea World!).
          </p>
        </div>

        <div class="howto-step">
          <h3>▶️ 5. Press Play</h3>
          <p>
            Hit the <strong>Play</strong> button at the bottom to watch
            your animal move. Use <strong>Reset</strong> to start over,
            or <strong>Step</strong> to go one moment at a time.
          </p>
        </div>

        <div class="howto-step">
          <h3>🧹 6. Fix Mistakes</h3>
          <p>
            Click on a block to remove it. Use the <strong>Eraser</strong>
            tool to remove blocks, or <strong>Clear All</strong> to
            start fresh.
          </p>
        </div>

      </div>
    `;

    overlay.appendChild(card);
    this._attachClose(overlay, card);
    document.body.appendChild(overlay);
  }

  _showAbout() {
    if (document.querySelector('.about-overlay')) return;

    const overlay = document.createElement('div');
    overlay.className = 'about-overlay';

    const card = document.createElement('div');
    card.className = 'about-card';

    card.innerHTML = `
      <button class="about-close" title="Close">&times;</button>
      <h2 class="about-title">SimCalc Animal World</h2>
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
            <strong>SimCalc Animal World</strong> is the elementary
            edition, designed for K-5 students exploring speed,
            distance, and direction with baby animal characters
            and unifix-cube blocks.
          </p>
        </div>
        <div class="about-credit">
          <img src="assets/davis.jpg" alt="Sarah M. Davis" class="about-credit-photo" onerror="this.style.display='none'"/>
          <p class="about-credit-text">
            This website has been created by <strong>Sarah M. Davis</strong>
            who wishes she had been able to learn from him longer.
          </p>
        </div>
        <p class="about-disclaimer"><em>SimCalc Revisited is an independent project and is not affiliated with or endorsed by the University of Massachusetts Dartmouth.</em></p>
      </div>
    `;

    overlay.appendChild(card);
    this._attachClose(overlay, card);
    document.body.appendChild(overlay);
  }

  _attachClose(overlay, card) {
    const closeBtn = card.querySelector('.about-close');
    const close = () => {
      overlay.classList.add('dismissing');
      overlay.addEventListener('animationend', () => overlay.remove());
    };
    closeBtn.addEventListener('click', close);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });
  }
}
