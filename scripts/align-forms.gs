/**
 * align-forms.gs (v2 — avec pré-remplissage soirée)
 *
 * - Form CONCERT (sans code) : titre + description alignés, questions inchangées
 * - Form ALL-IN  (avec code) : reconstruit avec 12 questions = concert + soirée
 *   + génère l'URL viewform pré-remplie avec la case "Soirée DJ" cochée d'office
 *
 * DRY_RUN = true par défaut. Lance, vérifie les logs, passe à false, relance.
 */

// === RÉGLAGES ============================================================
const DRY_RUN = true;   // ← passe à false pour exécuter pour de vrai

const PUB_CONCERT = 'https://docs.google.com/forms/d/e/1FAIpQLSdOqh5eXl-ow2SegsYjygSUpzDZbPFfihfnnBCIeulAiGi61g/viewform';
const PUB_ALLIN   = 'https://docs.google.com/forms/d/e/1FAIpQLSeVabP6H6YrMOpgJKGKN2YLLNiCk-tyzwAdfRiM0cdzSsxMLQ/viewform';

const SOIREE_CHOICE_LABEL = 'Soirée DJ (dès 22h, sur invitation)';


function alignBothForms() {
  Logger.log('=== alignBothForms (DRY_RUN=%s) ===', DRY_RUN);

  const allInId   = findFormIdByPublishedUrl_(PUB_ALLIN);
  const concertId = findFormIdByPublishedUrl_(PUB_CONCERT);

  Logger.log('All-in form  ID : %s', allInId   || '(introuvable)');
  Logger.log('Concert form ID : %s', concertId || '(introuvable)');

  if (allInId) dumpFormItems_(allInId, 'AVANT (All-in)');

  if (!DRY_RUN) {
    if (allInId)   {
      buildAllInForm_(allInId);
      generatePrefilledUrl_(allInId);
    }
    if (concertId) tweakConcertForm_(concertId);
    Logger.log('— Done (changements appliqués) —');
  } else {
    Logger.log('— DRY_RUN : aucune modification. Passe DRY_RUN à false pour exécuter. —');
  }
}


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
        Logger.log('  → match après %d forms : %s', scanned, f.getName());
        return f.getId();
      }
    } catch (e) {}
  }
  Logger.log('  ✗ aucun match sur %d forms', scanned);
  return null;
}


function normalizeUrl_(u) {
  return (u || '').split('?')[0].replace(/\/+$/, '');
}


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


function buildAllInForm_(formId) {
  const form = FormApp.openById(formId);

  form.setTitle('Fête de la Musique 20 juin — Aprèm + Concert + Soirée');
  form.setDescription(
    'Tu viens à la journée ET à la soirée DJ. Un seul formulaire pour tout — ' +
    'pas besoin d\'en remplir un autre. Réponds avant le 10 juin.\n\n' +
    'Programme : 14h jeux/pétanque · 17h scène ouverte · 18h set Judyson · ' +
    '18h45 jams · food truck en parallèle dès 17h30 · soirée DJ dès 22h.'
  );

  const items = form.getItems();
  for (let i = items.length - 1; i >= 0; i--) form.deleteItem(items[i]);

  form.addTextItem().setTitle('Ton prénom').setRequired(true);
  form.addTextItem().setTitle('Ton nom').setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle('Tu fais partie de quel cercle ?')
    .setChoiceValues(['Amis / groupe musique', 'Collègues RTE', 'Voisins', 'Famille'])
    .setRequired(true);

  form.addCheckboxItem()
    .setTitle('Tu viens à quoi ? (plusieurs choix possibles)')
    .setChoiceValues([
      'Jeux après-midi (pétanque, etc.)',
      'Scène ouverte + concert',
      SOIREE_CHOICE_LABEL
    ])
    .setHelpText('La soirée DJ est sur invitation — vu que tu remplis ce formulaire, tu es invité·e (la case est pré-cochée).')
    .setRequired(true);

  form.addTextItem()
    .setTitle('Combien d\'adultes au total ?')
    .setHelpText('Toi compris·e.')
    .setRequired(true);

  form.addTextItem()
    .setTitle('Combien d\'enfants ?')
    .setHelpText('Pour la journée (pas la soirée).')
    .setRequired(false);

  form.addTextItem()
    .setTitle('Allergie ou régime particulier ?')
    .setHelpText('À signaler au food truck si besoin.')
    .setRequired(false);

  form.addMultipleChoiceItem()
    .setTitle('Tu veux proposer un morceau à la scène ouverte (17h) ?')
    .setChoiceValues(['Oui, j\'ai une idée', 'Non, je viens écouter'])
    .setRequired(false);

  form.addTextItem()
    .setTitle('Si oui : quel morceau et avec qui ?')
    .setRequired(false);

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

  form.addMultipleChoiceItem()
    .setTitle('Soirée DJ : tu veux jouer ou mixer un set ? (machines, jam, DJ)')
    .setChoiceValues(['Oui, j\'ai un truc à proposer', 'Non, je profite'])
    .setRequired(false);

  form.addParagraphTextItem()
    .setTitle('Un mot pour l\'orga ?')
    .setHelpText('Optionnel. Précisions, surprises, demandes, etc.')
    .setRequired(false);

  Logger.log('✓ All-in form rebuilt : %s', form.getPublishedUrl());
}


/**
 * Génère l'URL viewform pré-remplie avec la case "Soirée DJ" déjà cochée.
 * À copier dans index.html à la place de l'URL all-in actuelle.
 */
function generatePrefilledUrl_(formId) {
  const form = FormApp.openById(formId);
  const target = form.getItems(FormApp.ItemType.CHECKBOX)
    .find(it => /tu viens/i.test(it.getTitle()));
  if (!target) {
    Logger.log('⚠ Question "Tu viens à quoi" introuvable, pas d\'URL pré-remplie');
    return null;
  }
  const resp = form.createResponse()
    .withItemResponse(target.asCheckboxItem().createResponse([SOIREE_CHOICE_LABEL]));
  const url = resp.toPrefilledUrl();
  Logger.log('');
  Logger.log('════════════════════════════════════════════════════════════');
  Logger.log('  URL pré-remplie (case Soirée DJ déjà cochée) :');
  Logger.log('  %s', url);
  Logger.log('════════════════════════════════════════════════════════════');
  Logger.log('  → Donne cette URL à Claude pour qu\'il mette à jour l\'iframe');
  Logger.log('    de l\'option soirée dans index.html.');
  return url;
}


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
