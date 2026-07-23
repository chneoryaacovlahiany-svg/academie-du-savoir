# Pointeuse - Application de gestion des horaires

Application de pointage pour employes : entree/sortie, calcul automatique des heures
travaillees, gestion des conges/vacances, et calcul du montant a payer.

## Fonctionnalites

- **Employes** : fiche employe avec taux horaire et solde de conges.
- **Pointage** : bouton Entree / Sortie par employe, un pointage par jour, calcul
  automatique des heures travaillees.
- **Conges & vacances** : demandes de conges (paye, sans solde, maladie, autre),
  workflow d'approbation/refus, deduction automatique du solde de conges paye.
- **Rapport & paie** : par mois, pour chaque employe : heures travaillees, jours de
  conges payes, montant du travail, montant des conges payes, montant total.

## Architecture

- `backend/` : API REST Node.js + Express, base de donnees SQLite (better-sqlite3).
- `frontend/` : interface React (Vite).

## Demarrage

### Backend

```bash
cd backend
npm install
npm start        # demarre l'API sur http://localhost:4000
```

### Frontend

```bash
cd frontend
npm install
npm run dev       # demarre l'interface sur http://localhost:5173
```

Le frontend redirige les appels `/api` vers le backend (voir `frontend/vite.config.js`).

## API

| Methode | Route | Description |
|---|---|---|
| GET/POST | `/api/employees` | Liste / creation d'employes |
| PUT/DELETE | `/api/employees/:id` | Modification / suppression |
| POST | `/api/pointages/entree` | Pointage entree du jour |
| POST | `/api/pointages/sortie` | Pointage sortie du jour |
| GET | `/api/pointages/statut/:employeeId` | Statut du pointage du jour |
| GET | `/api/pointages` | Historique des pointages (filtres: employee_id, debut, fin) |
| GET/POST | `/api/conges` | Liste / demande de conges |
| PUT | `/api/conges/:id/statut` | Approuver / refuser une demande |
| GET | `/api/rapport?mois=YYYY-MM` | Rapport heures + montant par employe |

## Deploiement (Render)

Un seul service Node est deploye: le backend sert l'API et le build du frontend
(meme origine, donc pas de souci de cookies cross-site).

1. Sur [render.com](https://render.com), creer un **Web Service** relie a ce depot GitHub.
2. **Root Directory** : laisser vide (racine du depot).
3. **Build Command** :
   ```
   cd frontend && npm install && npm run build && cd ../backend && npm install
   ```
4. **Start Command** :
   ```
   cd backend && npm start
   ```
5. **Important - stockage persistant** : la base de donnees (SQLite) et la cle de
   session sont des fichiers sur disque. Sans disque persistant, ils sont perdus a
   chaque redeploiement. Sur Render, ajouter un **disque persistant** (Persistent
   Disk, necessite un plan payant), avec un chemin de montage au choix (ex:
   `/var/data`), puis definir la variable d'environnement `DATA_DIR=/var/data`
   sur le service.
6. Une fois deploye, Render fournit une URL en `https://...` — c'est cette adresse
   que les employes utilisent (au lieu de `localhost`), y compris depuis leur
   telephone.
