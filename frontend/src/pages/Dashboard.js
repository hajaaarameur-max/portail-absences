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
  const [parcours, setParcours] = useState([]);
  const [emplois, setEmplois] = useState([]);
  const [groupes, setGroupes] = useState([]);
  const [selectedNiveau, setSelectedNiveau] = useState('1A');
  const [selectedGroupeId, setSelectedGroupeId] = useState('');
  const [studentQuery, setStudentQuery] = useState('');
  const navigate = useNavigate();

  const token = localStorage.getItem('access');

  useEffect(() => {
    if (!token) { navigate('/'); return; }
    const headers = { Authorization: `Bearer ${token}` };

    Promise.all([
      axios.get(`${API_URL}/etudiants/`, { headers }),
      axios.get(`${API_URL}/notes/`, { headers }),
      axios.get(`${API_URL}/parcours/`, { headers }),
      axios.get(`${API_URL}/emplois/`, { headers }),
      axios.get(`${API_URL}/groupes/`, { headers }),
    ])
      .then(([etudiantsRes, notesRes, parcoursRes, emploisRes, groupesRes]) => {
        setEtudiants(etudiantsRes.data);
        setNotes(notesRes.data);
        setParcours(parcoursRes.data);
        setEmplois(emploisRes.data);
        setGroupes(groupesRes.data);
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

  const etudiantsGroupeFiltres = useMemo(
    () => {
      const query = normalizeText(studentQuery).trim();
      if (!query) return etudiantsGroupe;
      return etudiantsGroupe.filter((etudiant) => {
        const haystack = [
          etudiant.nom,
          etudiant.prenom,
          etudiant.user_nom,
          etudiant.matricule,
          etudiant.telephone,
          etudiant.email,
          etudiant.cin,
        ].join(' ');
        return normalizeText(haystack).includes(query);
      });
    },
    [etudiantsGroupe, studentQuery]
  );

  const navItems = [
    { label: 'Espace enseignant', note: 'Notes et absences', path: '/enseignant', tone: 'primary', code: 'EN' },
    { label: 'Espace etudiant', note: 'Resultats personnels', path: '/etudiant', tone: 'accent', code: 'ET' },
    { label: 'Dossier etudiant', note: 'Recherche admin complete', path: '/dossier-etudiant', tone: 'primary', code: 'DOS' },
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
              <h2 className="panel-title">Etudiants par groupe</h2>
              <p className="panel-subtitle">
                Filtre simple par niveau, groupe et recherche. Le tableau affiche uniquement le groupe selectionne.
              </p>
            </div>
            <span className="badge badge-primary">{etudiantsGroupeFiltres.length} resultat(s)</span>
          </div>

          <div className="student-filter-panel">
            <div className="filter-block">
              <label className="form-label">Niveau</label>
              <div className="level-filter" aria-label="Filtrer les etudiants par niveau">
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
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor="studentGroup">Groupe</label>
              <select
                id="studentGroup"
                className="form-control group-select"
                value={selectedGroupeId}
                onChange={(event) => setSelectedGroupeId(event.target.value)}
              >
                {groupesDuNiveau.map((groupe) => (
                  <option key={groupe.id} value={groupe.id}>
                    {groupe.code} - {groupe.filiere_code}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor="studentSearch">Recherche</label>
              <input
                id="studentSearch"
                className="form-control"
                type="search"
                value={studentQuery}
                onChange={(event) => setStudentQuery(event.target.value)}
                placeholder="Nom, prenom, matricule, telephone..."
              />
            </div>
          </div>

          {selectedGroupe && (
            <div className="group-summary simple-student-summary">
              <div>
                <span className="eyebrow">Groupe affiche</span>
                <h3>{selectedGroupe.code}</h3>
                <p>{selectedGroupe.filiere_nom} - {cycleLabels[selectedGroupe.cycle] || selectedGroupe.cycle}</p>
              </div>
              <div className="summary-badges">
                <span className="badge badge-success">{etudiantsGroupe.length} etudiant(s)</span>
                <span className="badge badge-primary">{etudiantsGroupeFiltres.length} affiche(s)</span>
              </div>
            </div>
          )}

          <div className="table-wrap">
            <table className="data-table student-table">
              <thead>
                <tr>
                  <th>Matricule</th>
                  <th>Nom</th>
                  <th>Prenom</th>
                  <th>Groupe</th>
                  <th>Filiere</th>
                  <th>Telephone</th>
                  <th>Adresse</th>
                </tr>
              </thead>
              <tbody>
                {etudiantsGroupeFiltres.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="empty-state">Aucun etudiant trouve dans ce filtre</td>
                  </tr>
                ) : etudiantsGroupeFiltres.map((etudiant) => (
                  <tr key={etudiant.id}>
                    <td><strong>{etudiant.matricule || `#${etudiant.id}`}</strong></td>
                    <td>{etudiant.nom || '-'}</td>
                    <td>{etudiant.prenom || '-'}</td>
                    <td>{etudiant.groupe_code || selectedGroupe?.code || '-'}</td>
                    <td>{etudiant.filiere_code || selectedGroupe?.filiere_code || '-'}</td>
                    <td>{etudiant.telephone || '-'}</td>
                    <td>{etudiant.adresse || '-'}{etudiant.ville ? `, ${etudiant.ville}` : ''}</td>
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

export default Dashboard;
