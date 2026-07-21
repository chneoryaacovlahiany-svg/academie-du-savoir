import { useEffect, useState } from 'react';
import { api } from '../api';
import { useDevise } from '../DeviseContext.jsx';

const STATUT_INFO = {
  bon: { label: 'A jour', icone: '✓', classe: 'statut-bon' },
  excedent: { label: 'Excedent a faire prendre', icone: '!', classe: 'statut-excedent' },
  critique: { label: 'Solde negatif', icone: '✕', classe: 'statut-critique' },
};

function formatDateFr(dateStr) {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function Dashboard() {
  const { formatMontant } = useDevise();
  const [employees, setEmployees] = useState([]);
  const [employeeFiltre, setEmployeeFiltre] = useState('');
  const [donnees, setDonnees] = useState(null);
  const [erreur, setErreur] = useState('');

  const charger = async (employeeId) => {
    setErreur('');
    try {
      setDonnees(await api.getDashboard(employeeId ? { employee_id: employeeId } : {}));
    } catch (err) {
      setErreur(err.message);
    }
  };

  useEffect(() => {
    api.getEmployees().then(setEmployees);
  }, []);

  useEffect(() => {
    charger(employeeFiltre);
  }, [employeeFiltre]);

  if (erreur) return <div className="panel"><p className="erreur">{erreur}</p></div>;
  if (!donnees) return <div className="panel">Chargement...</div>;

  const { global: g, employes } = donnees;

  return (
    <div className="panel">
      <h2>Tableau de bord</h2>

      <div className="form-inline">
        <label>
          Employe:{' '}
          <select value={employeeFiltre} onChange={(e) => setEmployeeFiltre(e.target.value)}>
            <option value="">Tous les employes</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.prenom} {e.nom}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="cadrans">
        <div className="cadran">
          <div className="cadran-valeur">{g.jours_conges_pris_annee}</div>
          <div className="cadran-label">Jours de conge pris ({donnees.periode.annee})</div>
        </div>
        <div className="cadran">
          <div className="cadran-valeur">{g.jours_conges_restants}</div>
          <div className="cadran-label">
            Jours de conge restants {employeeFiltre ? '' : '(tous employes)'}
          </div>
        </div>
        <div className="cadran">
          <div className="cadran-valeur">{formatMontant(g.masse_salariale_horaire)}</div>
          <div className="cadran-label">Paie horaire (mois en cours)</div>
        </div>
        <div className="cadran">
          <div className="cadran-valeur">{formatMontant(g.masse_salariale_mensuelle)}</div>
          <div className="cadran-label">Paie fixe (mois en cours)</div>
        </div>
        <div className="cadran cadran-principal">
          <div className="cadran-valeur">{formatMontant(g.masse_salariale_totale)}</div>
          <div className="cadran-label">Total a payer (mois en cours)</div>
        </div>
        <div className="cadran">
          <div className="cadran-valeur cadran-valeur-petite">
            {g.prochain_jour_ferie ? formatDateFr(g.prochain_jour_ferie.date) : 'Aucun'}
          </div>
          <div className="cadran-label">
            {g.prochain_jour_ferie ? `Prochain ferie: ${g.prochain_jour_ferie.nom}` : 'Prochain jour ferie'}
          </div>
        </div>
      </div>

      {erreur && <p className="erreur">{erreur}</p>}

      <h3>Conges par employe</h3>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Employe</th>
              <th>Droit annuel actuel</th>
              <th>Pris cette annee</th>
              <th>Restant</th>
              <th>Solde maladie</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            {employes.map((e) => {
              const info = STATUT_INFO[e.statut] || STATUT_INFO.bon;
              return (
                <tr key={e.employee_id}>
                  <td>
                    {e.prenom} {e.nom}
                  </td>
                  <td>{e.droit_annuel_actuel} j/an</td>
                  <td>{e.jours_pris_annee} j</td>
                  <td>{e.jours_restants} j</td>
                  <td>{e.solde_maladie_disponible} j</td>
                  <td>
                    <span className={`statut-badge ${info.classe}`}>
                      <span aria-hidden="true">{info.icone}</span> {info.label}
                    </span>
                  </td>
                </tr>
              );
            })}
            {employes.length === 0 && (
              <tr>
                <td colSpan={6} className="vide">
                  Aucun employe actif
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
