# Programme de l'écran The Deck (ESP32-P4)

Carte : Waveshare ESP32-P4-WIFI6-Touch-LCD-7B (écran 1024 × 600, tactile GT911). ESP-IDF 5.5, LVGL 9.

- **Fabrication** : automatique sur GitHub (`.github/workflows/fabriquer-exe.yml`, tâche `ecran`), en deux versions : `ecran-rev3.bin` (puces v3, cartes récentes) et `ecran-rev1.bin` (puces v1.x). Les deux sont rangées dans le `.exe` du logiciel.
- **Installation** : dans le logiciel, page **Appareil › Installer le programme de l'écran**, écran branché sur sa prise « USB TO UART ». Pas de page internet.
- **Version** : `version.txt` (à augmenter à chaque nouvelle version du programme de l'écran).
- **Mémoire** (`partitions.csv`, 32 Mo) : deux emplacements de programme (`ota_0`, `ota_1`) pour les futures mises à jour par le câble habituel, et un espace `pages` pour garder les pages reçues.

À la main (si ESP-IDF 5.5 est installé) :
```
cd firmware
set SDKCONFIG_DEFAULTS=sdkconfig.defaults;sdkconfig.defaults.rev3
idf.py set-target esp32p4 build flash monitor
```
