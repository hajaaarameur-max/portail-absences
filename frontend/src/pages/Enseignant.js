import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const API_URL = 'http://127.0.0.1:8000/api';

const normalizeText = (value = '') =>
  value
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

function Enseignant() {
  const [etudiants, setEtudiants] = useState([]);
  const [modules, setModules] = useState([]);
  const [emplois, setEmplois] = useState([]);
  const [groupes, setGroupes] = useState([]);
  const [notes, setNotes] = useState([]);
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [groupeFilter, setGroupeFilter] = useState('');
  const [etudiantId, setEtudiantId] = useState('');
  const [moduleId, setModuleId] = useState('');
  const [valeur, setValeur] = useState('');
  const [date, setDate] = useState('');
  const [justifiee, setJustifiee] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [editingNoteId, setEditingNoteId] = useState('');
  const [editNoteValue, setEditNoteValue] = useState('');
  const [editNoteModuleId, setEditNoteModuleId] = useState('');
  const navigate = useNavigate();

  const token = localStorage.getItem('access');
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    if (!token) { navigate('/'); return; }
    const authHeaders = { Authorization: `Bearer ${token}` };
    Promise.all([
      axios.get(`${API_URL}/etudiants/`, { headers: authHeaders }),
      axios.get(`${API_URL}/modules/`, { headers: authHeaders }),
      axios.get(`${API_URL}/emplois/`, { headers: authHeaders }),
      axios.get(`${API_URL}/groupes/`, { headers: authHeaders }),
      axios.get(`${API_URL}/notes/`, { headers: authHeaders }),
    ]).then(([etudiantsRes, modulesRes, emploisRes, groupesRes, notesRes]) => {
      setEtudiants(etudiantsRes.data);
      setModules(modulesRes.data);
      setEmplois(emploisRes.data);
      setGroupes(groupesRes.data);
      setNotes(notesRes.data);
    });
  }, [navigate, token]);

  const moduleNames = useMemo(
    () => new Map(modules.map((module) => [String(module.id), module.nom])),
    [modules]
  );

  const studentNames = useMemo(
    () => new Map(etudiants.map((etudiant) => [String(etudiant.id), `${etudiant.nom} ${etudiant.prenom}`])),
    [etudiants]
  );

  const etudiantsFiltres = useMemo(() => {
    const query = normalizeText(searchInput || searchTerm).trim();
    return etudiants.filter((etudiant) => {
      const matchesGroupe = !groupeFilter || String(etudiant.groupe) === String(groupeFilter);
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
      ].join(' ');
      const searchableText = normalizeText(haystack);
      return matchesGroupe && (!query || searchableText.includes(query));
    });
  }, [etudiants, searchInput, searchTerm, groupeFilter]);

  const etudiantSelectionne = useMemo(
    () => etudiants.find((etudiant) => String(etudiant.id) === String(etudiantId)) || null,
    [etudiants, etudiantId]
  );

  const modulesDisponibles = useMemo(() => {
    if (!etudiantSelectionne) return [];
    const moduleIds = new Set(
      emplois
        .filter((emploi) => String(emploi.groupe) === String(etudiantSelectionne.groupe))
        .map((emploi) => emploi.module)
    );
    return modules.filter((module) => moduleIds.has(module.id));
  }, [modules, emplois, etudiantSelectionne]);

  const modulesPourEtudiant = (studentId) => {
    const student = etudiants.find((etudiant) => String(etudiant.id) === String(studentId));
    if (!student) return [];
    const moduleIds = new Set(
      emplois
        .filter((emploi) => String(emploi.groupe) === String(student.groupe))
        .map((emploi) => String(emploi.module))
    );
    return modules.filter((module) => moduleIds.has(String(module.id)));
  };

  const notesAffichees = useMemo(() => {
    const filteredStudentIds = new Set(etudiantsFiltres.map((etudiant) => String(etudiant.id)));
    return notes
      .filter((note) => {
        if (etudiantId) return String(note.etudiant) === String(etudiantId);
        return filteredStudentIds.has(String(note.etudiant));
      })
      .sort((a, b) => Number(b.id) - Number(a.id));
  }, [notes, etudiantsFiltres, etudiantId]);

  useEffect(() => {
    if (!moduleId) return;
    const stillAvailable = modulesDisponibles.some((module) => String(module.id) === String(moduleId));
    if (!stillAvailable) setModuleId('');
  }, [modulesDisponibles, moduleId]);

  const ajouterNote = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post(`${API_URL}/notes/`, {
        etudiant: etudiantId,
        module: moduleId,
        valeur,
      }, { headers });
      setNotes((currentNotes) => [response.data, ...currentNotes]);
      setMessage('Note ajoutee avec succes.');
      setMessageType('success');
      setValeur('');
    } catch (err) {
      setMessage("Erreur lors de l'ajout de la note.");
      setMessageType('error');
    }
  };

  const startEditNote = (note) => {
    setEditingNoteId(String(note.id));
    setEditNoteValue(String(note.valeur));
    setEditNoteModuleId(String(note.module));
  };

  const cancelEditNote = () => {
    setEditingNoteId('');
    setEditNoteValue('');
    setEditNoteModuleId('');
  };

  const updateNote = async (note) => {
    try {
      const response = await axios.patch(`${API_URL}/notes/${note.id}/`, {
        module: editNoteModuleId,
        valeur: editNoteValue,
      }, { headers });
      setNotes((currentNotes) => currentNotes.map((item) => (
        String(item.id) === String(note.id) ? response.data : item
      )));
      cancelEditNote();
      setMessage('Note modifiee avec succes.');
      setMessageType('success');
    } catch (err) {
      setMessage("Erreur lors de la modification de la note.");
      setMessageType('error');
    }
  };

  const deleteNote = async (note) => {
    const confirmed = window.confirm('Supprimer cette note ?');
    if (!confirmed) return;

    try {
      await axios.delete(`${API_URL}/notes/${note.id}/`, { headers });
      setNotes((currentNotes) => currentNotes.filter((item) => String(item.id) !== String(note.id)));
      setMessage('Note supprimee avec succes.');
      setMessageType('success');
      if (String(editingNoteId) === String(note.id)) cancelEditNote();
    } catch (err) {
      setMessage("Erreur lors de la suppression de la note.");
      setMessageType('error');
    }
  };

  const ajouterAbsence = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/absences/`, {
        etudiant: etudiantId,
        module: moduleId,
        date,
        justifiee,
      }, { headers });
      setMessage('Absence ajoutee avec succes.');
      setMessageType('success');
      setDate('');
      setJustifiee(false);
    } catch (err) {
      setMessage("Erreur lors de l'ajout de l'absence.");
      setMessageType('error');
    }
  };

  const handleSearch = (event) => {
    event.preventDefault();
    const trimmedSearch = searchInput.trim();
    setSearchTerm(trimmedSearch);

    if (etudiantsFiltres.length === 0) {
      setMessage('Aucun etudiant trouve avec ces criteres.');
      setMessageType('error');
      return;
    }

    if (etudiantsFiltres.length === 1) {
      setEtudiantId(String(etudiantsFiltres[0].id));
      setModuleId('');
      setMessage(`${etudiantsFiltres[0].nom} ${etudiantsFiltres[0].prenom} selectionne(e).`);
    } else {
      setMessage(`${etudiantsFiltres.length} etudiants trouves. Selectionnez un profil dans les resultats.`);
    }
    setMessageType('success');
  };

  const clearFilters = () => {
    setSearchInput('');
    setSearchTerm('');
    setGroupeFilter('');
    setMessage('');
  };

  const selectStudent = (student) => {
    setEtudiantId(String(student.id));
    setModuleId('');
    setMessage(`${student.nom} ${student.prenom} selectionne(e).`);
    setMessageType('success');
  };

  const renderStudentOptions = () => etudiantsFiltres.map((etudiant) => (
    <option key={etudiant.id} value={etudiant.id}>
      {etudiant.nom} {etudiant.prenom} - {etudiant.matricule || `#${etudiant.id}`} - {etudiant.groupe_code || etudiant.niveau}
    </option>
  ));

  return (
    <div className="app-shell">
      <nav className="app-nav">
        <div className="brand">
          <div className="brand-mark">PA</div>
          <div className="brand-text">
            <span className="brand-title">Portail Absences</span>
            <span className="brand-subtitle">Espace enseignant</span>
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
            <p className="kicker">Saisie pedagogique</p>
            <h1 className="page-title">Page enseignant</h1>
            <p className="page-description">
              Les modules proposes changent selon le groupe de l'etudiant selectionne.
            </p>
          </div>
        </header>

        {message && (
          <div className={`alert ${messageType === 'success' ? 'alert-success' : 'alert-danger'}`}>{message}</div>
        )}

        <section className="teacher-search-panel">
          <form className="teacher-search-bar" onSubmit={handleSearch}>
            <div className="form-field">
              <label className="form-label" htmlFor="student-search">Recherche etudiant</label>
              <input
                id="student-search"
                className="form-control"
                type="search"
                placeholder="Nom, prenom, matricule, groupe..."
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
              />
            </div>
            <div className="form-field">
              <label className="form-label" htmlFor="group-filter">Filtrer par groupe</label>
              <select
                id="group-filter"
                className="form-control"
                value={groupeFilter}
                onChange={(event) => setGroupeFilter(event.target.value)}
              >
                <option value="">Tous les groupes</option>
                {groupes.map((groupe) => (
                  <option key={groupe.id} value={groupe.id}>{groupe.code} - {groupe.filiere_code}</option>
                ))}
              </select>
            </div>
            <button className="btn btn-primary" type="submit">Rechercher</button>
            <button className="btn btn-soft" type="button" onClick={clearFilters}>Effacer</button>
          </form>

          <div className="teacher-search-meta">
            <span className="badge badge-primary">{etudiantsFiltres.length} etudiant(s)</span>
            {etudiantSelectionne && (
              <span className="teacher-selected">
                Selection: {etudiantSelectionne.nom} {etudiantSelectionne.prenom} - {etudiantSelectionne.groupe_code}
              </span>
            )}
          </div>

          <div className="teacher-search-results">
            {etudiantsFiltres.slice(0, 10).map((etudiant) => (
              <button
                className={String(etudiant.id) === String(etudiantId) ? 'student-result-card active' : 'student-result-card'}
                key={etudiant.id}
                type="button"
                onClick={() => selectStudent(etudiant)}
              >
                <span>
                  <strong>{etudiant.nom} {etudiant.prenom}</strong>
                  <small>{etudiant.matricule || `#${etudiant.id}`} - {etudiant.groupe_code || etudiant.niveau}</small>
                </span>
                <em>{etudiant.filiere_code || 'N/A'}</em>
              </button>
            ))}
            {etudiantsFiltres.length > 10 && (
              <p className="teacher-results-note">Affichage des 10 premiers resultats. Ajoutez nom, prenom ou matricule pour preciser.</p>
            )}
          </div>
        </section>

        <section className="form-grid teacher-form-grid">
          <article className="form-panel teacher-form-card">
            <div className="form-panel-header primary">
              <h2 className="panel-title">Ajouter une note</h2>
            </div>
            <div className="form-panel-body">
              <form onSubmit={ajouterNote}>
                <div className="form-field">
                  <label className="form-label" htmlFor="note-etudiant">Etudiant</label>
                  <select id="note-etudiant" className="form-control" value={etudiantId} onChange={e => setEtudiantId(e.target.value)} required>
                    <option value="">Choisir un etudiant</option>
                    {renderStudentOptions()}
                  </select>
                </div>

                <div className="form-field">
                  <label className="form-label" htmlFor="note-module">Module du groupe</label>
                  <select id="note-module" className="form-control" value={moduleId} onChange={e => setModuleId(e.target.value)} required disabled={!etudiantSelectionne}>
                    <option value="">{etudiantSelectionne ? 'Choisir un module' : "Choisir d'abord un etudiant"}</option>
                    {modulesDisponibles.map(m => (
                      <option key={m.id} value={m.id}>{m.nom}</option>
                    ))}
                  </select>
                </div>

                <div className="form-field">
                  <label className="form-label" htmlFor="note-valeur">Note sur 20</label>
                  <input
                    id="note-valeur"
                    className="form-control"
                    type="number"
                    placeholder="Ex: 14.5"
                    value={valeur}
                    onChange={e => setValeur(e.target.value)}
                    min="0"
                    max="20"
                    step="0.01"
                    required
                  />
                </div>

                <button className="btn btn-primary btn-full" type="submit">Ajouter la note</button>
              </form>
            </div>
          </article>

          <article className="form-panel teacher-form-card absence-form-card">
            <div className="form-panel-header absence">
              <h2 className="panel-title">Ajouter une absence</h2>
            </div>
            <div className="form-panel-body">
              <form onSubmit={ajouterAbsence}>
                <div className="form-field">
                  <label className="form-label" htmlFor="absence-etudiant">Etudiant</label>
                  <select id="absence-etudiant" className="form-control" value={etudiantId} onChange={e => setEtudiantId(e.target.value)} required>
                    <option value="">Choisir un etudiant</option>
                    {renderStudentOptions()}
                  </select>
                </div>

                <div className="form-field">
                  <label className="form-label" htmlFor="absence-module">Module du groupe</label>
                  <select id="absence-module" className="form-control" value={moduleId} onChange={e => setModuleId(e.target.value)} required disabled={!etudiantSelectionne}>
                    <option value="">{etudiantSelectionne ? 'Choisir un module' : "Choisir d'abord un etudiant"}</option>
                    {modulesDisponibles.map(m => (
                      <option key={m.id} value={m.id}>{m.nom}</option>
                    ))}
                  </select>
                </div>

                <div className="form-field">
                  <label className="form-label" htmlFor="absence-date">Date</label>
                  <input id="absence-date" className="form-control" type="date" value={date} onChange={e => setDate(e.target.value)} required />
                </div>

                <label className="check-row">
                  <input type="checkbox" checked={justifiee} onChange={e => setJustifiee(e.target.checked)} />
                  <span>Absence justifiee</span>
                </label>

                <button className="btn btn-ink btn-full" type="submit">Ajouter l'absence</button>
              </form>
            </div>
          </article>
        </section>

        <section className="panel panel-spaced-lg">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">Voir, modifier et supprimer les notes</h2>
              <p className="panel-subtitle">
                Selectionnez un etudiant ou utilisez la recherche pour filtrer les notes affichees.
              </p>
            </div>
            <span className="badge badge-primary">{notesAffichees.length} note(s)</span>
          </div>
          <div className="table-wrap">
            <table className="data-table teacher-notes-table">
              <thead>
                <tr>
                  <th>Etudiant</th>
                  <th>Module</th>
                  <th>Note</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {notesAffichees.length === 0 ? (
                  <tr><td colSpan="5" className="empty-state">Aucune note trouvee</td></tr>
                ) : notesAffichees.map((note) => {
                  const isEditing = String(editingNoteId) === String(note.id);
                  const editModules = modulesPourEtudiant(note.etudiant);
                  return (
                    <tr key={note.id}>
                      <td><strong>{studentNames.get(String(note.etudiant)) || `Etudiant ${note.etudiant}`}</strong></td>
                      <td>
                        {isEditing ? (
                          <select className="form-control compact-control" value={editNoteModuleId} onChange={(event) => setEditNoteModuleId(event.target.value)}>
                            {editModules.map((module) => (
                              <option key={module.id} value={module.id}>{module.nom}</option>
                            ))}
                          </select>
                        ) : (
                          moduleNames.get(String(note.module)) || `Module ${note.module}`
                        )}
                      </td>
                      <td>
                        {isEditing ? (
                          <input
                            className="form-control compact-control"
                            type="number"
                            min="0"
                            max="20"
                            step="0.01"
                            value={editNoteValue}
                            onChange={(event) => setEditNoteValue(event.target.value)}
                          />
                        ) : (
                          <span className={Number(note.valeur) < 10 ? 'score-danger' : 'score-good'}>{note.valeur}/20</span>
                        )}
                      </td>
                      <td>{note.date}</td>
                      <td>
                        <div className="table-actions">
                          {isEditing ? (
                            <>
                              <button className="btn btn-primary btn-compact" type="button" onClick={() => updateNote(note)}>Enregistrer</button>
                              <button className="btn btn-soft btn-compact" type="button" onClick={cancelEditNote}>Annuler</button>
                            </>
                          ) : (
                            <>
                              <button className="btn btn-soft btn-compact" type="button" onClick={() => startEditNote(note)}>Modifier</button>
                              <button className="btn btn-warning btn-compact" type="button" onClick={() => deleteNote(note)}>Supprimer</button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}

export default Enseignant;
