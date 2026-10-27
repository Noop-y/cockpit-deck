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

### `clips` — l'état de l'enregistreur de clips, envoyé en direct

Envoyé quand l'écran est relié, puis à chaque changement (mémoire, enregistrement, durée, nouveau clip). Sert à l'espace dont `layout` vaut `"clips"`.

```json
{"t":"clips","available":true,"on":true,"starting":false,"waiting":false,"paused":false,"rec":false,"recSec":0,"dur":60,"mic":true,"src":"jeu","status":"Mémoire en marche · 1 min · Star Citizen",
 "recent":[{"kind":"clip","game":"Star Citizen","when":"Aujourd’hui 18h52","dur":"1:00","thumb":"<JPEG 320 px en base64>"}],
 "toast":{"title":"Clip enregistré","sub":"Star Citizen · 1 min · Vidéos › The Deck › Clips","kind":"ok"}}
```

- `status` : la phrase à afficher dans la pastille en haut à droite. `on` : mémoire en marche (point rouge).
- `rec` / `recSec` : enregistrement en cours et secondes écoulées (l'écran compte ensuite tout seul).
- `dur` : retour en arrière en secondes (15, 30, 60, 120, 180 ou 300). `src` : `jeu`, `ecran` ou `choisir`.
- `recent` n'est présent que quand la liste change (3 au plus). `kind` : `clip`, `video` ou `capture`.
- `toast` (facultatif) : bandeau à afficher 2,8 s en bas de l'écran ; `kind` : `ok` (vert), `info` (ambre), `err` (rouge).

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

### Clips (espace dont `layout` vaut `"clips"`, et cases dont `action.type` vaut `"clip"`)

L'espace Clips a une disposition fixe : CLIP (grande case, 2 × 2), ENREGISTRER, CAPTURE, RETOUR EN ARRIÈRE, DERNIERS CLIPS (3 cases de large), MÉMOIRE, MA VOIX, LE JEU / L'ÉCRAN, DOSSIER. Chaque appui envoie :

```json
{"t":"clip","op":"clip"}
```

`op` : `clip`, `rec` (marche / arrêt), `shot` (capture), `dur` (durée suivante), `mem` (mémoire en marche / à l'arrêt), `mic` (voix dans les clips), `src` (jeu ↔ écran), `folder` (ouvre le dossier sur le PC).

Une case `clip` placée dans un autre espace se comporte comme les cases « appli » : l'écran envoie sa touche réservée (`action.hotkey`, F13 à F24) et le PC fait l'action `action.op`.

Images des cases : `image.photo` (JPEG en data URL ou `null`), `image.icon` (nom du pictogramme ou `null`), `image.showName`, `image.color`, `image.dim`, et `edge` (couleur du contour, `null` = celle de l'apparence). Photo, pictogramme et nom se combinent librement.
