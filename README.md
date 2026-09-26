# MySky

Application mobile d'organisation pour étudiants (Android et iOS), construite avec **Expo** et **TypeScript**.
Statut au **26 septembre 2026** : **MVP complet, audits A → F faits**, en attente de la mise en service du projet Supabase, de l'import par IA (phase 6) et des tests TestFlight / Play.

- **Trois espaces** : Études, Pro et Perso, activés au choix (au moins un) ; rien n'est effacé quand on en coupe un.
- **Études** : matières, emplois du temps, cours hebdomadaires ou uniques (une séance, les suivantes ou toute la série), cours annulés, vacances, devoirs, examens, notes et moyennes, plan de révision.
- **Organisation** : Aujourd'hui (tuiles, fil du jour), calendrier jour / semaine / mois / heures avec glisser-déposer, planning Pro/Perso (semaines A / B, créneaux de nuit), tâches avec étapes, report et gestes, bilan du soir, minuteur de révision, mode focus, statistiques.
- **Notes** : mise en forme légère, checklists, catégories, pièces jointes, favoris, PDF.
- **Habitudes et sport** : quotidien ou hebdomadaire, durée, poids et photos de progression (privées), grille de progression, humeur.
- **Argent** : dépenses et entrées, catégories perso, charges fixes et tontines, épargne, prêts, rapport, recherche.
- **Compte facultatif** (e-mail, Apple, Google) et synchronisation ; sans compte, tout marche hors connexion sur un seul téléphone.
- **Widgets** : 14 sur iPhone (+ Live Activity « Révision ») et 15 sur Android (dev build requis) ; rappels locaux, sauvegarde quotidienne, export `.ics`, verrouillage Face ID, français et anglais.

**Après mise à jour du dépôt : rejouer `supabase/migrations/20260924000000_mysky.sql` sur le projet Supabase.**

- Plan, architecture et phases : [`docs/PLANNING.md`](docs/PLANNING.md)
- Sécurité et qualité : [`docs/SECURITY.md`](docs/SECURITY.md)
- Idées pour la version 2 : [`docs/VERSION_2.md`](docs/VERSION_2.md)
- Politique de confidentialité (texte de l’app et de la page publique pour les stores) : [`docs/PRIVACY_POLICY.md`](docs/PRIVACY_POLICY.md). Nom de l’éditeur et e-mail de contact à remplir dans `src/shared/legal.ts`.
- Maquettes : https://claude.ai/artifact/BXWQxZyRPWzu9KNHhb2n5K

## Lancer l'app

Prérequis : [Node.js](https://nodejs.org) 20 ou plus.

```bash
npm install        # une seule fois
npm start          # lance le serveur de développement
```

Puis, sur ton téléphone, installe **Expo Go** (App Store / Google Play) et scanne le QR code affiché.

## Avant chaque commit

```bash
npm run check      # types + lint + formatage + tests + schéma serveur
```

| Commande | Rôle |
|---|---|
| `npm run typecheck` | Vérifie les types TypeScript |
| `npm run lint` | Règles de code (0 avertissement autorisé) |
| `npm run format` | Formate le code automatiquement |
| `npm test` | Lance les tests (dont un test qui affiche chaque écran avec de vraies données) |
| `npm run test:server` | Vérifie le schéma serveur sur un vrai Postgres (PGlite) : RLS, `mysky_push`, isolation entre comptes |
| `npm run audit:prod` | Cherche les failles connues dans les dépendances |
| `npm run doctor` | Diagnostic Expo |

Comptes et synchronisation : sans `.env.local`, l’app fonctionne sans compte. Pour les activer, suivre [`supabase/README.md`](supabase/README.md).

Pour ajouter une bibliothèque : `npx expo install <nom>` (et non `npm install`), pour qu'elle soit compatible avec le SDK Expo.

## Organisation du code

```
src/
  app/                 Écrans (Expo Router) : un fichier = un écran, sans règle métier ni SQL
    (tabs)/            Les 5 onglets : index (Aujourd'hui), calendar, tasks, notes, money (Argent, espace Perso)
  modules/             Les domaines, importés seulement par leur index.ts
    identity/          compte (Supabase), profil, réglages, espaces, apparence, langue
    academic/          matières, emplois du temps, cours et exceptions, vacances, examens et notes
    productivity/      tâches, devoirs, étapes, événements, planning, notes, habitudes, révisions, humeur
    finance/           argent : opérations, catégories, charges fixes, tontines, épargne, prêts
    platform/          synchronisation, notifications, widgets, sauvegarde, export, fichiers, verrouillage
  projections/         Aujourd'hui, calendrier, vue heures, stats, progression, argent, widgets :
                       calculés à partir des données, jamais stockés
  workflows/           Actions qui touchent plusieurs modules (supprimer une matière, le compte, recherche)
  hooks/               Hooks partagés par les écrans (libellés, matières, habitudes, profil)
  components/          Lignes, cartes et feuilles réutilisables
  shared/
    theme/colors.ts    ← TOUTES les couleurs de l'app (clair + sombre + matières + couleurs principales)
    theme/tokens.ts    espacements, arrondis, typographie
    i18n/locales/      textes en français (fr.json) et en anglais (en.json)
    db/                base locale (SQLite), 16 migrations, écritures + file de synchronisation, requêtes vivantes
    errors/            erreurs et messages compréhensibles
    ui/                composants de base (texte, écran, bouton, champs, état vide)
supabase/              schéma serveur (généré, vérifié par `npm run test:server`) et fonction delete-account
```

## Changer une couleur

Ouvre `src/shared/theme/colors.ts`, change la valeur (ex. `primary: '#1F5FD6'`), enregistre : tous les écrans suivent.
Les tests vérifient que le texte reste lisible ; s'ils échouent, la couleur choisie est trop claire ou trop foncée.

## Changer un texte

Ouvre `src/shared/i18n/locales/fr.json` (et `en.json` pour l'anglais). Les deux fichiers doivent avoir les mêmes clés : un test le vérifie.
