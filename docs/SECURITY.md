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

- **Serveur** : chaque table a la sécurité par ligne (RLS) activée, avec la règle `user_id = auth.uid()`. Aucune table sans RLS. Le schéma est généré depuis celui du téléphone et vérifié sur un vrai Postgres (`npm run test:server`) : un utilisateur ne peut ni lire ni modifier les lignes d'un autre.
- **Écritures serveur** : uniquement par la fonction `mysky_push` (liste blanche des tables, versions pour détecter les conflits, identifiant de modification pour ne jamais appliquer deux fois la même, purgé après 30 jours). Les utilisateurs n'ont que le droit de lecture sur les tables : la fonction est `security definer` et limite chaque lecture et écriture à `user_id = auth.uid()`. Une modification invalide est rejetée seule (`rejected`) sans bloquer les autres ; le téléphone la garde dans l'écran « Conflits de synchronisation », où l'utilisateur restaure sa version ou l'ignore.
- **Fichiers** : bucket privé `mysky-files` (25 Mo max par fichier), chaque utilisateur limité à son dossier `<id>/`.
- **Suppression du compte** : fonction serveur `delete-account` (clé service_role côté serveur uniquement) : fichiers puis compte, les lignes partent en cascade.
- **Téléphone** : la session de connexion est stockée avec `expo-secure-store` (trousseau iOS / keystore Android, accessible après le premier déverrouillage, jamais copiée sur un autre appareil), découpée en morceaux, jamais en clair.
- **Mots de passe** : 8 caractères minimum avec une lettre et un chiffre ; gérés par Supabase Auth, jamais stockés par l'app.
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

## 4d. Même application sur iPhone et Android

- Les écrans n'ont **aucun code spécifique à une plateforme** : un test (`src/shared/platformGuard.test.ts`) refuse `Platform.OS`, `Alert.alert` et les options iOS-only en dehors de `src/shared/ui/` et `src/modules/platform/`.
- Les menus à choix multiples utilisent `ChoiceSheet` (identique partout) et non la boîte native, qui limite Android à 3 boutons.
- Les champs date/heure affichent le même bouton partout ; seul le sélecteur qui s'ouvre est natif (fenêtre iPhone, boîte Android).
- Onglets, polices, couleurs, icônes (Feather), cartes et formulaires sont dessinés par l'app, pas par le système : même rendu sur les deux.
- Les seules différences volontaires : la barre d'état, le clavier et le geste retour, gérés par le système de chaque téléphone.

## 4e. Sauvegarde locale et suppression des données

