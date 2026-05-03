import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const API_URL = 'http://127.0.0.1:8000/api';

const cycleLabels = {
  preparatoire: 'Cycle preparatoire',
  ingenieur: 'Cycle ingenieur',
  master: 'Cycle master',
};

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

function Dashboard() {
  const [etudiants, setEtudiants] = useState([]);
  const [notes, setNotes] = useState([]);
  const [absences, setAbsences] = useState([]);
  const [modules, setModules] = useState([]);
  const [parcours, setParcours] = useState([]);
  const [emplois, setEmplois] = useState([]);
  const [groupes, setGroupes] = useState([]);
  const [selectedNiveau, setSelectedNiveau] = useState('1A');
  const [selectedGroupeId, setSelectedGroupeId] = useState('');
  const [adminStudentQuery, setAdminStudentQuery] = useState('');
  const [adminStudentId, setAdminStudentId] = useState('');
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
      axios.get(`${API_URL}/parcours/`, { headers }),
      axios.get(`${API_URL}/emplois/`, { headers }),
      axios.get(`${API_URL}/groupes/`, { headers }),
    ])
      .then(([etudiantsRes, notesRes, absencesRes, modulesRes, parcoursRes, emploisRes, groupesRes]) => {
        setEtudiants(etudiantsRes.data);
        setNotes(notesRes.data);
        setAbsences(absencesRes.data);
        setModules(modulesRes.data);
        setParcours(parcoursRes.data);
        setEmplois(emploisRes.data);
        setGroupes(groupesRes.data);
        if (etudiantsRes.data.length > 0) setAdminStudentId(String(etudiantsRes.data[0].id));
        const firstGroup = groupesRes.data.find((groupe) => groupe.niveau === '1A') || groupesRes.data[0];
        if (firstGroup) setSelectedGroupeId(String(firstGroup.id));
      })
      .catch(() => navigate('/'));
  }, [navigate, token]);

  const handleLogout = () => { localStorage.clear(); navigate('/'); };

  const groupesDuNiveau = useMemo(
    () => groupes.filter((groupe) => groupe.niveau === selectedNiveau),
    [groupes, selectedNiveau]
  );

  const moduleNames = useMemo(
    () => new Map(modules.map((module) => [String(module.id), module.nom])),
    [modules]
  );

  useEffect(() => {
    if (groupesDuNiveau.length === 0) return;
    const stillExists = groupesDuNiveau.some((groupe) => String(groupe.id) === String(selectedGroupeId));
    if (!stillExists) setSelectedGroupeId(String(groupesDuNiveau[0].id));
  }, [groupesDuNiveau, selectedGroupeId]);

  const selectedGroupe = useMemo(
    () => groupes.find((groupe) => String(groupe.id) === String(selectedGroupeId)) || null,
    [groupes, selectedGroupeId]
  );

  const emploisFiltres = useMemo(
    () => emplois
      .filter((emploi) => String(emploi.groupe) === String(selectedGroupeId))
      .sort((a, b) => (dayOrder[a.jour] || 99) - (dayOrder[b.jour] || 99) || a.heure_debut.localeCompare(b.heure_debut)),
    [emplois, selectedGroupeId]
  );

  const modulesGroupe = useMemo(() => {
    const modules = new Map();
    emploisFiltres.forEach((emploi) => {
      modules.set(emploi.module, {
        id: emploi.module,
        nom: emploi.module_nom,
        type: emploi.type_seance,
      });
    });
    return Array.from(modules.values()).sort((a, b) => a.nom.localeCompare(b.nom));
  }, [emploisFiltres]);

  const etudiantsTries = useMemo(
    () => [...etudiants].sort((a, b) =>
      (a.nom || '').localeCompare(b.nom || '') ||
      (a.prenom || '').localeCompare(b.prenom || '') ||
      (a.matricule || '').localeCompare(b.matricule || '')
    ),
    [etudiants]
  );

  const etudiantsGroupe = useMemo(
    () => etudiantsTries.filter((etudiant) => String(etudiant.groupe) === String(selectedGroupeId)),
    [etudiantsTries, selectedGroupeId]
  );

  const etudiantsParAnnee = useMemo(
    () => niveaux.map((niveau) => {
      const groupesNiveau = groupes
        .filter((groupe) => groupe.niveau === niveau)
        .sort((a, b) => (a.filiere_code || '').localeCompare(b.filiere_code || '') || a.code.localeCompare(b.code))
        .map((groupe) => ({
          ...groupe,
          etudiants: etudiantsTries.filter((etudiant) => String(etudiant.groupe) === String(groupe.id)),
        }));

      return {
        niveau,
        groupes: groupesNiveau,
        totalEtudiants: groupesNiveau.reduce((total, groupe) => total + groupe.etudiants.length, 0),
      };
    }),
    [etudiantsTries, groupes]
  );

  const adminStudentResults = useMemo(() => {
    const query = normalizeText(adminStudentQuery).trim();
    return etudiantsTries.filter((etudiant) => {
      if (!query) return true;
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
      return normalizeText(haystack).includes(query);
    });
  }, [adminStudentQuery, etudiantsTries]);

  const adminSelectedStudent = useMemo(
    () => etudiants.find((etudiant) => String(etudiant.id) === String(adminStudentId)) || adminStudentResults[0] || null,
    [adminStudentId, adminStudentResults, etudiants]
  );

  const adminStudentNotes = useMemo(
    () => adminSelectedStudent
      ? notes.filter((note) => String(note.etudiant) === String(adminSelectedStudent.id)).sort((a, b) => Number(b.id) - Number(a.id))
      : [],
    [adminSelectedStudent, notes]
  );

  const adminStudentAbsences = useMemo(
    () => adminSelectedStudent
      ? absences.filter((absence) => String(absence.etudiant) === String(adminSelectedStudent.id)).sort((a, b) => String(b.date).localeCompare(String(a.date)))
      : [],
    [adminSelectedStudent, absences]
  );

  const adminStudentEmploi = useMemo(
    () => adminSelectedStudent
      ? emplois
        .filter((emploi) => String(emploi.groupe) === String(adminSelectedStudent.groupe))
        .sort((a, b) => (dayOrder[a.jour] || 99) - (dayOrder[b.jour] || 99) || a.heure_debut.localeCompare(b.heure_debut))
      : [],
    [adminSelectedStudent, emplois]
  );

  const adminStudentModules = useMemo(() => {
    const list = new Map();
    adminStudentEmploi.forEach((emploi) => {
      list.set(String(emploi.module), emploi.module_nom);
    });
    return Array.from(list.values()).sort((a, b) => a.localeCompare(b));
  }, [adminStudentEmploi]);

  const adminStudentAverage = adminStudentNotes.length > 0
    ? (adminStudentNotes.reduce((total, note) => total + Number(note.valeur || 0), 0) / adminStudentNotes.length).toFixed(2)
    : 'N/A';

  const navItems = [
    { label: 'Espace enseignant', note: 'Notes et absences', path: '/enseignant', tone: 'primary', code: 'EN' },
    { label: 'Espace etudiant', note: 'Resultats personnels', path: '/etudiant', tone: 'accent', code: 'ET' },
    { label: 'Analyse IA', note: 'Risques academiques', path: '/analyse', tone: 'warning', code: 'IA' },
    { label: 'Centre IA', note: 'Chatbot, QR, carte et ranking', path: '/intelligence', tone: 'primary', code: 'AI' },
    { label: 'Graphiques', note: 'Visualisation des donnees', path: '/graphiques', tone: 'primary', code: 'GR' },
    { label: 'Export PDF', note: 'Rapports imprimables', path: '/export', tone: 'accent', code: 'PDF' },
    { label: 'Profil', note: 'Informations du compte', path: '/profil', tone: 'warning', code: 'PR' },
  ];

  return (
    <div className="app-shell">
      <nav className="app-nav">
        <div className="brand">
          <div className="brand-mark">PA</div>
          <div className="brand-text">
            <span className="brand-title">Portail Absences</span>
            <span className="brand-subtitle">Administration EMSI</span>
          </div>
        </div>
        <div className="nav-actions">
          <span className="badge badge-primary">Admin</span>
          <button className="btn btn-accent" onClick={handleLogout}>Deconnexion</button>
        </div>
      </nav>

      <main className="page page-wide">
        <header className="page-header">
          <div>
            <p className="kicker">Vue globale</p>
            <h1 className="page-title">Dashboard academique</h1>
            <p className="page-description">
              Organisation par groupes, modules reels par niveau et emploi du temps propre a chaque groupe.
            </p>
          </div>
        </header>

        <section className="stats-grid dashboard-stats" aria-label="Statistiques generales">
          <article className="stat-card">
            <div className="icon-tile">ET</div>
            <div>
              <div className="stat-value">{etudiants.length}</div>
              <p className="stat-label">Etudiants</p>
            </div>
          </article>
          <article className="stat-card success">
            <div className="icon-tile">GR</div>
            <div>
              <div className="stat-value">{groupes.length}</div>
              <p className="stat-label">Groupes</p>
            </div>
          </article>
          <article className="stat-card accent">
            <div className="icon-tile">NT</div>
            <div>
              <div className="stat-value">{notes.length}</div>
              <p className="stat-label">Notes enregistrees</p>
            </div>
          </article>
          <article className="stat-card warning">
            <div className="icon-tile">EDT</div>
            <div>
              <div className="stat-value">{emplois.length}</div>
              <p className="stat-label">Seances planifiees</p>
            </div>
          </article>
        </section>

        <section>
          <div className="section-title">
            <h2>Navigation rapide</h2>
          </div>
          <div className="action-grid">
            {navItems.map((item) => (
              <button key={item.path} className={`quick-action ${item.tone}`} onClick={() => navigate(item.path)}>
                <span>
                  <span className="quick-action-label">{item.label}</span>
                  <span className="quick-action-note">{item.note}</span>
                </span>
                <span className="quick-action-code">{item.code}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="panel panel-spaced-lg admin-student-panel">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">Dossier complet etudiant</h2>
              <p className="panel-subtitle">
                Recherche admin: profil, filiere, modules, notes, absences et emploi du temps d'un etudiant.
              </p>
            </div>
            <span className="badge badge-primary">{adminStudentResults.length} resultat(s)</span>
          </div>

          <div className="admin-student-search">
            <input
              className="form-control"
              type="search"
              value={adminStudentQuery}
              onChange={(event) => setAdminStudentQuery(event.target.value)}
              placeholder="Nom, prenom, matricule, groupe, filiere..."
            />
            <div className="admin-student-results">
              {adminStudentResults.slice(0, 8).map((etudiant) => (
                <button
                  className={String(adminSelectedStudent?.id) === String(etudiant.id) ? 'student-result-card active' : 'student-result-card'}
                  key={etudiant.id}
                  type="button"
                  onClick={() => setAdminStudentId(String(etudiant.id))}
                >
                  <span>
                    <strong>{etudiant.nom} {etudiant.prenom}</strong>
                    <small>{etudiant.matricule || `#${etudiant.id}`} - {etudiant.groupe_code || etudiant.niveau}</small>
                  </span>
                  <em>{etudiant.filiere_code || 'N/A'}</em>
                </button>
              ))}
            </div>
          </div>

          {adminSelectedStudent && (
            <div className="admin-student-dossier">
              <div className="admin-student-hero">
                <div>
                  <span className="eyebrow">Profil selectionne</span>
                  <h3>{adminSelectedStudent.nom} {adminSelectedStudent.prenom}</h3>
                  <p>{adminSelectedStudent.matricule} - {adminSelectedStudent.groupe_code} - {adminSelectedStudent.filiere_nom}</p>
                </div>
                <div className="admin-student-kpis">
                  <span>{adminStudentAverage}/20 moyenne</span>
                  <span>{adminStudentNotes.length} note(s)</span>
                  <span>{adminStudentAbsences.length} absence(s)</span>
                </div>
              </div>

              <div className="profile-detail-grid admin-profile-grid">
                <article><span>Telephone</span><strong>{adminSelectedStudent.telephone || '-'}</strong></article>
                <article><span>Email</span><strong>{adminSelectedStudent.email || '-'}</strong></article>
                <article><span>CIN</span><strong>{adminSelectedStudent.cin || '-'}</strong></article>
                <article><span>Adresse</span><strong>{adminSelectedStudent.adresse || '-'}{adminSelectedStudent.ville ? `, ${adminSelectedStudent.ville}` : ''}</strong></article>
              </div>

              <div className="module-strip admin-module-strip">
                {adminStudentModules.map((module) => (
                  <span className="module-pill" key={module}>{module}</span>
                ))}
              </div>

              <div className="admin-dossier-grid">
                <article className="admin-dossier-block">
                  <h4>Notes</h4>
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
                        {adminStudentNotes.length === 0 ? (
                          <tr><td colSpan="3" className="empty-state">Aucune note</td></tr>
                        ) : adminStudentNotes.map((note) => (
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
                  <h4>Absences</h4>
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
                        {adminStudentAbsences.length === 0 ? (
                          <tr><td colSpan="3" className="empty-state">Aucune absence</td></tr>
                        ) : adminStudentAbsences.map((absence) => (
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
              </div>

              <article className="admin-dossier-block admin-timetable-block">
                <h4>Emploi du temps</h4>
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
                      {adminStudentEmploi.length === 0 ? (
                        <tr><td colSpan="6" className="empty-state">Aucun emploi du temps</td></tr>
                      ) : adminStudentEmploi.map((emploi) => (
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
            </div>
          )}
        </section>

        <section className="panel panel-spaced-lg">
          <div className="panel-header">
            <h2 className="panel-title">Parcours EMSI en 5 ans</h2>
            <span className="badge badge-primary">Groupes par niveau</span>
          </div>
          <div className="academic-roadmap">
            {parcours.map((annee) => (
              <article className="roadmap-card" key={annee.niveau}>
                <div className="roadmap-year">{annee.niveau}</div>
                <div>
                  <h3>{annee.titre}</h3>
                  <p>{cycleLabels[annee.cycle] || annee.cycle}</p>
                </div>
                <div className="roadmap-meta">
                  <span>{annee.nombre_etudiants} etudiant(s)</span>
                  <span>{annee.nombre_groupes || 0} groupe(s)</span>
                </div>
                <div className="filiere-chip-list">
                  {annee.filieres.flatMap((filiere) =>
                    filiere.groupes.map((groupe) => (
                      <span className="filiere-chip" title={filiere.nom} key={groupe.id}>
                        {groupe.code}
                      </span>
                    ))
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="panel panel-spaced-lg">
          <div className="panel-header timetable-header">
            <div>
              <h2 className="panel-title">Emploi du temps par groupe</h2>
              <p className="panel-subtitle">
                Selectionne un niveau puis un groupe pour voir uniquement ses modules et ses seances.
              </p>
            </div>
            <div className="timetable-controls">
              <div className="level-filter" aria-label="Filtrer par niveau">
                {niveaux.map((niveau) => (
                  <button
                    className={selectedNiveau === niveau ? 'active' : ''}
                    key={niveau}
                    onClick={() => setSelectedNiveau(niveau)}
                    type="button"
                  >
                    {niveau}
                  </button>
                ))}
              </div>
              <select className="form-control group-select" value={selectedGroupeId} onChange={(e) => setSelectedGroupeId(e.target.value)}>
                {groupesDuNiveau.map((groupe) => (
                  <option key={groupe.id} value={groupe.id}>{groupe.code} - {groupe.filiere_code}</option>
                ))}
              </select>
            </div>
          </div>

          {selectedGroupe && (
            <div className="group-summary">
              <div>
                <span className="eyebrow">Groupe selectionne</span>
                <h3>{selectedGroupe.code}</h3>
                <p>{selectedGroupe.filiere_nom} - {cycleLabels[selectedGroupe.cycle] || selectedGroupe.cycle}</p>
              </div>
              <span className="badge badge-success">{etudiantsGroupe.length} etudiant(s)</span>
            </div>
          )}

          <div className="module-strip">
            {modulesGroupe.length === 0 ? (
              <p className="empty-state">Aucun module pour ce groupe</p>
            ) : modulesGroupe.map((module) => (
              <span className="module-pill" key={module.id}>{module.nom}</span>
            ))}
          </div>

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
                {emploisFiltres.length === 0 ? (
                  <tr><td colSpan="6" className="empty-state">Aucun emploi du temps disponible</td></tr>
                ) : emploisFiltres.map((emploi) => (
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
        </section>

        <section className="panel panel-spaced-lg">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">Etudiants organises par annee et groupe</h2>
              <p className="panel-subtitle">
                Chaque tableau affiche uniquement les etudiants inscrits dans le groupe et la filiere correspondants.
              </p>
            </div>
            <span className="badge badge-primary">{etudiantsTries.length} etudiants</span>
          </div>
          <div className="student-directory">
            {etudiantsParAnnee.map((annee) => (
              <section className="year-directory" key={annee.niveau}>
                <div className="year-directory-header">
                  <div>
                    <span className="eyebrow">Annee academique</span>
                    <h3>{annee.niveau}</h3>
                  </div>
                  <div className="year-directory-meta">
                    <span>{annee.groupes.length} groupe(s)</span>
                    <span>{annee.totalEtudiants} etudiant(s)</span>
                  </div>
                </div>

                <div className="group-table-grid">
                  {annee.groupes.map((groupe) => (
                    <article className="group-table-block" key={groupe.id}>
                      <div className="group-table-header">
                        <div>
                          <h4>{groupe.code}</h4>
                          <p>{groupe.filiere_nom}</p>
                        </div>
                        <span className="badge badge-success">{groupe.etudiants.length} etudiant(s)</span>
                      </div>
                      <div className="table-wrap compact-table-wrap">
                        <table className="data-table compact-student-table">
                          <thead>
                            <tr>
                              <th>Matricule</th>
                              <th>Nom</th>
                              <th>Prenom</th>
                              <th>Telephone</th>
                              <th>Adresse</th>
                            </tr>
                          </thead>
                          <tbody>
                            {groupe.etudiants.length === 0 ? (
                              <tr>
                                <td colSpan="5" className="empty-state">Aucun etudiant dans ce groupe</td>
                              </tr>
                            ) : (
                              groupe.etudiants.map((etudiant) => (
                                <tr key={etudiant.id}>
                                  <td><strong>{etudiant.matricule || `#${etudiant.id}`}</strong></td>
                                  <td>{etudiant.nom || '-'}</td>
                                  <td>{etudiant.prenom || '-'}</td>
                                  <td>{etudiant.telephone || '-'}</td>
                                  <td>{etudiant.adresse || '-'}{etudiant.ville ? `, ${etudiant.ville}` : ''}</td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

export default Dashboard;
