import { useEffect, useState } from 'react';
import { api } from '../api';
import { dateLocale, moisLocal } from '../dateUtils';

const JOURS_SEMAINE = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

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

function dureeNetteDePause(heuresBrutes, pauseMinutes) {
  if (heuresBrutes == null) return null;
  return Math.max(0, heuresBrutes - (pauseMinutes || 0) / 60);
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
  const [employees, setEmployees] = useState([]);
  const [employeeId, setEmployeeId] = useState('');
  const [mois, setMois] = useState(moisLocal());
  const [vue, setVue] = useState('calendrier');
  const [pointagesMois, setPointagesMois] = useState({});
  const [dateSelectionnee, setDateSelectionnee] = useState(null);
  const [formHeureEntree, setFormHeureEntree] = useState('');
  const [formHeureSortie, setFormHeureSortie] = useState('');
  const [erreur, setErreur] = useState('');

  const [plage, setPlage] = useState({ date_debut: '', date_fin: '', heure_entree: '', heure_sortie: '' });
  const [messagePlage, setMessagePlage] = useState('');

  const [resume, setResume] = useState(null);

  const [joursSelectionnes, setJoursSelectionnes] = useState([]);
  const [formMultipleEntree, setFormMultipleEntree] = useState('');
  const [formMultipleSortie, setFormMultipleSortie] = useState('');
  const [messageMultiple, setMessageMultiple] = useState('');

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
  };

  const enregistrerJour = async () => {
    setErreur('');
    try {
      await api.pointageManuel({
        employee_id: employeeId,
        date: dateSelectionnee,
        heure_entree: timeInputToIso(dateSelectionnee, formHeureEntree),
        heure_sortie: timeInputToIso(dateSelectionnee, formHeureSortie),
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
    if (!confirm('Supprimer le pointage de ce jour ?')) return;
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
      setErreur('Indiquez une date de debut et une date de fin');
      return;
    }
    if (plage.date_fin < plage.date_debut) {
      setErreur('La date de fin doit etre apres la date de debut');
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
        });
      }
      setMessagePlage(`${dates.length} jour(s) mis a jour (${plage.date_debut} au ${plage.date_fin}).`);
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
      setErreur('Selectionnez au moins un jour');
      return;
    }
    try {
      for (const date of joursSelectionnes) {
        await api.pointageManuel({
          employee_id: employeeId,
          date,
          heure_entree: timeInputToIso(date, formMultipleEntree),
          heure_sortie: timeInputToIso(date, formMultipleSortie),
        });
      }
      setMessageMultiple(`${joursSelectionnes.length} jour(s) modifie(s).`);
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
      setErreur('Aucun des jours selectionnes n\'a de pointage a supprimer');
      return;
    }
    if (!confirm(`Supprimer le pointage de ${joursAvecPointage.length} jour(s) ?`)) return;
    try {
      for (const date of joursAvecPointage) {
        await api.deletePointage(pointagesMois[date].id);
      }
      setMessageMultiple(`${joursAvecPointage.length} jour(s) supprime(s).`);
      setJoursSelectionnes([]);
      chargerCalendrier();
      chargerResume();
    } catch (err) {
      setErreur(err.message);
    }
  };

  const employeeCourant = employees.find((e) => String(e.id) === employeeId);
  const pauseMinutesCourant = employeeCourant?.pause_minutes || 0;
  const joursManquantsParDate = Object.fromEntries((resume?.jours_manquants || []).map((j) => [j.date, j]));

  return (
    <div className="panel">
      <h2>Calendrier de pointage</h2>

      <div className="form-inline">
        <label>
          Employe:{' '}
          <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.prenom} {e.nom}
              </option>
            ))}
          </select>
        </label>
        <label>
          Mois:{' '}
          <input type="month" value={mois} onChange={(e) => setMois(e.target.value)} />
        </label>
        <div className="selecteur-vue">
          <button
            type="button"
            className={vue === 'calendrier' ? 'vue-active' : 'secondary'}
            onClick={() => setVue('calendrier')}
          >
            Calendrier
          </button>
          <button
            type="button"
            className={vue === 'tableau' ? 'vue-active' : 'secondary'}
            onClick={() => setVue('tableau')}
          >
            Tableau
          </button>
        </div>
      </div>

      {resume && (
        <div className="cadrans cadrans-compacts">
          <div className="cadran">
            <div className="cadran-valeur">{resume.total_heures.toFixed(2)} h</div>
            <div className="cadran-label">Total heures du mois</div>
          </div>
          <div className="cadran">
            <div className="cadran-valeur">{resume.heures_manquantes > 0 ? resume.heures_manquantes.toFixed(2) : '0'} h</div>
            <div className="cadran-label">Heures manquantes</div>
          </div>
        </div>
      )}

      {erreur && <p className="erreur">{erreur}</p>}

      {vue === 'calendrier' ? (
        <div className="calendrier">
          <div className="calendrier-entetes">
            {JOURS_SEMAINE.map((j) => (
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
                  onClick={() => selectionnerJour(dateStr)}
                  type="button"
                  title={manquant ? `Il manque ${formatDuree(manquant.ecart)} par rapport a la plage prevue` : undefined}
                >
                  <span className="calendrier-jour-numero">{jour}</span>
                  <span className="calendrier-jour-detail">
                    {p?.heures_travaillees != null
                      ? formatDuree(dureeNetteDePause(p.heures_travaillees, pauseMinutesCourant))
                      : p
                      ? 'incomplet'
                      : ''}
                  </span>
                  {manquant && <span className="calendrier-jour-manque">-{formatDuree(manquant.ecart)}</span>}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    checked={joursSelectionnes.length === joursDuMoisTries.length}
                    onChange={basculerTousLesJours}
                  />
                </th>
                <th>Date</th>
                <th>Jour</th>
                <th>Entree</th>
                <th>Sortie</th>
                <th>Pause</th>
                <th>Total</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {joursDuMoisTries.map((dateStr) => {
                const p = pointagesMois[dateStr];
                const nomJour = new Date(`${dateStr}T00:00:00`).toLocaleDateString('fr-FR', { weekday: 'long' });
                const manquant = joursManquantsParDate[dateStr];
                const classesLigne = [
                  dateStr === dateSelectionnee ? 'ligne-selectionnee' : '',
                  manquant ? 'ligne-manquante' : '',
                ].join(' ');
                return (
                  <tr key={dateStr} className={classesLigne}>
                    <td>
                      <input
                        type="checkbox"
                        checked={joursSelectionnes.includes(dateStr)}
                        onChange={() => basculerJourSelectionne(dateStr)}
                      />
                    </td>
                    <td>{dateStr}</td>
                    <td className="capitalize">{nomJour}</td>
                    <td>{p?.heure_entree ? isoToTimeInput(p.heure_entree) : '-'}</td>
                    <td>{p?.heure_sortie ? isoToTimeInput(p.heure_sortie) : '-'}</td>
                    <td>{p?.heures_travaillees != null ? `${pauseMinutesCourant} min` : '-'}</td>
                    <td>
                      {formatDuree(dureeNetteDePause(p?.heures_travaillees, pauseMinutesCourant))}
                      {manquant && <span className="badge-manquant"> -{formatDuree(manquant.ecart)}</span>}
                    </td>
                    <td className="actions">
                      <button onClick={() => selectionnerJour(dateStr)}>Modifier</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {vue === 'tableau' && joursSelectionnes.length > 0 && (
        <div className="panneau-edition-jour">
          <h4>{joursSelectionnes.length} jour(s) selectionne(s)</h4>
          {messageMultiple && <p className="confirmation">{messageMultiple}</p>}
          <form className="form-inline" onSubmit={appliquerAuxJoursSelectionnes}>
            <label>
              Heure d'entree:{' '}
              <input
                type="time"
                value={formMultipleEntree}
                onChange={(e) => setFormMultipleEntree(e.target.value)}
                required
              />
            </label>
            <label>
              Heure de sortie:{' '}
              <input
                type="time"
                value={formMultipleSortie}
                onChange={(e) => setFormMultipleSortie(e.target.value)}
                required
              />
            </label>
            <button type="submit">Appliquer aux jours selectionnes</button>
            <button type="button" className="danger" onClick={supprimerJoursSelectionnes}>
              Supprimer les jours selectionnes
            </button>
            <button type="button" className="secondary" onClick={() => setJoursSelectionnes([])}>
              Deselectionner tout
            </button>
          </form>
        </div>
      )}

      {dateSelectionnee && (
        <div className="panneau-edition-jour">
          <h4>
            {new Date(`${dateSelectionnee}T00:00:00`).toLocaleDateString('fr-FR', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </h4>
          <div className="form-inline">
            <label>
              Heure d'entree:{' '}
              <input type="time" value={formHeureEntree} onChange={(e) => setFormHeureEntree(e.target.value)} />
            </label>
            <label>
              Heure de sortie:{' '}
              <input type="time" value={formHeureSortie} onChange={(e) => setFormHeureSortie(e.target.value)} />
            </label>
            <button onClick={enregistrerJour}>Enregistrer</button>
            {pointagesMois[dateSelectionnee] && (
              <button className="danger" onClick={supprimerJour}>
                Supprimer
              </button>
            )}
            <button className="secondary" onClick={() => setDateSelectionnee(null)}>
              Fermer
            </button>
          </div>
        </div>
      )}

      <h3>Inserer une plage de dates</h3>
      <p className="aide">
        Applique les memes heures d'entree/sortie a chaque jour entre les deux dates (ex: du lundi au jeudi).
      </p>
      <form className="form-inline" onSubmit={appliquerPlage}>
        <label>
          Du:{' '}
          <input
            type="date"
            value={plage.date_debut}
            onChange={(e) => setPlage({ ...plage, date_debut: e.target.value })}
            required
          />
        </label>
        <label>
          Au:{' '}
          <input
            type="date"
            value={plage.date_fin}
            onChange={(e) => setPlage({ ...plage, date_fin: e.target.value })}
            required
          />
        </label>
        <label>
          Heure d'entree:{' '}
          <input
            type="time"
            value={plage.heure_entree}
            onChange={(e) => setPlage({ ...plage, heure_entree: e.target.value })}
            required
          />
        </label>
        <label>
          Heure de sortie:{' '}
          <input
            type="time"
            value={plage.heure_sortie}
            onChange={(e) => setPlage({ ...plage, heure_sortie: e.target.value })}
            required
          />
        </label>
        <button type="submit">Appliquer a la plage</button>
      </form>
      {messagePlage && <p className="confirmation">{messagePlage}</p>}
    </div>
  );
}
