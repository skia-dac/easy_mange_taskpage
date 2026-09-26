# Audit par module MySky — 26 septembre 2026

Audit en lecture seule de **tout le projet, module par module**, mené par six auditeurs indépendants en parallèle (un par module) sur HEAD `141d139`. Chaque auditeur a lu l'intégralité de son périmètre, lancé les tests correspondants et, pour les règles de calcul, vérifié ses constats par des sondes hors dépôt. Six axes notés sur 10 par module : complétude vs `docs/PLANNING.md`, qualité du code, exactitude ou robustesse, données, UX des écrans, tests. Seuls des problèmes vérifiés dans le code sont cités, avec fichier et ligne.

État global au moment de l'audit : `npm run check` vert (typecheck, lint 0 avertissement, prettier, 354 tests Jest, 15 contrôles SQL sur Postgres), `expo-doctor` 21/21, 17 alertes npm modérées transitives (2 causes, aucune élevée).

## 1. Tableau de bord

| Module | Périmètre | Complétude | Code | Règles / robustesse | Données | UX | Tests | **Global** |
|---|---|---|---|---|---|---|---|---|
| Transverse | kit UI, thème, base locale, Aujourd'hui, outillage, docs | 8,5 | 8 | 8,5 | 8 | 8 | 6,5 (docs) | **8,0** |
| Productivity | tâches, événements, créneaux, notes, habitudes, révision, humeur | 8,5 | 8 | 6,5 | 8 | 8 | 7,5 | **7,7** |
| Identity | compte, session, profil, réglages, espaces, onboarding | 8 | 7 | 7 | 9 (sécurité) | 8 | 5 | **7,3** |
| Finance | Argent : opérations, charges, tontines, objectifs, prêts, rapport | 8,5 | 7,5 | 7 (calculs) | 7 | 7 | 6,5 | **7,2** |
| Academic | matières, emplois du temps, cours, exceptions, vacances, examens, moyennes | 8 | 8 | 7 | 6 | 7 | 7 | **7,0** |
| Platform | synchro, serveur, notifications, widgets, sauvegarde, export, verrou | 8 | 8 | 6 (synchro) | 7 | 8 (sécurité) | 7 | **7,0** |
| **Projet** | | | | | | | | **7,4** |

**Lecture.** Aucun module n'est en dessous de 7. Le socle (transverse) est le plus solide, ce qui explique la qualité homogène des écrans. Les faiblesses sont concentrées sur des **cas limites** : cascades de suppression dans academic, cas de bord de la synchro dans platform, quelques règles de calcul dans productivity et finance, et une couverture de tests faible sur l'authentification.

## 2. Les 12 constats prioritaires, tous modules confondus

Classés par impact utilisateur. Aucun n'est une faille de sécurité ni une perte de données silencieuse à grande échelle ; ce sont des bugs reproductibles sur des chemins précis.

