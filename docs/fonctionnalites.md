# Fonctionnalités — ce que ça fait, comment ça marche, où est le code

Une section par fonctionnalité terminée. À mettre à jour quand le code change.

## Espaces, pages et cases
- **Ce que ça fait** : chaque espace (Star Citizen, Bureau…) a des pages de 15 cases (12 pour la soundboard). Une case affiche photo, pictogramme et nom au choix, et fait une action : bouton de manette, touche, touche multimédia, appli, OBS, Discord, clip, changer de page.
- **Comment** : tout est dans l'objet `cfg` (enregistré dans `%APPDATA%\The Deck\config.json`). Une case = `{ name, image, edge, action, behavior }`.
- **Code** : `src/data.js` (modèles, pictogrammes), `src/app.js` (`viewEditeur`, `cellPanel`, `imagePanel`, `newSpace`, `migrate`).

## Favoris
- **Ce que ça fait** : un espace « Favoris » (étoile, en premier sur l'accueil). Dans les réglages de n'importe quelle case (jeu, Discord, OBS, clips, son de la soundboard…), le bouton « ☆ Ajouter aux favoris » en met une copie dans Favoris, à la première place libre (nouvelle page si besoin). Recliquer (« ★ Dans les favoris ») la retire.
- **Comment** : la case d'origine reçoit un `id`, la copie garde `fromId`. Une copie de son passe en sorties fixes (`route: 'fixed'`) avec les sorties cochées sur la soundboard. Un seul espace Favoris (catégorie `favoris`, absente du choix « Nouvel espace »).
- **Code** : `src/app.js` (`favSpace`, `favButton`, `toggleFav`, `migrate` : `favorisAdded`), `src/data.js` (catégorie `favoris`, pictogramme `favori`).

## Déplacer les cases (éditeur)
- **Ce que ça fait** : dans l'éditeur du logiciel (pas sur l'écran du Deck), on reste appuyé sur une case, on la déplace, et on relâche à la place voulue : les deux cases échangent leur place. Relâchée sur un onglet de page, elle part dans cette page (première place libre).
- **Comment** : événements `pointerdown/move/up` (souris et doigt). La case se soulève après 0,35 s d'appui ou dès qu'on bouge de quelques pixels ; une copie suit le pointeur.
- **Code** : `src/app.js` (`cellDrag`, `cellDragStart`, `cellDragEnd`), `src/styles.css` (`.ecell.ghost`, `.lifted`).

## Écran d'accueil et navigation
- **Ce que ça fait** : accueil de 5 espaces par page ; glisser gauche/droite = page, haut/bas = espace ; carré Accueil en haut à gauche.
- **Code** : `src/app.js` (`deckHome`, `homeBtn`, `simSwipe`, `simSwipeV`, `spaceOverlay`).

## Aperçu de l'écran (simulateur)
- **Ce que ça fait** : montre l'écran 1024×600 et réagit comme lui. Les actions PC (sons, clips, musique) marchent pour de vrai.
- **Code** : `src/app.js` (`openSim`, `simRender`, `simDown`, `simTap`, gestion `pointerdown/up`).

## Apparence
- **Code** : `src/app.js` (`viewApparence`, `editLook`), couleurs dans `src/data.js`.

## Ouvrir une appli sur le bon écran
- **Comment** : l'écran envoie une touche réservée (F13–F24) ; le logiciel la capte (`globalShortcut`) et lance un script PowerShell qui ouvre et place la fenêtre.
- **Code** : `main.js` (`PS_SCRIPT`, `runAppAction`, `shortcuts:set`), `src/app.js` (`assignHotkeys`, `runPcAction`).

## OBS
- **Comment** : obs-websocket v5 (mot de passe chiffré DPAPI).
- **Code** : `src/obs.js`, `viewConnexions` dans `src/app.js`.

