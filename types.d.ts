/*
 * Shared types for the LF namespace
 * This file describes the contacts: each module assigns his API to a global bellow
 * so typescript can check the types of the API and provide intellisense
 * Not loaded in the browser, only used for type checking
 */

declare namespace LF {

  type FormatName = "bold" | "italic" | "underline" | "strike" | "mono";

  /** A character decoded by unicode.js: base letter + styles + combining accents. */
  interface Token {
    base: string;
    bold: boolean;
    italic: boolean;
    mono: boolean;
    u: boolean;
    s: boolean;
    marks: string;
  }

  interface Formatter {
    toggle(str: string, format: FormatName): string;
    setStyle(str: string, styles: Partial<Record<FormatName, boolean>>): string;
    clear(str: string): string;
    toggleList(str: string, type: "bullets" | "numbered"): string;
    tokenize(str: string): Token[];
  }

  interface Typography {
    apply(str: string): string;
  }

   interface Layout {
    placeToolbar(
      anchor: { left: number; top: number; bottom: number; width: number },
      size: { width: number; height: number },
      viewport: { width: number }
    ): { left: number; top: number };
    placePopover(chipTop: number, chipHeight: number, panelHeight: number): number;
    flowRow(items: Array<{ width: number; visible: boolean }>, gap: number): number[];
  }

  /** Machine à états du panneau « Modèles » (panel-state.js). */
  type PanelMode = 'closed' | 'list' | 'form' | 'save' | 'create' | 'ask';

  interface PanelState {
    mode: PanelMode;
    /** Mode « form » : le modèle dont on remplit les variables. */
    formTemplate: Draft | null;
    /** Mode « ask » : la variable tapée à remplir (raw = son texte exact, offset = où, en décalage de texte). */
    pending: { name: string; raw: string; offset: number } | null;
    notice: string;
    /** Sélection de l'éditeur à l'ouverture du panneau (décalages de texte : un Range ne survit pas au changement de focus). */
    savedOffsets: { start: number; end: number } | null;
    /** Dernière valeur saisie par variable, pour préremplir. */
    lastValues: Record<string, string>;
  }

  type PanelEvent =
    | { type: 'chip'; selection: { start: number; end: number } | null }
    | { type: 'use'; template: Draft; variables: string[] }
    | { type: 'new' }
    | { type: 'create' }
    | { type: 'create-submit'; name: string; text: string }
    | { type: 'save-submit'; name: string; text: string }
    | { type: 'saved' }
    | { type: 'form-submit'; values: Record<string, string> }
    | { type: 'ask-open'; name: string; raw: string; offset: number }
    | { type: 'ask-submit'; value: string }
    | { type: 'close' }
    | { type: 'reset' }
    | { type: 'chip-disabled' };

  /** Ce que l'interface doit faire ; la machine, elle, ne fait rien. */
  type PanelEffect =
    | { type: 'focus-editor' }
    | { type: 'refresh-list' }
    | { type: 'refocus-panel' }
    | { type: 'insert'; template: Draft; values: Record<string, string>; at: { start: number; end: number } | null }
    | { type: 'save-template'; name: string; text: string }
    | { type: 'replace-typed'; raw: string; offset: number; value: string };

  interface PanelStateModule {
    initial(): PanelState;
    reduce(state: PanelState, event: PanelEvent): { state: PanelState; effects: PanelEffect[] };
    /** Le focus est dans un champ du panneau : l'éditeur n'est plus l'élément actif. */
    isLocked(state: PanelState): boolean;
    oneLine(text: string, max: number): string;
  }

  type SettingName =
    | "markdownTyping"
    | "typedVariables"
    | "drafts"
    | "templates"
    | "pasteCleanup"
    | "airing";

  interface Settings {
    names: SettingName[];
    /** Reads the storage and updates the cache. */
    load(): Promise<void>;
    /** Synchronous read from the cache (default value while load() is not finished). */
    get(name: SettingName): boolean;
    all(): Record<SettingName, boolean>;
    /** Writes the change (only changes are stored). */
    set(name: SettingName, value: boolean): Promise<void>;
    /** Applies a value coming from another context (chrome.storage.onChanged). */
    applyExternal(raw: unknown): void;
    /** Subscription to real value changes ; returns the unsubscription function. */
    onChange(cb: (name: SettingName, value: boolean) => void): () => void;
  }

  interface SettingsModule {
    DEFAULTS: Readonly<Record<SettingName, boolean>>;
    createSettings(
      adapter: StorageAdapter,
      options?: { key?: string },
    ): Settings;
  }

  /** Storage of the extension (storage.js) : chrome.storage.local adapter + settings. */
  interface Storage {
    /** null outside the extension (chrome.storage unavailable). */
    adapter: StorageAdapter | null;
    /** Silent rejection : « Extension context invalidated » after an extension reload. */
    quiet: () => void;
    settings: Settings;
  }
}

declare var module: { exports: any } | undefined;
declare function require(id: string): any;

// Global variables exposed by each  module
declare var LinkedInFormatter: LF.Formatter;
declare var LinkedInTypography: LF.Typography;
declare var LinkedInStorage: LF.Storage;
declare var LinkedInLayout: LF.Layout;