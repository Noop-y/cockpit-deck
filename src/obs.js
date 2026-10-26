// The Deck — connexion à OBS Studio (protocole obs-websocket v5, intégré à OBS 28 et plus)
'use strict';

const OBS = (() => {
  let ws = null;
  let pending = {};
  let reqId = 0;
  let listeners = [];
  const state = { status: 'off', message: '', scenes: [], inputs: [], currentScene: '' };

  const emit = () => listeners.forEach(fn => { try { fn(state); } catch (e) { /* ignoré */ } });

  async function sha256b64(text) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    let bin = '';
    new Uint8Array(buf).forEach(b => { bin += String.fromCharCode(b); });
    return btoa(bin);
  }

  function request(requestType, requestData) {
    return new Promise((resolve, reject) => {
      if (!ws || ws.readyState !== 1 || state.status !== 'on') { reject(new Error('OBS n’est pas connecté.')); return; }
      const requestId = 'r' + (++reqId);
      pending[requestId] = { resolve, reject };
      ws.send(JSON.stringify({ op: 6, d: { requestType, requestId, requestData: requestData || {} } }));
      setTimeout(() => { if (pending[requestId]) { delete pending[requestId]; reject(new Error('OBS ne répond pas.')); } }, 5000);
    });
  }

  async function refreshLists() {
    try {
      const s = await request('GetSceneList');
      state.scenes = (s.scenes || []).slice().sort((a, b) => b.sceneIndex - a.sceneIndex).map(x => x.sceneName);
      state.currentScene = s.currentProgramSceneName || '';
      const i = await request('GetInputList');
      state.inputs = (i.inputs || []).map(x => x.inputName);
    } catch (e) { /* ignoré */ }
    emit();
  }

  function connect({ host, port, password }) {
    disconnect();
    state.status = 'connecting'; state.message = 'Connexion…'; emit();
    let url = `ws://${host || '127.0.0.1'}:${port || 4455}`;
    try { ws = new WebSocket(url); } catch (e) { state.status = 'error'; state.message = 'Adresse invalide.'; emit(); return; }
    ws.onmessage = async (ev) => {
      let msg; try { msg = JSON.parse(ev.data); } catch (e) { return; }
      const { op, d } = msg;
      if (op === 0) { // Hello
        const identify = { rpcVersion: 1, eventSubscriptions: 4 | 8 | 64 | 128 };
        if (d.authentication) {
          if (!password) { state.status = 'error'; state.message = 'OBS demande un mot de passe.'; emit(); ws.close(); return; }
          const secret = await sha256b64(password + d.authentication.salt);
          identify.authentication = await sha256b64(secret + d.authentication.challenge);
        }
        ws.send(JSON.stringify({ op: 1, d: identify }));
      } else if (op === 2) { // Identified
        state.status = 'on'; state.message = 'Connecté'; emit();
        refreshLists();
      } else if (op === 7) { // réponse
        const p = pending[d.requestId];
        if (!p) return;
        delete pending[d.requestId];
        if (d.requestStatus && d.requestStatus.result) p.resolve(d.responseData || {});
        else p.reject(new Error((d.requestStatus && d.requestStatus.comment) || 'Erreur OBS'));
      } else if (op === 5) { // événement
        if (d.eventType === 'CurrentProgramSceneChanged') { state.currentScene = d.eventData.sceneName; emit(); }
        if (d.eventType === 'SceneListChanged' || d.eventType === 'InputCreated' || d.eventType === 'InputRemoved' || d.eventType === 'InputNameChanged' || d.eventType === 'SceneNameChanged') refreshLists();
      }
    };
    ws.onclose = (ev) => {
      const prev = state.status;
      if (prev === 'connecting' || prev === 'on') {
        state.status = 'error';
        state.message = ev.code === 4009 ? 'Mot de passe refusé par OBS.' : (prev === 'on' ? 'Connexion perdue.' : 'OBS est fermé ou le serveur WebSocket n’est pas activé.');
      }
      emit();
    };
    ws.onerror = () => { /* géré par onclose */ };
  }

  function disconnect() {
    if (ws) { try { ws.onclose = null; ws.close(); } catch (e) { /* ignoré */ } }
    ws = null; pending = {};
    state.status = 'off'; state.message = ''; emit();
  }

  // Exécute l'action OBS d'une case
  async function run(action) {
    const op = action.op;
    const t = action.target || '';
    if (op === 'scene') return request('SetCurrentProgramScene', { sceneName: t });
    if (op === 'mute') return request('ToggleInputMute', { inputName: t });
    if (op === 'stream') return request('ToggleStream');
    if (op === 'record') return request('ToggleRecord');
    if (op === 'replay') return request('SaveReplayBuffer');
    if (op === 'source') {
      const sceneName = action.scene || state.currentScene;
      const item = await request('GetSceneItemId', { sceneName, sourceName: t });
      const cur = await request('GetSceneItemEnabled', { sceneName, sceneItemId: item.sceneItemId });
      return request('SetSceneItemEnabled', { sceneName, sceneItemId: item.sceneItemId, sceneItemEnabled: !cur.sceneItemEnabled });
    }
    throw new Error('Action OBS inconnue.');
  }

  return { connect, disconnect, run, state, onChange: (fn) => listeners.push(fn) };
})();
