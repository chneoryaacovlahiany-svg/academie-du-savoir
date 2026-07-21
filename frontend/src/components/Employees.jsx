import { useEffect, useState } from 'react';
import { api } from '../api';

const EMPLOYE_VIDE = { nom: '', prenom: '', poste: '', taux_horaire: '', solde_conges: '0' };

export default function Employees() {
  const [employees, setEmployees] = useState([]);
  const [form, setForm] = useState(EMPLOYE_VIDE);
  const [editingId, setEditingId] = useState(null);
  const [erreur, setErreur] = useState('');

  const charger = () => api.getEmployees().then(setEmployees).catch((e) => setErreur(e.message));

  useEffect(() => {
    charger();
  }, []);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErreur('');
    try {
      const payload = {
        ...form,
        taux_horaire: Number(form.taux_horaire),
        solde_conges: Number(form.solde_conges),
      };
      if (editingId) {
        await api.updateEmployee(editingId, payload);
      } else {
        await api.createEmployee(payload);
      }
      setForm(EMPLOYE_VIDE);
      setEditingId(null);
      charger();
    } catch (err) {
      setErreur(err.message);
    }
  };

  const handleEdit = (emp) => {
    setEditingId(emp.id);
    setForm({
      nom: emp.nom,
      prenom: emp.prenom,
      poste: emp.poste || '',
      taux_horaire: String(emp.taux_horaire),
      solde_conges: String(emp.solde_conges),
    });
  };

  const handleDelete = async (id) => {
    if (!confirm('Supprimer cet employe et tout son historique ?')) return;
    await api.deleteEmployee(id);
    charger();
  };

  return (
    <div className="panel">
      <h2>Employes</h2>

      <form className="form-inline" onSubmit={handleSubmit}>
        <input name="nom" placeholder="Nom" value={form.nom} onChange={handleChange} required />
        <input name="prenom" placeholder="Prenom" value={form.prenom} onChange={handleChange} required />
        <input name="poste" placeholder="Poste" value={form.poste} onChange={handleChange} />
        <input
          name="taux_horaire"
          type="number"
          step="0.01"
          min="0"
          placeholder="Taux horaire (EUR)"
          value={form.taux_horaire}
          onChange={handleChange}
          required
        />
        <input
          name="solde_conges"
          type="number"
          step="0.5"
          placeholder="Solde conges (jours)"
          value={form.solde_conges}
          onChange={handleChange}
        />
        <button type="submit">{editingId ? 'Modifier' : 'Ajouter'}</button>
        {editingId && (
          <button
            type="button"
            className="secondary"
            onClick={() => {
              setEditingId(null);
              setForm(EMPLOYE_VIDE);
            }}
          >
            Annuler
          </button>
        )}
      </form>

      {erreur && <p className="erreur">{erreur}</p>}

      <table>
        <thead>
          <tr>
            <th>Nom</th>
            <th>Prenom</th>
            <th>Poste</th>
            <th>Taux horaire</th>
            <th>Solde conges</th>
            <th>Statut</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {employees.map((emp) => (
            <tr key={emp.id}>
              <td>{emp.nom}</td>
              <td>{emp.prenom}</td>
              <td>{emp.poste}</td>
              <td>{emp.taux_horaire.toFixed(2)} EUR/h</td>
              <td>{emp.solde_conges} j</td>
              <td>{emp.actif ? 'Actif' : 'Inactif'}</td>
              <td className="actions">
                <button onClick={() => handleEdit(emp)}>Modifier</button>
                <button className="danger" onClick={() => handleDelete(emp.id)}>
                  Supprimer
                </button>
              </td>
            </tr>
          ))}
          {employees.length === 0 && (
            <tr>
              <td colSpan={7} className="vide">
                Aucun employe pour le moment
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
