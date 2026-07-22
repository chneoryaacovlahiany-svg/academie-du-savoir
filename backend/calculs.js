const JOUR_MS = 1000 * 60 * 60 * 24;
const ANNEE_MS = JOUR_MS * 365.25;

// Date du jour (ou d'un objet Date donne) au format YYYY-MM-DD en heure LOCALE.
// A utiliser partout ou on veut "la date du jour" plutot qu'un instant UTC:
// date.toISOString().slice(0, 10) decale d'un jour pour les fuseaux devant UTC
// (ex: Israel) pendant les premieres heures de la journee locale.
function dateLocale(date = new Date()) {
  const annee = date.getFullYear();
  const mois = String(date.getMonth() + 1).padStart(2, '0');
  const jour = String(date.getDate()).padStart(2, '0');
  return `${annee}-${mois}-${jour}`;
}

function ancienneteAnnees(dateEmbauche, dateRef) {
  if (!dateEmbauche) return 0;
  const diff = new Date(dateRef).getTime() - new Date(dateEmbauche).getTime();
  return Math.max(0, diff / ANNEE_MS);
}

function joursAnnuelsAcquis(ancienneteAnneesAtteinte, bareme) {
  let applicable = 0;
  for (const ligne of bareme) {
    if (ancienneteAnneesAtteinte + 1e-9 >= ligne.anciennete_annees) {
      applicable = ligne.jours_par_an;
    }
  }
  return applicable;
}

// Somme, annee par annee (bareme applique au debut de chaque annee), plus prorata de l'annee en cours.
function joursCongesAcquisCumules(dateEmbauche, dateRef, bareme) {
  if (!dateEmbauche) return 0;
  const debut = new Date(dateEmbauche).getTime();
  const fin = new Date(dateRef).getTime();
  if (fin <= debut) return 0;

  const anneesEcoulees = (fin - debut) / ANNEE_MS;
  const anneesCompletes = Math.floor(anneesEcoulees);
  const fraction = anneesEcoulees - anneesCompletes;

  let total = 0;
  for (let an = 0; an < anneesCompletes; an++) {
    total += joursAnnuelsAcquis(an, bareme);
  }
  total += joursAnnuelsAcquis(anneesCompletes, bareme) * fraction;
  return total;
}

function joursMaladieAcquis(dateEmbauche, dateRef, tauxParMois, plafond) {
  if (!dateEmbauche) return 0;
  const diff = new Date(dateRef).getTime() - new Date(dateEmbauche).getTime();
  const moisEcoules = Math.max(0, diff / (JOUR_MS * 30.44));
  return Math.min(moisEcoules * tauxParMois, plafond);
}

// Palier legal indicatif: 1er jour non paye, 2e-3e jour a 50%, 4e jour et plus a 100%.
// A verifier avec un professionnel avant utilisation reelle.
function montantMaladiePourAbsence(nbJours, tauxHoraire, heuresStandardJour) {
  const tauxJournalier = tauxHoraire * heuresStandardJour;
  const joursEntiers = Math.floor(nbJours);
  const fractionDernierJour = nbJours - joursEntiers;
  let montant = 0;

  for (let jour = 1; jour <= joursEntiers; jour++) {
    montant += tauxJournalier * palierMaladie(jour);
  }
  if (fractionDernierJour > 0) {
    montant += tauxJournalier * palierMaladie(joursEntiers + 1) * fractionDernierJour;
  }
  return montant;
}

function palierMaladie(jour) {
  if (jour <= 1) return 0;
  if (jour <= 3) return 0.5;
  return 1;
}

