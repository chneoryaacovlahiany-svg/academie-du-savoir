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
