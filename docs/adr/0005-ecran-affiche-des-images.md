# 0005 — L'écran affiche des images préparées par le logiciel

## Contexte
Le programme de l'écran (ESP32-P4) doit montrer les pages telles que l'utilisateur les a faites dans le logiciel (photos, pictogrammes, noms, couleurs, fond). Deux façons : l'écran redessine tout à partir de la configuration, ou le logiciel prépare chaque page en image et l'écran l'affiche. L'utilisateur veut aussi qu'il n'y ait jamais de page internet : on branche, Windows reconnaît, tout se règle dans le logiciel.

## Décision
- Le logiciel dessine chaque page (comme « Aperçu de l'écran ») et l'envoie en image, avec la liste des zones à toucher et leur action. L'écran affiche l'image, réagit aux appuis (touches F13–F24, manette, touches multimédia, messages JSON) et garde les pages dans sa mémoire flash (espace `pages`).
- Le programme de l'écran est écrit avec ESP-IDF 5.5 et LVGL 9 (bibliothèque Waveshare de la carte 7B), fabriqué par GitHub Actions en deux versions (puces v3 et v1.x) et rangé dans le `.exe`.
- Il s'installe depuis le logiciel (page Appareil, outil esptool-js) par la prise « USB TO UART ». Plus tard, les mises à jour passeront par le câble habituel (deux emplacements de programme `ota_0` / `ota_1`).

## Conséquences
- Avantages : l'écran montre exactement l'aperçu du logiciel ; programme de l'écran beaucoup plus petit et plus simple ; aucune police ni pictogramme à refaire en C ; aucune page internet.
- Inconvénients : le message `config` de `PROTOCOLE.md` changera (images + zones) ; un changement d'apparence demande un nouvel envoi des images ; les parties qui bougent (jaquette, chrono des clips, cases cochées de la soundboard) se dessinent sur l'écran ou s'envoient en petites images.
