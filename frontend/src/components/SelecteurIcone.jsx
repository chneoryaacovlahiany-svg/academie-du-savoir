import { useEffect, useRef, useState } from 'react';

// Bouton compact (icone + valeur courante) qui ouvre un petit menu au clic,
// reutilise pour la langue et la devise dans l'en-tete: evite de prendre la
// place de deux selecteurs texte complets.
export default function SelecteurIcone({ icone, valeurAffichee, options, valeurActuelle, onChanger, titre }) {
  const [ouvert, setOuvert] = useState(false);
  const conteneurRef = useRef(null);

  useEffect(() => {
    const gestionnaire = (e) => {
      if (conteneurRef.current && !conteneurRef.current.contains(e.target)) {
        setOuvert(false);
      }
    };
    document.addEventListener('mousedown', gestionnaire);
    return () => document.removeEventListener('mousedown', gestionnaire);
  }, []);

  return (
    <div className="selecteur-icone-conteneur" ref={conteneurRef}>
      <button type="button" className="selecteur-icone-bouton" onClick={() => setOuvert(!ouvert)} title={titre}>
        <span aria-hidden="true">{icone}</span> {valeurAffichee}
      </button>
      {ouvert && (
        <div className="selecteur-icone-panneau">
          {options.map((opt) => (
            <button
              type="button"
              key={opt.value}
              className={`selecteur-icone-option ${opt.value === valeurActuelle ? 'active' : ''}`}
              onClick={() => {
                onChanger(opt.value);
                setOuvert(false);
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
