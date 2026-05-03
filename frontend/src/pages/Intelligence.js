import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const API_URL = 'http://127.0.0.1:8000/api';

const cityRegions = {
  Casablanca: 'Casablanca-Settat',
  Mohammedia: 'Casablanca-Settat',
  Rabat: 'Rabat-Sale-Kenitra',
  Sale: 'Rabat-Sale-Kenitra',
  Temara: 'Rabat-Sale-Kenitra',
  Marrakech: 'Marrakech-Safi',
  Fes: 'Fes-Meknes',
  Tanger: 'Tanger-Tetouan-Al Hoceima',
};

const translations = {
  fr: {
    subtitle: 'Centre intelligence',
    quickTitle: 'Centre IA academique',
    quickDesc: 'Assistant, alertes live, carte regionale, prediction, QR presence et classement des meilleurs etudiants.',
    language: 'Langue',
    theme: 'Theme',
    customTheme: 'Couleur principale',
    weeklyReport: 'Rapport automatique hebdomadaire',
    weeklyReportDesc: 'Generez ou planifiez un PDF de synthese chaque semaine.',
    generate: 'Generer',
    schedule: 'Planifier',
    certificate: 'Certificat de reussite',
    certificateDesc: 'PDF officiel pour les etudiants admis.',
    messaging: 'Messagerie interne',
    messagingDesc: 'Envoyer un message entre administration, enseignant et etudiant.',
    analytics: 'Tableau de bord analytique',
    analyticsDesc: 'Evolution des notes par module et par groupe.',
    send: 'Envoyer',
    bell: 'Alertes',
  },
  en: {
    subtitle: 'Intelligence center',
    quickTitle: 'Academic AI Center',
    quickDesc: 'Assistant, live alerts, regional map, prediction, QR attendance and student ranking.',
    language: 'Language',
    theme: 'Theme',
    customTheme: 'Primary color',
    weeklyReport: 'Automatic weekly report',
    weeklyReportDesc: 'Generate or schedule a weekly PDF summary.',
    generate: 'Generate',
    schedule: 'Schedule',
    certificate: 'Success certificate',
    certificateDesc: 'Official PDF for admitted students.',
    messaging: 'Internal messaging',
    messagingDesc: 'Send a message between administration, teacher and student.',
    analytics: 'Analytical dashboard',
    analyticsDesc: 'Grade evolution by module and group.',
    send: 'Send',
    bell: 'Alerts',
  },
  ar: {
    subtitle: 'مركز الذكاء',
    quickTitle: 'مركز الذكاء الأكاديمي',
    quickDesc: 'مساعد ذكي، تنبيهات مباشرة، خريطة جهوية، توقع النجاح، حضور QR وترتيب الطلبة.',
    language: 'اللغة',
    theme: 'المظهر',
    customTheme: 'اللون الرئيسي',
    weeklyReport: 'تقرير أسبوعي تلقائي',
    weeklyReportDesc: 'إنشاء أو جدولة تقرير PDF أسبوعي.',
    generate: 'إنشاء',
    schedule: 'جدولة',
    certificate: 'شهادة النجاح',
    certificateDesc: 'PDF رسمي للطلبة الناجحين.',
    messaging: 'مراسلة داخلية',
    messagingDesc: 'إرسال رسائل بين الإدارة والأستاذ والطالب.',
    analytics: 'لوحة تحليلية',
    analyticsDesc: 'تطور النقط حسب المادة والمجموعة.',
    send: 'إرسال',
    bell: 'تنبيهات',
  },
};

const themePresets = {
  burgundy: {
    label: 'Burgundy',
    primary: '#7f1734',
    primaryDark: '#3a0817',
    primarySoft: '#f5e7ec',
    accent: '#111113',
    bg: '#f5f3f4',
  },
  graphite: {
    label: 'Graphite',
    primary: '#374151',
    primaryDark: '#111827',
    primarySoft: '#eef0f3',
    accent: '#7f1734',
    bg: '#f4f4f5',
  },
  emerald: {
    label: 'Emerald',
    primary: '#047857',
    primaryDark: '#064e3b',
    primarySoft: '#dcfce7',
    accent: '#111113',
    bg: '#f3f7f5',
  },
  royal: {
    label: 'Royal',
    primary: '#4338ca',
    primaryDark: '#1e1b4b',
    primarySoft: '#e0e7ff',
    accent: '#111113',
    bg: '#f5f5ff',
  },
};

const normalize = (value = '') =>
  value
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const fullName = (student) =>
  [student?.prenom, student?.nom].filter(Boolean).join(' ') || student?.user_nom || 'Etudiant';

const formatMoyenne = (moyenne) => (moyenne === null ? 'N/A' : `${moyenne.toFixed(2)}/20`);

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const getPrediction = (moyenne, absences, absencesNonJustifiees) => {
  if (moyenne === null) {
    return {
      label: 'Donnees insuffisantes',
      tone: 'warning',
      probability: 50,
      confidence: 45,
    };
  }

  const probability = clamp(
    Math.round((moyenne / 20) * 100 - absencesNonJustifiees * 10 - Math.max(absences - absencesNonJustifiees, 0) * 3),
    4,
    98
  );

  if (probability >= 72) {
    return { label: 'Reussite probable', tone: 'success', probability, confidence: clamp(probability + 6, 55, 96) };
  }
  if (probability >= 48) {
    return { label: 'Vigilance', tone: 'warning', probability, confidence: 62 };
  }
  return { label: 'Echec probable', tone: 'danger', probability, confidence: clamp(100 - probability, 58, 96) };
};

const buildEvent = (type, item, students, modules) => {
  const student = students.find((entry) => String(entry.id) === String(item.etudiant));
  const module = modules.find((entry) => String(entry.id) === String(item.module));
  return {
    id: `${type}-${item.id}`,
    type,
    label: type === 'note' ? 'Nouvelle note' : 'Nouvelle absence',
    student: student ? fullName(student) : `Etudiant #${item.etudiant}`,
    group: student?.groupe_code || 'N/A',
    module: module?.nom || `Module ${item.module}`,
    detail: type === 'note' ? `${item.valeur}/20` : (item.justifiee ? 'Justifiee' : 'Non justifiee'),
    date: item.date,
  };
};

