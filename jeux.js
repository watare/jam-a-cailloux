(() => {
  "use strict";

  // ── Config ────────────────────────────────────────────────────────────────
  // Colle ici l'URL « /exec » du Web App Apps Script (voir tournoi-webapp.gs).
  const API_URL = "__PASTE_WEBAPP_URL__";

  const GAMES = [
    { key: "petanque",   label: "Pétanque",   icon: "🟤" },
    { key: "molkky",     label: "Mölkky",     icon: "🪵" },
    { key: "flechettes", label: "Fléchettes", icon: "🎯" },
    { key: "palet",      label: "Palet breton", icon: "🥏" }
  ];
  const GAME_BY_KEY = Object.fromEntries(GAMES.map(g => [g.key, g]));
  const POLL_MS = 25000;
  const FEED_LIMIT = 12;

  const $  = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const configured = () => API_URL && !API_URL.startsWith("__");

  // ── DOM refs ──────────────────────────────────────────────────────────────
  const setupBanner = $("[data-setup-banner]");
  const errorBanner = $("[data-error-banner]");
  const errorText   = $("[data-error-text]");
  const registerForm = $("[data-register-form]");
  const matchForm    = $("[data-match-form]");
  const teamSelect   = $("[data-team-select]");
  const gameSelect   = $("[data-game-select]");
  const globalBoard  = $("[data-global-board]");
  const podiumsEl    = $("[data-podiums]");
  const feedEl       = $("[data-feed]");

  let STATE = { teams: [], matches: [] };
  let pollTimer = null;
  let opSeq = 0; // incrémenté à chaque écriture appliquée → invalide les lectures plus anciennes

  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // ── Transport : JSONP (lecture + écriture). Robuste, zéro souci CORS. ──────
  function jsonp(params) {
    return new Promise((resolve, reject) => {
      const cb = "jam_cb_" + Math.random().toString(36).slice(2) + Date.now();
      const script = document.createElement("script");
      let timer;
      const cleanup = () => {
        delete window[cb];
        script.remove();
        clearTimeout(timer);
      };
      // > 20 s : au-dessus du plafond LockService.waitLock(20000) côté serveur,
      // pour ne pas déclarer en échec une écriture lente mais qui aboutit.
      timer = setTimeout(() => { cleanup(); reject(new Error("délai dépassé")); }, 23000);
      window[cb] = (data) => { cleanup(); resolve(data); };
      script.onerror = () => { cleanup(); reject(new Error("Échec réseau")); };
      const q = new URLSearchParams(
        Object.assign({}, params, { callback: cb, _: Date.now() })
      ).toString();
      script.src = API_URL + (API_URL.includes("?") ? "&" : "?") + q;
      document.head.appendChild(script);
    });
  }

  const api = {
    read:  () => jsonp({}),
    write: (action, payload) => jsonp(Object.assign({ action }, payload))
  };

  // Applique l'état reçu, SANS rendre : un bug d'affichage ne doit pas être
  // maquillé en « erreur serveur » (les appelants traitent les throws comme réseau).
  function setState(res) {
    if (!res || res.ok === false) throw new Error((res && res.error) || "Erreur serveur");
    STATE = { teams: res.teams || [], matches: res.matches || [] };
  }

  // Rendu isolé : un throw d'affichage est loggé + signalé comme bug d'affichage.
  function safeRender() {
    try { render(); }
    catch (e) {
      console.error("Render error", e);
      showError("Affichage des scores impossible (bug d'affichage).");
    }
  }

  // Applique le résultat d'une ÉCRITURE (réponse autoritative du serveur) et
  // invalide toute lecture (poll) partie AVANT cette écriture, pour éviter
  // qu'un vieux snapshot n'efface l'inscription/le score qu'on vient de créer.
  function applyWrite(res) {
    setState(res); // jette si ok:false
    opSeq++;
    clearError();
    stampUpdated();
    safeRender();
  }

  // ── Agrégation & classement ───────────────────────────────────────────────
  // Les scores bruts ne sont pas comparables d'un jeu à l'autre → on classe sur
  // les victoires (puis ratio de victoires, puis nombre de parties jouées).
  function aggregate() {
    const byId = {};
    STATE.teams.forEach(t => {
      const team = { id: t.id, name: t.name, players: t.players, wins: 0, played: 0, perGame: {} };
      GAMES.forEach(g => { team.perGame[g.key] = { wins: 0, played: 0, scoreSum: 0 }; });
      byId[t.id] = team;
    });
    STATE.matches.forEach(m => {
      const team = byId[m.teamId];
      const g = team && team.perGame[m.game];
      if (!g) return;
      team.played++; g.played++;
      if (m.result === "win") { team.wins++; g.wins++; }
      const s = Number(m.score);
      if (Number.isFinite(s)) g.scoreSum += s;
    });
    return byId;
  }

  const rankWins   = (a, b) => b.wins - a.wins;
  const rankRatio  = (a, b) => (b.played ? b.wins / b.played : 0) - (a.played ? a.wins / a.played : 0);
  function byRank(a, b) {
    return rankWins(a, b) || rankRatio(a, b) || (b.played - a.played) || a.name.localeCompare(b.name);
  }

  // ── Rendu ─────────────────────────────────────────────────────────────────
  function render() {
    renderTeamSelect();
    renderGlobalBoard();
    renderPodiums();
    renderFeed();
  }

  function renderTeamSelect() {
    if (!teamSelect) return;
    const prev = teamSelect.value;
    const opts = ['<option value="" disabled' + (prev ? "" : " selected") + '>— choisis ton équipe —</option>'];
    STATE.teams
      .slice()
      .sort((a, b) => String(a.name).localeCompare(String(b.name)))
      .forEach(t => {
        opts.push('<option value="' + esc(t.id) + '">' + esc(t.name) + "</option>");
      });
    teamSelect.innerHTML = opts.join("");
    if (prev && STATE.teams.some(t => t.id === prev)) teamSelect.value = prev;
  }

  function renderGlobalBoard() {
    const teams = Object.values(aggregate()).sort(byRank);
    if (!teams.length) {
      globalBoard.innerHTML = '<p class="t-empty">Aucune équipe inscrite. Crée la première&nbsp;!</p>';
      return;
    }
    const rows = teams.map((t, i) => {
      const rank = i + 1;
      const leader = rank === 1 && t.wins > 0;
      const medal = leader ? "🎁" : rank <= 3 ? ["🥇", "🥈", "🥉"][rank - 1] : rank;
      return (
        '<tr class="board__row' + (leader ? " board__row--leader" : "") + '">' +
          '<td class="board__rank">' + medal + "</td>" +
          '<td class="board__team"><span class="board__name">' + esc(t.name) + "</span>" +
            (t.players ? '<span class="board__players">' + esc(t.players) + "</span>" : "") +
          "</td>" +
          '<td class="board__wins">' + t.wins + "</td>" +
          '<td class="board__played">' + t.played + "</td>" +
        "</tr>"
      );
    }).join("");
    globalBoard.innerHTML =
      '<table class="board"><thead><tr>' +
        '<th>#</th><th>Équipe</th><th title="Victoires">V</th><th title="Parties jouées">J</th>' +
      "</tr></thead><tbody>" + rows + "</tbody></table>";
  }

  function renderPodiums() {
    const byId = aggregate();
    const teams = Object.values(byId);
    podiumsEl.innerHTML = GAMES.map(g => {
      const ranked = teams
        .filter(t => t.perGame[g.key].played > 0)
        .map(t => ({ name: t.name, wins: t.perGame[g.key].wins, played: t.perGame[g.key].played }))
        .sort(byRank)
        .slice(0, 3);
      const body = ranked.length
        ? ranked.map((t, i) =>
            '<li class="podium__row">' +
              '<span class="podium__medal">' + ["🥇", "🥈", "🥉"][i] + "</span>" +
              '<span class="podium__name">' + esc(t.name) + "</span>" +
              '<span class="podium__wins">' + t.wins + " V · " + t.played + " J</span>" +
            "</li>"
          ).join("")
        : '<li class="podium__empty">Pas encore de partie.</li>';
      return (
        '<div class="podium">' +
          '<div class="podium__head"><span class="podium__icon">' + g.icon + "</span>" + esc(g.label) + "</div>" +
          '<ol class="podium__list">' + body + "</ol>" +
        "</div>"
      );
    }).join("");
  }

  function renderFeed() {
    const matches = STATE.matches
      .slice()
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
      .slice(0, FEED_LIMIT);
    if (!matches.length) {
      feedEl.innerHTML = '<p class="t-empty">Aucune partie pour l\'instant.</p>';
      return;
    }
    feedEl.innerHTML = matches.map(m => {
      const g = GAME_BY_KEY[m.game];
      const won = m.result === "win";
      return (
        '<div class="feed__item">' +
          '<span class="feed__game" title="' + esc(g ? g.label : m.game) + '">' + (g ? g.icon : "🎲") + "</span>" +
          '<span class="feed__body">' +
            '<span class="feed__team">' + esc(m.teamName) + "</span> " +
            '<span class="feed__res feed__res--' + (won ? "win" : "lose") + '">' +
              (won ? "gagné" : "perdu") + (m.score !== "" && m.score != null ? " · " + esc(m.score) : "") +
            "</span>" +
            (m.opponent ? '<span class="feed__opp"> vs ' + esc(m.opponent) + "</span>" : "") +
          "</span>" +
          '<button type="button" class="feed__del" data-del="' + esc(m.id) + '" title="Supprimer cette partie" aria-label="Supprimer">×</button>' +
        "</div>"
      );
    }).join("");
  }

  // ── Bannières / état ──────────────────────────────────────────────────────
  function showError(msg) {
    if (errorText) errorText.textContent = msg || "Connexion au tableau des scores impossible.";
    if (errorBanner) errorBanner.hidden = false;
  }
  function clearError() { if (errorBanner) errorBanner.hidden = true; }

  function flash(el, msg, kind) {
    if (!el) return;
    el.textContent = msg;
    el.className = "t-form__msg t-form__msg--" + kind;
    el.hidden = false;
    if (kind === "ok") {
      const mark = msg;
      setTimeout(() => { if (el.textContent === mark) el.hidden = true; }, 4000);
    }
  }

  function stampUpdated() {
    const el = $("[data-stamp]");
    if (!el) return;
    const d = new Date();
    const p = (n) => String(n).padStart(2, "0");
    el.textContent = "màj " + p(d.getHours()) + ":" + p(d.getMinutes());
  }

  // Clé d'idempotence : un renvoi après timeout réseau ne crée pas de doublon.
  function newId() {
    return (window.crypto && crypto.randomUUID)
      ? crypto.randomUUID()
      : Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
  }

  // ── Chargement ────────────────────────────────────────────────────────────
  async function load() {
    if (!configured()) return;
    const seen = opSeq;
    try {
      const res = await api.read();
      if (opSeq !== seen) return; // une écriture a atterri pendant la lecture → son état est plus frais
      setState(res);
      clearError();
      stampUpdated();
      safeRender();
    } catch (e) {
      console.error("Load error", e);
      showError("Connexion instable — réessaie. " + e.message + ".");
    }
  }

  // ── Soumissions ───────────────────────────────────────────────────────────
  registerForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!ensureConfigured()) return;
    const msg = $("[data-register-msg]");
    if (msg) msg.hidden = true;
    const fields = registerForm.elements;
    const name = fields.name.value.trim();
    if (!name) { flash(msg, "Donne un nom d'équipe.", "err"); return; }
    const btn = registerForm.querySelector("button");
    btn.disabled = true;
    try {
      applyWrite(await api.write("register", { name, players: fields.players.value.trim() }));
      registerForm.reset();
      flash(msg, "Équipe « " + name + " » créée ✓", "ok");
      const created = STATE.teams.find(t => t.name === name);
      if (created && teamSelect) teamSelect.value = created.id;
    } catch (err) {
      console.error("register failed", err);
      flash(msg, err.message, "err");
    } finally {
      btn.disabled = false;
    }
  });

  matchForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!ensureConfigured()) return;
    const msg = $("[data-match-msg]");
    if (msg) msg.hidden = true;
    const fields = matchForm.elements;
    const teamId = fields.teamId.value;
    const game   = fields.game.value;
    const result = (matchForm.querySelector('input[name="result"]:checked') || {}).value;
    const score  = fields.score.value;
    if (!teamId || !game || !result) {
      flash(msg, "Choisis l'équipe, le jeu et le résultat.", "err");
      return;
    }
    const btn = matchForm.querySelector('button[type="submit"]');
    btn.disabled = true;
    try {
      applyWrite(await api.write("addMatch", {
        reqId: newId(), teamId, game, result, score,
        opponent: fields.opponent.value.trim()
      }));
      flash(msg, "Partie enregistrée ✓", "ok");
      fields.score.value = "";
      fields.opponent.value = "";
      $$('input[name="result"]', matchForm).forEach(r => { r.checked = false; });
    } catch (err) {
      console.error("addMatch failed", err);
      flash(msg, err.message, "err");
    } finally {
      btn.disabled = false;
    }
  });

  // Suppression d'une partie (édition ouverte à tous).
  feedEl?.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-del]");
    if (!btn || !ensureConfigured()) return;
    if (!confirm("Supprimer cette partie ?")) return;
    btn.disabled = true;
    try {
      applyWrite(await api.write("deleteMatch", { id: btn.dataset.del }));
    } catch (err) {
      console.error("deleteMatch failed", err);
      showError("Suppression impossible : " + err.message + ".");
    } finally {
      btn.disabled = false;
    }
  });

  $("[data-refresh]")?.addEventListener("click", load);
  $("[data-retry]")?.addEventListener("click", () => { clearError(); load(); });

  function ensureConfigured() {
    if (configured()) return true;
    if (setupBanner) setupBanner.hidden = false;
    return false;
  }

  // ── Init ──────────────────────────────────────────────────────────────────
  function init() {
    // Remplit le select des jeux.
    if (gameSelect) {
      GAMES.forEach(g => {
        const o = document.createElement("option");
        o.value = g.key;
        o.textContent = g.icon + " " + g.label;
        gameSelect.appendChild(o);
      });
    }
    if (!configured()) {
      if (setupBanner) setupBanner.hidden = false;
      render(); // affiche les états vides
      return;
    }
    load();
    pollTimer = setInterval(load, POLL_MS);
    // Pause le polling quand l'onglet est caché (économie batterie en soirée).
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) { clearInterval(pollTimer); pollTimer = null; }
      else if (!pollTimer) { load(); pollTimer = setInterval(load, POLL_MS); }
    });
  }

  init();
})();
