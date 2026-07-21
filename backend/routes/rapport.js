const express = require('express');
const db = require('../db');
const {
  supplementHeuresSup,
  montantMaladiePourAbsence,
  estJourOuvre,
  jourSemaineLundi0,
  heuresPrevuesJour,
} = require('../calculs');
const { chargerParametres, soldeCongesPayes, soldeMaladie } = require('../soldes');

const router = express.Router();

function premierEtDernierJourMois(mois) {
  // mois au format "YYYY-MM"
  const [annee, m] = mois.split('-').map(Number);
  const debut = `${mois}-01`;
  const dernierJour = new Date(annee, m, 0).getDate();
  const fin = `${mois}-${String(dernierJour).padStart(2, '0')}`;
  return { debut, fin };
}

// Rapport de synthese: heures travaillees, jours de conges, montant a payer
router.get('/', (req, res) => {
  let { employee_id, debut, fin, mois } = req.query;

  if (mois) {
    ({ debut, fin } = premierEtDernierJourMois(mois));
  }
  if (!debut || !fin) {
    return res.status(400).json({ error: 'Fournir soit "mois" (YYYY-MM) soit "debut" et "fin" (YYYY-MM-DD)' });
  }

  const params = chargerParametres();

  let employees = [];
  if (employee_id) {
    const emp = db.prepare('SELECT * FROM employees WHERE id = ?').get(employee_id);
    if (!emp) return res.status(404).json({ error: 'Employe introuvable' });
    employees = [emp];
  } else {
    employees = db.prepare('SELECT * FROM employees ORDER BY nom, prenom').all();
  }

  const joursFeriesPeriode = db
    .prepare('SELECT * FROM jours_feries WHERE date >= ? AND date <= ? ORDER BY date')
    .all(debut, fin);
  const joursFeriesDates = new Set(joursFeriesPeriode.map((jf) => jf.date));

  const rapport = employees.map((emp) => {
    const pointages = db
      .prepare(
        `SELECT * FROM pointages WHERE employee_id = ? AND date >= ? AND date <= ? ORDER BY date`
      )
      .all(emp.id, debut, fin);

    const totalHeures = pointages.reduce((acc, p) => acc + (p.heures_travaillees || 0), 0);
    const joursTravailles = pointages.filter((p) => p.heures_travaillees != null).length;

    const conges = db
      .prepare(
        `SELECT * FROM conges WHERE employee_id = ? AND statut = 'approuve'
         AND date_debut <= ? AND date_fin >= ?`
      )
      .all(emp.id, fin, debut);

    const joursConges = conges.reduce((acc, c) => acc + c.nb_jours, 0);
    const joursCongesPayes = conges
      .filter((c) => c.type === 'conge_paye')
      .reduce((acc, c) => acc + c.nb_jours, 0);

    const estMensuel = emp.type_paie === 'mensuel' && emp.salaire_mensuel;

    // Salaire fixe: si une plage horaire est definie pour l'employe, un ecart entre
    // les heures prevues et les heures reellement pointees (retard, depart anticipe)
    // est deduit du salaire. Ne s'applique qu'aux jours ou l'employe a pointe
    // (une absence totale sans pointage n'est PAS deduite ici: c'est un cas separe,
    // a gerer via une demande de conge/absence si necessaire).
    let montantDeduction = 0;
    let heuresManquantes = 0;
    const horaires = estMensuel
      ? db.prepare('SELECT * FROM horaires_travail WHERE employee_id = ?').all(emp.id)
      : [];
    if (estMensuel && horaires.length > 0) {
      const horaireParJour = Object.fromEntries(horaires.map((h) => [h.jour_semaine, h]));
      for (const p of pointages) {
        if (p.heures_travaillees == null) continue;
        const horaireJour = horaireParJour[jourSemaineLundi0(p.date)];
        if (!horaireJour || !horaireJour.actif) continue;
        if (joursFeriesDates.has(p.date)) continue;
        if (conges.some((c) => c.date_debut <= p.date && c.date_fin >= p.date)) continue;

        const heuresPrevues = heuresPrevuesJour(horaireJour.heure_debut, horaireJour.heure_fin);
        if (heuresPrevues <= 0) continue;
        const ecart = Math.max(0, heuresPrevues - p.heures_travaillees);
        heuresManquantes += ecart;
        montantDeduction += ecart * emp.taux_horaire;
      }
    }

    // Salaire fixe: les conges payes sont deja inclus dans le salaire mensuel.
    // Taux horaire: seules les heures pointees sont payees, les conges payes s'ajoutent en plus.
    const montantTravail = estMensuel
      ? Math.max(0, emp.salaire_mensuel - montantDeduction)
      : totalHeures * emp.taux_horaire;
    const montantConges = estMensuel ? 0 : joursCongesPayes * params.heures_standard_jour * emp.taux_horaire;

    // Maladie: 1er jour non paye, 2e-3e a 50%, 4e et plus a 100% (bareme indicatif, cf. Parametres).
    const montantMaladie = conges
      .filter((c) => c.type === 'maladie')
      .reduce((acc, c) => acc + montantMaladiePourAbsence(c.nb_jours, emp.taux_horaire, params.heures_standard_jour), 0);

    // Heures supplementaires: supplement uniquement (les heures elles-memes sont deja dans montant_travail).
    const montantHeuresSup = pointages.reduce((acc, p) => {
      if (!p.heures_travaillees) return acc;
      return acc + supplementHeuresSup(p.heures_travaillees, params, emp.taux_horaire).montant;
    }, 0);

    // Jours feries payes non travailles (hors salaire mensuel, deja inclus dedans).
    const dateSPointees = new Set(pointages.map((p) => p.date));
    const joursFeriesPayes = estMensuel
      ? 0
      : joursFeriesPeriode.filter((jf) => estJourOuvre(jf.date) && !dateSPointees.has(jf.date)).length;
    const montantJoursFeries = joursFeriesPayes * params.heures_standard_jour * emp.taux_horaire;

    const montantTotal = montantTravail + montantConges + montantMaladie + montantHeuresSup + montantJoursFeries;

    return {
      employee_id: emp.id,
      nom: emp.nom,
      prenom: emp.prenom,
      type_paie: emp.type_paie,
      taux_horaire: emp.taux_horaire,
      salaire_mensuel: emp.salaire_mensuel,
      heures_semaine: emp.heures_semaine,
      periode: { debut, fin },
      total_heures: Math.round(totalHeures * 100) / 100,
      jours_travailles: joursTravailles,
      jours_conges: joursConges,
      jours_conges_payes: joursCongesPayes,
      jours_feries_payes: joursFeriesPayes,
      solde_conges_disponible: Math.round(soldeCongesPayes(emp, fin) * 100) / 100,
      solde_maladie_disponible: Math.round(soldeMaladie(emp, fin) * 100) / 100,
      heures_manquantes: Math.round(heuresManquantes * 100) / 100,
      montant_travail: Math.round(montantTravail * 100) / 100,
      montant_conges: Math.round(montantConges * 100) / 100,
      montant_maladie: Math.round(montantMaladie * 100) / 100,
      montant_heures_sup: Math.round(montantHeuresSup * 100) / 100,
      montant_jours_feries: Math.round(montantJoursFeries * 100) / 100,
      montant_deduction_horaire: Math.round(montantDeduction * 100) / 100,
      montant_total: Math.round(montantTotal * 100) / 100,
      pointages,
      conges,
    };
  });

  res.json(employee_id ? rapport[0] : rapport);
});

module.exports = router;
