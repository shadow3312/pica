/*
 * Shared types for the LF namespace
 * This file describes the contacts: each module assigns his API to a global bellow
 * so typescript can check the types of the API and provide intellisense
 * Not loaded in the browser, only used for type checking 
 */

declare namespace LF {
    type SettingName = 'markdownTyping' | 'typedVariables' | 'drafts' | 'templates' | 'pasteCleanup' | 'airing';

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
    createSettings(adapter: StorageAdapter, options?: { key?: string }): Settings;
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

declare var LinkedInStorage: LF.Storage;
