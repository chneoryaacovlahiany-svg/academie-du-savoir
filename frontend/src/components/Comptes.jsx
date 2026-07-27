import { useEffect, useState } from 'react';
import { api } from '../api';
import { useLangue } from '../LangueContext.jsx';

const COMPTE_VIDE = { email: '', password: '', role: 'employe', employee_id: '' };

export default function Comptes() {
  const { t } = useLangue();
  const [comptes, setComptes] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [form, setForm] = useState(COMPTE_VIDE);
  const [erreur, setErreur] = useState('');
  const [message, setMessage] = useState('');

  const charger = async () => {
    try {
      const [c, e] = await Promise.all([api.getUsers(), api.getEmployees()]);
      setComptes(c);
      setEmployees(e);
    } catch (err) {
      setErreur(err.message);
    }
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
      setMessage(t('comptes.compteCree'));
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
    if (!confirm(t('comptes.confirmSupprimer'))) return;
    await api.deleteUser(id);
    charger();
  };

  return (
    <div className="panel">
      <h2>{t('comptes.title')}</h2>
      <p className="aide">{t('comptes.aide')}</p>

      {erreur && <p className="erreur">{erreur}</p>}
      {message && <p className="confirmation">{message}</p>}

      <form className="form-inline" onSubmit={handleSubmit}>
        <input
          name="email"
          placeholder={t('comptes.identifiantPlaceholder')}
          value={form.email}
          onChange={handleChange}
          required
        />
        <input
          name="password"
          type="password"
          placeholder={t('comptes.motDePassePlaceholder')}
          value={form.password}
          onChange={handleChange}
          required
        />
        <select name="role" value={form.role} onChange={handleChange}>
          <option value="employe">{t('comptes.roleEmploye')}</option>
          <option value="admin">{t('comptes.roleAdmin')}</option>
        </select>
        {form.role === 'employe' && (
          <select name="employee_id" value={form.employee_id} onChange={handleChange} required>
            <option value="">{t('comptes.employeLieOption')}</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.prenom} {emp.nom}
              </option>
            ))}
          </select>
        )}
        <button type="submit">{t('comptes.creerCompte')}</button>
      </form>

      <table>
        <thead>
          <tr>
            <th>{t('comptes.colIdentifiant')}</th>
            <th>{t('comptes.colRole')}</th>
            <th>{t('comptes.colEmployeLie')}</th>
            <th>{t('comptes.colStatut')}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {comptes.map((c) => (
            <tr key={c.id}>
              <td>{c.email}</td>
              <td>{c.role === 'admin' ? t('comptes.roleAdmin') : t('comptes.roleEmploye')}</td>
              <td>{c.employee ? `${c.employee.prenom} ${c.employee.nom}` : '-'}</td>
              <td>{c.actif ? t('common.active') : t('comptes.desactive')}</td>
              <td className="actions">
                <button className="secondary" onClick={() => basculerActif(c)}>
                  {c.actif ? t('comptes.desactiver') : t('comptes.reactiver')}
                </button>
                <button className="danger" onClick={() => supprimer(c.id)}>
                  {t('comptes.supprimer')}
                </button>
              </td>
            </tr>
          ))}
          {comptes.length === 0 && (
            <tr>
              <td colSpan={5} className="vide">
                {t('comptes.aucunCompte')}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
