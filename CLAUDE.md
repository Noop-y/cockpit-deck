# The Deck — mémo pour Claude

À lire au début de chaque session, avec `TODO.md`. Répondre en français, simplement : l'utilisateur débute en développement.

## Le projet

The Deck est un écran tactile fait maison (Waveshare ESP32-P4-WIFI6-Touch-LCD-7B, 1024×600, branché en USB-C) façon Stream Deck, pensé pour Star Citizen. Ce dépôt contient le **logiciel Windows** (Electron) qui prépare les pages et les cases, les envoie à l'écran, et fait ce que l'écran ne peut pas faire seul : ouvrir une appli sur le bon écran, piloter OBS et Discord, lire la musique en cours, jouer les sons de la soundboard, enregistrer des clips. Le programme de l'écran (firmware ESP32-P4) n'est pas encore écrit.

## Commandes

| Commande | Où | Remarque |
|---|---|---|
| `npm install` | PowerShell, dossier du projet | installe Electron et electron-builder |
| `npm start` | idem | lance le logiciel. Les fonctions Windows (DPAPI, SMTC, PowerShell, fenêtres, clips) ne marchent que sous Windows |
| `npm run dist` | Windows seulement | fabrique les `.exe` dans `dist/`. Pour les clips, il faut `vendor/ffmpeg.exe` (la fabrication GitHub le télécharge toute seule) |
| `node --test` | partout | tests automatiques (`tests/`). Le test des clips a besoin de FFmpeg, sinon il est sauté |
| Ouvrir `src/index.html` dans un navigateur | partout | « mode aperçu » : l'interface tourne sans Electron (`api.browser`), utile pour vérifier l'affichage |
| `node tools/notice/shots.js` puis `node tools/notice/pdf.js` | partout (Playwright) | refait les captures et la notice PDF (`tools/notice/`) |

Fabrication officielle : chaque `git push` lance GitHub Actions (`.github/workflows/fabriquer-exe.yml`), qui produit l'artefact **The-Deck-Windows** (`The-Deck-Installation-X.Y.Z.exe` et `The-Deck-Portable-X.Y.Z.exe`). Le skill `the-deck-publier-version` décrit la marche à suivre pour publier.

## Architecture

- `main.js` — processus principal Electron : fenêtre, icône près de l'horloge, une seule copie à la fois (la plus récente remplace l'ancienne), configuration et sauvegardes dans `%APPDATA%\The Deck`, chiffrement DPAPI des codes, scripts PowerShell (placement des fenêtres, morceau en cours via SMTC, touches multimédia, programmes en cours), touches réservées F13–F24, soundboard (copie des sons), clips (IPC `clips:*`).
- `preload.js` — pont sécurisé : expose `window.deck` (toutes les fonctions système) à l'interface. Rien d'autre ne passe.
- `discord-rpc.js` — connexion locale à Discord (tuyau `discord-ipc-N`, OAuth2) : micro, casque, entrées/sorties audio.
- `clips.js` — enregistreur de clips (côté Node) : « mémoire » FFmpeg en morceaux de 2 s, clip, vidéo, capture, liste « Mes clips ». Voir `docs/fonctionnalites.md`.
- `src/` — l'interface (scripts classiques, sans module ni outil de build, chargés dans cet ordre par `index.html`) :
  - `data.js` pictogrammes, couleurs, catégories, modèles d'espaces ;
  - `obs.js` OBS (obs-websocket) ; `sound.js` moteur de la soundboard ; `cliprec.js` son des clips (AudioWorklet) ;
  - `app.js` le cœur : configuration `cfg`, état `ui`, rendu (`render()` reconstruit la page en HTML), écran du Deck (`deckPage`, `deckCell`…), simulateur, liaison USB, actions (`ACTIONS`, `data-act`), champs (`onField`, `data-field`), migration des anciennes configurations (`migrate`) ;
  - `clipsui.js` tout ce qui touche aux clips dans l'interface (chargé après `app.js`, il ajoute ses actions à `ACTIONS`) ;
  - `styles.css` ; sur l'écran du Deck, les tailles sont en `cqw` (1 cqw = 1 % de la largeur de l'écran).
- `build/` — icônes de l'application. `vendor/` — FFmpeg, téléchargé à la fabrication (pas dans git).
- `PROTOCOLE.md` — échanges USB avec l'écran : une ligne JSON par message, 921 600 bauds. PC → écran : `config` (réponse `OK`/`ERR`), `media`, `clips`. Écran → PC : `sound`, `sound-stop`, `volume`, `clip`. Les cases « PC » (appli, OBS, Discord, clip) passent par une touche réservée F13–F24.
- `materiel/boitier/` — modèle 3D du boîtier (Python : cadre gravé, coque, pied à lamelles, export STL).
- `tools/notice/` — notice d'utilisation (HTML → PDF) et scripts de captures.

