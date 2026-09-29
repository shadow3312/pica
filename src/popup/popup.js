// @ts-check
/*
 * Popup script for the extension.
 */
(function () {
  "use strict";
  const S = globalThis.LinkedInStorage.settings;

  /** type {Record<LF.SettingName, {title: string, help: string}>} */
  const LABELS = {
    drafts: {
      title: "Brouillons automatiques",
      help: "Sauvegarde locale de ton post pendant que tu écris, et pastille « Brouillons ». Les brouillons déjà enregistrés sont conservés si tu désactives.",
    },
  };

  const list = /** @type {HTMLElement} */ (document.getElementById("list"));
  /** @type {Map<string, HTMLInputElement>} */
  const boxes = new Map();

  for (const name of S.names) {
    const row = document.createElement("label");
    row.className = "row";

    const box = document.createElement("input");
    box.type = "checkbox";
    box.checked = S.get(name);
    box.addEventListener("change", () => {
      // If the setting fails to save, revert the checkbox to its previous state
      S.set(name, box.checked).catch(() => {
        box.checked = S.get(name);
      });
    });
    boxes.set(name, box);

    const text = document.createElement("div");
    const title = document.createElement("div");
    title.className = "title";
    title.textContent = LABELS[name].title;
    const help = document.createElement("div");
    help.className = "help";
    help.textContent = LABELS[name].help;
    text.append(title, help);

    row.append(box, text);
    list.append(row);
  }

  // Load immediately default setting, then update when storage is read
  S.onChange((name, value) => {
    const box = boxes.get(name);
    if (box) box.checked = value;
  });
  S.load()
    .then(() => {
      console.log("Settings loaded");
    })
    .catch((err) => {
      console.error("Failed to load settings", err);
    });
})();
