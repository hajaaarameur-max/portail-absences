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

const chartColors = {
  teal: '#7f1734',
  tealLight: 'rgba(127, 23, 52, 0.14)',
  rose: '#9f1239',
  roseLight: 'rgba(159, 18, 57, 0.14)',
  amber: '#8a6a3f',
  blue: '#171417',
  blueLight: 'rgba(23, 20, 23, 0.12)',
  ink: '#0c0c0e',
  muted: '#6f6870',
  grid: '#ddd6da',
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
    const cleanNotes = notes.map(note => ({
      ...note,
      valeur: toNumber(note.valeur),
    }));
    const studentNames = new Map(etudiants.map(etudiant => [
      etudiant.id,
      etudiant.user_nom || `Etudiant ${etudiant.id}`,
    ]));
    const moduleNames = new Map(modules.map(module => [module.id, module.nom]));

    const totalNotes = cleanNotes.length;
    const moyenneGenerale = totalNotes
      ? cleanNotes.reduce((total, note) => total + note.valeur, 0) / totalNotes
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
      .sort((a, b) => a.module - b.module);

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
    };
  }, [notes, absences, etudiants, modules]);

  const sharedOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: chartColors.muted,
          boxWidth: 10,
          boxHeight: 10,
          font: { weight: 700 },
        },
      },
      tooltip: {
        backgroundColor: chartColors.ink,
        padding: 12,
        titleFont: { weight: 800 },
        bodyFont: { weight: 700 },
      },
    },
  };

  const moduleLineData = {
    labels: analytics.modulePerformance.map(module => module.label),
    datasets: [{
      label: 'Moyenne par module',
      data: analytics.modulePerformance.map(module => Number(module.moyenne.toFixed(2))),
      fill: true,
      borderColor: chartColors.blue,
      backgroundColor: chartColors.blueLight,
      pointBackgroundColor: chartColors.blue,
      pointBorderColor: '#ffffff',
      pointBorderWidth: 3,
      pointRadius: 5,
      tension: 0.38,
    }],
  };

  const riskBarData = {
    labels: analytics.studentProfiles.slice(0, 8).map(student => student.name),
    datasets: [{
      label: 'Score de risque',
      data: analytics.studentProfiles.slice(0, 8).map(student => student.riskScore),
      backgroundColor: analytics.studentProfiles.slice(0, 8).map(student =>
        student.riskScore >= 60 ? chartColors.rose : student.riskScore >= 35 ? chartColors.amber : chartColors.teal
      ),
      borderRadius: 8,
      barThickness: 28,
    }],
  };

  const distributionData = {
    labels: ['Excellent', 'Solide', 'Fragile', 'Critique'],
    datasets: [{
      label: 'Nombre de notes',
      data: analytics.distributionNotes,
      backgroundColor: [chartColors.teal, chartColors.blue, chartColors.amber, chartColors.rose],
      borderRadius: 8,
    }],
  };

  const absencesData = {
    labels: ['Justifiees', 'Non justifiees'],
    datasets: [{
      data: [analytics.absencesJustifiees, analytics.absencesNonJustifiees],
      backgroundColor: [chartColors.teal, chartColors.rose],
      borderColor: '#ffffff',
      borderWidth: 5,
      hoverOffset: 8,
    }],
  };

  const axisOptions = {
    ...sharedOptions,
    scales: {
      y: {
        beginAtZero: true,
        max: 20,
        grid: { color: chartColors.grid },
        ticks: { color: chartColors.muted, font: { weight: 700 } },
      },
      x: {
        grid: { display: false },
        ticks: { color: chartColors.muted, font: { weight: 700 } },
      },
    },
  };

  const riskOptions = {
    ...sharedOptions,
    plugins: {
      ...sharedOptions.plugins,
      legend: { display: false },
    },
    scales: {
      y: {
        beginAtZero: true,
        max: 100,
        grid: { color: chartColors.grid },
        ticks: { color: chartColors.muted, font: { weight: 700 } },
      },
      x: {
        grid: { display: false },
        ticks: { color: chartColors.muted, font: { weight: 700 } },
      },
    },
  };

  const distributionOptions = {
    ...sharedOptions,
    plugins: {
      ...sharedOptions.plugins,
      legend: { display: false },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: chartColors.grid },
        ticks: { color: chartColors.muted, precision: 0, font: { weight: 700 } },
      },
      x: {
        grid: { display: false },
        ticks: { color: chartColors.muted, font: { weight: 700 } },
      },
    },
  };

  const hasNotes = analytics.totalNotes > 0;
  const hasAbsences = absences.length > 0;

  return (
    <div className="app-shell analytics-shell">
      <nav className="app-nav">
        <div className="brand">
          <div className="brand-mark">PA</div>
          <div className="brand-text">
            <span className="brand-title">Portail Absences</span>
            <span className="brand-subtitle">Graphiques intelligents</span>
          </div>
        </div>
        <div className="nav-actions">
          <button className="btn btn-soft" onClick={() => navigate('/dashboard')}>Dashboard</button>
          <button className="btn btn-accent" onClick={() => { localStorage.clear(); navigate('/'); }}>Deconnexion</button>
        </div>
      </nav>

      <main className="page page-wide analytics-page">
        <section className="analytics-hero">
          <div className="analytics-hero-copy">
            <p className="kicker">Centre de pilotage</p>
            <h1>Graphiques intelligents</h1>
            <p>
              Une lecture visuelle des performances, des absences et des profils a surveiller
              pour presenter le projet comme un vrai outil d'aide a la decision.
            </p>
          </div>
          <div className="hero-score-card">
            <span>Indice global</span>
            <strong>{analytics.scoreGlobal}%</strong>
            <div className="hero-score-meter" style={{ '--score': `${analytics.scoreGlobal}%` }}>
              <span />
            </div>
            <p>{analytics.studentsARisque.length} etudiant(s) demandent une attention prioritaire.</p>
          </div>
        </section>

        {error && <div className="alert alert-danger">{error}</div>}

        <section className="analytics-kpis" aria-label="Indicateurs importants">
          <article className="analytics-kpi-card">
            <span className="kpi-code">MOY</span>
            <strong>{formatAverage(analytics.moyenneGenerale)}/20</strong>
            <p>Moyenne generale</p>
          </article>
          <article className="analytics-kpi-card danger">
            <span className="kpi-code">RIS</span>
            <strong>{analytics.studentsARisque.length}</strong>
            <p>Etudiants a surveiller</p>
          </article>
          <article className="analytics-kpi-card warning">
            <span className="kpi-code">ABS</span>
            <strong>{analytics.absencesNonJustifiees}</strong>
            <p>Absences non justifiees</p>
          </article>
          <article className="analytics-kpi-card success">
            <span className="kpi-code">ASS</span>
            <strong>{analytics.tauxJustification}%</strong>
            <p>Taux de justification</p>
          </article>
        </section>

        {loading ? (
          <div className="panel">
            <p className="empty-state">Chargement des graphiques...</p>
          </div>
        ) : (
          <>
            <section className="analytics-showcase">
              <article className="analytics-card analytics-card-xl">
                <div className="analytics-card-header">
                  <div>
                    <span className="eyebrow">Performance</span>
                    <h2>Evolution des moyennes par module</h2>
                  </div>
                  <span className="badge badge-primary">{analytics.modulePerformance.length} modules</span>
                </div>
                <div className="chart-frame chart-frame-lg">
                  {hasNotes ? (
                    <Line data={moduleLineData} options={axisOptions} />
                  ) : (
                    <p className="empty-state">Aucune note disponible</p>
                  )}
                </div>
              </article>

              <article className="analytics-card">
                <div className="analytics-card-header">
                  <div>
                    <span className="eyebrow">Assiduite</span>
                    <h2>Qualite des absences</h2>
                  </div>
                </div>
                <div className="donut-wrap">
                  {hasAbsences ? (
                    <Doughnut data={absencesData} options={{ ...sharedOptions, cutout: '68%' }} />
                  ) : (
                    <p className="empty-state">Aucune absence disponible</p>
                  )}
                </div>
                <div className="mini-legend">
                  <span><i className="legend-dot teal" />Justifiees: {analytics.absencesJustifiees}</span>
                  <span><i className="legend-dot rose" />Non justifiees: {analytics.absencesNonJustifiees}</span>
                </div>
              </article>
            </section>

            <section className="analytics-grid">
              <article className="analytics-card">
                <div className="analytics-card-header">
                  <div>
                    <span className="eyebrow">Priorite</span>
                    <h2>Score de risque par etudiant</h2>
                  </div>
                </div>
                <div className="chart-frame">
                  {analytics.studentProfiles.length > 0 ? (
                    <Bar data={riskBarData} options={riskOptions} />
                  ) : (
                    <p className="empty-state">Aucun profil etudiant disponible</p>
                  )}
                </div>
              </article>

              <article className="analytics-card">
                <div className="analytics-card-header">
                  <div>
                    <span className="eyebrow">Niveaux</span>
                    <h2>Distribution des notes</h2>
                  </div>
                </div>
                <div className="chart-frame">
                  {hasNotes ? (
                    <Bar data={distributionData} options={distributionOptions} />
                  ) : (
                    <p className="empty-state">Aucune note disponible</p>
                  )}
                </div>
              </article>
            </section>

            <section className="insight-grid">
              <article className="insight-panel">
                <span className="eyebrow">Lecture jury</span>
                <h2>Points forts a annoncer</h2>
                <div className="insight-list">
                  <div>
                    <span>Meilleur module</span>
                    <strong>{analytics.meilleurModule ? `${analytics.meilleurModule.label} - ${analytics.meilleurModule.moyenne.toFixed(2)}/20` : 'N/A'}</strong>
                  </div>
                  <div>
                    <span>Module a renforcer</span>
                    <strong>{analytics.moduleFragile ? `${analytics.moduleFragile.label} - ${analytics.moduleFragile.moyenne.toFixed(2)}/20` : 'N/A'}</strong>
                  </div>
                  <div>
                    <span>Signal assiduite</span>
                    <strong>{analytics.tauxJustification}% des absences sont justifiees</strong>
                  </div>
                </div>
              </article>

              <article className="insight-panel">
                <span className="eyebrow">Suivi cible</span>
                <h2>Top profils a surveiller</h2>
                <div className="risk-list">
                  {analytics.studentProfiles.length === 0 ? (
                    <p className="empty-state">Aucun etudiant disponible</p>
                  ) : analytics.studentProfiles.slice(0, 4).map(student => (
                    <div className="risk-row" key={student.id}>
                      <span className={`risk-dot ${student.riskScore >= 60 ? 'danger' : student.riskScore >= 35 ? 'warning' : 'success'}`} />
                      <div>
                        <strong>{student.name}</strong>
                        <p>
                          Moyenne {formatAverage(student.moyenne)}/20 ·
                          {student.absencesNonJustifiees} absence(s) non justifiee(s)
                        </p>
                      </div>
                      <span className="risk-score">{student.riskScore}%</span>
                    </div>
                  ))}
                </div>
              </article>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

export default Graphiques;
