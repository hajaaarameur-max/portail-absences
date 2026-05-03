import React, { useState } from 'react';
import axios from 'axios';

function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const redirectByRole = (role) => {
    if (role === 'admin') window.location.href = '/dashboard';
    else if (role === 'enseignant') window.location.href = '/enseignant';
    else if (role === 'etudiant') window.location.href = '/etudiant';
    else window.location.href = '/dashboard';
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await axios.post('http://127.0.0.1:8000/api/login/', {
        username,
        password,
      });

      localStorage.setItem('access', response.data.access);
      localStorage.setItem('refresh', response.data.refresh);

      const roleRes = await axios.get('http://127.0.0.1:8000/api/role/', {
        headers: { Authorization: `Bearer ${response.data.access}` },
      });

      redirectByRole(roleRes.data.role);
    } catch (err) {
      setError("Nom d'utilisateur ou mot de passe incorrect");
      setLoading(false);
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-card" aria-label="Connexion au portail">
        <div className="auth-brand">
          <div className="brand-mark">PA</div>
          <h1 className="auth-title">Portail Absences</h1>
          <p className="auth-subtitle">Connectez-vous pour retrouver votre espace.</p>
        </div>

        {error && <div className="alert alert-danger">{error}</div>}

        <form onSubmit={handleLogin}>
          <div className="form-field">
            <label className="form-label" htmlFor="username">Nom d'utilisateur</label>
            <input
              id="username"
              className="form-control"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Votre identifiant"
              autoComplete="username"
              required
            />
          </div>

          <div className="form-field">
            <label className="form-label" htmlFor="password">Mot de passe</label>
            <input
              id="password"
              className="form-control"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Votre mot de passe"
              autoComplete="current-password"
              required
            />
          </div>

          <button className="btn btn-primary btn-full" type="submit" disabled={loading}>
            {loading ? 'Connexion en cours...' : 'Se connecter'}
          </button>
        </form>

        <p className="auth-footer">(c) 2026 Portail Absences. Tous droits reserves.</p>
      </section>
    </main>
  );
}

export default Login;
