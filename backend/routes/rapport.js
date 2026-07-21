const express = require('express');
const db = require('../db');

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

  let employees = [];
  if (employee_id) {
    const emp = db.prepare('SELECT * FROM employees WHERE id = ?').get(employee_id);
    if (!emp) return res.status(404).json({ error: 'Employe introuvable' });
    employees = [emp];
  } else {
    employees = db.prepare('SELECT * FROM employees ORDER BY nom, prenom').all();
  }

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

    const heuresJourStandard = 8;
    const montantTravail = totalHeures * emp.taux_horaire;
    const montantConges = joursCongesPayes * heuresJourStandard * emp.taux_horaire;
    const montantTotal = montantTravail + montantConges;

    return {
      employee_id: emp.id,
      nom: emp.nom,
      prenom: emp.prenom,
      taux_horaire: emp.taux_horaire,
      periode: { debut, fin },
      total_heures: Math.round(totalHeures * 100) / 100,
      jours_travailles: joursTravailles,
      jours_conges: joursConges,
      jours_conges_payes: joursCongesPayes,
      solde_conges: emp.solde_conges,
      montant_travail: Math.round(montantTravail * 100) / 100,
      montant_conges: Math.round(montantConges * 100) / 100,
      montant_total: Math.round(montantTotal * 100) / 100,
      pointages,
      conges,
    };
  });

  res.json(employee_id ? rapport[0] : rapport);
});

module.exports = router;
