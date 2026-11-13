/*
 * The Deck — pages de l'écran (étape 3)
 *
 * Le logiciel dessine chaque page (comme « Aperçu de l'écran »), l'envoie en image JPEG avec la liste
 * des zones à toucher, et l'écran garde le tout dans sa mémoire flash (espace « pages »).
 * Format du paquet : voir PROTOCOLE.md (« Pages en images »).
 */
#pragma once
#include <stdbool.h>

// Prépare l'affichage des pages (décodeur JPEG, mémoire) et lit les pages déjà gardées.
// true s'il y a des pages : elles s'affichent alors à la place de l'écran de test.
// À appeler avec l'affichage verrouillé (bsp_display_lock).
bool pages_start(void);

// Nombre de pages gardées dans l'écran (0 = aucune)
int pages_count(void);

// Lignes pg-begin / pg-data / pg-end reçues du logiciel
void pages_line(const char *t, const char *line);