| # | Module | Constat | Où | Fix |
|---|---|---|---|---|
| 1 | Productivity | Décocher puis recocher une tâche répétée crée un **doublon** de l'occurrence suivante (sonde : 3 tâches au lieu de 2) | `productivity/data/commands.ts:86` | mémoriser l'occurrence créée avant `spawnNext` ; rendre l'annulation possible en la supprimant |
| 2 | Finance | Une charge impayée d'une période précédente **disparaît** de « en retard » et de « après tes charges » dès la période suivante | `projections/money.ts:120-127` | inclure les occurrences impayées antérieures (2 à 3 périodes) |
| 3 | Platform | Une mutation refusée par le serveur bloque **tout** l'envoi et empêche la réception (le push précède le pull) | `sync/serverSchema.ts:138-146`, `engine.ts:333` | `exception when others` par mutation → statut `rejected` ; côté client, sortir l'élément de la file vers `sync_conflicts` |
| 4 | Academic | Supprimer un emploi du temps laisse des exceptions orphelines et des notes attachées à un cours disparu ; même trou dans `endSeriesBefore` au premier jour et dans `splitSeries` pour les notes ; `courses/form.tsx:177` n'utilise pas le workflow | `academic/data/commands.ts:99-118`, `exceptionCommands.ts:291-332` | passer par `removeCourse` + `detachNotesFromCourse` dans un workflow unique |
| 5 | Identity | **Profil dupliqué** quand un téléphone ayant créé un profil hors ligne se connecte à un compte qui en a déjà un : deux lignes, l'écran montre la plus ancienne | `identity/data/profile.ts:28-34` | fusionner ou supprimer le profil local au rattachement (`claimLocalData`) |
| 6 | Finance | Changer de devise affiche tous les prêts « Réglé » (pas de colonne `currency` sur `money_loans`) ; un objectif XAF peut recevoir des mouvements EUR | `migrations.ts:341-347`, `money/add.tsx:453` | nouvelle migration `currency` sur les prêts ; forcer la devise du contexte dans la saisie |
| 7 | Productivity | « Aujourd'hui compte contre toi » : grille de progression à 0 et série cassée avant la fin de la journée ; taux « N fois/semaine » attend tout dès le lundi (3×/sem parfaite = 83 % un lundi) | `projections/progress.ts:43`, `domain/habit.ts:289-293,336` | `pending` du jour → `null` ; semaine en cours : attendu = min(N, jours écoulés) |
| 8 | Platform | Widgets Android figés : seul le premier instantané est écrit et rejoué toutes les 30 min (« dans 25 min » pendant des heures) ; iOS s'arrête à minuit | `widgets/snapshot.ts:237`, `taskHandler.tsx:296`, `projections/widget.ts:652` | écrire la chronologie complète et choisir l'entrée `date <= now` ; prolonger iOS sur 2 à 3 jours |
| 9 | Platform | Sauvegarde restaurée sur un autre téléphone : les pièces jointes marquées « envoyées » ne sont jamais téléchargées | `sync/files.ts:86`, `backup/snapshot.ts:42` | ne sauter que si le fichier existe localement |
| 10 | Academic | « Prochain : … » d'une matière ignore annulations et vacances ; une séance modifiée peut avoir une fin avant le début (validation seulement entre les deux nouvelles heures) ; déplacement possible vers un jour off suspendu | `subjects/[id].tsx:357`, `domain/exception.ts:159-165`, `workflows/moveItem.ts:90` | passer `{exceptions, offPeriods}` ; valider contre les heures de la série ; refuser le jour suspendu |
| 11 | Productivity | Créneau de nuit 22:00→06:00 compte 119 min dans « À planifier » au lieu de 480 et n'apparaît pas le lendemain matin ; `endStudySession` appelée deux fois décale la fin ; autosave de note peut créer une seconde note sous frappe rapide | `domain/slot.ts:109`, `glance.ts:50`, `studyCommands.ts:61`, `notes/[id].tsx:152` | seconde séance `00:00–fin` le lendemain ; garde idempotente ; `noteIdRef` |
| 12 | Finance | En édition d'une opération, « Enregistrer » avant la fin du chargement **crée** une opération au lieu de la modifier ; décocher « payé » supprime la dépense sans confirmation ; 5 écrans ne lisent jamais `error` (spinner infini) | `money/add.tsx:449-510`, `money.tsx:56`, `money.tsx:44`… | `LoadingScreen` tant que `id && !existing` ; toast « Annuler » ; état d'erreur |

## 3. Détail par module

### 3.1 Transverse — 8,0

**Contenu.** `shared/db` (15 migrations jamais modifiées, `entityWriter`, `useLiveQuery`, `useSharedLiveQuery`, réglages notifiés par clé), `shared/ui` (27 composants), thème testé AA clair/sombre, i18n 1 431 clés à parité, projections, hooks, écran Aujourd'hui, CI complète.

**Vérifié conforme.** 0 import profond hors index, 0 couleur hors thème, 0 `console`, 0 SQL dans les écrans, secrets absents, `glanceTiles` reproduit les 7 combinaisons d'espaces du planning, `nextCourse` et le fil du jour corrects et testés.

