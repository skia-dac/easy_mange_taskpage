# MySky

Application mobile d'organisation pour étudiants (Android et iOS), construite avec **Expo** et **TypeScript**.
Statut : **phases 1, 3, 4, 5, 7a et lot 2 terminés** : notes d'examen et moyennes, minuteur de révision, tâches récurrentes, partage d'une note en PDF, export du calendrier (.ics), statistiques de la semaine, verrouillage Face ID, mode focus, recherche globale, introduction au premier lancement, notes (mise en forme légère, checklists, pièces jointes, favoris, recherche), rappels (cours, devoirs, tâches, examens), notification « Cours terminé : quelque chose à ajouter ? », réglages (son, vibration, premier jour de la semaine), sauvegarde locale automatique (export / restauration), suppression de toutes les données, matières, emplois du temps, cours (uniques ou hebdomadaires), modification d'une seule séance / des suivantes / de toute la série, cours annulés, vacances et jours sans cours, calendrier jour / semaine / mois, écran Aujourd'hui, tâches, devoirs, examens et événements. Tout fonctionne hors connexion, sur un seul téléphone (comptes et synchronisation : phase 2).

- Plan, architecture et phases : [`docs/PLANNING.md`](docs/PLANNING.md)
- Sécurité et qualité : [`docs/SECURITY.md`](docs/SECURITY.md)
- Idées pour la version 2 : [`docs/VERSION_2.md`](docs/VERSION_2.md)
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
npm run check      # types + lint + formatage + tests
```

| Commande | Rôle |
|---|---|
| `npm run typecheck` | Vérifie les types TypeScript |
| `npm run lint` | Règles de code (0 avertissement autorisé) |
| `npm run format` | Formate le code automatiquement |
| `npm test` | Lance les tests (dont un test qui affiche chaque écran avec de vraies données) |
| `npm run audit:prod` | Cherche les failles connues dans les dépendances |
| `npm run doctor` | Diagnostic Expo |

Pour ajouter une bibliothèque : `npx expo install <nom>` (et non `npm install`), pour qu'elle soit compatible avec le SDK Expo.

## Organisation du code

```
src/
  app/                 Écrans (Expo Router) : un fichier = un écran
    (tabs)/            Les 5 onglets : Aujourd'hui, Calendrier, Notes, Tâches, Profil
  modules/             Les 4 domaines de l'architecture
    identity/          compte, profil, préférences
    academic/          matières, emplois du temps, cours, examens, vacances
    productivity/      notes, tâches, devoirs, pièces jointes
    platform/          notifications, fichiers, import, synchronisation, recherche
  projections/         Aujourd'hui et Calendrier : calculés à partir des données, jamais stockés
  workflows/           Actions qui touchent plusieurs modules (ex. supprimer une matière)
  components/          Lignes réutilisables (cours, devoir, examen, événement)
  shared/
    theme/colors.ts    ← TOUTES les couleurs de l'app (clair + sombre + matières)
    theme/tokens.ts    espacements, arrondis, typographie
    i18n/locales/      textes en français (fr.json) et en anglais (en.json)
    db/                base de données locale (SQLite) et migrations
    errors/            erreurs et messages compréhensibles
    ui/                composants de base (texte, écran, bouton, état vide)
```

## Changer une couleur

Ouvre `src/shared/theme/colors.ts`, change la valeur (ex. `primary: '#1F5FD6'`), enregistre : tous les écrans suivent.
Les tests vérifient que le texte reste lisible ; s'ils échouent, la couleur choisie est trop claire ou trop foncée.

## Changer un texte

Ouvre `src/shared/i18n/locales/fr.json` (et `en.json` pour l'anglais). Les deux fichiers doivent avoir les mêmes clés : un test le vérifie.
