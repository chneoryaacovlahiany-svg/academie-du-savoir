import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../AuthContext.jsx';
import { useLangue } from '../LangueContext.jsx';
import { dateLocale } from '../dateUtils';
import {
  permissionNotifications,
  demanderPermissionNotifications,
  envoyerNotificationUneFois,
  abonnerAuxPush,
} from '../notifications';

// Lundi = 0 ... Dimanche = 6 (coherent avec le reste de l'app).
function jourSemaineLundi0(date) {
  return (date.getDay() + 6) % 7;
}

function minutesDepuisMinuit(heureStr) {
  const [h, m] = heureStr.split(':').map(Number);
  return h * 60 + m;
}

// Determine si un rappel de pointage est necessaire pour un employe, a partir
// de sa plage horaire du jour (si definie) ou d'une plage generique par
// defaut (9h-19h) sinon. Aucun rappel si le jour est un jour de repos prevu.
function calculerRappel(horaires, statut, maintenant) {
  const jourIdx = jourSemaineLundi0(maintenant);
  const minutesActuelles = maintenant.getHours() * 60 + maintenant.getMinutes();
  const horaireJour = (horaires || []).find((h) => h.jour_semaine === jourIdx);

  if ((horaires || []).length > 0 && (!horaireJour || !horaireJour.actif)) {
    return null;
  }

  const heureDebut = horaireJour?.heure_debut ? minutesDepuisMinuit(horaireJour.heure_debut) : 9 * 60;
  const heureFin = horaireJour?.heure_fin ? minutesDepuisMinuit(horaireJour.heure_fin) : 19 * 60;

  const pointe = statut && statut.heure_entree && !statut.heure_sortie;
  const termine = statut && statut.heure_entree && statut.heure_sortie;

  if (!termine && !pointe && minutesActuelles >= heureDebut) return 'entree';
  if (pointe && minutesActuelles >= heureFin) return 'sortie';
  return null;
}

function formatHeure(iso, locale) {
  if (!iso) return '-';
  return new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
}

function formatDuree(heures) {
  if (heures == null) return '-';
  const h = Math.floor(heures);
  const m = Math.round((heures - h) * 60);
  return `${h}h${String(m).padStart(2, '0')}`;
}

function debutSemaine(date) {
  const d = new Date(date);
  d.setDate(d.getDate() - jourSemaineLundi0(d));
  return d;
}

function finSemaine(date) {
  const d = debutSemaine(date);
  d.setDate(d.getDate() + 6);
  return d;
}

// Bornes (inclusives) de la periode affichee, selon le mode de navigation choisi.
function plagePeriode(mode, date) {
  if (mode === 'semaine') return { debut: debutSemaine(date), fin: finSemaine(date) };
  if (mode === 'mois') {
    return {
      debut: new Date(date.getFullYear(), date.getMonth(), 1),
      fin: new Date(date.getFullYear(), date.getMonth() + 1, 0),
    };
  }
  if (mode === 'annee') {
    return { debut: new Date(date.getFullYear(), 0, 1), fin: new Date(date.getFullYear(), 11, 31) };
  }
  return { debut: date, fin: date };
}

function decalerPeriode(mode, date, direction) {
  const d = new Date(date);
  if (mode === 'semaine') d.setDate(d.getDate() + direction * 7);
  else if (mode === 'mois') d.setMonth(d.getMonth() + direction, 1);
  else if (mode === 'annee') d.setFullYear(d.getFullYear() + direction, 0, 1);
  else d.setDate(d.getDate() + direction);
  return d;
}

