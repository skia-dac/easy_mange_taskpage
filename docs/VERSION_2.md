# MySky — Idées pour la version 2

Statut : **hors MVP**. Rien de ce document n'est implémenté dans la première version.
Il sert de référence pour la suite, et à préparer le MVP pour que cette évolution soit possible sans tout refaire.

---

## 1. Partage de cours et d'emploi du temps par code

### Idée

Un **établissement** ou un **professeur** publie, sur la plateforme MySky :

- ses **cours** (supports, documents, PDF…) ;
- l'**emploi du temps** d'une classe.

La publication se fait **depuis l'application**, pour **une classe précise**, avec quelques informations simples (nom de la classe, matière…).

Une fois publié :

1. Le contenu est enregistré sur le serveur MySky.
2. Un **code** est créé : généré par la plateforme ou choisi par le professeur.
3. Le professeur envoie ce code **uniquement à ses élèves**, ou aux personnes qui doivent y avoir accès.
4. L'élève entre le code dans l'application, dans un endroit prévu pour ça.
5. L'élève a **automatiquement accès** aux cours et à l'emploi du temps publiés pour cette classe.

### Avec ou sans compte

| Mode | Pour qui | Ce que ça permet |
|---|---|---|
| **Sans compte** | Professeur / établissement qui veut aller vite | Publier et obtenir un code, sans inscription. |
| **Avec compte** | Professeur / établissement régulier | Garder l'**historique** de ce qui a été publié, classe par classe, et le retrouver pour le gérer. |

### Ce que ça apporte

- L'élève n'a plus besoin de saisir ou d'importer son emploi du temps : il le reçoit.
- Cela peut **remplacer l'import par IA** (qui coûte de l'argent) pour les classes dont le professeur ou l'établissement publie l'emploi du temps.
- Les supports de cours arrivent directement dans l'application, rangés par matière.

---

## 2. Points à décider avant de développer la version 2

1. **Modifier sans compte** : comment le professeur modifie ou supprime ce qu'il a publié s'il n'a pas de compte ? Proposition : deux codes, un **code élève** (lecture) et un **code ou lien secret professeur** (modification).
2. **Mises à jour** : si le professeur change l'emploi du temps ou ajoute un cours, les élèves sont-ils mis à jour automatiquement ? Reçoivent-ils une notification ?
3. **Côté élève** : les éléments reçus sont-ils en **lecture seule**, ou l'élève peut-il les modifier dans sa propre copie (ex. ajouter une salle) ?
4. **Où s'affichent les cours reçus** : dans la page de la matière de l'élève (à côté de ses notes) ou dans un espace à part ?
5. **Sécurité du code** : le professeur peut-il **changer** ou **désactiver** un code qui circule trop ? Faut-il une date d'expiration ?
6. **Coûts** : les fichiers partagés (PDF, supports) prennent de la place sur le serveur. Il faudra fixer une limite de taille par classe pour rester dans une offre gratuite.
7. **Protection des données** : ne demander que le minimum d'informations sur les élèves (RGPD), surtout pour les mineurs.

---

## 3. Préparer le MVP pour la version 2

Sans rien développer de la version 2, le MVP doit :

- garder des **identifiants stables** (UUID) pour les matières, les séries de cours et les cours, afin qu'un contenu reçu puisse être relié à une matière de l'élève ;
- prévoir, dans le modèle de données, qu'une matière ou une série de cours puisse avoir une **origine** (`personnelle` aujourd'hui, `partagée` plus tard) ;
- garder le module **Platform** (architecture) comme endroit naturel pour un futur module « Partage ».
