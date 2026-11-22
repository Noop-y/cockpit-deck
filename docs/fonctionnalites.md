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
- **Ce que ça fait** : l'écran s'allume (image retournée de 180° : les prises de la carte sont à gauche vu de face, comme dans le boîtier), affiche « THE DECK », la version du programme, un bouton « Touche-moi » qui compte les appuis et un point qui suit le doigt (pour vérifier le tactile).
- **Comment** : ESP-IDF 5.5 + LVGL 9 avec la bibliothèque Waveshare de la carte 7B (écran EK79007 1024 × 600, tactile GT911). GitHub Actions le fabrique en deux versions (puces ESP32-P4 v3 et v1.x, `sdkconfig.defaults.rev3` / `.rev1`) et le range dans le `.exe` (`src/firmware/ecran-rev3.bin`, `ecran-rev1.bin`, `ecran.json`). Choix « l'écran affiche des images préparées par le logiciel » : `docs/adr/0005-ecran-affiche-des-images.md`.
- **Code** : `firmware/` (`main/main.c`, `partitions.csv` : deux emplacements de programme + espace `pages`, `version.txt`), `.github/workflows/fabriquer-exe.yml` (tâche `ecran`).

## Installer le programme de l'écran (page Appareil)
- **Ce que ça fait** : bouton « Installer le programme de l'écran ». L'écran branché sur sa prise « USB TO UART », le logiciel reconnaît la puce, choisit la bonne version (v3 ou v1.x), l'installe avec une barre de progression et redémarre l'écran. Aucune page internet.
- **Comment** : esptool-js (assemblé par GitHub dans `src/vendor/esptool.js`) par le port série de Chromium (`navigator.serial`). `main.js` lit les fichiers du programme (`fw:info`, `fw:read`, seulement `ecran-rev1.bin` / `ecran-rev3.bin`) et choisit la prise « USB TO UART » (ponts WCH, Silicon Labs, FTDI) quand on installe.
- **Code** : `src/flasher.js` (`fwInstall`, `flasherPanel`, `fwFileFor`), `main.js` (`select-serial-port`, `fw:info`, `fw:read`), `preload.js`. Tests : `tests/ecran.test.js`.

## Programme de l'écran — étape 2 « USB » (0.2.2)
- **Ce que ça fait** : branché sur sa prise « USB » (celle du milieu), l'écran est reconnu par Windows sans pilote comme **The Deck** : clavier (touches F13–F24 et lettres), touches multimédia (volume, lecture…), manette de 32 boutons, et liaison série avec le logiciel. L'écran de test montre si l'USB et le logiciel sont reliés, et a quatre boutons d'essai : « Ecrire deck », « Volume + », « Manette : bouton 1 », « Touche F13 ».
- **Comment** : esp_tinyusb 3 sur le port USB pleine vitesse de l'ESP32-P4 (la prise Type-C « USB » de la carte 7B ; le port haute vitesse va à la prise Type-A « USB-OTG »). La prise « USB » est câblée au petit PHY n° 0 (GPIO 24/25), donné par défaut à USB-Serial-JTAG : le programme l'échange avec celui de l'USB OTG (`usb_wrap_ll_phy_select`). Un seul appareil composite (VID 0x303A, PID 0x81D3) : une interface série (CDC) + une interface HID à trois rapports (1 clavier, 2 multimédia, 3 manette). Les appuis passent par une file et une tâche qui attend que l'USB soit prêt. Le logiciel dit bonjour toutes les 3 s (`{"t":"hello"}`) ; l'écran répond avec sa version, affichée dans la page Appareil. Un envoi `config` reçoit `ERR … (etape 3)` en attendant les pages en images.
- **Code** : `firmware/main/usb_deck.c` (descripteurs, HID, CDC, bonjour), `firmware/main/main.c` (écran de test), `src/app.js` (`deckHello`, `onDeckMessage` : `hello`, action `deck-link`, page Appareil).

