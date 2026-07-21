import { useEffect, useState } from 'react';
import { api } from '../api';
import { useDevise } from '../DeviseContext.jsx';

function moisCourant() {
  return new Date().toISOString().slice(0, 7);
}

export default function Rapport() {
  const { formatMontant } = useDevise();
  const [mois, setMois] = useState(moisCourant());
  const [rapport, setRapport] = useState([]);
  const [erreur, setErreur] = useState('');

  const charger = async (m) => {
    setErreur('');
    try {
      const data = await api.getRapport({ mois: m });
      setRapport(data);
    } catch (err) {
      setErreur(err.message);
    }
  };

  useEffect(() => {
    charger(mois);
  }, [mois]);

  const totalGeneral = rapport.reduce((acc, r) => acc + r.montant_total, 0);
  const totalHeures = rapport.reduce((acc, r) => acc + r.total_heures, 0);

  return (
    <div className="panel">
      <h2>Rapport & paie</h2>

      <div className="form-inline">
        <label>
          Mois:{' '}
          <input type="month" value={mois} onChange={(e) => setMois(e.target.value)} />
        </label>
      </div>

      {erreur && <p className="erreur">{erreur}</p>}

      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Employe</th>
              <th>Mode de paie</th>
              <th>Taux horaire</th>
              <th>Heures travaillees</th>
              <th>Conges payes (j)</th>
              <th>Feries payes (j)</th>
              <th>Solde conges</th>
              <th>Solde maladie</th>
              <th>Montant travail</th>
              <th>Montant conges</th>
              <th>Montant maladie</th>
              <th>Montant heures sup</th>
              <th>Montant feries</th>
              <th>Montant total</th>
            </tr>
          </thead>
          <tbody>
            {rapport.map((r) => (
              <tr key={r.employee_id}>
                <td>
                  {r.prenom} {r.nom}
                </td>
                <td>{r.type_paie === 'mensuel' ? 'Mensuel fixe' : 'Horaire'}</td>
                <td>{formatMontant(r.taux_horaire)}/h</td>
                <td>{r.total_heures.toFixed(2)} h</td>
                <td>{r.jours_conges_payes}</td>
                <td>{r.jours_feries_payes}</td>
                <td>{r.solde_conges_disponible} j</td>
                <td>{r.solde_maladie_disponible} j</td>
                <td>{formatMontant(r.montant_travail)}</td>
                <td>{formatMontant(r.montant_conges)}</td>
                <td>{formatMontant(r.montant_maladie)}</td>
                <td>{formatMontant(r.montant_heures_sup)}</td>
                <td>{formatMontant(r.montant_jours_feries)}</td>
                <td className="montant-total">{formatMontant(r.montant_total)}</td>
              </tr>
            ))}
            {rapport.length === 0 && (
              <tr>
                <td colSpan={14} className="vide">
                  Aucune donnee pour ce mois
                </td>
              </tr>
            )}
          </tbody>
          {rapport.length > 0 && (
            <tfoot>
              <tr>
                <td colSpan={3}>
                  <strong>Total</strong>
                </td>
                <td>
                  <strong>{totalHeures.toFixed(2)} h</strong>
                </td>
                <td colSpan={8}></td>
                <td className="montant-total">
                  <strong>{formatMontant(totalGeneral)}</strong>
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
