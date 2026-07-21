import { useEffect, useState } from 'react';
import { api } from '../api';

const JOURS_SEMAINE = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

function formatHeure(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

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

function moisCourant() {
  return new Date().toISOString().slice(0, 7);
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

export default function Pointage() {
  const [employees, setEmployees] = useState([]);
  const [statuts, setStatuts] = useState({});
  const [erreur, setErreur] = useState('');

  const [employeeId, setEmployeeId] = useState('');
  const [mois, setMois] = useState(moisCourant());
  const [pointagesMois, setPointagesMois] = useState({});
  const [dateSelectionnee, setDateSelectionnee] = useState(null);
  const [formHeureEntree, setFormHeureEntree] = useState('');
  const [formHeureSortie, setFormHeureSortie] = useState('');
  const [erreurCalendrier, setErreurCalendrier] = useState('');

  const chargerPointageDuJour = async () => {
    const emps = await api.getEmployees();
    setEmployees(emps.filter((e) => e.actif));
    const entries = await Promise.all(
      emps.map(async (e) => [e.id, await api.getStatutDuJour(e.id)])
    );
    setStatuts(Object.fromEntries(entries));
    if (!employeeId && emps.length > 0) {
      setEmployeeId(String(emps[0].id));
    }
  };

  useEffect(() => {
    chargerPointageDuJour();
  }, []);

  const chargerCalendrier = async () => {
    if (!employeeId) return;
    const debut = `${mois}-01`;
    const dernierJour = new Date(Number(mois.slice(0, 4)), Number(mois.slice(5, 7)), 0).getDate();
    const fin = `${mois}-${String(dernierJour).padStart(2, '0')}`;
    const rows = await api.getPointages({ employee_id: employeeId, debut, fin });
    setPointagesMois(Object.fromEntries(rows.map((p) => [p.date, p])));
  };

  useEffect(() => {
    chargerCalendrier();
    setDateSelectionnee(null);
  }, [employeeId, mois]);

  const pointer = async (employeeIdAction, action) => {
    setErreur('');
    try {
      if (action === 'entree') await api.pointerEntree(employeeIdAction);
      else await api.pointerSortie(employeeIdAction);
      chargerPointageDuJour();
      if (String(employeeIdAction) === employeeId) chargerCalendrier();
    } catch (err) {
      setErreur(err.message);
    }
  };

  const selectionnerJour = (dateStr) => {
    setDateSelectionnee(dateStr);
    setErreurCalendrier('');
    const p = pointagesMois[dateStr];
    setFormHeureEntree(isoToTimeInput(p?.heure_entree));
    setFormHeureSortie(isoToTimeInput(p?.heure_sortie));
  };

  const enregistrerJour = async () => {
    setErreurCalendrier('');
    try {
      await api.pointageManuel({
        employee_id: employeeId,
        date: dateSelectionnee,
        heure_entree: timeInputToIso(dateSelectionnee, formHeureEntree),
        heure_sortie: timeInputToIso(dateSelectionnee, formHeureSortie),
      });
      chargerCalendrier();
    } catch (err) {
      setErreurCalendrier(err.message);
    }
  };

  const supprimerJour = async () => {
    const p = pointagesMois[dateSelectionnee];
    if (!p) return;
    if (!confirm('Supprimer le pointage de ce jour ?')) return;
    await api.deletePointage(p.id);
    setDateSelectionnee(null);
    chargerCalendrier();
  };

  return (
    <div className="panel">
      <h2>Pointage du jour</h2>
      <p className="date-du-jour">{new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>

      {erreur && <p className="erreur">{erreur}</p>}

      <div className="cartes-pointage">
        {employees.map((emp) => {
          const statut = statuts[emp.id];
          const pointe = statut && statut.heure_entree && !statut.heure_sortie;
          const termine = statut && statut.heure_entree && statut.heure_sortie;

          return (
            <div className="carte-employe" key={emp.id}>
              <div className="carte-nom">
                {emp.prenom} {emp.nom}
              </div>
              <div className="carte-poste">{emp.poste}</div>
              <div className="carte-heures">
                Entree: {formatHeure(statut?.heure_entree)} | Sortie: {formatHeure(statut?.heure_sortie)}
              </div>
              {termine && <div className="carte-total">Total: {formatDuree(statut.heures_travaillees)}</div>}
              <div className="carte-actions">
                <button
                  className="entree"
                  disabled={pointe || termine}
                  onClick={() => pointer(emp.id, 'entree')}
                >
                  Entree
                </button>
                <button
                  className="sortie"
                  disabled={!pointe}
                  onClick={() => pointer(emp.id, 'sortie')}
                >
                  Sortie
                </button>
              </div>
            </div>
          );
        })}
        {employees.length === 0 && <p className="vide">Aucun employe actif. Ajoutez des employes dans l'onglet correspondant.</p>}
      </div>

      <h3>Calendrier mensuel & corrections</h3>
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
      </div>

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
            return (
              <button
                key={dateStr}
                className={`calendrier-jour ${p ? 'calendrier-jour-pointe' : ''} ${selectionne ? 'calendrier-jour-selectionne' : ''}`}
                onClick={() => selectionnerJour(dateStr)}
                type="button"
              >
                <span className="calendrier-jour-numero">{jour}</span>
                <span className="calendrier-jour-detail">
                  {p?.heures_travaillees != null ? formatDuree(p.heures_travaillees) : p ? 'incomplet' : ''}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {dateSelectionnee && (
        <div className="panneau-edition-jour">
          <h4>
            {new Date(dateSelectionnee).toLocaleDateString('fr-FR', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </h4>
          {erreurCalendrier && <p className="erreur">{erreurCalendrier}</p>}
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
    </div>
  );
}