## Mise à jour du programme de l'écran par le câble (0.3.0)
- **Ce que ça fait** : écran relié au logiciel par sa prise « USB » (le câble habituel), page Appareil › « Mettre à jour l'écran par le câble USB ». La barre avance, l'écran affiche « Mise a jour du programme : N % », puis redémarre sur la nouvelle version et se relie tout seul. Plus besoin de la prise « USB TO UART » ni de BOOT + RESET (elle reste pour la première installation et en secours).
- **Comment** : messages `fw-begin` / `fw-data` (morceaux de 8 Ko en base64, un accusé `fw-ack` par morceau) / `fw-end` sur la liaison série (`PROTOCOLE.md`). L'écran écrit dans l'emplacement de programme libre (`esp_ota_*`), vérifie l'image, la choisit et redémarre. La fabrication GitHub range aussi le programme seul (`app-rev3.bin`, `app-rev1.bin`) dans le logiciel. Les lignes reçues sont traitées par une tâche à part (`lines_task`) pour ne pas bloquer l'USB pendant l'écriture en flash.
- **Code** : `firmware/main/usb_deck.c` (`ota_line`, `lines_task`), `src/flasher.js` (`fwUpdateCable`, `fwWaitMsg`, `fwOlder`), `main.js` (`fw:read` accepte `app-rev*.bin`).

