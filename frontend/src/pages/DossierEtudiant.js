import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const API_URL = 'http://127.0.0.1:8000/api';

const dayOrder = {
  lundi: 1,
  mardi: 2,
  mercredi: 3,
  jeudi: 4,
  vendredi: 5,
  samedi: 6,
};

const niveaux = ['1A', '2A', '3A', '4A', '5A'];

const normalizeText = (value = '') =>
  value
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

function DossierEtudiant() {
  const [etudiants, setEtudiants] = useState([]);
  const [notes, setNotes] = useState([]);
  const [absences, setAbsences] = useState([]);
  const [modules, setModules] = useState([]);
  const [emplois, setEmplois] = useState([]);
  const [groupes, setGroupes] = useState([]);
  const [selectedNiveau, setSelectedNiveau] = useState('1A');
  const [groupeFilter, setGroupeFilter] = useState('');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const navigate = useNavigate();

  const token = localStorage.getItem('access');

  useEffect(() => {
    if (!token) { navigate('/'); return; }
    const headers = { Authorization: `Bearer ${token}` };

    Promise.all([
      axios.get(`${API_URL}/etudiants/`, { headers }),
      axios.get(`${API_URL}/notes/`, { headers }),
      axios.get(`${API_URL}/absences/`, { headers }),
      axios.get(`${API_URL}/modules/`, { headers }),
      axios.get(`${API_URL}/emplois/`, { headers }),
      axios.get(`${API_URL}/groupes/`, { headers }),
    ])
      .then(([etudiantsRes, notesRes, absencesRes, modulesRes, emploisRes, groupesRes]) => {
        setEtudiants(etudiantsRes.data);
        setNotes(notesRes.data);
        setAbsences(absencesRes.data);
        setModules(modulesRes.data);
        setEmplois(emploisRes.data);
        setGroupes(groupesRes.data);
        const firstGroup = groupesRes.data.find((groupe) => groupe.niveau === '1A') || groupesRes.data[0];
        if (firstGroup) setGroupeFilter(String(firstGroup.id));
      })
      .catch(() => navigate('/'));
  }, [navigate, token]);

  const moduleNames = useMemo(
    () => new Map(modules.map((module) => [String(module.id), module.nom])),
    [modules]
  );

  const etudiantsTries = useMemo(
    () => [...etudiants].sort((a, b) =>
      (a.nom || '').localeCompare(b.nom || '') ||
      (a.prenom || '').localeCompare(b.prenom || '') ||
      (a.matricule || '').localeCompare(b.matricule || '')
    ),
    [etudiants]
  );

  const groupesDuNiveau = useMemo(
    () => groupes.filter((groupe) => groupe.niveau === selectedNiveau),
    [groupes, selectedNiveau]
  );

  useEffect(() => {
    if (groupesDuNiveau.length === 0) {
      if (groupeFilter) setGroupeFilter('');
      return;
    }
    const stillExists = groupesDuNiveau.some((groupe) => String(groupe.id) === String(groupeFilter));
    if (!stillExists) {
      setGroupeFilter(String(groupesDuNiveau[0].id));
      setSelectedId('');
      setQuery('');
    }
  }, [groupesDuNiveau, groupeFilter]);

  const selectedGroupe = useMemo(
    () => groupes.find((groupe) => String(groupe.id) === String(groupeFilter)) || null,
    [groupes, groupeFilter]
  );

  const results = useMemo(() => {
    const normalizedQuery = normalizeText(query).trim();
    return etudiantsTries.filter((etudiant) => {
      const matchesGroupe = groupeFilter && String(etudiant.groupe) === String(groupeFilter);
      if (!matchesGroupe) return false;
      if (!normalizedQuery) return true;
      const haystack = [
        etudiant.nom,
        etudiant.prenom,
        etudiant.user_nom,
        etudiant.matricule,
        etudiant.groupe_code,
        etudiant.filiere_code,
        etudiant.filiere_nom,
        etudiant.email,
        etudiant.telephone,
        etudiant.cin,
      ].join(' ');
      return normalizeText(haystack).includes(normalizedQuery);
    });
  }, [query, etudiantsTries, groupeFilter]);

  const selectedStudent = useMemo(
    () => etudiants.find((etudiant) => String(etudiant.id) === String(selectedId)) || null,
    [selectedId, etudiants]
  );

  const studentNotes = useMemo(
    () => selectedStudent
      ? notes
        .filter((note) => String(note.etudiant) === String(selectedStudent.id))
        .sort((a, b) => Number(b.id) - Number(a.id))
      : [],
    [selectedStudent, notes]
  );

  const studentAbsences = useMemo(
    () => selectedStudent
      ? absences
        .filter((absence) => String(absence.etudiant) === String(selectedStudent.id))
        .sort((a, b) => String(b.date).localeCompare(String(a.date)))
      : [],
    [selectedStudent, absences]
  );

  const studentEmploi = useMemo(
    () => selectedStudent
      ? emplois
        .filter((emploi) => String(emploi.groupe) === String(selectedStudent.groupe))
        .sort((a, b) => (dayOrder[a.jour] || 99) - (dayOrder[b.jour] || 99) || a.heure_debut.localeCompare(b.heure_debut))
      : [],
    [selectedStudent, emplois]
  );

  const studentModules = useMemo(() => {
    const list = new Map();
    studentEmploi.forEach((emploi) => {
      list.set(String(emploi.module), emploi.module_nom);
    });
    return Array.from(list.values()).sort((a, b) => a.localeCompare(b));
  }, [studentEmploi]);

  const moyenne = studentNotes.length > 0
    ? (studentNotes.reduce((total, note) => total + Number(note.valeur || 0), 0) / studentNotes.length).toFixed(2)
    : 'N/A';

  const nonJustifiees = studentAbsences.filter((absence) => !absence.justifiee).length;

  const handleSearchSubmit = (event) => {
    event.preventDefault();
    if (results.length > 0) setSelectedId(String(results[0].id));
  };

  const handleQueryChange = (event) => {
    setQuery(event.target.value);
    setSelectedId('');
  };

  const handleNiveauChange = (niveau) => {
    setSelectedNiveau(niveau);
    setSelectedId('');
    setQuery('');
  };

  const handleGroupeChange = (event) => {
    setGroupeFilter(event.target.value);
    setSelectedId('');
    setQuery('');
  };

  return (
    <div className="app-shell">
      <nav className="app-nav">
        <div className="brand">
          <div className="brand-mark">PA</div>
          <div className="brand-text">
            <span className="brand-title">Portail Absences</span>
            <span className="brand-subtitle">Dossier etudiant</span>
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
            <p className="kicker">Recherche admin</p>
            <h1 className="page-title">Dossier complet etudiant</h1>
            <p className="page-description">
              Retrouvez un etudiant puis consultez son profil, ses notes, ses absences et son emploi du temps dans une seule page.
            </p>
          </div>
        </header>

        <section className="dossier-layout">
          <aside className="dossier-sidebar">
            <form className="dossier-search" onSubmit={handleSearchSubmit}>
              <div className="dossier-filter-stack">
                <label className="form-label">Niveau</label>
                <div className="level-filter" aria-label="Filtrer par niveau">
                  {niveaux.map((niveau) => (
                    <button
                      className={selectedNiveau === niveau ? 'active' : ''}
                      key={niveau}
                      onClick={() => handleNiveauChange(niveau)}
                      type="button"
                    >
                      {niveau}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-field">
                <label className="form-label" htmlFor="group-filter">Groupe</label>
                <select
                  id="group-filter"
                  className="form-control"
                  value={groupeFilter}
                  onChange={handleGroupeChange}
                >
                  {groupesDuNiveau.map((groupe) => (
                    <option key={groupe.id} value={groupe.id}>
                      {groupe.code} - {groupe.filiere_code}
                    </option>
                  ))}
                </select>
              </div>

              <label className="form-label" htmlFor="studentSearch">Rechercher</label>
              <input
                id="studentSearch"
                className="form-control"
                type="search"
                value={query}
                onChange={handleQueryChange}
                placeholder="Nom, prenom, matricule..."
              />
              <button className="btn btn-primary btn-full" type="submit" disabled={results.length === 0}>
                Afficher le dossier
              </button>
              <span>
                {selectedGroupe ? `${results.length} etudiant(s) dans ${selectedGroupe.code}` : 'Choisissez un groupe'}
              </span>
            </form>

            <div className="dossier-results">
              {!selectedGroupe && (
                <p className="dossier-empty-hint">Choisissez un niveau puis un groupe.</p>
              )}
              {selectedGroupe && results.length === 0 && (
                <p className="dossier-empty-hint">Aucun etudiant trouve dans ce groupe.</p>
              )}
              {results.slice(0, 18).map((etudiant) => (
                <button
                  className={String(selectedStudent?.id) === String(etudiant.id) ? 'student-result-card active' : 'student-result-card'}
                  key={etudiant.id}
                  type="button"
                  onClick={() => setSelectedId(String(etudiant.id))}
                >
                  <span>
                    <strong>{etudiant.nom} {etudiant.prenom}</strong>
                    <small>{etudiant.matricule || `#${etudiant.id}`} - {etudiant.groupe_code || etudiant.niveau}</small>
                  </span>
                  <em>{etudiant.filiere_code || 'N/A'}</em>
                </button>
              ))}
            </div>
          </aside>

          <section className="dossier-content">
            {!selectedStudent ? (
              <div className="dossier-welcome">
                <span>DOS</span>
                <h2>Choisissez un etudiant</h2>
                <p>
                  Selectionnez un niveau et un groupe. La liste affiche uniquement les etudiants de ce groupe, puis cliquez sur le profil voulu.
                </p>
              </div>
            ) : (
              <>
                <article className="dossier-hero">
                  <div>
                    <span className="eyebrow">Profil selectionne</span>
                    <h2>{selectedStudent.nom} {selectedStudent.prenom}</h2>
                    <p>{selectedStudent.matricule || `#${selectedStudent.id}`} - {selectedStudent.groupe_code} - {selectedStudent.filiere_nom}</p>
                  </div>
                  <div className="dossier-kpis">
                    <span><strong>{moyenne}</strong> moyenne</span>
                    <span><strong>{studentNotes.length}</strong> note(s)</span>
                    <span><strong>{nonJustifiees}</strong> absence(s) non justifiee(s)</span>
                  </div>
                </article>

                <section className="profile-detail-grid admin-profile-grid">
                  <article><span>Telephone</span><strong>{selectedStudent.telephone || '-'}</strong></article>
                  <article><span>Email</span><strong>{selectedStudent.email || '-'}</strong></article>
                  <article><span>CIN</span><strong>{selectedStudent.cin || '-'}</strong></article>
                  <article><span>Adresse</span><strong>{selectedStudent.adresse || '-'}{selectedStudent.ville ? `, ${selectedStudent.ville}` : ''}</strong></article>
                </section>

                <section className="module-strip admin-module-strip">
                  {studentModules.length === 0 ? (
                    <p className="empty-state">Aucun module trouve</p>
                  ) : studentModules.map((module) => (
                    <span className="module-pill" key={module}>{module}</span>
                  ))}
                </section>

                <section className="admin-dossier-grid">
                  <article className="admin-dossier-block">
                    <h3>Notes</h3>
                    <div className="table-wrap">
                      <table className="data-table compact-student-table">
                        <thead>
                          <tr>
                            <th>Module</th>
                            <th>Note</th>
                            <th>Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {studentNotes.length === 0 ? (
                            <tr><td colSpan="3" className="empty-state">Aucune note</td></tr>
                          ) : studentNotes.map((note) => (
                            <tr key={note.id}>
                              <td>{moduleNames.get(String(note.module)) || `Module ${note.module}`}</td>
                              <td className={Number(note.valeur) < 10 ? 'score-danger' : 'score-good'}>{note.valeur}/20</td>
                              <td>{note.date}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </article>

                  <article className="admin-dossier-block">
                    <h3>Absences</h3>
                    <div className="table-wrap">
                      <table className="data-table compact-student-table">
                        <thead>
                          <tr>
                            <th>Module</th>
                            <th>Date</th>
                            <th>Statut</th>
                          </tr>
                        </thead>
                        <tbody>
                          {studentAbsences.length === 0 ? (
                            <tr><td colSpan="3" className="empty-state">Aucune absence</td></tr>
                          ) : studentAbsences.map((absence) => (
                            <tr key={absence.id}>
                              <td>{moduleNames.get(String(absence.module)) || `Module ${absence.module}`}</td>
                              <td>{absence.date}</td>
                              <td><span className={`badge ${absence.justifiee ? 'badge-success' : 'badge-danger'}`}>{absence.justifiee ? 'Justifiee' : 'Non justifiee'}</span></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </article>
                </section>

                <article className="admin-dossier-block admin-timetable-block">
                  <h3>Emploi du temps</h3>
                  <div className="table-wrap">
                    <table className="data-table timetable-table">
                      <thead>
                        <tr>
                          <th>Jour</th>
                          <th>Horaire</th>
                          <th>Module</th>
                          <th>Type</th>
                          <th>Salle</th>
                          <th>Enseignant</th>
                        </tr>
                      </thead>
                      <tbody>
                        {studentEmploi.length === 0 ? (
                          <tr><td colSpan="6" className="empty-state">Aucun emploi du temps</td></tr>
                        ) : studentEmploi.map((emploi) => (
                          <tr key={emploi.id}>
                            <td><strong>{emploi.jour}</strong></td>
                            <td>{emploi.heure_debut.slice(0, 5)} - {emploi.heure_fin.slice(0, 5)}</td>
                            <td>{emploi.module_nom}</td>
                            <td><span className="badge badge-primary">{emploi.type_seance}</span></td>
                            <td>{emploi.salle}</td>
                            <td>{emploi.enseignant}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </article>
              </>
            )}
          </section>
        </section>
      </main>
    </div>
  );
}

export default DossierEtudiant;
