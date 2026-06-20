# Jam à Cailloux · 20 juin 2026

Landing page de la Fête de la Musique 2026 chez Aurélien & Mathieu, à Cailloux-sur-Fontaines.

## Stack

Single-page statique, vanilla HTML/CSS/JS. Hébergé sur GitHub Pages.

```
index.html      le markup
style.css       le design (palette cream/navy/moutarde/terracotta)
script.js       gate code SFDLM26 + tabs RSVP
jeux.html       page tournoi (inscription équipes + scores live)
jeux.js         logique tournoi (appels backend + classements)
server/         backend Node du tournoi (server.js) — déployé sur le VPS
scripts/        tournoi-webapp.gs (backend Apps Script alt) + align-forms.gs (Forms)
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
Le leader général repart avec un cadeau. Édition ouverte (pas de PIN) — la source de
vérité est le backend (fichier `data.json`), l'orga peut nettoyer.

GitHub Pages étant statique, le stockage partagé passe par un petit **backend Node**
hébergé sur le VPS (`server/server.js`), exposé en HTTPS via nginx. Le client le
contacte en **JSONP** (lecture et écriture, `?action=…` + `?callback=…`) → pas de
souci CORS, et de toute façon le backend renvoie aussi `Access-Control-Allow-Origin: *`.
Le classement est calculé côté navigateur (barème = victoires, ajustable sans
redéployer). Chaque ajout de partie porte une clé `reqId` : un renvoi après coupure
réseau ne crée pas de doublon (idempotence côté serveur).

### Backend de prod (déjà déployé)

- **Code** : `server/server.js` (Node, zéro dépendance ; store = fichier JSON, écritures atomiques).
- **VPS** : `cailloux.padaw.ovh` → nginx (TLS Let's Encrypt) → proxy vers le process
  Node local `127.0.0.1:8791`, géré par **pm2** (`pm2 list` → `cailloux`, redémarrage auto).
- **Données** : `/home/ubuntu/cailloux/data.json` sur le VPS. Pour remettre à zéro :
  `rm data.json && pm2 restart cailloux`.
- **URL client** : `API_URL = "https://cailloux.padaw.ovh/"` dans `jeux.js`.

Mettre à jour le backend :
```bash
scp server/server.js vps:/home/ubuntu/cailloux/server.js
ssh vps 'pm2 restart cailloux'
```

> `scripts/tournoi-webapp.gs` est une **alternative** Apps Script (même contrat
> GET/JSONP) si on veut un jour se passer du VPS — non utilisée en prod.

### Dépannage

- **Bandeau « backend pas branché »** : `API_URL` est resté sur `__PASTE_WEBAPP_URL__`
  dans `jeux.js`.
- **« Connexion instable / délai dépassé »** : backend Node down → `ssh vps 'pm2 logs cailloux'`,
  `pm2 restart cailloux`. Vérifier `curl https://cailloux.padaw.ovh/health`.
- **Renouvellement TLS** : automatique (timer certbot). Cert pour `cailloux.padaw.ovh`.