## Conventions observées

- Tout le texte visible est en français simple, apostrophes typographiques (`’` dans les chaînes JS), pas de jargon.
- JavaScript sans framework : fonctions qui renvoient du HTML en chaînes, `esc()` sur tout texte venant de l'utilisateur, `render()` après un changement, `commit()` pour enregistrer (`commit(true)` = enregistrer sans redessiner).
- Nouvelle fonction de l'interface = une entrée dans `ACTIONS` (`data-act="…"`) ou un `case` dans `onField` (`data-field="…"`).
- Nouveau réglage = valeur par défaut dans `defaultConfig()` **et** reprise dans `migrate()` (les anciennes configurations doivent continuer à marcher).
- Chaque appel système passe par `window.deck` (preload) avec un équivalent « navigateur » dans le repli `api` en haut de `app.js`.
- Commentaires en français, courts. Messages de commit : `Version X.Y.Z : …`.
- Version dans `package.json`, `LISEZMOI.md` (titre, noms des `.exe`, liste « Ce qui marche ») et la notice.

## Sécurité

- Le mot de passe OBS, le Client Secret Discord et le jeton Discord sont chiffrés par Windows (DPAPI, préfixe `dpapi:`) dans la configuration, les sauvegardes et `discord-jeton.json`.
- Ils ne sont **jamais** mis dans un espace exporté ni envoyés à l'écran (`deviceConfig()` ne les contient pas).
- **Ne jamais** les écrire en clair, les afficher dans un log, ni les committer. Aucune configuration réelle de l'utilisateur dans le dépôt.
- Ouverture de liens externes limitée (`link:open` : vb-audio.com et discord.com) ; lecture de fichiers limitée aux dossiers du logiciel (`sound:read`, `clips.inside()`).

## Règles de travail

- Proposer un plan avant de modifier plusieurs fichiers. Petits changements, un commit par fonctionnalité.
- **Ne jamais supprimer de fichier ni toucher au `package.json` sans demander.**
- Après chaque modification, dire à l'utilisateur quoi tester à la main (et le noter dans `docs/tests-manuels.md`).
- Vérifier avant de livrer : `node --check` sur les fichiers JS modifiés, `node --test`, et ouvrir l'interface en mode aperçu (Playwright) pour voir qu'il n'y a pas d'erreur.
- Pour économiser : lire `CLAUDE.md` et `TODO.md`, puis seulement les parties de fichiers utiles (`app.js` est long : chercher la fonction avec Grep).

## Ce qui reste à faire

Voir `TODO.md`. En résumé : programme de l'écran (ESP32-P4 : manette et clavier USB, protocole de `PROTOCOLE.md`), Twitch, tests des fonctions Windows sur le vrai PC, boîtier définitif (photos et mesures de la carte).

## Suivi du projet

1. **Documentation.** Dans le dossier `docs/`, tu documentes chaque fonctionnalité terminée en quelques lignes simples : ce que ça fait, comment ça marche, où est le code. Mets à jour la doc quand le code change.
2. **Tests.** Pour chaque nouveau morceau de code, tu écris des tests et tu m'indiques la commande pour les lancer. Les parties qui dépendent de Windows ou de l'USB ne peuvent pas être testées automatiquement : tu me prépares alors une checklist de tests manuels dans `docs/tests-manuels.md`.
3. **TODO.** Tu tiens à jour un fichier `TODO.md` à la racine, avec trois sections : Fait, En cours, À faire. Tu le mets à jour à chaque fin de session et tu le relis au début de chaque session.
4. **Décisions (ADR).** Quand on prend un choix technique important (une bibliothèque, un format, une architecture), tu proposes d'écrire un mini fichier dans `docs/adr/`, nommé `0001-titre-court.md`, `0002-...`, etc. Format ultra léger, trois parties : Contexte (pourquoi on se pose la question), Décision (ce qu'on a choisi), Conséquences (ce que ça change, avantages et inconvénients). Tu en proposes un seulement pour les vrais choix structurants, pas pour chaque détail.

## Questions groupées

Quand il y a beaucoup de questions, créer un formulaire `docs/questions-AAAA-MM-JJ.md` : pour chaque question, des cases à cocher (`- [ ]`) avec avantage et inconvénient, une case « Autre » à remplir, et la recommandation en gras.
