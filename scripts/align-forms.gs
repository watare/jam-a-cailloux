/**
 * align-forms.gs
 *
 * Aligne les 2 Google Forms de la Fête de la Musique sur le nouveau modèle :
 *  - Form CONCERT (sans code) : aprèm + concert + apéro
 *  - Form ALL-IN  (avec code) : tout ce qui précède PLUS la partie soirée DJ
 *
 * Marche à suivre
 * ---------------
 *   1. https://script.google.com → "Nouveau projet"
 *   2. Coller tout ce fichier
 *   3. Cmd/Ctrl+S pour sauvegarder
 *   4. Sélectionner la fonction `alignBothForms` en haut, cliquer ▶ Exécuter
 *   5. Autoriser (ton compte gmail, c'est tes forms)
 *   6. Voir le journal : Affichage → Journaux (Ctrl/Cmd+Enter)
 *
 * Sécurité
 * --------
 *  - DRY_RUN = true  → le script LISTE ce qu'il ferait, ne touche à RIEN.
 *    Mode par défaut. Lance une 1re fois en DRY_RUN, vérifie les logs, puis
 *    repasse à false pour exécuter pour de vrai.
 *  - Avant tout `deleteItem`, le script dumpe les questions existantes du form
 *    All-in dans les logs. Si quoi que ce soit foire, le contenu est récupérable
 *    depuis là.
 */

// === RÉGLAGES ============================================================
const DRY_RUN = true;   // ← passe à false pour exécuter pour de vrai

// URLs publiques utilisées par la landing https://watare.github.io/jam-a-cailloux/
const PUB_CONCERT = 'https://docs.google.com/forms/d/e/1FAIpQLSdOqh5eXl-ow2SegsYjygSUpzDZbPFfihfnnBCIeulAiGi61g/viewform';
const PUB_ALLIN   = 'https://docs.google.com/forms/d/e/1FAIpQLSeVabP6H6YrMOpgJKGKN2YLLNiCk-tyzwAdfRiM0cdzSsxMLQ/viewform';


/** Entrée principale. */
function alignBothForms() {
  Logger.log('=== alignBothForms (DRY_RUN=%s) ===', DRY_RUN);

  const allInId   = findFormIdByPublishedUrl_(PUB_ALLIN);
  const concertId = findFormIdByPublishedUrl_(PUB_CONCERT);

  Logger.log('All-in form  ID : %s', allInId   || '(introuvable)');
  Logger.log('Concert form ID : %s', concertId || '(introuvable)');

  if (!allInId)   Logger.log('⚠ All-in form introuvable — vérifie PUB_ALLIN');
  if (!concertId) Logger.log('⚠ Concert form introuvable — vérifie PUB_CONCERT');

  // Dump All-in actuel pour archive avant toute action destructive
  if (allInId) dumpFormItems_(allInId, 'AVANT (All-in)');

  if (!DRY_RUN) {
    if (allInId)   buildAllInForm_(allInId);
    if (concertId) tweakConcertForm_(concertId);
    Logger.log('— Done (changements appliqués) —');
  } else {
    Logger.log('— DRY_RUN : aucune modification appliquée. Passe DRY_RUN à false pour exécuter. —');
  }
}


/**
 * Trouve le file id d'un Google Form via son published URL.
 * Itère sur tous les forms du compte (peut prendre quelques secondes).
 */
function findFormIdByPublishedUrl_(pubUrl) {
  const target = normalizeUrl_(pubUrl);
  const it = DriveApp.searchFiles(
    "mimeType = 'application/vnd.google-apps.form' and trashed = false"
  );
  let scanned = 0;
  while (it.hasNext()) {
    scanned++;
    const f = it.next();
    try {
      const form = FormApp.openById(f.getId());
      if (normalizeUrl_(form.getPublishedUrl()) === target) {
        Logger.log('  → match après %d forms scannés : %s', scanned, f.getName());
        return f.getId();
      }
    } catch (e) {
      // pas le droit d'ouvrir ce form, on saute
    }
  }
  Logger.log('  ✗ aucun match sur %d forms scannés', scanned);
  return null;
}


/** Normalise une URL pour comparaison (strip query + trailing slash). */
function normalizeUrl_(u) {
  return (u || '').split('?')[0].replace(/\/+$/, '');
}


/** Dump les items existants d'un form dans les logs. */
function dumpFormItems_(formId, label) {
  const form = FormApp.openById(formId);
  const items = form.getItems();
  Logger.log('--- %s : %d question(s) ---', label, items.length);
  items.forEach((it, idx) => {
    let extra = '';
    const t = it.getType();
    if (t === FormApp.ItemType.MULTIPLE_CHOICE) {
      extra = ' [choix: ' + it.asMultipleChoiceItem().getChoices().map(c => c.getValue()).join(' | ') + ']';
    } else if (t === FormApp.ItemType.CHECKBOX) {
      extra = ' [cases: ' + it.asCheckboxItem().getChoices().map(c => c.getValue()).join(' | ') + ']';
    } else if (t === FormApp.ItemType.LIST) {
      extra = ' [liste: ' + it.asListItem().getChoices().map(c => c.getValue()).join(' | ') + ']';
    }
    Logger.log('  %d. [%s] "%s"%s', idx + 1, t, it.getTitle(), extra);
  });
}


