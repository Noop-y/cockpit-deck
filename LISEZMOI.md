# The Deck 0.6 — fabriquer le fichier .exe

Ce dossier contient le logiciel The Deck complet. Il faut le transformer une fois en fichier `.exe` pour Windows. Deux façons, au choix.

## Méthode 1 : par GitHub, sans rien installer (conseillée)

GitHub fabrique le `.exe` pour vous sur ses ordinateurs. Comptez 10 minutes la première fois.

1. Créez un compte gratuit sur **github.com** (ou connectez-vous).
2. En haut à droite, cliquez sur **+** puis **New repository**.
3. Nom : `cockpit-deck`. Choisissez **Private**. Cliquez sur **Create repository**.
4. Sur la page qui s'ouvre, cliquez sur le lien **uploading an existing file**.
5. Décompressez le fichier zip sur votre PC. Ouvrez le dossier `cockpit-deck`, sélectionnez **tout son contenu** (y compris le dossier `.github`) et faites-le glisser dans la page GitHub.
6. Attendez la fin de l'envoi, puis cliquez sur **Commit changes**.
7. Cliquez sur l'onglet **Actions** en haut. Une fabrication « Fabriquer The Deck pour Windows » démarre. Elle dure environ 5 minutes.
8. Quand la pastille devient verte, cliquez sur cette ligne. En bas, dans **Artifacts**, cliquez sur **The-Deck-Windows** pour télécharger un zip.
9. Dans ce zip, il y a deux fichiers :
   - `The-Deck-Installation-0.6.0.exe` : installe le logiciel (raccourci sur le bureau, lancement avec Windows).
   - `The-Deck-Portable-0.6.0.exe` : se lance directement, sans installation.

Pour une nouvelle version, il suffit de renvoyer les fichiers modifiés dans le même dépôt : GitHub refabrique le `.exe` tout seul.

## Méthode 2 : sur votre PC

1. Installez **Node.js** (version « LTS ») depuis **nodejs.org**, avec les options proposées par défaut.
2. Décompressez le zip, ouvrez le dossier `cockpit-deck`.
3. Cliquez dans la barre d'adresse de l'explorateur, tapez `cmd` puis Entrée. Une fenêtre noire s'ouvre dans ce dossier.
4. Tapez `npm install` puis Entrée. Attendez la fin (quelques minutes).
5. Pour essayer le logiciel tout de suite : `npm start`.
6. Pour fabriquer les `.exe` : `npm run dist`. Ils apparaissent dans le dossier `dist`.

## Au premier lancement

Windows peut afficher « Windows a protégé votre ordinateur », car le logiciel n'est pas signé par un éditeur connu. Cliquez sur **Informations complémentaires**, puis **Exécuter quand même**.

## Ce qui marche dans cette version

- Mes espaces : créer (modèles Star Citizen, Elite Dangerous, Flight Simulator, Bureau, OBS, ou grille vide), renommer, dupliquer, exporter, importer, supprimer, afficher ou masquer sur l'accueil.
- Pages et cases : nom libre, pictogramme du catalogue, photo recadrée ou texte seul, couleur, action, comportement (appui, maintenir, bascule).
- Catégories personnelles : bouton « + Nouvelle catégorie » dans Mes espaces (nom, couleur, pictogramme), en plus de Jeux, Bureau, Streaming et Discord. Un espace peut changer de catégorie (menu ⋯).
- Écran d'accueil : ordre et espaces affichés, 5 espaces par page ; au-delà, l'accueil a plusieurs pages.
- Glisser le doigt vers la gauche ou la droite pour passer à la page suivante ou précédente, dans un espace comme sur l'accueil (réglable dans Appareil, avec retour à la première page en option). À essayer dans « Aperçu de l'écran ».
- Apparence : fond (couleur ou photo), couleurs des cases au repos et appuyées, thèmes prêts.
- Aperçu de l'écran : un simulateur pour essayer ses pages avant d'avoir l'écran.
- Ouvrir une appli sur l'écran de gauche ou de droite, en plein écran ou sur une moitié (bouton Tester).
- OBS : connexion, liste des scènes et des sources, changement de scène, sons, éléments, live, enregistrement, replay (bouton Tester).
- Sauvegardes automatiques et restauration.
- Espace Discord sur l'accueil (comme Star Citizen, Bureau, Stream) : micro seul, casque seul, micro + casque, entrée ou sortie suivante, ouvrir Discord, et vos propres raccourcis. Dans l'espace : commandes en direct, listes des entrées et sorties audio, bouton « Créer une page AUDIO avec mes appareils ».

## Discord : la connexion, à faire une fois

1. Ouvrez discord.com/developers/applications, cliquez sur **New Application**, nommez-la « The Deck ».
2. Dans **OAuth2** : copiez le **Client ID**, cliquez sur **Reset Secret** et copiez le **Client Secret**.
3. Toujours dans OAuth2, sous **Redirects**, ajoutez `http://localhost` puis **Save Changes**.
4. Dans The Deck, menu **Connexions**, partie Discord : collez les deux codes, cliquez sur **Connecter**, puis sur **Autoriser** dans la fenêtre de Discord.

Le casque seul est coupé en mettant le volume de sortie de Discord à zéro (Discord ne sait pas couper le son sans couper le micro), puis remis comme avant.

## Ce qui viendra avec le programme de l'écran

L'envoi sur l'écran utilise le câble USB. Il fonctionnera quand le programme de la carte ESP32-P4 (micrologiciel) sera installé. D'ici là, le logiciel affiche « l'écran n'a pas répondu », ce qui est normal.

Twitch (clips, marqueurs, pub, titre) arrivera dans une prochaine version.

## Sécurité des codes

Le mot de passe OBS, le Client Secret Discord et l'autorisation Discord sont enregistrés chiffrés par Windows (DPAPI) : seule votre session Windows, sur ce PC, peut les relire. Ils ne sont jamais mis dans un espace exporté, ni envoyés à l'écran tactile. Le logiciel ne contacte qu'un seul site, discord.com, en HTTPS, pour obtenir l'autorisation Discord. Aucun mot de passe de compte Discord n'est demandé.

## Où sont mes réglages ?

Dans `%APPDATA%\The Deck\config.json`, avec les sauvegardes dans le dossier `sauvegardes` à côté. Menu Paramètres › Ouvrir le dossier.
