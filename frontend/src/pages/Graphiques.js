import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  LineElement,
  PointElement,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar, Doughnut, Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  LineElement,
  PointElement,
  Filler,
  Tooltip,
  Legend
);

const colors = {
  primary: '#7f1734',
  primarySoft: 'rgba(127, 23, 52, 0.14)',
  teal: '#0f766e',
  tealSoft: 'rgba(15, 118, 110, 0.14)',
  amber: '#b7791f',
  amberSoft: 'rgba(183, 121, 31, 0.14)',
  danger: '#e11d48',
  ink: '#111113',
  muted: '#6f6870',
  grid: '#e7dde2',
};

const toNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const formatAverage = (value) => (value === null ? 'N/A' : value.toFixed(2));

function Graphiques() {
  const [notes, setNotes] = useState([]);
  const [absences, setAbsences] = useState([]);
  const [etudiants, setEtudiants] = useState([]);
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const token = localStorage.getItem('access');

  useEffect(() => {
    if (!token) { navigate('/'); return; }

    const authHeaders = { Authorization: `Bearer ${token}` };
    setLoading(true);
    setError('');

    Promise.all([
      axios.get('http://127.0.0.1:8000/api/notes/', { headers: authHeaders }),
      axios.get('http://127.0.0.1:8000/api/absences/', { headers: authHeaders }),
      axios.get('http://127.0.0.1:8000/api/etudiants/', { headers: authHeaders }),
      axios.get('http://127.0.0.1:8000/api/modules/', { headers: authHeaders }),
    ])
      .then(([notesRes, absencesRes, etudiantsRes, modulesRes]) => {
        setNotes(notesRes.data);
        setAbsences(absencesRes.data);
        setEtudiants(etudiantsRes.data);
        setModules(modulesRes.data);
      })
      .catch(() => setError('Impossible de charger les donnees graphiques.'))
      .finally(() => setLoading(false));
  }, [navigate, token]);

  const analytics = useMemo(() => {
    const cleanNotes = notes.map(note => ({ ...note, valeur: toNumber(note.valeur) }));
    const studentNames = new Map(etudiants.map(etudiant => [
      etudiant.id,
      etudiant.user_nom || etudiant.nom || `Etudiant ${etudiant.id}`,
    ]));
    const moduleNames = new Map(modules.map(module => [module.id, module.nom]));

    const totalNotes = cleanNotes.length;
    const moyenneGenerale = totalNotes
      ? cleanNotes.reduce((sum, note) => sum + note.valeur, 0) / totalNotes
      : null;

    const absencesJustifiees = absences.filter(absence => absence.justifiee).length;
    const absencesNonJustifiees = absences.length - absencesJustifiees;
    const tauxJustification = absences.length
      ? Math.round((absencesJustifiees / absences.length) * 100)
      : 100;

    const students = new Map();
    const ensureStudent = (id) => {
      if (!students.has(id)) {
        students.set(id, {
          id,
          name: studentNames.get(id) || `Etudiant ${id}`,
          notesTotal: 0,
          notesCount: 0,
          absencesCount: 0,
          absencesNonJustifiees: 0,
        });
      }
      return students.get(id);
    };

    cleanNotes.forEach(note => {
      const student = ensureStudent(note.etudiant);
      student.notesTotal += note.valeur;
      student.notesCount += 1;
    });

    absences.forEach(absence => {
      const student = ensureStudent(absence.etudiant);
      student.absencesCount += 1;
      if (!absence.justifiee) student.absencesNonJustifiees += 1;
    });

    const studentProfiles = Array.from(students.values()).map(student => {
      const moyenne = student.notesCount ? student.notesTotal / student.notesCount : null;
      const riskScore =
        (moyenne !== null && moyenne < 10 ? 42 : 0) +
        (moyenne !== null && moyenne >= 10 && moyenne < 12 ? 18 : 0) +
        (student.absencesNonJustifiees * 14) +
        (student.absencesCount * 4);

      return {
        ...student,
        moyenne,
        riskScore: Math.min(100, Math.round(riskScore)),
      };
    }).sort((a, b) => b.riskScore - a.riskScore);

    const studentsARisque = studentProfiles.filter(student =>
      student.riskScore >= 45 ||
      student.absencesNonJustifiees >= 2 ||
      (student.moyenne !== null && student.moyenne < 10)
    );

    const moduleStats = new Map();
    cleanNotes.forEach(note => {
      const key = note.module;
      if (!moduleStats.has(key)) moduleStats.set(key, { module: key, total: 0, count: 0 });
      const module = moduleStats.get(key);
      module.total += note.valeur;
      module.count += 1;
    });

    const modulePerformance = Array.from(moduleStats.values())
      .map(module => ({
        ...module,
        label: moduleNames.get(module.module) || `Module ${module.module}`,
        moyenne: module.count ? module.total / module.count : 0,
      }))
      .sort((a, b) => String(a.label).localeCompare(String(b.label)));

    const meilleurModule = [...modulePerformance].sort((a, b) => b.moyenne - a.moyenne)[0] || null;
    const moduleFragile = [...modulePerformance].sort((a, b) => a.moyenne - b.moyenne)[0] || null;

    const distributionNotes = [
      cleanNotes.filter(note => note.valeur >= 16).length,
      cleanNotes.filter(note => note.valeur >= 12 && note.valeur < 16).length,
      cleanNotes.filter(note => note.valeur >= 10 && note.valeur < 12).length,
      cleanNotes.filter(note => note.valeur < 10).length,
    ];

    const scoreAcademique = moyenneGenerale === null ? 0 : (moyenneGenerale / 20) * 70;
    const scoreAssiduite = absences.length ? (tauxJustification / 100) * 30 : 30;
    const penaliteRisque = Math.min(35, studentsARisque.length * 4 + absencesNonJustifiees * 2);
    const scoreGlobal = Math.max(0, Math.min(100, Math.round(scoreAcademique + scoreAssiduite - penaliteRisque)));

    const actionPrioritaire = studentsARisque.length > 0
      ? 'Planifier un suivi pour les profils a risque'
      : 'Maintenir le suivi hebdomadaire';

    return {
      totalNotes,
      moyenneGenerale,
      absencesJustifiees,
      absencesNonJustifiees,
      tauxJustification,
      studentProfiles,
      studentsARisque,
      modulePerformance,
      meilleurModule,
      moduleFragile,
      distributionNotes,
      scoreGlobal,
      actionPrioritaire,
    };
  }, [notes, absences, etudiants, modules]);

  const baseOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: colors.muted,
          boxWidth: 10,
          boxHeight: 10,
          font: { weight: 700 },
        },
      },
      tooltip: {
        backgroundColor: colors.ink,
        padding: 12,
        titleFont: { weight: 800 },
        bodyFont: { weight: 700 },
      },
    },
  };

  const axisOptions = {
    ...baseOptions,
    plugins: {
      ...baseOptions.plugins,
      legend: { display: false },
    },
    scales: {
      y: {
        beginAtZero: true,
        max: 20,
        grid: { color: colors.grid },
        ticks: { color: colors.muted, font: { weight: 700 } },
      },
      x: {
        grid: { display: false },
        ticks: { color: colors.muted, font: { weight: 700 } },
      },
    },
  };

  const riskOptions = {
    ...axisOptions,
    scales: {
      ...axisOptions.scales,
      y: {
        beginAtZero: true,
        max: 100,
        grid: { color: colors.grid },
        ticks: { color: colors.muted, font: { weight: 700 } },
      },
    },
  };

  const moduleLineData = {
    labels: analytics.modulePerformance.map(module => module.label),
    datasets: [{
      label: 'Moyenne par module',
      data: analytics.modulePerformance.map(module => Number(module.moyenne.toFixed(2))),
      fill: true,
      borderColor: colors.primary,
      backgroundColor: colors.primarySoft,
      pointBackgroundColor: colors.primary,
      pointBorderColor: '#ffffff',
      pointBorderWidth: 3,
      pointRadius: 5,
      tension: 0.35,
    }],
  };

  const distributionData = {
    labels: ['Excellent', 'Solide', 'Fragile', 'Critique'],
    datasets: [{
      label: 'Nombre de notes',
      data: analytics.distributionNotes,
      backgroundColor: [colors.teal, colors.primary, colors.amber, colors.danger],
      borderRadius: 8,
      barThickness: 34,
    }],
  };

  const absencesData = {
    labels: ['Justifiees', 'Non justifiees'],
    datasets: [{
      data: [analytics.absencesJustifiees, analytics.absencesNonJustifiees],
      backgroundColor: [colors.teal, colors.danger],
      borderColor: '#ffffff',
      borderWidth: 5,
      hoverOffset: 8,
    }],
  };

  const riskBarData = {
    labels: analytics.studentProfiles.slice(0, 6).map(student => student.name),
    datasets: [{
      label: 'Score de risque',
      data: analytics.studentProfiles.slice(0, 6).map(student => student.riskScore),
      backgroundColor: analytics.studentProfiles.slice(0, 6).map(student =>
        student.riskScore >= 60 ? colors.danger : student.riskScore >= 35 ? colors.amber : colors.teal
      ),
      borderRadius: 8,
      barThickness: 26,
    }],
  };

  const hasNotes = analytics.totalNotes > 0;
  const hasAbsences = absences.length > 0;

  return (
    <div className="app-shell jury-shell">
      <nav className="app-nav">
        <div className="brand">
          <div className="brand-mark">PA</div>
          <div className="brand-text">
            <span className="brand-title">Portail Absences</span>
            <span className="brand-subtitle">Tableau de bord analytique</span>
          </div>
        </div>
        <div className="nav-actions">
          <button className="btn btn-soft" onClick={() => navigate('/dashboard')}>Dashboard</button>
          <button className="btn btn-accent" onClick={() => { localStorage.clear(); navigate('/'); }}>Deconnexion</button>
        </div>
      </nav>

      <main className="jury-page">
        <section className="jury-header">
          <div>
            <span className="jury-eyebrow">Presentation PFA</span>
            <h1>Analyse academique et assiduite</h1>
            <p>
              Une structure claire pour montrer rapidement les indicateurs,
              les tendances et les decisions possibles devant le jury.
            </p>
          </div>
          <aside className="jury-score">
            <span>Indice global</span>
            <strong>{analytics.scoreGlobal}%</strong>
            <div className="jury-score-track">
              <i style={{ width: `${analytics.scoreGlobal}%` }} />
            </div>
          </aside>
        </section>

        {error && <div className="alert alert-danger">{error}</div>}

        <section className="jury-kpis" aria-label="Indicateurs principaux">
          <article>
            <span>Moyenne generale</span>
            <strong>{formatAverage(analytics.moyenneGenerale)}/20</strong>
          </article>
          <article>
            <span>Notes analysees</span>
            <strong>{analytics.totalNotes}</strong>
          </article>
          <article>
            <span>Profils a risque</span>
            <strong>{analytics.studentsARisque.length}</strong>
          </article>
          <article>
            <span>Absences non justifiees</span>
            <strong>{analytics.absencesNonJustifiees}</strong>
          </article>
        </section>

        {loading ? (
          <section className="jury-card">
            <p className="empty-state">Chargement des graphiques...</p>
          </section>
        ) : (
          <>
            <section className="jury-layout">
              <article className="jury-card jury-main-chart">
                <div className="jury-card-header">
                  <div>
                    <span className="jury-eyebrow">Performance</span>
                    <h2>Moyenne par module</h2>
                  </div>
                  <span className="badge badge-primary">{analytics.modulePerformance.length} modules</span>
                </div>
                <div className="jury-chart-large">
                  {hasNotes ? (
                    <Line data={moduleLineData} options={axisOptions} />
                  ) : (
                    <p className="empty-state">Aucune note disponible</p>
                  )}
                </div>
              </article>

              <aside className="jury-side">
                <article className="jury-card">
                  <div className="jury-card-header">
                    <div>
                      <span className="jury-eyebrow">Assiduite</span>
                      <h2>Absences</h2>
                    </div>
                  </div>
                  <div className="jury-donut">
                    {hasAbsences ? (
                      <Doughnut data={absencesData} options={{ ...baseOptions, cutout: '70%' }} />
                    ) : (
                      <p className="empty-state">Aucune absence disponible</p>
                    )}
                  </div>
                  <div className="jury-legend">
                    <span><i className="ok" />Justifiees: {analytics.absencesJustifiees}</span>
                    <span><i className="danger" />Non justifiees: {analytics.absencesNonJustifiees}</span>
                  </div>
                </article>

                <article className="jury-card jury-decision">
                  <span className="jury-eyebrow">Decision</span>
                  <h2>Action prioritaire</h2>
                  <p>{analytics.actionPrioritaire}</p>
                </article>
              </aside>
            </section>

            <section className="jury-bottom-grid">
              <article className="jury-card">
                <div className="jury-card-header">
                  <div>
                    <span className="jury-eyebrow">Niveaux</span>
                    <h2>Distribution des notes</h2>
                  </div>
                </div>
                <div className="jury-chart">
                  {hasNotes ? (
                    <Bar data={distributionData} options={axisOptions} />
                  ) : (
                    <p className="empty-state">Aucune note disponible</p>
                  )}
                </div>
              </article>

              <article className="jury-card">
                <div className="jury-card-header">
                  <div>
                    <span className="jury-eyebrow">Suivi cible</span>
                    <h2>Top risques etudiants</h2>
                  </div>
                </div>
                <div className="jury-chart">
                  {analytics.studentProfiles.length > 0 ? (
                    <Bar data={riskBarData} options={riskOptions} />
                  ) : (
                    <p className="empty-state">Aucun profil etudiant disponible</p>
                  )}
                </div>
              </article>
            </section>

            <section className="jury-insights">
              <article>
                <span>Meilleur module</span>
                <strong>{analytics.meilleurModule ? analytics.meilleurModule.label : 'N/A'}</strong>
                <p>{analytics.meilleurModule ? `${analytics.meilleurModule.moyenne.toFixed(2)}/20` : 'Aucune donnee'}</p>
              </article>
              <article>
                <span>Module a renforcer</span>
                <strong>{analytics.moduleFragile ? analytics.moduleFragile.label : 'N/A'}</strong>
                <p>{analytics.moduleFragile ? `${analytics.moduleFragile.moyenne.toFixed(2)}/20` : 'Aucune donnee'}</p>
              </article>
              <article>
                <span>Taux de justification</span>
                <strong>{analytics.tauxJustification}%</strong>
                <p>Qualite du suivi des absences</p>
              </article>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

export default Graphiques;
