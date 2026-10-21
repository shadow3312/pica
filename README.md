# Pica - LinkedIn Formatter

Extension Chrome, Edge et Brave qui ajoute une barre de mise en forme et des raccourcis clavier directement dans les champs de texte de LinkedIn : **gras**, *italique*, souligné, barré, monospace, listes, typographie française, aération du texte, modèles et brouillons.

Pas de site tiers où copier-coller son texte, aucune requête réseau, aucune donnée collectée.

> Projet indépendant, sans lien avec LinkedIn Corporation. « LinkedIn » est une marque de son propriétaire.

## Sommaire

- [Fonctionnalités](#fonctionnalités)
- [Installation](#installation)
- [Utilisation](#utilisation)
- [Réglages](#réglages)
- [Comment ça marche](#comment-ça-marche)
- [Confidentialité](#confidentialité)
- [Limites connues](#limites-connues)
- [Contribuer](#contribuer)
- [Architecture](#architecture)
- [Licence](#licence)

## Fonctionnalités

- **Barre flottante** au-dessus de la sélection, dans les posts, commentaires, messages et sections « À propos ».
- **Styles** : gras, italique, souligné, barré, monospace, cumulables (gras + italique = gras-italique).
- **Listes** à puces et numérotées, sur la ligne du curseur ou sur plusieurs lignes.
- **Markdown à la frappe** : `**gras**`, `*italique*`, `` `mono` ``, `~~barré~~` se convertissent pendant que tu tapes ; `- ` en début de ligne devient une puce `•`.
- **Typographie française** : espaces insécables avant `; : ! ?`, guillemets « », apostrophes courbes.
- **Export Markdown** : convertit un texte stylé en Markdown (pour une newsletter, un article) et inversement.
- **Aération** : découpe un pavé de texte en blocs de 1 à 2 phrases séparés par une ligne vide.
- **Nettoyage du collage** : répare le texte collé depuis Word, un PDF ou un site (espaces invisibles, puces, mots coupés, paramètres de suivi des liens).
- **Compteur de caractères** et **ligne de coupe** qui montre où LinkedIn affichera « …voir plus ».
- **Modèles** de posts réutilisables, avec variables `{{nom}}`, `{{date}}`.
- **Brouillons automatiques** des posts, enregistrés localement.

## Installation

L'extension n'est pas (encore) publiée sur le Chrome Web Store : elle s'installe depuis le code source.

1. Télécharge le dépôt (`git clone https://github.com/shadow3312/linkedin-formatter.git` ou **Code → Download ZIP** puis décompresse). Garde le dossier : le navigateur charge l'extension depuis cet emplacement.
2. Ouvre `chrome://extensions` (Edge : `edge://extensions`, Brave : `brave://extensions`).
3. Active le **Mode développeur** (interrupteur en haut à droite).
4. Clique sur **Charger l'extension non empaquetée** et sélectionne le dossier du projet (celui qui contient `manifest.json`).
5. Recharge les onglets LinkedIn déjà ouverts.

Pour mettre à jour : récupère la nouvelle version (`git pull`), clique sur l'icône de rechargement de la carte de l'extension dans `chrome://extensions`, puis recharge LinkedIn.

## Utilisation

Sélectionne du texte dans un champ LinkedIn : la barre apparaît au-dessus de la sélection. Les raccourcis marchent aussi sans la barre. Sur Mac, remplace `Ctrl` par `Cmd`.

### Barre d'outils et raccourcis

| Bouton | Action | Raccourci |
|---|---|---|
| **B** | Gras | `Ctrl + B` |
| *I* | Italique | `Ctrl + I` |
| U souligné | Souligné | `Ctrl + U` |
| S barré | Barré | `Ctrl + Maj + X` |
| `</>` | Monospace | `Ctrl + Maj + M` |
| Liste | Liste à puces | `Ctrl + Maj + 8` |
| Liste numérotée | Liste numérotée | `Ctrl + Maj + 7` |
| Gomme | Effacer le formatage | — |
| « » | Typographie française | `Ctrl + Maj + F` |
| Logo Markdown | Markdown ⇄ Unicode | `Ctrl + Maj + E` |
| ¶ | Aérer le texte | `Ctrl + Maj + K` |
| — | Nettoyer le texte | `Ctrl + Maj + L` |

Les raccourcis `Ctrl + Maj + 8` et `Ctrl + Maj + 7` marchent en AZERTY comme en QWERTY.

### Bon à savoir

- **Cumul et retrait** : appliquer gras puis italique donne du gras-italique ; réappliquer un style le retire.
- **Sans sélection** : les listes et le nettoyage agissent sur la ligne du curseur ; l'aération agit sur tout le texte.
- **Annuler** : `Ctrl + Z` fonctionne normalement, toutes les modifications passent par l'éditeur de LinkedIn.
- **Texte venu d'ailleurs** : un texte déjà stylé par un autre outil est reconnu ; la gomme le remet en texte normal.

### Markdown à la frappe

Tape la syntaxe Markdown : la mise en forme s'applique dès le marqueur fermant.

| Tu tapes | Résultat |
|---|---|
| `**gras**` | gras |
| `*italique*` ou `_italique_` | italique |
| `***les deux***` | gras-italique |
| `~~barré~~` | barré |
| `` `code` `` | monospace |
| `- ` en début de ligne | puce `• ` |

`Ctrl + Z` juste après une conversion rend le texte tel que tu l'as tapé. Les cas ambigus ne sont jamais convertis : `2*3*4`, `nom_de_variable`, `a * b * c`, `(a+b)*(c+d)`.

### Aération

Quand un post est un pavé dense (au moins 300 caractères), une pastille **¶ Aérer** apparaît sous l'éditeur. Un clic découpe le texte en blocs de 1 à 2 phrases séparés par une ligne vide. Les abréviations (`M.`, `Dr`, `cf.`), les initiales, les URL, les nombres décimaux et les listes sont respectés.

### Nettoyage du collage

Le texte collé est nettoyé automatiquement : espaces invisibles et exotiques, puces de Word et des PDF converties en `•`, mots coupés en fin de ligne recollés, lignes vides multiples réduites, paramètres de suivi (`utm_…`, `fbclid`, `gclid`…) retirés des liens. Le texte déjà stylé, les emoji et la typographie française ne sont pas touchés. `Ctrl + Z` annule le collage.

### Compteur et ligne de coupe

Sous un post ou un commentaire, un compteur indique le nombre de caractères (limite d'environ 3 000 pour un post, 1 250 pour un commentaire). Dans un post, une ligne pointillée marque l'endroit approximatif (vers 210 caractères) où LinkedIn coupe le texte avec « …voir plus » : c'est ce que tes lecteurs verront avant de cliquer.

### Modèles

La pastille **Modèles**, sous l'éditeur de post, ouvre un panneau pour insérer, créer ou supprimer des modèles (jusqu'à 100).

- **Créer** : « + Enregistrer le texte actuel » reprend le post en cours ; « + Nouveau modèle… » ouvre une zone de saisie (`Ctrl + Entrée` pour enregistrer).
- **Variables** : un modèle peut contenir `{{prénom}}`, `{{entreprise}}`… À l'insertion, un petit formulaire demande leurs valeurs.
- **Variables automatiques** : `{{date}}` (date longue, ex. « 21 octobre 2026 ») et `{{date_courte}}` (21/10/2026).
- **En tapant** : dans un post, taper `{{date}}` le remplace aussitôt ; taper `{{nom}}` ouvre un champ pour saisir sa valeur (`Échap` laisse le texte tel quel).

Un modèle ne se modifie pas : supprime-le et enregistre la nouvelle version.

### Brouillons

Le post en cours d'écriture est enregistré automatiquement dans le navigateur. La pastille **Brouillons (n)** permet de restaurer ou de supprimer les 20 derniers. Un post publié reste dans la liste jusqu'à ce que des brouillons plus récents le remplacent (l'extension ne peut pas savoir qu'il a été publié).

## Réglages

Un clic sur l'icône de l'extension ouvre les réglages, un interrupteur par fonctionnalité optionnelle (toutes actives par défaut) :

- Saisie Markdown en tapant
- Variables `{{…}}` en tapant
- Brouillons automatiques
- Modèles
- Nettoyage du collage
- Suggestion d'aération

Les changements s'appliquent immédiatement dans tous les onglets, sans recharger LinkedIn. Désactiver les brouillons ou les modèles ne supprime rien. Les raccourcis (`Ctrl + Maj + K`, `Ctrl + Maj + L`…) restent disponibles quel que soit le réglage.

## Comment ça marche

LinkedIn n'accepte que du texte brut. Comme les sites de « police LinkedIn », l'extension remplace chaque lettre par son équivalent dans le bloc Unicode *Mathematical Alphanumeric Symbols* (𝗮 au lieu de a, 𝘢 pour l'italique, 𝚊 pour le monospace). Le souligné et le barré utilisent des caractères combinants. La différence : ici, la substitution se fait sur place, dans le champ LinkedIn, et peut être annulée ou défaite à tout moment.

## Confidentialité

- **Aucune requête réseau**, aucune donnée collectée, aucun suivi. Rien ne quitte ton navigateur.
- Le script ne tourne que sur `https://www.linkedin.com/*`.
- **Une seule permission**, `storage`, pour garder localement tes brouillons, modèles et réglages. Ils se suppriment depuis leurs panneaux, ou tous ensemble en désinstallant l'extension.

Ces promesses sont vérifiées par les tests automatiques (`tests/manifest.test.js`) : un changement qui ajouterait une permission, un appel réseau ou un `eval` fait échouer la suite.

## Limites connues

- **Accents** : Unicode n'a pas de é, à, ç stylés. Ces lettres restent en style normal au milieu d'un mot formaté (𝗖𝗿é𝗲𝗿). C'est la même limite pour tous les outils de ce type.
- **Accessibilité et recherche** : les lecteurs d'écran lisent mal ces caractères et LinkedIn ne les indexe pas comme du texte normal. Réserve le style aux titres et aux mots-clés plutôt qu'à des paragraphes entiers.
- **Seuils approximatifs** : la limite de caractères et la position de « …voir plus » ont été relevées à la main et varient selon l'appareil du lecteur.
- **Markdown à la frappe** : une mention ou un lien entre le marqueur ouvrant et le curseur empêche la conversion.
- **Tirets de dialogue** : `- ` en début de ligne devient une puce ; `Ctrl + Z` rend le tiret.
- **Dépendance au site** : l'extension s'appuie sur la structure de la page LinkedIn. Une refonte de LinkedIn peut casser certaines fonctions jusqu'à une mise à jour.

## Contribuer

Les contributions sont bienvenues : rapports de bug, idées, pull requests.

**Signaler un bug** : ouvre une [issue](https://github.com/shadow3312/pica/issues) en précisant le navigateur, le type de champ (post, commentaire, message, « À propos ») et les étapes pour reproduire.

### Mise en place

Aucune étape de build et aucune dépendance : le code se charge tel quel dans le navigateur. Il te faut seulement [Node.js](https://nodejs.org/) (18 ou plus) pour les tests.

```bash
git clone https://github.com/shadow3312/linkedin-formatter.git
cd linkedin-formatter
node --test                                   # tests (runner intégré à Node)
npx -p typescript tsc -p jsconfig.json        # vérification des types, doit afficher zéro erreur
```

Charge ensuite le dossier comme extension non empaquetée (voir [Installation](#installation)). Après chaque modification : recharge l'extension dans `chrome://extensions`, puis l'onglet LinkedIn.

### Avant d'ouvrir une pull request

- `node --test` passe et `tsc` n'affiche aucune erreur.
- Une règle de texte pure arrive avec ses tests dans `tests/`.
- Si tu touches à ce qui interagit avec la page (barre, compteur, brouillons, modèles, frappe Markdown), passe la checklist de [`TESTING.md`](TESTING.md) dans le navigateur.
- Messages de commit au format [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`, `test:`, `refactor:`…).
- Ne pas ajouter de permission, d'appel réseau ni de dépendance : c'est une promesse faite aux utilisateurs.

## Architecture

```
manifest.json         Déclaration de l'extension (Manifest V3) et ordre de chargement des scripts
types.d.ts            Contrats entre modules, vérifiés par // @ts-check (sans compilation)
src/
  core/               Logique pure : ni DOM, ni navigateur, testée sous Node
    unicode.js          Moteur d'encodage et de décodage des styles
    features.js         Registre des actions (transformation, bouton, raccourci)
    typed-markdown.js   Détection du Markdown tapé à la volée
    markdown.js         Conversion Unicode ⇄ Markdown
    typography.js       Typographie française
    paste-cleanup.js    Nettoyage du texte collé
    airing.js           Découpage en phrases et aération
    templates.js        Variables {{…}} des modèles
    panel-state.js      Machine à états du panneau Modèles
    drafts.js           Stockage des brouillons et des modèles
    settings.js         Réglages
    layout.js           Géométrie de placement (barre, panneaux, pastilles)
  platform/           Adaptateurs vers la page et le navigateur
    editor.js           Seul fichier qui connaît le DOM de LinkedIn, plus le bus d'événements
    ui-host.js          Hôte d'interface partagé (shadow DOM, pastilles sous l'éditeur)
    storage.js          Seul fichier qui touche à chrome.storage
  widgets/            Fonctionnalités à l'écran
    content.js          Barre flottante et raccourcis
    overlay.js          Compteur et ligne de coupe
    drafts-ui.js        Brouillons
    templates-ui.js     Modèles
    markdown-typing.js  Markdown à la frappe
    paste-cleanup.js    Nettoyage au collage
    airing-ui.js        Pastille « Aérer »
  popup/              Fenêtre des réglages (icône de l'extension)
tests/                Un fichier de tests par module de core, plus la garde du manifest
icons/                Icônes 16, 48 et 128 px
```

Les règles de cette arborescence sont vérifiées par `tests/manifest.test.js` : `src/core` ne touche jamais au DOM ni au navigateur, seul `storage.js` mentionne `chrome`, les widgets passent par `ui-host.js` pour s'afficher, et chaque script n'utilise que des modules chargés avant lui.

## Licence

[MIT](LICENSE) © 2026 Shuruzer.
