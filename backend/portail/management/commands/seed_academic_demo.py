from datetime import date, time, timedelta
import unicodedata

from django.contrib.auth.hashers import make_password
from django.core.management.base import BaseCommand
from django.db import transaction

from portail.models import Absence, EmploiDuTemps, Etudiant, Filiere, Groupe, Module, Note, User


FILIERES = [
    ('CPI', 'Cycle preparatoire integre', 'preparatoire', 'Tronc commun scientifique et informatique sur deux ans.'),
    ('GL', 'Genie Logiciel', 'ingenieur', 'Conception, developpement, qualite logicielle et DevOps.'),
    ('IR', 'Informatique et Reseaux', 'ingenieur', 'Systemes, reseaux, administration et securite des infrastructures.'),
    ('IADS', 'Intelligence Artificielle et Data Science', 'ingenieur', 'Data, machine learning, intelligence artificielle et decisionnel.'),
    ('SIBD', 'Systemes d Information et Big Data', 'ingenieur', 'Systemes d information, ERP, BI et plateformes big data.'),
    ('CCN', 'Cybersecurite et Confiance Numerique', 'ingenieur', 'Securite applicative, cryptographie, SOC et audit cyber.'),
    ('CCD', 'Cloud Computing et DevOps', 'ingenieur', 'Cloud, conteneurs, automatisation, microservices et CI CD.'),
    ('ISI', 'Ingenierie des Systemes Informatiques', 'ingenieur', 'Architecture SI, bases avancees, integration et gestion de projets.'),
    ('IOT', 'Systemes Embarques et IoT', 'ingenieur', 'Objets connectes, systemes embarques et reseaux de capteurs.'),
    ('MIA', 'Master IA et Data Engineering', 'master', 'Specialite master orientee IA, data engineering et MLOps.'),
    ('MRI', 'Master Reseaux et Systemes', 'master', 'Specialite master orientee reseaux avances, cloud prive et supervision.'),
    ('MCY', 'Master Cybersecurite', 'master', 'Specialite master orientee SOC, pentest, gouvernance et forensic.'),
    ('MCD', 'Master Cloud et DevOps', 'master', 'Specialite master orientee architectures cloud, Kubernetes et DevSecOps.'),
    ('MGL', 'Master Genie Logiciel Avance', 'master', 'Specialite master orientee architecture logicielle et qualite avancee.'),
    ('MSI', 'Master Systemes d Information et ERP', 'master', 'Specialite master orientee urbanisation SI, ERP et pilotage metier.'),
    ('MSE', 'Master Systemes Embarques et IoT', 'master', 'Specialite master orientee embarque, IoT industriel et edge computing.'),
]

GROUPES = [
    ('CPI-1A-G1', '1A', 1, 'preparatoire', 'CPI'),
    ('CPI-1A-G2', '1A', 1, 'preparatoire', 'CPI'),
    ('CPI-2A-G1', '2A', 2, 'preparatoire', 'CPI'),
    ('CPI-2A-G2', '2A', 2, 'preparatoire', 'CPI'),
    ('GL-3A-G1', '3A', 3, 'ingenieur', 'GL'),
    ('IR-3A-G1', '3A', 3, 'ingenieur', 'IR'),
    ('IADS-3A-G1', '3A', 3, 'ingenieur', 'IADS'),
    ('SIBD-3A-G1', '3A', 3, 'ingenieur', 'SIBD'),
    ('CCN-3A-G1', '3A', 3, 'ingenieur', 'CCN'),
    ('CCD-3A-G1', '3A', 3, 'ingenieur', 'CCD'),
    ('ISI-3A-G1', '3A', 3, 'ingenieur', 'ISI'),
    ('IOT-3A-G1', '3A', 3, 'ingenieur', 'IOT'),
    ('MIA-4A-G1', '4A', 4, 'master', 'MIA'),
    ('MRI-4A-G1', '4A', 4, 'master', 'MRI'),
    ('MCY-4A-G1', '4A', 4, 'master', 'MCY'),
    ('MCD-4A-G1', '4A', 4, 'master', 'MCD'),
    ('MGL-4A-G1', '4A', 4, 'master', 'MGL'),
    ('MSI-4A-G1', '4A', 4, 'master', 'MSI'),
    ('MSE-4A-G1', '4A', 4, 'master', 'MSE'),
    ('MIA-5A-G1', '5A', 5, 'master', 'MIA'),
    ('MRI-5A-G1', '5A', 5, 'master', 'MRI'),
    ('MCY-5A-G1', '5A', 5, 'master', 'MCY'),
    ('MCD-5A-G1', '5A', 5, 'master', 'MCD'),
    ('MGL-5A-G1', '5A', 5, 'master', 'MGL'),
    ('MSI-5A-G1', '5A', 5, 'master', 'MSI'),
    ('MSE-5A-G1', '5A', 5, 'master', 'MSE'),
]

