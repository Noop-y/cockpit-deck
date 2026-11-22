# The Deck — échanges USB entre le logiciel et l'écran

Liaison série USB (CDC) de la carte ESP32-P4, 921 600 bauds. Un message = une ligne JSON terminée par `\n`.

## Bonjour (dans les deux sens)

Dès que l'écran est relié, puis toutes les 3 s, le logiciel envoie `{"t":"hello","app":"1.1.1"}`. L'écran répond `{"t":"hello","fw":"0.4.0","rev":302,"etape":3,"pages":12}` (version de son programme, version de la puce : 302 = v3.2). Sans bonjour depuis 6 s, l'écran affiche « logiciel pas relié ».

Depuis le programme de l'écran 0.2.0, la liaison passe par la prise « USB » de la carte (USB pleine vitesse de l'ESP32-P4, VID 0x303A, PID 0x81D3), avec sur le même câble un clavier (F13–F24, lettres), des touches multimédia et une manette de 32 boutons. Le débit (921 600) n'a plus d'importance sur cette liaison.

## Mise à jour du programme de l'écran par le câble (programme 0.3.0 ou plus)

Le logiciel lit `app-rev3.bin` ou `app-rev1.bin` (selon `rev` donné dans le bonjour : 300 et plus = puce v3) et l'envoie :

1. `{"t":"fw-begin","size":<octets>,"version":"0.3.1"}` → l'écran prépare l'emplacement libre (`ota_0` / `ota_1`) et répond `{"t":"fw-ack","off":0}`.
2. `{"t":"fw-data","off":<position>,"b64":"<8 Ko en base64>"}` → `{"t":"fw-ack","off":<nouvelle position>}`. Un morceau n'est envoyé qu'après l'accusé du précédent ; si `off` ne correspond pas, l'écran redit où il en est.
3. `{"t":"fw-end"}` → l'écran vérifie le programme, le choisit pour le prochain démarrage, répond `{"t":"fw-done"}` et redémarre.

En cas de problème : `{"t":"fw-err","msg":"…"}` ; l'écran garde son programme actuel.

## Pages en images (programme de l'écran 0.4.0 ou plus)

Bouton « Envoyer sur l'écran » : le logiciel dessine chaque page à 1024 × 600 (comme « Aperçu de l'écran »), et envoie un seul paquet binaire :

1. `{"t":"pg-begin","size":<octets>,"crc":<CRC-32 du paquet>}` → `{"t":"pg-ack","off":0}`.
2. `{"t":"pg-data","off":<position>,"b64":"<8 Ko en base64>"}` → `{"t":"pg-ack","off":<nouvelle position>}` (comme `fw-data`).
3. `{"t":"pg-end"}` → l'écran vérifie la somme de contrôle, garde les pages et affiche la première : `{"t":"pg-done","count":<pages>}`.

En cas de problème : `{"t":"pg-err","msg":"…"}`. Le bonjour de l'écran donne `"pages":<nombre>` (0 = aucune).

Paquet (nombres en petit-boutiste) :

