// @ts-check
/*
 * Popup script for the extension.
 */
(function () {
  "use strict";
  const S = globalThis.LinkedInStorage.settings;

  /** type {Record<LF.SettingName, {title: string, help: string}>} */
  const LABELS = {
    markdownTyping: {
      title: 'Saisie Markdown en tapant',
      help: 'Tape **gras**, *italique*, `mono` ou ~~barré~~ : la mise en forme s’applique dès le marqueur fermant. Ctrl+Z revient au Markdown tapé.',
    },
    typedVariables: {
      title: 'Variables {{…}} en tapant',
      help: '{{date}} est remplacée aussitôt ; {{nom}} ouvre un champ pour saisir sa valeur.',
    },
    drafts: {
      title: 'Brouillons automatiques',
      help: 'Sauvegarde locale de ton post pendant que tu écris, et pastille « Brouillons ». Les brouillons déjà enregistrés sont conservés si tu désactives.',
    },
    airing: {
      title: 'Suggestion d’aération',
      help: 'Pastille « Aérer » sous l’éditeur de post quand le texte est un pavé dense : blocs de 1 à 2 phrases séparés par une ligne vide. Ctrl+Maj+K aère à la demande, réglage coché ou non.',
    },
    pasteCleanup: {
      title: 'Nettoyage du collage',
      help: 'Répare le texte collé depuis Word, un PDF ou un site : espaces, puces, mots coupés, liens de suivi. Ctrl+Z annule le collage. Ctrl+Maj+L nettoie le texte sélectionné, réglage coché ou non.',
    },
    templates: {
      title: 'Modèles',
      help: 'Pastille « Modèles » sous l’éditeur de post. Les modèles déjà enregistrés sont conservés si tu désactives.',
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
