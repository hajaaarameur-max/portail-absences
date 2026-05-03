import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

function ExportPDF() {
  const [etudiants, setEtudiants] = useState([]);
  const [notes, setNotes] = useState([]);
  const [absences, setAbsences] = useState([]);
  const navigate = useNavigate();

  const token = localStorage.getItem('access');
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    if (!token) { navigate('/'); return; }
    const authHeaders = { Authorization: `Bearer ${token}` };
    axios.get('http://127.0.0.1:8000/api/etudiants/', { headers: authHeaders })
      .then(res => setEtudiants(res.data));
    axios.get('http://127.0.0.1:8000/api/notes/', { headers: authHeaders })
      .then(res => setNotes(res.data));
    axios.get('http://127.0.0.1:8000/api/absences/', { headers: authHeaders })
      .then(res => setAbsences(res.data));
  }, [navigate, token]);

  const tableTheme = {
    styles: { fontSize: 10, cellPadding: 3 },
    headStyles: { fillColor: [15, 118, 110], textColor: [255, 255, 255] },
    alternateRowStyles: { fillColor: [246, 248, 251] },
  };

  const exportNotesPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.setTextColor(15, 118, 110);
    doc.text('Rapport des notes', 14, 20);
    doc.setFontSize(11);
    doc.setTextColor(17, 24, 39);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 14, 30);

    autoTable(doc, {
      startY: 40,
      head: [['ID étudiant', 'Module', 'Note', 'Date']],
      body: notes.map(n => [
        `Etudiant ${n.etudiant}`,
        `Module ${n.module}`,
        `${n.valeur}/20`,
        n.date,
      ]),
      ...tableTheme,
    });

    doc.save('notes.pdf');
  };

  const exportAbsencesPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.setTextColor(225, 29, 72);
    doc.text('Rapport des absences', 14, 20);
    doc.setFontSize(11);
    doc.setTextColor(17, 24, 39);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 14, 30);

    autoTable(doc, {
      startY: 40,
      head: [['ID étudiant', 'Module', 'Date', 'Justifiée']],
      body: absences.map(a => [
        `Etudiant ${a.etudiant}`,
        `Module ${a.module}`,
        a.date,
        a.justifiee ? 'Oui' : 'Non',
      ]),
      ...tableTheme,
      headStyles: { fillColor: [225, 29, 72], textColor: [255, 255, 255] },
    });

    doc.save('absences.pdf');
  };

  const exportRapportCompletPDF = () => {
    const doc = new jsPDF();

    doc.setFontSize(22);
    doc.setTextColor(15, 118, 110);
    doc.text('Portail Absences', 14, 20);
    doc.setFontSize(14);
    doc.setTextColor(17, 24, 39);
    doc.text('Rapport complet', 14, 30);
    doc.setFontSize(11);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 14, 38);

    doc.setFontSize(13);
    doc.text('Statistiques générales', 14, 50);
    autoTable(doc, {
      startY: 55,
      head: [['Indicateur', 'Valeur']],
      body: [
        ['Total étudiants', etudiants.length],
        ['Total notes', notes.length],
        ['Total absences', absences.length],
        ['Absences justifiées', absences.filter(a => a.justifiee).length],
        ['Absences non justifiées', absences.filter(a => !a.justifiee).length],
      ],
      ...tableTheme,
    });

    doc.addPage();
    doc.setFontSize(14);
    doc.text('Liste des notes', 14, 20);
    autoTable(doc, {
      startY: 25,
      head: [['ID étudiant', 'Module', 'Note', 'Date']],
      body: notes.map(n => [
        `Etudiant ${n.etudiant}`,
        `Module ${n.module}`,
        `${n.valeur}/20`,
        n.date,
      ]),
      ...tableTheme,
    });

    doc.addPage();
    doc.setFontSize(14);
    doc.text('Liste des absences', 14, 20);
    autoTable(doc, {
      startY: 25,
      head: [['ID étudiant', 'Module', 'Date', 'Justifiée']],
      body: absences.map(a => [
        `Etudiant ${a.etudiant}`,
        `Module ${a.module}`,
        a.date,
        a.justifiee ? 'Oui' : 'Non',
      ]),
      ...tableTheme,
    });

    doc.save('rapport_complet.pdf');
  };

  return (
    <div className="app-shell">
      <nav className="app-nav">
        <div className="brand">
          <div className="brand-mark">PA</div>
          <div className="brand-text">
            <span className="brand-title">Portail Absences</span>
            <span className="brand-subtitle">Export PDF</span>
          </div>
        </div>
        <div className="nav-actions">
          <button className="btn btn-soft" onClick={() => navigate('/dashboard')}>Dashboard</button>
          <button className="btn btn-accent" onClick={() => { localStorage.clear(); navigate('/'); }}>Déconnexion</button>
        </div>
      </nav>

      <main className="page page-wide">
        <header className="page-header">
          <div>
            <p className="kicker">Rapports</p>
            <h1 className="page-title">Export PDF</h1>
            <p className="page-description">Générez des documents propres pour les notes, les absences ou le rapport complet.</p>
          </div>
        </header>

        <section className="card-grid">
          <article className="export-card">
            <div className="export-icon">NT</div>
            <div>
              <h2 className="panel-title">Notes</h2>
              <p>{notes.length} notes au total</p>
            </div>
            <button className="btn btn-primary" onClick={exportNotesPDF}>Exporter les notes</button>
          </article>

          <article className="export-card">
            <div className="export-icon">AB</div>
            <div>
              <h2 className="panel-title">Absences</h2>
              <p>{absences.length} absences au total</p>
            </div>
            <button className="btn btn-accent" onClick={exportAbsencesPDF}>Exporter les absences</button>
          </article>

          <article className="export-card">
            <div className="export-icon">PDF</div>
            <div>
              <h2 className="panel-title">Rapport complet</h2>
              <p>Notes, absences et statistiques générales</p>
            </div>
            <button className="btn btn-ink" onClick={exportRapportCompletPDF}>Exporter le rapport</button>
          </article>
        </section>
      </main>
    </div>
  );
}

export default ExportPDF;
