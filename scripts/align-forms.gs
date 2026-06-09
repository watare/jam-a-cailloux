/**
 * align-forms.gs
 *
 * Aligne les 2 Google Forms de la Fête de la Musique sur le nouveau modèle :
 *  - Form CONCERT (sans code) : aprèm + concert + apéro
 *  - Form ALL-IN  (avec code) : tout ce qui précède PLUS la partie soirée DJ
 *
 * Comment l'utiliser
 * ------------------
 * 1. Aller sur https://script.google.com → "Nouveau projet"
 * 2. Coller ce fichier (tout le contenu)
 * 3. Cliquer "Enregistrer", puis "Exécuter" sur la fonction `alignBothForms`
 * 4. Autoriser l'accès à Drive + Forms (Aurélien, ton compte gmail)
 * 5. Vérifier la sortie dans le logger (Logger.log → Affichage → Journaux)
 *
 * Le script trouve les bons forms en matchant leur "published URL" contre les
 * URLs publiées par la landing — donc il s'auto-cale, pas besoin d'aller chercher
 * des file IDs à la main.
 */

// URLs publiques utilisées par la landing https://watare.github.io/jam-a-cailloux/
const PUB_CONCERT = 'https://docs.google.com/forms/d/e/1FAIpQLSdOqh5eXl-ow2SegsYjygSUpzDZbPFfihfnnBCIeulAiGi61g/viewform';
const PUB_ALLIN   = 'https://docs.google.com/forms/d/e/1FAIpQLSeVabP6H6YrMOpgJKGKN2YLLNiCk-tyzwAdfRiM0cdzSsxMLQ/viewform';


/** Entrée principale : aligne les deux formulaires. */
function alignBothForms() {
  const allInId   = findFormIdByPublishedUrl_(PUB_ALLIN);
  const concertId = findFormIdByPublishedUrl_(PUB_CONCERT);

  Logger.log('All-in form  : %s', allInId   || '(introuvable)');
  Logger.log('Concert form : %s', concertId || '(introuvable)');

  if (allInId)   buildAllInForm_(allInId);
  if (concertId) tweakConcertForm_(concertId);

  Logger.log('— Done —');
}


/** Trouve le file id d'un Form Drive qui a le published URL fourni. */
function findFormIdByPublishedUrl_(pubUrl) {
  const it = DriveApp.searchFiles(
    "mimeType = 'application/vnd.google-apps.form' and trashed = false"
  );
  while (it.hasNext()) {
    const f = it.next();
    try {
      const form = FormApp.openById(f.getId());
      // getPublishedUrl returns "/viewform?usp=sharing" sometimes — match prefix
      const u = form.getPublishedUrl().split('?')[0].replace(/\/$/, '');
      const target = pubUrl.split('?')[0].replace(/\/$/, '');
      if (u === target) return f.getId();
    } catch (e) {
      // can't open (not owned) — skip
    }
  }
  return null;
}


/** Reconstruit le form All-in avec toutes les questions concert + soirée. */
function buildAllInForm_(formId) {
  const form = FormApp.openById(formId);

  form.setTitle('Fête de la Musique 20 juin — Aprèm + Concert + Soirée');
  form.setDescription(
    'Tu viens à la journée ET à la soirée DJ. Un seul formulaire pour tout — ' +
    'pas besoin d\'en remplir un autre. Réponds avant le 10 juin.\n\n' +
    'Programme : 14h jeux/pétanque · 17h scène ouverte · 18h set Judyson · ' +
    '18h45 jams · food truck en parallèle dès 17h30 · soirée DJ dès 22h.'
  );

  // Wipe existing items (no responses to lose — vérifier avant !)
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

  // 4. Tu viens à quoi (multi)
  form.addCheckboxItem()
    .setTitle('Tu viens à quoi ? (plusieurs choix possibles)')
    .setChoiceValues([
      'Jeux après-midi (pétanque, etc.)',
      'Scène ouverte + concert',
      'Soirée DJ (dès 22h, sur invitation)'
    ])
    .setHelpText('La soirée DJ est sur invitation — si tu reçois ce formulaire avec le code, tu es invité·e.')
    .setRequired(true);

  // 5. Combien d'adultes (total)
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

  // 8. Tu veux proposer un morceau à la scène ouverte (17h)
  form.addMultipleChoiceItem()
    .setTitle('Tu veux proposer un morceau à la scène ouverte (17h) ?')
    .setChoiceValues(['Oui, j\'ai une idée', 'Non, je viens écouter'])
    .setRequired(false);

  // 9. Si oui : quel morceau et avec qui
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

  // 11. Soirée : jouer ou mixer
  form.addMultipleChoiceItem()
    .setTitle('Soirée DJ : tu veux jouer ou mixer un set ? (machines, jam, DJ)')
    .setChoiceValues(['Oui, j\'ai un truc à proposer', 'Non, je profite'])
    .setHelpText('Seulement si tu viens à la soirée DJ.')
    .setRequired(false);

  // 12. Mot pour l'orga
  form.addParagraphTextItem()
    .setTitle('Un mot pour l\'orga ?')
    .setHelpText('Optionnel. Précisions, surprises, demandes, etc.')
    .setRequired(false);

  Logger.log('All-in form rebuilt: %s', form.getPublishedUrl());
}


/** Ajuste le form Concert (aligne titre + description, pas de changement de questions). */
function tweakConcertForm_(formId) {
  const form = FormApp.openById(formId);

  form.setTitle('Fête de la Musique 20 juin — Après-midi & Concert');
  form.setDescription(
    'Tu viens pour la journée (jeux, scène ouverte, concert, food truck) ' +
    'sans la soirée DJ privée ? C\'est le bon formulaire. Réponds avant le 10 juin.\n\n' +
    'Programme : 14h jeux/pétanque · 17h scène ouverte · 18h set Judyson · ' +
    '18h45 jams · food truck en parallèle dès 17h30.'
  );

  Logger.log('Concert form metadata updated: %s', form.getPublishedUrl());
}
