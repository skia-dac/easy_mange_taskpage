# Guide : brancher MySky sur Supabase (Windows, PowerShell)

Ce guide met en service les **comptes** et la **sauvegarde sur le compte** (synchronisation).
Sans lui, l'app marche sans compte : tout reste sur le téléphone, et l'écran Réglages › Mes données
le dit (« Les comptes ne sont pas encore disponibles dans cette version »).

Durée : 30 à 45 minutes. Il faut seulement un navigateur, PowerShell et le dépôt MySky sur ton PC.

> **Règle d'or.** L'app n'utilise que **l'URL du projet** et la **clé publique**
> (« publishable » ou « anon »). Ne copie **jamais** la clé `service_role` (ou « secret ») dans
> `.env.local`, dans le code ou dans une variable `EXPO_PUBLIC_*` : ces variables sont lisibles par
> n'importe qui dans l'app installée (voir `docs/SECURITY.md` §2).

---

## 1. Créer le projet

1. Va sur <https://supabase.com>, crée un compte (ou connecte-toi), puis **New project**.
2. **Name** : `mysky` (ou `mysky-test` pour un projet d'essai).
3. **Database Password** : clique sur **Generate a password** et range-le dans ton gestionnaire de
   mots de passe. L'app n'en a pas besoin, mais toi oui pour administrer la base.
4. **Region** : choisis une région **en Europe**, la plus proche du Cameroun. Prends
   **West EU (Paris)** si elle est proposée, sinon **Central EU (Frankfurt)**.
   - La région **ne peut plus changer** ensuite.
   - Note-la : elle doit apparaître dans la politique de confidentialité. Mets son nom dans
     `src/shared/legal.ts`, champ `serverRegion` (par exemple `'Union européenne (Paris, France)'`).
     Les données sortent du Cameroun : voir `docs/SECURITY.md` §4i (autorisation de transfert).
5. Clique sur **Create new project** et attends 1 à 2 minutes que le projet soit prêt.

## 2. Créer les tables (SQL Editor)

1. Dans le menu de gauche : **SQL Editor** › **New query**.
2. Sur ton PC, ouvre le fichier `supabase\migrations\20260924000000_mysky.sql` du dépôt.
   Pour le copier d'un coup dans le presse-papiers, depuis le dossier du dépôt dans PowerShell :

   ```powershell
   Get-Content -Raw -Encoding UTF8 .\supabase\migrations\20260924000000_mysky.sql | Set-Clipboard
   ```

3. Colle tout dans l'éditeur (Ctrl+V), puis clique sur **Run**. Le message attendu est
   « Success. No rows returned ».
4. Vérifie dans **Table Editor** : tu dois voir les tables `subjects`, `notes`, `tasks`,
   `money_transactions`, `sync_mutations`, `feedback`… Chacune a un cadenas vert (RLS activée).

Ce que fait ce fichier, pour information :

- les tables (une par type de donnée), toutes protégées par la sécurité par ligne
  (`user_id = auth.uid()` : chacun ne voit que ses lignes) ;
- la fonction `mysky_push` : la **seule** façon d'écrire depuis l'app (les utilisateurs n'ont que
  le droit de lecture sur les tables) ;
- la fonction `mysky_submit_feedback` (« Donner mon avis ») ;
- **les deux buckets de fichiers**, il n'y a donc rien à créer à la main dans **Storage** :
  - `mysky-files`, privé, 25 Mo par fichier : pièces jointes et photo de profil, chacun dans son
    dossier `<id utilisateur>/` ;
  - `mysky-feedback`, privé, 5 Mo, images seulement : captures jointes aux retours.

  Vérifie dans **Storage** que les deux buckets existent et sont marqués « Private ».

Le fichier peut être relancé sans risque (il est idempotent). **Après chaque mise à jour du dépôt
qui le modifie, relance-le en entier** de la même façon.

## 3. Déployer la fonction « Supprimer mon compte »

Le bouton « Supprimer mon compte » appelle la fonction serveur `delete-account`. Elle utilise la clé
service_role **côté serveur uniquement** (Supabase la lui fournit, tu n'as rien à copier).

Dans PowerShell, depuis le dossier du dépôt :

```powershell
npx supabase login
npx supabase functions deploy delete-account --project-ref TON_REF_DE_PROJET
```

`TON_REF_DE_PROJET` est l'identifiant du projet : la partie avant `.supabase.co` dans l'URL du
projet (étape 5), par exemple `abcdefghijklmnop`. `npx supabase login` ouvre le navigateur pour te
connecter. À la fin, la fonction apparaît dans **Edge Functions**.

## 4. Activer la connexion par e-mail et les adresses de retour

### 4.1 E-mail

1. **Authentication** › **Sign In / Providers** (selon la version : **Providers**) › **Email** :
   vérifie que **Enable Email provider** est activé.
2. Laisse **Confirm email** activé : à l'inscription, Supabase envoie un lien de confirmation.
3. Google et Apple sont facultatifs et ne marchent que dans un **build de développement** ou de
   production, pas dans Expo Go (voir `docs/CHECKLIST-APPAREIL.md`). Pour les activer plus tard,
   suis les guides Supabase « Login with Google » et « Login with Apple ».

### 4.2 Adresses de retour (Redirect URLs)

Le lien reçu par e-mail (confirmation, mot de passe oublié) doit rouvrir l'app. Le code construit
ces adresses avec `Linking.createURL('auth/callback')` et `Linking.createURL('auth/reset')`
(`src/modules/identity/auth/service.ts`), avec le schéma **`mysky`** déclaré dans `app.json`
(`"scheme": "mysky"`). Les écrans qui les reçoivent sont `src/app/auth/callback.tsx` et
`src/app/auth/reset.tsx`.

1. **Authentication** › **URL Configuration**.
2. **Site URL** : `mysky://auth/callback`
3. **Redirect URLs** › **Add URL**, ajoute ces quatre adresses une par une :

   | Adresse | Pour |
   |---|---|
   | `mysky://auth/callback` | build de développement et app installée : confirmation, Google, Apple |
   | `mysky://auth/reset` | build de développement et app installée : nouveau mot de passe |
   | `exp://**/--/auth/callback` | Expo Go (l'adresse contient l'IP de ton PC, d'où `**`) |
   | `exp://**/--/auth/reset` | Expo Go |

4. Clique sur **Save**.

## 5. Récupérer l'URL et la clé publique

1. **Project Settings** (roue dentée) › **API Keys** (ou **Data API** / **API** selon la version).
2. Copie :
   - **Project URL** : `https://xxxxxxxxxxxx.supabase.co` ;
   - la clé **publishable** (`sb_publishable_…`) ; si ton projet n'affiche que l'ancien système,
     la clé **anon public** (longue, commence par `eyJ…`).
3. **Ne copie pas** la clé `service_role` ni une clé `sb_secret_…`. Si tu l'as collée quelque part
   par erreur, régénère-la dans ce même écran.

## 6. Écrire `.env.local`

L'app lit exactement ces variables (`src/shared/config/env.ts`) :

| Variable | Valeur |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | l'URL du projet (doit commencer par `https://`) |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | la clé publishable (nouveau nom) |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | ou la clé anon (ancien nom, même rôle) |

Une seule des deux clés suffit ; si les deux sont remplies, la publishable est prise.

Dans PowerShell, depuis le dossier du dépôt :

```powershell
Copy-Item .env.example .env.local
notepad .env.local
```

Remplis puis enregistre, par exemple :

```dotenv
EXPO_PUBLIC_SUPABASE_URL=https://abcdefghijklmnop.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxxxxxxxxxxxxxx
```

Pas d'espace autour de `=`, pas de guillemets.

### Vérifier que `.env.local` ne sera jamais commité

```powershell
git check-ignore -v .env.local
```

La réponse attendue ressemble à `.gitignore:34:.env*.local	.env.local` : le fichier est ignoré.
S'il n'y a **aucune** réponse, arrête-toi : ne fais pas de commit, et ajoute la ligne `.env.local`
à `.gitignore`. Vérifie aussi `git status` : `.env.local` ne doit jamais y apparaître.

## 7. Redémarrer Expo

Les variables `EXPO_PUBLIC_*` sont lues au démarrage du serveur : il faut le relancer, en vidant le
cache.

```powershell
# Arrête le serveur en cours avec Ctrl+C, puis :
npx expo start --clear          # build de développement (expo-dev-client est installé)
npx expo start --go --clear     # ou : ouvrir dans Expo Go
```

Pendant que le serveur tourne, la touche **s** bascule entre build de développement et Expo Go.

## 8. Vérifier la connexion

1. Ouvre l'app, puis **Profil › Compte et synchronisation**. L'écran ne doit **plus** dire
   « Comptes pas encore disponibles ».
2. **Créer mon compte** avec une vraie adresse e-mail et un mot de passe (8 caractères, une lettre
   et un chiffre).
3. Ouvre l'e-mail de confirmation **sur le téléphone** et touche le lien : l'app se rouvre et tu es
   connecté. (Dans Supabase, **Authentication › Users** montre le nouvel utilisateur.)
4. **Réglages › Mes données** affiche « Tes données sont sauvegardées sur ton compte ». Touche
   **Sauvegarder maintenant** : le message « Sauvegardé » et l'heure apparaissent.
5. Dans Supabase, **Table Editor** › `subjects` (ou `tasks`) : tes lignes sont là, avec ton
   `user_id`.
6. Pour aller plus loin (deuxième téléphone, conflits, hors connexion) : `docs/CHECKLIST-APPAREIL.md`.

### Si ça ne marche pas

| Ce que tu vois | Cause probable |
|---|---|
| « Comptes pas encore disponibles » | `.env.local` mal nommé, mal rempli ou serveur pas relancé avec `--clear` |
| L'app plante au démarrage après l'ajout de l'URL | l'URL ne commence pas par `https://` |
| Le lien de l'e-mail ouvre une page d'erreur | adresse de retour manquante (étape 4.2), ou lien ouvert sur le PC au lieu du téléphone |
| « Supprimer mon compte » échoue | fonction `delete-account` pas déployée (étape 3) |
| Rien n'arrive dans les tables | SQL de l'étape 2 pas exécuté (ou ancienne version) : relance-le |

Ne touche jamais aux règles RLS à la main pour « débloquer » : relance le fichier SQL du dépôt.