/** Reconstruit le form All-in avec les 12 questions concert + soirée. */
function buildAllInForm_(formId) {
  const form = FormApp.openById(formId);

  form.setTitle('Fête de la Musique 20 juin — Aprèm + Concert + Soirée');
  form.setDescription(
    'Tu viens à la journée ET à la soirée DJ. Un seul formulaire pour tout — ' +
    'pas besoin d\'en remplir un autre. Réponds avant le 10 juin.\n\n' +
    'Programme : 14h jeux/pétanque · 17h scène ouverte · 18h set Judyson · ' +
    '18h45 jams · food truck en parallèle dès 17h30 · soirée DJ dès 22h.'
  );

  // Wipe existing items
  const items = form.getItems();
  for (let i = items.length - 1; i >= 0; i--) form.deleteItem(items[i]);

  // 1. Prénom
  form.addTextItem()
    .setTitle('Ton prénom')
    .setRequired(true);

  // 2. Nom
  form.addTextItem()
    .setTitle('Ton nom')
    .setRequired(true);

  // 3. Cercle
  form.addMultipleChoiceItem()
    .setTitle('Tu fais partie de quel cercle ?')
    .setChoiceValues(['Amis / groupe musique', 'Collègues RTE', 'Voisins', 'Famille'])
    .setRequired(true);

  // 4. Tu viens à quoi (multi, inclut la soirée)
  form.addCheckboxItem()
    .setTitle('Tu viens à quoi ? (plusieurs choix possibles)')
    .setChoiceValues([
      'Jeux après-midi (pétanque, etc.)',
      'Scène ouverte + concert',
      'Soirée DJ (dès 22h, sur invitation)'
    ])
    .setHelpText('La soirée DJ est sur invitation — si tu as reçu ce formulaire avec le code, tu es invité·e.')
    .setRequired(true);

  // 5. Combien d'adultes
  form.addTextItem()
    .setTitle('Combien d\'adultes au total ?')
    .setHelpText('Toi compris·e.')
    .setRequired(true);

  // 6. Combien d'enfants
  form.addTextItem()
    .setTitle('Combien d\'enfants ?')
    .setHelpText('Pour la journée (pas la soirée).')
    .setRequired(false);

  // 7. Allergies / régime
  form.addTextItem()
    .setTitle('Allergie ou régime particulier ?')
    .setHelpText('À signaler au food truck si besoin.')
    .setRequired(false);

  // 8. Scène ouverte 17h
  form.addMultipleChoiceItem()
    .setTitle('Tu veux proposer un morceau à la scène ouverte (17h) ?')
    .setChoiceValues(['Oui, j\'ai une idée', 'Non, je viens écouter'])
    .setRequired(false);

  // 9. Si oui : quel morceau & avec qui
  form.addTextItem()
    .setTitle('Si oui : quel morceau et avec qui ?')
    .setRequired(false);

  // 10. Apéro à ramener
  form.addCheckboxItem()
    .setTitle('Tu peux ramener quelque chose pour l\'apéro ?')
    .setChoiceValues([
      'Une boisson',
      'Un dessert',
      'Des chaises ou une table pliante',
      'Rien, je viens juste profiter'
    ])
    .setHelpText('Le repas est géré par le food truck, pas besoin d\'apporter à manger.')
    .setRequired(false);

  // 11. Soirée : jouer / mixer
  form.addMultipleChoiceItem()
    .setTitle('Soirée DJ : tu veux jouer ou mixer un set ? (machines, jam, DJ)')
    .setChoiceValues(['Oui, j\'ai un truc à proposer', 'Non, je profite'])
    .setHelpText('Uniquement si tu coches la soirée DJ ci-dessus.')
    .setRequired(false);

  // 12. Mot pour l'orga
  form.addParagraphTextItem()
    .setTitle('Un mot pour l\'orga ?')
    .setHelpText('Optionnel. Précisions, surprises, demandes, etc.')
    .setRequired(false);

  Logger.log('✓ All-in form rebuilt : %s', form.getPublishedUrl());
}


/** Aligne titre + description du form Concert (sans toucher aux questions). */
function tweakConcertForm_(formId) {
  const form = FormApp.openById(formId);

  form.setTitle('Fête de la Musique 20 juin — Après-midi & Concert');
  form.setDescription(
    'Tu viens pour la journée (jeux, scène ouverte, concert, food truck) ' +
    'sans la soirée DJ privée ? C\'est le bon formulaire. Réponds avant le 10 juin.\n\n' +
    'Programme : 14h jeux/pétanque · 17h scène ouverte · 18h set Judyson · ' +
    '18h45 jams · food truck en parallèle dès 17h30.'
  );

  Logger.log('✓ Concert form metadata updated : %s', form.getPublishedUrl());
}