- **Sauvegarde automatique** : une fois par jour (à l'ouverture ou au retour de l'app), toute la base est copiée en JSON dans `Paths.document/backups/` (dossier privé de l'app, non partagé, non inclus dans la sauvegarde Android désactivée). Les 7 dernières sont gardées. Les fichiers des pièces jointes ne sont **pas** inclus (trop volumineux) : seule leur fiche l'est.
- **Restauration** : le fichier est vérifié (format, version) avant tout ; une sauvegarde d'une version plus récente de l'app est refusée. La restauration remplace tout dans **une seule transaction** : en cas d'erreur, rien ne change. L'utilisateur confirme avant.
- **Partage** : l'utilisateur peut envoyer une sauvegarde (Fichiers, mail, AirDrop) ; le fichier contient toutes ses données en clair, l'app le dit avant de partager.
- **Supprimer toutes mes données** : double confirmation, puis base vidée (réglages compris), pièces jointes et sauvegardes effacées, rappels annulés ; l'app repart au premier lancement. Avec les comptes (phase 2), la même action supprimera aussi les données du serveur.

## 4f. Verrouillage, export et partage

- **Verrouillage de l'app** : utilise Face ID / Touch ID / le code du téléphone (`expo-local-authentication`), jamais un mot de passe propre à l'app (rien à stocker). L'écran de verrouillage est opaque ; il revient après 30 s en arrière-plan. Le réglage ne s'active que si le téléphone a une biométrie ou un code configuré.
- **Export .ics et PDF** : fichiers écrits dans le **cache** de l'app puis passés à la feuille de partage du système ; l'utilisateur choisit où ils vont. Tout le texte est échappé (RFC 5545 pour l'ics, HTML pour le PDF) ; aucune ressource externe dans le PDF.
- **Sessions de révision** : seuls la matière, l'heure de début/fin et la durée sont enregistrés. Le mode focus ne touche qu'aux notifications de l'app, jamais aux réglages du téléphone.

## 4g. Widgets

- Les widgets reçoivent uniquement des **textes déjà calculés** (titres de cours, heures, salles, titres de tâches) ; aucun accès à la base, aux notes ni aux pièces jointes. Sur iPhone les données vivent dans le groupe d'apps `group.com.skiadac.mysky`, sur Android dans `widget-snapshot.json` (données) et `widget-config.json` (matière choisie par widget) du dossier privé de l'app. La Live Activity « Révision » n'affiche que la matière et l'heure de fin.
- Le contenu d'un widget est visible sur l'écran d'accueil et l'écran verrouillé : il n'affiche jamais de description ni de contenu de note.

## 4h. Habitudes

- Les habitudes et leur journal restent sur le téléphone (tables `habits`, `habit_logs`, avec `SYNC_COLUMNS` pour la phase 2), sont incluses dans la sauvegarde locale et effacées par « Supprimer toutes mes données ».
- La raison d'un jour manqué est **facultative** et limitée à 200 caractères. Elle n'apparaît ni dans les notifications ni dans les widgets.
- Supprimer une habitude supprime aussi son historique, après confirmation.

## 4i. Politique de confidentialité

- Texte unique en français et en anglais : `docs/PRIVACY_POLICY.md`, affiché dans l’app (Réglages › Confidentialité › Politique de confidentialité, clés `privacy.*`) et publié en page web pour l’App Store et Google Play.
- Elle décrit l’app telle qu’elle est : sans compte, rien ne quitte le téléphone ; avec un compte (facultatif), les données sont synchronisées chez Supabase. Les réponses « App Privacy » / « Data safety » sont dans `docs/PRIVACY_POLICY.md`. **À mettre à jour** avant l’import par IA, et renseigner la région du serveur (`src/shared/legal.ts`).
- Cadre légal : loi n° 2024/017 du 23 décembre 2024 relative à la protection des données à caractère personnel au Cameroun (en vigueur depuis le 23 juin 2026). Avec les comptes, prévoir le registre des traitements, les formalités auprès de l’Autorité de protection des données et, si le serveur est hors du Cameroun, l’autorisation de transfert.

## 4j. Plan de révision, humeur, gestes

- Le plan de révision est **calculé sur le téléphone** (aucune IA, aucun envoi) et rien n'est enregistré avant que l'étudiant valide la proposition.
- Le journal d'humeur est facultatif ; la note du jour (500 caractères max) n'apparaît ni dans les notifications ni dans les widgets. Il est inclus dans la sauvegarde, la synchronisation (compte) et effacé par « Supprimer toutes mes données ».
- Glisser pour terminer ou reporter n'efface rien ; supprimer une révision demande confirmation. Déplacer un cours dans la vue heures demande confirmation et ne touche que cette séance.
- Les nouvelles tables (`work_subtasks`, `revision_blocks`, `mood_logs`) ont les `SYNC_COLUMNS`, passent par l'outbox et sont protégées par RLS côté serveur comme les autres.

## 4k. Argent

- Aucune connexion à une banque ou à un compte Mobile Money, aucune lecture de SMS : tout est saisi par l'étudiant.
- Montants en entiers (plus petite unité de la monnaie), jamais en nombres à virgule ; validation zod (montant > 0, 3 rappels au maximum).
- Tables `money_*` avec `SYNC_COLUMNS`, outbox, sauvegarde locale, « Supprimer toutes mes données », et RLS côté serveur comme les autres.
- Les widgets et l'écran verrouillé peuvent montrer des montants : option « Masquer les montants dans les widgets » (•••). Les notifications montrent le nom de la charge et son montant, jamais les notes.
- Supprimer une opération, une charge, un objectif, un prêt ou une catégorie demande confirmation ; supprimer une catégorie range ses opérations dans « Autre » ; supprimer une charge garde les paiements déjà notés.

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
