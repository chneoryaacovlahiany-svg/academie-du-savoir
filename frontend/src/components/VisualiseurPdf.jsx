import { useEffect, useRef, useState } from 'react';
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import { useLangue } from '../LangueContext.jsx';

// Le build "legacy" (plutot que le build par defaut, plus recent) est
// necessaire pour rester compatible avec les navigateurs mobiles plus
// anciens (Chrome Android notamment).
GlobalWorkerOptions.workerSrc = workerUrl;

// Rendu du PDF page par page sur des <canvas>, plutot qu'un <iframe>/lien
// direct: sur mobile (Chrome Android notamment), un iframe pointant vers un
// PDF n'affiche qu'un bouton "Ouvrir" qui delegue au lecteur PDF du systeme,
// hors de l'application (et hors de la PWA installee), sans moyen d'y
// revenir. En rendant nous-memes les pages, tout reste dans la fenetre
// modale de l'appli.
export default function VisualiseurPdf({ url }) {
  const { t } = useLangue();
  const pagesRef = useRef(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    let annule = false;
    setChargement(true);
    setErreur('');
    if (pagesRef.current) pagesRef.current.innerHTML = '';

    (async () => {
      try {
        const reponse = await fetch(url, { credentials: 'same-origin' });
        if (!reponse.ok) throw new Error(t('fichesPaie.erreurChargementPdf'));
        const donnees = await reponse.arrayBuffer();
        if (annule) return;

        const pdf = await getDocument({ data: donnees }).promise;
        for (let numeroPage = 1; numeroPage <= pdf.numPages; numeroPage += 1) {
          if (annule) return;
          const page = await pdf.getPage(numeroPage);
          const largeurConteneur = pagesRef.current?.clientWidth || 800;
          const echelle = largeurConteneur / page.getViewport({ scale: 1 }).width;
          const viewport = page.getViewport({ scale: echelle });

          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.className = 'visualiseur-pdf-page';
          await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
          if (annule) return;
          pagesRef.current?.appendChild(canvas);
        }
        if (!annule) setChargement(false);
      } catch (err) {
        if (!annule) {
          setErreur(err.message || t('fichesPaie.erreurChargementPdf'));
          setChargement(false);
        }
      }
    })();

    return () => {
      annule = true;
    };
  }, [url]);

  return (
    <div className="visualiseur-pdf">
      {chargement && <p className="visualiseur-pdf-chargement">{t('fichesPaie.chargementPdf')}</p>}
      {erreur && <p className="erreur">{erreur}</p>}
      <div ref={pagesRef} className="visualiseur-pdf-pages" />
    </div>
  );
}
