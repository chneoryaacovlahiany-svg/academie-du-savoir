import { useEffect, useState } from 'react';
import { api } from '../api';
import { useLangue } from '../LangueContext.jsx';

const COMPTE_VIDE = { email: '', password: '', role: 'employe', employee_id: '' };

export default function Comptes() {
  const { t } = useLangue();
  const [comptes, setComptes] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [form, setForm] = useState(COMPTE_VIDE);
  const [editingId, setEditingId] = useState(null);
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
      const donnees = {
        email: form.email,
        role: form.role,
        employee_id: form.employee_id ? Number(form.employee_id) : null,
      };
      if (editingId) {
        if (form.password) donnees.password = form.password;
        await api.updateUser(editingId, donnees);
        setMessage(t('comptes.compteModifie'));
      } else {
        await api.createUser({ ...donnees, password: form.password });
        setMessage(t('comptes.compteCree'));
      }
      setForm(COMPTE_VIDE);
      setEditingId(null);
      charger();
    } catch (err) {
      setErreur(err.message);
    }
  };

  const handleEdit = (compte) => {
    setEditingId(compte.id);
    setForm({
      email: compte.email,
      password: '',
      role: compte.role,
      employee_id: compte.employee_id != null ? String(compte.employee_id) : '',
    });
  };

  const annulerEdition = () => {
    setEditingId(null);
    setForm(COMPTE_VIDE);
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
          placeholder={editingId ? t('comptes.nouveauMotDePassePlaceholder') : t('comptes.motDePassePlaceholder')}
          value={form.password}
          onChange={handleChange}
          required={!editingId}
        />
        <select name="role" value={form.role} onChange={handleChange}>
          <option value="employe">{t('comptes.roleEmploye')}</option>
          <option value="admin">{t('comptes.roleAdmin')}</option>
        </select>
        <select name="employee_id" value={form.employee_id} onChange={handleChange} required={form.role === 'employe'}>
          <option value="">{t('comptes.employeLieOption')}</option>
          {employees.map((emp) => (
            <option key={emp.id} value={emp.id}>
              {emp.prenom} {emp.nom}
            </option>
          ))}
        </select>
        <button type="submit">{editingId ? t('common.edit') : t('comptes.creerCompte')}</button>
        {editingId && (
          <button type="button" className="secondary" onClick={annulerEdition}>
            {t('common.cancel')}
          </button>
        )}
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
                <button onClick={() => handleEdit(c)}>{t('common.edit')}</button>
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
