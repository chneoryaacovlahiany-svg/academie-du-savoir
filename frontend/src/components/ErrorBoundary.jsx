import { Component } from 'react';

// Filet de securite: sans ceci, une erreur JS dans un onglet laisse une page
// entierement blanche, sans aucun moyen de s'en sortir hormis un rechargement
// manuel de la page. Ici, on affiche un message et un bouton pour reessayer.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { erreur: null };
  }

  static getDerivedStateFromError(erreur) {
    return { erreur };
  }

  componentDidCatch(erreur, info) {
    console.error('Erreur applicative:', erreur, info);
  }

  render() {
    if (this.state.erreur) {
      return (
        <div className="panel">
          <h2>Une erreur est survenue</h2>
          <p className="erreur">{this.state.erreur.message || String(this.state.erreur)}</p>
          <button onClick={() => this.setState({ erreur: null })}>Reessayer</button>{' '}
          <button className="secondary" onClick={() => window.location.reload()}>
            Recharger la page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
