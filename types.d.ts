/*
 * Shared types across modules (checked via `// @ts-check` + JSDoc, without a build).
 * This file describes the contracts: each module assigns its API to one of the globals below,
 * and TypeScript verifies that the exported object matches the interface.
 * It is not loaded by the extension: it is verifiable documentation for the editor.
 */

declare namespace LF {
  /** Where the editor is located (determined by editor.js). */
  type FieldType = 'post' | 'comment' | 'message' | 'other';

  type FormatName = 'bold' | 'italic' | 'underline' | 'strike' | 'mono';

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
    toggleList(str: string, type: 'bullets' | 'numbered'): string;
    tokenize(str: string): Token[];
  }

  interface Typography {
    apply(str: string): string;
  }

  interface Airing {
    airate(text: string): string;
    isDense(text: string): boolean;
  }

  interface PasteCleanup {
    clean(text: string): string;
  }

  interface Markdown {
    toMarkdown(str: string): string;
    fromMarkdown(str: string): string;
    looksLikeMarkdown(str: string): boolean;
  }

  /** Detection of Markdown typed on the fly (src/core/typed-markdown.js). */
  interface TypedMarkdown {
    /** Replacement zone (including markers, in offsets within the given text), inner text and style; null if nothing is closed. */
    detect(before: string): { start: number; end: number; inner: string; style: Partial<Record<FormatName, boolean>> } | null;
    /** Can the typed character close a syntax (*, _, `, ~)? */
    isMarker(ch: string | null | undefined): boolean;
  }

  interface Templates {
    extractVariables(text: string): string[];
    fill(text: string, values?: Record<string, string>, now?: Date): string;
    matchVariableAtEnd(str: string): { name: string; raw: string } | null;
  }

  /** A draft or a template (templates add `name`). */
  interface Draft {
    id: string;
    text: string;
    updatedAt: number;
    name?: string;
  }

  /** Access to storage, injected (chrome.storage.local in production, memory in tests). */
  interface StorageAdapter {
    get(key: string): Promise<any>;
    set(key: string, value: any): Promise<void>;
  }

  interface DraftStore {
    list(): Promise<Draft[]>;
    save(id: string, text: string, extra?: { name?: string }): Promise<void>;
    remove(id: string): Promise<void>;
  }

  interface Drafts {
    createStore(
      adapter: StorageAdapter,
      options?: { key?: string; max?: number; now?: () => number }
    ): DraftStore;
  }

  /** A text action recorded in features.js. */
  interface Feature {
    id: string;
    run: (text: string) => string;
    toolbar?: { label: string; title: string };
    shortcut?: { key?: string; code?: string; shift?: boolean };
    /** Without a selection, applies to the current line. */
    line?: boolean;
    /** Without a selection, applies to the entire text of the editor. */
    wholeText?: boolean;
    /** Fields where the feature is active (omitted = all). */
    contexts?: FieldType[];
  }

  interface Features {
    register(feature: Feature): void;
    get(id: string): Feature | null;
    list(): Feature[];
    run(id: string, text: string): string;
    matchesShortcut(feature: Feature, e: { shiftKey: boolean; code?: string }, lowerKey: string): boolean;
  }

  /** The active editor and current selection. */
  interface EditorContext {
    sel: Selection;
    editor: HTMLElement;
    range: Range;
    field: FieldType;
  }

  /** Events distributed by LinkedInEditor.on (one DOM listener per type, in editor.js). */
  interface BusEvents {
    /** Once per frame (requestAnimationFrame), after selection/focus/input/scroll/resize. */
    update: (ctx: EditorContext | null) => void;
    /** Each input, in capture phase, synchronous (can modify the editor). */
    input: (e: InputEvent) => void;
    focusin: (e: FocusEvent) => void;
    focusout: (e: FocusEvent) => void;
    /** Paste, in capture phase, synchronous: a subscriber may call preventDefault() and insert its own content. */
    paste: (e: ClipboardEvent) => void;
    /** The tab goes to the background. */
    hidden: () => void;
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

  /** State machine for the "Templates" panel (panel-state.js). */
  type PanelMode = 'closed' | 'list' | 'form' | 'save' | 'create' | 'ask';

  interface PanelState {
    mode: PanelMode;
    /** Form mode: the template whose variables are being filled. */
    formTemplate: Draft | null;
    /** Ask mode: the variable being typed in (raw = exact text, offset = where, in text offsets). */
    pending: { name: string; raw: string; offset: number } | null;
    notice: string;
    /** Editor selection when opening the panel (text offsets: a Range does not survive focus change). */
    savedOffsets: { start: number; end: number } | null;
    /** Last value entered for a variable, to prefill. */
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

  /** What the interface must do; the machine itself does nothing. */
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
    /** The focus is in a field of the panel: the editor is no longer the active element. */
    isLocked(state: PanelState): boolean;
    oneLine(text: string, max: number): string;
  }

  type SettingName = 'markdownTyping' | 'typedVariables' | 'drafts' | 'templates' | 'pasteCleanup' | 'airing';

  interface Settings {
    /** Setting names, in order. */
    names: SettingName[];
    /** Reads storage and refreshes the cache. */
    load(): Promise<void>;
    /** Synchronous read of the cache (default value until load() finishes). */
    get(name: SettingName): boolean;
    all(): Record<SettingName, boolean>;
    /** Writes the change (only changes are stored). */
    set(name: SettingName, value: boolean): Promise<void>;
    /** Applies a value coming from another context (chrome.storage.onChanged). */
    applyExternal(raw: unknown): void;
    /** Subscription to real value changes; returns the unsubscribe function. */
    onChange(cb: (name: SettingName, value: boolean) => void): () => void;
  }

  interface SettingsModule {
    DEFAULTS: Readonly<Record<SettingName, boolean>>;
    createSettings(adapter: StorageAdapter, options?: { key?: string }): Settings;
  }

  /** Extension storage (storage.js): chrome.storage.local adapter + settings. */
  interface Storage {
    /** null outside the extension (chrome.storage unavailable). */
    adapter: StorageAdapter | null;
    /** Silent rejection: "Extension context invalidated" after the extension reloads. */
    quiet: () => void;
    settings: Settings;
  }

  /** Shared interface host (ui-host.js). */
  interface UI {
    /** Reserves a full-screen area, without mouse capture, with its own shadow DOM. */
    mount(id: string, options?: { layer?: 'base' | 'top' }): { shadow: ShadowRoot; setVisible(visible: boolean): void };
    /** Declares a chip in the row under the editor; `order` = position (0 = left). */
    chip(order: number): { set(visible: boolean, width: number): void; offset(): number };
  }

  interface Editor {
    /** Subscribes to an event; returns the unsubscribe function. */
    on<K extends keyof BusEvents>(type: K, handler: BusEvents[K]): () => void;
    /** Requests a new "update" frame (e.g. a chip changed size). */
    requestUpdate(): void;
    currentContext(): EditorContext | null;
    editorOfEvent(e: Event): HTMLElement | null;
    fieldType(editor: HTMLElement): FieldType;
    overlayParent(editor: HTMLElement): HTMLElement;
    rangeToText(range: Range): string;
    replaceSelection(ctx: { editor: HTMLElement; sel: Selection }, newText: string): void;
    selectCurrentLine(sel: Selection): void;
    textLength(editor: HTMLElement): number;
    rangeAtGraphemeOffset(editor: HTMLElement, n: number): Range | null;
    getText(editor: HTMLElement): string;
    replaceAll(editor: HTMLElement, text: string): boolean;
    insertText(editor: HTMLElement, range: Range | null, text: string): boolean;
    textOffset(editor: HTMLElement, node: Node, offset: number): number;
    offsetsOf(editor: HTMLElement, range: Range): { start: number; end: number };
    rangeFromOffsets(editor: HTMLElement, start: number, end: number): Range;
    findTextOffsets(editor: HTMLElement, needle: string, near: number): { start: number; end: number } | null;
  }
}

