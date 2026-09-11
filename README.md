# ROLLERBOW

Une licorne ragdoll dévale une piste arc-en-ciel. Entrée pour **js13kGames 2026**, thème « Unicorns and Rainbows ».

Tout tient dans un fichier HTML de moins de 13 312 octets une fois zippé : pas de framework, pas d'image, pas de fichier son. Le décor, la piste, la licorne et la musique sont générés au code.

## Jouer

Ouvrez `src/index.html` dans un navigateur : le jeu y est autonome et lisible.
`dist/js13k/index.html` est la même page compressée, celle que contient le zip.

| action | clavier | tactile |
|---|---|---|
| relever la patte avant, salto arrière | ← ou A ou Q | moitié gauche |
| relever la patte arrière, périlleux avant | → ou D | moitié droite |
| saut, au sol comme en l'air | appui bref sur les deux | tap sur les deux moitiés |
| tout schuss | maintien des deux, ou ↓ | maintien des deux moitiés |
| couper la musique | M | |
| couper le sang | G | |

Le salto arrière fait monter et freine, le périlleux avant fait piquer et accélère. Le saut ne se réarme qu'au contact du sol.

## Construire

```bash
npm install
./build.sh                    # construit src/index.html
./build.sh --best 6           # 6 tirages roadroller, garde le plus petit
./build.sh src/v1-skates.html # variante patins à roulettes
```

La chaîne extrait le `<script>`, le passe dans **terser** puis **roadroller**, reconstruit un HTML minimal, zippe en `-9` puis recompresse le conteneur avec **advzip** (zopfli). Elle échoue si le budget de 13 312 octets est dépassé, et ne remplace les livrables qu'une fois l'archive vérifiée.

Trois sorties, depuis le même état du source :

```
rollerbow.zip              archive du concours, index.html à sa racine
dist/js13k/index.html      la page que contient le zip, compressée
dist/wavedash/index.html   la même page sans minification, pour Wavedash
```

`roadroller` cherche ses paramètres au hasard : deux builds du même source ne donnent pas le même nombre d'octets. Lire le chiffre que le build vient d'imprimer, jamais un chiffre noté ici. `--best 6` relance le tirage six fois et garde le plus petit.

### Pourquoi advzip et pas seulement `zip -9`

`zip -9` laisse de la place dans le conteneur DEFLATE. `advzip -z -4` recompresse le même contenu avec zopfli : **353 octets rendus** sur ce jeu, soit plus que la marge restante. Le fichier extrait est identique bit pour bit.

## Tests

Le jeu n'a aucune dépendance à un navigateur réel : un canvas simulé suffit à le faire tourner sous node. Cela permet de mesurer ce qui serait invisible à l'œil.

```bash
node test/integrity.js src/index.html          # aucun NaN ne doit atteindre le canvas
node test/controls.js  src/index.html          # les trois verbes de contrôle
node test/hud.js       src/index.html          # aucune superposition de texte
node test/balance.js   src/index.html          # morts, distance, vitesse sur 8 pistes
node test/wavedash.js                          # trophées et classements, source ET sortie terser
node test/build-smoke.js dist/js13k/index.html # le BUILD compressé, pas la source
```

Le dernier est le plus important : terser et roadroller peuvent casser du code parfaitement valide, et c'est l'artefact compressé qu'on soumet.

`test/wavedash.js` tourne aussi sur la **sortie terser**, et pas seulement sur la source. La raison est un piège coûteux : `terser --compress booleans_as_integers` réécrit `true` en `1`, le SDK Wavedash valide ses types et rejette l'appel, la garde défensive avale l'exception — et plus rien ne part, sans un mot dans la console, uniquement depuis le build. Ses doublures reproduisent donc la validation de types du vrai SDK et **comptent** les violations au lieu de tout accepter. Vérifié : en réactivant l'option, le test tombe sur 14 violations et 0 trophée envoyé.

`test/integrity.js` mérite un mot. Un `NaN` passé à `fillRect`, ou une couleur `hsl(NaN,...)`, ne lève aucune erreur : le navigateur ignore silencieusement l'appel. L'élément disparaît de l'écran sans le moindre message. Ce test attrape ces cas.

## Outils de réglage

Trois pages autonomes servies pendant le développement, conservées parce qu'elles restent utiles pour retoucher :

- `tools/music-picker.html` : six musiques de titre générées, jouables côte à côte
- `tools/mane-picker.html` : six crinières animées par le même mouvement
- `tools/anchor-tuner.html` : réglage des ancrages de crinière et de queue, avec contrôle en direct que les racines restent sous la peau

## Le modèle physique

La physique vient de l'étude du code source d'**Action SuperCross** (le prédécesseur d'Elasto Mania), publié par ses auteurs. Le modèle a été réimplémenté de zéro en JavaScript à partir de la compréhension de son fonctionnement, pas transposé ligne à ligne.

Ce qui en est repris :

- trois corps rigides, un châssis et deux patins, reliés par des tiges élastiques raides et sur-amorties
- contact roulant à 0, 1 ou 2 points d'appui, avec théorème de Huygens sur le pivot
- pas de temps fixe de 3 ms, ressort à 10 000 N/m, amortissement à 1 000 N·s/m, rapport de masse 20:1
- la rotation n'est pas un couple mais une impulsion angulaire brève de 12 rad/s, restituée ensuite : c'est ce qui donne son toucher au jeu d'origine

Ce qui a été ajouté pour une descente infinie : traînée aérodynamique, stabilisateur aérien, portance à assiette plate, amorti de réception, et flips asymétriques.

Le dépôt d'Action SuperCross est *source-available* et non open source. Aucun de son code n'est présent ici. Choisissez votre propre licence pour ce projet.

## Structure

```
build.sh                     chaîne de build
package.json                 terser + roadroller
src/index.html               source lisible et commentée
src/v1-skates.html           variante patins à roulettes, contrôles d'origine
wavedash.toml                configuration du challenge Wavedash
wavedash-achievements.json   définitions des trophées, à importer au portail
dist/                        sortie du build (js13k et wavedash)
test/                        harnais et tests
tools/                       pages de réglage
media/                       cover et miniature de soumission
```

## Wavedash

Le jeu coche le challenge **Wavedash** de l'édition 2026. La plateforme injecte un global `Wavedash` avant le code du jeu ; celui-ci ne charge donc **aucune ressource externe** et ne dépend d'aucun SDK embarqué. Chaque appel est gardé par `self.Wavedash` : hors plateforme — sur js13kgames.com — le bloc est inerte et le jeu se comporte à l'identique.

Ce qui est branché, pour **291 octets** dans le zip :

- `init()`, sans lequel le jeu resterait caché derrière l'écran de chargement de la plateforme
- `requestStats()`, sans lequel aucun trophée ne se débloquerait, en silence
- les **12 trophées** de la course, déjà affichés en jeu par un bandeau maison — donc visibles aussi pour les votants js13k
- deux classements, **distance** et **score**, envoyés uniquement à un nouveau record local

Les identifiants de trophées sont dérivés des titres affichés (`ACHT`) : `FIRST FLIP` devient `RB_FIRST_FLIP`. Renommer un titre renomme donc son trophée, et impose de mettre à jour sa définition au Developer Portal. `test/wavedash.js` vérifie que les identifiants du code et ceux de `wavedash-achievements.json` concordent exactement.
