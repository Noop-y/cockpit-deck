// The Deck — lien avec l'application Claude (connecteur MCP local)
//
// L'application Claude (Windows) lance ce petit programme quand elle démarre (bouton « Relier Claude » du logiciel,
// voir main.js). Il parle avec Claude par l'entrée / la sortie standard (une ligne JSON-RPC par message) et avec le
// logiciel The Deck par un tuyau Windows (\\.\pipe\the-deck-claude).
// Claude ne peut faire que trois choses : lire le stock, proposer un changement, demander où en est une proposition.
// Rien n'est changé dans le stock sans un appui sur VALIDER (écran The Deck ou logiciel).
// Ce fichier n'est pas chargé par l'interface : main.js le copie dans le dossier de The Deck.
'use strict';
const net = require('net');

const PIPE = process.env.THE_DECK_PIPE || (process.platform === 'win32' ? '\\\\.\\pipe\\the-deck-claude' : '/tmp/the-deck-claude.sock');
const VERSION = '1';

const INSTRUCTIONS = `Ce connecteur donne accès au stock de composants électroniques de l'utilisateur, rangé dans le logiciel The Deck (écran tactile fait maison).
Règles convenues avec l'utilisateur :
- Tu peux lire le stock (lire_stock) quand il le demande, par exemple « Qu'est-ce que je dois commander ? » (pièces en stock bas ou épuisées).
- Tu ne proposes un changement (proposer_changement) qu'après une de ces phrases : « Projet terminé : <nom> » (retirer les pièces utilisées), « Commande reçue : … » (ajouter des pièces), « Annule la dernière validation » (proposer l'inverse de la dernière proposition validée, visible dans l'historique de lire_stock).
- Avant de proposer, montre d'abord la liste des pièces et des quantités dans la conversation et laisse l'utilisateur la corriger.
- Une proposition n'applique rien : elle s'affiche sur l'écran The Deck avec VALIDER / REFUSER. Dis-le à l'utilisateur.
- « Rappelle-moi les phrases du stock » : redonne ces phrases.
L'utilisateur débute : réponds en français simple.`;

const TOOLS = [
  {
    name: 'lire_stock',
    description: 'Lit le stock d’électronique : catégories, tiroirs (sous-catégories), pièces avec leur id, quantité et seuil « stock bas », plus les dernières propositions (historique). Lecture seule.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false }
  },
  {
    name: 'proposer_changement',
    description: 'Propose un changement du stock. N’applique rien : la proposition s’affiche sur l’écran The Deck et ne s’applique que si l’utilisateur appuie sur VALIDER. À n’utiliser qu’après une phrase convenue (« Projet terminé : … », « Commande reçue : … », « Annule la dernière validation ») et après avoir montré la liste dans la conversation. Une nouvelle proposition remplace celle qui attend encore.',
    inputSchema: {
      type: 'object',
      properties: {
        titre: { type: 'string', description: 'Titre court affiché sur l’écran, par ex. « Projet terminé : medpen » ou « Commande reçue ».' },
        changements: {
          type: 'array', minItems: 1, maxItems: 40,
          items: {
            type: 'object',
            properties: {
              piece_id: { type: 'string', description: 'id d’une pièce existante (donné par lire_stock).' },
              quantite: { type: 'integer', description: 'Nombre à ajouter (positif) ou à retirer (négatif).' },
              nouvelle_piece: {
                type: 'object', description: 'Pour une pièce qui n’existe pas encore (seulement en ajout) : à la place de piece_id.',
                properties: { nom: { type: 'string' }, categorie_id: { type: 'string' }, tiroir_id: { type: 'string', description: 'Obligatoire si la catégorie a des tiroirs.' } },
                required: ['nom', 'categorie_id']
              }
            },
            required: ['quantite']
          }
        }
      },
      required: ['titre', 'changements']
    }
  },
  {
    name: 'etat_proposition',
    description: 'Dit où en est une proposition : en attente, validée, refusée, remplacée ou annulée.',
    inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] }
  }
];
const OPS = { lire_stock: 'lire', proposer_changement: 'proposer', etat_proposition: 'etat' };

// une question au logiciel The Deck, par le tuyau
function ask(op, args) {
  return new Promise((resolve) => {
    let buf = '', done = false;
    const end = (r) => { if (done) return; done = true; clearTimeout(t); try { sock.destroy(); } catch (e) { /* ignoré */ } resolve(r); };
    const t = setTimeout(() => end({ erreur: 'The Deck ne répond pas. Le logiciel est-il ouvert ?' }), 8000);
    const sock = net.connect(PIPE);
    sock.setEncoding('utf8');
    sock.on('connect', () => sock.write(JSON.stringify({ id: 1, op, args: args || {} }) + '\n'));
    sock.on('data', (d) => {
      buf += d;
      const i = buf.indexOf('\n');
      if (i >= 0) { try { end(JSON.parse(buf.slice(0, i))); } catch (e) { end({ erreur: 'Réponse illisible de The Deck.' }); } }
    });
    sock.on('error', () => end({ erreur: 'Le logiciel The Deck n’est pas ouvert sur ce PC. Ouvrez-le, puis réessayez.' }));
  });
}

const send = (msg) => process.stdout.write(JSON.stringify(msg) + '\n');
const reply = (id, result) => send({ jsonrpc: '2.0', id, result });
const fail = (id, code, message) => send({ jsonrpc: '2.0', id, error: { code, message } });

async function handle(m) {
  if (!m || typeof m !== 'object') return;
  const { id, method, params } = m;
  if (id === undefined || id === null) return;   // notification (ex. notifications/initialized) : rien à répondre
  if (method === 'initialize') {
    return reply(id, {
      protocolVersion: (params && params.protocolVersion) || '2025-06-18',
      capabilities: { tools: {} },
      serverInfo: { name: 'the-deck', version: VERSION },
      instructions: INSTRUCTIONS
    });
  }
  if (method === 'ping') return reply(id, {});
  if (method === 'tools/list') return reply(id, { tools: TOOLS });
  if (method === 'tools/call') {
    const name = params && params.name;
    if (!OPS[name]) return fail(id, -32602, 'Outil inconnu : ' + name);
    const r = await ask(OPS[name], (params && params.arguments) || {});
    const bad = !r || r.erreur;
    return reply(id, { content: [{ type: 'text', text: bad ? String((r && r.erreur) || 'Erreur') : JSON.stringify(r.resultat, null, 1) }], isError: !!bad });
  }
  return fail(id, -32601, 'Méthode inconnue : ' + method);
}

let inBuf = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (d) => {
  inBuf += d;
  let i;
  while ((i = inBuf.indexOf('\n')) >= 0) {
    const line = inBuf.slice(0, i).trim(); inBuf = inBuf.slice(i + 1);
    if (!line) continue;
    let m; try { m = JSON.parse(line); } catch (e) { fail(null, -32700, 'JSON illisible'); continue; }
    handle(m).catch((e) => fail(m && m.id, -32603, String(e && e.message || e)));
  }
});
process.stdin.on('end', () => process.exit(0));
