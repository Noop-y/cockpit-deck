// Cockpit Deck — pilotage de Discord par sa connexion locale (RPC, tube nommé discord-ipc)
// Micro, casque, micro + casque, choix des entrées et sorties audio.
'use strict';

const net = require('net');
const fs = require('fs');
const crypto = require('crypto');
const { EventEmitter } = require('events');

const SCOPES = ['rpc', 'rpc.voice.read', 'rpc.voice.write'];
const REDIRECT = 'http://localhost';
const OP = { HANDSHAKE: 0, FRAME: 1, CLOSE: 2, PING: 3, PONG: 4 };

function blankState() {
  return { status: 'off', message: '', mute: false, deaf: false, outVolume: 100, inputId: '', outputId: '', inputs: [], outputs: [] };
}

class DiscordRPC extends EventEmitter {
  constructor(tokenFile) {
    super();
    this.tokenFile = tokenFile;
    this.sock = null;
    this.buf = Buffer.alloc(0);
    this.pending = new Map();
    this.state = blankState();
    this.savedVolume = 100;
    this.auto = false;
    this.retryTimer = null;
    this.creds = null;
  }

  set(patch) { Object.assign(this.state, patch); this.emit('state', this.state); }

  // ---------- connexion au tube de Discord ----------
  pipePath(i) {
    if (process.platform === 'win32') return `\\\\?\\pipe\\discord-ipc-${i}`;
    const dir = process.env.XDG_RUNTIME_DIR || process.env.TMPDIR || process.env.TMP || '/tmp';
    return `${dir.replace(/\/$/, '')}/discord-ipc-${i}`;
  }

  openPipe() {
    return new Promise((resolve, reject) => {
      const tryOne = (i) => {
        if (i > 9) { reject(new Error('Discord n’est pas lancé sur ce PC.')); return; }
        const s = net.createConnection(this.pipePath(i));
        s.once('connect', () => { s.removeAllListeners('error'); resolve(s); });
        s.once('error', () => { s.destroy(); tryOne(i + 1); });
      };
      tryOne(0);
    });
  }

  send(op, data) {
    if (!this.sock) return;
    const json = Buffer.from(JSON.stringify(data), 'utf8');
    const head = Buffer.alloc(8);
    head.writeUInt32LE(op, 0);
    head.writeUInt32LE(json.length, 4);
    this.sock.write(Buffer.concat([head, json]));
  }

  onData(chunk) {
    this.buf = Buffer.concat([this.buf, chunk]);
    while (this.buf.length >= 8) {
      const op = this.buf.readUInt32LE(0);
      const len = this.buf.readUInt32LE(4);
      if (this.buf.length < 8 + len) break;
      let msg = null;
      try { msg = JSON.parse(this.buf.slice(8, 8 + len).toString('utf8')); } catch (e) { msg = null; }
      this.buf = this.buf.slice(8 + len);
      if (msg) this.onMessage(op, msg);
    }
  }

  onMessage(op, msg) {
    if (op === OP.PING) { this.send(OP.PONG, msg); return; }
    if (op === OP.CLOSE) {
      this.closeReason = msg.code === 4000 ? 'Client ID refusé par Discord : vérifiez-le.' : (msg.message || 'Discord a fermé la connexion.');
      if (this.readyWait) this.readyWait.reject(new Error(this.closeReason));
      return;
    }
    if (op !== OP.FRAME) return;
    if (msg.cmd === 'DISPATCH') {
      if (msg.evt === 'READY' && this.readyWait) this.readyWait.resolve();
      if (msg.evt === 'VOICE_SETTINGS_UPDATE') this.applyVoice(msg.data);
      return;
    }
    const p = msg.nonce && this.pending.get(msg.nonce);
    if (!p) return;
    this.pending.delete(msg.nonce);
    clearTimeout(p.timer);
    if (msg.evt === 'ERROR') p.reject(new Error((msg.data && msg.data.message) || 'Erreur Discord'));
    else p.resolve(msg.data || {});
  }

  request(cmd, args, evt, timeoutMs) {
    return new Promise((resolve, reject) => {
      if (!this.sock) { reject(new Error('Discord n’est pas connecté.')); return; }
      const nonce = crypto.randomUUID();
      const timer = setTimeout(() => {
        if (this.pending.has(nonce)) { this.pending.delete(nonce); reject(new Error(cmd === 'AUTHORIZE' ? 'Demande non acceptée dans Discord (délai dépassé).' : 'Discord ne répond pas.')); }
      }, timeoutMs || 10000);
      this.pending.set(nonce, { resolve, reject, timer });
      const frame = { cmd, args: args || {}, nonce };
      if (evt) frame.evt = evt;
      this.send(OP.FRAME, frame);
    });
  }

