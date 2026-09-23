# Sécurité et qualité — règles de MySky

Ces règles s'appliquent à tout le code, qu'il soit écrit par une personne ou par une IA.
Plusieurs sont **vérifiées automatiquement** (ESLint, tests, CI) : le code qui ne les respecte pas est refusé.

## 1. Contrôles automatiques

| Contrôle | Commande | Ce qu'il empêche |
|---|---|---|
| Types TypeScript stricts (`strict`, `noUncheckedIndexedAccess`) | `npm run typecheck` | Valeurs `undefined` oubliées, erreurs de type |
| ESLint, 0 avertissement | `npm run lint` | Bugs courants (`==`, hooks mal utilisés), `eval`, `console.log`, couleurs en dur, imports internes d'un module |
| Formatage Prettier | `npm run format:check` | Code illisible ou incohérent |
| Tests Jest | `npm test` | Régressions : migrations de la base, contraste des couleurs, traductions FR/EN complètes (et clés utilisées existantes), messages d'erreur, **chaque écran affiché avec de vraies données** |
| Audit des dépendances | `npm run audit:prod` | Bibliothèques avec failles connues de niveau élevé ou critique |
| Diagnostic Expo | `npm run doctor` | Dépendances incompatibles avec le SDK |
| **Tout d'un coup** | `npm run check` | À lancer avant chaque commit |

La CI GitHub (`.github/workflows/ci.yml`) relance tout à chaque push et pull request.

## 2. Secrets et configuration

- Les variables `EXPO_PUBLIC_*` sont **incluses dans l'app** : n'importe qui peut les lire. Elles ne contiennent jamais de secret.
- **Jamais** la clé `service_role` de Supabase, ni une clé d'API d'IA, dans l'app. Les appels qui demandent un secret passent par une Edge Function côté serveur.
- Les valeurs locales vont dans `.env.local`, qui n'est jamais commité (voir `.env.example`).
- La configuration est vérifiée au démarrage (`src/shared/config/env.ts`) : seules les URL `https://` sont acceptées.

## 3. Données de l'utilisateur

- **Serveur (phase 2)** : chaque table a la sécurité par ligne (RLS) activée, avec la règle `user_id = auth.uid()`. Aucune table sans RLS.
- **Téléphone** : les jetons de connexion seront stockés avec `expo-secure-store` (trousseau iOS / keystore Android), jamais en clair.
- La sauvegarde automatique Android est désactivée (`allowBackup: false`) pour que la base locale ne soit pas copiée hors du téléphone.
- **Requêtes SQL** : toujours avec des paramètres (`db.runAsync('… WHERE id = ?', [id])`), jamais en collant du texte (risque d'injection SQL).
- **Journaux** : passer par `src/shared/logger.ts`. Aucune donnée personnelle (contenu de note, email, mot de passe) dans les logs. En production, rien n'est affiché.
- **Suppression du compte** : supprime les données du serveur et les fichiers, pas seulement la session (obligatoire sur l'App Store).
- **Données minimales** : on ne demande que ce qui est utile à l'étudiant.

## 4. Ne jamais perdre de données

- Toute action est d'abord enregistrée sur le téléphone, puis synchronisée (architecture §7).
- Les migrations de la base locale sont appliquées une par une, chacune dans une transaction : si l'une échoue, rien n'est à moitié appliqué.
- Si la base du téléphone vient d'une version plus récente de l'app, on ne la modifie pas.
- Une migration publiée n'est **jamais** modifiée : on en ajoute une nouvelle.

## 4b. Notifications

- Programmées **sur le téléphone** (aucun serveur, aucune donnée envoyée). Reprogrammées à chaque changement de données, au retour de l'app, et limitées à 60 (limite iOS : 64).
- Le contenu d'une notification contient seulement la matière, l'heure et le titre de l'élément : pas de description ni de note.
- Les données attachées à une notification sont vérifiées (`readResponse`) avant d'ouvrir un écran.

## 4c. Pièces jointes

- Copiées dans le dossier privé de l'app (`Paths.document/attachments/<note>/`), inaccessible aux autres apps. Le chemin stocké est **relatif** (le chemin absolu change à chaque mise à jour iOS).
- Taille maximale : 25 Mo par fichier. Le nom d'origine est gardé pour l'affichage seulement ; le fichier est renommé avec un identifiant.
- Supprimer une note ou une pièce jointe supprime aussi le fichier local.

## 5. Erreurs

- L'utilisateur ne voit jamais un message technique (« Error 500 »). `userMessageKey()` transforme toute erreur en message clair et traduit.
- Si un écran plante, l'`ErrorBoundary` de `src/app/_layout.tsx` affiche un message et un bouton « Réessayer ».

## 6. Alertes de sécurité connues et acceptées

`npm audit` signale 14 alertes de niveau **modéré** (aucune élevée ou critique) au 23 septembre 2026 :

| Paquet | Pourquoi c'est accepté |
|---|---|
| `uuid@7` (via `xcode`, `@expo/config-plugins`…) | Utilisé uniquement par les outils de **construction** de l'app, pas dans l'app installée. La faille concerne un usage (`buf` fourni à v3/v5/v6) que ces outils ne font pas. |
| `decode-uri-component@0.2` (via `expo-router` → `query-string`) | Risque de lenteur sur un lien mal formé. La correction (`0.5`) n'est pas compatible avec `query-string@7`. À revoir à chaque mise à jour d'Expo. |

`npm audit fix --force` n'est **pas** une solution : il installerait des versions d'Expo incompatibles. On met à jour avec `npx expo install --fix` à chaque nouveau SDK.