MODULES = {
    ('1A', 'CPI'): [
        'Analyse 1',
        'Algebre 1',
        'Algorithmique et Python',
        'Architecture des ordinateurs',
        'Expression francaise',
        'English for Engineers 1',
    ],
    ('2A', 'CPI'): [
        'Analyse 2',
        'Probabilites et statistiques',
        'Programmation orientee objet Java',
        'Bases de donnees SQL',
        'Systemes d exploitation',
        'English for Engineers 2',
    ],
    ('3A', 'GL'): [
        'UML et Genie logiciel',
        'Developpement Web Full Stack',
        'Tests logiciels et qualite',
        'Bases de donnees SQL',
        'DevOps et CI CD',
        'Communication professionnelle',
    ],
    ('3A', 'IR'): [
        'Reseaux informatiques fondamentaux',
        'Administration reseaux',
        'Routage et commutation',
        'Systemes Linux',
        'Securite reseaux',
        'English for Engineers 2',
    ],
    ('3A', 'IADS'): [
        'Machine Learning',
        'Data Mining',
        'NoSQL et Big Data',
        'Probabilites et statistiques',
        'Business Intelligence',
        'English for Engineers 2',
    ],
    ('3A', 'SIBD'): [
        'Urbanisation SI',
        'ERP et processus metiers',
        'Business Intelligence',
        'NoSQL et Big Data',
        'Bases de donnees SQL',
        'Communication professionnelle',
    ],
    ('3A', 'CCN'): [
        'Securite applicative',
        'Cryptographie appliquee',
        'Ethical Hacking',
        'Systemes Linux',
        'Administration reseaux',
        'English for Engineers 2',
    ],
    ('3A', 'CCD'): [
        'Cloud Computing',
        'DevOps et CI CD',
        'Conteneurisation Docker',
        'Systemes Linux',
        'Architecture Microservices',
        'English for Engineers 2',
    ],
    ('3A', 'ISI'): [
        'Architecture logicielle',
        'Ingenierie des exigences',
        'Systemes distribues',
        'Bases de donnees avancees',
        'Gestion de projet SI',
        'Communication professionnelle',
    ],
    ('3A', 'IOT'): [
        'Systemes embarques',
        'Internet des objets',
        'Electronique numerique',
        'Reseaux de capteurs',
        'Programmation C embarque',
        'English for Engineers 2',
    ],
    ('4A', 'MIA'): [
        'Deep Learning',
        'Data Engineering',
        'MLOps',
        'Cloud Computing',
        'Projet IA applique',
        'Communication professionnelle',
    ],
    ('5A', 'MIA'): [
        'NLP et Vision par ordinateur',
        'Big Data Analytics',
        'IA generative',
        'Gouvernance des donnees',
        'Projet de fin d etudes',
        'English for Engineers 3',
    ],
    ('4A', 'MRI'): [
        'Virtualisation et Supervision',
        'Administration reseaux avancee',
        'Routage avance',
        'Systemes Linux',
        'Securite reseaux',
        'Communication professionnelle',
    ],
    ('5A', 'MRI'): [
        'Architecture Data Center',
        'Reseaux SDN',
        'Haute disponibilite',
        'Cloud prive',
        'Projet de fin d etudes',
        'English for Engineers 3',
    ],
    ('4A', 'MCY'): [
        'Forensic et SOC',
        'Ethical Hacking',
        'Securite applicative',
        'Cryptographie appliquee',
        'Audit et gouvernance cyber',
        'English for Engineers 2',
    ],
    ('5A', 'MCY'): [
        'Pentest avance',
        'Blue Team et SIEM',
        'GRC cyber',
        'Reverse engineering',
        'Projet de fin d etudes',
        'Communication professionnelle',
    ],
    ('4A', 'MCD'): [
        'Kubernetes et IaC',
        'Architecture Microservices',
        'MLOps',
        'Projet cloud applique',
        'Cloud Computing',
        'Communication professionnelle',
    ],
    ('5A', 'MCD'): [
        'DevSecOps',
        'SRE et observabilite',
        'Cloud hybride',
        'FinOps',
        'Projet de fin d etudes',
        'English for Engineers 3',
    ],
    ('4A', 'MGL'): [
        'Architecture Microservices',
        'Qualite logicielle avancee',
        'UML et Genie logiciel',
        'DevOps et CI CD',
        'Projet de fin d etudes',
        'English for Engineers 2',
    ],
    ('5A', 'MGL'): [
        'Software Craftsmanship',
        'Architecture Hexagonale',
        'Tests automatises avances',
        'Scalabilite applicative',
        'Projet de fin d etudes',
        'Communication professionnelle',
    ],
    ('4A', 'MSI'): [
        'Urbanisation SI',
        'ERP et processus metiers',
        'Business Intelligence',
        'Gouvernance SI',
        'Integration applicative',
        'Communication professionnelle',
    ],
    ('5A', 'MSI'): [
        'Architecture entreprise',
        'Pilotage de la transformation digitale',
        'Data Warehouse',
        'Management des processus',
        'Projet de fin d etudes',
        'English for Engineers 3',
    ],
    ('4A', 'MSE'): [
        'Systemes temps reel',
        'IoT industriel',
        'Edge Computing',
        'Protocoles embarques',
        'Securite IoT',
        'Communication professionnelle',
    ],
    ('5A', 'MSE'): [
        'Robotics Software',
        'Vision embarquee',
        'Plateformes ARM',
        'Maintenance predictive IoT',
        'Projet de fin d etudes',
        'English for Engineers 3',
    ],
}

