const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const { hashPassword } = require('./passwords');

// DATA_DIR permet de faire pointer la base vers un disque persistant chez un
// hebergeur (ex: Render) plutot que le dossier local du code, qui est efface
// a chaque deploiement.
const dataDir = process.env.DATA_DIR || path.join(__dirname, 'data');
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
    pause_minutes INTEGER NOT NULL DEFAULT 0,
    droit_heures_sup INTEGER NOT NULL DEFAULT 1,
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
    lieu TEXT,
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

  CREATE TABLE IF NOT EXISTS horaires_travail (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    jour_semaine INTEGER NOT NULL,
    heure_debut TEXT,
    heure_fin TEXT,
    actif INTEGER NOT NULL DEFAULT 1,
    pause_appliquee INTEGER NOT NULL DEFAULT 1,
    UNIQUE(employee_id, jour_semaine)
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'employe',
    employee_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
    actif INTEGER NOT NULL DEFAULT 1,
    date_creation TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS push_subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL UNIQUE,
    cle_p256dh TEXT NOT NULL,
    cle_auth TEXT NOT NULL,
    date_creation TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS rappels_etat (
    employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    type TEXT NOT NULL,
    nb_envoyes INTEGER NOT NULL DEFAULT 0,
    prochain_envoi TEXT,
    PRIMARY KEY (employee_id, date, type)
  );

  CREATE TABLE IF NOT EXISTS avertissements_etat (
    employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    mois TEXT NOT NULL,
    niveau_envoye INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (employee_id, mois)
  );

  CREATE TABLE IF NOT EXISTS avertissements_historique (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    mois TEXT NOT NULL,
    niveau INTEGER NOT NULL,
    message TEXT NOT NULL,
    date_envoi TEXT NOT NULL DEFAULT (datetime('now'))
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
if (!colonnesEmployees.includes('pause_minutes')) {
  db.exec('ALTER TABLE employees ADD COLUMN pause_minutes INTEGER NOT NULL DEFAULT 0');
}
if (!colonnesEmployees.includes('droit_heures_sup')) {
  db.exec('ALTER TABLE employees ADD COLUMN droit_heures_sup INTEGER NOT NULL DEFAULT 1');
}
if (!colonnesEmployees.includes('email')) {
  db.exec('ALTER TABLE employees ADD COLUMN email TEXT');
}

const colonnesHoraires = db.prepare("PRAGMA table_info(horaires_travail)").all().map((c) => c.name);
if (!colonnesHoraires.includes('pause_appliquee')) {
  db.exec('ALTER TABLE horaires_travail ADD COLUMN pause_appliquee INTEGER NOT NULL DEFAULT 1');
}

const colonnesPointages = db.prepare("PRAGMA table_info(pointages)").all().map((c) => c.name);
if (!colonnesPointages.includes('lieu')) {
  db.exec('ALTER TABLE pointages ADD COLUMN lieu TEXT');
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
  ip_bureau: '',
  retards_actif: '0',
  retards_tolerance_minutes: '15',
  retards_plafond_mensuel_actif: '0',
  retards_plafond_mensuel_minutes: '120',
  retards_rattrapage_actif: '0',
  notif_auto_actif: '0',
  notif_entree_avant_actif: '0',
  notif_entree_avant_minutes: '10',
  notif_entree_nb_rappels: '3',
  notif_entree_intervalle_minutes: '15',
  notif_sortie_nb_rappels: '3',
  notif_sortie_intervalle_minutes: '15',
  notif_sortie_options_report: '20,30,40',
  avertissements_retards_actif: '0',
  avertissements_retards_seuil: '3',
  avertissements_retards_message_1:
    "Nous avons remarque plusieurs retards ou departs anticipes ce mois-ci. Merci d'etre attentif a votre ponctualite.",
  avertissements_retards_message_2:
    'Vos retards ou departs anticipes se repetent ce mois-ci. Nous vous demandons de veiller a respecter vos horaires.',
  avertissements_retards_message_3:
    'Le nombre de retards ou departs anticipes ce mois-ci devient preoccupant. Merci de corriger rapidement la situation.',
  avertissements_retards_message_4:
    "Vos retards ou departs anticipes repetes posent un probleme serieux. Si la situation ne s'ameliore pas, des mesures pourront etre prises.",
  avertissements_retards_message_5:
    "Dernier avertissement: vos retards ou departs anticipes repetes constituent un manquement grave a vos obligations. Sans amelioration immediate, des sanctions disciplinaires, pouvant aller jusqu'a la rupture du contrat, pourront etre engagees.",
  avertissements_email_actif: '0',
  email_conges_nouvelle_demande_actif: '0',
  email_conges_reponse_actif: '0',
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

// Compte administrateur par defaut cree au premier demarrage (si aucun compte
// n'existe encore). A changer immediatement depuis l'application.
const nbUtilisateurs = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
if (nbUtilisateurs === 0) {
  db.prepare('INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)').run(
    'admin',
    hashPassword('admin123'),
    'admin'
  );
  console.log('Compte administrateur par defaut cree: identifiant "admin", mot de passe "admin123". Changez-le des la premiere connexion.');
}

module.exports = db;
