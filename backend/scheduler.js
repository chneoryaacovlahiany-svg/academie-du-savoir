const db = require('./db');
const { webpush } = require('./vapid');
const { dateLocale, jourSemaineLundi0 } = require('./calculs');
const { chargerParametres } = require('./soldes');

const INTERVALLE_VERIFICATION_MS = 60000;

async function envoyerPush(sub, payload) {
  try {
    await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.cle_p256dh, auth: sub.cle_auth } }, payload);
  } catch (err) {
    if (err.statusCode === 404 || err.statusCode === 410) {
      // Abonnement perime (app desinstallee, permission revoquee...): on l'oublie.
      db.prepare('DELETE FROM push_subscriptions WHERE id = ?').run(sub.id);
    } else {
      console.error('Erreur envoi notification push:', err.message);
    }
  }
}

// Soustrait des minutes a une heure "HH:MM". Se bloque a 00:00 (sans passer a
// la veille) si le resultat serait negatif: cas limite tres improbable en
// pratique (planning commencant a moins de "avant_minutes" apres minuit).
function soustraireMinutes(heureStr, minutes) {
  const [h, m] = heureStr.split(':').map(Number);
  const total = Math.max(0, h * 60 + m - minutes);
  const hh = String(Math.floor(total / 60)).padStart(2, '0');
  const mm = String(total % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

// Verifie, pour un employe et un type de rappel donne ("entree_avant",
// "entree" ou "sortie"), si le moment est venu d'envoyer un nouveau rappel:
// pas encore atteint le nombre max, et l'heure du prochain envoi (calculee a
// l'heure prevue puis decalee par l'intervalle configure, ou reportee via un
// bouton "+X min" sur la notification precedente) est passee.
async function verifierEtEnvoyerRappel(emp, subs, date, type, heurePrevueStr, nbMax, intervalleMinutes, maintenant, corps, optionsReport) {
  if (!heurePrevueStr || !nbMax || nbMax <= 0) return;
  const heurePrevue = new Date(`${date}T${heurePrevueStr}:00`);

  let etat = db.prepare('SELECT * FROM rappels_etat WHERE employee_id = ? AND date = ? AND type = ?').get(emp.id, date, type);
  if (!etat) {
    db.prepare('INSERT INTO rappels_etat (employee_id, date, type, nb_envoyes, prochain_envoi) VALUES (?, ?, ?, 0, ?)').run(
      emp.id,
      date,
      type,
      heurePrevue.toISOString()
    );
    etat = { nb_envoyes: 0, prochain_envoi: heurePrevue.toISOString() };
  }
  if (etat.nb_envoyes >= nbMax) return;
  if (!etat.prochain_envoi || new Date(etat.prochain_envoi) > maintenant) return;

  const actions =
    type === 'sortie' && optionsReport
      ? optionsReport
          .split(',')
          .map((m) => m.trim())
          .filter(Boolean)
          .map((m) => ({ action: `report_${m}`, title: `+${m} min` }))
      : undefined;

  const payload = JSON.stringify({
    titre: 'Pointeuse',
    corps,
    tag: `${type}-${emp.id}-${date}`,
    type,
    employeeId: emp.id,
    actions,
  });

  for (const sub of subs) {
    await envoyerPush(sub, payload);
  }

  const prochain = new Date(maintenant.getTime() + intervalleMinutes * 60000);
  db.prepare('UPDATE rappels_etat SET nb_envoyes = nb_envoyes + 1, prochain_envoi = ? WHERE employee_id = ? AND date = ? AND type = ?').run(
    prochain.toISOString(),
    emp.id,
    date,
    type
  );
}

async function verifierRappels() {
  const params = chargerParametres();
  if (!params.notif_auto_actif) return;

  const maintenant = new Date();
  const date = dateLocale(maintenant);
  const jourIdx = jourSemaineLundi0(date);

  const employees = db.prepare('SELECT * FROM employees WHERE actif = 1').all();
  for (const emp of employees) {
    const subs = db.prepare('SELECT * FROM push_subscriptions WHERE employee_id = ?').all(emp.id);
    if (subs.length === 0) continue;

    const horaireJour = db.prepare('SELECT * FROM horaires_travail WHERE employee_id = ? AND jour_semaine = ?').get(emp.id, jourIdx);
    if (!horaireJour || !horaireJour.actif) continue;

    const pointage = db.prepare('SELECT * FROM pointages WHERE employee_id = ? AND date = ?').get(emp.id, date);
    const pointe = pointage && pointage.heure_entree && !pointage.heure_sortie;
    const termine = pointage && pointage.heure_entree && pointage.heure_sortie;

    if (!pointe && !termine) {
      // Rappel preventif avant l'heure de debut prevue (en plus de celui qui
      // part pile a l'heure): un seul envoi, suivi independamment de la
      // sequence de rappels qui suit une fois l'heure prevue atteinte.
      if (params.notif_entree_avant_minutes > 0) {
        const heureAvant = soustraireMinutes(horaireJour.heure_debut, params.notif_entree_avant_minutes);
        await verifierEtEnvoyerRappel(
          emp,
          subs,
          date,
          'entree_avant',
          heureAvant,
          1,
          0,
          maintenant,
          `Votre journee de travail commence a ${horaireJour.heure_debut}, n'oubliez pas de pointer votre entree.`
        );
      }
      await verifierEtEnvoyerRappel(
        emp,
        subs,
        date,
        'entree',
        horaireJour.heure_debut,
        params.notif_entree_nb_rappels,
        params.notif_entree_intervalle_minutes,
        maintenant,
        "N'oubliez pas de pointer votre entree."
      );
    } else if (pointe) {
      await verifierEtEnvoyerRappel(
        emp,
        subs,
        date,
        'sortie',
        horaireJour.heure_fin,
        params.notif_sortie_nb_rappels,
        params.notif_sortie_intervalle_minutes,
        maintenant,
        "N'oubliez pas de pointer votre sortie. Vous pouvez reporter le rappel si vous faites des heures de rattrapage.",
        params.notif_sortie_options_report
      );
    }
  }
}

function demarrer() {
  setInterval(() => {
    verifierRappels().catch((err) => console.error('Erreur verification des rappels:', err));
  }, INTERVALLE_VERIFICATION_MS);
}

module.exports = { demarrer, verifierRappels };
