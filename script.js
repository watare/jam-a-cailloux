(() => {
  "use strict";

  // ── Gate code ─────────────────────────────────────────────────────────────
  // Frontend-only gate: this code-source is public on GitHub Pages. The aim is
  // "private invitations seulement", pas un secret cryptographique.
  const CODE = "SFDLM26";
  const STORE_KEY = "jamacailloux:gate";

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];

  // ── Tabs (concert / soirée) ──────────────────────────────────────────────
  const tabs = $$(".rsvp__tab");
  const panels = $$(".rsvp__panel");
  const showTab = (key) => {
    tabs.forEach(t => {
      const active = t.dataset.tab === key;
      t.classList.toggle("is-active", active);
      t.setAttribute("aria-selected", active ? "true" : "false");
    });
    panels.forEach(p => {
      const active = p.dataset.panel === key;
      p.classList.toggle("is-visible", active);
      p.setAttribute("aria-hidden", active ? "false" : "true");
    });
  };
  tabs.forEach(t => t.addEventListener("click", () => showTab(t.dataset.tab)));

  // ── Gate state ────────────────────────────────────────────────────────────
  const gate = $("[data-gate]");
  const unlocked = $("[data-gate-unlocked]");
  const form = $("[data-gate-form]");
  const input = form?.querySelector("input");
  const error = $("[data-gate-error]");
  const relock = $("[data-gate-relock]");

  const setUnlocked = (state) => {
    if (!gate || !unlocked) return;
    if (state) {
      gate.hidden = true;
      unlocked.hidden = false;
      try { localStorage.setItem(STORE_KEY, "ok"); } catch (e) {}
    } else {
      gate.hidden = false;
      unlocked.hidden = true;
      try { localStorage.removeItem(STORE_KEY); } catch (e) {}
      if (input) { input.value = ""; input.focus({ preventScroll: true }); }
    }
  };

  // Restore previous unlock
  try {
    if (localStorage.getItem(STORE_KEY) === "ok") setUnlocked(true);
  } catch (e) {}

  // Submit
  form?.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!input) return;
    const value = (input.value || "").trim().toUpperCase().replace(/\s+/g, "");
    if (value === CODE) {
      error.hidden = true;
      gate.classList.remove("shake");
      setUnlocked(true);
      // Scroll soirée tab into view
      showTab("soiree");
      setTimeout(() => unlocked.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
    } else {
      error.hidden = false;
      gate.classList.remove("shake");
      // Restart animation
      void gate.offsetWidth;
      gate.classList.add("shake");
      input.select();
    }
  });

  // Relock
  relock?.addEventListener("click", () => setUnlocked(false));

  // Hide error as soon as user types again
  input?.addEventListener("input", () => { if (!error.hidden) error.hidden = true; });

  // ── Deep link: #soiree ouvre l'onglet ─────────────────────────────────────
  const handleHash = () => {
    if (location.hash === "#soiree") showTab("soiree");
  };
  window.addEventListener("hashchange", handleHash);
  handleHash();
})();
