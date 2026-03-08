/**
 * Thin REST API wrapper for Firebase Realtime Database.
 * All communication via standard fetch() — no SDK, no WebSocket connections.
 */
export class FirebaseClient {
  constructor(databaseURL) {
    // Ensure no trailing slash
    this.baseURL = databaseURL.replace(/\/+$/, '');
  }

  /**
   * GET data at a path.
   * @param {string} path - e.g. 'rooms/1234/challenge'
   * @param {object} [params] - optional query params (e.g. { shallow: true })
   * @returns {Promise<any>} parsed JSON response
   */
  async get(path, params = {}) {
    const url = this._buildURL(path, params);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Firebase GET ${path} failed: ${res.status}`);
    return res.json();
  }

  /**
   * PUT data at a path (overwrites).
   * @param {string} path
   * @param {any} data
   * @returns {Promise<any>}
   */
  async put(path, data) {
    const url = this._buildURL(path);
    const res = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`Firebase PUT ${path} failed: ${res.status}`);
    return res.json();
  }

  /**
   * POST data (Firebase generates a unique key).
   * @param {string} path
   * @param {any} data
   * @returns {Promise<{ name: string }>} the generated key
   */
  async post(path, data) {
    const url = this._buildURL(path);
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`Firebase POST ${path} failed: ${res.status}`);
    return res.json();
  }

  /**
   * PATCH data at a path (merges).
   * @param {string} path
   * @param {any} data
   * @returns {Promise<any>}
   */
  async patch(path, data) {
    const url = this._buildURL(path);
    const res = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`Firebase PATCH ${path} failed: ${res.status}`);
    return res.json();
  }

  /**
   * DELETE data at a path.
   * @param {string} path
   * @returns {Promise<void>}
   */
  async delete(path) {
    const url = this._buildURL(path);
    const res = await fetch(url, { method: 'DELETE' });
    if (!res.ok) throw new Error(`Firebase DELETE ${path} failed: ${res.status}`);
  }

  _buildURL(path, params = {}) {
    let url = `${this.baseURL}/${path}.json`;
    const entries = Object.entries(params);
    if (entries.length > 0) {
      const qs = entries.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
      url += `?${qs}`;
    }
    return url;
  }
}
