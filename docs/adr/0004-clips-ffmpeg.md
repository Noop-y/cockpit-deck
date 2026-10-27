# 0004 — Clips enregistrés par FFmpeg intégré

## Contexte
L'utilisateur veut un enregistreur de clips propre à The Deck (sans OBS, NVIDIA ni Game Bar), avec un retour en arrière réglable, sans ralentir le jeu.

## Décision
FFmpeg (version récente de BtbN, GPL) est téléchargé à la fabrication et livré dans le `.exe`. `clips.js` filme en continu avec `gfxcapture` (fenêtre du jeu ou écran ; repli `ddagrab`), encode par la carte graphique (NVENC, AMF ou QSV ; repli x264) en morceaux de 2 s, et recolle les derniers morceaux sans réencoder pour faire un clip. Le son est capté par l'interface (Web Audio) et envoyé à FFmpeg par deux tuyaux nommés.

## Conséquences
- Avantages : rapide et léger pendant le jeu ; clip instantané sans perte ; aucun autre logiciel à installer.
- Inconvénients : `.exe` plus gros (~+100 Mo) ; le retour en arrière occupe de la place sur le disque (affichée dans les réglages) ; la capture et l'encodage ne se testent vraiment que sur le PC Windows ; FFmpeg est sous licence GPL (fourni à part, licence jointe).
