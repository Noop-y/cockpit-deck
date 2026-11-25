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

## Programme de l'écran — étape 2 « USB » (0.2.2)
- [x] Installer le programme 0.2.2 (13/11/2026 ; prise « USB TO UART », BOOT + RESET, Installer).
- [x] Brancher le câble sur la prise **« USB »** (celle du milieu) : Windows fait le petit son d'appareil branché ; l'écran affiche « USB : reconnu par le PC » en vert.
- [ ] Gestionnaire de périphériques : un port COM « The Deck - liaison » (ou « Périphérique série USB »), un clavier et un contrôleur de jeu HID.
- [x] Bloc-notes ouvert, bouton « Ecrire deck » : le mot `deck` s'écrit.
- [x] Bouton « Volume + » : le volume de Windows monte (bandeau du volume).
- [x] `Win + R` › `joy.cpl` › The Deck › Propriétés : le bouton 1 s'allume tant qu'on appuie sur « Manette : bouton 1 ».
- [x] Logiciel, page Appareil › « Relier l'écran » : l'écran est choisi tout seul ; « Écran relié en USB · programme de l'écran 0.2.0 ». Sur l'écran : « Logiciel The Deck : relié (version 1.1.1) » en vert.
- [ ] Débrancher : l'écran (alimenté par l'autre prise) repasse à « pas relié » ; le logiciel aussi.

## Mise à jour par le câble (0.3.0)
- [ ] Installer une dernière fois par « USB TO UART » le programme 0.3.0.
- [x] Câble sur la prise « USB », « Relier l'écran » : page Appareil, « Écran relié : programme 0.3.0 (déjà à jour) » et le bouton « Réinstaller par le câble USB ».
- [x] « Réinstaller par le câble USB » : la barre avance jusqu'à 100 %, l'écran affiche « Mise a jour du programme : N % », redémarre, et le logiciel se relie tout seul (programme 0.3.0).
- [ ] Avec une version plus récente du logiciel : le bouton devient « Mettre à jour l'écran par le câble USB » (0.3.0 → nouvelle version) et l'écran redémarre sur la nouvelle version.

## Pages en images (0.4.0)
- [ ] (0.4.1) Mettre à jour l'écran par le câble, puis « Envoyer sur l'écran ». Accueil : glisser vers la gauche → 2e page de l'accueil, vers la droite → retour. Dans un espace à plusieurs pages : gauche/droite change de page ; haut/bas change d'espace. Lecteur : gauche/droite change de morceau. Un glissement qui commence sur une case ne déclenche pas la case.
- [ ] Accueil de l'écran : plus de vignette « Réglages », 6 espaces par page (Aperçu de l'écran et vrai écran après « Envoyer sur l'écran »).
- [ ] Page Appareil, écran relié : « Mettre à jour l'écran par le câble USB » (0.3.0 → 0.4.0) ; l'écran redémarre, toujours sur l'écran de test.
- [ ] « Envoyer sur l'écran » : l'écran affiche « Reception des pages : N % », la barre avance dans la page Appareil, puis l'écran montre l'accueil, identique à l'Aperçu de l'écran ; message « Envoyé sur l'écran », sauvegarde créée.
- [ ] Les couleurs sont justes (ambre reste ambre, pas bleu).
- [ ] Toucher une carte de l'accueil ouvre l'espace ; les onglets changent de page ; le bouton Accueil revient à l'accueil. Un contour ambre apparaît sous le doigt.
- [ ] Case « Bouton de manette » : visible dans joy.cpl tant qu'on appuie. Case « Maintenir » : la barre se remplit, puis l'action part. Case « Bascule » : le contour reste allumé, puis s'éteint au deuxième appui.
- [ ] Case clavier (ex. Ctrl+C dans le Bloc-notes) et touche multimédia (volume) : marchent.
- [ ] Case appli / OBS / Discord : le PC fait l'action (touche réservée).
- [ ] Débrancher puis rebrancher l'écran : les pages reviennent sans renvoi.

