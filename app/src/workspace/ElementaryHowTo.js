/**
 * How To and About modals for the elementary edition.
 * Provides K-5-friendly instructions and reuses the standard About content.
 * Uses about-overlay/about-card CSS classes (already styled in style.css)
 * with elementary-edition overrides in elementary-style.css.
 */
import { t } from '../i18n/strings.js';

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
      <h2 class="about-title">${t('howToTitle')}</h2>
      <div class="about-body">

        <div class="howto-step">
          <h3>${t('howToVelocityTitle')}</h3>
          <p>${t('howToVelocityBody')}</p>
        </div>

        <div class="howto-step">
          <h3>${t('howToWorldTitle')}</h3>
          <p>${t('howToWorldBody')}</p>
        </div>

        <div class="howto-step">
          <h3>${t('howToAnimalTitle')}</h3>
          <p>${t('howToAnimalBody')}</p>
        </div>

        <div class="howto-step">
          <h3>${t('howToBlocksTitle')}</h3>
          <p>${t('howToBlocksBody')}</p>
        </div>

        <div class="howto-step">
          <h3>${t('howToBackwardTitle')}</h3>
          <p>${t('howToBackwardBody')}</p>
        </div>

        <div class="howto-step">
          <h3>${t('howToPlayTitle')}</h3>
          <p>${t('howToPlayBody')}</p>
        </div>

        <div class="howto-step">
          <h3>${t('howToFixTitle')}</h3>
          <p>${t('howToFixBody')}</p>
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
      <h2 class="about-title">${t('aboutTitle')}</h2>
      <div class="about-body">
        <div class="about-photo-section">
          <img src="assets/jim-kaput.jpg" alt="Jim Kaput" class="about-photo" onerror="this.style.display='none'"/>
          <div class="about-photo-caption">James J. Kaput (1942 &ndash; 2005)</div>
        </div>
        <div class="about-text">
          <p>${t('aboutKaput')}</p>
          <p>${t('aboutHistory')}</p>
          <p>${t('aboutLegacy')}</p>
          <p>${t('aboutElementary')}</p>
        </div>
        <div class="about-credit">
          <img src="assets/davis.jpg" alt="Sarah M. Davis" class="about-credit-photo" onerror="this.style.display='none'"/>
          <p class="about-credit-text">${t('aboutCredit')}</p>
        </div>
        <p class="about-disclaimer"><em>${t('aboutDisclaimer')}</em></p>
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
