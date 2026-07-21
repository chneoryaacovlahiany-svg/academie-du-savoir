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
    date_embauche TEXT,
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

  CREATE TABLE IF NOT EXISTS parametres (
    cle TEXT PRIMARY KEY,
    valeur TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS bareme_conges (
    anciennete_annees INTEGER PRIMARY KEY,
    jours_par_an REAL NOT NULL
  );

  CREATE TABLE IF NOT EXISTS jours_feries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL UNIQUE,
    nom TEXT NOT NULL
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
if (!colonnesEmployees.includes('date_embauche')) {
  db.exec('ALTER TABLE employees ADD COLUMN date_embauche TEXT');
}

// Parametres par defaut (modifiables dans l'onglet Parametres).
// A verifier avec un comptable / conseiller en paie avant utilisation reelle.
const parametresDefaut = {
  semaine_jours: '5',
  heures_standard_jour: '8',
  seuil_heures_sup_125: '2',
  majoration_heures_sup_125: '1.25',
  majoration_heures_sup_150: '1.5',
  plafond_conges_maladie: '90',
  accumulation_maladie_mois: '1.5',
};
const insererParametre = db.prepare('INSERT OR IGNORE INTO parametres (cle, valeur) VALUES (?, ?)');
for (const [cle, valeur] of Object.entries(parametresDefaut)) {
  insererParametre.run(cle, valeur);
}

// Bareme de conges annuels par anciennete (semaine de 5 jours), a titre indicatif.
// A verifier avec un professionnel: le droit israelien evolue et depend de conventions sectorielles.
const baremeDefaut = [
  [0, 12],
  [5, 14],
  [7, 15],
  [9, 17],
  [10, 18],
  [11, 19],
  [12, 20],
  [13, 21],
  [14, 22],
  [15, 23],
];
const insererBareme = db.prepare('INSERT OR IGNORE INTO bareme_conges (anciennete_annees, jours_par_an) VALUES (?, ?)');
for (const [annees, jours] of baremeDefaut) {
  insererBareme.run(annees, jours);
}

module.exports = db;
