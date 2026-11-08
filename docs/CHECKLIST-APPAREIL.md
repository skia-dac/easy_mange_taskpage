# Checklist de test sur appareil

À dérouler sur de **vrais téléphones** avant chaque version testée (TestFlight, Play interne).
Coche chaque case quand le résultat attendu est obtenu ; note sinon ce que tu as vu, le téléphone
et sa version (ex. « Tecno Spark 10, Android 13 »).

## Où lancer chaque test

| Repère | Signifie | Comment |
|---|---|---|
| **[Go]** | marche dans **Expo Go** | `npm run start:go`, puis scanner le QR code avec Expo Go |
| **[Dev]** | demande le **build de développement** | une fois : `npx eas-cli@latest build --profile development --platform android` (APK à installer) ou `--platform ios` (iPhone enregistré, compte Apple développeur) ; `development-simulator` pour le simulateur iOS. Ensuite : `npm start` et ouvrir l'app « MySky » installée |

Pourquoi : Expo Go ne contient pas les widgets ni nos extensions natives, n'a pas l'identité de
l'app (nom, icône, schéma `mysky://`) et ne permet pas Google / Apple. Les rappels locaux
s'affichent dans Expo Go, mais leur vrai comportement (app fermée, boutons d'action, canal de son)
se vérifie dans le build de développement. Ce qui est **[Go]** marche aussi en **[Dev]**.

Pour les tests avec compte : projet Supabase branché (`docs/GUIDE-SUPABASE.md`).

Préparer : deux téléphones (A et B), si possible un Android d'entrée de gamme ; un compte e-mail de
test ; le Wi-Fi qu'on peut couper (ou le mode avion).

---

## 1. Premier lancement hors connexion [Go]

- [ ] Mode avion activé, app installée ou données effacées (Réglages › Supprimer toutes mes
      données). → L'app s'ouvre sans écran blanc ni message d'erreur ; l'accueil se déroule
      en 3 étapes au plus.
- [ ] Choisir « Mes études » puis « Commencer ». → Aujourd'hui s'affiche avec un seul bloc
      d'accueil (première matière), pas une pile d'états vides.
- [ ] Créer une matière et une tâche, toujours hors connexion. → Elles s'affichent tout de suite.
- [ ] Fermer complètement l'app et la rouvrir. → Les données sont là.

## 2. Espaces [Go]

- [ ] Profil › Mes espaces : activer Pro et Perso. → L'onglet Argent apparaît avec Perso.
- [ ] Couper tous les espaces sauf un. → Le dernier interrupteur actif est verrouillé.
- [ ] Couper Perso. → L'onglet Argent disparaît ; rien n'est effacé : le rallumer remontre tout.

## 3. Tâche rapide [Go]

- [ ] Sur Aujourd'hui, « + » › Tâche, saisir un titre, enregistrer. → La tâche apparaît dans
      Aujourd'hui et dans Carnet › À faire.
- [ ] Commencer une tâche puis quitter avec le geste retour. → « Abandonner les modifications ? »
      est demandé.
- [ ] Glisser la tâche pour la terminer. → Elle passe en terminée, un toast propose « Annuler ».
- [ ] Supprimer une tâche. → Une confirmation est demandée avant.

## 4. Dépense rapide [Go]

- [ ] Onglet Argent (espace Perso) › « + » : montant d'abord, une catégorie en pastille,
      enregistrer. → La dépense apparaît, le total du jour change.
- [ ] Saisir un montant à 0 ou vide. → Message clair sous le champ, rien n'est enregistré.
- [ ] Supprimer la dépense. → Confirmation demandée.

## 5. Sauvegarde sur le compte et retour sur un autre téléphone [Dev]

> Le compte **est** la sauvegarde : sans compte, désinstaller ou perdre le téléphone fait perdre
> les données. Il n'y a pas d'export de fichier proposé à l'utilisateur.

- [ ] Sans compte, Réglages › Mes données. → « Sans compte, tes données sont seulement sur ce
      téléphone… », boutons « Créer un compte » et « Se connecter ».
- [ ] Sans compte, avec au moins 10 éléments. → Sur Aujourd'hui, carte « Crée un compte pour ne
      jamais perdre tes données ». « Plus tard » la fait disparaître (elle revient après 14 jours).
- [ ] Sur **A** : créer un compte (e-mail), confirmer avec le lien reçu, ajouter des données
      (matière, note avec pièce jointe, tâche, dépense, habitude). → Réglages › Mes données :
      « Tes données sont sauvegardées sur ton compte », dernière sauvegarde récente.
- [ ] Sur **A**, mode avion, ajouter une tâche, « Sauvegarder maintenant ». → « Pas de connexion.
      La sauvegarde se fera dès que tu seras connecté. » et « 1 modification à envoyer ».
      Couper le mode avion. → La modification part seule ; le compteur disparaît.
