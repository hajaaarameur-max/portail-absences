import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const API_URL = 'http://127.0.0.1:8000/api';

function Analyse() {
  const [risques, setRisques] = useState([]);
  const navigate = useNavigate();

  const token = localStorage.getItem('access');

  useEffect(() => {
    if (!token) { navigate('/'); return; }
    const authHeaders = { Authorization: `Bearer ${token}` };
    Promise.all([
      axios.get(`${API_URL}/etudiants/`, { headers: authHeaders }),
      axios.get(`${API_URL}/notes/`, { headers: authHeaders }),
      axios.get(`${API_URL}/absences/`, { headers: authHeaders }),
    ]).then(([resEtudiants, resNotes, resAbsences]) => {
      analyser(resEtudiants.data, resNotes.data, resAbsences.data);
    });
  }, [navigate, token]);

  const analyser = (etudiantsData, notesData, absencesData) => {
    const resultats = etudiantsData.map((etudiant) => {
      const notesEtudiant = notesData.filter((note) => note.etudiant === etudiant.id);
      const absencesEtudiant = absencesData.filter((absence) => absence.etudiant === etudiant.id);
      const absencesNonJustifiees = absencesEtudiant.filter((absence) => !absence.justifiee).length;

      const moyenne = notesEtudiant.length > 0
        ? notesEtudiant.reduce((acc, note) => acc + Number(note.valeur || 0), 0) / notesEtudiant.length
        : null;

      const risqueAcademique = moyenne !== null && moyenne < 10;
      const risqueAssiduite = absencesNonJustifiees >= 2 || absencesEtudiant.length > 3;
      const estARisque = risqueAcademique || risqueAssiduite;

      return {
        id: etudiant.id,
        matricule: etudiant.matricule,
        nom: etudiant.nom,
        prenom: etudiant.prenom,
        groupe: etudiant.groupe_code,
        niveau: etudiant.niveau,
        moyenne,
        nbAbsences: absencesEtudiant.length,
        absencesNonJustifiees,
        risqueAcademique,
        risqueAssiduite,
        estARisque,
      };
    });

    setRisques(resultats);
  };

  const envoyerAlertes = async () => {
    try {
      await axios.post(`${API_URL}/alertes/`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      alert('Alertes envoyees avec succes.');
    } catch (err) {
      alert("Erreur lors de l'envoi des alertes.");
    }
  };

  const risquesTries = useMemo(
    () => [...risques].sort((a, b) =>
      (a.nom || '').localeCompare(b.nom || '') ||
      (a.prenom || '').localeCompare(b.prenom || '')
    ),
    [risques]
  );

  const aRisque = risquesTries.filter((risque) => risque.estARisque);
  const normal = risquesTries.filter((risque) => !risque.estARisque);

  const formatMoyenne = (moyenne) => moyenne === null ? 'N/A' : `${moyenne.toFixed(2)}/20`;

  return (
    <div className="app-shell">
      <nav className="app-nav">
        <div className="brand">
          <div className="brand-mark">PA</div>
          <div className="brand-text">
            <span className="brand-title">Portail Absences</span>
            <span className="brand-subtitle">Analyse IA</span>
          </div>
        </div>
        <div className="nav-actions">
          <button className="btn btn-soft" onClick={() => navigate('/dashboard')}>Dashboard</button>
          <button className="btn btn-warning" onClick={envoyerAlertes}>Envoyer alertes</button>
          <button className="btn btn-accent" onClick={() => { localStorage.clear(); navigate('/'); }}>Deconnexion</button>
        </div>
      </nav>

      <main className="page page-wide">
        <header className="page-header">
          <div>
            <p className="kicker">Detection des risques</p>
            <h1 className="page-title">Analyse des risques</h1>
            <p className="page-description">
              Identifiez les etudiants qui demandent une attention particuliere selon les notes et l'assiduite.
            </p>
          </div>
        </header>

        <section className="stats-grid" aria-label="Resume des risques">
          <article className="stat-card success">
            <div className="icon-tile">OK</div>
            <div>
              <div className="stat-value">{normal.length}</div>
              <p className="stat-label">Etudiants OK</p>
            </div>
          </article>
          <article className="stat-card accent">
            <div className="icon-tile">AR</div>
            <div>
              <div className="stat-value">{aRisque.length}</div>
              <p className="stat-label">Etudiants a risque</p>
            </div>
          </article>
          <article className="stat-card">
            <div className="icon-tile">TO</div>
            <div>
              <div className="stat-value">{risques.length}</div>
              <p className="stat-label">Total etudiants</p>
            </div>
          </article>
        </section>

        <section className="panel">
          <div className="panel-header">
            <h2 className="panel-title risk-title">Etudiants a risque</h2>
            <span className="badge badge-danger">{aRisque.length} profils</span>
          </div>
          {aRisque.length === 0 ? (
            <p className="empty-state">Aucun etudiant a risque.</p>
          ) : (
            <div className="table-wrap">
              <table className="data-table analysis-table">
                <thead>
                  <tr>
                    <th>Matricule</th>
                    <th>Nom</th>
                    <th>Groupe</th>
                    <th>Moyenne</th>
                    <th>Absences</th>
                    <th>Risque</th>
                  </tr>
                </thead>
                <tbody>
                  {aRisque.map((risque) => (
                    <tr key={risque.id}>
                      <td><strong>{risque.matricule || `#${risque.id}`}</strong></td>
                      <td>{risque.nom} {risque.prenom}</td>
                      <td>{risque.groupe || risque.niveau}</td>
                      <td className="score-danger">{formatMoyenne(risque.moyenne)}</td>
                      <td className="score-danger">
                        {risque.nbAbsences} dont {risque.absencesNonJustifiees} non justifiee(s)
                      </td>
                      <td>
                        {risque.risqueAcademique && <span className="badge badge-danger">Academique</span>}
                        {risque.risqueAssiduite && <span className="badge badge-warning">Assiduite</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="panel panel-spaced">
          <div className="panel-header">
            <h2 className="panel-title ok-title">Etudiants OK</h2>
            <span className="badge badge-success">{normal.length} profils</span>
          </div>
          <div className="table-wrap">
            <table className="data-table analysis-table">
              <thead>
                <tr>
                  <th>Matricule</th>
                  <th>Nom</th>
                  <th>Groupe</th>
                  <th>Moyenne</th>
                  <th>Absences</th>
                </tr>
              </thead>
              <tbody>
                {normal.length === 0 ? (
                  <tr><td colSpan="5" className="empty-state">Aucun etudiant dans cette categorie</td></tr>
                ) : normal.map((risque) => (
                  <tr key={risque.id}>
                    <td><strong>{risque.matricule || `#${risque.id}`}</strong></td>
                    <td>{risque.nom} {risque.prenom}</td>
                    <td>{risque.groupe || risque.niveau}</td>
                    <td className="score-good">{formatMoyenne(risque.moyenne)}</td>
                    <td>{risque.nbAbsences}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}

export default Analyse;
