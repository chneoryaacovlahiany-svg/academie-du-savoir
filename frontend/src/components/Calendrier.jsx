import { useEffect, useState } from 'react';
import { api } from '../api';
import { dateLocale, moisLocal } from '../dateUtils';
import { useAuth } from '../AuthContext.jsx';
import { useEntreprise } from '../EntrepriseContext.jsx';
import { useLangue } from '../LangueContext.jsx';
import { exporterCSV, exporterPDF } from '../export';

function formatDuree(heures) {
  if (heures == null) return '-';
  const h = Math.floor(heures);
  const m = Math.round((heures - h) * 60);
  return `${h}h${String(m).padStart(2, '0')}`;
}

function isoToTimeInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function timeInputToIso(dateStr, timeStr) {
  if (!timeStr) return null;
  return new Date(`${dateStr}T${timeStr}:00`).toISOString();
}

function joursDuMois(mois) {
  const [annee, m] = mois.split('-').map(Number);
  const nbJours = new Date(annee, m, 0).getDate();
  const premierJour = new Date(annee, m - 1, 1);
  // Lundi = 0 ... Dimanche = 6
  const decalage = (premierJour.getDay() + 6) % 7;

  const cellules = [];
  for (let i = 0; i < decalage; i++) cellules.push(null);
  for (let jour = 1; jour <= nbJours; jour++) {
    cellules.push(`${mois}-${String(jour).padStart(2, '0')}`);
  }
  return cellules;
}

function listeDatesEntre(debut, fin) {
  const dates = [];
  const curseur = new Date(`${debut}T00:00:00`);
  const limite = new Date(`${fin}T00:00:00`);
  while (curseur <= limite) {
    dates.push(dateLocale(curseur));
    curseur.setDate(curseur.getDate() + 1);
  }
  return dates;
}

