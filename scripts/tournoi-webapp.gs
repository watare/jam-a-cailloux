/**
 * tournoi-webapp.gs — Backend « Tournoi des jeux » de Jam à Cailloux
 *
 * Stocke les équipes et les résultats dans une Google Sheet, et expose un petit
 * Web App que la page statique jeux.html appelle (lecture + écriture).
 *
 * ── Déploiement (une seule fois) ──────────────────────────────────────────
 *  1. Coller ce fichier dans un projet Apps Script (script.google.com).
 *  2. Lancer setup() une fois → crée la Sheet (accepter les autorisations).
 *  3. Déployer > Nouveau déploiement > type « Application Web »
 *       - Exécuter en tant que : moi
 *       - Qui a accès        : tout le monde
 *     Copier l'URL qui finit par /exec.
 *  4. Coller cette URL dans API_URL en haut de jeux.js, commit, push.
 *
 *  Après une modification du code : Déployer > Gérer les déploiements >
 *  (crayon) > Nouvelle version. L'URL /exec reste la même.
 *
 * ── Modèle de données ─────────────────────────────────────────────────────
 *  Onglet Teams   : id | name | players | createdAt
 *  Onglet Matches : id | reqId | teamId | teamName | game | result | score | opponent | createdAt
 *
 * Édition ouverte à tous (pas de PIN) : n'importe qui peut ajouter/supprimer.
 * La Sheet reste la source de vérité — l'orga peut nettoyer à la main.
 */

const PROP_KEY = 'TOURNOI_SHEET_ID';
const GAMES    = ['petanque', 'molkky', 'flechettes', 'palet'];
const RESULTS  = ['win', 'lose'];

const TEAMS_HEADERS   = ['id', 'name', 'players', 'createdAt'];
const MATCHES_HEADERS = ['id', 'reqId', 'teamId', 'teamName', 'game', 'result', 'score', 'opponent', 'createdAt'];


// === Setup ================================================================

/** À lancer UNE fois pour créer la Sheet. Idempotent : relançable sans risque. */
function setup() {
  const props = PropertiesService.getScriptProperties();
  let id = props.getProperty(PROP_KEY);
  let ss;
  if (id) {
    ss = SpreadsheetApp.openById(id);
  } else {
    ss = SpreadsheetApp.create('Jam à Cailloux — Tournoi des jeux');
    id = ss.getId();
    props.setProperty(PROP_KEY, id);
  }
  ensureSheet_(ss, 'Teams', TEAMS_HEADERS);
  ensureSheet_(ss, 'Matches', MATCHES_HEADERS);
  // Supprime l'onglet par défaut vide (« Sheet1 » / « Feuille 1 ») s'il reste.
  ss.getSheets().forEach(function (sh) {
    const n = sh.getName();
    if (n !== 'Teams' && n !== 'Matches' && sh.getLastRow() === 0) ss.deleteSheet(sh);
  });
  Logger.log('Sheet prête : %s', ss.getUrl());
  return ss.getUrl();
}

function ensureSheet_(ss, name, headers) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  const first = sh.getRange(1, 1, 1, headers.length).getValues()[0];
  const empty = first.every(function (c) { return c === '' || c === null; });
  if (empty) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}


// === Endpoints ============================================================

/** Lecture (et écriture en repli) via JSONP. ?callback=fn → renvoie fn({...}). */
function doGet(e) {
  const p = (e && e.parameter) || {};
  const callback = p.callback || '';
  try {
    const result = p.action ? handleAction_(p.action, p) : okState_();
    return jsonOut_(result, callback);
  } catch (err) {
    return jsonOut_({ ok: false, error: errMsg_(err) }, callback);
  }
}

/** Écriture via POST text/plain (corps JSON). Voie alternative au JSONP. */
function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    return jsonOut_(handleAction_(body.action, body), '');
  } catch (err) {
    return jsonOut_({ ok: false, error: errMsg_(err) }, '');
  }
}


