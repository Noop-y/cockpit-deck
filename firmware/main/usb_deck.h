/*
 * The Deck — USB de l'écran (prise Type-C « USB », port USB pleine vitesse de l'ESP32-P4)
 *
 * Un seul câble, trois fonctions vues par Windows sans pilote :
 *  - clavier (touches réservées F13–F24, lettres) et touches multimédia (lecture, volume…) ;
 *  - manette (32 boutons) ;
 *  - liaison série (CDC) avec le logiciel The Deck : une ligne JSON par message (PROTOCOLE.md).
 */
#pragma once
#include <stdbool.h>
#include <stdint.h>

// Démarre l'USB (à appeler une fois au démarrage)
void usb_deck_start(void);

// true quand Windows a reconnu l'écran
bool usb_deck_mounted(void);
// true quand le logiciel The Deck a dit bonjour il y a moins de 6 s ; version du logiciel (ou "")
bool usb_deck_app_linked(void);
const char *usb_deck_app_version(void);

// Touches (à appuyer puis relâcher : down = true puis false)
void usb_deck_key(uint8_t hid_keycode, bool down);        // clavier (HID_KEY_…)
void usb_deck_media(uint16_t consumer_usage, bool down);  // touche multimédia (HID_USAGE_CONSUMER_…)
void usb_deck_pad(uint8_t button, bool down);             // bouton de manette, de 1 à 32
void usb_deck_type(const char *ascii);                    // tape un petit texte (lettres minuscules, chiffres, espace)

// Envoie une ligne au logiciel (le \n est ajouté)
void usb_deck_send_line(const char *line);

// Mise à jour du programme par le câble : pourcentage reçu (0 à 100), ou -1 s'il n'y en a pas en cours
int usb_deck_update_pct(void);