**À corriger.**
- `useAgendaData.ts:41` et `(tabs)/index.tsx:89-92` écoutent `app_settings` en entier : tout réglage relance 17 requêtes. Écouter `app_settings:spaces`, `week_start`, `rotation_anchor`, `today_layout`, `notifications`.
- `useAgendaData.ts:47` : `today` figé tant qu'aucune écriture n'a lieu ; après minuit les fenêtres restent celles de la veille (l'abonné racine garde le cache vivant). Recharger au retour de l'app et au changement de jour.
- Zones tactiles < 44 pt dans le kit : `Segmented` 38, `ChoiceChips` 40, croix de `SearchInput` 38. `TextInput` sans `maxFontSizeMultiplier` (les saisies grossissent plus que les libellés).
- `entityWriter.ts:105,129` : un `undefined` oublié met la colonne à NULL localement sans le dire au serveur. Refuser `undefined`.
- `useLiveQuery` au changement de `deps` garde `loading: false` et l'ancienne donnée : la recherche peut montrer les résultats de la frappe précédente. Pas de debounce sur la recherche.
- Aucun test sur `glance.ts` (5 fonctions) ; `react-dom` et `expo-system-ui` sans usage ; TypeScript 6 non validé par `expo-doctor`.
- **Documentation en retard** : `PLANNING.md` cite Drizzle, Zustand, `(tabs)/today`, `(tabs)/profile`, « stats hors MVP » ; `SECURITY.md` dit 14 alertes (17) ; `README` ignore Argent, espaces, planning, 14 widgets.

### 3.2 Productivity — 7,7

**Contenu.** Tâches et devoirs (sous-tâches, répétition, report), événements et créneaux fixes (rotation A/B, nuit), notes (markup, autosave, pièces jointes, catégories, PDF), habitudes (fréquences, objectif, raisons, durée, points de suivi, grille GitHub), Pomodoro et planificateur de révision, humeur, stats, bilan du soir. 79 tests verts.

**Vérifié conforme.** Rotation A/B, report et rappel décalé, planificateur (marge 15 min, créneaux occupés tous espaces), espaces, cascades (tâche, note, habitude avec photos, catégorie), photos hors synchro.

**À corriger** (outre #1, #7, #11) : `SELECT … WHERE id = ?` sans `deleted_at IS NULL` (`commands.ts:44`, `subtaskCommands.ts:89`) ; « Tout reporter » et « Copier la semaine » hors transaction ; bornes UTC de `studyCommands.ts:89` excluant une session de 00:30 locale ; humeur dédoublonnée sans `updated_at` ; « N fois/semaine » limité à 6 dans le formulaire (schéma accepte 7) ; devoir enregistrable sans matière (planning dit matière obligatoire) ; libellés techniques lus par VoiceOver (`habits/form.tsx:144,176`), boutons « ‹ › » sans libellé.

### 3.3 Identity — 7,3

**Contenu.** Supabase PKCE, session dans SecureStore découpée, e-mail et mot de passe, Apple et Google, confirmation et reset par lien, suppression via Edge Function, ~20 réglages typés, profil synchronisé, providers thème/langue/espaces, rattachement des données au compte.

**Vérifié conforme.** Aucune clé `service_role` hors Edge Function (qui vérifie le JWT), session `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`, réseau absent et réglages corrompus gérés, changement de compte refuse de mélanger deux comptes, logs sans donnée personnelle.

**À corriger** (outre #5) : suppression de compte non atomique (serveur supprimé, puis échec local possible sans message) ; écriture de session non atomique dans SecureStore (crash entre deux chunks = déconnexion) ; session expirée sans message (`SIGNED_OUT` silencieux) ; `onboarding.tsx:66-75` avance même si les espaces ne sont pas enregistrés ; `settings.tsx:111-131` chargement infini si une lecture échoue ; « Synchroniser maintenant » muet en erreur ; boutons « Supprimer mon compte » actifs pendant `busy` ; prénom/nom envoyés en `user_metadata` sans nécessité ; `notification_preferences` annoncé synchronisé mais local. **Tests : 5/10**, `auth/service.ts`, `authErrorKey`, `secureStorage`, `deleteAccountEverywhere` et l'Edge Function n'ont aucun test.

### 3.4 Finance — 7,2

**Contenu.** 8 types d'opérations en entiers, pavé numérique, 23 catégories intégrées + perso, charges fixes et tontines (jour 31, rappels, tour compté une fois), période mois ou semaine, solde avec report SQL, reste par jour, objectifs, prêts avec remboursements partiels, rapport et insights, 3 widgets masquables. 15 tests verts.

**Vérifié juste.** Solde et report, périodes au jour 31 dans les deux sens, occurrences mensuelles (31 → dernier jour, février bissextile), arrondis XAF sans décimales / EUR en centimes, tontine comptée une fois, remboursement partiel.

**À corriger** (outre #2, #6, #12) : remboursement supérieur au reste dû accepté (reste négatif masqué) ; tuile « Prêts » inclut les prêts clôturés contrairement à l'écran Prêts ; « Charges mensuelles » additionne toutes les devises ; `endDate` d'une charge non éditable et remise à `null` à chaque modification ; `updateCategory`, `setGoalArchived`, `searchTransactions` existent mais ne sont branchés nulle part (pas de renommage de catégorie, pas d'archivage d'objectif atteint, opérations absentes de la recherche globale) ; `money_prefs` non synchronisées (devise différente d'un appareil à l'autre) ; `Segmented` sans `accessibilityLabel` sur 4 écrans ; navigation de période dupliquée dans 3 écrans.

### 3.5 Academic — 7,0

**Contenu.** Matières (suppression avec bilan d'usage), emplois du temps (cours / examens / révisions), séries de cours hebdo ou uniques, occurrences calculées jamais stockées, exceptions (annulée, modifiée, déplacée, « ce cours et les suivants », fin de série), vacances avec suspension, examens avec rappels J-7/3/1, notes ramenées sur 20 et moyennes pondérées. 58 tests verts.

**Vérifié juste.** Récurrence hebdo, fin de série, split, annulation visible, suspension, changement d'heure (heure murale locale), moyennes pondérées (8/10 → 16/20), refus note > barème.

**À corriger** (outre #4, #10) : pas d'index unique `(series_id, date)` sur les exceptions (deux appareils hors ligne = deux lignes, l'une gagne au hasard) ; `cancelOccurrence` garde la note de la séance modifiée ; clé React dupliquée dans `CalendarItemRow.tsx:466` quand une séance déplacée tombe sur une séance régulière ; `courseValues` dupliqué à l'identique ; `courses/[id].tsx:59` charge toutes les notes puis filtre ; « Ce cours et les suivants » supprime sans confirmation ; aide « N séances ne s'afficheront pas » affichée même switch désactivé ; chip « Actif » d'un emploi du temps sans effet sur le calendrier ; `timetables.timezone` prévu par le planning, absent (à acter) ; impossible de changer le jour d'une seule séance hors glisser-déposer.

### 3.6 Platform — 7,0

**Contenu.** Synchro (outbox groupée, `mysky_push` idempotent, pull par curseur en pages de 500, conflits « le plus récent gagne » gardés), serveur généré et testé sur Postgres (26 tables, RLS, bucket privé par utilisateur, Edge Function de suppression), notifications (plan pur, 60 max sur 45 jours, 4 canaux Android, actions fin de cours), 14 widgets iOS + Live Activity et 15 Android, sauvegarde JSON quotidienne (7 gardées, restauration transactionnelle), export `.ics` et PDF, verrou biométrique.

**Vérifié conforme.** Réponse perdue, création sur ligne existante, hors-ligne, ordre parent/enfant, changement et suppression de compte, fichiers effacés des deux côtés, RLS et `security invoker`, `allowBackup: false`, chemins gardés.

**À corriger** (outre #3, #8, #9) : curseur de réception `gt server_updated_at` peut sauter des lignes sous commits concurrents (curseur `bigserial` ou relecture avec marge) ; pas de reprise avec backoff au retour du réseau (seulement foreground et timer 5 min) ; `sync_conflicts` jamais résolus ni montrés (compteur sans issue) ; pas de tâche de fond pour reprogrammer les notifications (quota de 60 épuisé en ~6 jours à 5 cours/jour) ; schéma serveur en retard filtré en silence (colonnes perdues) ; `grant insert, update, delete … to authenticated` permet d'écrire sans passer par `mysky_push` ; `expo-image-picker` ajoute la permission micro (option `microphonePermission: false`) ; bucket sans `file_size_limit` ; `.ics` plié à 73 caractères UTF-16 au lieu de 75 octets (ligne de 138 octets avec des accents) ; ancienne photo de profil jamais retirée du bucket ; textes en dur `'MySky'`, `'OK'` dans `SubjectConfigScreen.tsx` ; `sync_mutations` jamais purgée.

## 4. Ce que confirme l'audit (points forts, tous modules)

- Architecture réellement tenue par l'outillage : imports par index, couleurs par tokens, i18n complète et testée, migrations intactes, écrans minces.
- Sécurité homogène : RLS partout, secrets absents de l'app, session chiffrée, chemins gardés, logs sans données personnelles.
- Domaines purs et testés (récurrence, exceptions, moyennes, périodes financières, rotation, planificateur, plan de notifications).
- Toutes les suppressions confirmées, toasts avec annulation, états vides et chargements cohérents sur la quasi-totalité des écrans.

## 5. Plan proposé

**Lot D — bugs reproductibles (2 jours)** : #1, #2, #4, #7, #10, #11, #12 et le profil dupliqué (#5). Chacun avec un test repris des sondes des auditeurs.

**Lot E — synchro et serveur (2 jours, une migration serveur)** : #3 (mutation rejetée isolée), #9 (fichiers après restauration), curseur robuste, `currency` sur les prêts (#6), index unique sur les exceptions, `grant` réduit, `microphonePermission: false`, `file_size_limit`, écran des conflits, backoff au retour du réseau.

**Lot F — fraîcheur hors app et finition (2 jours)** : widgets Android/iOS (#8), tâche de fond notifications, agenda par clés de réglage et rechargement au changement de jour, zones tactiles 44 pt, `maxFontSizeMultiplier`, libellés VoiceOver, tests de l'auth, fonctions finance non branchées, documentation `PLANNING` / `SECURITY` / `README` remise à jour.

**État au 26/09**

- **Lot D — fait** : `ae869d4` (Productivity), `106c85e` (Finance), `65a1156` (Academic), `92a8a28` (Identity, profil dupliqué #5).
- **Lot E — fait** : `9104ebd` (mutation rejetée isolée, curseur robuste, fichiers restaurés), `78ae19b` (migration 16, serveur durci, micro retiré, `.ics` en octets), `82b91c4` (backoff, écran des conflits).
- **Lot F — fait** : `6ed2600` (widgets 3 jours, tâche de fond des rappels), `d9acedd` (agenda par clés, 44 pt, VoiceOver), `5157b9c` (tests de l'auth, session écrite de façon sûre), `b1860c4` (finance branchée, mineurs) et le commit de documentation qui suit.
