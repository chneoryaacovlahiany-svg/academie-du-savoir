const db = require('./db');
const { webpush } = require('./vapid');
const { dateLocale, jourSemaineLundi0 } = require('./calculs');
const { chargerParametres } = require('./soldes');
const { calculerJoursManquants } = require('./retards');
const { envoyerEmail } = require('./email');
const { enregistrerNotification } = require('./notifications');

const INTERVALLE_VERIFICATION_MS = 60000;
const NB_NIVEAUX_AVERTISSEMENT = 5;

async function envoyerPush(sub, payload) {
  try {
    await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.cle_p256dh, auth: sub.cle_auth } }, payload);
  } catch (err) {
    if (err.statusCode === 404 || err.statusCode === 410) {
      // Abonnement perime (app desinstallee, permission revoquee...): on l'oublie.
      db.prepare('DELETE FROM push_subscriptions WHERE id = ?').run(sub.id);
    } else {
      // err.body contient souvent la raison exacte du refus (ex: cle VAPID
      // invalide, aud incorrect, payload trop volumineux...), utile pour
      // diagnostiquer les echecs specifiques a certains services (Apple Web
      // Push notamment), que le message generique de la librairie ne donne pas.
      console.error(
        'Erreur envoi notification push:',
        'statusCode=', err.statusCode,
        'endpoint=', sub.endpoint,
        'body=', err.body,
        'message=', err.message
      );
    }
  }
}