| Partie | Taille | Contenu |
|---|---|---|
| En-tête | 24 | `DECK`, version (2 depuis l'écran 0.4.1), nombre de pages, début des textes, taille des textes, taille totale, 0 |
| Pages | 28 × pages | début du JPEG, taille du JPEG, première zone, nombre de zones, 0, couleur d'appui `0xRRGGBB`, puis 4 × 16 bits : glisser vers la gauche, la droite, le haut, le bas → n° de page du paquet, `0xF000` + code d'une touche multimédia (lecteur : morceau suivant/précédent), ou `0xFFFF` (rien) |
| Zones | 28 × zones | x, y, largeur, hauteur (16 bits) ; sorte, comportement, arrondi, 0 (8 bits) ; maintien en ms, v1, v2, 0 (16 bits) ; message à l'appui, message au relâchement (32 bits, position dans les textes, `0xFFFFFFFF` = aucun) |
| Textes | | messages JSON terminés par un 0 |
| Images | | JPEG 1024 × 600 (début aligné sur 4 octets) |

Sortes de zones : 0 rien, 1 touche clavier (v1 = Ctrl 1 / Maj 2 / Alt 4 / Windows 8, v2 = code USB de la touche), 2 bouton de manette (v1 = 1 à 32), 3 touche multimédia (v1 = code USB), 4 aller à la page n° v1 du paquet (0 = accueil), 5 message au logiciel (par exemple `{"t":"sound",…}` ou `{"t":"clip","op":"rec"}`), 6 compteur du stock (v1 = nombre, v2 = stock bas ; écran 0.5.1), 7 choix (texte = les choix séparés par « | », v1 = n° du choix montré, v2 = couleur du texte et hold = couleur du fond en RGB565 ; écran 0.5.3 ; ex. durée des clips, « on filme ». Écran 0.5.4 : mode 1 = s'arrête au premier et au dernier choix au lieu de reboucler ; texte du relâché = couleur du fond de chaque choix « RRGGBB|RRGGBB », ex. coche vide / pleine). Un message lié à un compteur ou à un choix porte dans l'octet 11 son pas (−1 ou +1, signé) et dans les 16 bits 18–19 le n° du compteur dans la page + 1 : l'écran change le nombre tout de suite, sans attendre l'image. Comportements : 0 appui (enfoncé tant que le doigt est posé), 1 maintenir (déclenche après le temps de maintien), 2 bascule (contour allumé ou éteint à chaque appui).

L'ancien message `config` (ci-dessous) est remplacé par ces pages ; l'écran y répond `ERR`.

### Une page remplacée en direct (écran 0.5.0)

Pour le stock : après un − / +, le logiciel redessine seulement la page qui a changé et l'envoie, sans tout renvoyer.

1. `{"t":"pi-begin","page":<n° de page du paquet>,"size":<octets>,"crc":<CRC-32>}` → `{"t":"pi-ack","off":0}`.
2. `{"t":"pi-data","off":<position>,"b64":"<8 Ko>"}` → `{"t":"pi-ack","off":<nouvelle position>}`.
3. `{"t":"pi-end","n":[<nombres>]}` (les vrais nombres des compteurs et n° des choix de la page, dans l'ordre) → l'écran garde l'image en mémoire vive (elle passe avant celle de la mémoire flash) et la réaffiche si c'est la page montrée : `{"t":"pi-done"}`. Erreur : `{"t":"pi-err","msg":"…"}`.

Les images en direct sont oubliées au redémarrage ou au prochain paquet complet : le logiciel note qu'il faut tout renvoyer (`device.pgStale`) et le fait tout seul quand l'écran se rebranche.

### Montrer une page (écran 0.5.2)

`{"t":"pg-show","page":<n° de page du paquet>}` : l'écran affiche cette page tout de suite (pas de réponse). Sert à montrer une proposition de Claude. Les écrans plus anciens l'ignorent.

### Écran → PC : stock

`{"t":"stock","id":"<id de la pièce>","d":-1}` (ou `1`) : appui sur − ou + d'une pièce de l'espace Stock. Le logiciel change la quantité, l'enregistre et renvoie la page.

`{"t":"sb-dest","space":"<id>","k":"discord"}` : coche Moi / Discord / Jeu / Stream touchée sur la soundboard. `{"t":"sb-vol","d":1}` (ou `-1`) : volume des sons dans le micro, de 10 en 10. `{"t":"sound-stop"}` : « Stop tout ».

`{"t":"stock-prop","op":"ok","id":"<id de la proposition>"}` (ou `"op":"non"`) : appui sur VALIDER (ou REFUSER) dans la fenêtre « Proposition de Claude ».

## Lien avec l'application Claude (tuyau Windows)

L'application Claude lance `lien-claude.js` (connecteur MCP, une ligne JSON-RPC par message sur l'entrée / la sortie standard). Il pose ses questions au logiciel par le tuyau `\\.\pipe\the-deck-claude`, une ligne JSON par message :

- `{"id":1,"op":"lire"}` → `{"id":1,"resultat":{categories, proposition_en_attente, historique}}` ;
- `{"id":1,"op":"proposer","args":{titre, changements:[{piece_id, quantite} | {nouvelle_piece:{nom, categorie_id, tiroir_id}, quantite}]}}` → `{"id":1,"resultat":{id, etat}}` ou `{"id":1,"erreur":"…"}` ;
- `{"id":1,"op":"etat","args":{id}}` → `{"id":1,"resultat":{id, etat}}`.

Rien d'autre n'est possible : pas d'écriture directe du stock, aucun réglage, aucun code secret.

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

### Son dans une grille normale (espace Favoris)

Une case de type `sound` peut aussi se trouver dans un espace en grille (copie d'un son dans les Favoris). Elle a toujours `route: "fixed"` et ses propres `dests` : l'écran envoie le même message `{"t":"sound","space":…,"page":…,"cell":…,"down":true}`, sans `dests`. Au relâchement d'un son « maintenir » : `"down":false`.

### Clips (espace dont `layout` vaut `"clips"`, et cases dont `action.type` vaut `"clip"`)

L'espace Clips a une disposition fixe : CLIP (grande case, 2 × 2), ENREGISTRER, CAPTURE, RETOUR EN ARRIÈRE, DERNIERS CLIPS (3 cases de large), MÉMOIRE, MA VOIX, LE JEU / L'ÉCRAN, DOSSIER. Chaque appui envoie :

```json
{"t":"clip","op":"clip"}
```

`op` : `clip`, `rec` (marche / arrêt), `shot` (capture), `dur` (durée suivante), `mem` (mémoire en marche / à l'arrêt), `mic` (voix dans les clips), `src` (jeu ↔ écran), `folder` (ouvre le dossier sur le PC).

Une case `clip` placée dans un autre espace se comporte comme les cases « appli » : l'écran envoie sa touche réservée (`action.hotkey`, F13 à F24) et le PC fait l'action `action.op`.

Images des cases : `image.photo` (JPEG en data URL ou `null`), `image.icon` (nom du pictogramme ou `null`), `image.showName`, `image.color`, `image.dim`, et `edge` (couleur du contour, `null` = celle de l'apparence). Photo, pictogramme et nom se combinent librement.
