# Serveur MySky (Supabase)

Tout ce qu'il faut pour les comptes et la synchronisation. **Aucune clé secrète ne va dans l'app** : l'app n'utilise que l'URL du projet et la clé publique (« anon » / publishable), protégées par la sécurité par ligne (RLS).

## Mise en place (une seule fois)

1. Crée un projet sur [supabase.com](https://supabase.com). Choisis la région avec soin : elle ne peut plus changer et elle doit figurer dans la politique de confidentialité (`src/shared/legal.ts`, `serverRegion`).
2. **SQL Editor** : colle et exécute `migrations/20260924000000_mysky.sql`. Il crée les tables (une par type de donnée, chacune protégée par RLS : chaque utilisateur ne voit que ses lignes), la fonction `mysky_push` et le bucket privé `mysky-files`.
3. **Edge Functions** : déploie `functions/delete-account` (`supabase functions deploy delete-account`). Elle utilise la clé service_role **côté serveur** pour supprimer un compte et ses fichiers.
4. **Authentication › URL Configuration** : ajoute dans *Redirect URLs*
   - `mysky://auth/callback`
   - `mysky://auth/reset`
   - pour Expo Go : `exp://**/--/auth/callback` et `exp://**/--/auth/reset`
5. **Authentication › Providers** : l'e-mail est actif par défaut. Pour Google et Apple, suis les guides Supabase (identifiants OAuth Google, Services ID Apple) puis active-les.
6. Dans l'app : copie `.env.example` en `.env.local` et remplis `EXPO_PUBLIC_SUPABASE_URL` et `EXPO_PUBLIC_SUPABASE_ANON_KEY` (ou `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`).

## Vérifier le schéma

`npm run test:server` exécute le SQL sur un Postgres embarqué (PGlite) et vérifie : versions, modifications renvoyées comptées une fois, conflits, isolation entre deux utilisateurs, suppression en cascade.

Le fichier SQL est **généré** à partir du schéma du téléphone. Après une nouvelle migration locale : `UPDATE_SERVER_SCHEMA=1 npx jest serverSchema`, puis exécute les changements sur le projet (le fichier est idempotent pour les tables et fonctions ; une colonne ajoutée demande un `alter table … add column`).