TIME_SLOTS = [
    (time(8, 30), time(10, 0)),
    (time(10, 15), time(11, 45)),
    (time(14, 30), time(16, 0)),
    (time(16, 15), time(17, 45)),
]

DAYS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi']
TEACHERS = ['Pr. Alaoui', 'Pr. Benjelloun', 'Pr. Idrissi', 'Pr. Mansouri', 'Pr. Berrada', 'Pr. El Amrani', 'Pr. Fadili', 'Pr. Lamrani']
ROOMS = ['A101', 'A102', 'B201', 'B204', 'C301', 'Lab 1', 'Lab 2', 'Lab Reseaux', 'Lab Cloud', 'Lab Cyber']
SESSION_TYPES = ['cours', 'td', 'tp', 'atelier']

FIRST_NAMES = [
    'Lina', 'Sara', 'Hiba', 'Nora', 'Yasmine', 'Imane', 'Aya', 'Salma', 'Meriem', 'Fatima',
    'Youssef', 'Hamza', 'Mehdi', 'Zakaria', 'Reda', 'Anas', 'Omar', 'Adam', 'Ilyas', 'Amine',
    'Rania', 'Mouna', 'Kenza', 'Sofia', 'Malak', 'Nadia', 'Chaimae', 'Ines', 'Ghita', 'Nour',
    'Bilal', 'Ayoub', 'Saad', 'Taha', 'Karim', 'Sami', 'Nabil', 'Othmane', 'Walid', 'Adil',
]

LAST_NAMES = [
    'Ait Omar', 'Bennani', 'El Alami', 'Bouhaddou', 'Cherkaoui', 'Benali', 'Alaoui', 'Bakkali',
    'Benomar', 'Idrissi', 'Mansouri', 'El Fassi', 'Lahlou', 'Tazi', 'Kabbaj', 'Raji',
    'Amrani', 'Berrada', 'Fadili', 'Lamrani', 'Chraibi', 'Sefrioui', 'Haddad', 'Najmi',
    'Belkadi', 'Ouazzani', 'El Harrak', 'Zerouali', 'Mernissi', 'Sabri', 'Naciri', 'Essafi',
]

CITIES = ['Casablanca', 'Rabat', 'Sale', 'Temara', 'Mohammedia', 'Marrakech', 'Fes', 'Tanger']


def slugify(value):
    normalized = unicodedata.normalize('NFKD', value)
    ascii_value = normalized.encode('ascii', 'ignore').decode('ascii')
    return ''.join(ch.lower() if ch.isalnum() else '.' for ch in ascii_value).strip('.')