## Découper un son (soundboard)
- [ ] Glisser un seul fichier son sur la grille : la fenêtre « Découper le son » s'ouvre avec la forme du son.
- [ ] « Écouter tout le son » : on entend le son, la barre blanche avance au bon rythme ; « Début ici » puis « Fin ici » posent les poignées là où on en est.
- [ ] Tirer une poignée puis la lâcher : on entend le début du passage (ou les 2 dernières secondes avant la fin).
- [ ] Molette sur la forme du son : zoom ; « Tout voir » revient au son entier. Boutons −0,1 s / +0,1 s.
- [ ] « Valider le passage » : la case ne joue que ce passage (bouton Tester, Aperçu de l'écran, et sur le vrai écran) ; durée affichée sur la case.
- [ ] « Découper le son… » dans les réglages de la case rouvre la fenêtre avec le passage déjà choisi ; « Garder tout le son » revient au son entier.
- [ ] Glisser plusieurs fichiers d'un coup : pas de fenêtre, tous ajoutés. Décocher « Ouvrir cette fenêtre à chaque son ajouté » : plus de fenêtre à l'ajout.

## Écran (étapes suivantes du programme de l'ESP32-P4)
- [ ] Les messages `media`, `clips` arrivent ; les appuis envoient `sound`, `clip`.

- Note 13/11/2026 : « Touche F13 » sur l'écran a déclenché une case du logiciel réglée sur F13 (message « le programme ne s'est pas ouvert à temps ») : la touche réservée arrive bien au PC.

## Stock (étape 1 : logiciel)
- [ ] Menu « Stock » : page vide avec « + Ajouter une catégorie ».
- [ ] Créer « Composants électroniques », allumer « Diviser en sous-catégories », renommer le tiroir en « Résistances », ajouter 3 pièces (220 Ω, 10 kΩ, 47 kΩ) avec quantités et seuils ; −/+ change la quantité ; orange sous le seuil, rouge à 0.
- [ ] Taper un nom puis cliquer directement sur un bouton (ex. « + Ajouter une pièce ») : le clic marche du premier coup, le nom est gardé.
- [ ] Éteindre l'interrupteur : confirmation si plusieurs tiroirs, puis toutes les pièces sont dans la catégorie. Le rallumer : elles vont dans « Tiroir 1 ».
- [ ] Supprimer une pièce / un tiroir / une catégorie : confirmation, puis disparaît.
- [ ] Fermer et rouvrir le logiciel : tout est encore là. Paramètres › sauvegardes : le stock revient avec une sauvegarde.

## Stock (étape 2 : écran, programme 0.5.0)
- [ ] Page Appareil : « Mettre à jour l'écran par le câble USB » (0.5.0), puis « Envoyer sur l'écran ».
- [ ] Accueil de l'écran : une carte « Stock ». Elle ouvre les catégories à gauche et les tiroirs à droite (ou les pièces si pas de sous-catégorie).
- [ ] Toucher un tiroir : il s'ouvre en grand ; ✕ ou toucher à côté le referme. Plus de 12 pièces : ‹ › en bas (ou glisser).
- [ ] Toucher − sur une pièce : moins d'une seconde après, le nombre change sur l'écran ; dans le logiciel (onglet Stock), la quantité a changé aussi.
- [ ] Changer une quantité ou un nom dans le logiciel : l'écran suit (environ 2 s).
- [ ] Ajouter une catégorie ou un tiroir dans le logiciel : l'écran reçoit tout de nouveau tout seul (bandeau « Réception des pages »).
- [ ] Débrancher / rebrancher l'écran après des − / + : il reçoit tout de nouveau tout seul, les bons nombres s'affichent.

