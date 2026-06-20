# Jam à Cailloux · 20 juin 2026

Landing page de la Fête de la Musique 2026 chez Aurélien & Mathieu, à Cailloux-sur-Fontaines.

## Stack

Single-page statique, vanilla HTML/CSS/JS. Hébergé sur GitHub Pages.

```
index.html      le markup
style.css       le design (palette cream/navy/moutarde/terracotta)
script.js       gate code SFDLM26 + tabs RSVP
jeux.html       page tournoi (inscription équipes + scores live)
jeux.js         logique tournoi (appels Apps Script + classements)
scripts/        tournoi-webapp.gs (backend) + align-forms.gs (Forms)
assets/         l'affiche + visuels
.nojekyll       force Pages à servir tel quel
```

## Structure

- **Hero** : affiche + date + tagline.
- **Programme** : timeline 16h → minuit.
- **Infos pratiques** : adresse, ce qu'on ramène, repas, voisinage.
- **RSVP** : deux onglets.
  - *Concert* : formulaire public (embed Google Form).
  - *Soirée* : formulaire complet, gate-é derrière un code (`SFDLM26`).
- **Contact** : numéros Aurélien / Mathieu.

## Le gate SFDLM26

Le code est en clair côté frontend (`script.js`). Ce n'est pas une protection cryptographique, juste un filtre invitations-seulement (security through obscurity). Suffisant pour un événement privé entre amis.

Le déverrouillage est persisté via `localStorage` pour éviter de re-saisir. Bouton "Verrouiller" pour invalider.

## Développement local

```bash
# Aucun build. Un simple serveur statique :
python3 -m http.server 8080
# puis http://localhost:8080
```

## Déploiement

GitHub Pages activé sur `main` (root). Push = déploie.

## Forms Google

- Concert (public) : `1FAIpQLSdOqh5eXl-ow2SegsYjygSUpzDZbPFfihfnnBCIeulAiGi61g`
- All-in (avec soirée) : `1FAIpQLSeVabP6H6YrMOpgJKGKN2YLLNiCk-tyzwAdfRiM0cdzSsxMLQ`

Pour changer un formulaire, remplacer les deux occurrences (lien direct + iframe `embedded=true`) dans `index.html`.

## Tournoi des jeux (`jeux.html`)

Page d'inscription d'équipes + **classement live** pour 4 jeux : pétanque, Mölkky,
fléchettes, palet breton. Chaque équipe note ses parties (gagné/perdu + score) ;
un classement par jeu + un classement général se mettent à jour pour tout le monde.
Le leader général repart avec un cadeau. Édition ouverte (pas de PIN) — la Google
Sheet reste la source de vérité, l'orga peut nettoyer.

GitHub Pages étant statique, le stockage partagé passe par un petit **Web App
Apps Script** adossé à une Google Sheet (`scripts/tournoi-webapp.gs`).

### Déploiement du backend (une fois)

1. Ouvrir [script.google.com](https://script.google.com) → nouveau projet → coller
   le contenu de `scripts/tournoi-webapp.gs`.
2. Exécuter la fonction `setup()` une fois (accepter les autorisations).
   → crée la Sheet « Jam à Cailloux — Tournoi des jeux ».
3. **Déployer → Nouveau déploiement → Application Web** :
   - *Exécuter en tant que* : moi
   - *Qui a accès* : tout le monde
   - Copier l'URL qui se termine par `/exec`.
4. Coller cette URL dans la constante `API_URL` en haut de `jeux.js`, puis commit + push.

Après une modif du `.gs` : *Déployer → Gérer les déploiements → (crayon) → Nouvelle
version*. L'URL `/exec` ne change pas.

### Transport

`jeux.js` parle au backend en **JSONP** (lecture et écriture) → aucun souci CORS
sur GitHub Pages. Le `.gs` expose aussi un `doPost` (voie alternative, non utilisée
par le client). Le classement est calculé côté navigateur (barème = victoires, donc
ajustable sans redéployer). Les ajouts de partie portent une clé `reqId` :
un renvoi après coupure réseau ne crée pas de doublon (idempotence côté serveur).

### Dépannage

- **« Connexion instable / délai dépassé » alors que le réseau marche** : c'est
  presque toujours le piège multi-comptes Google. L'URL `/exec` d'un Web App
  « exécuter en tant que moi » redirige vers une page de login HTML si le visiteur
  est connecté à **plusieurs** comptes Google → la réponse n'est pas du JSONP et
  l'appel finit en timeout. Tester l'URL `/exec` dans une fenêtre de navigation
  privée règle le doute. Solution : se connecter à un seul compte, ou ouvrir le
  site dans un profil dédié.
- **Rien ne s'affiche, bandeau « backend pas branché »** : `API_URL` est resté sur
  `__PASTE_WEBAPP_URL__` dans `jeux.js`. Coller l'URL `/exec` et re-push.
- **Modifié le `.gs` mais rien ne change** : il faut publier une *nouvelle version*
  du déploiement (Gérer les déploiements → crayon → Nouvelle version).