const answerQuestion = (question, students, groups, modulesByGroup) => {
  const query = normalize(question);
  const student = students.find((entry) => normalize([
    fullName(entry),
    entry.nom,
    entry.prenom,
    entry.matricule,
    entry.groupe_code,
    entry.username,
  ].join(' ')).includes(query) || query.includes(normalize(entry.matricule || '')));

  const group = groups.find((entry) => query.includes(normalize(entry.code)));

  if (student) {
    if (query.includes('absence') || query.includes('assiduite')) {
      return `${fullName(student)} (${student.groupe_code}) a ${student.absences} absence(s), dont ${student.absencesNonJustifiees} non justifiee(s). Prediction: ${student.prediction.label}.`;
    }
    if (query.includes('note') || query.includes('moyenne') || query.includes('resultat')) {
      return `${fullName(student)} a une moyenne de ${formatMoyenne(student.moyenne)} avec ${student.notesCount} note(s) enregistree(s).`;
    }
    if (query.includes('reuss') || query.includes('echec') || query.includes('risque') || query.includes('prediction')) {
      return `${fullName(student)}: ${student.prediction.label}. Probabilite de reussite estimee a ${student.prediction.probability}% avec ${student.prediction.confidence}% de confiance.`;
    }
    return `${fullName(student)} est inscrit(e) en ${student.niveau}, groupe ${student.groupe_code}, filiere ${student.filiere_code}. Ville: ${student.ville || 'N/A'}. Moyenne: ${formatMoyenne(student.moyenne)}.`;
  }

  if (group) {
    const groupStudents = students.filter((entry) => String(entry.groupe) === String(group.id));
    const modules = modulesByGroup.get(String(group.id)) || [];
    return `${group.code} contient ${groupStudents.length} etudiant(s). Modules: ${modules.slice(0, 6).join(', ')}.`;
  }

  if (query.includes('classement') || query.includes('top') || query.includes('meilleur')) {
    const top = students.slice(0, 3).map((entry, index) => `${index + 1}. ${fullName(entry)} (${formatMoyenne(entry.moyenne)})`).join(' | ');
    return `Top 3 actuel: ${top || 'aucune donnee disponible'}.`;
  }

  if (query.includes('region') || query.includes('ville') || query.includes('carte')) {
    const counts = students.reduce((acc, entry) => {
      acc[entry.region] = (acc[entry.region] || 0) + 1;
      return acc;
    }, {});
    const summary = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([region, count]) => `${region}: ${count}`)
      .join(' | ');
    return `Repartition par region: ${summary}.`;
  }

  if (query.includes('risque') || query.includes('prediction')) {
    const risky = students.filter((entry) => entry.prediction.tone === 'danger' || entry.prediction.tone === 'warning');
    return `${risky.length} etudiant(s) demandent une vigilance academique selon les notes et absences.`;
  }

  return 'Je peux repondre sur un etudiant, un groupe, les absences, la moyenne, la prediction, la carte des regions ou le classement.';
};

