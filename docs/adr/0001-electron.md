# 0001 — Electron pour le logiciel

## Contexte
Il fallait un logiciel Windows facile à faire évoluer, avec une belle interface, l'accès au port USB de l'écran et aux fonctions de Windows (fenêtres, son, PowerShell).

## Décision
Electron (Chromium + Node.js), interface en HTML/CSS/JavaScript sans framework ni outil de build. Le `.exe` est fabriqué par electron-builder sur GitHub Actions.

## Conséquences
- Avantages : une seule langue (JavaScript) ; Web Serial pour l'USB, Web Audio pour les sons ; l'interface s'ouvre aussi dans un navigateur (mode aperçu) pour la tester sans Windows.
- Inconvénients : fichiers d'installation lourds (Chromium inclus) ; les fonctions propres à Windows passent par des scripts PowerShell et ne se testent que sur Windows.