class Command(BaseCommand):
    help = 'Seed realistic EMSI-like academic demo data with groups, students, modules and timetables.'

    def add_arguments(self, parser):
        parser.add_argument('--students-per-group', type=int, default=10)

    @transaction.atomic
    def handle(self, *args, **options):
        target_count = max(options['students_per_group'], 10)
        self.student_password_hash = make_password('etudiant123')
        self.teacher_password_hash = make_password('enseignant123')

        self._ensure_demo_accounts()
        filieres = self._ensure_filieres()
        groupes = self._ensure_groupes(filieres)
        module_cache = self._ensure_modules()

        for groupe in groupes:
            modules = self._modules_for_group(groupe, module_cache)
            self._rebuild_timetable(groupe, modules)
            self._ensure_students(groupe, modules, target_count)

        self.stdout.write(self.style.SUCCESS(
            f'Donnees academiques pretes: {Filiere.objects.count()} filieres, '
            f'{Groupe.objects.count()} groupes, {Etudiant.objects.count()} etudiants, '
            f'{EmploiDuTemps.objects.count()} seances.'
        ))

    def _ensure_demo_accounts(self):
        old_student = User.objects.filter(username='etudiant1').first()
        if old_student:
            old_student.delete()

        teacher = User.objects.filter(username='mohammed.alaoui').first()
        if not teacher:
            teacher = User.objects.filter(username='enseignant1').first()

        if teacher:
            teacher.username = 'mohammed.alaoui'
            teacher.first_name = 'Mohammed'
            teacher.last_name = 'Alaoui'
            teacher.email = 'mohammed.alaoui@emsi-edu.ma'
            teacher.role = 'enseignant'
            teacher.password = self.teacher_password_hash
            teacher.save()

    def _ensure_filieres(self):
        filieres = {}
        for code, nom, cycle, description in FILIERES:
            filiere, _ = Filiere.objects.update_or_create(
                code=code,
                defaults={'nom': nom, 'cycle': cycle, 'description': description},
            )
            filieres[code] = filiere
        return filieres

    def _ensure_groupes(self, filieres):
        groupes = []
        for code, niveau, annee, cycle, filiere_code in GROUPES:
            groupe, _ = Groupe.objects.update_or_create(
                code=code,
                defaults={
                    'nom': f'{niveau} {filiere_code} Groupe 1' if 'G1' in code else f'{niveau} {filiere_code} Groupe 2',
                    'filiere': filieres[filiere_code],
                    'annee': annee,
                    'niveau': niveau,
                    'cycle': cycle,
                },
            )
            groupes.append(groupe)
        return groupes

    def _ensure_modules(self):
        module_cache = {}
        for names in MODULES.values():
            for name in names:
                module, _ = Module.objects.get_or_create(nom=name, defaults={'coefficient': 1.0})
                module_cache[name] = module
        return module_cache

    def _modules_for_group(self, groupe, module_cache):
        names = MODULES[(groupe.niveau, groupe.filiere.code)]
        return [module_cache[name] for name in names]

    def _rebuild_timetable(self, groupe, modules):
        EmploiDuTemps.objects.filter(groupe=groupe).delete()
        for day_index, day in enumerate(DAYS):
            for slot_index, (start, end) in enumerate(TIME_SLOTS):
                position = day_index * len(TIME_SLOTS) + slot_index
                module = modules[position % len(modules)]
                EmploiDuTemps.objects.create(
                    filiere=groupe.filiere,
                    groupe=groupe,
                    module=module,
                    annee=groupe.annee,
                    niveau=groupe.niveau,
                    jour=day,
                    heure_debut=start,
                    heure_fin=end,
                    salle=ROOMS[(position + groupe.id) % len(ROOMS)],
                    enseignant=TEACHERS[(position + groupe.id) % len(TEACHERS)],
                    type_seance=SESSION_TYPES[position % len(SESSION_TYPES)],
                )

    def _ensure_students(self, groupe, modules, target_count):
        existing = list(Etudiant.objects.filter(groupe=groupe).select_related('user').order_by('user__last_name', 'user__first_name'))

        while len(existing) < target_count:
            index = len(existing) + 1
            global_index = Etudiant.objects.count() + 1
            first_name = FIRST_NAMES[(global_index + index) % len(FIRST_NAMES)]
            last_name = LAST_NAMES[(global_index * 3 + index) % len(LAST_NAMES)]
            user = self._create_student_user(first_name, last_name)
            etudiant = Etudiant.objects.create(
                user=user,
                filiere=groupe.filiere,
                groupe=groupe,
                niveau=groupe.niveau,
                annee=groupe.annee,
                cycle=groupe.cycle,
                matricule=self._matricule(groupe, index),
                telephone=f'06{(60000000 + global_index * 137) % 99999999:08d}',
                adresse=f'{12 + index} Rue Atlas, quartier Academique',
                ville=CITIES[(global_index + index) % len(CITIES)],
                cin=f'BK{global_index:06d}',
                date_naissance=date(2006, 1, 1) - timedelta(days=(groupe.annee * 365 + index * 41)),
            )
            existing.append(etudiant)

        for position, etudiant in enumerate(existing, start=1):
            self._complete_student_profile(etudiant, groupe, position)
            self._rebuild_student_results(etudiant, modules, position)

    def _create_student_user(self, first_name, last_name):
        base_username = f'{slugify(first_name)}.{slugify(last_name)}'.replace('..', '.')
        username = base_username
        suffix = 2
        while User.objects.filter(username=username).exists():
            username = f'{base_username}{suffix}'
            suffix += 1

        user = User.objects.create(
            username=username,
            password=self.student_password_hash,
            first_name=first_name,
            last_name=last_name,
            email=f'{username}@emsi-edu.ma',
            role='etudiant',
        )
        return user

    def _matricule(self, groupe, index):
        base = f'EMSI2026-{groupe.code.replace("-", "")}-{index:03d}'
        matricule = base
        suffix = 2
        while Etudiant.objects.filter(matricule=matricule).exists():
            matricule = f'{base}-{suffix}'
            suffix += 1
        return matricule

    def _complete_student_profile(self, etudiant, groupe, position):
        changed = False
        if etudiant.filiere_id != groupe.filiere_id:
            etudiant.filiere = groupe.filiere
            changed = True
        if etudiant.niveau != groupe.niveau:
            etudiant.niveau = groupe.niveau
            changed = True
        if etudiant.annee != groupe.annee:
            etudiant.annee = groupe.annee
            changed = True
        if etudiant.cycle != groupe.cycle:
            etudiant.cycle = groupe.cycle
            changed = True

        if not etudiant.matricule:
            etudiant.matricule = self._matricule(groupe, position)
            changed = True
        if not etudiant.telephone:
            etudiant.telephone = f'06{(70000000 + etudiant.id * 157) % 99999999:08d}'
            changed = True
        if not etudiant.adresse:
            etudiant.adresse = f'{20 + position} Avenue Hassan II'
            changed = True
        if not etudiant.ville:
            etudiant.ville = CITIES[(etudiant.id + position) % len(CITIES)]
            changed = True
        if not etudiant.cin:
            etudiant.cin = f'BK{etudiant.id:06d}'
            changed = True
        if not etudiant.date_naissance:
            etudiant.date_naissance = date(2006, 1, 1) - timedelta(days=(groupe.annee * 365 + position * 31))
            changed = True

        etudiant.user.role = 'etudiant'
        etudiant.user.password = self.student_password_hash
        if not etudiant.user.email:
            etudiant.user.email = f'{etudiant.user.username}@emsi-edu.ma'
        etudiant.user.save()

        if changed:
            etudiant.save()

    def _rebuild_student_results(self, etudiant, modules, position):
        Note.objects.filter(etudiant=etudiant).delete()
        Absence.objects.filter(etudiant=etudiant).delete()

        for module_index, module in enumerate(modules):
            base = 10 + ((etudiant.id + module_index + position) % 8)
            if position % 11 == 0 and module_index in (0, 2):
                base = 8 + module_index
            Note.objects.create(
                etudiant=etudiant,
                module=module,
                valeur=round(min(base + (0.5 if module_index % 2 else 0), 18), 1),
            )

        absence_count = (etudiant.id + position) % 4
        if position % 13 == 0:
            absence_count = 5

        for absence_index in range(absence_count):
            Absence.objects.create(
                etudiant=etudiant,
                module=modules[absence_index % len(modules)],
                date=date(2026, 4, 6) + timedelta(days=absence_index * 3),
                justifiee=absence_index % 3 == 0,
            )
