import { useEffect, useState } from 'react';
import { api } from '../api';
import { useEntreprise } from '../EntrepriseContext.jsx';
import { useLangue } from '../LangueContext.jsx';

const TAILLE_MAX_LOGO = 360;

export default function Parametres() {
  const { entreprise, rafraichirEntreprise } = useEntreprise();
  const { t } = useLangue();
  const [parametres, setParametres] = useState(null);
  const [bareme, setBareme] = useState([]);
  const [feries, setFeries] = useState([]);
  const [nouvelleFerie, setNouvelleFerie] = useState({ date: '', nom: '' });
  const [annee, setAnnee] = useState(String(new Date().getFullYear()));
  const [message, setMessage] = useState('');
  const [erreur, setErreur] = useState('');

  const [formEntreprise, setFormEntreprise] = useState(entreprise);
  const [messageEntreprise, setMessageEntreprise] = useState('');
  const [erreurEntreprise, setErreurEntreprise] = useState('');

  function redimensionnerImage(fichier, tailleMax) {
    return new Promise((resolve, reject) => {
      const lecteur = new FileReader();
      lecteur.onerror = () => reject(new Error(t('parametres.erreurLectureFichier')));
      lecteur.onload = () => {
        const image = new Image();
        image.onerror = () => reject(new Error(t('parametres.erreurFichierInvalide')));
        image.onload = () => {
          const ratio = Math.min(1, tailleMax / Math.max(image.width, image.height));
          const largeur = Math.round(image.width * ratio);
          const hauteur = Math.round(image.height * ratio);
          const canvas = document.createElement('canvas');
          canvas.width = largeur;
          canvas.height = hauteur;
          const ctx = canvas.getContext('2d');
          // Aplati une eventuelle transparence sur fond blanc: certains
          // lecteurs PDF (dont jsPDF) affichent un damier ou des artefacts de
          // compression avec les logos transparents; le fond blanc convient
          // de toute facon a l'entete de l'appli et des exports, qui sont
          // deja sur fond blanc.
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, largeur, hauteur);
          ctx.drawImage(image, 0, 0, largeur, hauteur);
          resolve(canvas.toDataURL('image/png'));
        };
        image.src = lecteur.result;
      };
      lecteur.readAsDataURL(fichier);
    });
  }

  const CHAMPS_PARAMETRES = [
    { cle: 'heures_standard_jour', label: t('parametres.heuresStandardJour'), step: '0.5' },
    { cle: 'seuil_heures_sup_125', label: t('parametres.seuilHeuresSup125'), step: '0.5' },
    { cle: 'majoration_heures_sup_125', label: t('parametres.majorationHeuresSup125'), step: '0.01' },
    { cle: 'majoration_heures_sup_150', label: t('parametres.majorationHeuresSup150'), step: '0.01' },
    { cle: 'accumulation_maladie_mois', label: t('parametres.accumulationMaladieMois'), step: '0.1' },
    { cle: 'plafond_conges_maladie', label: t('parametres.plafondCongesMaladie'), step: '1' },
  ];

  useEffect(() => {
    setFormEntreprise(entreprise);
  }, [entreprise]);

  const handleLogoChange = async (e) => {
    const fichier = e.target.files?.[0];
    if (!fichier) return;
    setErreurEntreprise('');
    try {
      const dataUrl = await redimensionnerImage(fichier, TAILLE_MAX_LOGO);
      setFormEntreprise({ ...formEntreprise, logo: dataUrl });
    } catch (err) {
      setErreurEntreprise(err.message);
    }
  };

  const supprimerLogo = () => {
    setFormEntreprise({ ...formEntreprise, logo: '' });
  };

  const enregistrerEntreprise = async (e) => {
    e.preventDefault();
    setErreurEntreprise('');
    setMessageEntreprise('');
    try {
      await api.updateEntreprise(formEntreprise);
      await rafraichirEntreprise();
      setMessageEntreprise(t('parametres.societeEnregistree'));
    } catch (err) {
      setErreurEntreprise(err.message);
    }
  };

  const charger = async () => {
    const [p, b, f] = await Promise.all([api.getParametres(), api.getBareme(), api.getFeries(annee)]);
    setParametres(p);
    setBareme(b);
    setFeries(f);
  };

  useEffect(() => {
    charger();
  }, [annee]);

  const handleParametreChange = (cle, valeur) => {
    setParametres({ ...parametres, [cle]: valeur });
  };

  const handleParametreCaseChange = (cle, coche) => {
    setParametres({ ...parametres, [cle]: coche });
  };

  const enregistrerParametres = async (e) => {
    e.preventDefault();
    setErreur('');
    setMessage('');
    try {
      await api.updateParametres(parametres);
      setMessage(t('parametres.parametresEnregistres'));
    } catch (err) {
      setErreur(err.message);
    }
  };

  const handleBaremeChange = (index, champ, valeur) => {
    const copie = [...bareme];
    copie[index] = { ...copie[index], [champ]: valeur };
    setBareme(copie);
  };

  const ajouterLigneBareme = () => {
    setBareme([...bareme, { anciennete_annees: '', jours_par_an: '' }]);
  };

  const supprimerLigneBareme = (index) => {
    setBareme(bareme.filter((_, i) => i !== index));
  };

  const enregistrerBareme = async (e) => {
    e.preventDefault();
    setErreur('');
    setMessage('');
    try {
      const lignes = bareme.map((l) => ({
        anciennete_annees: Number(l.anciennete_annees),
        jours_par_an: Number(l.jours_par_an),
      }));
      const resultat = await api.updateBareme(lignes);
      setBareme(resultat);
      setMessage(t('parametres.baremeEnregistre'));
    } catch (err) {
      setErreur(err.message);
    }
  };

  const ajouterFerie = async (e) => {
    e.preventDefault();
    setErreur('');
    try {
      await api.createFerie(nouvelleFerie);
      setNouvelleFerie({ date: '', nom: '' });
      charger();
    } catch (err) {
      setErreur(err.message);
    }
  };

  const supprimerFerie = async (id) => {
    await api.deleteFerie(id);
    charger();
  };

  if (!parametres) return <div className="panel">{t('common.loading')}</div>;

  return (
    <div className="panel">
      <h2>{t('parametres.title')}</h2>

      <div className="avertissement-legal">{t('parametres.avertissementLegal')}</div>

      {erreur && <p className="erreur">{erreur}</p>}
      {message && <p className="confirmation">{message}</p>}

      <h3>{t('parametres.infosSocieteTitre')}</h3>
      <p className="aide">{t('parametres.infosSocieteAide')}</p>
      {erreurEntreprise && <p className="erreur">{erreurEntreprise}</p>}
      {messageEntreprise && <p className="confirmation">{messageEntreprise}</p>}
      <form className="form-parametres" onSubmit={enregistrerEntreprise}>
        <label className="champ-parametre">
          {t('parametres.nomSociete')}
          <input
            type="text"
            value={formEntreprise.nom}
            onChange={(e) => setFormEntreprise({ ...formEntreprise, nom: e.target.value })}
          />
        </label>
        <label className="champ-parametre">
          {t('parametres.adresse')}
          <input
            type="text"
            value={formEntreprise.adresse}
            onChange={(e) => setFormEntreprise({ ...formEntreprise, adresse: e.target.value })}
          />
        </label>
        <label className="champ-parametre">
          {t('parametres.telephone')}
          <input
            type="text"
            value={formEntreprise.telephone}
            onChange={(e) => setFormEntreprise({ ...formEntreprise, telephone: e.target.value })}
          />
        </label>
        <label className="champ-parametre">
          {t('parametres.email')}
          <input
            type="email"
            value={formEntreprise.email}
            onChange={(e) => setFormEntreprise({ ...formEntreprise, email: e.target.value })}
          />
        </label>
        <div className="champ-parametre">
          {t('parametres.logo')}
          <input type="file" accept="image/*" onChange={handleLogoChange} />
          {formEntreprise.logo && (
            <div className="form-inline">
              <img src={formEntreprise.logo} alt={t('parametres.logo')} className="logo-apercu" />
              <button type="button" className="secondary" onClick={supprimerLogo}>
                {t('parametres.retirerLogo')}
              </button>
            </div>
          )}
        </div>
        <button type="submit">{t('parametres.enregistrerSociete')}</button>
      </form>

      <h3>{t('parametres.reglesCalculTitre')}</h3>
      <form className="form-parametres" onSubmit={enregistrerParametres}>
        {CHAMPS_PARAMETRES.map((champ) => (
          <label key={champ.cle} className="champ-parametre">
            {champ.label}
            <input
              type="number"
              step={champ.step}
              min="0"
              value={parametres[champ.cle]}
              onChange={(e) => handleParametreChange(champ.cle, e.target.value)}
            />
          </label>
        ))}
        <button type="submit">{t('parametres.enregistrerParametres')}</button>
      </form>

      <h3>{t('parametres.retardsTitre')}</h3>
      <p className="aide">{t('parametres.retardsAide')}</p>
      <form className="form-parametres" onSubmit={enregistrerParametres}>
        <label className="champ-parametre champ-case">
          <input
            type="checkbox"
            checked={!!parametres.retards_actif}
            onChange={(e) => handleParametreCaseChange('retards_actif', e.target.checked)}
          />
          {t('parametres.retardsActifLabel')}
        </label>
        <label className="champ-parametre">
          {t('parametres.retardsToleranceLabel')}
          <input
            type="number"
            min="0"
            step="1"
            value={parametres.retards_tolerance_minutes}
            onChange={(e) => handleParametreChange('retards_tolerance_minutes', e.target.value)}
          />
        </label>
        <label className="champ-parametre champ-case">
          <input
            type="checkbox"
            checked={!!parametres.retards_rattrapage_actif}
            onChange={(e) => handleParametreCaseChange('retards_rattrapage_actif', e.target.checked)}
          />
          {t('parametres.retardsRattrapageLabel')}
        </label>
        <label className="champ-parametre champ-case">
          <input
            type="checkbox"
            checked={!!parametres.retards_plafond_mensuel_actif}
            onChange={(e) => handleParametreCaseChange('retards_plafond_mensuel_actif', e.target.checked)}
          />
          {t('parametres.retardsPlafondActifLabel')}
        </label>
        <label className="champ-parametre">
          {t('parametres.retardsPlafondMinutesLabel')}
          <input
            type="number"
            min="0"
            step="1"
            value={parametres.retards_plafond_mensuel_minutes}
            onChange={(e) => handleParametreChange('retards_plafond_mensuel_minutes', e.target.value)}
          />
        </label>
        <button type="submit">{t('parametres.enregistrerParametres')}</button>
      </form>

      <h3>{t('parametres.notifAutoTitre')}</h3>
      <p className="aide">{t('parametres.notifAutoAide')}</p>
      <form className="form-parametres" onSubmit={enregistrerParametres}>
        <label className="champ-parametre champ-case">
          <input
            type="checkbox"
            checked={!!parametres.notif_auto_actif}
            onChange={(e) => handleParametreCaseChange('notif_auto_actif', e.target.checked)}
          />
          {t('parametres.notifAutoActifLabel')}
        </label>
        <label className="champ-parametre">
          {t('parametres.notifEntreeAvantLabel')}
          <input
            type="number"
            min="0"
            step="1"
            value={parametres.notif_entree_avant_minutes}
            onChange={(e) => handleParametreChange('notif_entree_avant_minutes', e.target.value)}
          />
        </label>
        <label className="champ-parametre">
          {t('parametres.notifEntreeNbRappelsLabel')}
          <input
            type="number"
            min="0"
            step="1"
            value={parametres.notif_entree_nb_rappels}
            onChange={(e) => handleParametreChange('notif_entree_nb_rappels', e.target.value)}
          />
        </label>
        <label className="champ-parametre">
          {t('parametres.notifEntreeIntervalleLabel')}
          <input
            type="number"
            min="1"
            step="1"
            value={parametres.notif_entree_intervalle_minutes}
            onChange={(e) => handleParametreChange('notif_entree_intervalle_minutes', e.target.value)}
          />
        </label>
        <label className="champ-parametre">
          {t('parametres.notifSortieNbRappelsLabel')}
          <input
            type="number"
            min="0"
            step="1"
            value={parametres.notif_sortie_nb_rappels}
            onChange={(e) => handleParametreChange('notif_sortie_nb_rappels', e.target.value)}
          />
        </label>
        <label className="champ-parametre">
          {t('parametres.notifSortieIntervalleLabel')}
          <input
            type="number"
            min="1"
            step="1"
            value={parametres.notif_sortie_intervalle_minutes}
            onChange={(e) => handleParametreChange('notif_sortie_intervalle_minutes', e.target.value)}
          />
        </label>
        <label className="champ-parametre">
          {t('parametres.notifSortieOptionsReportLabel')}
          <input
            type="text"
            placeholder="20,30,40"
            value={parametres.notif_sortie_options_report}
            onChange={(e) => handleParametreChange('notif_sortie_options_report', e.target.value)}
          />
        </label>
        <button type="submit">{t('parametres.enregistrerParametres')}</button>
      </form>

      <h3>{t('parametres.restrictionIpTitre')}</h3>
      <p className="aide">{t('parametres.restrictionIpAide')}</p>
      <form className="form-inline" onSubmit={enregistrerParametres}>
        <input
          placeholder="Ex: 88.12.34.56"
          value={parametres.ip_bureau}
          onChange={(e) => handleParametreChange('ip_bureau', e.target.value)}
        />
        <button type="submit">{t('parametres.enregistrerParametres')}</button>
      </form>

      <h3>{t('parametres.baremeTitre')}</h3>
      <p className="aide">{t('parametres.baremeAide')}</p>
      <form onSubmit={enregistrerBareme}>
        <table>
          <thead>
            <tr>
              <th>{t('parametres.colAnciennete')}</th>
              <th>{t('parametres.colJoursParAn')}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {bareme.map((ligne, index) => (
              <tr key={index}>
                <td>
                  <input
                    type="number"
                    min="0"
                    value={ligne.anciennete_annees}
                    onChange={(e) => handleBaremeChange(index, 'anciennete_annees', e.target.value)}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={ligne.jours_par_an}
                    onChange={(e) => handleBaremeChange(index, 'jours_par_an', e.target.value)}
                  />
                </td>
                <td>
                  <button type="button" className="danger" onClick={() => supprimerLigneBareme(index)}>
                    {t('common.delete')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="actions-bareme">
          <button type="button" className="secondary" onClick={ajouterLigneBareme}>
            {t('parametres.ajouterLigne')}
          </button>
          <button type="submit">{t('parametres.enregistrerBareme')}</button>
        </div>
      </form>

      <h3>{t('parametres.feriesTitre')}</h3>
      <div className="form-inline">
        <label>
          {t('parametres.anneeLabel')}{' '}
          <input type="number" value={annee} onChange={(e) => setAnnee(e.target.value)} />
        </label>
      </div>
      <form className="form-inline" onSubmit={ajouterFerie}>
        <input
          type="date"
          value={nouvelleFerie.date}
          onChange={(e) => setNouvelleFerie({ ...nouvelleFerie, date: e.target.value })}
          required
        />
        <input
          placeholder={t('parametres.nomJourFeriePlaceholder')}
          value={nouvelleFerie.nom}
          onChange={(e) => setNouvelleFerie({ ...nouvelleFerie, nom: e.target.value })}
          required
        />
        <button type="submit">{t('common.add')}</button>
      </form>

      <table>
        <thead>
          <tr>
            <th>{t('parametres.colDate')}</th>
            <th>{t('parametres.colNom')}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {feries.map((f) => (
            <tr key={f.id}>
              <td>{f.date}</td>
              <td>{f.nom}</td>
              <td className="actions">
                <button className="danger" onClick={() => supprimerFerie(f.id)}>
                  {t('common.delete')}
                </button>
              </td>
            </tr>
          ))}
          {feries.length === 0 && (
            <tr>
              <td colSpan={3} className="vide">
                {t('parametres.aucunFerie', { annee })}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