// Globals exposed by each script (see "Exposé sur globalThis…" at the top of the file).
declare var LinkedInFormatter: LF.Formatter;
declare var LinkedInTypography: LF.Typography;
declare var LinkedInMarkdown: LF.Markdown;
declare var LinkedInTemplates: LF.Templates;
declare var LinkedInTypedMarkdown: LF.TypedMarkdown;
declare var LinkedInPasteCleanup: LF.PasteCleanup;
declare var LinkedInAiring: LF.Airing;
declare var LinkedInDrafts: LF.Drafts;
declare var LinkedInFeatures: LF.Features;
declare var LinkedInEditor: LF.Editor;
declare var LinkedInLayout: LF.Layout;
declare var LinkedInUI: LF.UI;
declare var LinkedInPanelState: LF.PanelStateModule;
declare var LinkedInSettings: LF.SettingsModule;
declare var LinkedInStorage: LF.Storage;

// Node compatibility (pure modules are also exported as CommonJS for `node --test`).
declare var module: { exports: any } | undefined;
declare function require(id: string): any;

// Chrome.* API actually used by the extension (no @types/chrome: no dependency).
declare const chrome:
  | {
      storage: {
        local: {
          get(key: string): Promise<Record<string, any>>;
          set(items: Record<string, any>): Promise<void>;
        };
        onChanged?: {
          addListener(cb: (changes: Record<string, { newValue?: any; oldValue?: any }>, areaName: string) => void): void;
        };
      };
    }
  | undefined;
