// @ts-check
/*
 * State machine for the "Templates" panel (templates-ui.js), without DOM or chrome.*. Exposed on
 * globalThis.LinkedInPanelState.
 *
 *   reduce(state, event) -> { state, effects }
 *
 * It does nothing: it DESCRIBES what the interface must do (`effects`). 
 *
 * Modes: closed | list | form (fill in a template's variables) | save (name the editor text) |
 * create (write a template) | ask (value of a variable typed in the editor).
 * `form`, `save`, `create`, and `ask` are "locked": focus is in a field of the panel, the editor is no
 * longer the active element, and the interface must remain displayed anyway.
 *
 * Identity contract: `state` is a NEW object when something has changed, the SAME object otherwise (the
 * interface only rebuilds the panel in the first case: rebuilding while typing in a field clears the
 * input). The state is never modified in place.
 */
/** @param {typeof globalThis} root */
(function (root) {
  'use strict';

  /** @returns {LF.PanelState} */
  function initial() {
    return { mode: 'closed', formTemplate: null, pending: null, notice: '', savedOffsets: null, lastValues: {} };
  }

  /** @param {LF.PanelState} state */
  function isLocked(state) {
    return state.mode === 'form' || state.mode === 'save' || state.mode === 'create' || state.mode === 'ask';
  }

  /**
   * @param {string} text
   * @param {number} max
   * @returns {string}
   */
  function oneLine(text, max) {
    return text.replace(/\s+/g, ' ').trim().slice(0, max);
  }

  const NO_TEXT_NOTICE = 'Écris d’abord le texte du modèle dans l’éditeur.';

  /**
   * New state, with the invariant guaranteed in one place: `formTemplate` exists only in the "form"
   * mode, `pending` only in the "ask" mode. Every transition passes through here, so no stale data from
   * an old mode can survive (a test traverses all reachable states).
   * @param {LF.PanelState} state
   * @param {Partial<LF.PanelState>} patch
   * @returns {LF.PanelState}
   */
  function patchState(state, patch) {
    const next = { ...state, ...patch };
    if (next.mode !== 'form') next.formTemplate = null;
    if (next.mode !== 'ask') next.pending = null;
    return next;
  }

  /**
   * Complete closure: the panel and everything dependent on the current mode restart from scratch.
   * @param {LF.PanelState} state
   * @returns {LF.PanelState}
   */
  function closedFrom(state) {
    if (state.mode === 'closed' && !state.formTemplate && !state.pending && !state.notice) return state;
    return patchState(state, { mode: 'closed', notice: '' });
  }

  /**
   * @param {LF.PanelState} state
   * @param {LF.PanelEvent} event
   * @returns {{ state: LF.PanelState, effects: LF.PanelEffect[] }}
   */
  function reduce(state, event) {
    switch (event.type) {
      // Click on the pill: opens the list, or closes the panel if it is open (regardless of its mode).
      case 'chip':
        if (state.mode !== 'closed') return { state: closedFrom(state), effects: [{ type: 'focus-editor' }] };
        return {
          state: patchState(state, { mode: 'list', notice: '', savedOffsets: event.selection || state.savedOffsets }),
          effects: [{ type: 'refresh-list' }],
        };

      // A template without a variable to ask for is inserted immediately; otherwise, a form is shown.
      case 'use':
        if (!event.variables.length) {
          return {
            state: patchState(state, { mode: 'closed' }),
            effects: [{ type: 'insert', template: event.template, values: {}, at: state.savedOffsets }],
          };
        }
        return { state: patchState(state, { mode: 'form', formTemplate: event.template }), effects: [] };

      case 'new':
        return { state: patchState(state, { mode: 'save', notice: '' }), effects: [] };

      case 'create':
        return { state: patchState(state, { mode: 'create', notice: '' }), effects: [] };

      // The template text is empty: nothing happens (the panel remains open, and the input is preserved).
      case 'create-submit':
        if (!event.text.trim()) return { state, effects: [] };
        return {
          state,
          effects: [{ type: 'save-template', name: event.name.trim() || oneLine(event.text, 30), text: event.text }],
        };

      // Save the editor text: if it is empty, return to the list with a message. The name field that had
      // focus disappears with the "save" mode: without restoring focus to the editor, no editor is active,
      // and the interface closes before the message can be read (bug seen in the browser, present before
      // the state machine).
      case 'save-submit':
        if (!event.text.trim()) {
          return { state: patchState(state, { mode: 'list', notice: NO_TEXT_NOTICE }), effects: [{ type: 'focus-editor' }] };
        }
        return {
          state,
          effects: [{ type: 'save-template', name: event.name.trim() || 'Sans nom', text: event.text }],
        };

      // The template is saved: close and restore focus to the editor. Without this, the name field disappears
      // with focus, and the entire panel closes (bug seen in the browser).
      case 'saved':
        return { state: closedFrom(state), effects: [{ type: 'focus-editor' }] };

      case 'form-submit': {
        const template = state.formTemplate;
        if (!template) return { state, effects: [] };
        return {
          state: patchState(state, { mode: 'closed' }),
          effects: [{ type: 'insert', template, values: event.values, at: state.savedOffsets }],
        };
      }

      // A custom variable has just been typed in the editor. LinkedIn's editor regains focus after
      // finishing processing the keystroke: the interface must return focus to the field immediately after.
      case 'ask-open':
        return {
          state: patchState(state, { mode: 'ask', pending: { name: event.name, raw: event.raw, offset: event.offset } }),
          effects: [{ type: 'refocus-panel' }],
        };

      case 'ask-submit': {
        const pending = state.pending;
        if (!pending) return { state, effects: [] };
        return {
          state: patchState(state, { mode: 'closed', lastValues: { ...state.lastValues, [pending.name]: event.value } }),
          effects: [{ type: 'replace-typed', raw: pending.raw, offset: pending.offset, value: event.value }],
        };
      }

      // Cancel, escape, or return focus to the editor.
      case 'close':
        return { state: closedFrom(state), effects: [{ type: 'focus-editor' }] };

      // Silent closure: the editor changed or disappeared. Do not restore focus.
      case 'reset':
        return { state: closedFrom(state), effects: [] };

      // The "Templates" setting has just been disabled: the list closes, while the value field of a
      // variable typed in another setting remains open.
      case 'chip-disabled':
        if (state.mode !== 'list') return { state, effects: [] };
        return { state: closedFrom(state), effects: [] };

      default:
        throw new Error('Événement inconnu : ' + /** @type {{ type: string }} */ (event).type);
    }
  }

  /** @type {LF.PanelStateModule} */
  const api = { initial, reduce, isLocked, oneLine };
  /** @type {typeof globalThis & { LinkedInPanelState: LF.PanelStateModule }} */
  (root).LinkedInPanelState = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
