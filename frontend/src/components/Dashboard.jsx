import { useEffect, useState } from 'react';
import { api } from '../api';
import { useDevise } from '../DeviseContext.jsx';

const STATUT_INFO = {
  bon: { label: 'A jour', icone: '✓', classe: 'statut-bon' },
  excedent: { label: 'Excedent a faire prendre', icone: '!', classe: 'statut-excedent' },
  critique: { label: 'Solde negatif', icone: '✕', classe: 'statut-critique' },
};

const TYPE_LABELS = {
  conge_paye: 'Conge paye',
  sans_solde: 'Sans solde',
  maladie: 'Maladie',
  autre: 'Autre',
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
  const [congesEnAttente, setCongesEnAttente] = useState([]);
  const [erreur, setErreur] = useState('');

  const charger = async (employeeId) => {
    setErreur('');
    try {
      setDonnees(await api.getDashboard(employeeId ? { employee_id: employeeId } : {}));
    } catch (err) {
      setErreur(err.message);
    }
  };

  const chargerCongesEnAttente = async () => {
    try {
      setCongesEnAttente(await api.getConges({ statut: 'en_attente' }));
    } catch {
      setCongesEnAttente([]);
    }
  };

  useEffect(() => {
    api.getEmployees().then(setEmployees);
    chargerCongesEnAttente();
  }, []);

  useEffect(() => {
    charger(employeeFiltre);
  }, [employeeFiltre]);

  const nomEmploye = (id) => {
    const e = employees.find((emp) => emp.id === id);
    return e ? `${e.prenom} ${e.nom}` : `#${id}`;
  };

  const traiterConge = async (id, statut) => {
    await api.updateStatutConge(id, statut);
    chargerCongesEnAttente();
    charger(employeeFiltre);
  };

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
        <div className={`cadran ${congesEnAttente.length > 0 ? 'cadran-alerte' : ''}`}>
          <div className="cadran-valeur">{congesEnAttente.length}</div>
          <div className="cadran-label">Demande(s) de conge en attente</div>
        </div>
      </div>

      {erreur && <p className="erreur">{erreur}</p>}

      {congesEnAttente.length > 0 && (
        <>
          <h3>Demandes de conge en attente</h3>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Employe</th>
                  <th>Debut</th>
                  <th>Fin</th>
                  <th>Jours</th>
                  <th>Type</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {congesEnAttente.map((c) => (
                  <tr key={c.id}>
                    <td>{nomEmploye(c.employee_id)}</td>
                    <td>{c.date_debut}</td>
                    <td>{c.date_fin}</td>
                    <td>{c.nb_jours}</td>
                    <td>{TYPE_LABELS[c.type] || c.type}</td>
                    <td className="actions">
                      <button onClick={() => traiterConge(c.id, 'approuve')}>Approuver</button>
                      <button className="secondary" onClick={() => traiterConge(c.id, 'refuse')}>
                        Refuser
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

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