## Stock : − / + instantanés (programme 0.5.1)
- [ ] Page Appareil : « Mettre à jour l'écran par le câble USB » (0.5.1), puis « Envoyer sur l'écran ».
- [ ] Ouvrir un tiroir sur l'écran, toucher − : le nombre baisse **tout de suite** (sans attendre). Une seconde après, l'image arrive et montre le même nombre.
- [ ] Toucher + plusieurs fois vite : le nombre suit chaque toucher.
- [ ] Toucher − jusqu'à 0 : le nombre devient rouge et ne descend pas sous 0.
- [ ] Logiciel fermé : toucher − change le nombre à l'écran, puis le logiciel rouvert renvoie le vrai nombre (le stock n'a pas changé).

## Stock : Claude (logiciel + écran 0.5.2)
- [ ] Page Appareil : mettre l'écran à jour par le câble (0.5.2), puis « Envoyer sur l'écran ».
- [ ] Écran, espace Stock : la case « AIDE » ouvre la liste des phrases ; ✕ la referme.
- [ ] Paramètres › Claude : « Relier Claude » → message vert « Claude est relié ». Quitter l'application Claude (près de l'horloge) et la rouvrir.
- [ ] Dans l'application Claude (Réglages › Connecteurs, ou l'icône des outils) : « the-deck » apparaît.
- [ ] Écrire « Qu'est-ce que je dois commander ? » : Claude liste les pièces épuisées / en stock bas ; rien ne change.
- [ ] Écrire « Projet terminé : test » avec une ou deux pièces : Claude montre la liste, puis propose. La fenêtre « Proposition de Claude » s'ouvre sur l'écran (et dans l'onglet Stock).
- [ ] REFUSER : rien ne change. Refaire, puis VALIDER : les quantités changent, l'historique montre « validée ».
- [ ] Onglet Stock › Historique › « Annuler » : les quantités reviennent comme avant.
- [ ] The Deck fermé : Claude dit que le logiciel n'est pas ouvert.
- [ ] « Délier » : l'entrée disparaît de Claude après redémarrage de Claude.

## Clips sur l'écran : l'écran suit (logiciel, écran 0.5.x)
- [ ] Installer, puis « Envoyer sur l'écran » une fois.
- [ ] Espace Clips, case « RETOUR EN ARRIÈRE » : chaque appui passe à la durée suivante (15 s, 30 s, 1 min, 2 min, 3 min, 5 min, puis 15 s) ; le nombre change sur l'écran et un message « Retour en arrière : … » s'affiche environ 3 s.
- [ ] Case « ON FILME » : passe de « LE JEU » à « L'ÉCRAN » ; message « On filme le jeu » / « On filme l'écran entier ».
- [ ] Case « MA VOIX » et « MÉMOIRE » : l'écran change et un message le dit.
- [ ] Case CLIP (dans l'espace Clips, puis une case Clip dans un autre espace, ex. Star Citizen) : message « Clip en cours… · on filme … » puis « Clip enregistré » sur l'écran.

## Écran 0.5.3 : mises à jour en direct et choix instantanés
- [ ] Page Appareil : mettre l'écran à jour par le câble (0.5.3), puis « Envoyer sur l'écran ».
- [ ] Clips › « RETOUR EN ARRIÈRE » : la durée change **au moment de l'appui** (15 s → 30 s → 1 min → 2 min → 3 min → 5 min → 15 s). Une seconde après, l'image du logiciel arrive avec la même durée (police un peu différente pendant ce temps : normal).
- [ ] Clips › « ON FILME » : « LE JEU » ↔ « L'ECRAN » au moment de l'appui, puis le message « On filme… ».
- [ ] Stock : − / + changent le nombre tout de suite, et l'image du logiciel suit (avant 0.5.3, elle n'arrivait jamais).

## Clips : filmer l'écran sans jeu lancé
- [ ] Réglages des clips : « Quand la mémoire tourne » = Pendant un jeu. Sur l'écran, « ON FILME » = L'ÉCRAN, aucun jeu lancé.
- [ ] Quelques secondes après, l'état dit « Mémoire en marche · … · écran entier » (et plus « en attente d'un jeu »).
- [ ] Toucher CLIP : « Clip enregistré » ; le clip montre le bureau.
- [ ] Repasser « ON FILME » sur LE JEU sans jeu lancé : la mémoire attend de nouveau un jeu.
- [ ] Clips › Réglages : plus de message « L'enregistreur ne démarre pas : Error opening input files » ; l'état passe à « Mémoire en marche ». Si Windows demande l'autorisation du pare-feu pour The Deck, accepter (liaison interne au PC seulement).

