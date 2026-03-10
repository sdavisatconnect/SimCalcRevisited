/**
 * Compact persistent banner shown at the top of the workspace during results mode.
 * Keeps the room code visible so late-arriving students can still join.
 *
 * Layout:  Room 1 2 3 4  |  12 submissions  |  [Copy Link]  |  [Collect Again]  |  [Close Room]
 */
export class RoomCodeBar {
  /**
   * @param {HTMLElement} parentEl - element to prepend the bar into (workspace container)
   * @param {string} roomCode
   * @param {object} callbacks
   * @param {function} callbacks.onCollectAgain - re-fetch and refresh results
   * @param {function} callbacks.onCloseRoom - close the room in Firebase
   */
  constructor(parentEl, roomCode, { onCollectAgain, onCloseRoom }) {
    this.parentEl = parentEl;
    this.roomCode = roomCode;
    this.onCollectAgain = onCollectAgain;
    this.onCloseRoom = onCloseRoom;
    this.el = null;
    this._countEl = null;
    this._pollTimer = null;
    this._closed = false;

    this._build();
  }

  _build() {
    this.el = document.createElement('div');
    this.el.className = 'roomcode-bar';

    // Room code display
    const codeSection = document.createElement('div');
    codeSection.className = 'roomcode-bar-code';
    codeSection.innerHTML = '<span class="roomcode-bar-label">Room</span> ' +
      this.roomCode.split('').map(d => `<span class="roomcode-bar-digit">${d}</span>`).join(' ');
    this.el.appendChild(codeSection);

    // Separator
    this.el.appendChild(this._sep());

    // Submission count
    this._countEl = document.createElement('div');
    this._countEl.className = 'roomcode-bar-count';
    this._countEl.textContent = '...';
    this.el.appendChild(this._countEl);

    // Separator
    this.el.appendChild(this._sep());

    // Copy Link button
    const copyBtn = document.createElement('button');
    copyBtn.className = 'roomcode-bar-btn roomcode-copy-btn';
    copyBtn.textContent = 'Copy Link';
    copyBtn.addEventListener('click', () => this._copyLink(copyBtn));
    this.el.appendChild(copyBtn);

    // Separator
    this.el.appendChild(this._sep());

    // Collect Again button
    const collectBtn = document.createElement('button');
    collectBtn.className = 'roomcode-bar-btn';
    collectBtn.textContent = 'Collect Again';
    collectBtn.addEventListener('click', async () => {
      collectBtn.disabled = true;
      collectBtn.textContent = 'Collecting...';
      try {
        await this.onCollectAgain();
      } catch (e) {
        console.error('Collect again failed:', e);
      }
      collectBtn.disabled = false;
      collectBtn.textContent = 'Collect Again';
    });
    this.el.appendChild(collectBtn);

    // Separator
    this.el.appendChild(this._sep());

    // Close Room button
    const closeBtn = document.createElement('button');
    closeBtn.className = 'roomcode-bar-btn roomcode-bar-btn-close';
    closeBtn.textContent = 'Close Room';
    closeBtn.addEventListener('click', async () => {
      if (this._closed) return;
      closeBtn.disabled = true;
      closeBtn.textContent = 'Closing...';
      try {
        await this.onCloseRoom();
        this._closed = true;
        closeBtn.textContent = 'Closed';
        this.el.classList.add('roomcode-bar-closed');
      } catch (e) {
        console.error('Close room failed:', e);
        closeBtn.disabled = false;
        closeBtn.textContent = 'Close Room';
      }
    });
    this.el.appendChild(closeBtn);

    // Insert at top of parent
    this.parentEl.prepend(this.el);
  }

  _sep() {
    const sep = document.createElement('span');
    sep.className = 'roomcode-bar-sep';
    sep.textContent = '|';
    return sep;
  }

  _copyLink(btn) {
    const url = `${window.location.origin}${window.location.pathname}?join=${this.roomCode}`;
    navigator.clipboard.writeText(url).then(() => {
      const orig = btn.textContent;
      btn.textContent = 'Copied!';
      setTimeout(() => { btn.textContent = orig; }, 1500);
    }).catch(() => {
      // Fallback: prompt
      prompt('Share this link:', url);
    });
  }

  /**
   * Update the displayed submission count.
   * @param {number} count
   */
  updateCount(count) {
    if (this._countEl) {
      this._countEl.textContent = `${count} submission${count !== 1 ? 's' : ''}`;
    }
  }

  /**
   * Start polling for submission count.
   * @param {function(): Promise<number>} fetchCount - async function returning count
   * @param {number} [intervalMs=15000]
   */
  startPolling(fetchCount, intervalMs = 15000) {
    this.stopPolling();
    // Fetch immediately
    fetchCount().then(count => this.updateCount(count)).catch(() => {});
    this._pollTimer = setInterval(async () => {
      try {
        const count = await fetchCount();
        this.updateCount(count);
      } catch (e) {
        console.warn('RoomCodeBar poll error:', e);
      }
    }, intervalMs);
  }

  /**
   * Stop polling.
   */
  stopPolling() {
    if (this._pollTimer) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
    }
  }

  /**
   * Remove the bar from the DOM and clean up.
   */
  remove() {
    this.stopPolling();
    if (this.el && this.el.parentNode) {
      this.el.remove();
    }
    this.el = null;
  }
}
