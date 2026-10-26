// Cockpit Deck — données : pictogrammes, couleurs, modèles d'espaces
'use strict';

// Pictogrammes (grille 24 × 24, traits). [nom affiché, catégorie, mots-clés, tracé]
const PICTOS = {
  // Vol
  quantum: ['Quantum', 'Vol', 'saut quantique voyage', 'M3 12h11 M10 6l6 6-6 6 M19 5v14'],
  train: ['Train', 'Vol', 'train atterrissage roues', 'M12 3v8 M7 11h10 M9 11l-3 6 M15 11l3 6 M4 20a2 2 0 1 0 4 0a2 2 0 1 0-4 0 M16 20a2 2 0 1 0 4 0a2 2 0 1 0-4 0'],
  moteurs: ['Moteurs', 'Vol', 'moteur flamme propulsion', 'M12 3c3 4 5 6 5 10a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5 0 2 1 3 2 3 0-3-1-5 1-8.5z'],
  vtol: ['VTOL', 'Vol', 'vertical décollage', 'M12 4v16 M8 8l4-4 4 4 M8 16l4 4 4-4'],
  lumieres: ['Lumières', 'Vol', 'lumière phares feux', 'M9 18h6 M10 21h4 M12 3a6 6 0 0 0-4 10.5c.8.8 1 1.5 1 2.5h6c0-1 .2-1.7 1-2.5A6 6 0 0 0 12 3z'],
  portes: ['Portes', 'Vol', 'porte ouvrir', 'M5 21V4h14v17 M3 21h18 M15 12h.01'],
  verrous: ['Verrous', 'Vol', 'verrou cadenas bloquer', 'M6 11h12v10H6z M8 11V7a4 4 0 0 1 8 0v4'],
  rampe: ['Rampe', 'Vol', 'rampe soute', 'M3 18h18 M3 18l12-8h6'],
  croisiere: ['Croisière', 'Vol', 'vitesse croisière compteur', 'M4 17a8 8 0 0 1 16 0 M12 17l4-5'],
  alimentation: ['Alimentation', 'Vol', 'alimentation marche arrêt power', 'M12 3v8 M6.3 7.3a8 8 0 1 0 11.4 0'],
  carte: ['Carte', 'Vol', 'carte stellaire map', 'M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z M9 4v14 M15 6v14'],
  atterrissage: ['Atterrissage', 'Vol', 'atterrir demande tour', 'M4 19h16 M12 4v11 M8 11l4 4 4-4'],
  decouple: ['Découplé', 'Vol', 'découplé mode', 'M8 8a4 4 0 0 0 0 8h2 M14 8h2a4 4 0 0 1 0 8 M4 4l16 16'],
  pret: ['Prêt', 'Vol', 'flight ready prêt valider', 'M12 3a9 9 0 1 0 0.01 0 M8 12l3 3 5-6'],
  ejection: ['Éjection', 'Vol', 'éjecter siège', 'M12 4l7 8H5z M5 17h14v3H5z'],
  carburant: ['Carburant', 'Vol', 'carburant essence fuel', 'M4 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16 M3 21h12 M14 10h2a2 2 0 0 1 2 2v4a1 1 0 0 0 2 0V8l-3-3 M7 8h4'],
  boost: ['Boost', 'Vol', 'boost éclair turbo', 'M13 3L5 14h6l-1 7 8-11h-6z'],
  volets: ['Volets', 'Vol', 'volets aile', 'M3 10h12l6 3 M3 10l3 4h9 M15 14l4 5'],
  pilote: ['Pilote auto', 'Vol', 'pilote automatique', 'M12 3a9 9 0 1 0 0.01 0 M12 7v5l3 3 M8 4.5l1 2 M16 4.5l-1 2'],
  // Combat
  armes: ['Armes', 'Combat', 'armes canon tir', 'M4 20l10-10 M14 6l4 4 M12 4l8 8 M6 14l4 4'],
  bouclier: ['Bouclier', 'Combat', 'bouclier protection', 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z'],
  cible: ['Cible', 'Combat', 'cible verrouiller', 'M12 3a9 9 0 1 0 0.01 0 M12 8a4 4 0 1 0 0.01 0 M12 11.5a.5.5 0 1 0 .01 0'],
  viseur: ['Viseur', 'Combat', 'viseur visée', 'M12 3v4 M12 17v4 M3 12h4 M17 12h4 M12 8a4 4 0 1 0 0.01 0'],
  missile: ['Missile', 'Combat', 'missile roquette', 'M5 19l4-4 M9 15l8-8 3-1-1 3-8 8z M7 13l4 4'],
  leurres: ['Leurres', 'Combat', 'leurres contre-mesures', 'M12 21V9 M12 9l-5-5 M12 9l5-5 M12 13l-7-3 M12 13l7-3'],
  brouillage: ['Brouillage', 'Combat', 'brouillage bruit', 'M3 12h3l2-5 3 10 3-8 2 3h5'],
  suivant: ['Suivant', 'Combat', 'cible suivante', 'M6 6l6 6-6 6 M13 6l6 6-6 6'],
  precedent: ['Précédent', 'Combat', 'cible précédente', 'M18 6l-6 6 6 6 M11 6l-6 6 6 6'],
  // Systèmes
  scan: ['Scan', 'Systèmes', 'scanner radar', 'M12 12l7-7 M12 3a9 9 0 1 0 9 9 M12 7a5 5 0 1 0 5 5'],
  minage: ['Minage', 'Systèmes', 'minage pioche laser', 'M14 4l6 6 M15 9l-9 9-2-2 9-9 M4 20l3-3'],
  recup: ['Récupération', 'Systèmes', 'récupération salvage', 'M4 7h16 M6 7l1 13h10l1-13 M9 4h6'],
  reglages: ['Réglages', 'Systèmes', 'réglages engrenage paramètres', 'M12 9a3 3 0 1 0 0.01 0 M19 12h2 M3 12h2 M12 3v2 M12 19v2 M17 7l1.5-1.5 M5.5 18.5L7 17 M17 17l1.5 1.5 M5.5 5.5L7 7'],
  ecranmfd: ['Écran', 'Systèmes', 'écran mfd moniteur', 'M3 5h18v12H3z M8 21h8 M12 17v4'],
  reinit: ['Réinitialiser', 'Systèmes', 'réinitialiser retour', 'M4 4v6h6 M4.5 10a8 8 0 1 1 1.5 6'],
  // Bureau
  copier: ['Copier', 'Bureau', 'copier', 'M8 8h12v12H8z M4 16V4h12'],
  coller: ['Coller', 'Bureau', 'coller presse-papier', 'M8 4h8v3H8z M6 6H5v15h14V6h-1'],
  annuler: ['Annuler', 'Bureau', 'annuler retour', 'M9 14L4 9l5-5 M4 9h10a6 6 0 0 1 0 12h-3'],
  capture: ['Capture', 'Bureau', 'capture écran', 'M4 8V4h4 M16 4h4v4 M20 16v4h-4 M8 20H4v-4 M12 9a3 3 0 1 0 0.01 0'],
  bureau: ['Bureau', 'Bureau', 'bureau ordinateur', 'M3 4h18v12H3z M8 20h8 M12 16v4'],
  dossier: ['Dossier', 'Bureau', 'dossier explorateur fichiers', 'M3 6h7l2 2h9v11H3z'],
  fenetres: ['Fenêtres', 'Bureau', 'fenêtre changer alt tab', 'M4 4h12v10H4z M8 18h12V8'],
  web: ['Navigateur', 'Bureau', 'navigateur internet web', 'M12 3a9 9 0 1 0 0.01 0 M3 12h18 M12 3c3 3 3 15 0 18 M12 3c-3 3-3 15 0 18'],
  discussion: ['Discussion', 'Bureau', 'discord chat message', 'M7 7c3-1.5 7-1.5 10 0l2 9c-2 1.5-4 2-4 2l-1-2c-1 .3-3 .3-4 0l-1 2s-2-.5-4-2z M9.5 12h.01 M14.5 12h.01'],
  mail: ['Courriel', 'Bureau', 'mail courriel', 'M3 6h18v12H3z M3 7l9 6 9-6'],
  clavier: ['Clavier', 'Bureau', 'clavier touche', 'M3 7h18v10H3z M7 11h.01 M11 11h.01 M15 11h.01 M8 14h8'],
  // Streaming
  scene: ['Scène', 'Streaming', 'scène obs vidéo', 'M3 5h18v12H3z M8 21h8 M10 9l5 2-5 2z'],
  micro: ['Micro', 'Streaming', 'micro voix', 'M9 4a3 3 0 0 1 6 0v7a3 3 0 0 1-6 0z M5 11a7 7 0 0 0 14 0 M12 18v3'],
  micromuet: ['Micro coupé', 'Streaming', 'micro coupé muet discord', 'M9 4a3 3 0 0 1 6 0v7a3 3 0 0 1-6 0z M5 11a7 7 0 0 0 14 0 M12 18v3 M4 3l16 17'],
  casque: ['Casque', 'Média', 'casque écouteurs sortie audio discord', 'M4 15v-3a8 8 0 0 1 16 0v3 M4 14h3v6H4z M17 14h3v6h-3z'],
  casquemuet: ['Casque coupé', 'Média', 'casque coupé sourdine écouteurs discord', 'M4 15v-3a8 8 0 0 1 16 0v3 M4 14h3v6H4z M17 14h3v6h-3z M3 3l18 18'],
  webcam: ['Webcam', 'Streaming', 'caméra webcam', 'M12 4a6 6 0 1 0 0.01 0 M12 8a2 2 0 1 0 0.01 0 M8 20h8 M12 16v4'],
  chat: ['Chat', 'Streaming', 'chat bulle', 'M4 5h16v11H9l-5 4z'],
  live: ['Live', 'Streaming', 'live direct diffusion', 'M12 10a2 2 0 1 0 0.01 0 M7.8 7.8a6 6 0 0 0 0 8.4 M16.2 7.8a6 6 0 0 1 0 8.4 M4.9 4.9a10 10 0 0 0 0 14.2 M19.1 4.9a10 10 0 0 1 0 14.2'],
  enregistrer: ['Enregistrer', 'Streaming', 'enregistrer rec', 'M12 5a7 7 0 1 0 0.01 0 M12 9a3 3 0 1 0 0.01 0'],
  marqueur: ['Marqueur', 'Streaming', 'marqueur drapeau', 'M6 3v18 M6 4h11l-3 4 3 4H6'],
  clip: ['Clip', 'Streaming', 'clip ciseaux', 'M6 7a2.5 2.5 0 1 0 0.01 0 M6 17a2.5 2.5 0 1 0 0.01 0 M8 8l12 9 M8 16l12-9'],
  // Média
  musique: ['Musique', 'Média', 'musique note', 'M9 18V5l11-2v13 M9 18a3 3 0 1 1-6 0a3 3 0 1 1 6 0 M20 16a3 3 0 1 1-6 0a3 3 0 1 1 6 0'],
  lecture: ['Lecture', 'Média', 'lecture pause play', 'M6 5v14l8-7z M16 5v14 M20 5v14'],
  pistesuiv: ['Piste suivante', 'Média', 'suivant piste', 'M5 5v14l9-7z M18 5v14'],
  pisteprec: ['Piste précédente', 'Média', 'précédent piste', 'M19 5v14l-9-7z M6 5v14'],
  volplus: ['Volume +', 'Média', 'volume plus fort', 'M4 9h4l5-4v14l-5-4H4z M16 12h5 M18.5 9.5v5'],
  volmoins: ['Volume −', 'Média', 'volume moins', 'M4 9h4l5-4v14l-5-4H4z M16 12h5'],
  muet: ['Muet', 'Média', 'muet couper son', 'M4 9h4l5-4v14l-5-4H4z M16 9l5 6 M21 9l-5 6'],
  son: ['Son', 'Média', 'son haut-parleur', 'M4 9h4l5-4v14l-5-4H4z M16 9a4 4 0 0 1 0 6 M18.5 6.5a8 8 0 0 1 0 11'],
  // Symboles
  maison: ['Accueil', 'Symboles', 'maison accueil', 'M4 11l8-7 8 7 M6 9.5V20h12V9.5'],
  etoile: ['Étoile', 'Symboles', 'étoile favori', 'M12 2l3 7 7 3-7 3-3 7-3-7-7-3 7-3z'],
  coeur: ['Cœur', 'Symboles', 'coeur', 'M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z'],
  alerte: ['Alerte', 'Symboles', 'alerte attention', 'M12 3l9 16H3z M12 9v4 M12 16h.01'],
  valider: ['Valider', 'Symboles', 'valider ok coche', 'M5 12l5 5 9-10'],
  fermer: ['Fermer', 'Symboles', 'fermer croix', 'M6 6l12 12 M18 6L6 18'],
  plus: ['Plus', 'Symboles', 'plus ajouter', 'M12 5v14 M5 12h14'],
  moins: ['Moins', 'Symboles', 'moins retirer', 'M5 12h14'],
  haut: ['Haut', 'Symboles', 'flèche haut', 'M12 19V5 M6 11l6-6 6 6'],
  bas: ['Bas', 'Symboles', 'flèche bas', 'M12 5v14 M6 13l6 6 6-6'],
  gauche: ['Gauche', 'Symboles', 'flèche gauche', 'M19 12H5 M11 6l-6 6 6 6'],
  droite: ['Droite', 'Symboles', 'flèche droite', 'M5 12h14 M13 6l6 6-6 6'],
  manette: ['Manette', 'Symboles', 'manette jeu', 'M6 9h12a4 4 0 0 1 3.9 4.9l-.8 3.3a2 2 0 0 1-3.4.9L15 15H9l-2.7 3.1a2 2 0 0 1-3.4-.9l-.8-3.3A4 4 0 0 1 6 9z M8 11v3 M6.5 12.5h3 M15.5 12h.01 M17.5 13.5h.01'],
  avion: ['Avion', 'Symboles', 'avion', 'M2 13l8-2 4-8 2 1-2 7 6 2v2l-6 1 2 6-2 1-4-7-8-1z'],
  bougie: ['Bougie', 'Symboles', 'bougie flamme', 'M9 11h6v10H9z M12 11V9 M12 3c1.5 2 2 3 2 4a2 2 0 0 1-4 0c0-1 .5-2 2-4z']
};
const PICTO_CATS = ['Tous', 'Vol', 'Combat', 'Systèmes', 'Bureau', 'Streaming', 'Média', 'Symboles'];

const COLORS_ICON = [['Blanc', '#E6EDF3'], ['Gris', '#9FB0C0'], ['Ambre', '#FFB547'], ['Cyan', '#5CC8FF'], ['Violet', '#B79CFF'], ['Vert', '#3FB97A'], ['Rouge', '#FF8A7A'], ['Rose', '#FF7EB6'], ['Jaune', '#FFE15C']];
const COLORS_BG = [['Noir', '#07090C'], ['Ardoise', '#141A21'], ['Bleu nuit', '#0B1B2E'], ['Marine', '#10284A'], ['Violet nuit', '#1C1430'], ['Bordeaux', '#2A0F14'], ['Forêt', '#0F2218'], ['Brun', '#21160D'], ['Gris', '#2A2F36'], ['Sable', '#D9CBB0'], ['Gris clair', '#DDE3E9'], ['Blanc', '#F5F7FA']];
const COLORS_EDGE = [['Discret', '#26303A'], ['Gris', '#5B6875'], ['Cyan', '#1F4A61'], ['Ambre', '#6A4A16'], ['Violet', '#3A2F66'], ['Blanc', '#C9D6E2']];
const COLORS_ACCENT = [['Ambre', '#FFB547'], ['Cyan', '#5CC8FF'], ['Vert', '#3FB97A'], ['Violet', '#B79CFF'], ['Rouge', '#FF6B5C'], ['Rose', '#FF7EB6'], ['Jaune', '#FFE15C'], ['Blanc', '#F5F7FA']];
const THEMES = [
  { name: 'Cockpit', bgColor: '#07090C', idleEdge: '#26303A', accent: '#FFB547' },
  { name: 'Arctique', bgColor: '#0B1B2E', idleEdge: '#26303A', accent: '#5CC8FF' },
  { name: 'Néon', bgColor: '#1C1430', idleEdge: '#3A2F66', accent: '#FF7EB6' },
  { name: 'Forêt', bgColor: '#0F2218', idleEdge: '#26303A', accent: '#3FB97A' }
];
const DEFAULT_LOOK = { bgType: 'color', bgColor: '#07090C', bgPhoto: null, bgDim: 0.3, idleEdge: '#26303A', accent: '#FFB547' };

const CATEGORIES = {
  jeu: { label: 'Jeux', color: '#FFB547', icon: 'manette' },
  bureau: { label: 'Bureau', color: '#5CC8FF', icon: 'bureau' },
  stream: { label: 'Streaming', color: '#B79CFF', icon: 'live' },
  discord: { label: 'Discord', color: '#8E9BFF', icon: 'discussion' }
};

const MEDIA_KEYS = [['volplus', 'Volume +'], ['volmoins', 'Volume −'], ['muet', 'Muet'], ['lecture', 'Lecture / pause'], ['suivante', 'Piste suivante'], ['precedente', 'Piste précédente']];
const DISCORD_OPS = [['micro', 'Couper / rétablir le micro'], ['casque', 'Couper / rétablir le casque'], ['tout', 'Couper / rétablir micro + casque'], ['entree-suiv', 'Entrée audio suivante'], ['sortie-suiv', 'Sortie audio suivante'], ['entree', 'Choisir une entrée audio'], ['sortie', 'Choisir une sortie audio'], ['raccourci', 'Mon raccourci Discord']];
const OBS_OPS = [['scene', 'Changer de scène'], ['mute', 'Couper / rétablir un son'], ['source', 'Montrer / cacher un élément'], ['stream', 'Lancer / arrêter le live'], ['record', 'Lancer / arrêter l’enregistrement'], ['replay', 'Sauvegarder le replay']];

// ---------- modèles d'espaces ----------
// Raccourcis d'écriture : j(nom, picto, bouton, mode, ms) / k(nom, picto, touches) / ...
function cell(name, icon, action, behavior, color) {
  return { name, image: { type: 'icon', icon, color: color || '#9FB0C0', photo: null, showName: true, dim: 0.35 }, action, behavior: behavior || { mode: 'tap', holdMs: 1500 } };
}
const J = (name, icon, n, mode, ms, color) => cell(name, icon, { type: 'joy', button: n }, { mode: mode || 'tap', holdMs: ms || 1500 }, color);
const K = (name, icon, keys, mode) => cell(name, icon, { type: 'key', keys }, { mode: mode || 'tap', holdMs: 1500 });
const M = (name, icon, media) => cell(name, icon, { type: 'media', media }, null, '#5CC8FF');
const A = (name, icon, preset, screen, position) => cell(name, icon, { type: 'app', preset, exe: '', args: '', processName: '', screen: screen || 'gauche', position: position || 'plein', ifOpen: 'front' }, null, '#FFB547');
const D = (name, icon, op, mode, color) => cell(name, icon, { type: 'discord', op, arg: '', argName: '' }, { mode: mode || 'tap', holdMs: 1500 }, color);
const O = (name, icon, op, target, mode, color) => cell(name, icon, { type: 'obs', op, target: target || '' }, { mode: mode || 'tap', holdMs: 2000 }, color || '#5CC8FF');
// Cases de la page Discord ; les raccourcis personnels sont ajoutés à la suite
function discordCells(shortcuts) {
  return [D('Micro', 'micromuet', 'micro', 'toggle', '#FF8A7A'), D('Casque', 'casquemuet', 'casque', 'toggle', '#FF8A7A'), D('Micro + casque', 'muet', 'tout', 'toggle', '#FF8A7A'),
    D('Entrée suivante', 'micro', 'entree-suiv'), D('Sortie suivante', 'casque', 'sortie-suiv'),
    A('Ouvrir Discord', 'discussion', 'discord', 'gauche', 'droite')]
    .concat((shortcuts || []).map(x => cell(x.name, 'discussion', { type: 'discord', op: 'raccourci', arg: x.id, argName: x.name }, { mode: 'tap', holdMs: 1500 }, '#B79CFF')));
}
const pad = (cells) => { const c = cells.slice(0, 15); while (c.length < 15) c.push(null); return c; };

const TEMPLATES = {
  jeu: [
    {
      key: 'sc', name: 'Star Citizen', desc: 'Vol, combat, systèmes : 45 cases prêtes', icon: 'etoile', exe: 'StarCitizen.exe',
      pages: () => [
        { name: 'VOL', cells: pad([J('Flight Ready', 'pret', 1), J('Moteurs', 'moteurs', 2, 'toggle'), J('Train', 'train', 3, 'toggle'), J('VTOL', 'vtol', 4, 'toggle'), J('Quantum', 'quantum', 5, 'hold', 1500, '#5CC8FF'),
          K('Demande atterr.', 'atterrissage', 'Alt+N'), J('Découplé', 'decouple', 6, 'toggle'), J('Lumières', 'lumieres', 7, 'toggle'), J('Portes', 'portes', 8, 'toggle'), J('Verrous', 'verrous', 9, 'toggle'),
          J('Rampe', 'rampe', 10, 'toggle'), J('Croisière', 'croisiere', 11, 'toggle'), J('Alimentation', 'alimentation', 12, 'toggle'), K('Carte stellaire', 'carte', 'F2'), J('Éjection', 'ejection', 13, 'hold', 2000, '#FF8A7A')]) },
        { name: 'COMBAT', cells: pad([J('Armes', 'armes', 14, 'toggle'), J('Boucliers', 'bouclier', 15, 'toggle'), J('Leurres', 'leurres', 16), J('Brouillage', 'brouillage', 17), J('Mode missiles', 'missile', 18, 'toggle'),
          J('Tir missile', 'missile', 19, 'hold', 500, '#5CC8FF'), J('Verrou cible', 'viseur', 20), J('Cible suivante', 'suivant', 21), J('Cible précéd.', 'precedent', 22), J('Sous-cible', 'cible', 23),
          J('Gimbal', 'cible', 24, 'toggle'), J('Réinit. cibles', 'reinit', 25), J('Visée auto', 'viseur', 26, 'toggle'), J('Boost', 'boost', 27, 'hold', 300, '#5CC8FF'), J('Priorité armes', 'haut', 28)]) },
        { name: 'SYSTÈMES', cells: pad([J('Alim. armes +', 'armes', 29), J('Alim. boucliers +', 'bouclier', 30), J('Alim. moteurs +', 'moteurs', 31), J('Réinit. alim.', 'reinit', 32), K('Mode scan', 'scan', 'V'),
          K('Mode minage', 'minage', 'M'), J('Mode récup.', 'recup', 1), K('Ping', 'scan', 'Tab', 'hold'), cell('Page Vol', 'gauche', { type: 'page', page: 0 }), cell('Page Combat', 'droite', { type: 'page', page: 1 })]) }
      ]
    },
    {
      key: 'ed', name: 'Elite Dangerous', desc: 'Vol, combat, exploration', icon: 'alerte', exe: 'EliteDangerous64.exe',
      pages: () => [
        { name: 'VOL', cells: pad([J('Train', 'train', 1, 'toggle'), J('Lumières', 'lumieres', 2, 'toggle'), J('Supercroisière', 'quantum', 3), J('Saut FSD', 'boost', 4), J('Carte galaxie', 'carte', 5),
          J('Carte système', 'carte', 6), J('Soute', 'rampe', 7, 'toggle'), J('Pilote auto', 'pilote', 8, 'toggle'), J('Demande atterr.', 'atterrissage', 9), J('Assistance vol', 'decouple', 10, 'toggle')]) },
        { name: 'COMBAT', cells: pad([J('Armes', 'armes', 11, 'toggle'), J('Bouclier cellule', 'bouclier', 12), J('Leurres', 'leurres', 13), J('Cible suivante', 'suivant', 14), J('Sous-système', 'cible', 15),
          J('Énergie moteurs', 'moteurs', 16), J('Énergie armes', 'armes', 17), J('Énergie systèmes', 'bouclier', 18), J('Réinit. énergie', 'reinit', 19), J('Mode silence', 'muet', 20, 'toggle')]) }
      ]
    },
    {
      key: 'fs', name: 'Flight Simulator', desc: 'Train, volets, feux, pilote auto', icon: 'avion', exe: 'FlightSimulator.exe',
      pages: () => [
        { name: 'AVION', cells: pad([J('Train', 'train', 1, 'toggle'), J('Volets +', 'volets', 2), J('Volets −', 'volets', 3), J('Feux', 'lumieres', 4, 'toggle'), J('Strobes', 'lumieres', 5, 'toggle'),
          J('Pilote auto', 'pilote', 6, 'toggle'), J('Cap', 'droite', 7), J('Altitude', 'haut', 8), J('Frein parking', 'verrous', 9, 'toggle'), J('Aérofreins', 'decouple', 10, 'toggle')]) }
      ]
    },
    { key: 'vide', name: 'Jeu vide', desc: 'Une grille vide pour n’importe quel jeu', icon: 'manette', exe: '', pages: () => [{ name: 'PAGE 1', cells: pad([]) }] }
  ],
  bureau: [
    {
      key: 'win', name: 'Raccourcis Windows', desc: 'Copier, coller, captures, fenêtres, média', icon: 'bureau',
      pages: () => [
        { name: 'BUREAU', cells: pad([K('Copier', 'copier', 'Ctrl+C'), K('Coller', 'coller', 'Ctrl+V'), K('Annuler', 'annuler', 'Ctrl+Z'), K('Capture', 'capture', 'Win+Shift+S'), K('Verrouiller', 'verrous', 'Win+L'),
          K('Bureau', 'bureau', 'Win+D'), K('Explorateur', 'dossier', 'Win+E'), K('Changer fenêtre', 'fenetres', 'Alt+Tab'), A('Navigateur', 'web', 'edge', 'gauche', 'gauche'), A('Discord', 'discussion', 'discord', 'gauche', 'droite'),
          M('Volume −', 'volmoins', 'volmoins'), M('Volume +', 'volplus', 'volplus'), M('Muet', 'muet', 'muet'), M('Lecture / Pause', 'lecture', 'lecture'), M('Piste suivante', 'pistesuiv', 'suivante')]) }
      ]
    },
    { key: 'applis', name: 'Applications', desc: 'Navigateur, Discord… placés sur le bon écran', icon: 'web',
      pages: () => [{ name: 'APPLIS', cells: pad([A('Navigateur', 'web', 'edge', 'gauche', 'gauche'), A('Discord', 'discussion', 'discord', 'gauche', 'droite'), A('Explorateur', 'dossier', 'explorer', 'droite', 'plein')]) }] },
    { key: 'vide', name: 'Bureau vide', desc: 'Une grille vide', icon: 'bureau', pages: () => [{ name: 'PAGE 1', cells: pad([]) }] }
  ],
  stream: [
    {
      key: 'obs', name: 'OBS Studio', desc: 'Scènes, sons, live, enregistrement, replay', icon: 'live', exe: 'obs64.exe',
      pages: (scenes) => {
        const names = scenes && scenes.length ? scenes.slice(0, 5) : ['Scène 1', 'Scène 2', 'Scène 3', 'Scène 4', 'Scène 5'];
        const sc = names.map(n => O(n, 'scene', 'scene', n, 'tap', '#E6EDF3'));
        return [
          { name: 'SCÈNES', cells: pad(sc.concat([O('Micro', 'micro', 'mute', 'Micro', 'toggle'), O('Son du bureau', 'son', 'mute', 'Son du bureau', 'toggle'), O('Musique', 'musique', 'mute', 'Musique', 'toggle'),
            O('Webcam', 'webcam', 'source', 'Webcam', 'toggle'), O('Chat à l’écran', 'chat', 'source', 'Chat', 'toggle'),
            O('Live', 'live', 'stream', '', 'hold', '#FF8A7A'), O('Enregistrer', 'enregistrer', 'record', '', 'toggle'), O('Replay', 'reinit', 'replay', '')])) }
        ];
      }
    },
    { key: 'vide', name: 'Stream vide', desc: 'Une grille vide', icon: 'live', pages: () => [{ name: 'PAGE 1', cells: pad([]) }] }
  ],
  discord: [
    { key: 'discord', name: 'Discord', desc: 'Micro, casque, micro + casque, entrées et sorties audio', icon: 'discussion',
      pages: () => [{ name: 'DISCORD', cells: pad(discordCells([])) }] },
    { key: 'vide', name: 'Discord vide', desc: 'Une grille vide', icon: 'discussion', pages: () => [{ name: 'PAGE 1', cells: pad([]) }] }
  ]
};

// Programmes connus pour « Ouvrir une appli »
const APP_PRESETS = {
  edge: { label: 'Microsoft Edge', exe: '%ProgramFiles(x86)%\\Microsoft\\Edge\\Application\\msedge.exe', processName: 'msedge' },
  chrome: { label: 'Google Chrome', exe: '%ProgramFiles%\\Google\\Chrome\\Application\\chrome.exe', processName: 'chrome' },
  firefox: { label: 'Firefox', exe: '%ProgramFiles%\\Mozilla Firefox\\firefox.exe', processName: 'firefox' },
  discord: { label: 'Discord', exe: '%LOCALAPPDATA%\\Discord\\Update.exe', args: '--processStart Discord.exe', processName: 'Discord' },
  spotify: { label: 'Spotify', exe: '%APPDATA%\\Spotify\\Spotify.exe', processName: 'Spotify' },
  explorer: { label: 'Explorateur de fichiers', exe: 'explorer.exe', processName: 'explorer' },
  autre: { label: 'Autre programme…', exe: '', processName: '' }
};
