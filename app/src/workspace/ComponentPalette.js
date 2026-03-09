import { FeedbackForm } from '../feedback/FeedbackForm.js';

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

    // Spacer to push buttons to the right
    const spacer = document.createElement('div');
    spacer.style.flex = '1';
    this.container.appendChild(spacer);

    // How To button
    const howToBtn = document.createElement('button');
    howToBtn.className = 'about-btn';
    howToBtn.textContent = 'How To';
    howToBtn.title = 'Quick-start guide';
    howToBtn.addEventListener('click', () => this._showHowToModal());
    this.container.appendChild(howToBtn);

    // About button
    const aboutBtn = document.createElement('button');
    aboutBtn.className = 'about-btn';
    aboutBtn.textContent = 'About';
    aboutBtn.title = 'About SimCalc Revisited';
    aboutBtn.addEventListener('click', () => this._showAboutModal());
    this.container.appendChild(aboutBtn);
  }

  _showHowToModal() {
    if (document.querySelector('.howto-overlay')) return;

    const overlay = document.createElement('div');
    overlay.className = 'howto-overlay';

    const card = document.createElement('div');
    card.className = 'howto-card';

    card.innerHTML = `
      <button class="about-close" title="Close">&times;</button>
      <h2 class="howto-title">How To Use SimCalc Revisited</h2>
      <div class="howto-body">

        <div class="howto-section">
          <h3>1. Choose a World</h3>
          <p>
            When you start, pick <strong>Horizontal World</strong> (characters walk along a track)
            or <strong>Vertical World</strong> (elevator moves up and down). This sets the motion
            context for your graphs.
          </p>
        </div>

        <div class="howto-section">
          <h3>2. Actors</h3>
          <p>
            <strong>Actors</strong> are the characters whose motion you define.
            The top bar shows your actors. Click <strong>+</strong> to add one (up to 4).
            Click an actor chip to rename it or change its color. Each actor gets its own
            set of motion functions.
          </p>
        </div>

        <div class="howto-section">
          <h3>3. Panels &amp; Graphs</h3>
          <p>
            The right sidebar has <strong>Components</strong> &mdash; drag or click them to add
            panels to the workspace:
          </p>
          <ul>
            <li><strong>World</strong> &mdash; animated view of characters moving</li>
            <li><strong>Position (P/T)</strong> &mdash; position vs. time graph</li>
            <li><strong>Velocity (V/T)</strong> &mdash; velocity vs. time graph</li>
            <li><strong>Accel (A/T)</strong> &mdash; acceleration vs. time graph</li>
          </ul>
          <p>
            Use the <strong>dropdown</strong> in each panel&rsquo;s title bar to choose which
            actor(s) it displays. Panels can be <strong>dragged</strong> by their title bar
            and <strong>resized</strong> from the bottom-right corner.
          </p>
        </div>

        <div class="howto-section">
          <h3>4. Editing Motion</h3>
          <p>
            Use the <strong>Edit Tools</strong> in the right sidebar:
          </p>
          <ul>
            <li><strong>Select &amp; Drag</strong> &mdash; drag points on position graphs or
                bars on velocity graphs to change values</li>
            <li><strong>Eraser</strong> &mdash; click a point or segment to remove it</li>
          </ul>
          <p>
            Under <strong>Drag to Graph</strong>, drag tools onto the matching graph to add elements:
          </p>
          <ul>
            <li><strong>P &bull;</strong> &mdash; add a control point to a position graph</li>
            <li><strong>V &lt;&gt;</strong> &mdash; add a constant velocity segment</li>
            <li><strong>V /</strong> and <strong>V \\</strong> &mdash; add ramp-up (accelerate) or ramp-down (decelerate) segments</li>
          </ul>
        </div>

        <div class="howto-section">
          <h3>5. Playback</h3>
          <p>
            The bottom bar has playback controls. Press <strong>Play</strong> to animate,
            <strong>Step</strong> to advance frame-by-frame, and <strong>Reset</strong> to
            return to time 0. Use the <strong>Speed</strong> slider to go faster or slower.
          </p>
        </div>

        <div class="howto-section">
          <h3>6. Save &amp; Load</h3>
          <p>
            The icons at the bottom right let you:
          </p>
          <ul>
            <li><strong>\u{1F4C4} New</strong> &mdash; start over with a fresh workspace</li>
            <li><strong>\u{1F4BE} Save</strong> &mdash; save your current work as a JSON template file</li>
            <li><strong>\u{1F4C2} Load</strong> &mdash; load a previously saved template</li>
          </ul>
        </div>

        <div class="howto-section">
          <h3>7. Importing Motion Data</h3>
          <p>
            You can import real-world motion data from a <strong>Vernier GoDirect Motion
            Detector</strong> (or any CSV file with time and position columns).
          </p>
          <p><strong>Collecting data for SimCalc import:</strong></p>
          <ul>
            <li>Use <strong>Vernier Graphical Analysis</strong> to collect position data</li>
            <li>Recommended: <strong>20 samples/second</strong> for <strong>5&ndash;15 seconds</strong></li>
            <li>Keep the motion detector <strong>0.25&ndash;3.5m</strong> from the moving object</li>
            <li>Export as CSV from Graphical Analysis (File &gt; Export &gt; CSV)</li>
          </ul>
          <p><strong>To import:</strong></p>
          <ul>
            <li>Set up your world and actors first</li>
            <li>Click <strong>Import CSV</strong> in the Components sidebar</li>
            <li>Choose which actor receives the data</li>
            <li>Select your CSV file and click <strong>Import Data</strong></li>
          </ul>
          <p>
            The time range and graph axes will adjust automatically to fit the imported data.
            The position graph will show the real-world data, and velocity/acceleration will
            be derived automatically.
          </p>
        </div>

      </div>
    `;

    overlay.appendChild(card);

    // Append feedback form to the howto body
    const howtoBody = card.querySelector('.howto-body');
    new FeedbackForm(howtoBody);

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
