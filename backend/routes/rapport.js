const express = require('express');
const db = require('../db');
const {
  supplementHeuresSup,
  montantMaladiePourAbsence,
  estJourOuvre,
  jourSemaineLundi0,
  heuresPrevuesJour,
  heuresEffectivesJour,
  datesEntre,
  pauseAppliqueePourJour,
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

// Rapport de synthese: heures travaillees, jours de conges, montant a payer.
// Un compte employe ne peut jamais consulter le rapport d'un autre employe.
router.get('/', (req, res) => {
  let { employee_id, debut, fin, mois } = req.query;
  if (req.user.role === 'employe') {
    employee_id = req.user.employee_id;
  }

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
    const droitHeuresSup = !!emp.droit_heures_sup;
    const pauseMinutes = emp.pause_minutes || 0;

    const horaires = db.prepare('SELECT * FROM horaires_travail WHERE employee_id = ?').all(emp.id);
    const horaireParJour = Object.fromEntries(horaires.map((h) => [h.jour_semaine, h]));

    // Heures effectivement payees par pointage: pause quotidienne deduite
    // seulement si la case "Pause" est cochee pour ce jour-la dans la plage
    // horaire de l'employe, et sortie plafonnee a l'heure de fin prevue si
    // l'employe n'a pas droit aux heures supplementaires (le depassement n'est
    // alors pas paye du tout).
    const heuresEffectivesParDate = {};
    const pauseAppliqueeParDate = {};
    for (const p of pointages) {
      const horaireJour = horaireParJour[jourSemaineLundi0(p.date)];
      heuresEffectivesParDate[p.date] = heuresEffectivesJour(p, horaireJour, droitHeuresSup, pauseMinutes);
      pauseAppliqueeParDate[p.date] = pauseAppliqueePourJour(horaireJour) ? pauseMinutes : 0;
    }
    const totalHeures = Object.values(heuresEffectivesParDate).reduce((acc, h) => acc + h, 0);
    const joursTravailles = pointages.filter((p) => p.heures_travaillees != null).length;

    // Heures prevues sur tout le mois (plage horaire, pause deduite selon la
    // case "Pause" du jour), independamment des pointages: c'est le volume
    // d'heures que l'employe est cense faire.
    let heuresAEffectuer = 0;
    if (horaires.length > 0) {
      for (const date of datesEntre(debut, fin)) {
        const horaireJour = horaireParJour[jourSemaineLundi0(date)];
        if (!horaireJour || !horaireJour.actif) continue;
        heuresAEffectuer += heuresPrevuesJour(horaireJour.heure_debut, horaireJour.heure_fin, pauseMinutes, horaireJour.pause_appliquee);
      }
    }

    // Presence brute: duree reelle entre entree et sortie, sans pause ni plafond
    // (peu importe le droit aux heures sup) - le temps physiquement pointe.
    const heuresPresence = pointages.reduce((acc, p) => acc + (p.heures_travaillees || 0), 0);

    // Ecart entre heures prevues (plage horaire, pause deduite) et heures
    // reellement payees, jour par jour. Ne concerne que les jours ou l'employe
    // a pointe (une absence totale sans pointage n'est pas comptee ici: c'est
    // un cas separe, a gerer via une demande de conge/absence si necessaire),
    // et exclut les jours de conge/maladie approuves et les jours feries.
    // Calcule pour tous les types de paie (utile pour le reperer dans le
    // Calendrier); seul le salaire fixe le deduit reellement du montant.
    //
    // Si le suivi des retards/departs anticipes est actif (Parametres), une
    // tolerance (en minutes) est appliquee jour par jour: en-dessous, l'ecart
    // ne compte pas; au-dessus, il compte en entier (pas seulement le
    // depassement). Le rattrapage, si actif, calcule l'ecart en compensant
    // retard et depart anticipe au sein de la meme journee (equivalent a
    // considerer l'employe comme ayant droit aux heures sup pour ce calcul
    // uniquement, quel que soit son reglage individuel). Un plafond mensuel
    // cumule peut aussi faire sauter la tolerance pour tout le mois.
    const retardsActif = !!params.retards_actif;
    const rattrapageActif = !!params.retards_rattrapage_actif;
    const toleranceMinutes = params.retards_tolerance_minutes || 0;
    const plafondMensuelActif = !!params.retards_plafond_mensuel_actif;
    const plafondMensuelMinutes = params.retards_plafond_mensuel_minutes || 0;

    const ecartsBrutsParDate = {};
    if (horaires.length > 0) {
      for (const p of pointages) {
        if (p.heures_travaillees == null) continue;
        const horaireJour = horaireParJour[jourSemaineLundi0(p.date)];
        if (!horaireJour || !horaireJour.actif) continue;
        if (joursFeriesDates.has(p.date)) continue;
        if (conges.some((c) => c.date_debut <= p.date && c.date_fin >= p.date)) continue;

        const heuresPrevues = heuresPrevuesJour(horaireJour.heure_debut, horaireJour.heure_fin, pauseMinutes, horaireJour.pause_appliquee);
        if (heuresPrevues <= 0) continue;
        const heuresEffectivesPourEcart = retardsActif
          ? heuresEffectivesJour(p, horaireJour, rattrapageActif, pauseMinutes)
          : heuresEffectivesParDate[p.date];
        const ecart = Math.max(0, heuresPrevues - heuresEffectivesPourEcart);
        if (ecart > 0.001) {
          ecartsBrutsParDate[p.date] = { heuresPrevues, ecart };
        }
      }
    }

    const totalBrutMinutes = Object.values(ecartsBrutsParDate).reduce((acc, j) => acc + j.ecart * 60, 0);
    const plafondMensuelDepasse = retardsActif && plafondMensuelActif && totalBrutMinutes > plafondMensuelMinutes;

    const joursManquants = [];
    for (const [date, { heuresPrevues, ecart }] of Object.entries(ecartsBrutsParDate)) {
      const compte = !retardsActif || plafondMensuelDepasse || ecart * 60 > toleranceMinutes;
      if (!compte) continue;
      joursManquants.push({
        date,
        heures_prevues: Math.round(heuresPrevues * 100) / 100,
        heures_effectives: Math.round((heuresPrevues - ecart) * 100) / 100,
        ecart: Math.round(ecart * 100) / 100,
      });
    }
    joursManquants.sort((a, b) => (a.date < b.date ? -1 : 1));
    const heuresManquantesTotal = joursManquants.reduce((acc, j) => acc + j.ecart, 0);
    const montantDeduction = estMensuel ? heuresManquantesTotal * emp.taux_horaire : 0;
    const heuresManquantes = estMensuel ? heuresManquantesTotal : 0;

    // Salaire fixe: les conges payes sont deja inclus dans le salaire mensuel.
    // Taux horaire: seules les heures payees sont comptees, les conges payes s'ajoutent en plus.
    const montantTravail = estMensuel
      ? Math.max(0, emp.salaire_mensuel - montantDeduction)
      : totalHeures * emp.taux_horaire;
    const montantConges = estMensuel ? 0 : joursCongesPayes * params.heures_standard_jour * emp.taux_horaire;

    // Maladie: 1er jour non paye, 2e-3e a 50%, 4e et plus a 100% (bareme indicatif, cf. Parametres).
    const montantMaladie = conges
      .filter((c) => c.type === 'maladie')
      .reduce((acc, c) => acc + montantMaladiePourAbsence(c.nb_jours, emp.taux_horaire, params.heures_standard_jour), 0);

    // Heures supplementaires: supplement uniquement (les heures elles-memes sont deja
    // dans montant_travail). Aucun supplement si l'employe n'a pas droit aux heures sup.
    const montantHeuresSup = droitHeuresSup
      ? Object.values(heuresEffectivesParDate).reduce(
          (acc, h) => acc + supplementHeuresSup(h, params, emp.taux_horaire).montant,
          0
        )
      : 0;

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
      heures_a_effectuer: Math.round(heuresAEffectuer * 100) / 100,
      heures_presence: Math.round(heuresPresence * 100) / 100,
      jours_travailles: joursTravailles,
      jours_conges: joursConges,
      jours_conges_payes: joursCongesPayes,
      jours_feries_payes: joursFeriesPayes,
      solde_conges_disponible: Math.round(soldeCongesPayes(emp, fin) * 100) / 100,
      solde_maladie_disponible: Math.round(soldeMaladie(emp, fin) * 100) / 100,
      heures_manquantes: Math.round(heuresManquantes * 100) / 100,
      jours_manquants: joursManquants,
      retards_plafond_mensuel_depasse: plafondMensuelDepasse,
      montant_travail: Math.round(montantTravail * 100) / 100,
      montant_conges: Math.round(montantConges * 100) / 100,
      montant_maladie: Math.round(montantMaladie * 100) / 100,
      montant_heures_sup: Math.round(montantHeuresSup * 100) / 100,
      montant_jours_feries: Math.round(montantJoursFeries * 100) / 100,
      montant_deduction_horaire: Math.round(montantDeduction * 100) / 100,
      montant_total: Math.round(montantTotal * 100) / 100,
      pointages: pointages.map((p) => ({
        ...p,
        heures_effectives: Math.round((heuresEffectivesParDate[p.date] || 0) * 100) / 100,
        pause_appliquee_minutes: pauseAppliqueeParDate[p.date] ?? 0,
      })),
      conges,
    };
  });

  res.json(employee_id ? rapport[0] : rapport);
});

module.exports = router;
