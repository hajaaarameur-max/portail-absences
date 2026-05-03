import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import jsPDF from 'jspdf';

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

const normalize = (value = '') =>
  value
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const maxId = (items) => Math.max(0, ...items.map((item) => Number(item.id) || 0));

function Etudiant() {
  const [notes, setNotes] = useState([]);
  const [absences, setAbsences] = useState([]);
  const [modules, setModules] = useState([]);
  const [emplois, setEmplois] = useState([]);
  const [etudiants, setEtudiants] = useState([]);
  const [profil, setProfil] = useState(null);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState([
    {
      role: 'assistant',
      text: 'Bonjour. Je peux vous aider avec vos notes, absences, modules, emploi du temps, certificat ou le portail.',
    },
  ]);
  const [certificateStatus, setCertificateStatus] = useState('');
  const [studentAlerts, setStudentAlerts] = useState([]);
  const navigate = useNavigate();

  const token = localStorage.getItem('access');
  const latestNoteIdRef = useRef(0);
  const latestAbsenceIdRef = useRef(0);
  const liveInitializedRef = useRef(false);

  useEffect(() => {
    if (!token) { navigate('/'); return; }
    const headers = { Authorization: `Bearer ${token}` };

    Promise.all([
      axios.get(`${API_URL}/notes/`, { headers }),
      axios.get(`${API_URL}/absences/`, { headers }),
      axios.get(`${API_URL}/modules/`, { headers }),
      axios.get(`${API_URL}/emplois/`, { headers }),
      axios.get(`${API_URL}/etudiants/`, { headers }),
      axios.get(`${API_URL}/profil/`, { headers }),
    ])
      .then(([notesRes, absencesRes, modulesRes, emploisRes, etudiantsRes, profilRes]) => {
        const profilData = profilRes.data;
        const profilUsername = profilData.username || '';
        const current = etudiantsRes.data.find((etudiant) => {
          const sameUserId = String(etudiant.user) === String(profilData.id);
          const sameUsername = profilUsername && etudiant.username === profilUsername;
          return sameUserId || sameUsername;
        });

        if (current) {
          latestNoteIdRef.current = maxId(notesRes.data.filter((note) => String(note.etudiant) === String(current.id)));
          latestAbsenceIdRef.current = maxId(absencesRes.data.filter((absence) => String(absence.etudiant) === String(current.id)));
          liveInitializedRef.current = true;
        }

        setNotes(notesRes.data);
        setAbsences(absencesRes.data);
        setModules(modulesRes.data);
        setEmplois(emploisRes.data);
        setEtudiants(etudiantsRes.data);
        setProfil(profilData);
      })
      .catch(() => navigate('/'));
  }, [navigate, token]);

  const moduleNames = useMemo(
    () => new Map(modules.map((module) => [module.id, module.nom])),
    [modules]
  );

  const currentEtudiant = useMemo(() => {
    if (!profil) return null;
    const profilUsername = profil.username || '';
    return etudiants.find((etudiant) => {
      const sameUserId = String(etudiant.user) === String(profil.id);
      const sameUsername = profilUsername && (
        etudiant.username === profilUsername ||
        etudiant.user_username === profilUsername
      );
      return sameUserId || sameUsername;
    }) || null;
  }, [etudiants, profil]);

  const notesAffichees = useMemo(() => {
    if (!currentEtudiant) return [];
    return notes.filter((note) => String(note.etudiant) === String(currentEtudiant.id));
  }, [notes, currentEtudiant]);

  const absencesAffichees = useMemo(() => {
    if (!currentEtudiant) return [];
    return absences.filter((absence) => String(absence.etudiant) === String(currentEtudiant.id));
  }, [absences, currentEtudiant]);

  useEffect(() => {
    if (!token || !currentEtudiant || !liveInitializedRef.current) return undefined;
    const headers = { Authorization: `Bearer ${token}` };

    const interval = setInterval(async () => {
      try {
        const [notesRes, absencesRes] = await Promise.all([
          axios.get(`${API_URL}/notes/`, { headers }),
          axios.get(`${API_URL}/absences/`, { headers }),
        ]);

        const studentNotes = notesRes.data.filter((note) => String(note.etudiant) === String(currentEtudiant.id));
        const studentAbsences = absencesRes.data.filter((absence) => String(absence.etudiant) === String(currentEtudiant.id));
        const newNotes = studentNotes.filter((note) => Number(note.id) > latestNoteIdRef.current);
        const newAbsences = studentAbsences.filter((absence) => Number(absence.id) > latestAbsenceIdRef.current);

        if (newNotes.length || newAbsences.length) {
          const alerts = [
            ...newNotes.map((note) => ({
              id: `note-${note.id}`,
              type: 'note',
              title: 'Nouvelle note ajoutee',
              module: note.module,
              detail: `${note.valeur}/20`,
              date: note.date,
            })),
            ...newAbsences.map((absence) => ({
              id: `absence-${absence.id}`,
              type: 'absence',
              title: 'Nouvelle absence ajoutee',
              module: absence.module,
              detail: absence.justifiee ? 'Justifiee' : 'Non justifiee',
              date: absence.date,
            })),
          ].reverse();
          setStudentAlerts((previous) => [...alerts, ...previous].slice(0, 6));
        }

        latestNoteIdRef.current = Math.max(latestNoteIdRef.current, maxId(studentNotes));
        latestAbsenceIdRef.current = Math.max(latestAbsenceIdRef.current, maxId(studentAbsences));
        setNotes(notesRes.data);
        setAbsences(absencesRes.data);
      } catch (err) {
        // Keep the existing data if the live refresh fails temporarily.
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [currentEtudiant, token]);

  const emploisEtudiant = useMemo(() => {
    if (!currentEtudiant) return [];
    return emplois
      .filter((emploi) =>
        String(emploi.groupe) === String(currentEtudiant.groupe)
      )
      .sort((a, b) => (dayOrder[a.jour] || 99) - (dayOrder[b.jour] || 99) || a.heure_debut.localeCompare(b.heure_debut));
  }, [emplois, currentEtudiant]);

  const modulesEtudiant = useMemo(() => {
    const list = new Map();
    emploisEtudiant.forEach((emploi) => {
      list.set(emploi.module, emploi.module_nom);
    });
    return Array.from(list.values()).sort((a, b) => a.localeCompare(b));
  }, [emploisEtudiant]);

  const moyenneValue = useMemo(
    () => notesAffichees.length > 0
      ? notesAffichees.reduce((acc, note) => acc + Number(note.valeur || 0), 0) / notesAffichees.length
      : null,
    [notesAffichees]
  );

  const moyenne = moyenneValue !== null ? moyenneValue.toFixed(2) : 'N/A';
  const certificatDisponible = currentEtudiant && moyenneValue !== null && moyenneValue >= 10;

  const getStudentAssistantAnswer = (question) => {
    if (!currentEtudiant) {
      return "Votre compte n'est pas encore lie a un dossier etudiant.";
    }

    const query = normalize(question);

    if (query.includes('note') || query.includes('moyenne') || query.includes('resultat')) {
      return `Votre moyenne actuelle est ${moyenne}/20 avec ${notesAffichees.length} note(s) enregistree(s).`;
    }

    if (query.includes('absence') || query.includes('assiduite')) {
      const nonJustifiees = absencesAffichees.filter((absence) => !absence.justifiee).length;
      return `Vous avez ${absencesAffichees.length} absence(s), dont ${nonJustifiees} non justifiee(s).`;
    }

    if (query.includes('module') || query.includes('matiere')) {
      return modulesEtudiant.length
        ? `Vos modules sont: ${modulesEtudiant.join(', ')}.`
        : "Aucun module n'est disponible pour votre groupe pour le moment.";
    }

    if (query.includes('emploi') || query.includes('planning') || query.includes('horaire')) {
      const nextSession = emploisEtudiant[0];
      if (!nextSession) return "Aucun emploi du temps n'est disponible pour votre groupe.";
      return `Votre planning contient ${emploisEtudiant.length} seance(s). Exemple: ${nextSession.jour}, ${nextSession.heure_debut.slice(0, 5)}-${nextSession.heure_fin.slice(0, 5)} en ${nextSession.module_nom}.`;
    }

    if (query.includes('certificat') || query.includes('attestation') || query.includes('reussite')) {
      return certificatDisponible
        ? `Votre certificat de reussite est disponible. Votre moyenne est ${moyenne}/20.`
        : `Le certificat sera disponible quand votre moyenne sera au moins 10/20. Moyenne actuelle: ${moyenne}.`;
    }

    if (query.includes('portail') || query.includes('aide') || query.includes('comment') || query.includes('profile') || query.includes('profil')) {
      return "Dans ce portail, vous pouvez consulter votre profil, vos notes, vos absences, vos modules, votre emploi du temps, et telecharger votre certificat si vous etes admis.";
    }

    return "Vous pouvez me demander: ma moyenne, mes absences, mes modules, mon emploi du temps, mon certificat, ou comment utiliser le portail.";
  };

  const handleStudentChatSubmit = (event) => {
    event.preventDefault();
    const question = chatInput.trim();
    if (!question) return;
    setChatMessages((messages) => [
      ...messages,
      { role: 'user', text: question },
      { role: 'assistant', text: getStudentAssistantAnswer(question) },
    ].slice(-10));
    setChatInput('');
  };

  const generateStudentCertificate = () => {
    if (!currentEtudiant) {
      setCertificateStatus('Dossier etudiant introuvable.');
      return;
    }

    if (!certificatDisponible) {
      setCertificateStatus('Certificat indisponible: moyenne inferieure a 10/20 ou notes manquantes.');
      return;
    }

    try {
      const doc = new jsPDF('landscape', 'mm', 'a4');
      const studentName = currentEtudiant.user_nom || `${currentEtudiant.prenom || ''} ${currentEtudiant.nom || ''}`.trim();
      const safeName = studentName
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]+/g, '_')
        .replace(/^_|_$/g, '')
        .toLowerCase();

      doc.setFillColor(255, 255, 255);
      doc.rect(0, 0, 297, 210, 'F');
      doc.setDrawColor(127, 23, 52);
      doc.setLineWidth(2);
      doc.rect(10, 10, 277, 190);
      doc.setDrawColor(17, 17, 19);
      doc.setLineWidth(0.5);
      doc.rect(16, 16, 265, 178);

      doc.setFillColor(127, 23, 52);
      doc.rect(16, 16, 265, 20, 'F');
      doc.setFontSize(12);
      doc.setTextColor(255, 255, 255);
      doc.text('PORTAIL ABSENCES - EMSI', 148, 29, { align: 'center' });

      doc.setFontSize(26);
      doc.setTextColor(127, 23, 52);
      doc.text('CERTIFICAT DE REUSSITE', 148, 58, { align: 'center' });
      doc.setDrawColor(127, 23, 52);
      doc.line(90, 66, 207, 66);

      doc.setFontSize(15);
      doc.setTextColor(17, 20, 23);
      doc.text('Ce certificat est attribue a', 148, 88, { align: 'center' });
      doc.setFontSize(28);
      doc.setTextColor(17, 17, 19);
      doc.text(studentName, 148, 108, { align: 'center' });

      doc.setFontSize(13);
      doc.setTextColor(75, 85, 99);
      doc.text(`Matricule: ${currentEtudiant.matricule || currentEtudiant.id}`, 148, 124, { align: 'center' });
      doc.text(`${currentEtudiant.groupe_code} - ${currentEtudiant.filiere_nom || currentEtudiant.filiere_code || 'Filiere'}`, 148, 136, { align: 'center' });
      doc.text(`Moyenne generale: ${moyenne}/20`, 148, 148, { align: 'center' });

      doc.setFontSize(11);
      doc.setTextColor(17, 17, 19);
      doc.text('Administration pedagogique', 65, 176, { align: 'center' });
      doc.line(34, 168, 96, 168);
      doc.text(`Genere le ${new Date().toLocaleDateString('fr-FR')}`, 232, 176, { align: 'center' });
      doc.line(202, 168, 262, 168);

      doc.save(`certificat_reussite_${safeName || currentEtudiant.id}.pdf`);
      setCertificateStatus('Certificat genere avec succes.');
    } catch (err) {
      setCertificateStatus('Erreur lors de la generation du certificat PDF.');
    }
  };

  return (
    <div className="app-shell">
      <nav className="app-nav">
        <div className="brand">
          <div className="brand-mark">PA</div>
          <div className="brand-text">
            <span className="brand-title">Portail Absences</span>
            <span className="brand-subtitle">Espace etudiant</span>
          </div>
        </div>
        <div className="nav-actions">
          <button className="btn btn-accent" onClick={() => { localStorage.clear(); navigate('/'); }}>Deconnexion</button>
        </div>
      </nav>

      <main className="page page-wide">
        <header className="page-header">
          <div>
            <p className="kicker">Suivi personnel</p>
            <h1 className="page-title">Espace etudiant</h1>
            <p className="page-description">
              Consultez vos notes, vos absences, votre filiere et votre emploi du temps hebdomadaire.
            </p>
          </div>
        </header>

        {studentAlerts.length > 0 && (
          <section className="student-live-alerts" aria-live="polite">
            <div className="student-live-alerts-header">
              <div>
                <span className="eyebrow">Notifications live</span>
                <h2>Nouveaux ajouts detectes</h2>
              </div>
              <button className="btn btn-soft" type="button" onClick={() => setStudentAlerts([])}>OK</button>
            </div>
            <div className="student-live-alert-list">
              {studentAlerts.map((alert) => (
                <article className={`student-live-alert ${alert.type}`} key={alert.id}>
                  <span>{alert.type === 'note' ? 'NT' : 'AB'}</span>
                  <div>
                    <strong>{alert.title}</strong>
                    <p>{moduleNames.get(alert.module) || `Module ${alert.module}`} - {alert.detail} - {alert.date}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {profil && !currentEtudiant && (
          <section className="panel">
            <div className="panel-header">
              <div>
                <h2 className="panel-title">Dossier etudiant introuvable</h2>
                <p className="panel-subtitle">
                  Ce compte n'est pas encore lie a une fiche etudiant. Les notes et absences ne sont pas affichees pour eviter de melanger les dossiers.
                </p>
              </div>
            </div>
          </section>
        )}

        {currentEtudiant && (
          <section className="student-identity-panel">
            <div className="student-avatar">{currentEtudiant.user_nom.slice(0, 2).toUpperCase()}</div>
            <div>
              <p className="kicker">Dossier academique</p>
              <h2>{currentEtudiant.user_nom}</h2>
              <p>
                {currentEtudiant.matricule} - {currentEtudiant.groupe_code} - {currentEtudiant.niveau} -
                {' '}{cycleLabels[currentEtudiant.cycle] || currentEtudiant.cycle} - {currentEtudiant.filiere_nom}
              </p>
            </div>
            <span className="badge badge-primary">{currentEtudiant.filiere_code}</span>
          </section>
        )}

        {currentEtudiant && (
          <section className="profile-detail-grid">
            <article>
              <span>Nom</span>
              <strong>{currentEtudiant.nom || '-'}</strong>
            </article>
            <article>
              <span>Prenom</span>
              <strong>{currentEtudiant.prenom || '-'}</strong>
            </article>
            <article>
              <span>Matricule</span>
              <strong>{currentEtudiant.matricule || '-'}</strong>
            </article>
            <article>
              <span>Telephone</span>
              <strong>{currentEtudiant.telephone || '-'}</strong>
            </article>
            <article>
              <span>Email</span>
              <strong>{currentEtudiant.email || '-'}</strong>
            </article>
            <article>
              <span>CIN</span>
              <strong>{currentEtudiant.cin || '-'}</strong>
            </article>
            <article>
              <span>Date naissance</span>
              <strong>{currentEtudiant.date_naissance || '-'}</strong>
            </article>
            <article>
              <span>Adresse</span>
              <strong>{currentEtudiant.adresse || '-'}{currentEtudiant.ville ? `, ${currentEtudiant.ville}` : ''}</strong>
            </article>
          </section>
        )}

        <section className="stats-grid" aria-label="Resume etudiant">
          <article className="stat-card">
            <div className="icon-tile">NT</div>
            <div>
              <div className="stat-value">{notesAffichees.length}</div>
              <p className="stat-label">Notes</p>
            </div>
          </article>
          <article className="stat-card success">
            <div className="icon-tile">MO</div>
            <div>
              <div className="stat-value">{moyenne}</div>
              <p className="stat-label">Moyenne</p>
            </div>
          </article>
          <article className="stat-card accent">
            <div className="icon-tile">AB</div>
            <div>
              <div className="stat-value">{absencesAffichees.length}</div>
              <p className="stat-label">Absences</p>
            </div>
          </article>
        </section>

        {currentEtudiant && (
          <section className="student-services-grid">
            <article className="panel">
              <div className="panel-header">
                <div>
                  <h2 className="panel-title">Certificat de reussite</h2>
                  <p className="panel-subtitle">Generez votre certificat PDF si votre moyenne est superieure ou egale a 10/20.</p>
                </div>
                <span className={`badge ${certificatDisponible ? 'badge-success' : 'badge-warning'}`}>
                  {certificatDisponible ? 'Disponible' : 'En attente'}
                </span>
              </div>
              <div className="student-service-body">
                <div className="certificate-preview">
                  <strong>{currentEtudiant.user_nom}</strong>
                  <span>{currentEtudiant.matricule} - {currentEtudiant.groupe_code}</span>
                  <span>Moyenne: {moyenne}/20</span>
                </div>
                <button className="btn btn-accent" type="button" onClick={generateStudentCertificate}>
                  Telecharger mon certificat PDF
                </button>
                {certificateStatus && <p className="automation-status">{certificateStatus}</p>}
              </div>
            </article>

            <article className="panel">
              <div className="panel-header">
                <div>
                  <h2 className="panel-title">Chatbot IA etudiant</h2>
                  <p className="panel-subtitle">Posez une question sur vos notes, absences, modules, certificat ou le portail.</p>
                </div>
                <span className="badge badge-primary">Assistant</span>
              </div>
              <div className="chat-window student-chat-window">
                {chatMessages.map((message, index) => (
                  <div className={`chat-bubble ${message.role}`} key={`${message.role}-${index}`}>
                    {message.text}
                  </div>
                ))}
              </div>
              <form className="chat-form" onSubmit={handleStudentChatSubmit}>
                <input
                  className="form-control"
                  value={chatInput}
                  onChange={(event) => setChatInput(event.target.value)}
                  placeholder="Ex: ma moyenne, mes absences, certificat, comment utiliser le portail..."
                />
                <button className="btn btn-primary" type="submit">Envoyer</button>
              </form>
            </article>
          </section>
        )}

        <section className="panel">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">Mon emploi du temps</h2>
              <p className="panel-subtitle">Planning du groupe {currentEtudiant?.groupe_code || ''}</p>
            </div>
            <span className="badge badge-primary">{emploisEtudiant.length} seances</span>
          </div>
          <div className="module-strip">
            {modulesEtudiant.map((module) => (
              <span className="module-pill" key={module}>{module}</span>
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
                {emploisEtudiant.length === 0 ? (
                  <tr><td colSpan="6" className="empty-state">Aucun emploi du temps disponible</td></tr>
                ) : emploisEtudiant.map((emploi) => (
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

        <section className="panel panel-spaced">
          <div className="panel-header">
            <h2 className="panel-title">Mes notes</h2>
            <span className="badge badge-primary">{notesAffichees.length} notes</span>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Module</th>
                  <th>Note</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {notesAffichees.length === 0 ? (
                  <tr><td colSpan="3" className="empty-state">Aucune note disponible</td></tr>
                ) : notesAffichees.map((note) => (
                  <tr key={note.id}>
                    <td>{moduleNames.get(note.module) || `Module ${note.module}`}</td>
                    <td className={note.valeur < 10 ? 'score-danger' : 'score-good'}>{note.valeur}/20</td>
                    <td>{note.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel panel-spaced">
          <div className="panel-header">
            <h2 className="panel-title">Mes absences</h2>
            <span className="badge badge-warning">{absencesAffichees.length} absences</span>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Module</th>
                  <th>Date</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {absencesAffichees.length === 0 ? (
                  <tr><td colSpan="3" className="empty-state">Aucune absence disponible</td></tr>
                ) : absencesAffichees.map((absence) => (
                  <tr key={absence.id}>
                    <td>{moduleNames.get(absence.module) || `Module ${absence.module}`}</td>
                    <td>{absence.date}</td>
                    <td>
                      <span className={`badge ${absence.justifiee ? 'badge-success' : 'badge-danger'}`}>
                        {absence.justifiee ? 'Justifiee' : 'Non justifiee'}
                      </span>
                    </td>
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

export default Etudiant;