  // ---------- jeton d'accès (OAuth2) ----------
  readToken() { try { return JSON.parse(fs.readFileSync(this.tokenFile, 'utf8')); } catch (e) { return null; } }
  saveToken(t) { try { fs.writeFileSync(this.tokenFile, JSON.stringify(t)); } catch (e) { /* ignoré */ } }

  async tokenRequest(params) {
    const post = async (withRedirect) => {
      const body = new URLSearchParams(Object.assign({ client_id: this.creds.clientId, client_secret: this.creds.clientSecret }, params));
      if (withRedirect) body.set('redirect_uri', REDIRECT);
      const res = await fetch('https://discord.com/api/oauth2/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
      let j = {};
      try { j = await res.json(); } catch (e) { /* ignoré */ }
      return { ok: res.ok, j };
    };
    let r = await post(params.grant_type === 'authorization_code');
    if (!r.ok && params.grant_type === 'authorization_code') r = await post(false);
    if (!r.ok) {
      const e = r.j.error || '';
      if (e === 'invalid_client') throw new Error('Client Secret refusé par Discord : recopiez-le.');
      if (e === 'invalid_grant') throw new Error('Discord refuse l’accès : ajoutez http://localhost dans OAuth2 › Redirects de votre application.');
      throw new Error('Échange du jeton refusé (' + (r.j.error_description || e || 'erreur inconnue') + ').');
    }
    const t = { clientId: this.creds.clientId, access_token: r.j.access_token, refresh_token: r.j.refresh_token, expires_at: Date.now() + (r.j.expires_in || 604800) * 1000 };
    this.saveToken(t);
    return t;
  }

  async authenticate() {
    let tok = this.readToken();
    if (tok && tok.clientId === this.creds.clientId) {
      if (tok.expires_at < Date.now() + 3600 * 1000 && tok.refresh_token) {
        tok = await this.tokenRequest({ grant_type: 'refresh_token', refresh_token: tok.refresh_token }).catch(() => null);
      }
      if (tok) {
        try { await this.request('AUTHENTICATE', { access_token: tok.access_token }); return; } catch (e) { /* jeton périmé : on redemande */ }
      }
    }
    this.set({ status: 'auth', message: 'Acceptez la demande dans la fenêtre de Discord…' });
    const r = await this.request('AUTHORIZE', { client_id: this.creds.clientId, scopes: SCOPES }, null, 120000);
    tok = await this.tokenRequest({ grant_type: 'authorization_code', code: r.code });
    await this.request('AUTHENTICATE', { access_token: tok.access_token });
  }

  // ---------- connexion complète ----------
  async connect(creds, auto) {
    this.disconnect(true);
    this.creds = creds;
    this.auto = !!auto;
    if (!creds || !creds.clientId || !creds.clientSecret) {
      this.set({ status: 'error', message: 'Renseignez le Client ID et le Client Secret.' });
      return this.state;
    }
    this.set({ status: 'connecting', message: 'Connexion à Discord…' });
    try {
      this.sock = await this.openPipe();
      this.buf = Buffer.alloc(0);
      this.closeReason = '';
      this.sock.on('data', (c) => this.onData(c));
      this.sock.on('close', () => this.onClose());
      this.sock.on('error', () => { /* géré par close */ });
      const ready = new Promise((resolve, reject) => { this.readyWait = { resolve, reject }; });
      const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Discord ne répond pas.')), 10000));
      this.send(OP.HANDSHAKE, { v: 1, client_id: creds.clientId });
      await Promise.race([ready, timeout]);
      this.readyWait = null;
      await this.authenticate();
      const v = await this.request('GET_VOICE_SETTINGS');
      this.applyVoice(v);
      await this.request('SUBSCRIBE', {}, 'VOICE_SETTINGS_UPDATE').catch(() => {});
      this.set({ status: 'on', message: 'Connecté' });
    } catch (e) {
      const msg = this.closeReason || e.message;
      this.disconnect(true);
      this.set({ status: 'error', message: msg });
      this.scheduleRetry();
    }
    return this.state;
  }

  onClose() {
    const was = this.state.status;
    this.sock = null;
    this.pending.forEach(p => { clearTimeout(p.timer); p.reject(new Error('Connexion à Discord perdue.')); });
    this.pending.clear();
    if (was === 'on') {
      this.set({ status: 'error', message: 'Discord a été fermé.' });
      this.scheduleRetry();
    }
  }

  scheduleRetry() {
    clearTimeout(this.retryTimer);
    if (!this.auto || !this.creds) return;
    this.retryTimer = setTimeout(() => { if (this.state.status !== 'on') this.connect(this.creds, true); }, 15000);
  }

  disconnect(silent) {
    clearTimeout(this.retryTimer);
    if (this.sock) { const s = this.sock; this.sock = null; try { s.removeAllListeners('close'); s.destroy(); } catch (e) { /* ignoré */ } }
    this.pending.forEach(p => clearTimeout(p.timer));
    this.pending.clear();
    if (!silent) { this.auto = false; this.state = blankState(); this.emit('state', this.state); }
  }

  // ---------- réglages vocaux ----------
  applyVoice(d) {
    if (!d) return;
    const patch = {};
    if (typeof d.mute === 'boolean') patch.mute = d.mute;
    if (typeof d.deaf === 'boolean') patch.deaf = d.deaf;
    const list = (arr) => (arr || []).map(x => ({ id: x.id, name: x.id === 'default' ? 'Par défaut (Windows)' : x.name }));
    if (d.input) {
      if (d.input.device_id != null) patch.inputId = d.input.device_id;
      if (d.input.available_devices) patch.inputs = list(d.input.available_devices);
    }
    if (d.output) {
      if (d.output.device_id != null) patch.outputId = d.output.device_id;
      if (d.output.available_devices) patch.outputs = list(d.output.available_devices);
      if (typeof d.output.volume === 'number') {
        patch.outVolume = d.output.volume;
        if (d.output.volume > 0) this.savedVolume = d.output.volume;
      }
    }
    this.set(patch);
  }

  async setVoice(args) {
    const r = await this.request('SET_VOICE_SETTINGS', args);
    this.applyVoice(r);
    return r;
  }

  // Exécute une action Discord. op : micro, casque, tout, entree-suiv, sortie-suiv, entree, sortie
  async run(op, arg) {
    if (this.state.status !== 'on') throw new Error('Discord n’est pas connecté (menu Discord).');
    const s = this.state;
    const next = (list, cur) => { if (!list.length) return null; const i = list.findIndex(x => x.id === cur); return list[(i + 1) % list.length]; };
    switch (op) {
      case 'micro':
        // micro seul : si tout est coupé, on rétablit tout pour pouvoir parler
        if (s.deaf) await this.setVoice({ deaf: false, mute: false });
        else await this.setVoice({ mute: !s.mute });
        return s.mute ? 'Micro coupé' : 'Micro ouvert';
      case 'casque':
        // casque seul : Discord ne sait pas « sourdine sans micro coupé », on met le volume de sortie à zéro
        if (s.outVolume > 0) { this.savedVolume = s.outVolume; await this.setVoice({ output: { volume: 0 } }); }
        else await this.setVoice({ output: { volume: this.savedVolume || 100 } });
        return s.outVolume > 0 ? 'Casque rétabli' : 'Casque coupé';
      case 'tout':
        await this.setVoice({ deaf: !s.deaf });
        return s.deaf ? 'Micro et casque coupés' : 'Micro et casque rétablis';
      case 'entree-suiv': {
        const d = next(s.inputs, s.inputId);
        if (!d) throw new Error('Aucune entrée audio trouvée.');
        await this.setVoice({ input: { device_id: d.id } });
        return 'Entrée : ' + d.name;
      }
      case 'sortie-suiv': {
        const d = next(s.outputs, s.outputId);
        if (!d) throw new Error('Aucune sortie audio trouvée.');
        await this.setVoice({ output: { device_id: d.id } });
        return 'Sortie : ' + d.name;
      }
      case 'entree':
        if (!arg) throw new Error('Choisissez une entrée audio.');
        await this.setVoice({ input: { device_id: arg } });
        return 'Entrée changée';
      case 'sortie':
        if (!arg) throw new Error('Choisissez une sortie audio.');
        await this.setVoice({ output: { device_id: arg } });
        return 'Sortie changée';
      default:
        throw new Error('Action Discord inconnue.');
    }
  }
}

module.exports = { DiscordRPC };
