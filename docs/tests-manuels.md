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
- [ ] Une ancienne configuration réglée en 720p repasse toute seule en 1080p.
- [ ] CAPTURE : une image PNG nette.
- [ ] Mes clips : Couper le début / la fin, Renommer, Voir dans le dossier, Copier puis Ctrl+V dans Discord, Supprimer (part dans la corbeille).
- [ ] Une case Clip dans Star Citizen (« Clips (clip, vidéo, capture) ») marche avec le bouton Tester.

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

## Écran (quand le programme de l'ESP32-P4 existera)
- [ ] Envoi sur l'écran : réponse OK, sauvegarde créée.
- [ ] Les messages `media`, `clips` arrivent ; les appuis envoient `sound`, `clip`.