export default function Calendrier() {
  const { user } = useAuth();
  const { entreprise } = useEntreprise();
  const { t, locale } = useLangue();
  const estAdmin = user.role === 'admin';
  const [employees, setEmployees] = useState([]);
  const [employeeId, setEmployeeId] = useState('');
  const [mois, setMois] = useState(moisLocal());
  const [vue, setVue] = useState('calendrier');
  const [pointagesMois, setPointagesMois] = useState({});
  const [dateSelectionnee, setDateSelectionnee] = useState(null);
  const [formHeureEntree, setFormHeureEntree] = useState('');
  const [formHeureSortie, setFormHeureSortie] = useState('');
  const [formLieu, setFormLieu] = useState('bureau');
  const [erreur, setErreur] = useState('');

  const [plage, setPlage] = useState({ date_debut: '', date_fin: '', heure_entree: '', heure_sortie: '', lieu: 'bureau' });
  const [messagePlage, setMessagePlage] = useState('');

  const [resume, setResume] = useState(null);

  const [joursSelectionnes, setJoursSelectionnes] = useState([]);
  const [formMultipleEntree, setFormMultipleEntree] = useState('');
  const [formMultipleSortie, setFormMultipleSortie] = useState('');
  const [formMultipleLieu, setFormMultipleLieu] = useState('bureau');
  const [messageMultiple, setMessageMultiple] = useState('');

  const labelLieu = (lieu) => {
    if (lieu === 'bureau') return t('common.bureau');
    if (lieu === 'domicile') return t('common.domicile');
    return '-';
  };

  useEffect(() => {
    api.getEmployees().then((emps) => {
      const actifs = emps.filter((e) => e.actif);
      setEmployees(actifs);
      if (!employeeId && actifs.length > 0) setEmployeeId(String(actifs[0].id));
    });
  }, []);

  const chargerCalendrier = async () => {
    if (!employeeId) return;
    const debut = `${mois}-01`;
    const dernierJour = new Date(Number(mois.slice(0, 4)), Number(mois.slice(5, 7)), 0).getDate();
    const fin = `${mois}-${String(dernierJour).padStart(2, '0')}`;
    const rows = await api.getPointages({ employee_id: employeeId, debut, fin });
    setPointagesMois(Object.fromEntries(rows.map((p) => [p.date, p])));
  };

  const chargerResume = async () => {
    if (!employeeId) return;
    try {
      const r = await api.getRapport({ employee_id: employeeId, mois });
      setResume(r);
    } catch {
      setResume(null);
    }
  };

  useEffect(() => {
    chargerCalendrier();
    chargerResume();
    setDateSelectionnee(null);
    setJoursSelectionnes([]);
  }, [employeeId, mois]);

  const selectionnerJour = (dateStr) => {
    setDateSelectionnee(dateStr);
    setErreur('');
    const p = pointagesMois[dateStr];
    setFormHeureEntree(isoToTimeInput(p?.heure_entree));
    setFormHeureSortie(isoToTimeInput(p?.heure_sortie));
    setFormLieu(p?.lieu || 'bureau');
  };

  const enregistrerJour = async () => {
    setErreur('');
    try {
      await api.pointageManuel({
        employee_id: employeeId,
        date: dateSelectionnee,
        heure_entree: timeInputToIso(dateSelectionnee, formHeureEntree),
        heure_sortie: timeInputToIso(dateSelectionnee, formHeureSortie),
        lieu: formLieu,
      });
      chargerCalendrier();
      chargerResume();
    } catch (err) {
      setErreur(err.message);
    }
  };

  const supprimerJour = async () => {
    const p = pointagesMois[dateSelectionnee];
    if (!p) return;
    if (!confirm(t('calendrier.confirmSupprimerJour'))) return;
    await api.deletePointage(p.id);
    setDateSelectionnee(null);
    chargerCalendrier();
    chargerResume();
  };

  const appliquerPlage = async (e) => {
    e.preventDefault();
    setMessagePlage('');
    setErreur('');
    if (!plage.date_debut || !plage.date_fin) {
      setErreur(t('calendrier.erreurDates'));
      return;
    }
    if (plage.date_fin < plage.date_debut) {
      setErreur(t('calendrier.erreurOrdreDates'));
      return;
    }
    try {
      const dates = listeDatesEntre(plage.date_debut, plage.date_fin);
      for (const date of dates) {
        await api.pointageManuel({
          employee_id: employeeId,
          date,
          heure_entree: timeInputToIso(date, plage.heure_entree),
          heure_sortie: timeInputToIso(date, plage.heure_sortie),
          lieu: plage.lieu,
        });
      }
      setMessagePlage(t('calendrier.joursMisAJour', { n: dates.length, debut: plage.date_debut, fin: plage.date_fin }));
      chargerCalendrier();
      chargerResume();
    } catch (err) {
      setErreur(err.message);
    }
  };

  const joursDuMoisTries = joursDuMois(mois).filter(Boolean);

  const basculerJourSelectionne = (dateStr) => {
    setJoursSelectionnes((jours) =>
      jours.includes(dateStr) ? jours.filter((d) => d !== dateStr) : [...jours, dateStr]
    );
  };

  const basculerTousLesJours = () => {
    setJoursSelectionnes((jours) => (jours.length === joursDuMoisTries.length ? [] : [...joursDuMoisTries]));
  };

  const appliquerAuxJoursSelectionnes = async (e) => {
    e.preventDefault();
    setMessageMultiple('');
    setErreur('');
    if (joursSelectionnes.length === 0) {
      setErreur(t('calendrier.erreurSelectionJour'));
      return;
    }
    try {
      for (const date of joursSelectionnes) {
        await api.pointageManuel({
          employee_id: employeeId,
          date,
          heure_entree: timeInputToIso(date, formMultipleEntree),
          heure_sortie: timeInputToIso(date, formMultipleSortie),
          lieu: formMultipleLieu,
        });
      }
      setMessageMultiple(t('calendrier.joursModifies', { n: joursSelectionnes.length }));
      setJoursSelectionnes([]);
      chargerCalendrier();
      chargerResume();
    } catch (err) {
      setErreur(err.message);
    }
  };

  const supprimerJoursSelectionnes = async () => {
    setMessageMultiple('');
    setErreur('');
    const joursAvecPointage = joursSelectionnes.filter((date) => pointagesMois[date]);
    if (joursAvecPointage.length === 0) {
      setErreur(t('calendrier.erreurAucunPointageASupprimer'));
      return;
    }
    if (!confirm(t('calendrier.confirmSupprimerJours', { n: joursAvecPointage.length }))) return;
    try {
      for (const date of joursAvecPointage) {
        await api.deletePointage(pointagesMois[date].id);
      }
      setMessageMultiple(t('calendrier.joursSupprimes', { n: joursAvecPointage.length }));
      setJoursSelectionnes([]);
      chargerCalendrier();
      chargerResume();
    } catch (err) {
      setErreur(err.message);
    }
  };

  const joursManquantsParDate = Object.fromEntries((resume?.jours_manquants || []).map((j) => [j.date, j]));
  const heuresEffectivesParDate = Object.fromEntries(
    (resume?.pointages || []).map((p) => [p.date, p.heures_effectives])
  );
  const pauseAppliqueeParDate = Object.fromEntries(
    (resume?.pointages || []).map((p) => [p.date, p.pause_appliquee_minutes])
  );
  const totalColonneTotal = joursDuMoisTries.reduce(
    (acc, dateStr) => acc + (heuresEffectivesParDate[dateStr] || 0),
    0
  );
  const totalColonnePresence = joursDuMoisTries.reduce(
    (acc, dateStr) => acc + (pointagesMois[dateStr]?.heures_travaillees || 0),
    0
  );

  const employeSelectionne = employees.find((e) => String(e.id) === String(employeeId));
  const nomFichierBase = employeSelectionne
    ? `calendrier_${employeSelectionne.prenom}_${employeSelectionne.nom}_${mois}`.replace(/\s+/g, '_')
    : `calendrier_${mois}`;

  const entetesExport = [
    t('calendrier.colDate'),
    t('calendrier.colJour'),
    t('calendrier.colEntree'),
    t('calendrier.colSortie'),
    t('calendrier.colLieu'),
    t('calendrier.colPause'),
    t('calendrier.colTotal'),
    t('calendrier.colTotalPresence'),
  ];
  const lignesExport = () =>
    joursDuMoisTries.map((dateStr) => {
      const p = pointagesMois[dateStr];
      const nomJour = new Date(`${dateStr}T00:00:00`).toLocaleDateString(locale, { weekday: 'long' });
      const manquant = joursManquantsParDate[dateStr];
      return [
        dateStr,
        nomJour,
        p?.heure_entree ? isoToTimeInput(p.heure_entree) : '-',
        p?.heure_sortie ? isoToTimeInput(p.heure_sortie) : '-',
        p ? labelLieu(p.lieu) : '-',
        p?.heures_travaillees != null ? `${pauseAppliqueeParDate[dateStr] ?? 0} ${t('common.minAbrev')}` : '-',
        formatDuree(heuresEffectivesParDate[dateStr]) + (manquant ? ` (-${formatDuree(manquant.ecart)})` : ''),
        p?.heures_travaillees != null ? formatDuree(p.heures_travaillees) : '-',
      ];
    });

  const exporterTableauCSV = () => {
    const lignes = [...lignesExport(), [t('calendrier.totalDuMois'), '', '', '', '', '', formatDuree(totalColonneTotal), formatDuree(totalColonnePresence)]];
    exporterCSV(nomFichierBase, entetesExport, lignes, { entreprise });
  };

  const exporterTableauPDF = () => {
    const lignes = [...lignesExport(), [t('calendrier.totalDuMois'), '', '', '', '', '', formatDuree(totalColonneTotal), formatDuree(totalColonnePresence)]];
    const titre = employeSelectionne
      ? `${t('calendrier.title')} - ${employeSelectionne.prenom} ${employeSelectionne.nom} - ${mois}`
      : `${t('calendrier.title')} - ${mois}`;
    exporterPDF(nomFichierBase, titre, entetesExport, lignes, { entreprise });
  };

  return (
    <div className="panel">
      <h2>{t('calendrier.title')}</h2>

      <div className="form-inline">
        <label>
          {t('calendrier.employeLabel')}{' '}
          <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.prenom} {e.nom}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t('calendrier.moisLabel')}{' '}
          <input type="month" value={mois} onChange={(e) => setMois(e.target.value)} />
        </label>
        <div className="selecteur-vue">
          <button
            type="button"
            className={vue === 'calendrier' ? 'vue-active' : 'secondary'}
            onClick={() => setVue('calendrier')}
          >
            {t('calendrier.vueCalendrier')}
          </button>
          <button
            type="button"
            className={vue === 'tableau' ? 'vue-active' : 'secondary'}
            onClick={() => setVue('tableau')}
          >
            {t('calendrier.vueTableau')}
          </button>
        </div>
      </div>

      {resume && (
        <div className="cadrans cadrans-compacts">
          <div className="cadran">
            <div className="cadran-valeur">{resume.total_heures.toFixed(2)} h</div>
            <div className="cadran-label">{t('calendrier.totalRealise')}</div>
          </div>
          <div className="cadran">
            <div className="cadran-valeur">{(resume.heures_a_effectuer ?? 0).toFixed(2)} h</div>
            <div className="cadran-label">{t('calendrier.totalAEffectuer')}</div>
          </div>
          <div className="cadran">
            <div className="cadran-valeur">{(resume.heures_presence ?? 0).toFixed(2)} h</div>
            <div className="cadran-label">{t('calendrier.totalPresence')}</div>
          </div>
          <div className="cadran">
            <div className="cadran-valeur">{resume.heures_manquantes > 0 ? resume.heures_manquantes.toFixed(2) : '0'} h</div>
            <div className="cadran-label">{t('calendrier.heuresManquantes')}</div>
          </div>
        </div>
      )}

      {erreur && <p className="erreur">{erreur}</p>}

      {vue === 'calendrier' ? (
        <div className="calendrier">
          <div className="calendrier-entetes">
            {t('common.joursCourts').map((j) => (
              <div key={j} className="calendrier-entete">
                {j}
              </div>
            ))}
          </div>
          <div className="calendrier-grille">
            {joursDuMois(mois).map((dateStr, index) => {
              if (!dateStr) return <div key={`vide-${index}`} className="calendrier-jour calendrier-jour-vide" />;
              const p = pointagesMois[dateStr];
              const jour = Number(dateStr.slice(-2));
              const selectionne = dateStr === dateSelectionnee;
              const manquant = joursManquantsParDate[dateStr];
              return (
                <button
                  key={dateStr}
                  className={`calendrier-jour ${p ? 'calendrier-jour-pointe' : ''} ${selectionne ? 'calendrier-jour-selectionne' : ''} ${manquant ? 'calendrier-jour-manquant' : ''}`}
                  onClick={estAdmin ? () => selectionnerJour(dateStr) : undefined}
                  type="button"
                  title={manquant ? t('calendrier.manqueTitre', { duree: formatDuree(manquant.ecart) }) : undefined}
                >
                  <span className="calendrier-jour-numero">{jour}</span>
                  <span className="calendrier-jour-detail">
                    {p?.heures_travaillees != null
                      ? formatDuree(heuresEffectivesParDate[dateStr])
                      : p
                      ? t('calendrier.incomplet')
                      : ''}
                  </span>
                  {p?.lieu && <span className="calendrier-jour-lieu">{labelLieu(p.lieu)}</span>}
                  {manquant && <span className="calendrier-jour-manque">-{formatDuree(manquant.ecart)}</span>}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="table-scroll">
          <div className="form-inline">
            <button type="button" className="secondary" onClick={exporterTableauCSV}>
              {t('calendrier.exporterExcel')}
            </button>
            <button type="button" className="secondary" onClick={exporterTableauPDF}>
              {t('calendrier.exporterPDF')}
            </button>
          </div>
          <table>
            <thead>
              <tr>
                <th>
                  {estAdmin && (
                    <input
                      type="checkbox"
                      checked={joursSelectionnes.length === joursDuMoisTries.length}
                      onChange={basculerTousLesJours}
                    />
                  )}
                </th>
                <th>{t('calendrier.colDate')}</th>
                <th>{t('calendrier.colJour')}</th>
                <th>{t('calendrier.colEntree')}</th>
                <th>{t('calendrier.colSortie')}</th>
                <th>{t('calendrier.colLieu')}</th>
                <th>{t('calendrier.colPause')}</th>
                <th>{t('calendrier.colTotal')}</th>
                <th>{t('calendrier.colTotalPresence')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {joursDuMoisTries.map((dateStr) => {
                const p = pointagesMois[dateStr];
                const nomJour = new Date(`${dateStr}T00:00:00`).toLocaleDateString(locale, { weekday: 'long' });
                const manquant = joursManquantsParDate[dateStr];
                const classesLigne = [
                  dateStr === dateSelectionnee ? 'ligne-selectionnee' : '',
                  manquant ? 'ligne-manquante' : '',
                ].join(' ');
                return (
                  <tr key={dateStr} className={classesLigne}>
                    <td>
                      {estAdmin && (
                        <input
                          type="checkbox"
                          checked={joursSelectionnes.includes(dateStr)}
                          onChange={() => basculerJourSelectionne(dateStr)}
                        />
                      )}
                    </td>
                    <td>{dateStr}</td>
                    <td className="capitalize">{nomJour}</td>
                    <td>{p?.heure_entree ? isoToTimeInput(p.heure_entree) : '-'}</td>
                    <td>{p?.heure_sortie ? isoToTimeInput(p.heure_sortie) : '-'}</td>
                    <td>{p ? labelLieu(p.lieu) : '-'}</td>
                    <td>{p?.heures_travaillees != null ? `${pauseAppliqueeParDate[dateStr] ?? 0} ${t('common.minAbrev')}` : '-'}</td>
                    <td>
                      {formatDuree(heuresEffectivesParDate[dateStr])}
                      {manquant && <span className="badge-manquant"> -{formatDuree(manquant.ecart)}</span>}
                    </td>
                    <td>{p?.heures_travaillees != null ? formatDuree(p.heures_travaillees) : '-'}</td>
                    <td className="actions">
                      {estAdmin && <button onClick={() => selectionnerJour(dateStr)}>{t('calendrier.modifier')}</button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="ligne-total">
                <td colSpan={7}>{t('calendrier.totalDuMois')}</td>
                <td>{formatDuree(totalColonneTotal)}</td>
                <td colSpan={2}>{formatDuree(totalColonnePresence)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {estAdmin && vue === 'tableau' && joursSelectionnes.length > 0 && (
        <div className="panneau-edition-jour">
          <h4>{t('calendrier.joursSelectionnes', { n: joursSelectionnes.length })}</h4>
          {messageMultiple && <p className="confirmation">{messageMultiple}</p>}
          <form className="form-inline" onSubmit={appliquerAuxJoursSelectionnes}>
            <label>
              {t('calendrier.heureEntreeLabel')}{' '}
              <input
                type="time"
                value={formMultipleEntree}
                onChange={(e) => setFormMultipleEntree(e.target.value)}
                required
              />
            </label>
            <label>
              {t('calendrier.heureSortieLabel')}{' '}
              <input
                type="time"
                value={formMultipleSortie}
                onChange={(e) => setFormMultipleSortie(e.target.value)}
                required
              />
            </label>
            <label>
              {t('calendrier.lieuLabel')}{' '}
              <select value={formMultipleLieu} onChange={(e) => setFormMultipleLieu(e.target.value)}>
                <option value="bureau">{t('common.bureau')}</option>
                <option value="domicile">{t('common.domicile')}</option>
              </select>
            </label>
            <button type="submit">{t('calendrier.appliquerSelection')}</button>
            <button type="button" className="danger" onClick={supprimerJoursSelectionnes}>
              {t('calendrier.supprimerSelection')}
            </button>
            <button type="button" className="secondary" onClick={() => setJoursSelectionnes([])}>
              {t('calendrier.deselectionnerTout')}
            </button>
          </form>
        </div>
      )}

      {estAdmin && dateSelectionnee && (
        <div className="panneau-edition-jour">
          <h4>
            {new Date(`${dateSelectionnee}T00:00:00`).toLocaleDateString(locale, {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </h4>
          <div className="form-inline">
            <label>
              {t('calendrier.heureEntreeLabel')}{' '}
              <input type="time" value={formHeureEntree} onChange={(e) => setFormHeureEntree(e.target.value)} />
            </label>
            <label>
              {t('calendrier.heureSortieLabel')}{' '}
              <input type="time" value={formHeureSortie} onChange={(e) => setFormHeureSortie(e.target.value)} />
            </label>
            <label>
              {t('calendrier.lieuLabel')}{' '}
              <select value={formLieu} onChange={(e) => setFormLieu(e.target.value)}>
                <option value="bureau">{t('common.bureau')}</option>
                <option value="domicile">{t('common.domicile')}</option>
              </select>
            </label>
            <button onClick={enregistrerJour}>{t('calendrier.enregistrer')}</button>
            {pointagesMois[dateSelectionnee] && (
              <button className="danger" onClick={supprimerJour}>
                {t('calendrier.supprimer')}
              </button>
            )}
            <button className="secondary" onClick={() => setDateSelectionnee(null)}>
              {t('calendrier.fermer')}
            </button>
          </div>
        </div>
      )}

      {estAdmin && (
        <>
          <h3>{t('calendrier.insererPlage')}</h3>
          <p className="aide">{t('calendrier.insererPlageAide')}</p>
          <form className="form-inline" onSubmit={appliquerPlage}>
            <label>
              {t('calendrier.du')}{' '}
              <input
                type="date"
                value={plage.date_debut}
                onChange={(e) => setPlage({ ...plage, date_debut: e.target.value })}
                required
              />
            </label>
            <label>
              {t('calendrier.au')}{' '}
              <input
                type="date"
                value={plage.date_fin}
                onChange={(e) => setPlage({ ...plage, date_fin: e.target.value })}
                required
              />
            </label>
            <label>
              {t('calendrier.heureEntreeLabel')}{' '}
              <input
                type="time"
                value={plage.heure_entree}
                onChange={(e) => setPlage({ ...plage, heure_entree: e.target.value })}
                required
              />
            </label>
            <label>
              {t('calendrier.heureSortieLabel')}{' '}
              <input
                type="time"
                value={plage.heure_sortie}
                onChange={(e) => setPlage({ ...plage, heure_sortie: e.target.value })}
                required
              />
            </label>
            <label>
              {t('calendrier.lieuLabel')}{' '}
              <select value={plage.lieu} onChange={(e) => setPlage({ ...plage, lieu: e.target.value })}>
                <option value="bureau">{t('common.bureau')}</option>
                <option value="domicile">{t('common.domicile')}</option>
              </select>
            </label>
            <button type="submit">{t('calendrier.appliquerPlage')}</button>
          </form>
          {messagePlage && <p className="confirmation">{messagePlage}</p>}
        </>
      )}
    </div>
  );
}
