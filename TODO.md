# TODO — The Deck

Relu au début de chaque session, mis à jour à la fin.

## Fait

- Logiciel Electron « The Deck » (anciennement Cockpit Deck), fabrication du `.exe` par GitHub Actions.
- Espaces, pages, cases (photo + pictogramme + nom combinables, contour par case), catégories personnelles.
- Écran d'accueil (5 espaces par page), glisser gauche/droite (pages) et haut/bas (espaces), bouton Accueil.
- Apparence (fond couleur ou photo, couleurs, thèmes), simulateur « Aperçu de l'écran ».
- Ouvrir une appli sur le bon écran, OBS (scènes, sons, live, enregistrement, replay).
- Discord (micro, casque, micro + casque, entrées/sorties, raccourcis), codes chiffrés DPAPI.
- Spotify : lecteur avec jaquette (commandes multimédia de Windows), envoyé en direct à l'écran.
- Soundboard : sorties Moi / Discord / Jeu / Stream, page Sorties audio (VB-CABLE, Sonar).
- Clips (v1.1.0) : enregistreur intégré FFmpeg, mémoire 15 s à 5 min, clip, vidéo, capture, « Mes clips ».
- Liaison USB permanente (protocole JSON, `PROTOCOLE.md`).
- Logo (piste 2 « Profil », version sombre), notice PDF, modèle 3D du boîtier (cadre gravé, pied à lamelles).
- Mise en place du suivi : `CLAUDE.md`, `TODO.md`, `docs/`, ADR, premier test automatique.

## En cours

- Passage à Claude Code sur le PC (étapes 2 et 3 du prompt : installation, git). Recommandé : Claude Code directement sous Windows. À confirmer : choix Windows ou WSL, et l'abonnement.
- Tester la version 1.1.0 sur le vrai PC (voir `docs/tests-manuels.md`), surtout les clips.

## À faire

- Programme de l'écran (firmware ESP32-P4) : affichage, manette + clavier USB, protocole de `PROTOCOLE.md` (config, media, clips, soundboard).
- Twitch : marqueurs, clips, pub, titre du live.
- Boîtier définitif : il faut les photos et les mesures de la carte.
- Idées en attente (à choisir) : curseurs SteelSeries Sonar, mélangeur de volume Windows, macros, surveillance du PC, retour d'état OBS sur les cases.
- Découper `src/app.js` en plusieurs fichiers (plus facile à lire et moins coûteux).
