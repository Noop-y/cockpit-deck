# Tests à faire à la main (sur le PC Windows)

Ces parties dépendent de Windows, de l'USB ou d'autres logiciels : elles ne peuvent pas être testées automatiquement. Cochez (`[x]`) au fur et à mesure et notez ce qui ne va pas.

## Installation et démarrage
- [ ] Le `.exe` d'installation s'installe ; le logiciel s'ouvre avec la bonne version dans le titre.
- [ ] Une ancienne version restée ouverte près de l'horloge se ferme toute seule quand on lance la nouvelle.
- [ ] Fermer la fenêtre la cache près de l'horloge ; clic droit › Quitter l'arrête.

## Clips (version 1.1.0)
- [ ] Menu Clips : la pastille indique la carte graphique (NVIDIA, AMD ou Intel).
- [ ] « Mémoire en marche » sur **Toujours** : la pastille passe à « Mémoire en marche » en quelques secondes.
- [ ] Aperçu de l'écran › espace Clips › **CLIP** au bout de 30 s : le bandeau vert apparaît et un fichier arrive dans `Vidéos\The Deck\Clips`.
- [ ] Le clip se lit (menu Mes clips › Lire) : image fluide, **son du PC présent**, **voix présente**, image et son bien calés.
- [ ] Pendant Star Citizen (programme `StarCitizen.exe` indiqué dans l'espace) avec « Le jeu » : seule la fenêtre du jeu est filmée ; pas de perte d'images en jeu.
- [ ] « Pendant un jeu » : la mémoire démarre seule au lancement de Star Citizen et s'arrête quand on le quitte.
- [ ] Avec SteelSeries Sonar : « Le son du PC vient de » › Sonar – Stream, « Ma voix » coupée : Discord et la musique sont dans le clip.
- [ ] ENREGISTRER puis ARRÊTER : un fichier « (vidéo) » de la bonne durée.
- [ ] Qualité **1800p** et **4K** (avec un écran assez grand) : clip net, le jeu ne ralentit pas ; un clip de 1 min à 60 images/s fait environ 420 Mo en 1800p, 540 Mo en 4K.
- [ ] **120** et **144 images/s** (écran 144 Hz) en 1440p : clip fluide, pas de saccade ni de ralentissement du jeu. Essayer aussi 1800p / 4K à 120 : vérifier que la carte graphique suit (sinon, le noter).
- [ ] Une ancienne configuration réglée en 720p ou 30 images/s repasse toute seule en 1080p / 60 images/s.
- [ ] CAPTURE : une image PNG nette.
- [ ] Mes clips : Couper le début / la fin, Renommer, Voir dans le dossier, Copier puis Ctrl+V dans Discord, Supprimer (part dans la corbeille).
- [ ] Une case Clip dans Star Citizen (« Clips (clip, vidéo, capture) ») marche avec le bouton Tester.

## Favoris et déplacement des cases (version 1.1.1)
- [ ] L'espace Favoris apparaît en premier (Mes espaces et accueil), même avec une ancienne configuration.
- [ ] « ☆ Ajouter aux favoris » sur une case Star Citizen, Discord, Clips et sur un son de la soundboard : chaque copie arrive dans Favoris et marche (bouton Tester, aperçu de l'écran, puis sur l'écran).
- [ ] Recliquer « ★ Dans les favoris » retire la copie.
- [ ] Éditeur : rester appuyé sur une case, la glisser sur une autre, relâcher : elles échangent leur place. Glisser sur un onglet de page : la case part dans cette page (message si la page est pleine).
- [ ] Un clic simple sur une case la sélectionne toujours (pas de déplacement par erreur).

## Soundboard
- [ ] Sorties audio : VB-CABLE détecté après installation et redémarrage.
- [ ] Un son coché Moi s'entend dans le casque ; coché Discord, les amis l'entendent avec la voix ; coché Stream, il passe dans OBS.

## Spotify
- [ ] Le morceau en cours et la jaquette s'affichent ; précédent, suivant, lecture/pause et volume marchent.

## Discord
- [ ] Connexion (Client ID + Secret, Autoriser) ; micro, casque, micro + casque ; changement d'entrée et de sortie.
- [ ] « Se déconnecter » efface l'autorisation.

## OBS
- [ ] Connexion ; changer de scène, couper un son, live, enregistrement, replay.

## Applis et fenêtres
- [ ] « Ouvrir une appli » place la fenêtre sur le bon écran et la bonne moitié.

## Sécurité
- [ ] Dans `%APPDATA%\The Deck\config.json`, le mot de passe OBS et le Client Secret commencent par `dpapi:` (jamais en clair).
- [ ] Un espace exporté (`.deck`) ne contient aucun de ces codes.

## Programme de l'écran — étape 1 « Bonjour »
- [x] Page Appareil : « Version fournie avec ce logiciel : 0.1.0 » s'affiche (version fabriquée par GitHub).
- [x] Écran branché sur sa prise **« USB TO UART »** : « Installer le programme de l'écran » trouve l'écran sans fenêtre de choix, la barre avance jusqu'à 100 %, message « Programme version 0.1.0 installé (puce v…) ». Noter la version de puce affichée : v3.2 (13/11/2026). Il a fallu BOOT + RESET à la main ; à 921 600 bauds la liaison coupait (réglé à 115 200).
- [ ] Si Windows ne reconnaît pas la prise (rien ne se passe) : installer le pilote WCH CH343 et réessayer.
- [x] L'écran redémarre et affiche « THE DECK » en ambre, « Programme de l'ecran - version 0.1.0 », le bouton « Touche-moi ».
- [x] Toucher le bouton : il devient ambre pendant l'appui, le compteur augmente de 1 à chaque appui.
- [ ] Version 0.1.1 : l'image est à l'endroit quand les prises de la carte sont à **gauche** (comme dans le boîtier).
- [ ] Poser le doigt en haut à gauche, puis en bas à droite : le point ambre apparaît **sous le doigt** (et pas à l'opposé). Coordonnées affichées proches de x 0 y 0, puis x 1023 y 599.
- [ ] Débrancher / rebrancher : l'écran redémarre tout seul sur le même écran.

## Programme de l'écran — étape 2 « USB » (0.2.0)
- [ ] Installer le programme 0.2.0 (prise « USB TO UART », BOOT + RESET, Installer).
- [ ] Brancher le câble sur la prise **« USB »** (celle du milieu) : Windows fait le petit son d'appareil branché ; l'écran affiche « USB : reconnu par le PC » en vert.
- [ ] Gestionnaire de périphériques : un port COM « The Deck - liaison » (ou « Périphérique série USB »), un clavier et un contrôleur de jeu HID.
- [ ] Bloc-notes ouvert, bouton « Ecrire deck » : le mot `deck` s'écrit.
- [ ] Bouton « Volume + » : le volume de Windows monte (bandeau du volume).
- [ ] `Win + R` › `joy.cpl` › The Deck › Propriétés : le bouton 1 s'allume tant qu'on appuie sur « Manette : bouton 1 ».
- [ ] Logiciel, page Appareil › « Relier l'écran » : l'écran est choisi tout seul ; « Écran relié en USB · programme de l'écran 0.2.0 ». Sur l'écran : « Logiciel The Deck : relié (version 1.1.1) » en vert.
- [ ] Débrancher : l'écran (alimenté par l'autre prise) repasse à « pas relié » ; le logiciel aussi.

## Écran (étapes suivantes du programme de l'ESP32-P4)
- [ ] Envoi sur l'écran : réponse OK, sauvegarde créée.
- [ ] Les messages `media`, `clips` arrivent ; les appuis envoient `sound`, `clip`.
