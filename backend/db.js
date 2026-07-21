const path = require('path');
const Database = require('better-sqlite3');

const dbPath = path.join(__dirname, 'data', 'pointeuse.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nom TEXT NOT NULL,
    prenom TEXT NOT NULL,
    poste TEXT,
    taux_horaire REAL NOT NULL DEFAULT 0,
    solde_conges REAL NOT NULL DEFAULT 0,
    actif INTEGER NOT NULL DEFAULT 1,
    date_creation TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS pointages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    heure_entree TEXT,
    heure_sortie TEXT,
    heures_travaillees REAL,
    UNIQUE(employee_id, date)
  );

  CREATE TABLE IF NOT EXISTS conges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    date_debut TEXT NOT NULL,
    date_fin TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'conge_paye',
    statut TEXT NOT NULL DEFAULT 'en_attente',
    nb_jours REAL NOT NULL,
    commentaire TEXT
  );
`);

module.exports = db;
