"use strict";
/**
 * server.js — Backend « Tournoi des jeux » de Jam à Cailloux (VPS, derrière nginx).
 *
 * Remplace le Web App Apps Script. MÊME contrat que scripts/tournoi-webapp.gs :
 * GET (ou POST) avec un paramètre `action` ; réponse JSON, ou JSONP si `?callback=`.
 * Donc le client jeux.js est inchangé — seule API_URL pointe ici.
 *
 * Zéro dépendance (node:http/crypto/fs). Stockage : un fichier JSON, écritures
 * atomiques (tmp + rename), sérialisées par la boucle d'événements mono-thread.
 *
 * Lancé par pm2 :  PORT=8791 DATA=/home/ubuntu/cailloux/data.json pm2 start server.js --name cailloux
 */

const http = require("node:http");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const PORT = Number(process.env.PORT || 8791);
const HOST = process.env.HOST || "127.0.0.1";
const DATA = process.env.DATA || path.join(__dirname, "data.json");

const GAMES = ["petanque", "molkky", "flechettes", "palet"];
const RESULTS = ["win", "lose"];

// ── Store (fichier JSON, écriture atomique) ────────────────────────────────
function load() {
  try {
    const raw = JSON.parse(fs.readFileSync(DATA, "utf8"));
    return { teams: raw.teams || [], matches: raw.matches || [] };
  } catch (_) {
    return { teams: [], matches: [] };
  }
}
let store = load();

function persist() {
  const tmp = DATA + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(store), "utf8");
  fs.renameSync(tmp, DATA); // atomique sur le même filesystem
}

// ── Actions (mêmes règles que le .gs) ──────────────────────────────────────
function okState() {
  return { ok: true, teams: store.teams, matches: store.matches };
}

function registerTeam(p) {
  const name = String(p.name || "").trim();
  if (!name) throw new Error("Nom d'équipe requis");
  if (name.length > 60) throw new Error("Nom trop long (60 caractères max)");
  if (store.teams.some((t) => String(t.name).toLowerCase() === name.toLowerCase())) {
    throw new Error("Une équipe porte déjà ce nom");
  }
  store.teams.push({
    id: crypto.randomUUID(),
    name,
    players: String(p.players || "").trim().slice(0, 200),
    createdAt: new Date().toISOString(),
  });
  persist();
  return okState();
}

function addMatch(p) {
  const teamId = String(p.teamId || "").trim();
  const game = String(p.game || "").trim();
  const result = String(p.result || "").trim();
  const reqId = String(p.reqId || "").trim();
  if (!teamId) throw new Error("Équipe requise");
  if (!GAMES.includes(game)) throw new Error("Jeu invalide");
  if (!RESULTS.includes(result)) throw new Error("Résultat invalide (gagné/perdu)");

  // Idempotence : un renvoi après timeout réseau (même reqId) ne crée pas de doublon.
  if (reqId && store.matches.some((m) => String(m.reqId) === reqId)) return okState();

  const team = store.teams.find((t) => t.id === teamId);
  if (!team) throw new Error("Équipe introuvable");

  const score = Number(p.score);
  store.matches.push({
    id: crypto.randomUUID(),
    reqId,
    teamId,
    teamName: team.name,
    game,
    result,
    score: Number.isFinite(score) ? score : "",
    opponent: String(p.opponent || "").trim().slice(0, 60),
    createdAt: new Date().toISOString(),
  });
  persist();
  return okState();
}

function deleteMatch(p) {
  const id = String(p.id || "").trim();
  if (!id) throw new Error("id requis");
  const before = store.matches.length;
  store.matches = store.matches.filter((m) => String(m.id) !== id);
  if (store.matches.length === before) throw new Error("Partie introuvable (déjà supprimée ?)");
  persist();
  return okState();
}

function handle(action, params) {
  if (!action) return okState();
  if (action === "register") return registerTeam(params);
  if (action === "addMatch") return addMatch(params);
  if (action === "deleteMatch") return deleteMatch(params);
  throw new Error("Action inconnue : " + action);
}

// ── HTTP ───────────────────────────────────────────────────────────────────
function send(res, status, body, callback) {
  const headers = { "Access-Control-Allow-Origin": "*", "Cache-Control": "no-store" };
  if (callback) {
    headers["Content-Type"] = "application/javascript; charset=utf-8";
    res.writeHead(status, headers);
    res.end(callback + "(" + JSON.stringify(body) + ")");
  } else {
    headers["Content-Type"] = "application/json; charset=utf-8";
    res.writeHead(status, headers);
    res.end(JSON.stringify(body));
  }
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (c) => {
      data += c;
      if (data.length > 1e6) req.destroy(); // garde-fou
    });
    req.on("end", () => {
      try { resolve(data ? JSON.parse(data) : {}); }
      catch (_) { resolve({}); }
    });
    req.on("error", () => resolve({}));
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  const query = Object.fromEntries(url.searchParams.entries());
  const callback = query.callback || "";

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
    });
    return res.end();
  }

  // Healthcheck simple.
  if (url.pathname === "/health") return send(res, 200, { ok: true, status: "up" }, callback);

  try {
    const params = req.method === "POST"
      ? Object.assign({}, query, await readBody(req))
      : query;
    send(res, 200, handle(params.action, params), callback);
  } catch (err) {
    // 200 + ok:false : le client lit l'erreur dans le corps (le JSONP n'a pas de status).
    send(res, 200, { ok: false, error: String((err && err.message) || err) }, callback);
  }
});

server.listen(PORT, HOST, () => {
  console.log(`cailloux tournoi backend → http://${HOST}:${PORT}  (data: ${DATA})`);
});
