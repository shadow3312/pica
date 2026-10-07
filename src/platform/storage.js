// @ts-check
/*
 * Extension storage in a single instance: the chrome.storage.local adapter and settings, synchronized live between tabs, frames, and the
 * popup. Exposed on globalThis.LinkedInStorage. Loaded in LinkedIn pages (content scripts) as well as
 * in the popup: it does not touch the DOM.
 *
 * Nothing leaves the browser: chrome.storage.local is not synchronized with an account.
 */
/** @param {typeof globalThis} root */
(function (root) {
  'use strict';
  const S = root.LinkedInSettings;

  const area = typeof chrome !== 'undefined' && chrome && chrome.storage && chrome.storage.local
    ? chrome.storage.local : null;

  /** @type {LF.StorageAdapter | null} */
  const adapter = area && {
    get: key => area.get(key).then(o => o[key]),
    set: (key, value) => area.set({ [key]: value }),
  };

  // After an extension reload, the old script loses access to chrome.storage
  // ("Extension context invalidated"): we ignore the error rather than polluting the console.
  const quiet = () => {};

  // Without chrome.storage (outside the extension), settings remain usable with their default values.
  const settings = S.createSettings(adapter || { get: async () => undefined, set: async () => {} });
  settings.load().catch(quiet);

  // Another context (popup, another tab, or another frame) changed a setting: we follow it without reloading.
  if (typeof chrome !== 'undefined' && chrome && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local' && changes.settings) settings.applyExternal(changes.settings.newValue);
    });
  }

  /** @type {LF.Storage} */
  const api = { adapter, quiet, settings };
  root.LinkedInStorage = api;
})(globalThis);