// === Actions ==============================================================

function handleAction_(action, data) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    if (action === 'register')    return registerTeam_(data);
    if (action === 'addMatch')    return addMatch_(data);
    if (action === 'deleteMatch') return deleteMatch_(data);
    throw new Error('Action inconnue : ' + action);
  } finally {
    lock.releaseLock();
  }
}

function registerTeam_(data) {
  const name = String(data.name || '').trim();
  if (!name) throw new Error('Nom d\'équipe requis');
  if (name.length > 60) throw new Error('Nom trop long (60 caractères max)');
  const sheet = getSheet_('Teams');
  const exists = rowsToObjects_(sheet).some(function (t) {
    return String(t.name).toLowerCase() === name.toLowerCase();
  });
  if (exists) throw new Error('Une équipe porte déjà ce nom');
  sheet.appendRow([
    Utilities.getUuid(),
    name,
    String(data.players || '').trim().slice(0, 200),
    new Date().toISOString()
  ]);
  return okState_();
}

function addMatch_(data) {
  const teamId = String(data.teamId || '').trim();
  const game   = String(data.game || '').trim();
  const result = String(data.result || '').trim();
  const reqId  = String(data.reqId || '').trim();
  if (!teamId) throw new Error('Équipe requise');
  if (GAMES.indexOf(game) === -1) throw new Error('Jeu invalide');
  if (RESULTS.indexOf(result) === -1) throw new Error('Résultat invalide (gagné/perdu)');

  const matchesSheet = getSheet_('Matches');
  // Idempotence : un renvoi après timeout réseau (même reqId) ne crée pas de doublon.
  if (reqId && rowsToObjects_(matchesSheet).some(function (m) { return String(m.reqId) === reqId; })) {
    return okState_();
  }

  const team = rowsToObjects_(getSheet_('Teams')).find(function (t) { return t.id === teamId; });
  if (!team) throw new Error('Équipe introuvable');

  const score = Number(data.score);
  matchesSheet.appendRow([
    Utilities.getUuid(),
    reqId,
    teamId,
    team.name,
    game,
    result,
    isFinite(score) ? score : '',
    String(data.opponent || '').trim().slice(0, 60),
    new Date().toISOString()
  ]);
  return okState_();
}

function deleteMatch_(data) {
  const id = String(data.id || '').trim();
  if (!id) throw new Error('id requis');
  const sheet = getSheet_('Matches');
  const values = sheet.getDataRange().getValues();
  let found = false;
  for (let r = values.length - 1; r >= 1; r--) {
    if (String(values[r][0]) === id) { sheet.deleteRow(r + 1); found = true; break; }
  }
  if (!found) throw new Error('Partie introuvable (déjà supprimée ?)');
  return okState_();
}


// === Helpers ==============================================================

function okState_() {
  return {
    ok: true,
    teams:   rowsToObjects_(getSheet_('Teams')),
    matches: rowsToObjects_(getSheet_('Matches'))
  };
}

function getSpreadsheet_() {
  const id = PropertiesService.getScriptProperties().getProperty(PROP_KEY);
  if (!id) throw new Error('Sheet non initialisée — lance setup() une fois.');
  return SpreadsheetApp.openById(id);
}

function getSheet_(name) {
  const sh = getSpreadsheet_().getSheetByName(name);
  if (!sh) throw new Error('Onglet manquant : ' + name + ' (relance setup()).');
  return sh;
}

function rowsToObjects_(sheet) {
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0];
  const out = [];
  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    if (row.every(function (c) { return c === '' || c === null; })) continue;
    const obj = {};
    for (let c = 0; c < headers.length; c++) obj[headers[c]] = row[c];
    out.push(obj);
  }
  return out;
}

function jsonOut_(obj, callback) {
  if (callback) {
    return ContentService
      .createTextOutput(callback + '(' + JSON.stringify(obj) + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function errMsg_(err) {
  return String((err && err.message) || err);
}
