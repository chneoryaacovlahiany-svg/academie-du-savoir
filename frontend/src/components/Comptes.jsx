import { useEffect, useState } from 'react';
import { api } from '../api';

const COMPTE_VIDE = { email: '', password: '', role: 'employe', employee_id: '' };

export default function Comptes() {
  const [comptes, setComptes] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [form, setForm] = useState(COMPTE_VIDE);
  const [erreur, setErreur] = useState('');
  const [message, setMessage] = useState('');

  const charger = async () => {
    const [c, e] = await Promise.all([api.getUsers(), api.getEmployees()]);
    setComptes(c);
    setEmployees(e);
  };

  useEffect(() => {
    charger();
  }, []);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErreur('');
    setMessage('');
    try {
      await api.createUser({
        ...form,
        employee_id: form.employee_id ? Number(form.employee_id) : null,
      });
      setForm(COMPTE_VIDE);
      setMessage('Compte cree.');
      charger();
    } catch (err) {
      setErreur(err.message);
    }
  };

  const basculerActif = async (compte) => {
    await api.updateUser(compte.id, { actif: !compte.actif });
    charger();
  };

  const supprimer = async (id) => {
    if (!confirm('Supprimer ce compte ?')) return;
    await api.deleteUser(id);
    charger();
  };

  return (
    <div className="panel">
      <h2>Comptes</h2>
      <p className="aide">
        Cree un compte de connexion pour un employe (acces limite a ses propres donnees: pointage,
        calendrier, conges) ou un autre administrateur (acces complet a l'application).
      </p>

      {erreur && <p className="erreur">{erreur}</p>}
      {message && <p className="confirmation">{message}</p>}

      <form className="form-inline" onSubmit={handleSubmit}>
        <input
          name="email"
          placeholder="Identifiant (email)"
          value={form.email}
          onChange={handleChange}
          required
        />
        <input
          name="password"
          type="password"
          placeholder="Mot de passe"
          value={form.password}
          onChange={handleChange}
          required
        />
        <select name="role" value={form.role} onChange={handleChange}>
          <option value="employe">Employe</option>
          <option value="admin">Administrateur</option>
        </select>
        {form.role === 'employe' && (
          <select name="employee_id" value={form.employee_id} onChange={handleChange} required>
            <option value="">Employe lie...</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.prenom} {emp.nom}
              </option>
            ))}
          </select>
        )}
        <button type="submit">Creer le compte</button>
      </form>

      <table>
        <thead>
          <tr>
            <th>Identifiant</th>
            <th>Role</th>
            <th>Employe lie</th>
            <th>Statut</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {comptes.map((c) => (
            <tr key={c.id}>
              <td>{c.email}</td>
              <td>{c.role === 'admin' ? 'Administrateur' : 'Employe'}</td>
              <td>{c.employee ? `${c.employee.prenom} ${c.employee.nom}` : '-'}</td>
              <td>{c.actif ? 'Actif' : 'Desactive'}</td>
              <td className="actions">
                <button className="secondary" onClick={() => basculerActif(c)}>
                  {c.actif ? 'Desactiver' : 'Reactiver'}
                </button>
                <button className="danger" onClick={() => supprimer(c.id)}>
                  Supprimer
                </button>
              </td>
            </tr>
          ))}
          {comptes.length === 0 && (
            <tr>
              <td colSpan={5} className="vide">
                Aucun compte
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
