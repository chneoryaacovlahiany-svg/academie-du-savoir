const db = require('./db');
const { jourSemaineLundi0, heuresPrevuesJour, heuresEffectivesJour } = require('./calculs');
const { chargerParametres } = require('./soldes');

// Calcule, pour un employe et une periode donnee, les jours ou un retard ou
// depart anticipe compte (selon les regles de tolerance/rattrapage/plafond
// mensuel configurees dans Parametres). Logique partagee entre le rapport de
// paie (routes/rapport.js) et les avertissements automatiques (scheduler.js),
// pour ne jamais desynchroniser les deux.
function calculerJoursManquants(employeeId, debut, fin) {
  const params = chargerParametres();
  const emp = db.prepare('SELECT * FROM employees WHERE id = ?').get(employeeId);
  if (!emp) return { joursManquants: [], plafondMensuelDepasse: false };

  const pointages = db
    .prepare('SELECT * FROM pointages WHERE employee_id = ? AND date >= ? AND date <= ? ORDER BY date')
    .all(employeeId, debut, fin);
  const conges = db
    .prepare(`SELECT * FROM conges WHERE employee_id = ? AND statut = 'approuve' AND date_debut <= ? AND date_fin >= ?`)
    .all(employeeId, fin, debut);
  const joursFeriesDates = new Set(
    db.prepare('SELECT date FROM jours_feries WHERE date >= ? AND date <= ?').all(debut, fin).map((r) => r.date)
  );

  const pauseMinutes = emp.pause_minutes || 0;
  const horaires = db.prepare('SELECT * FROM horaires_travail WHERE employee_id = ?').all(employeeId);
  const horaireParJour = Object.fromEntries(horaires.map((h) => [h.jour_semaine, h]));

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
        : heuresEffectivesJour(p, horaireJour, !!emp.droit_heures_sup, pauseMinutes);
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
  return { joursManquants, plafondMensuelDepasse };
}

module.exports = { calculerJoursManquants };
