# Dispositif FDF — React (PC + mobile)

    npm install
    npm run dev      # mode local (localStorage) sans .env
    npm run build    # Netlify (netlify.toml fourni)

## Firebase (temps réel)
1. Copier `.env.example` en `.env`, renseigner la config.
2. Activer Authentication (e-mail/mot de passe) + Firestore.
3. Publier `firestore.rules`.
Collections : `config/main` (paramétrage), `days/YYYY-MM-DD`.

## Paramétrable (⚙)
Titre/échéance, thème, densité, couleur ; blocs (ajout, ordre, lignes, intitulé, emplacement) ;
listes (NMR, niveaux, validation, CIS…) et champs d'en-tête ; légende ; import/export JSON.

## Connexion et rôles (Firebase)

1. Console Firebase › Authentication › méthode « E-mail/Mot de passe » activée.
2. Publier `firestore.rules` (nouveau : annuaire `roster/{e-mail}` et auto-attribution du rôle).
3. Création de compte : nom, prénom, e-mail, mot de passe. Un e-mail de confirmation est envoyé.
4. Si l'e-mail figure dans Paramètres › Gestion du personnel (colonne « E-mail du compte ») et que la fiche a un rôle,
   la personne reçoit ce rôle d'elle-même dès que son adresse est confirmée (sans administrateur connecté).
5. Si la personne s'est inscrite avec un e-mail différent de la fiche, Gestion du personnel affiche « Comptes reconnus par leur
   nom, à rattacher » : un clic recopie l'e-mail du compte dans la fiche et applique le rôle.
6. Plusieurs comptes et plusieurs rôles peuvent être connectés en même temps ; chacun ne voit que les onglets de ses droits.

## Déploiement Firebase Hosting

```
npm install
cp .env.example .env        # puis renseigner les 4 clés VITE_FIREBASE_*
npm run build
npm install -g firebase-tools
firebase login
firebase use --add          # choisir le projet Firebase
firebase deploy --only hosting,firestore:rules
```