## Programme de l'écran — étape 3 « pages en images » (0.4.0)
- **Ce que ça fait** : « Envoyer sur l'écran » dessine chaque page (accueil, puis chaque page des espaces de l'accueil) exactement comme dans « Aperçu de l'écran », à 1024 × 600, et l'envoie à l'écran par le câble USB. L'écran garde les pages dans sa mémoire flash (elles reviennent après débranchement) et réagit aux appuis : bouton de manette, touche ou raccourci clavier, touche multimédia, touche réservée F13–F24 pour les actions du PC (appli, OBS, Discord, clips), changement de page (onglets, bouton Accueil, cartes de l'accueil, cases « Changer de page »), sons et boutons de l'espace Clips (message au logiciel). Un contour de la couleur d'accent montre la case appuyée ; « Maintenir » remplit une barre puis déclenche ; « Bascule » garde le contour allumé.
- **Comment** : le logiciel pose le HTML de l'aperçu dans une fenêtre invisible (`src/rendu.html`, ouverte par `main.js`, IPC `deck:render`), en prend une photo JPEG et relève la place des zones à toucher (`data-simcell`, `data-sim`, `data-simbtn`, `data-simclip`). `src/deckpack.js` donne à chaque zone ce qu'elle fait, puis range tout dans un paquet binaire (format dans `PROTOCOLE.md`) envoyé par morceaux de 8 Ko (`pg-begin` / `pg-data` / `pg-end`, somme de contrôle CRC-32). L'écran écrit le paquet dans l'espace `pages`, n'y met la marque « DECK » qu'à la fin (des pages à moitié reçues ne servent jamais), puis décode les images avec le décodeur JPEG matériel de l'ESP32-P4.
- **Glisser le doigt** (0.4.1) : chaque page du paquet dit où mène un glissement vers la gauche, la droite, le haut et le bas (`pgNav`, mêmes règles que l'aperçu et les réglages de la page Appareil) ; l'écran annule la case touchée dès que le doigt glisse de plus de 30 px.
- **Pas encore** (étape 4) : luminosité et mise en veille, et ce qui bouge (jaquette du lecteur, chrono des clips, cases cochées de la soundboard).
- **Code** : `src/deckpack.js`, `src/rendu.html`, `main.js` (`deck:render`), `src/app.js` (`sendToDeck`), `firmware/main/pages.c`, `firmware/main/usb_deck.c` (`usb_deck_combo`, aiguillage `pg-*`). Tests : `tests/pages.test.js`.

## Découper un son de la soundboard
- **Ce que ça fait** : quand on ajoute un seul son (glissé sur la grille, « Importer des sons… » ou « Remplacer… »), la fenêtre « Découper le son » s'ouvre. On écoute tout le son ou le passage, une barre blanche suit la lecture, et « Début ici » / « Fin ici » posent les poignées à l'endroit entendu. On peut aussi tirer les deux poignées ambre (en les lâchant, on entend l'endroit choisi), régler à 0,1 s près, zoomer à la molette. « Valider le passage » : la case ne joue plus que ce passage (sur le PC et depuis l'écran). Toujours modifiable ensuite : bouton « Découper le son… » ou clic sur la forme du son dans les réglages de la case. Case à cocher pour ne plus ouvrir la fenêtre à chaque ajout (`cfg.audio.cutOnAdd`).
- **Comment** : le fichier n'est pas modifié ; la case garde `action.start` et `action.end` (secondes), déjà utilisés par le moteur `sound.js`. La forme du son est calculée depuis le son décodé (`cutPeaks`), recalculée quand on zoome. L'écoute passe par `SOUND.preview` (seulement dans le casque de l'utilisateur).
- **Code** : `src/soundcut.js` (fenêtre, poignées, écoute), `src/app.js` (`addSounds`, `snd-replace`, `soundPanel`). Tests : `tests/soundcut.test.js`.

## Stock d'électronique — étape 1 : dans le logiciel (22/11/2026)
- **Ce que ça fait** : onglet « Stock ». Des catégories (nom affiché, endroit réel, couleur) ; pour chacune, un interrupteur « Diviser en sous-catégories » : oui = des sous-catégories (les tiroirs de l'écran), non = les pièces directement dans la catégorie. Basculer l'interrupteur ne perd aucune pièce. Chaque pièce : nom, quantité (− / + ou saisie), seuil « stock bas » (orange en dessous, rouge à 0), lien d'achat. Le stock est enregistré avec la configuration et dans les sauvegardes ; il n'est ni dans les espaces exportés ni envoyé à l'écran pour l'instant.
- **Comment** : `cfg.stock = { cats, history }` (forme dans l'en-tête de `src/stock.js`), remis en ordre par `stockNorm()` dans `migrate()` (ancienne configuration = stock vide). Les champs s'enregistrent pendant la frappe (`commit(true)`) ; la page se redessine en quittant le champ, après la fin du clic.
- **À venir** : étape 2, le stock sur l'écran (rangements, tiroirs, − / + au doigt, mise à jour en direct) ; étape 3, l'accès de Claude (lecture + propositions validées sur l'écran, historique, Annuler, case Aide avec les phrases).
- **Code** : `src/stock.js`, `src/styles.css` (« Stock »), `src/app.js` (menu, `defaultConfig`, `migrate`). Tests : `tests/stock.test.js`.

## Stock d'électronique — étape 2 : sur l'écran (22/11/2026, écran 0.5.0)
- **Ce que ça fait** : un espace « Stock » sur l'accueil (ajouté tout seul). À gauche les catégories (7 au plus), à droite les tiroirs (12 par page, ‹ › pour la suite) ou, sans sous-catégorie, directement les pièces avec − / +. Toucher un tiroir l'ouvre en grand avec ses pièces (12 par page) et − / + ; ✕ ou toucher à côté le referme. Pastille et couleurs : orange stock bas, rouge épuisé.
- **Comment** : chaque vue (catégorie, tiroir ouvert, suite) est une page du paquet (`stockViews`, clé `stock:<espace>:<cat>:<tiroir|->:<suite>`), dessinée par `deckStock`. Les − / + envoient `{"t":"stock",…}` ; le logiciel change la quantité puis `pgLiveRefresh()` redessine les pages du stock qui ont changé et les envoie une par une (`pi-*`). Un changement fait dans le logiciel suit le même chemin (après 1,2 s sans frappe). Si des pages apparaissent ou disparaissent (catégorie, tiroir, plus de 12 pièces), tout le paquet est renvoyé 3 s après.
- **Nombre instantané (écran 0.5.1)** : chaque quantité est une zone « compteur » (type 6) et chaque − / + sait quel compteur il change (`pgLinkCounters`). L'écran change donc le nombre lui-même dès le toucher (`draw_counters()` dans `firmware/main/pages.c`), sans attendre l'image du logiciel ; l'image qui arrive ensuite (`pi-end` avec les vrais nombres) remet tout d'accord.
- **Code** : `src/stock.js` (`deckStock`, `stockViews`, `stockFromDeck`, `simStock`), `src/deckpack.js` (pages du stock, `pgLiveRefresh`, `pgSendPage`, `pgOnHello`), `firmware/main/pages.c` (`pi_line`, images en direct). Tests : `tests/stock.test.js`.

## Stock d'électronique — étape 3 : Claude (22/11/2026, écran 0.5.2)
- **Ce que ça fait** : Paramètres › Claude › « Relier Claude » ajoute The Deck à l'application Claude de ce PC (puis redémarrer Claude). Dans Claude, avec les phrases convenues (« Projet terminé : … », « Commande reçue : … », « Annule la dernière validation », « Qu'est-ce que je dois commander ? »), Claude lit le stock et peut **proposer** un changement. La proposition s'affiche sur l'écran (fenêtre « Proposition de Claude », VALIDER / REFUSER) et dans l'onglet Stock ; rien ne change sans VALIDER. L'onglet Stock garde un historique avec « Annuler ». Une case « AIDE » sur l'écran du stock rappelle les phrases.
- **Comment** : l'application Claude lance `lien-claude.js` (copié depuis `src/` dans le dossier de The Deck) avec le programme de The Deck en mode Node (`ELECTRON_RUN_AS_NODE`). C'est un petit connecteur MCP avec trois outils : `lire_stock`, `proposer_changement`, `etat_proposition`. Il parle au logiciel par un tuyau Windows (`main.js` : `startClaudePipe`, `claudeAsk`), qui passe la question à l'interface (`stock.js` : `stockClaudeOp`). Vérifications et calculs dans des fonctions testées : `stockPropBuild`, `stockPropApply`, `stockUndo`, `stockForClaude`. La proposition est dessinée sur la première page du stock (`stockPropPop`) et montrée avec `pg-show`. Les réglages de Claude (`claude_desktop_config.json`, version classique ou Microsoft Store) sont copiés une fois en `.avant-the-deck` avant d'être modifiés ; « Délier » retire l'entrée.
- **Limites** : seulement avec l'application Claude installée sur le même PC, The Deck ouvert, et la version « Installation » de The Deck (la Portable change de dossier à chaque lancement).

## Clips sur l'écran : l'écran suit les appuis (22/11/2026)
- **Ce que ça fait** : sur l'écran, les cases de l'espace Clips (retour en arrière, on filme, ma voix, mémoire) changent tout de suite, et un message de quelques secondes dit ce qui s'est passé (« On filme le jeu », « Retour en arrière : 5 min », « Clip en cours… · on filme le jeu (Star Citizen) », « Clip enregistré »). Une case Clip posée dans un autre espace affiche aussi ces messages.
- **Comment** : depuis que l'écran affiche des images, il faut redessiner la page. `pgLiveable()` (`deckpack.js`) range dans les pages « en direct » le stock, l'espace Clips et les pages qui ont une case Clips ; `refreshClipsUI()` et `clipToast()` (`clipsui.js`) appellent `pgLiveRefresh()`, qui n'envoie que les pages changées (`pi-*`). Les changements que personne n'a demandés (la mémoire qui démarre…) ne renvoient jamais tout le paquet (`quiet`). `clipSrcText()` dit en clair ce qui est filmé.
- **Choix instantanés (écran 0.5.3)** : « RETOUR EN ARRIÈRE » et « ON FILME » sont aussi des zones « choix » (type 7) : l'écran connaît la liste (« 15 s|30 s|… », « LE JEU|L'ECRAN ») et passe au suivant dès l'appui (`draw_counters`, `choix_get` dans `pages.c` ; `clipChoice` dans `clipsui.js`). L'image du logiciel confirme ensuite. Correction importante de 0.5.3 : l'écran ignorait jusque-là les images en direct (`pi-*` pas transmis par `usb_deck.c`) ; c'est pour ça que rien ne bougeait.
- **Filmer l'écran sans jeu** : avec « Pendant un jeu », la mémoire n'attend un jeu que si on filme le jeu. Si on filme l'écran (bureau, stream), elle tourne tout le temps (`memWhen()` dans `clips.js`).
- **Son vers FFmpeg (22/11/2026)** : le son passe du logiciel à FFmpeg par une liaison locale `tcp://127.0.0.1:<port>` (`openPipe` dans `clips.js`), et plus par des tuyaux nommés Windows, que FFmpeg refusait d'ouvrir (« Error opening input files: Invalid argument »). Le test automatique des clips utilise maintenant exactement ce chemin. Si l'enregistreur est en panne, l'écran affiche « Mémoire en panne : voir Clips › Réglages sur le PC ».
- **FFmpeg récent (22/11/2026)** : la vraie panne « Error opening input files: Invalid argument » venait de l'option `-thread_queue_size` placée avant une entrée, refusée par les FFmpeg récents (c'est devenu une option de sortie). Retirée. La fabrication GitHub lance maintenant le test des clips avec le FFmpeg livré, pour voir ce genre de panne avant de livrer.

