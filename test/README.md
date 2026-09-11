# Tests

Le jeu tourne sous node avec un canvas simule (`harness.js`). Aucun navigateur requis.

| fichier | ce qu'il prouve |
|---|---|
| `harness.js` | doublures canvas et DOM, pilote de reference. Pas un test. |
| `integrity.js` | aucun NaN ni undefined n'atteint le canvas |
| `controls.js` | flips asymetriques, saut au tap, tout schuss au maintien |
| `hud.js` | textes centraux jamais superposes, jamais hors cadre |
| `balance.js` | morts, distance et vitesse sur 8 pistes |
| `build-smoke.js` | l'artefact **compresse** demarre et simule |

## Pieges rencontres

**Le pilote de test fausse les mesures.** Un pilote qui maintient puis relache le
tout schuss tres vite declenche un saut a chaque fois, par la regle du tap. Il vole
alors au-dessus des pieces et fait chuter le taux de ramassage de 99 % a 47 %.
`levelPilot` ne touche jamais au schuss pour cette raison.

**Un test qui ne teste rien.** Une comparaison A/B dont le motif de desactivation
ne correspond plus au code renvoie deux resultats identiques, ce qui ressemble a
« la fonctionnalite ne sert a rien ». Faire echouer le test quand le motif est
introuvable, jamais l'ignorer silencieusement.

**Mesurer la mauvaise variable.** La vitesse totale a l'atterrissage est dominee
par l'horizontale et ne bouge pas quand on ajoute une portance verticale. C'est la
composante verticale qu'il fallait suivre.
