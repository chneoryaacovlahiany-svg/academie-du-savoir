import { useEffect, useState } from 'react';
import { api } from '../api';
import { useDevise } from '../DeviseContext.jsx';
import { useAuth } from '../AuthContext.jsx';

const TYPES = [
  { value: 'conge_paye', label: 'Conge paye' },
  { value: 'sans_solde', label: 'Sans solde' },
  { value: 'maladie', label: 'Maladie' },
  { value: 'autre', label: 'Autre' },
];

const STATUT_LABELS = {
  en_attente: 'En attente',
  approuve: 'Approuve',
  refuse: 'Refuse',
};

const CONGE_VIDE = { employee_id: '', date_debut: '', date_fin: '', type: 'conge_paye', commentaire: '' };

export default function Conges() {
  const { formatMontant } = useDevise();
  const { user } = useAuth();
  const estAdmin = user.role === 'admin';
  const [employees, setEmployees] = useState([]);
  const [conges, setConges] = useState([]);
  const [form, setForm] = useState(CONGE_VIDE);
  const [erreur, setErreur] = useState('');

  const charger = async () => {
    const [emps, cgs] = await Promise.all([api.getEmployees(), api.getConges()]);
    setEmployees(emps);
    setConges(cgs);
    if (!estAdmin && emps.length > 0) {
      setForm((f) => ({ ...f, employee_id: String(emps[0].id) }));
    }
  };

  useEffect(() => {
    charger();
  }, []);

  const nomEmploye = (id) => {
    const e = employees.find((emp) => emp.id === id);
    return e ? `${e.prenom} ${e.nom}` : `#${id}`;
  };

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErreur('');
    try {
      await api.createConge({ ...form, employee_id: Number(form.employee_id) });
      setForm(CONGE_VIDE);
      charger();
    } catch (err) {
      setErreur(err.message);
    }
  };

  const changerStatut = async (id, statut) => {
    setErreur('');
    try {
      await api.updateStatutConge(id, statut);
      charger();
    } catch (err) {
      setErreur(err.message);
    }
  };

  const supprimer = async (id) => {
    if (!confirm('Supprimer cette demande de conge ?')) return;
    await api.deleteConge(id);
    charger();
  };

  return (
    <div className="panel">
      <h2>Conges & vacances</h2>

      <form className="form-inline" onSubmit={handleSubmit}>
        {estAdmin && (
          <select name="employee_id" value={form.employee_id} onChange={handleChange} required>
            <option value="">Employe...</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.prenom} {e.nom} (conges: {e.solde_conges_disponible}j, maladie: {e.solde_maladie_disponible}j)
              </option>
            ))}
          </select>
        )}
        <input type="date" name="date_debut" value={form.date_debut} onChange={handleChange} required />
        <input type="date" name="date_fin" value={form.date_fin} onChange={handleChange} required />
        <select name="type" value={form.type} onChange={handleChange}>
          {TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <input name="commentaire" placeholder="Commentaire" value={form.commentaire} onChange={handleChange} />
        <button type="submit">Demander</button>
      </form>

      {erreur && <p className="erreur">{erreur}</p>}

      <table>
        <thead>
          <tr>
            <th>Employe</th>
            <th>Debut</th>
            <th>Fin</th>
            <th>Jours</th>
            <th>Type</th>
            <th>Montant estime</th>
            <th>Statut</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {conges.map((c) => (
            <tr key={c.id}>
              <td>{nomEmploye(c.employee_id)}</td>
              <td>{c.date_debut}</td>
              <td>{c.date_fin}</td>
              <td>{c.nb_jours}</td>
              <td>{TYPES.find((t) => t.value === c.type)?.label || c.type}</td>
              <td>{c.type === 'maladie' ? formatMontant(c.montant_estime) : '-'}</td>
              <td>
                <span className={`badge badge-${c.statut}`}>{STATUT_LABELS[c.statut]}</span>
              </td>
              <td className="actions">
                {estAdmin && c.statut !== 'approuve' && (
                  <button onClick={() => changerStatut(c.id, 'approuve')}>Approuver</button>
                )}
                {estAdmin && c.statut !== 'refuse' && (
                  <button className="secondary" onClick={() => changerStatut(c.id, 'refuse')}>
                    Refuser
                  </button>
                )}
                {estAdmin && (
                  <button className="danger" onClick={() => supprimer(c.id)}>
                    Supprimer
                  </button>
                )}
              </td>
            </tr>
          ))}
          {conges.length === 0 && (
            <tr>
              <td colSpan={8} className="vide">
                Aucune demande de conge
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
