import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Enseignant from './pages/Enseignant';
import Etudiant from './pages/Etudiant';
import Analyse from './pages/Analyse';
import Graphiques from './pages/Graphiques';
import Profil from './pages/Profil';
import ExportPDF from './pages/ExportPDF';
import Intelligence from './pages/Intelligence';
import DossierEtudiant from './pages/DossierEtudiant';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/enseignant" element={<Enseignant />} />
        <Route path="/etudiant" element={<Etudiant />} />
        <Route path="/analyse" element={<Analyse />} />
        <Route path="/graphiques" element={<Graphiques />} />
        <Route path="/profil" element={<Profil />} />
        <Route path="/export" element={<ExportPDF />} />
        <Route path="/intelligence" element={<Intelligence />} />
        <Route path="/dossier-etudiant" element={<DossierEtudiant />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
