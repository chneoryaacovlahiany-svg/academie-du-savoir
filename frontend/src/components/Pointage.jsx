import { useEffect, useState } from 'react';
import { api } from '../api';

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

export default function Pointage() {
  const [employees, setEmployees] = useState([]);
  const [statuts, setStatuts] = useState({});
  const [erreur, setErreur] = useState('');

  const charger = async () => {
    const emps = await api.getEmployees();
    setEmployees(emps.filter((e) => e.actif));
    const entries = await Promise.all(
      emps.map(async (e) => [e.id, await api.getStatutDuJour(e.id)])
    );
    setStatuts(Object.fromEntries(entries));
  };

  useEffect(() => {
    charger();
  }, []);

  const pointer = async (employeeId, action) => {
    setErreur('');
    try {
      if (action === 'entree') await api.pointerEntree(employeeId);
      else await api.pointerSortie(employeeId);
      charger();
    } catch (err) {
      setErreur(err.message);
    }
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
    </div>
  );
}