// Envoie une notification push a tous les appareils abonnes d'un employe
// donne. Reutilise pour les evenements ponctuels (conges) en plus des
// rappels/avertissements automatiques.
async function envoyerPushAEmploye(employeeId, titre, corps, type) {
  enregistrerNotification(employeeId, type, titre, corps);
  const subs = db.prepare('SELECT * FROM push_subscriptions WHERE employee_id = ?').all(employeeId);
  if (subs.length === 0) return;
  const payload = JSON.stringify({ titre, corps, tag: `${type}-${employeeId}-${Date.now()}`, type, employeeId });
  for (const sub of subs) {
    await envoyerPush(sub, payload);
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

  enregistrerNotification(emp.id, type, 'Pointeuse', corps);
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
      if (params.notif_entree_avant_actif && params.notif_entree_avant_minutes > 0) {
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

// Verifie, pour chaque employe actif, si le nombre de retards/departs
// anticipes comptes ce mois-ci (meme calcul que le Rapport & Paie) a franchi
// un nouveau palier (seuil, 2x seuil, 3x seuil...), jusqu'a 5 paliers. Un seul
// avertissement est envoye par palier franchi et par mois (le compteur est
// remis a zero chaque mois via la cle "mois" de l'etat); si plusieurs paliers
// sont franchis d'un coup entre deux verifications, seul le palier le plus
// eleve est envoye (les precedents n'ont plus de sens a signaler separement).
async function calculerEtEnvoyerAvertissements() {
  const params = chargerParametres();
  if (!params.avertissements_retards_actif) return;
  const seuil = Number(params.avertissements_retards_seuil);
  if (!seuil || seuil <= 0) return;

  const maintenant = new Date();
  const mois = dateLocale(maintenant).slice(0, 7);
  const [annee, m] = mois.split('-').map(Number);
  const debut = `${mois}-01`;
  const fin = `${mois}-${String(new Date(annee, m, 0).getDate()).padStart(2, '0')}`;

  const employees = db.prepare('SELECT * FROM employees WHERE actif = 1').all();
  for (const emp of employees) {
    const subs = db.prepare('SELECT * FROM push_subscriptions WHERE employee_id = ?').all(emp.id);

    const { joursManquants } = calculerJoursManquants(emp.id, debut, fin);
    const niveauAtteint = Math.min(NB_NIVEAUX_AVERTISSEMENT, Math.floor(joursManquants.length / seuil));
    if (niveauAtteint <= 0) continue;

    const etat = db.prepare('SELECT * FROM avertissements_etat WHERE employee_id = ? AND mois = ?').get(emp.id, mois);
    const niveauDejaEnvoye = etat ? etat.niveau_envoye : 0;
    if (niveauAtteint <= niveauDejaEnvoye) continue;

    const corps = params[`avertissements_retards_message_${niveauAtteint}`];
    const payload = JSON.stringify({
      titre: 'Pointeuse',
      corps,
      tag: `avertissement_retard-${emp.id}-${mois}`,
      type: 'avertissement_retard',
      employeeId: emp.id,
    });
    enregistrerNotification(emp.id, 'avertissement_retard', 'Pointeuse', corps);
    for (const sub of subs) {
      await envoyerPush(sub, payload);
    }
    if (params.avertissements_email_actif && emp.email) {
      await envoyerEmail(emp.email, 'Avertissement - retards ou departs anticipes repetes', corps);
    }

    db.prepare(
      `INSERT INTO avertissements_etat (employee_id, mois, niveau_envoye) VALUES (?, ?, ?)
       ON CONFLICT(employee_id, mois) DO UPDATE SET niveau_envoye = excluded.niveau_envoye`
    ).run(emp.id, mois, niveauAtteint);

    db.prepare('INSERT INTO avertissements_historique (employee_id, mois, niveau, message) VALUES (?, ?, ?, ?)').run(
      emp.id,
      mois,
      niveauAtteint,
      corps
    );
  }
}

// Calcul relativement couteux (recalcule tout le rapport du mois par employe):
// pas besoin d'une precision a la minute comme pour les rappels de pointage,
// une verification par jour suffit largement.
let derniereDateAvertissements = null;
async function verifierAvertissementsRetards() {
  const date = dateLocale();
  if (derniereDateAvertissements === date) return;
  derniereDateAvertissements = date;
  await calculerEtEnvoyerAvertissements();
}

// Envoi manuel, decide par l'admin, d'un avertissement a un employe donne
// (independamment du declenchement automatique par seuil). Enregistre dans
// le meme historique et met a jour le palier atteint ce mois-ci (au maximum
// du palier deja atteint automatiquement et de celui envoye manuellement),
// pour que le suivi automatique ne renvoie pas ensuite un palier deja couvert.
async function envoyerAvertissementManuel(employeeId, niveau, message) {
  const subs = db.prepare('SELECT * FROM push_subscriptions WHERE employee_id = ?').all(employeeId);
  const mois = dateLocale().slice(0, 7);

  const payload = JSON.stringify({
    titre: 'Pointeuse',
    corps: message,
    tag: `avertissement_retard-manuel-${employeeId}-${Date.now()}`,
    type: 'avertissement_retard',
    employeeId,
  });
  enregistrerNotification(employeeId, 'avertissement_retard', 'Pointeuse', message);
  for (const sub of subs) {
    await envoyerPush(sub, payload);
  }

  const params = chargerParametres();
  const emp = db.prepare('SELECT * FROM employees WHERE id = ?').get(employeeId);
  let emailEnvoye = false;
  if (params.avertissements_email_actif && emp?.email) {
    await envoyerEmail(emp.email, 'Avertissement - retards ou departs anticipes repetes', message);
    emailEnvoye = true;
  }

  db.prepare(
    `INSERT INTO avertissements_etat (employee_id, mois, niveau_envoye) VALUES (?, ?, ?)
     ON CONFLICT(employee_id, mois) DO UPDATE SET niveau_envoye = MAX(niveau_envoye, excluded.niveau_envoye)`
  ).run(employeeId, mois, niveau);

  db.prepare('INSERT INTO avertissements_historique (employee_id, mois, niveau, message) VALUES (?, ?, ?, ?)').run(
    employeeId,
    mois,
    niveau,
    message
  );

  return { nbAppareils: subs.length, emailEnvoye };
}

function demarrer() {
  setInterval(() => {
    verifierRappels().catch((err) => console.error('Erreur verification des rappels:', err));
    verifierAvertissementsRetards().catch((err) => console.error('Erreur verification des avertissements:', err));
  }, INTERVALLE_VERIFICATION_MS);
}

module.exports = {
  demarrer,
  verifierRappels,
  verifierAvertissementsRetards,
  calculerEtEnvoyerAvertissements,
  envoyerAvertissementManuel,
  envoyerPushAEmploye,
  NB_NIVEAUX_AVERTISSEMENT,
};
