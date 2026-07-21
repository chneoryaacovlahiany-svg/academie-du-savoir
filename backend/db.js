const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const dataDir = path.join(__dirname, 'data');
fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, 'pointeuse.db');
const db = new DatabaseSync(dbPath);

db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nom TEXT NOT NULL,
    prenom TEXT NOT NULL,
    poste TEXT,
    type_paie TEXT NOT NULL DEFAULT 'horaire',
    taux_horaire REAL NOT NULL DEFAULT 0,
    salaire_mensuel REAL,
    heures_semaine REAL,
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

const colonnesEmployees = db.prepare("PRAGMA table_info(employees)").all().map((c) => c.name);
if (!colonnesEmployees.includes('type_paie')) {
  db.exec("ALTER TABLE employees ADD COLUMN type_paie TEXT NOT NULL DEFAULT 'horaire'");
}
if (!colonnesEmployees.includes('salaire_mensuel')) {
  db.exec('ALTER TABLE employees ADD COLUMN salaire_mensuel REAL');
}
if (!colonnesEmployees.includes('heures_semaine')) {
  db.exec('ALTER TABLE employees ADD COLUMN heures_semaine REAL');
}

module.exports = db;
