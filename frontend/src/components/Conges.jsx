import { useEffect, useState } from 'react';
import { api } from '../api';
import { useDevise } from '../DeviseContext.jsx';
import { useAuth } from '../AuthContext.jsx';
import { useLangue } from '../LangueContext.jsx';

const CONGE_VIDE = { employee_id: '', date_debut: '', date_fin: '', type: 'conge_paye', commentaire: '' };

export default function Conges() {
  const { formatMontant } = useDevise();
  const { user } = useAuth();
  const { t } = useLangue();
  const estAdmin = user.role === 'admin';
  const [employees, setEmployees] = useState([]);
  const [conges, setConges] = useState([]);
  const [form, setForm] = useState(CONGE_VIDE);
  const [erreur, setErreur] = useState('');

  const TYPES = [
    { value: 'conge_paye', label: t('conges.typeCongePaye') },
    { value: 'sans_solde', label: t('conges.typeSansSolde') },
    { value: 'maladie', label: t('conges.typeMaladie') },
    { value: 'autre', label: t('conges.typeAutre') },
  ];

  const STATUT_LABELS = {
    en_attente: t('conges.statutEnAttente'),
    approuve: t('conges.statutApprouve'),
    refuse: t('conges.statutRefuse'),
  };

  const charger = async () => {
    try {
      const [emps, cgs] = await Promise.all([api.getEmployees(), api.getConges()]);
      setEmployees(emps);
      setConges(cgs);
      if (!estAdmin && emps.length > 0) {
        setForm((f) => ({ ...f, employee_id: String(emps[0].id) }));
      }
    } catch (err) {
      setErreur(err.message);
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
    if (!confirm(t('conges.confirmSupprimer'))) return;
    await api.deleteConge(id);
    charger();
  };

  return (
    <div className="panel">
      <h2>{t('conges.title')}</h2>

      <form className="form-inline" onSubmit={handleSubmit}>
        {estAdmin && (
          <select name="employee_id" value={form.employee_id} onChange={handleChange} required>
            <option value="">{t('conges.employeOption')}</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.prenom} {e.nom}{' '}
                {t('conges.congesEtMaladie', { conges: e.solde_conges_disponible, maladie: e.solde_maladie_disponible })}
              </option>
            ))}
          </select>
        )}
        <input type="date" name="date_debut" value={form.date_debut} onChange={handleChange} required />
        <input type="date" name="date_fin" value={form.date_fin} onChange={handleChange} required />
        <select name="type" value={form.type} onChange={handleChange}>
          {TYPES.map((tp) => (
            <option key={tp.value} value={tp.value}>
              {tp.label}
            </option>
          ))}
        </select>
        <input name="commentaire" placeholder={t('conges.commentairePlaceholder')} value={form.commentaire} onChange={handleChange} />
        <button type="submit">{t('conges.demander')}</button>
      </form>

      {erreur && <p className="erreur">{erreur}</p>}

      <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>{t('conges.colEmploye')}</th>
            <th>{t('conges.colDebut')}</th>
            <th>{t('conges.colFin')}</th>
            <th>{t('conges.colJours')}</th>
            <th>{t('conges.colType')}</th>
            <th>{t('conges.colMontantEstime')}</th>
            <th>{t('conges.colStatut')}</th>
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
              <td>{TYPES.find((tp) => tp.value === c.type)?.label || c.type}</td>
              <td>{c.type === 'maladie' ? formatMontant(c.montant_estime) : '-'}</td>
              <td>
                <span className={`badge badge-${c.statut}`}>{STATUT_LABELS[c.statut]}</span>
              </td>
              <td className="actions">
                {estAdmin && c.statut !== 'approuve' && (
                  <button onClick={() => changerStatut(c.id, 'approuve')}>{t('conges.approuver')}</button>
                )}
                {estAdmin && c.statut !== 'refuse' && (
                  <button className="secondary" onClick={() => changerStatut(c.id, 'refuse')}>
                    {t('conges.refuser')}
                  </button>
                )}
                {estAdmin && (
                  <button className="danger" onClick={() => supprimer(c.id)}>
                    {t('conges.supprimer')}
                  </button>
                )}
              </td>
            </tr>
          ))}
          {conges.length === 0 && (
            <tr>
              <td colSpan={8} className="vide">
                {t('conges.aucuneDemande')}
              </td>
            </tr>
          )}
        </tbody>
      </table>
      </div>
    </div>
  );
}
