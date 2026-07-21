const express = require('express');
const db = require('../db');
const { joursAnnuelsAcquis, ancienneteAnnees, dateLocale } = require('../calculs');
const { chargerBareme, soldeCongesPayes, soldeMaladie } = require('../soldes');

const router = express.Router();

// Multiplicateur indicatif d'excedent de conges non pris (a faire valider avec un professionnel).
const MULTIPLICATEUR_EXCEDENT = 2;

router.get('/', (req, res) => {
  const aujourdhui = dateLocale();
  const annee = req.query.annee || aujourdhui.slice(0, 4);
  const debutAnnee = `${annee}-01-01`;
  const finAnnee = `${annee}-12-31`;

  let employees;
  if (req.query.employee_id) {
    const emp = db.prepare('SELECT * FROM employees WHERE id = ?').get(req.query.employee_id);
    employees = emp ? [emp] : [];
  } else {
    employees = db.prepare('SELECT * FROM employees WHERE actif = 1').all();
  }
  const bareme = chargerBareme();

  const congesPrisAnnee = db
    .prepare(
      `SELECT employee_id, SUM(nb_jours) as total FROM conges
       WHERE type = 'conge_paye' AND statut = 'approuve' AND date_debut >= ? AND date_debut <= ?
       GROUP BY employee_id`
    )
    .all(debutAnnee, finAnnee);
  const prisParEmploye = Object.fromEntries(congesPrisAnnee.map((r) => [r.employee_id, r.total]));

  const employesDetail = employees.map((emp) => {
    const anciennete = ancienneteAnnees(emp.date_embauche, aujourdhui);
    const droitAnnuelActuel = joursAnnuelsAcquis(anciennete, bareme);
    const prisCetteAnnee = prisParEmploye[emp.id] || 0;
    const restant = Math.round(soldeCongesPayes(emp, aujourdhui) * 100) / 100;

    let statut = 'bon';
    if (restant < 0) statut = 'critique';
    else if (droitAnnuelActuel > 0 && restant > droitAnnuelActuel * MULTIPLICATEUR_EXCEDENT) statut = 'excedent';

    return {
      employee_id: emp.id,
      nom: emp.nom,
      prenom: emp.prenom,
      date_embauche: emp.date_embauche,
      droit_annuel_actuel: droitAnnuelActuel,
      jours_pris_annee: prisCetteAnnee,
      jours_restants: restant,
      solde_maladie_disponible: Math.round(soldeMaladie(emp, aujourdhui) * 100) / 100,
      statut,
    };
  });

  const prochainFerie = db
    .prepare('SELECT * FROM jours_feries WHERE date >= ? ORDER BY date LIMIT 1')
    .get(aujourdhui);
  const feriesRestantsAnnee = db
    .prepare('SELECT COUNT(*) as total FROM jours_feries WHERE date >= ? AND date <= ?')
    .get(aujourdhui, finAnnee).total;

  const moisCourant = aujourdhui.slice(0, 7);
  const debutMois = `${moisCourant}-01`;
  const dernierJourMois = new Date(Number(moisCourant.slice(0, 4)), Number(moisCourant.slice(5, 7)), 0).getDate();
  const finMois = `${moisCourant}-${String(dernierJourMois).padStart(2, '0')}`;

  let masseHoraire = 0;
  let masseMensuelle = 0;
  for (const emp of employees) {
    const pointages = db
      .prepare('SELECT * FROM pointages WHERE employee_id = ? AND date >= ? AND date <= ?')
      .all(emp.id, debutMois, finMois);
    const totalHeures = pointages.reduce((acc, p) => acc + (p.heures_travaillees || 0), 0);
    if (emp.type_paie === 'mensuel' && emp.salaire_mensuel) {
      masseMensuelle += emp.salaire_mensuel;
    } else {
      masseHoraire += totalHeures * emp.taux_horaire;
    }
  }

  res.json({
    periode: { annee, debut_mois: debutMois, fin_mois: finMois },
    global: {
      jours_conges_pris_annee: Object.values(prisParEmploye).reduce((a, b) => a + b, 0),
      jours_conges_restants: Math.round(
        employesDetail.reduce((acc, e) => acc + e.jours_restants, 0) * 100
      ) / 100,
      masse_salariale_horaire: Math.round(masseHoraire * 100) / 100,
      masse_salariale_mensuelle: Math.round(masseMensuelle * 100) / 100,
      masse_salariale_totale: Math.round((masseHoraire + masseMensuelle) * 100) / 100,
      prochain_jour_ferie: prochainFerie || null,
      jours_feries_restants_annee: feriesRestantsAnnee,
    },
    employes: employesDetail,
  });
});

module.exports = router;
