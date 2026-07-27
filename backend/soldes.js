const db = require('./db');
const { joursCongesAcquisCumules, joursMaladieAcquis } = require('./calculs');

function chargerBareme() {
  return db.prepare('SELECT * FROM bareme_conges ORDER BY anciennete_annees').all();
}

// Parametres textuels (ex: liste d'IP), a ne pas convertir en nombre.
const CLES_TEXTE = new Set(['ip_bureau', 'notif_sortie_options_report']);

function chargerParametres() {
  const rows = db.prepare('SELECT * FROM parametres').all();
  const params = {};
  for (const row of rows) {
    params[row.cle] = CLES_TEXTE.has(row.cle) ? row.valeur : Number(row.valeur);
  }
  return params;
}

function joursApprouves(employeeId, type, avantDate) {
  const rows = db
    .prepare(
      `SELECT nb_jours FROM conges WHERE employee_id = ? AND type = ? AND statut = 'approuve' AND date_debut <= ?`
    )
    .all(employeeId, type, avantDate);
  return rows.reduce((acc, r) => acc + r.nb_jours, 0);
}

// Solde de conges payes = ajustement manuel + acquis par anciennete depuis l'embauche - jours deja pris.
function soldeCongesPayes(employee, dateRef) {
  const bareme = chargerBareme();
  const acquis = joursCongesAcquisCumules(employee.date_embauche, dateRef, bareme);
  const pris = joursApprouves(employee.id, 'conge_paye', dateRef);
  return employee.solde_conges + acquis - pris;
}

function soldeMaladie(employee, dateRef) {
  const params = chargerParametres();
  const acquis = joursMaladieAcquis(
    employee.date_embauche,
    dateRef,
    params.accumulation_maladie_mois,
    params.plafond_conges_maladie
  );
  const pris = joursApprouves(employee.id, 'maladie', dateRef);
  return acquis - pris;
}

module.exports = { chargerBareme, chargerParametres, soldeCongesPayes, soldeMaladie };
