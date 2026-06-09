(() => {
  "use strict";

  // ── Config ────────────────────────────────────────────────────────────────
  // Frontend-only gate. Code is in clear since GitHub Pages is public — security
  // by obscurity is enough for a private invite list.
  const CODE = "SFDLM26";
  const STORE_GATE  = "jamacailloux:gate";
  const STORE_PICK  = "jamacailloux:pick";  // 'concert' | 'soiree'

  const $  = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];

  // ── RSVP chooser → flow ──────────────────────────────────────────────────
  const chooser  = $('[data-step="chooser"]');
  const concert  = $('[data-step="concert"]');
  const soiree   = $('[data-step="soiree"]');

  const showStep = (key) => {
    if (!chooser || !concert || !soiree) return;
    chooser.hidden = (key !== "chooser");
    concert.hidden = (key !== "concert");
    soiree.hidden  = (key !== "soiree");
    if (key === "chooser") {
      try { localStorage.removeItem(STORE_PICK); } catch (e) {}
    } else {
      try { localStorage.setItem(STORE_PICK, key); } catch (e) {}
    }
  };

  $$("[data-pick]").forEach(b =>
    b.addEventListener("click", () => showStep(b.dataset.pick))
  );
  $$("[data-back]").forEach(b =>
    b.addEventListener("click", (e) => { e.preventDefault(); showStep("chooser"); })
  );

  // Restore previous pick
  try {
    const prev = localStorage.getItem(STORE_PICK);
    if (prev === "concert" || prev === "soiree") showStep(prev);
  } catch (e) {}

  // Deep link from timeline: #rsvp-soiree forces the VIP flow
  const handleHash = () => {
    if (location.hash === "#rsvp-soiree") showStep("soiree");
    else if (location.hash === "#rsvp-concert") showStep("concert");
  };
  window.addEventListener("hashchange", handleHash);
  handleHash();

  // ── Gate (inside soiree flow) ─────────────────────────────────────────────
  const gate     = $("[data-gate]");
  const unlocked = $("[data-gate-unlocked]");
  const form     = $("[data-gate-form]");
  const input    = form?.querySelector("input");
  const error    = $("[data-gate-error]");
  const relock   = $("[data-gate-relock]");

  const setUnlocked = (state) => {
    if (!gate || !unlocked) return;
    gate.hidden     = !!state;
    unlocked.hidden = !state;
    try {
      if (state) localStorage.setItem(STORE_GATE, "ok");
      else localStorage.removeItem(STORE_GATE);
    } catch (e) {}
    if (!state && input) { input.value = ""; input.focus({ preventScroll: true }); }
  };

  // Restore unlock state
  try {
    if (localStorage.getItem(STORE_GATE) === "ok") setUnlocked(true);
  } catch (e) {}

  form?.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!input) return;
    const value = (input.value || "").trim().toUpperCase().replace(/\s+/g, "");
    if (value === CODE) {
      error.hidden = true;
      gate.classList.remove("shake");
      setUnlocked(true);
      setTimeout(
        () => unlocked.scrollIntoView({ behavior: "smooth", block: "start" }),
        100
      );
    } else {
      error.hidden = false;
      gate.classList.remove("shake");
      void gate.offsetWidth; // restart animation
      gate.classList.add("shake");
      input.select();
    }
  });

  relock?.addEventListener("click", () => setUnlocked(false));
  input?.addEventListener("input", () => { if (error && !error.hidden) error.hidden = true; });
})();
