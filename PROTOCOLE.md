# The Deck — échanges USB entre le logiciel et l'écran

Liaison série USB (CDC) de la carte ESP32-P4, 921 600 bauds. Un message = une ligne JSON terminée par `\n`.

## Du logiciel vers l'écran

### `config` — la configuration complète (bouton « Envoyer sur l'écran »)

```json
{"t":"config","data":{ "format":"cockpit-deck-ecran", "device":{...}, "look":{...}, "home":[...], "spaces":[...] }}
```

L'écran répond par une ligne `OK` (ou `ERR` suivi d'un message).

Un espace dont `layout` vaut `"player"` (Spotify) n'a pas de cases : l'écran affiche le lecteur. `player.controls` donne la touche multimédia (USB HID) à envoyer pour chaque bouton :
`prev` → `precedente`, `next` → `suivante`, `play` → `lecture`, `vmoins` → `volmoins`, `vplus` → `volplus`, glisser vers la gauche → `suivante`, vers la droite → `precedente`.

### `media` — le morceau en cours, envoyé en direct

Envoyé dès que l'écran est relié, puis à chaque changement (morceau, lecture/pause).

```json
{"t":"media","playing":true,"none":false,"title":"…","artist":"…","album":"…","cover":"<JPEG 320×320 en base64>"}
```

- `cover` n'est présent que quand la jaquette change ; `""` = pas de jaquette (afficher le pictogramme de note).
- `none: true` = rien en lecture.
- Aucune réponse attendue.