// Heures supplementaires: ne retourne QUE le supplement (au-dela du taux normal deja compte ailleurs).
function supplementHeuresSup(heuresTravaillees, params, tauxHoraire) {
  const heuresSup = Math.max(0, heuresTravaillees - params.heures_standard_jour);
  if (heuresSup <= 0) {
    return { heuresSup125: 0, heuresSup150: 0, montant: 0 };
  }
  const heuresSup125 = Math.min(heuresSup, params.seuil_heures_sup_125);
  const heuresSup150 = Math.max(0, heuresSup - params.seuil_heures_sup_125);
  const montant =
    heuresSup125 * tauxHoraire * (params.majoration_heures_sup_125 - 1) +
    heuresSup150 * tauxHoraire * (params.majoration_heures_sup_150 - 1);
  return { heuresSup125, heuresSup150, montant };
}

function estJourOuvre(dateStr) {
  const jour = new Date(dateStr).getUTCDay();
  return jour >= 1 && jour <= 5;
}

// Liste des dates YYYY-MM-DD entre debut et fin inclus.
function datesEntre(debut, fin) {
  const dates = [];
  const curseur = new Date(`${debut}T00:00:00`);
  const limite = new Date(`${fin}T00:00:00`);
  while (curseur <= limite) {
    dates.push(dateLocale(curseur));
    curseur.setDate(curseur.getDate() + 1);
  }
  return dates;
}

// Lundi = 0 ... Dimanche = 6 (coherent avec le calendrier de l'interface).
function jourSemaineLundi0(dateStr) {
  return (new Date(`${dateStr}T00:00:00`).getDay() + 6) % 7;
}

// Duree prevue (en heures) entre deux horaires "HH:MM". La pause quotidienne
// n'est deduite que si pauseAppliquee est vrai (coche "Pause" du jour, reglee
// dans la plage horaire de l'employe).
function heuresPrevuesJour(heureDebut, heureFin, pauseMinutes = 0, pauseAppliquee = true) {
  if (!heureDebut || !heureFin) return 0;
  const [h1, m1] = heureDebut.split(':').map(Number);
  const [h2, m2] = heureFin.split(':').map(Number);
  const brut = Math.max(0, h2 * 60 + m2 - (h1 * 60 + m1)) / 60;
  const pauseADeduire = pauseAppliquee ? pauseMinutes : 0;
  return Math.max(0, brut - pauseADeduire / 60);
}

// Heures effectivement payees pour un pointage:
// - la pause quotidienne est deduite seulement si la case "Pause" du jour
//   (horaireJour.pause_appliquee) est cochee, ou si aucun horaire n'est
//   defini ce jour-la (comportement par defaut);
// - si l'employe n'a PAS droit aux heures supplementaires et qu'une plage
//   horaire est definie ce jour-la, la sortie est plafonnee a l'heure de fin
//   prevue (le temps travaille au-dela n'est pas paye du tout, ni en heures
//   normales ni en heures sup).
function heuresEffectivesJour(pointage, horaireJour, droitHeuresSup, pauseMinutes = 0) {
  if (!pointage || pointage.heures_travaillees == null) return 0;

  let heuresBrutes = pointage.heures_travaillees;

  if (!droitHeuresSup && horaireJour && horaireJour.actif && horaireJour.heure_fin && pointage.heure_sortie) {
    const sortiePrevue = new Date(`${pointage.date}T${horaireJour.heure_fin}:00`);
    const sortieReelle = new Date(pointage.heure_sortie);
    if (sortieReelle > sortiePrevue) {
      const entreeReelle = new Date(pointage.heure_entree);
      heuresBrutes = Math.max(0, (sortiePrevue.getTime() - entreeReelle.getTime()) / (1000 * 60 * 60));
    }
  }

  const pauseAppliquee = horaireJour ? !!horaireJour.pause_appliquee : true;
  const pauseADeduire = pauseAppliquee ? pauseMinutes : 0;

  return Math.max(0, heuresBrutes - pauseADeduire / 60);
}

module.exports = {
  dateLocale,
  ancienneteAnnees,
  joursAnnuelsAcquis,
  joursCongesAcquisCumules,
  joursMaladieAcquis,
  montantMaladiePourAbsence,
  supplementHeuresSup,
  estJourOuvre,
  datesEntre,
  jourSemaineLundi0,
  heuresPrevuesJour,
  heuresEffectivesJour,
};
