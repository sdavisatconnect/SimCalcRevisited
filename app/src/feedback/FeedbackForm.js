/**
 * Feedback form component for bug reports, feature requests, and general feedback.
 * Submits to Firebase Realtime Database via REST API.
 */

const FIREBASE_URL = 'https://simcalcrevisited-default-rtdb.firebaseio.com';

export class FeedbackForm {
  /**
   * @param {HTMLElement} container - element to append the form into
   * @param {object} [options]
   * @param {Function} [options.getWorldSave] - returns current workspace JSON for attachment
   */
  constructor(container, options = {}) {
    this.container = container;
    this.getWorldSave = options.getWorldSave || null;
    this.screenshotData = null;
    this.worldSaveData = null;
    this._build();
  }

  _build() {
    const section = document.createElement('div');
    section.className = 'feedback-section';

    section.innerHTML = `
      <div class="feedback-divider"></div>
      <h3 class="feedback-heading">Send Feedback</h3>
      <form class="feedback-form" novalidate>
        <div class="feedback-field">
          <label class="feedback-label">Name <span class="feedback-req">*</span></label>
          <input type="text" class="feedback-input" name="name" required autocomplete="name" />
        </div>
        <div class="feedback-field">
          <label class="feedback-label">Email <span class="feedback-req">*</span></label>
          <input type="email" class="feedback-input" name="email" required autocomplete="email" />
        </div>
        <div class="feedback-field">
          <label class="feedback-label">Category</label>
          <select class="feedback-select" name="category">
            <option value="bug">Bug Report</option>
            <option value="feature">Feature Request</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div class="feedback-field">
          <label class="feedback-label">Message <span class="feedback-req">*</span></label>
          <textarea class="feedback-textarea" name="message" rows="4" required placeholder="Describe the issue or suggestion..."></textarea>
        </div>
        <div class="feedback-attachments">
          <label class="feedback-label">Attachments (optional)</label>
          <div class="feedback-attach-row">
            <button type="button" class="feedback-attach-btn feedback-screenshot-btn" title="Attach a screenshot image">Add Screenshot</button>
            <button type="button" class="feedback-attach-btn feedback-world-btn" title="Attach current saved world">Attach Saved World</button>
          </div>
          <div class="feedback-attach-status"></div>
          <input type="file" class="feedback-file-input" accept="image/png,image/jpeg,image/gif,image/webp" style="display:none" />
          <input type="file" class="feedback-world-input" accept=".json,application/json" style="display:none" />
        </div>
        <div class="feedback-error" style="display:none"></div>
        <div class="feedback-success" style="display:none"></div>
        <button type="submit" class="feedback-submit-btn">Submit Feedback</button>
      </form>
    `;

    this.container.appendChild(section);

    this.form = section.querySelector('.feedback-form');
    this.errorEl = section.querySelector('.feedback-error');
    this.successEl = section.querySelector('.feedback-success');
    this.statusEl = section.querySelector('.feedback-attach-status');
    this.fileInput = section.querySelector('.feedback-file-input');
    this.worldInput = section.querySelector('.feedback-world-input');

    // Screenshot button — opens image file picker
    section.querySelector('.feedback-screenshot-btn').addEventListener('click', () => {
      this.fileInput.click();
    });

    this.fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > 2 * 1024 * 1024) {
        this._showError('Screenshot must be under 2 MB.');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        this.screenshotData = reader.result;
        this._updateAttachStatus();
      };
      reader.readAsDataURL(file);
    });

    // World save button — uses callback if available, else opens .json file picker
    section.querySelector('.feedback-world-btn').addEventListener('click', () => {
      if (this.getWorldSave) {
        try {
          this.worldSaveData = this.getWorldSave();
          this._updateAttachStatus();
        } catch (err) {
          this.worldInput.click();
        }
      } else {
        this.worldInput.click();
      }
    });

    this.worldInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          this.worldSaveData = JSON.parse(reader.result);
          this._updateAttachStatus();
        } catch (err) {
          this._showError('Invalid world save file.');
        }
      };
      reader.readAsText(file);
    });

    // Submit
    this.form.addEventListener('submit', (e) => {
      e.preventDefault();
      this._submit();
    });
  }

  _updateAttachStatus() {
    const parts = [];
    if (this.screenshotData) parts.push('Screenshot attached');
    if (this.worldSaveData) parts.push('World save attached');
    this.statusEl.textContent = parts.length ? parts.join(' | ') : '';
  }

  _showError(msg) {
    this.errorEl.textContent = msg;
    this.errorEl.style.display = 'block';
    this.successEl.style.display = 'none';
  }

  _showSuccess(msg) {
    this.successEl.textContent = msg;
    this.successEl.style.display = 'block';
    this.errorEl.style.display = 'none';
  }

  _hideMessages() {
    this.errorEl.style.display = 'none';
    this.successEl.style.display = 'none';
  }

  async _submit() {
    this._hideMessages();

    const name = this.form.name.value.trim();
    const email = this.form.email.value.trim();
    const category = this.form.category.value;
    const message = this.form.message.value.trim();

    if (!name || !email || !message) {
      this._showError('Please fill in all required fields.');
      return;
    }

    // Basic email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      this._showError('Please enter a valid email address.');
      return;
    }

    const submitBtn = this.form.querySelector('.feedback-submit-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting...';

    const payload = {
      name,
      email,
      category,
      message,
      screenshot: this.screenshotData || null,
      worldSave: this.worldSaveData || null,
      browser: navigator.userAgent,
      timestamp: Date.now(),
      status: 'new',
      adminNotes: '',
    };

    try {
      const res = await fetch(`${FIREBASE_URL}/feedback.json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(`Firebase error: ${res.status}`);
      }

      this._showSuccess('Thank you! Your feedback has been submitted.');
      this.form.reset();
      this.screenshotData = null;
      this.worldSaveData = null;
      this._updateAttachStatus();
    } catch (err) {
      this._showError('Failed to submit feedback. Please try again.');
      console.error('Feedback submit error:', err);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit Feedback';
    }
  }
}
