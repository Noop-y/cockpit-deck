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
- Version 1.1.1 : clips en 1080p, 1440p, 1800p ou 4K, à 60, 120 ou 144 images/s ; espace Favoris (« Ajouter aux favoris » sur n'importe quelle case) ; déplacer une case par appui long dans l'éditeur ; notice à jour.
- Liaison USB permanente (protocole JSON, `PROTOCOLE.md`).
- Logo (piste 2 « Profil », version sombre), notice PDF, modèle 3D du boîtier (cadre gravé, pied à lamelles).
- Mise en place du suivi : `CLAUDE.md`, `TODO.md`, `docs/`, ADR, premier test automatique.
- Boîtier : façade clipsée sans vis (12 clips), écran tenu par 4 pattes vissées ; option de déport USB-C au dos (capsule à part) ; styles essayés, modèle Colonne mis de côté (`materiel/boitier/styles/`).

## En cours

- Programme de l'écran (ESP32-P4), choix « l'écran affiche des images préparées par le logiciel » (ADR 0005). Étape 1 « Bonjour » validée sur le vrai écran le 13/11/2026 (puce ESP32-P4 v3.2, installation depuis la page Appareil à 115 200 bauds, mode BOOT + RESET à la main). Étape 2 USB validée le 13/11/2026 (0.2.2 : clavier, volume, F13 et liaison avec le logiciel OK, manette vue dans joy.cpl). Mise à jour du programme par la prise « USB » validée le 13/11/2026 (0.3.0 réinstallé par le câble, relié tout seul après le redémarrage). Étape 3a « pages en images » écrite (programme 0.4.0 + envoi par le logiciel), à tester sur le vrai écran. Ensuite : étape 3b (glisser le doigt, luminosité, mise en veille), étape 4 direct (jaquette, chrono des clips, sorties de la soundboard).

- Passage à Claude Code sur le PC (étapes 2 et 3 du prompt : installation, git). Recommandé : Claude Code directement sous Windows. À confirmer : choix Windows ou WSL, et l'abonnement.
- Activer la double vérification sur le compte GitHub (seule clé pour modifier le code) ; choisir dépôt public ou privé.
- Tester la version 1.1.1 sur le vrai PC (voir `docs/tests-manuels.md`) : clips (4K, 144 images/s), Favoris, déplacement des cases.

## À faire

- Programme de l'écran : étapes 2 à 4 (voir En cours) et nouveau message `config` en images dans `PROTOCOLE.md`.
- Twitch : marqueurs, clips, pub, titre du live.
- Boîtier : cotes validées sur l'écran reçu (pièce de test 0f) ; reste à imprimer et monter, vérifier la longueur de la nappe et la façade allumée.
- Idées en attente (à choisir) : curseurs SteelSeries Sonar, mélangeur de volume Windows, macros, surveillance du PC, retour d'état OBS sur les cases.
- Découper `src/app.js` en plusieurs fichiers (plus facile à lire et moins coûteux).