- [ ] Sur **B** (ou A après désinstallation puis réinstallation) : installer MySky, se connecter
      au même compte. → **Tout est là** : matière, note, pièce jointe (s'ouvre), tâche, dépense,
      habitude.
- [ ] Copie de secours locale : Réglages › Mes données › « Faire une copie maintenant », puis
      modifier une tâche, puis « Revenir à une copie » et choisir la copie. → Confirmation, puis la
      tâche retrouve son ancien état ; connecté, les données du compte sont relues ensuite (rien
      ne manque).
- [ ] Désinstaller l'app **sans compte**. → Attendu et accepté : les données et les copies locales
      sont perdues (c'est ce que dit l'écran Mes données).

## 6. Synchronisation entre deux téléphones [Dev]

Même compte sur A et B, tous deux connectés à Internet sauf mention contraire.

- [ ] **Créer** une note sur A. → Elle arrive sur B en quelques secondes (ou au retour dans l'app).
- [ ] **Modifier** son titre sur B. → Le nouveau titre arrive sur A.
- [ ] **Supprimer** la note sur A (avec confirmation). → Elle disparaît de B et ne revient pas.
- [ ] **Conflit** : A et B en mode avion, modifier **la même tâche** différemment sur les deux
      (A d'abord, B ensuite). Reconnecter A, attendre, puis reconnecter B. → La modification la
      plus récente gagne partout ; l'autre n'est pas perdue : le compteur « Conflits de
      synchronisation » apparaît, l'écran montre « ce téléphone » / « autre appareil » et permet
      de restaurer ou d'ignorer.
- [ ] **Déconnexion avec modifications non envoyées** : B en mode avion, modifier une tâche, puis
      Compte › Se déconnecter › Effacer ce téléphone. → L'app tente l'envoi, puis dit « 1
      modification pas encore envoyée sera perdue » avec « Réessayer l'envoi », « Effacer quand
      même » et Annuler. Annuler ne change rien.
- [ ] Réglages › Supprimer toutes mes données, connecté, avec une modification non envoyée.
      → Même avertissement ; après « Effacer quand même », l'app repart au premier lancement et
      le compte garde le reste des données.
- [ ] Se connecter sur A avec un **autre** compte alors que A contient les données du premier.
      → « Données d'un autre compte » : rien n'est mélangé ; Réglages › Mes données dit que rien
      n'est envoyé.

## 7. Rappels et notifications

- [ ] **Permission** [Go] : créer une tâche avec un rappel. → Explication « Recevoir tes rappels ? »
      puis la boîte du système. « Plus tard » : rien n'est redemandé avant 7 jours.
- [ ] **Rappel de tâche** [Dev] : tâche avec rappel dans 2 minutes, **fermer l'app** (la retirer
      des apps récentes). → La notification arrive à l'heure, avec le titre de la tâche
      uniquement ; la toucher ouvre la tâche.
- [ ] **Rappel d'habitude** [Dev] : habitude avec un rappel dans quelques minutes. → La
      notification arrive ; aucune raison de jour manqué n'y apparaît.
- [ ] **Échéance d'argent** [Dev] : charge fixe ou tontine due demain avec rappel. → La
      notification montre le nom et le montant, jamais la note.
- [ ] **Fin de cours** [Dev] : cours qui finit dans quelques minutes. → Notification avec les
      actions « Ajouter un devoir / une note / une tâche / Rien à ajouter » ; chaque action ouvre
      le formulaire avec la matière remplie.
- [ ] **App fermée 8 jours** [Dev] : programmer des rappels sur plus de 8 jours, ne pas ouvrir
      l'app pendant 8 jours (ou avancer la date du téléphone jour après jour). → Les rappels
      continuent d'arriver (fenêtre d'environ 60 rappels remplie à l'avance et par la tâche de
      fond) ; rouvrir l'app ne crée pas de doublons.
- [ ] **Tâche de fond** [Dev] : Android : app en arrière-plan, puis
      `adb shell cmd jobscheduler run -f com.skiadac.mysky <JOB_ID>` (id lu avec
      `adb shell dumpsys jobscheduler`) ; iPhone : seulement sur un vrai appareil, pas sur
      simulateur. → Les rappels sont reprogrammés sans ouvrir l'app, aucun plantage.
- [ ] Son et vibration coupés dans Réglages. → Le rappel suivant arrive sans son ni vibration.

## 8. Widgets [Dev]

- [ ] Ajouter chaque widget MySky sur l'écran d'accueil (Android : 15, iPhone : 14). → Ils
      s'affichent sans « Impossible de charger le widget ».
- [ ] Modifier une tâche ou un cours dans l'app, revenir à l'accueil. → Le widget est à jour.
- [ ] Option « Masquer les montants dans les widgets ». → Les montants deviennent « ••• ».
- [ ] Aucun widget n'affiche de description ni de contenu de note.
- [ ] iPhone : lancer une révision. → La Live Activity « Révision » montre la matière et l'heure
      de fin.

## 9. Lecteur d'écran et texte à 200 % [Go]

Android : TalkBack + Paramètres › Affichage › Taille de police au maximum. iPhone : VoiceOver +
Réglages › Accessibilité › Affichage et taille du texte › Texte plus grand (200 %).

- [ ] Parcourir Aujourd'hui, Calendrier, Carnet, Argent, Réglages. → Chaque bouton est annoncé
      avec un nom clair (pas « bouton » seul), dans un ordre logique.
- [ ] À 200 % : aucun texte coupé ni superposé ; les boutons grandissent ; on peut tout faire
      défiler.
- [ ] Formulaire de tâche au lecteur d'écran : les erreurs sont annoncées.
- [ ] Les cartes de sauvegarde (Mes données, carte d'Aujourd'hui) sont lisibles et leurs boutons
      atteignables.

## 10. Mode sombre [Go]

- [ ] Passer le téléphone en sombre (et Réglages › Apparence › Sombre). → Tous les écrans sont
      lisibles : aucun texte noir sur fond sombre, aucune zone blanche.
- [ ] Changer la couleur principale. → Boutons et accents suivent, en clair et en sombre.

## 11. Petit écran [Go]

Téléphone de 5 pouces ou moins (ou un émulateur 360 × 640).

- [ ] Aujourd'hui, formulaires, saisie d'une dépense : rien n'est caché sous le clavier, le
      bouton « Enregistrer » reste atteignable.
- [ ] Onglets et bouton « + » ne se chevauchent pas ; la dernière ligne d'une liste n'est pas
      cachée par le bouton flottant.

---

Après la série : noter les écarts dans « Donner mon avis » ou dans un ticket, avec le téléphone,
la version du système et la version de l’app.
