import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const API_URL = 'http://127.0.0.1:8000/api';

function Profil() {
  const [profil, setProfil] = useState(null);
  const [etudiants, setEtudiants] = useState([]);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const navigate = useNavigate();

  const token = localStorage.getItem('access');
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    if (!token) { navigate('/'); return; }
    const authHeaders = { Authorization: `Bearer ${token}` };
    Promise.all([
      axios.get(`${API_URL}/profil/`, { headers: authHeaders }),
      axios.get(`${API_URL}/etudiants/`, { headers: authHeaders }),
    ])
      .then(([profilRes, etudiantsRes]) => {
        setProfil(profilRes.data);
        setEtudiants(etudiantsRes.data);
        setFirstName(profilRes.data.first_name);
        setLastName(profilRes.data.last_name);
        setEmail(profilRes.data.email);
      })
      .catch(() => navigate('/'));
  }, [navigate, token]);

  const etudiant = useMemo(() => {
    if (!profil) return null;
    return etudiants.find((item) => item.user === profil.id) || null;
  }, [etudiants, profil]);

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      await axios.put(`${API_URL}/profil/`, {
        first_name: firstName,
        last_name: lastName,
        email,
      }, { headers });
      setMessage('Profil mis a jour avec succes.');
      setMessageType('success');
    } catch (err) {
      setMessage('Erreur lors de la mise a jour.');
      setMessageType('error');
    }
  };

  if (!profil) {
    return (
      <div className="app-shell">
        <main className="page page-narrow">
          <p className="empty-state">Chargement...</p>
        </main>
      </div>
    );
  }

  const initials = `${profil.first_name?.charAt(0) || ''}${profil.last_name?.charAt(0) || ''}` || 'PR';

  return (
    <div className="app-shell">
      <nav className="app-nav">
        <div className="brand">
          <div className="brand-mark">PA</div>
          <div className="brand-text">
            <span className="brand-title">Portail Absences</span>
            <span className="brand-subtitle">Profil</span>
          </div>
        </div>
        <div className="nav-actions">
          <button className="btn btn-soft" onClick={() => navigate('/dashboard')}>Dashboard</button>
          <button className="btn btn-accent" onClick={() => { localStorage.clear(); navigate('/'); }}>Deconnexion</button>
        </div>
      </nav>

      <main className="page page-wide">
        <header className="page-header">
          <div>
            <p className="kicker">Compte utilisateur</p>
            <h1 className="page-title">Mon profil</h1>
            <p className="page-description">Fiche personnelle avec les informations administratives de l'etudiant.</p>
          </div>
        </header>

        <section className="profile-card">
          <div className="profile-identity">
            <div className="avatar">{initials.toUpperCase()}</div>
            <div>
              <h2 className="profile-name">{profil.first_name} {profil.last_name}</h2>
              <span className="badge badge-primary">{profil.role}</span>
              {etudiant && <span className="badge badge-success">{etudiant.groupe_code}</span>}
            </div>
          </div>

          {etudiant && (
            <div className="profile-detail-grid">
              <article>
                <span>Matricule</span>
                <strong>{etudiant.matricule || '-'}</strong>
              </article>
              <article>
                <span>Nom</span>
                <strong>{etudiant.nom || '-'}</strong>
              </article>
              <article>
                <span>Prenom</span>
                <strong>{etudiant.prenom || '-'}</strong>
              </article>
              <article>
                <span>Groupe</span>
                <strong>{etudiant.groupe_code || '-'}</strong>
              </article>
              <article>
                <span>Filiere</span>
                <strong>{etudiant.filiere_nom || '-'}</strong>
              </article>
              <article>
                <span>Telephone</span>
                <strong>{etudiant.telephone || '-'}</strong>
              </article>
              <article>
                <span>CIN</span>
                <strong>{etudiant.cin || '-'}</strong>
              </article>
              <article>
                <span>Adresse</span>
                <strong>{etudiant.adresse || '-'}{etudiant.ville ? `, ${etudiant.ville}` : ''}</strong>
              </article>
            </div>
          )}

          {message && (
            <div className={`alert ${messageType === 'success' ? 'alert-success' : 'alert-danger'}`}>{message}</div>
          )}

          <form onSubmit={handleUpdate}>
            <div className="form-field">
              <label className="form-label" htmlFor="firstName">Prenom</label>
              <input id="firstName" className="form-control" type="text" value={firstName} onChange={e => setFirstName(e.target.value)} />
            </div>
            <div className="form-field">
              <label className="form-label" htmlFor="lastName">Nom</label>
              <input id="lastName" className="form-control" type="text" value={lastName} onChange={e => setLastName(e.target.value)} />
            </div>
            <div className="form-field">
              <label className="form-label" htmlFor="email">Email</label>
              <input id="email" className="form-control" type="email" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div className="form-field">
              <label className="form-label" htmlFor="username">Nom d'utilisateur</label>
              <input id="username" className="form-control" type="text" value={profil.username} disabled />
            </div>
            <button className="btn btn-primary btn-full" type="submit">Sauvegarder</button>
          </form>
        </section>
      </main>
    </div>
  );
}

export default Profil;
