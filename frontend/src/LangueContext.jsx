import { createContext, useContext, useEffect, useState } from 'react';
import { LOCALES, LANGUES, TRADUCTIONS } from './i18n/translations';

export { LANGUES };

export const LangueContext = createContext(null);

const CLE_STOCKAGE = 'pointeuse_langue';

function valeurCle(dict, cle) {
  return cle.split('.').reduce((acc, part) => (acc && acc[part] !== undefined ? acc[part] : undefined), dict);
}

export function LangueProvider({ children }) {
  const [langue, setLangue] = useState(() => localStorage.getItem(CLE_STOCKAGE) || 'fr');

  const direction = langue === 'he' ? 'rtl' : 'ltr';
  const locale = LOCALES[langue] || LOCALES.fr;

  useEffect(() => {
    document.documentElement.setAttribute('lang', langue);
    document.documentElement.setAttribute('dir', direction);
  }, [langue, direction]);

  const changerLangue = (code) => {
    localStorage.setItem(CLE_STOCKAGE, code);
    setLangue(code);
  };

  const t = (cle, remplacements) => {
    let texte = valeurCle(TRADUCTIONS[langue], cle);
    if (texte === undefined) texte = valeurCle(TRADUCTIONS.fr, cle);
    if (texte === undefined) return cle;
    if (typeof texte === 'string' && remplacements) {
      for (const [k, v] of Object.entries(remplacements)) {
        texte = texte.replaceAll(`{${k}}`, v);
      }
    }
    return texte;
  };

  return (
    <LangueContext.Provider value={{ langue, changerLangue, t, direction, locale }}>
      {children}
    </LangueContext.Provider>
  );
}

export function useLangue() {
  return useContext(LangueContext);
}
