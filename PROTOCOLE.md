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

Réglages de navigation dans `data.device` : `swipe` (glisser gauche/droite = page suivante/précédente de l'espace, ou de l'accueil), `swipeV` (glisser haut/bas = espace suivant/précédent dans l'ordre de `home`, en arrivant sur la première page), `loop` (après le dernier, revenir au premier). Dans un espace `player`, glisser gauche/droite change de morceau au lieu de page.

Bouton Accueil : chaque espace affiche en haut à gauche un carré (contour et maison de la couleur `look.accent`). Le toucher ramène à l'écran d'accueil (liste `home`).

### `media` — le morceau en cours, envoyé en direct

Envoyé dès que l'écran est relié, puis à chaque changement (morceau, lecture/pause).

```json
{"t":"media","playing":true,"none":false,"title":"…","artist":"…","album":"…","cover":"<JPEG 320×320 en base64>"}
```

- `cover` n'est présent que quand la jaquette change ; `""` = pas de jaquette (afficher le pictogramme de note).
- `none: true` = rien en lecture.
- Aucune réponse attendue.

## De l'écran vers le logiciel

Une ligne JSON par message (les lignes `OK` / `ERR` restent les réponses à `config`).

### Soundboard (espace dont `layout` vaut `"soundboard"`)

L'écran affiche à gauche les quatre sorties (`moi`, `discord`, `jeu`, `stream`), cochées au départ selon `sound.sel`, et une grille de 4 × 3 sons. L'utilisateur coche les sorties, puis touche un son. Le son est joué par le PC :

```json
{"t":"sound","space":"<id espace>","page":0,"cell":3,"down":true,"dests":{"moi":true,"discord":true,"jeu":false,"stream":true}}
```

- `down: false` quand le doigt se lève (utile pour les sons « tant qu'on appuie », `action.mode = "hold"`).
- Un son dont `action.route` vaut `"fixed"` part toujours sur `action.dests`, quelles que soient les cases cochées.
- Bouton « Stop tout » : `{"t":"sound-stop"}`. Bouton volume : `{"t":"volume","value":75}` (0 à 100).

Images des cases : `image.photo` (JPEG en data URL ou `null`), `image.icon` (nom du pictogramme ou `null`), `image.showName`, `image.color`, `image.dim`, et `edge` (couleur du contour, `null` = celle de l'apparence). Photo, pictogramme et nom se combinent librement.