function Intelligence() {
  const [etudiants, setEtudiants] = useState([]);
  const [notes, setNotes] = useState([]);
  const [absences, setAbsences] = useState([]);
  const [modules, setModules] = useState([]);
  const [emplois, setEmplois] = useState([]);
  const [groupes, setGroupes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState([
    {
      role: 'assistant',
      text: 'Bonjour. Posez une question sur un etudiant, un groupe, les absences, la prediction ou le classement.',
    },
  ]);
  const [notifications, setNotifications] = useState([]);
  const [liveStatus, setLiveStatus] = useState('Surveillance active');
  const [selectedRegion, setSelectedRegion] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('all');
  const [qrInput, setQrInput] = useState('');
  const [qrMessage, setQrMessage] = useState('');
  const [qrScanning, setQrScanning] = useState(false);
  const [presenceLog, setPresenceLog] = useState([]);
  const [language, setLanguage] = useState(localStorage.getItem('portalLanguage') || 'fr');
  const [themeName, setThemeName] = useState(localStorage.getItem('portalTheme') || 'burgundy');
  const [customPrimary, setCustomPrimary] = useState(localStorage.getItem('portalPrimary') || themePresets.burgundy.primary);
  const [showAlerts, setShowAlerts] = useState(false);
  const [messageTarget, setMessageTarget] = useState('');
  const [messageText, setMessageText] = useState('');
  const [messages, setMessages] = useState(() => JSON.parse(localStorage.getItem('internalMessages') || '[]'));
  const [reportStatus, setReportStatus] = useState(localStorage.getItem('weeklyReportStatus') || 'Aucune planification active');
  const [certificateStudentId, setCertificateStudentId] = useState('');
  const [certificateStatus, setCertificateStatus] = useState('');
  const navigate = useNavigate();

  const token = localStorage.getItem('access');
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const frameRef = useRef(null);
  const detectorRef = useRef(null);
  const scanningRef = useRef(false);
  const maxNoteIdRef = useRef(0);
  const maxAbsenceIdRef = useRef(0);
  const etudiantsRef = useRef([]);
  const modulesRef = useRef([]);

  const authHeaders = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const t = translations[language] || translations.fr;
  const pageDirection = language === 'ar' ? 'rtl' : 'ltr';

  useEffect(() => {
    localStorage.setItem('portalLanguage', language);
  }, [language]);

  useEffect(() => {
    const preset = themePresets[themeName] || themePresets.burgundy;
    document.documentElement.style.setProperty('--primary', preset.primary);
    document.documentElement.style.setProperty('--primary-dark', preset.primaryDark);
    document.documentElement.style.setProperty('--primary-soft', preset.primarySoft);
    document.documentElement.style.setProperty('--accent', preset.accent);
    document.documentElement.style.setProperty('--bg', preset.bg);
    localStorage.setItem('portalTheme', themeName);
    setCustomPrimary(preset.primary);
  }, [themeName]);

  const applyCustomPrimary = (color) => {
    setCustomPrimary(color);
    localStorage.setItem('portalPrimary', color);
    document.documentElement.style.setProperty('--primary', color);
  };

  useEffect(() => {
    etudiantsRef.current = etudiants;
    modulesRef.current = modules;
  }, [etudiants, modules]);

  const modulesByGroup = useMemo(() => {
    const result = new Map();
    emplois.forEach((emploi) => {
      const key = String(emploi.groupe);
      if (!result.has(key)) result.set(key, new Set());
      result.get(key).add(emploi.module_nom);
    });
    return new Map(Array.from(result.entries()).map(([key, value]) => [key, Array.from(value).sort((a, b) => a.localeCompare(b))]));
  }, [emplois]);

  const moduleNames = useMemo(
    () => new Map(modules.map((module) => [String(module.id), module.nom])),
    [modules]
  );

  const studentsWithStats = useMemo(() => {
    const groupsById = new Map(groupes.map((groupe) => [String(groupe.id), groupe]));

    return etudiants.map((student) => {
      const studentNotes = notes.filter((note) => String(note.etudiant) === String(student.id));
      const studentAbsences = absences.filter((absence) => String(absence.etudiant) === String(student.id));
      const absencesNonJustifiees = studentAbsences.filter((absence) => !absence.justifiee).length;
      const moyenne = studentNotes.length
        ? studentNotes.reduce((total, note) => total + Number(note.valeur || 0), 0) / studentNotes.length
        : null;
      const prediction = getPrediction(moyenne, studentAbsences.length, absencesNonJustifiees);
      const region = cityRegions[student.ville] || 'Autres regions';
      const group = groupsById.get(String(student.groupe));
      const score = moyenne === null ? 0 : moyenne * 5 - absencesNonJustifiees * 5 - (studentAbsences.length - absencesNonJustifiees) * 1.5;

      return {
        ...student,
        group,
        region,
        moyenne,
        notesCount: studentNotes.length,
        absences: studentAbsences.length,
        absencesNonJustifiees,
        prediction,
        score: Math.max(0, score),
      };
    });
  }, [absences, etudiants, groupes, notes]);

  const rankedStudents = useMemo(
    () => [...studentsWithStats].sort((a, b) =>
      b.score - a.score ||
      (a.nom || '').localeCompare(b.nom || '') ||
      (a.prenom || '').localeCompare(b.prenom || '')
    ),
    [studentsWithStats]
  );

  const predictionRows = useMemo(() => {
    const filtered = selectedGroup === 'all'
      ? studentsWithStats
      : studentsWithStats.filter((student) => String(student.groupe) === String(selectedGroup));
    return [...filtered].sort((a, b) => a.prediction.probability - b.prediction.probability).slice(0, 14);
  }, [selectedGroup, studentsWithStats]);

  const admittedStudents = useMemo(
    () => rankedStudents.filter((student) => student.moyenne !== null && student.moyenne >= 10),
    [rankedStudents]
  );

  useEffect(() => {
    if (admittedStudents.length === 0) return;
    const currentStillExists = admittedStudents.some((student) => String(student.id) === String(certificateStudentId));
    if (!currentStillExists) {
      setCertificateStudentId(String(admittedStudents[0].id));
    }
  }, [admittedStudents, certificateStudentId]);

  const analyticsModules = useMemo(() => {
    const groupId = selectedGroup === 'all' ? groupes[0]?.id : selectedGroup;
    if (!groupId) return [];
    const groupStudents = studentsWithStats.filter((student) => String(student.groupe) === String(groupId));
    const studentIds = new Set(groupStudents.map((student) => String(student.id)));
    const moduleIds = new Set(
      emplois
        .filter((emploi) => String(emploi.groupe) === String(groupId))
        .map((emploi) => String(emploi.module))
    );

    return Array.from(moduleIds).map((moduleId) => {
      const moduleNotes = notes.filter((note) => String(note.module) === moduleId && studentIds.has(String(note.etudiant)));
      const moyenne = moduleNotes.length
        ? moduleNotes.reduce((total, note) => total + Number(note.valeur || 0), 0) / moduleNotes.length
        : 0;
      return {
        module: moduleNames.get(moduleId) || `Module ${moduleId}`,
        moyenne,
      };
    }).sort((a, b) => a.module.localeCompare(b.module));
  }, [emplois, groupes, moduleNames, notes, selectedGroup, studentsWithStats]);

  const analyticsPoints = useMemo(() => {
    if (analyticsModules.length === 0) return '';
    return analyticsModules.map((entry, index) => {
      const x = analyticsModules.length === 1 ? 50 : 8 + (index * 84) / (analyticsModules.length - 1);
      const y = 92 - clamp(entry.moyenne, 0, 20) * 4;
      return `${x},${y}`;
    }).join(' ');
  }, [analyticsModules]);

  const regionData = useMemo(() => {
    const map = new Map();
    studentsWithStats.forEach((student) => {
      if (!map.has(student.region)) map.set(student.region, []);
      map.get(student.region).push(student);
    });
    return Array.from(map.entries())
      .map(([region, students]) => ({
        region,
        students: students.sort((a, b) => (a.nom || '').localeCompare(b.nom || '') || (a.prenom || '').localeCompare(b.prenom || '')),
      }))
      .sort((a, b) => b.students.length - a.students.length || a.region.localeCompare(b.region));
  }, [studentsWithStats]);

  useEffect(() => {
    if (!selectedRegion && regionData.length) {
      setSelectedRegion(regionData[0].region);
    }
  }, [regionData, selectedRegion]);

  const selectedRegionData = regionData.find((entry) => entry.region === selectedRegion) || regionData[0];

  const successCount = studentsWithStats.filter((student) => student.prediction.tone === 'success').length;
  const warningCount = studentsWithStats.filter((student) => student.prediction.tone === 'warning').length;
  const dangerCount = studentsWithStats.filter((student) => student.prediction.tone === 'danger').length;

  useEffect(() => {
    if (!token) {
      navigate('/');
      return;
    }

    Promise.all([
      axios.get(`${API_URL}/etudiants/`, { headers: authHeaders }),
      axios.get(`${API_URL}/notes/`, { headers: authHeaders }),
      axios.get(`${API_URL}/absences/`, { headers: authHeaders }),
      axios.get(`${API_URL}/modules/`, { headers: authHeaders }),
      axios.get(`${API_URL}/emplois/`, { headers: authHeaders }),
      axios.get(`${API_URL}/groupes/`, { headers: authHeaders }),
    ])
      .then(([studentsRes, notesRes, absencesRes, modulesRes, emploisRes, groupesRes]) => {
        setEtudiants(studentsRes.data);
        setNotes(notesRes.data);
        setAbsences(absencesRes.data);
        setModules(modulesRes.data);
        setEmplois(emploisRes.data);
        setGroupes(groupesRes.data);
        maxNoteIdRef.current = Math.max(0, ...notesRes.data.map((note) => Number(note.id)));
        maxAbsenceIdRef.current = Math.max(0, ...absencesRes.data.map((absence) => Number(absence.id)));
        const recent = [
          ...notesRes.data.slice(-4).map((note) => buildEvent('note', note, studentsRes.data, modulesRes.data)),
          ...absencesRes.data.slice(-4).map((absence) => buildEvent('absence', absence, studentsRes.data, modulesRes.data)),
        ].reverse();
        setNotifications(recent);
      })
      .catch(() => navigate('/'))
      .finally(() => setLoading(false));
  }, [authHeaders, navigate, token]);

  const sendBrowserNotification = useCallback((event) => {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    new Notification(event.label, {
      body: `${event.student} - ${event.module} - ${event.detail}`,
    });
  }, []);

  useEffect(() => {
    if (!token) return undefined;
    const interval = setInterval(async () => {
      try {
        const [notesRes, absencesRes] = await Promise.all([
          axios.get(`${API_URL}/notes/`, { headers: authHeaders }),
          axios.get(`${API_URL}/absences/`, { headers: authHeaders }),
        ]);

        const newNotes = notesRes.data.filter((note) => Number(note.id) > maxNoteIdRef.current);
        const newAbsences = absencesRes.data.filter((absence) => Number(absence.id) > maxAbsenceIdRef.current);
        const newEvents = [
          ...newNotes.map((note) => buildEvent('note', note, etudiantsRef.current, modulesRef.current)),
          ...newAbsences.map((absence) => buildEvent('absence', absence, etudiantsRef.current, modulesRef.current)),
        ].reverse();

        setNotes(notesRes.data);
        setAbsences(absencesRes.data);
        maxNoteIdRef.current = Math.max(0, ...notesRes.data.map((note) => Number(note.id)));
        maxAbsenceIdRef.current = Math.max(0, ...absencesRes.data.map((absence) => Number(absence.id)));

        if (newEvents.length) {
          setNotifications((previous) => [...newEvents, ...previous].slice(0, 12));
          newEvents.forEach(sendBrowserNotification);
          setLiveStatus(`${newEvents.length} nouvelle(s) alerte(s) detectee(s)`);
        } else {
          setLiveStatus('Surveillance active');
        }
      } catch (err) {
        setLiveStatus('Connexion live indisponible');
      }
    }, 7000);

    return () => clearInterval(interval);
  }, [authHeaders, sendBrowserNotification, token]);

  const requestBrowserNotifications = async () => {
    if (!('Notification' in window)) {
      setLiveStatus('Notifications navigateur non supportees');
      return;
    }
    const permission = await Notification.requestPermission();
    setLiveStatus(permission === 'granted' ? 'Notifications navigateur activees' : 'Notifications navigateur refusees');
  };

  const handleChatSubmit = (event) => {
    event.preventDefault();
    const question = chatInput.trim();
    if (!question) return;
    const answer = answerQuestion(question, rankedStudents, groupes, modulesByGroup);
    setChatMessages((messages) => [
      ...messages,
      { role: 'user', text: question },
      { role: 'assistant', text: answer },
    ].slice(-10));
    setChatInput('');
  };

  const markPresence = useCallback((rawValue) => {
    const code = rawValue.trim();
    if (!code) return false;
    const normalizedCode = normalize(code.replace('matricule:', '').replace('student:', '').trim());
    if (!normalizedCode) {
      setQrMessage('Code QR vide ou invalide');
      return false;
    }
    const student = studentsWithStats.find((entry) => {
      const haystack = normalize([
        entry.matricule,
        entry.username,
        entry.nom,
        entry.prenom,
        fullName(entry),
      ].join(' '));
      return haystack.includes(normalizedCode) || normalizedCode.includes(normalize(entry.matricule || ''));
    });

    if (!student) {
      setQrMessage(`Code non reconnu: ${code}`);
      return false;
    }

    const scannedAt = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    setPresenceLog((previous) => [
      {
        id: `${student.id}-${Date.now()}`,
        name: fullName(student),
        matricule: student.matricule,
        group: student.groupe_code,
        scannedAt,
      },
      ...previous,
    ].slice(0, 10));
    setQrMessage(`${fullName(student)} marque present a ${scannedAt}`);
    return true;
  }, [studentsWithStats]);

  const stopScanner = useCallback(() => {
    scanningRef.current = false;
    if (frameRef.current) window.cancelAnimationFrame(frameRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setQrScanning(false);
  }, []);

  const detectLoop = useCallback(async () => {
    if (!scanningRef.current || !videoRef.current || !detectorRef.current) return;
    try {
      const codes = await detectorRef.current.detect(videoRef.current);
      if (codes.length && markPresence(codes[0].rawValue || '')) {
        stopScanner();
        return;
      }
    } catch (err) {
      setQrMessage('Lecture camera impossible pour le moment');
    }
    frameRef.current = window.requestAnimationFrame(detectLoop);
  }, [markPresence, stopScanner]);

  const startScanner = async () => {
    if (!navigator.mediaDevices?.getUserMedia || !window.BarcodeDetector) {
      setQrMessage('Scanner camera non supporte par ce navigateur. Utilisez la saisie manuelle.');
      return;
    }
    try {
      detectorRef.current = new window.BarcodeDetector({ formats: ['qr_code'] });
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      scanningRef.current = true;
      setQrScanning(true);
      setQrMessage('Scanner actif');
      detectLoop();
    } catch (err) {
      setQrMessage('Autorisation camera refusee ou indisponible');
    }
  };

  useEffect(() => () => stopScanner(), [stopScanner]);

  const handleManualPresence = (event) => {
    event.preventDefault();
    if (markPresence(qrInput)) setQrInput('');
  };

  const sampleQrStudent = rankedStudents[0];
  const selectedCertificateStudent = admittedStudents.find((student) => String(student.id) === String(certificateStudentId)) || admittedStudents[0];

  const nextMonday = () => {
    const now = new Date();
    const day = now.getDay();
    const diff = (8 - day) % 7 || 7;
    const next = new Date(now);
    next.setDate(now.getDate() + diff);
    next.setHours(8, 30, 0, 0);
    return next;
  };

  const generateWeeklyReport = useCallback((mode = 'manual') => {
    const doc = new jsPDF();
    const generatedAt = new Date();

    doc.setFontSize(22);
    doc.setTextColor(127, 23, 52);
    doc.text('Portail Absences', 14, 20);
    doc.setFontSize(14);
    doc.setTextColor(17, 20, 23);
    doc.text('Rapport hebdomadaire automatique', 14, 30);
    doc.setFontSize(10);
    doc.text(`Genere le ${generatedAt.toLocaleDateString('fr-FR')} a ${generatedAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`, 14, 38);

    autoTable(doc, {
      startY: 48,
      head: [['Indicateur', 'Valeur']],
      body: [
        ['Etudiants', studentsWithStats.length],
        ['Notes', notes.length],
        ['Absences', absences.length],
        ['Reussite probable', successCount],
        ['Vigilance', warningCount],
        ['Risque eleve', dangerCount],
      ],
      styles: { fontSize: 10, cellPadding: 3 },
      headStyles: { fillColor: [127, 23, 52], textColor: [255, 255, 255] },
    });

    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 12,
      head: [['Rang', 'Etudiant', 'Groupe', 'Moyenne', 'Score']],
      body: rankedStudents.slice(0, 10).map((student, index) => [
        `#${index + 1}`,
        fullName(student),
        student.groupe_code,
        formatMoyenne(student.moyenne),
        student.score.toFixed(1),
      ]),
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [17, 17, 19], textColor: [255, 255, 255] },
    });

    doc.addPage();
    doc.setFontSize(14);
    doc.text('Etudiants a surveiller', 14, 20);
    autoTable(doc, {
      startY: 28,
      head: [['Etudiant', 'Groupe', 'Moyenne', 'Absences', 'Prediction']],
      body: predictionRows.slice(0, 14).map((student) => [
        fullName(student),
        student.groupe_code,
        formatMoyenne(student.moyenne),
        student.absences,
        student.prediction.label,
      ]),
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [127, 23, 52], textColor: [255, 255, 255] },
    });

    doc.addPage();
    doc.setFontSize(14);
    doc.text('Repartition regionale', 14, 20);
    autoTable(doc, {
      startY: 28,
      head: [['Region', 'Nombre etudiants']],
      body: regionData.map((entry) => [entry.region, entry.students.length]),
      styles: { fontSize: 10, cellPadding: 3 },
      headStyles: { fillColor: [17, 17, 19], textColor: [255, 255, 255] },
    });

    doc.save(`rapport_hebdomadaire_${generatedAt.toISOString().slice(0, 10)}.pdf`);
    const nextDate = nextMonday();
    localStorage.setItem('weeklyReportNextRun', nextDate.toISOString());
    localStorage.setItem('weeklyReportStatus', `Dernier rapport ${mode === 'auto' ? 'automatique' : 'manuel'}: ${generatedAt.toLocaleDateString('fr-FR')}. Prochain: ${nextDate.toLocaleDateString('fr-FR')}`);
    setReportStatus(localStorage.getItem('weeklyReportStatus'));
  }, [absences.length, dangerCount, notes.length, predictionRows, rankedStudents, regionData, studentsWithStats.length, successCount, warningCount]);

  const scheduleWeeklyReport = () => {
    const nextDate = nextMonday();
    const message = `Rapport hebdomadaire planifie pour le ${nextDate.toLocaleDateString('fr-FR')} a 08:30. Generation automatique lorsque cette page est ouverte.`;
    localStorage.setItem('weeklyReportNextRun', nextDate.toISOString());
    localStorage.setItem('weeklyReportStatus', message);
    setReportStatus(message);
  };

  useEffect(() => {
    const nextRun = localStorage.getItem('weeklyReportNextRun');
    if (!nextRun || loading || studentsWithStats.length === 0) return;
    const nextDate = new Date(nextRun);
    if (Number.isNaN(nextDate.getTime()) || nextDate > new Date()) return;
    generateWeeklyReport('auto');
  }, [generateWeeklyReport, loading, studentsWithStats.length]);

  const generateCertificate = () => {
    const student = selectedCertificateStudent;
    if (!student) {
      setCertificateStatus('Aucun etudiant admis disponible pour le certificat.');
      return;
    }

    try {
      const doc = new jsPDF('landscape', 'mm', 'a4');
      const fileSafeName = fullName(student)
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
      doc.text(fullName(student), 148, 108, { align: 'center' });

      doc.setFontSize(13);
      doc.setTextColor(75, 85, 99);
      doc.text(`Matricule: ${student.matricule || student.id}`, 148, 124, { align: 'center' });
      doc.text(`${student.groupe_code} - ${student.filiere_nom || student.filiere_code || 'Filiere'}`, 148, 136, { align: 'center' });
      doc.text(`Moyenne generale: ${formatMoyenne(student.moyenne)}`, 148, 148, { align: 'center' });

      doc.setFontSize(11);
      doc.setTextColor(17, 17, 19);
      doc.text('Administration pedagogique', 65, 176, { align: 'center' });
      doc.line(34, 168, 96, 168);
      doc.text(`Genere le ${new Date().toLocaleDateString('fr-FR')}`, 232, 176, { align: 'center' });
      doc.line(202, 168, 262, 168);

      doc.save(`certificat_reussite_${fileSafeName || student.id}.pdf`);
      setCertificateStatus(`Certificat genere pour ${fullName(student)}.`);
    } catch (err) {
      setCertificateStatus('Erreur lors de la generation du certificat PDF.');
    }
  };

  const sendInternalMessage = (event) => {
    event.preventDefault();
    const target = studentsWithStats.find((student) => String(student.id) === String(messageTarget));
    if (!target || !messageText.trim()) return;
    const entry = {
      id: Date.now(),
      from: 'Administration / Enseignant',
      to: fullName(target),
      group: target.groupe_code,
      text: messageText.trim(),
      date: new Date().toLocaleString('fr-FR'),
      status: 'Envoye',
    };
    const updated = [entry, ...messages].slice(0, 20);
    setMessages(updated);
    localStorage.setItem('internalMessages', JSON.stringify(updated));
    setMessageText('');
  };

  return (
    <div className="app-shell" dir={pageDirection}>
      <nav className="app-nav">
        <div className="brand">
          <div className="brand-mark">IA</div>
          <div className="brand-text">
            <span className="brand-title">Portail Absences</span>
            <span className="brand-subtitle">{t.subtitle}</span>
          </div>
        </div>
        <div className="nav-actions">
          <div className="notification-bell-wrap">
            <button className="notification-bell" type="button" onClick={() => setShowAlerts((value) => !value)} aria-label={t.bell}>
              <span>AL</span>
              {notifications.length > 0 && <strong>{notifications.length}</strong>}
            </button>
            {showAlerts && (
              <div className="notification-popover">
                <div className="notification-popover-title">{t.bell}</div>
                {notifications.slice(0, 5).map((item) => (
                  <div className="notification-popover-item" key={`bell-${item.id}`}>
                    <strong>{item.label}</strong>
                    <span>{item.student} - {item.detail}</span>
                  </div>
                ))}
                {notifications.length === 0 && <p className="empty-state">Aucune alerte live</p>}
              </div>
            )}
          </div>
          <button className="btn btn-soft" onClick={() => navigate('/dashboard')}>Dashboard</button>
          <button className="btn btn-accent" onClick={() => { localStorage.clear(); navigate('/'); }}>Deconnexion</button>
        </div>
      </nav>

      <main className="page page-wide">
        <header className="page-header intelligence-header">
          <div>
            <p className="kicker">Services intelligents</p>
            <h1 className="page-title">{t.quickTitle}</h1>
            <p className="page-description">
              {t.quickDesc}
            </p>
          </div>
        </header>

        <section className="stats-grid dashboard-stats" aria-label="Resume intelligence">
          <article className="stat-card success">
            <div className="icon-tile">OK</div>
            <div>
              <div className="stat-value">{successCount}</div>
              <p className="stat-label">Reussite probable</p>
            </div>
          </article>
          <article className="stat-card warning">
            <div className="icon-tile">VI</div>
            <div>
              <div className="stat-value">{warningCount}</div>
              <p className="stat-label">Vigilance</p>
            </div>
          </article>
          <article className="stat-card accent">
            <div className="icon-tile">AL</div>
            <div>
              <div className="stat-value">{dangerCount}</div>
              <p className="stat-label">Risque eleve</p>
            </div>
          </article>
          <article className="stat-card">
            <div className="icon-tile">RG</div>
            <div>
              <div className="stat-value">{regionData.length}</div>
              <p className="stat-label">Regions actives</p>
            </div>
          </article>
        </section>

        <section className="intelligence-grid automation-grid">
          <article className="panel smart-control-panel">
            <div className="panel-header">
              <div>
                <h2 className="panel-title">{t.language}</h2>
                <p className="panel-subtitle">Arabic, Francais, English</p>
              </div>
            </div>
            <div className="smart-control-body">
              <div className="segmented-control">
                {[
                  ['fr', 'FR'],
                  ['en', 'EN'],
                  ['ar', 'AR'],
                ].map(([value, label]) => (
                  <button className={language === value ? 'active' : ''} key={value} type="button" onClick={() => setLanguage(value)}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </article>

          <article className="panel smart-control-panel">
            <div className="panel-header">
              <div>
                <h2 className="panel-title">{t.theme}</h2>
                <p className="panel-subtitle">{t.customTheme}</p>
              </div>
            </div>
            <div className="smart-control-body">
              <div className="theme-swatch-row">
                {Object.entries(themePresets).map(([key, preset]) => (
                  <button
                    className={themeName === key ? 'theme-swatch active' : 'theme-swatch'}
                    key={key}
                    type="button"
                    style={{ background: preset.primary }}
                    onClick={() => setThemeName(key)}
                    title={preset.label}
                  />
                ))}
                <input
                  aria-label={t.customTheme}
                  className="theme-color-input"
                  type="color"
                  value={customPrimary}
                  onChange={(event) => applyCustomPrimary(event.target.value)}
                />
              </div>
            </div>
          </article>

          <article className="panel smart-control-panel">
            <div className="panel-header">
              <div>
                <h2 className="panel-title">{t.weeklyReport}</h2>
                <p className="panel-subtitle">{t.weeklyReportDesc}</p>
              </div>
            </div>
            <div className="smart-control-body">
              <div className="button-row">
                <button className="btn btn-primary" type="button" onClick={() => generateWeeklyReport('manual')}>{t.generate}</button>
                <button className="btn btn-soft" type="button" onClick={scheduleWeeklyReport}>{t.schedule}</button>
              </div>
              <p className="automation-status">{reportStatus}</p>
            </div>
          </article>

          <article className="panel smart-control-panel">
            <div className="panel-header">
              <div>
                <h2 className="panel-title">{t.certificate}</h2>
                <p className="panel-subtitle">{t.certificateDesc}</p>
              </div>
            </div>
            <div className="smart-control-body">
              {admittedStudents.length === 0 ? (
                <p className="empty-state">Aucun etudiant admis pour le moment.</p>
              ) : (
                <>
                  <select className="form-control" value={certificateStudentId} onChange={(event) => setCertificateStudentId(event.target.value)}>
                    {admittedStudents.slice(0, 80).map((student) => (
                      <option key={student.id} value={student.id}>
                        {fullName(student)} - {student.groupe_code} - {formatMoyenne(student.moyenne)}
                      </option>
                    ))}
                  </select>
                  {selectedCertificateStudent && (
                    <div className="certificate-preview">
                      <strong>{fullName(selectedCertificateStudent)}</strong>
                      <span>{selectedCertificateStudent.matricule} - {selectedCertificateStudent.groupe_code}</span>
                      <span>Moyenne: {formatMoyenne(selectedCertificateStudent.moyenne)}</span>
                    </div>
                  )}
                </>
              )}
              <button className="btn btn-accent" type="button" onClick={generateCertificate} disabled={!selectedCertificateStudent}>
                PDF certificat
              </button>
              {certificateStatus && <p className="automation-status">{certificateStatus}</p>}
            </div>
          </article>

        </section>

        <section className="intelligence-grid primary-grid">
          <article className="panel ai-chat-panel">
            <div className="panel-header">
              <div>
                <h2 className="panel-title">Chatbot IA</h2>
                <p className="panel-subtitle">Assistant intelligent sur les etudiants, groupes, absences et resultats.</p>
              </div>
              <span className="badge badge-primary">{loading ? 'Chargement' : `${studentsWithStats.length} profils`}</span>
            </div>
            <div className="chat-window">
              {chatMessages.map((message, index) => (
                <div className={`chat-bubble ${message.role}`} key={`${message.role}-${index}`}>
                  {message.text}
                </div>
              ))}
            </div>
            <form className="chat-form" onSubmit={handleChatSubmit}>
              <input
                className="form-control"
                value={chatInput}
                onChange={(event) => setChatInput(event.target.value)}
                placeholder="Ex: prediction Lina Ait Omar, classement, absences GL-3A-G1..."
              />
              <button className="btn btn-primary" type="submit">Envoyer</button>
            </form>
          </article>

          <article className="panel live-panel">
            <div className="panel-header">
              <div>
                <h2 className="panel-title">Notifications en temps reel</h2>
                <p className="panel-subtitle">{liveStatus}</p>
              </div>
              <button className="btn btn-soft" type="button" onClick={requestBrowserNotifications}>Activer</button>
            </div>
            <div className="notification-feed">
              {notifications.length === 0 ? (
                <p className="empty-state">Aucune notification pour le moment</p>
              ) : notifications.map((item) => (
                <div className={`notification-item ${item.type}`} key={item.id}>
                  <span className="notification-dot" />
                  <div>
                    <strong>{item.label}</strong>
                    <p>{item.student} - {item.group} - {item.module}</p>
                  </div>
                  <span>{item.detail}</span>
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className="intelligence-grid secondary-grid">
          <article className="panel messaging-panel">
            <div className="panel-header">
              <div>
                <h2 className="panel-title">{t.messaging}</h2>
                <p className="panel-subtitle">{t.messagingDesc}</p>
              </div>
              <span className="badge badge-primary">{messages.length} message(s)</span>
            </div>
            <form className="messaging-form" onSubmit={sendInternalMessage}>
              <select className="form-control" value={messageTarget} onChange={(event) => setMessageTarget(event.target.value)} required>
                <option value="">Choisir un etudiant</option>
                {rankedStudents.slice(0, 80).map((student) => (
                  <option key={student.id} value={student.id}>
                    {fullName(student)} - {student.groupe_code}
                  </option>
                ))}
              </select>
              <textarea
                className="form-control"
                value={messageText}
                onChange={(event) => setMessageText(event.target.value)}
                placeholder="Message interne..."
                rows="4"
                required
              />
              <button className="btn btn-primary" type="submit">{t.send}</button>
            </form>
            <div className="message-feed">
              {messages.length === 0 ? (
                <p className="empty-state">Aucun message interne</p>
              ) : messages.slice(0, 6).map((message) => (
                <div className="message-card" key={message.id}>
                  <div>
                    <strong>{message.to}</strong>
                    <span>{message.group} - {message.date}</span>
                  </div>
                  <p>{message.text}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="panel analytics-evolution-panel">
            <div className="panel-header">
              <div>
                <h2 className="panel-title">{t.analytics}</h2>
                <p className="panel-subtitle">{t.analyticsDesc}</p>
              </div>
              <select className="form-control compact-select" value={selectedGroup} onChange={(event) => setSelectedGroup(event.target.value)}>
                <option value="all">Premier groupe</option>
                {groupes.map((groupe) => (
                  <option key={groupe.id} value={groupe.id}>{groupe.code}</option>
                ))}
              </select>
            </div>
            <div className="evolution-chart">
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="Evolution des notes">
                <polyline points={analyticsPoints} />
              </svg>
              <div className="evolution-bars">
                {analyticsModules.map((entry) => (
                  <div className="evolution-bar" key={entry.module}>
                    <span>{entry.module}</span>
                    <div>
                      <i style={{ width: `${clamp((entry.moyenne / 20) * 100, 0, 100)}%` }} />
                    </div>
                    <strong>{entry.moyenne.toFixed(1)}</strong>
                  </div>
                ))}
              </div>
            </div>
          </article>

          <article className="panel map-panel">
            <div className="panel-header">
              <div>
                <h2 className="panel-title">Carte interactive par region</h2>
                <p className="panel-subtitle">Repartition des etudiants selon la ville et la region.</p>
              </div>
              <span className="badge badge-primary">{studentsWithStats.length} etudiants</span>
            </div>
            <div className="region-map">
              {regionData.map((entry) => (
                <button
                  className={`region-card ${selectedRegion === entry.region ? 'active' : ''}`}
                  key={entry.region}
                  type="button"
                  onClick={() => setSelectedRegion(entry.region)}
                >
                  <span>{entry.region}</span>
                  <strong>{entry.students.length}</strong>
                </button>
              ))}
            </div>
            <div className="region-detail">
              <div className="region-detail-header">
                <div>
                  <span className="eyebrow">Region selectionnee</span>
                  <h3>{selectedRegionData?.region || 'Aucune region'}</h3>
                </div>
                <span className="badge badge-success">{selectedRegionData?.students.length || 0} etudiant(s)</span>
              </div>
              <div className="region-student-list">
                {(selectedRegionData?.students || []).slice(0, 8).map((student) => (
                  <div key={student.id}>
                    <strong>{fullName(student)}</strong>
                    <span>{student.groupe_code} - {student.ville}</span>
                  </div>
                ))}
              </div>
            </div>
          </article>

          <article className="panel prediction-panel">
            <div className="panel-header">
              <div>
                <h2 className="panel-title">Prediction IA avancee</h2>
                <p className="panel-subtitle">Score calcule avec moyenne, absences et absences non justifiees.</p>
              </div>
              <select className="form-control compact-select" value={selectedGroup} onChange={(event) => setSelectedGroup(event.target.value)}>
                <option value="all">Tous les groupes</option>
                {groupes.map((groupe) => (
                  <option key={groupe.id} value={groupe.id}>{groupe.code}</option>
                ))}
              </select>
            </div>
            <div className="table-wrap">
              <table className="data-table prediction-table">
                <thead>
                  <tr>
                    <th>Etudiant</th>
                    <th>Groupe</th>
                    <th>Moyenne</th>
                    <th>Abs.</th>
                    <th>Prediction</th>
                    <th>Confiance</th>
                  </tr>
                </thead>
                <tbody>
                  {predictionRows.map((student) => (
                    <tr key={student.id}>
                      <td><strong>{fullName(student)}</strong></td>
                      <td>{student.groupe_code}</td>
                      <td>{formatMoyenne(student.moyenne)}</td>
                      <td>{student.absences}</td>
                      <td><span className={`badge badge-${student.prediction.tone}`}>{student.prediction.label}</span></td>
                      <td>{student.prediction.confidence}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>

          <article className="panel qr-panel">
            <div className="panel-header">
              <div>
                <h2 className="panel-title">Scanner QR Code</h2>
                <p className="panel-subtitle">Marquage de presence par matricule scanne.</p>
              </div>
              <span className="badge badge-primary">{presenceLog.length} scan(s)</span>
            </div>
            <div className="qr-layout">
              <div className="qr-camera">
                <video ref={videoRef} playsInline muted />
                <div className="qr-camera-overlay">{qrScanning ? 'Lecture en cours' : 'Camera prete'}</div>
              </div>
              <div className="qr-actions">
                <div className="button-row">
                  <button className="btn btn-primary" type="button" onClick={startScanner} disabled={qrScanning}>Scanner</button>
                  <button className="btn btn-soft" type="button" onClick={stopScanner}>Arreter</button>
                </div>
                <form className="manual-qr-form" onSubmit={handleManualPresence}>
                  <input
                    className="form-control"
                    value={qrInput}
                    onChange={(event) => setQrInput(event.target.value)}
                    placeholder={sampleQrStudent?.matricule || 'Matricule etudiant'}
                  />
                  <button className="btn btn-accent" type="submit">Marquer</button>
                </form>
                {qrMessage && <p className="qr-message">{qrMessage}</p>}
              </div>
            </div>
            <div className="presence-log">
              {presenceLog.length === 0 ? (
                <p className="empty-state">Aucune presence scannee</p>
              ) : presenceLog.map((presence) => (
                <div key={presence.id}>
                  <strong>{presence.name}</strong>
                  <span>{presence.group} - {presence.matricule} - {presence.scannedAt}</span>
                </div>
              ))}
            </div>
          </article>

          <article className="panel ranking-panel">
            <div className="panel-header">
              <div>
                <h2 className="panel-title">Classement des meilleurs etudiants</h2>
                <p className="panel-subtitle">Ranking selon moyenne et assiduite.</p>
              </div>
              <span className="badge badge-success">Top {Math.min(10, rankedStudents.length)}</span>
            </div>
            <div className="podium">
              {rankedStudents.slice(0, 3).map((student, index) => (
                <div className={`podium-card rank-${index + 1}`} key={student.id}>
                  <span>#{index + 1}</span>
                  <strong>{fullName(student)}</strong>
                  <p>{student.groupe_code} - {formatMoyenne(student.moyenne)}</p>
                </div>
              ))}
            </div>
            <div className="ranking-list">
              {rankedStudents.slice(0, 10).map((student, index) => (
                <div className="ranking-row" key={student.id}>
                  <span>#{index + 1}</span>
                  <strong>{fullName(student)}</strong>
                  <em>{student.groupe_code}</em>
                  <b>{student.score.toFixed(1)}</b>
                </div>
              ))}
            </div>
          </article>
        </section>
      </main>
    </div>
  );
}

export default Intelligence;
