# Notice d'utilisation (PDF)

- `notice.html` : le texte de la notice (un chapitre = une `<div class="section">`).
- `img/` : les captures d'écran utilisées.
- `shots.js` : refait les captures générales (interface en mode aperçu, avec un faux `window.deck`).
- `captures-clips.js` : refait les captures du chapitre Clips.
- `pdf.js` : fabrique `The-Deck-notice-vX.Y.Z.pdf` (numéro pris dans `package.json`).

Commandes (Playwright doit être installé) : `node tools/notice/shots.js`, `node tools/notice/captures-clips.js`, puis `node tools/notice/pdf.js`.