## Accueil : cases en transparence
- [ ] Apparence : mettre une photo en fond. « Envoyer sur l'écran ». Sur l'accueil de l'écran, le fond se voit à travers les cases (Favoris, Soundboard, Clips…), et les noms restent lisibles.

## Soundboard sur l'écran (écran 0.5.4)
- [ ] Page Appareil : mettre l'écran à jour (0.5.4), puis « Envoyer sur l'écran ».
- [ ] Soundboard : toucher JEU → la coche se remplit tout de suite, puis la case s'allume. Retoucher → décoché. Pareil pour MOI, DISCORD, STREAM.
- [ ] Un son avec DISCORD coché : un ami l'entend ; décoché : il ne l'entend plus.
- [ ] En haut, − / + : « VOLUME DES SONS » change tout de suite (de 10 en 10, s'arrête à 0 % et 100 %) ; le son suivant est plus faible / plus fort pour toi ET dans Discord. La page Sorties audio montre le même « Volume général des sons ».
- [ ] « Stop tout » coupe les sons en cours.
- [ ] Apparence › « Écran d'accueil · cases » : Transparentes / Un peu / Opaques ; après « Envoyer sur l'écran », l'accueil suit le choix. Le choix reste après avoir fermé et rouvert le logiciel.

## Soundboard : push-to-talk du jeu (écran 0.5.5)
- [ ] Page Appareil : écran en 0.5.5, puis « Envoyer sur l'écran ».
- [ ] Sorties audio › Jeu › « Votre micro dans le jeu » : Push-to-talk ; cliquer dans le champ, taper V, « Enregistrer » → « Touche enregistrée : V ». Détection de la voix : plus de champ de touche, l'écran n'appuie sur rien.
- [ ] En jeu (Star Citizen, push-to-talk sur V), soundboard avec JEU coché : toucher un son sans appuyer sur V → les autres joueurs l'entendent ; l'icône de micro du jeu s'allume pendant le son et s'éteint après.
- [ ] « Stop tout » pendant un long son : le micro du jeu s'éteint.
- [ ] Débrancher le câble pendant un son : la touche V n'est pas bloquée (relâchée au bout de 2,5 s au plus).

## Veille et PC éteint (écran 0.5.6)
- [ ] Page Appareil : écran en 0.5.6. Luminosité : bouger le curseur → l'écran change tout de suite.
- [ ] Mise en veille 15 s : ne plus toucher → l'écran s'éteint au bout de 15 s. Toucher une case : l'écran se rallume, la case ne se déclenche pas. Toucher de nouveau : la case marche.
- [ ] Jamais : l'écran reste allumé.
- [ ] Éteindre le PC (The Deck branché) : l'écran s'éteint quelques secondes après. Rallumer le PC : il se rallume.
- [ ] Mettre le PC en veille : l'écran s'éteint ; réveil du PC : il se rallume.

## Sorties audio : test du micro et écho
- [ ] Ma voix › « Tester mon micro » : je m'entends (voix + un son lancé) ; « Arrêter le test du micro » : je ne m'entends plus. Changer de page arrête aussi le test.
- [ ] Si je m'entendais en double : l'encadré « Vous vous entendez en double ? » nomme l'appareil ; « Ouvrir les réglages du son de Windows » ouvre l'onglet Enregistrement ; décocher « Écouter ce périphérique » ; « Revérifier » → « Plus rien ne vous renvoie votre voix », et plus d'écho.

