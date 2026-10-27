# 0002 — Protocole USB en lignes JSON

## Contexte
Le logiciel et l'écran ESP32-P4 doivent échanger la configuration, la musique en cours, l'état des clips et les appuis de la soundboard, par le câble USB.

## Décision
Liaison série USB (CDC) à 921 600 bauds, une ligne JSON par message, champ `t` pour le type (`config`, `media`, `clips`, `sound`, `clip`…). Les actions faites par le PC passent sinon par des touches réservées F13–F24 envoyées par l'écran comme un clavier. Détail dans `PROTOCOLE.md`.

## Conséquences
- Avantages : lisible et facile à déboguer ; on ajoute un type de message sans casser les autres ; l'écran reste aussi une vraie manette/clavier USB qui marche sans le logiciel pour les jeux.
- Inconvénients : le JSON est plus gros qu'un format binaire (les images passent en base64, d'où la jaquette réduite à 320 px) ; le firmware doit savoir lire du JSON.