## Discord
- **Ce que ça fait** : micro, casque (volume de sortie à 0), micro + casque, entrées/sorties audio, raccourcis personnels.
- **Comment** : connexion locale au tuyau `discord-ipc-N`, autorisation OAuth2 (Client ID + Secret de l'utilisateur), jeton chiffré DPAPI.
- **Code** : `discord-rpc.js`, `main.js` (IPC `discord:*`), `src/app.js` (`discordSpacePanels`, `discordConnPanel`).

## Spotify (lecteur)
- **Comment** : un script PowerShell lit les commandes multimédia de Windows (SMTC) et renvoie titre, artiste, jaquette ; un autre envoie les touches multimédia. La jaquette (JPEG 320 px) part à l'écran en direct (`media`).
- **Code** : `main.js` (`MEDIA_PS`, `KEYS_PS`), `src/app.js` (`deckPlayer`, `viewPlayer`, `deckSendMedia`).

## Soundboard
- **Ce que ça fait** : sons envoyés sur Moi (casque), Discord et Jeu (micro virtuel VB-CABLE, avec la vraie voix reprise), Stream (source « The Deck – Sons » créée dans OBS).
- **Code** : `src/sound.js` (Web Audio), `src/obs.js` (`playSound`), `main.js` (`sound:*`), `src/app.js` (`deckSound`, `soundPanel`, `viewAudio`).

## Clips (version 1.1.0)
- **Ce que ça fait** : une mémoire garde les dernières secondes (15 s à 5 min), en 1080p, 1440p, 1800p ou 4K, à 60, 120 ou 144 images/s. CLIP → MP4 dans `Vidéos\The Deck\Clips` ; ENREGISTRER → vidéo longue ; CAPTURE → PNG. Page « Mes clips » : lire, couper, renommer, copier pour Discord, supprimer.
- **Comment** :
  - `clips.js` lance FFmpeg en continu : image par `gfxcapture` (fenêtre du jeu ou écran, mise à l'échelle par la carte graphique ; repli `ddagrab`), encodage NVENC / AMF / QSV (repli x264), morceaux de 2 s (`-f segment`, liste `liste.csv`) dans `%TEMP%\TheDeck-memoire`. Les vieux morceaux sont effacés au fur et à mesure.
  - Un clip = les derniers morceaux recollés sans réencodage (`-f concat -c copy`).
  - Le son vient de l'interface (`src/cliprec.js`, AudioWorklet) par deux tuyaux nommés : piste « son du PC » (boucle de la sortie Windows ou appareil choisi, ex. Sonar – Stream, + sons soundboard partis sur Stream) et piste « voix ». FFmpeg les mélange (piste 1) et les garde aussi séparées (pistes 2 et 3).
  - Le jeu en cours est détecté par un script PowerShell (`SCAN_PS`) d'après le programme indiqué dans les espaces (`autoExe`).
- **Code** : `clips.js`, `main.js` (IPC `clips:*`, `SCAN_PS`), `src/cliprec.js`, `src/clipsui.js`, test `tests/clips.test.js`. FFmpeg est téléchargé à la fabrication (`vendor/`, workflow).

## Liaison USB avec l'écran
- **Comment** : Web Serial à 921 600 bauds, une ligne JSON par message, liaison gardée ouverte. Détail des messages : `PROTOCOLE.md`.
- **Code** : `src/app.js` (`deckLink`, `deckOpen`, `deckReadLoop`, `onDeckMessage`, `sendToDeck`, `deviceConfig`).

## Sécurité des codes
- **Code** : `main.js` (`SECRETS`, `sealSecrets`, `openSecrets`, `sealExistingFiles`). Voir `docs/adr/0003-chiffrement-dpapi.md`.

## Mise à jour et copie unique
- **Ce que ça fait** : une seule copie du logiciel tourne ; une version plus récente ferme l'ancienne.
- **Code** : fin de `main.js` (`requestSingleInstanceLock`, `newer`).

## Programme de l'écran (étape 1 « Bonjour »)
- **Ce que ça fait** : l'écran s'allume, affiche « THE DECK », la version du programme, un bouton « Touche-moi » qui compte les appuis et un point qui suit le doigt (pour vérifier le tactile).
- **Comment** : ESP-IDF 5.5 + LVGL 9 avec la bibliothèque Waveshare de la carte 7B (écran EK79007 1024 × 600, tactile GT911). GitHub Actions le fabrique en deux versions (puces ESP32-P4 v3 et v1.x, `sdkconfig.defaults.rev3` / `.rev1`) et le range dans le `.exe` (`src/firmware/ecran-rev3.bin`, `ecran-rev1.bin`, `ecran.json`). Choix « l'écran affiche des images préparées par le logiciel » : `docs/adr/0005-ecran-affiche-des-images.md`.
- **Code** : `firmware/` (`main/main.c`, `partitions.csv` : deux emplacements de programme + espace `pages`, `version.txt`), `.github/workflows/fabriquer-exe.yml` (tâche `ecran`).

## Installer le programme de l'écran (page Appareil)
- **Ce que ça fait** : bouton « Installer le programme de l'écran ». L'écran branché sur sa prise « USB TO UART », le logiciel reconnaît la puce, choisit la bonne version (v3 ou v1.x), l'installe avec une barre de progression et redémarre l'écran. Aucune page internet.
- **Comment** : esptool-js (assemblé par GitHub dans `src/vendor/esptool.js`) par le port série de Chromium (`navigator.serial`). `main.js` lit les fichiers du programme (`fw:info`, `fw:read`, seulement `ecran-rev1.bin` / `ecran-rev3.bin`) et choisit la prise « USB TO UART » (ponts WCH, Silicon Labs, FTDI) quand on installe.
- **Code** : `src/flasher.js` (`fwInstall`, `flasherPanel`, `fwFileFor`), `main.js` (`select-serial-port`, `fw:info`, `fw:read`), `preload.js`. Tests : `tests/ecran.test.js`.
