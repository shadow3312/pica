// @ts-check
/*
 * Extension settings: boolean switches, without DOM or chrome.* (the storage adapter is
 * injected). Exposed on globalThis.LinkedInSettings.
 *
 * - Default values below; get() is synchronous (reads the cache, default values until load()
 *   finishes): a feature can therefore query it on every event.
 * - Only user changes are stored, not default values: if a default changes in a future
 *   version, users who have never touched the setting will benefit from it.
 * - Any unexpected stored data (wrong type, unknown key) is ignored, never fatal.
 *
 * Known limitation: the read-modify-write cycle is serialized in the same context;
 * two contexts writing the same setting at the same time: the last one wins.
 */
/** @param {typeof globalThis} root */
(function (root) {
  'use strict';

  /** @type {Readonly<Record<LF.SettingName, boolean>>} */
  const DEFAULTS = Object.freeze({
    markdownTyping: true,   // **bold**, *italic*, `monospace`, ~~strikethrough~~ converted while typing
    typedVariables: true,   // {{date}} / {{name}} replaced while typing
    drafts: true,           // automatic drafts + "Drafts" badge
    templates: true,        // "Templates" badge
    airing: true,           // "Air" badge when the post is dense
    pasteCleanup: true,     // pasted text cleaned (spaces, bullets, hyphens, tracking links)
  });

  /** @type {LF.SettingName[]} */
  const NAMES = /** @type {LF.SettingName[]} */ (Object.keys(DEFAULTS));

  /**
   * Keeps only valid stored changes: known keys, boolean values.
   * @param {unknown} raw
   * @returns {Partial<Record<LF.SettingName, boolean>>}
   */
  function overridesOf(raw) {
    /** @type {Partial<Record<LF.SettingName, boolean>>} */
    const out = {};
    if (raw && typeof raw === 'object') {
      const source = /** @type {Record<string, unknown>} */ (raw);
      for (const name of NAMES) {
        if (typeof source[name] === 'boolean') out[name] = /** @type {boolean} */ (source[name]);
      }
    }
    return out;
  }

  /**
   * @param {LF.StorageAdapter} adapter
   * @param {{ key?: string }} [options]
   * @returns {LF.Settings}
   */
  function createSettings(adapter, options) {
    const key = (options && options.key) || 'settings';
    /** @type {Record<LF.SettingName, boolean>} */
    let cache = { ...DEFAULTS };
    /** @type {Set<(name: LF.SettingName, value: boolean) => void>} */
    const listeners = new Set();
    /** @type {Promise<unknown>} */
    let queue = Promise.resolve();

    /** @param {string} name */
    function assertKnown(name) {
      if (!NAMES.includes(/** @type {LF.SettingName} */ (name))) throw new Error('Unknown setting: ' + name);
    }

    /** Replaces the cache and notifies subscribers of settings whose value changed. */
    function commit(/** @type {Partial<Record<LF.SettingName, boolean>>} */ overrides) {
      const next = { ...DEFAULTS, ...overrides };
      const changed = NAMES.filter(n => next[n] !== cache[n]);
      cache = next;
      for (const name of changed) {
        for (const cb of [...listeners]) {
          try { cb(name, cache[name]); } catch (err) { console.error('[LinkedIn Formatter] error in a settings subscriber', err); }
        }
      }
    }

    /** @param {() => Promise<void>} task */
    function enqueue(task) {
      const run = queue.then(task);
      queue = run.catch(() => {});
      return run;
    }

    return {
      names: NAMES.slice(),
      load() { return enqueue(async () => commit(overridesOf(await adapter.get(key)))); },
      get(name) { assertKnown(name); return cache[name]; },
      all() { return { ...cache }; },
      set(name, value) {
        assertKnown(name);
        if (typeof value !== 'boolean') throw new Error('A setting must be a boolean: ' + name);
        return enqueue(async () => {
          const overrides = overridesOf(await adapter.get(key));
          overrides[name] = value;
          await adapter.set(key, overrides);
          commit(overrides);
        });
      },
      applyExternal(raw) { commit(overridesOf(raw)); },
      onChange(cb) { listeners.add(cb); return () => { listeners.delete(cb); }; },
    };
  }

  /** @type {LF.SettingsModule} */
  const api = { DEFAULTS, createSettings };
  root.LinkedInSettings = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
