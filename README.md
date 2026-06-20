# Jam à Cailloux · 20 juin 2026

Landing page de la Fête de la Musique 2026 chez Aurélien & Mathieu, à Cailloux-sur-Fontaines.

## Stack

Single-page statique, vanilla HTML/CSS/JS. Hébergé sur GitHub Pages.

```
index.html      le markup
style.css       le design (palette cream/navy/moutarde/terracotta)
script.js       gate code SFDLM26 + tabs RSVP
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
