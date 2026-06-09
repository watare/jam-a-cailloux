(() => {
  "use strict";

  // Frontend gate. Public source = security by obscurity, OK for an invite list.
  const CODE = "SFDLM26";
  const STORE = "jamacailloux:rsvp"; // 'concert' | 'soiree' (= unlocked)

  const $  = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];

  const entry   = $('[data-step="entry"]');
  const concert = $('[data-step="concert"]');
  const soiree  = $('[data-step="soiree"]');
  const form    = $("[data-gate-form]");
  const input   = form?.querySelector("input");
  const error   = $("[data-gate-error]");

  const showStep = (key) => {
    if (!entry || !concert || !soiree) return;
    entry.hidden   = (key !== "entry");
    concert.hidden = (key !== "concert");
    soiree.hidden  = (key !== "soiree");
    try {
      if (key === "entry") localStorage.removeItem(STORE);
      else localStorage.setItem(STORE, key);
    } catch (e) {}
    if (key === "entry" && input) { input.value = ""; if (error) error.hidden = true; }
  };

  // Restore previous answer
  try {
    const prev = localStorage.getItem(STORE);
    if (prev === "concert" || prev === "soiree") showStep(prev);
  } catch (e) {}

  // Submit code
  form?.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!input) return;
    const value = (input.value || "").trim().toUpperCase().replace(/\s+/g, "");
    if (value === CODE) {
      if (error) error.hidden = true;
      entry.classList.remove("shake");
      showStep("soiree");
      setTimeout(() => soiree.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
    } else {
      if (error) error.hidden = false;
      entry.classList.remove("shake");
      void entry.offsetWidth; // restart animation
      entry.classList.add("shake");
      input.select();
    }
  });

  // Pick "no code" → concert
  $$("[data-pick]").forEach(b =>
    b.addEventListener("click", () => {
      showStep(b.dataset.pick);
      setTimeout(() => concert.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
    })
  );

  // Back to entry
  $$("[data-back]").forEach(b =>
    b.addEventListener("click", (e) => {
      e.preventDefault();
      showStep("entry");
      setTimeout(() => entry.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
    })
  );

  // Hide error as soon as user types again
  input?.addEventListener("input", () => { if (error && !error.hidden) error.hidden = true; });

  // Deep links
  const handleHash = () => {
    if (location.hash === "#rsvp-soiree") showStep("soiree");
    else if (location.hash === "#rsvp-concert") showStep("concert");
  };
  window.addEventListener("hashchange", handleHash);
  handleHash();
})();
