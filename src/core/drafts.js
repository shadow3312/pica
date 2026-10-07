// @ts-check
/*
 * Local drafts: storage logic without DOM or chrome.* (the adapter is injected).
 * Also reused for templates (different `key`, `name` field via `extra`).
 * A draft is { id, text, updatedAt }. The same id is updated in place (typing does
 * not create an entry per keystroke); older entries are removed beyond `max`.
 * Exposed on globalThis.LinkedInDrafts.
 *
 */
/** @param {typeof globalThis} root */
(function (root) {
  'use strict';

  /**
   * adapter = { get(key) -> Promise<any>, set(key, value) -> Promise }
   * options = { key, max, now }
   * @param {LF.StorageAdapter} adapter
   * @param {{ key?: string, max?: number, now?: () => number }} [options]
   * @returns {LF.DraftStore}
   */
  function createStore(adapter, options) {
    const opts = Object.assign({ key: 'drafts', max: 20, now: Date.now }, options);
    /** @type {Promise<unknown>} */
    let queue = Promise.resolve();

    /** @returns {Promise<LF.Draft[]>} */
    async function read() {
      const value = await adapter.get(opts.key);
      return Array.isArray(value) ? value : [];
    }

    // All operations pass through the queue : two simultaneous save() calls are queued.
    /**
     * @template T
     * @param {() => Promise<T>} task
     * @returns {Promise<T>}
     */
    function enqueue(task) {
      const run = queue.then(task);
      queue = run.catch(() => {});
      return run;
    }

    /** @returns {Promise<LF.Draft[]>} */
    function list() {
      return enqueue(async () => (await read()).sort((a, b) => b.updatedAt - a.updatedAt));
    }

    // `extra` : additional fields are kept as-is (ex. { name } for a template).
    /**
     * @param {string} id
     * @param {string} text
     * @param {{ name?: string }} [extra]
     * @returns {Promise<void>}
     */
    function save(id, text, extra) {
      return enqueue(async () => {
        let drafts = (await read()).filter(d => d.id !== id);
        if (text.trim()) drafts.push(Object.assign({}, extra, { id, text, updatedAt: opts.now() }));
        drafts.sort((a, b) => b.updatedAt - a.updatedAt);
        drafts = drafts.slice(0, opts.max);
        await adapter.set(opts.key, drafts);
      });
    }

    /**
     * @param {string} id
     * @returns {Promise<void>}
     */
    function remove(id) {
      return enqueue(async () => {
        const drafts = (await read()).filter(d => d.id !== id);
        await adapter.set(opts.key, drafts);
      });
    }

    return { list, save, remove };
  }

  /** @type {LF.Drafts} */
  const api = { createStore };
  root.LinkedInDrafts = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