function libellePeriode(mode, date, locale, t) {
  if (mode === 'semaine') {
    const { debut, fin } = plagePeriode('semaine', date);
    return t('pointage.semaineDu', {
      debut: debut.toLocaleDateString(locale, { day: 'numeric', month: 'long' }),
      fin: fin.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' }),
    });
  }
  if (mode === 'mois') return date.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
  if (mode === 'annee') return String(date.getFullYear());
  return date.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

export default function Pointage() {
  const { user } = useAuth();
  const { t, locale, direction } = useLangue();
  const flecheArriere = direction === 'rtl' ? '→' : '←';
  const flecheAvant = direction === 'rtl' ? '←' : '→';
  const [employees, setEmployees] = useState([]);
  const [statuts, setStatuts] = useState({});
  const [horaires, setHoraires] = useState({});
  const [lieux, setLieux] = useState({});
  const [erreur, setErreur] = useState('');
  const [maintenant, setMaintenant] = useState(new Date());
  const [permission, setPermission] = useState(permissionNotifications());

  const [modeVue, setModeVue] = useState('jour');
  const [dateReference, setDateReference] = useState(new Date());
  const [historique, setHistorique] = useState([]);

  const estAujourdhui = modeVue === 'jour' && dateLocale(dateReference) === dateLocale(new Date());

  const charger = async () => {
    const emps = await api.getEmployees();
    const actifs = emps.filter((e) => e.actif);
    setEmployees(actifs);
    const entries = await Promise.all(actifs.map(async (e) => [e.id, await api.getStatutDuJour(e.id)]));
    setStatuts(Object.fromEntries(entries));
    const horairesEntries = await Promise.all(actifs.map(async (e) => [e.id, await api.getHoraires(e.id)]));
    setHoraires(Object.fromEntries(horairesEntries));
  };

  useEffect(() => {
    charger();
  }, []);

  const chargerHistorique = async () => {
    const { debut, fin } = plagePeriode(modeVue, dateReference);
    const rows = await api.getPointages({ debut: dateLocale(debut), fin: dateLocale(fin) });
    setHistorique(rows);
  };

  useEffect(() => {
    if (!estAujourdhui) chargerHistorique();
  }, [modeVue, dateReference]);

  // Reverifie l'heure toutes les minutes pour que les rappels apparaissent
  // sans avoir a recharger la page.
  useEffect(() => {
    const intervalle = setInterval(() => setMaintenant(new Date()), 60000);
    return () => clearInterval(intervalle);
  }, []);

  // Envoie une vraie notification navigateur uniquement pour l'employe
  // actuellement connecte (jamais pour les cartes des collegues consultees par un admin).
  useEffect(() => {
    if (!user?.employee_id) return;
    const rappel = calculerRappel(horaires[user.employee_id], statuts[user.employee_id], maintenant);
    if (rappel === 'entree') {
      envoyerNotificationUneFois(`entree-${user.employee_id}`, t('header.appName'), {
        body: t('pointage.rappelEntree'),
      });
    } else if (rappel === 'sortie') {
      envoyerNotificationUneFois(`sortie-${user.employee_id}`, t('header.appName'), {
        body: t('pointage.rappelSortie'),
      });
    }
  }, [user, horaires, statuts, maintenant]);

  // Si la permission a deja ete accordee lors d'une session precedente,
  // s'assure que cet appareil reste bien abonne (ex: apres reinstallation du
  // service worker) sans redemander a l'utilisateur.
  useEffect(() => {
    if (user?.employee_id && permission === 'granted') {
      abonnerAuxPush(user.employee_id).catch(() => {});
    }
  }, [user, permission]);

  const activerNotifications = async () => {
    const resultat = await demanderPermissionNotifications();
    setPermission(resultat);
    if (resultat === 'granted' && user?.employee_id) {
      abonnerAuxPush(user.employee_id).catch(() => {
        // Abonnement push facultatif: si indisponible, les rappels reposeront
        // uniquement sur les notifications tant que l'appli est ouverte.
      });
    }
  };

  const pointer = async (employeeId, action) => {
    setErreur('');
    try {
      if (action === 'entree') await api.pointerEntree(employeeId, lieux[employeeId] || 'bureau');
      else await api.pointerSortie(employeeId);
      charger();
    } catch (err) {
      setErreur(err.message);
    }
  };

  const allerAujourdhui = () => {
    setModeVue('jour');
    setDateReference(new Date());
  };

  const recapParEmploye = {};
  for (const p of historique) {
    const cur = recapParEmploye[p.employee_id] || { heures: 0, jours: 0, dernierPointage: null };
    cur.heures += p.heures_travaillees || 0;
    if (p.heure_entree && p.heure_sortie) cur.jours += 1;
    if (modeVue === 'jour') cur.dernierPointage = p;
    recapParEmploye[p.employee_id] = cur;
  }

  return (
    <div className="panel">
      <h2>{t('pointage.title')}</h2>

      <div className="navigation-periode">
        <select value={modeVue} onChange={(e) => setModeVue(e.target.value)}>
          <option value="jour">{t('pointage.modeJour')}</option>
          <option value="semaine">{t('pointage.modeSemaine')}</option>
          <option value="mois">{t('pointage.modeMois')}</option>
          <option value="annee">{t('pointage.modeAnnee')}</option>
        </select>
        <button type="button" className="secondary" onClick={() => setDateReference((d) => decalerPeriode(modeVue, d, -1))}>
          {flecheArriere}
        </button>
        <span className="libelle-periode capitalize">{libellePeriode(modeVue, dateReference, locale, t)}</span>
        <button type="button" className="secondary" onClick={() => setDateReference((d) => decalerPeriode(modeVue, d, 1))}>
          {flecheAvant}
        </button>
        {!estAujourdhui && (
          <button type="button" onClick={allerAujourdhui}>
            {t('pointage.aujourdhui')}
          </button>
        )}
      </div>

      {erreur && <p className="erreur">{erreur}</p>}

      {estAujourdhui && user?.employee_id && permission === 'default' && (
        <p className="confirmation">
          {t('pointage.activerNotifTexte')}{' '}
          <button type="button" className="secondary" onClick={activerNotifications}>
            {t('pointage.activerNotifBouton')}
          </button>
        </p>
      )}

      {estAujourdhui ? (
        <div className="cartes-pointage">
          {employees.map((emp) => {
            const statut = statuts[emp.id];
            const pointe = statut && statut.heure_entree && !statut.heure_sortie;
            const termine = statut && statut.heure_entree && statut.heure_sortie;
            const rappel = calculerRappel(horaires[emp.id], statut, maintenant);

            return (
              <div className="carte-employe" key={emp.id}>
                <div className="carte-nom">
                  {emp.prenom} {emp.nom}
                </div>
                <div className="carte-poste">{emp.poste}</div>
                <div className="carte-heures">
                  {t('pointage.entreeLabel')}: {formatHeure(statut?.heure_entree, locale)} | {t('pointage.sortieLabel')}:{' '}
                  {formatHeure(statut?.heure_sortie, locale)}
                  {statut?.lieu && ` (${t(`common.${statut.lieu}`)})`}
                </div>
                {termine && <div className="carte-total">{t('pointage.total')}: {formatDuree(statut.heures_travaillees)}</div>}
                {rappel === 'entree' && (
                  <p className="rappel-pointage">{t('pointage.rappelEntree')}</p>
                )}
                {rappel === 'sortie' && (
                  <p className="rappel-pointage">{t('pointage.rappelSortie')}</p>
                )}
                {!pointe && !termine && (
                  <label className="champ-date-embauche">
                    {t('pointage.lieuDePointage')}
                    <select
                      value={lieux[emp.id] || 'bureau'}
                      onChange={(e) => setLieux({ ...lieux, [emp.id]: e.target.value })}
                    >
                      <option value="bureau">{t('common.bureau')}</option>
                      <option value="domicile">{t('common.domicile')}</option>
                    </select>
                  </label>
                )}
                <div className="carte-actions">
                  <button
                    className="entree"
                    disabled={pointe || termine}
                    onClick={() => pointer(emp.id, 'entree')}
                  >
                    {t('pointage.entreeLabel')}
                  </button>
                  <button
                    className="sortie"
                    disabled={!pointe}
                    onClick={() => pointer(emp.id, 'sortie')}
                  >
                    {t('pointage.sortieLabel')}
                  </button>
                </div>
              </div>
            );
          })}
          {employees.length === 0 && <p className="vide">{t('pointage.aucunEmployeActif')}</p>}
        </div>
      ) : (
        <div className="cartes-pointage">
          {employees.map((emp) => {
            const recap = recapParEmploye[emp.id];
            return (
              <div className="carte-employe" key={emp.id}>
                <div className="carte-nom">
                  {emp.prenom} {emp.nom}
                </div>
                <div className="carte-poste">{emp.poste}</div>
                {modeVue === 'jour' ? (
                  <div className="carte-heures">
                    {t('pointage.entreeLabel')}: {formatHeure(recap?.dernierPointage?.heure_entree, locale)} |{' '}
                    {t('pointage.sortieLabel')}: {formatHeure(recap?.dernierPointage?.heure_sortie, locale)}
                    {recap?.dernierPointage?.lieu && ` (${t(`common.${recap.dernierPointage.lieu}`)})`}
                  </div>
                ) : (
                  <div className="carte-heures">
                    {recap ? t('pointage.joursPointes', { n: recap.jours }) : t('pointage.aucunPointage')}
                  </div>
                )}
                <div className="carte-total">{t('pointage.total')}: {recap ? formatDuree(recap.heures) : formatDuree(0)}</div>
              </div>
            );
          })}
          {employees.length === 0 && <p className="vide">{t('pointage.aucunEmployeActif')}</p>}
        </div>
      )}
    </div>
  );
}
