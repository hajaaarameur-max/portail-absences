from rest_framework import viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .models import User, Filiere, Groupe, Etudiant, Module, Note, Absence, EmploiDuTemps
from .serializers import UserSerializer, FiliereSerializer, GroupeSerializer, EtudiantSerializer, ModuleSerializer, NoteSerializer, AbsenceSerializer, EmploiDuTempsSerializer

class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer

class FiliereViewSet(viewsets.ModelViewSet):
    queryset = Filiere.objects.all()
    serializer_class = FiliereSerializer

class GroupeViewSet(viewsets.ModelViewSet):
    queryset = Groupe.objects.select_related('filiere').all().order_by('annee', 'filiere__code', 'code')
    serializer_class = GroupeSerializer

class EtudiantViewSet(viewsets.ModelViewSet):
    queryset = Etudiant.objects.select_related('user', 'filiere', 'groupe').all().order_by('user__last_name', 'user__first_name', 'matricule')
    serializer_class = EtudiantSerializer

class ModuleViewSet(viewsets.ModelViewSet):
    queryset = Module.objects.all()
    serializer_class = ModuleSerializer

class NoteViewSet(viewsets.ModelViewSet):
    queryset = Note.objects.all()
    serializer_class = NoteSerializer

class AbsenceViewSet(viewsets.ModelViewSet):
    queryset = Absence.objects.all()
    serializer_class = AbsenceSerializer

class EmploiDuTempsViewSet(viewsets.ModelViewSet):
    serializer_class = EmploiDuTempsSerializer

    def get_queryset(self):
        queryset = EmploiDuTemps.objects.select_related('filiere', 'groupe', 'module').all()
        annee = self.request.query_params.get('annee')
        niveau = self.request.query_params.get('niveau')
        filiere = self.request.query_params.get('filiere')
        groupe = self.request.query_params.get('groupe')

        if annee:
            queryset = queryset.filter(annee=annee)
        if niveau:
            queryset = queryset.filter(niveau=niveau)
        if filiere:
            queryset = queryset.filter(filiere=filiere)
        if groupe:
            queryset = queryset.filter(groupe=groupe)

        return queryset

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def parcours_academique(request):
    filieres = Filiere.objects.all().order_by('cycle', 'code', 'nom')
    etudiants = Etudiant.objects.select_related('user', 'filiere', 'groupe').all()
    groupes = Groupe.objects.select_related('filiere').all()

    parcours = [
        {
            'annee': 1,
            'niveau': '1A',
            'cycle': 'preparatoire',
            'titre': '1ere annee - cycle preparatoire integre',
        },
        {
            'annee': 2,
            'niveau': '2A',
            'cycle': 'preparatoire',
            'titre': '2eme annee - cycle preparatoire integre',
        },
        {
            'annee': 3,
            'niveau': '3A',
            'cycle': 'ingenieur',
            'titre': '3eme annee - choix de filiere',
        },
        {
            'annee': 4,
            'niveau': '4A',
            'cycle': 'master',
            'titre': '4eme annee - specialite master',
        },
        {
            'annee': 5,
            'niveau': '5A',
            'cycle': 'master',
            'titre': '5eme annee - specialite master',
        },
    ]

    data = []
    for item in parcours:
        filieres_cycle = filieres.filter(cycle=item['cycle'])
        data.append({
            **item,
            'nombre_etudiants': etudiants.filter(annee=item['annee']).count(),
            'nombre_groupes': groupes.filter(annee=item['annee']).count(),
            'filieres': [
                {
                    'id': filiere.id,
                    'nom': filiere.nom,
                    'code': filiere.code,
                    'description': filiere.description,
                    'nombre_etudiants': etudiants.filter(annee=item['annee'], filiere=filiere).count(),
                    'groupes': [
                        {
                            'id': groupe.id,
                            'nom': groupe.nom,
                            'code': groupe.code,
                            'nombre_etudiants': etudiants.filter(groupe=groupe).count(),
                        }
                        for groupe in groupes.filter(annee=item['annee'], filiere=filiere)
                    ],
                }
                for filiere in filieres_cycle
            ],
        })

    return Response(data)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_role(request):
    return Response({'role': request.user.role})
from django.core.mail import send_mail
from django.conf import settings

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def envoyer_alertes(request):
    notes = Note.objects.all()
    absences = Absence.objects.all()
    etudiants = Etudiant.objects.all()

    alertes_envoyees = 0

    for etudiant in etudiants:
        notes_etudiant = notes.filter(etudiant=etudiant)
        absences_etudiant = absences.filter(etudiant=etudiant)

        moyenne = 0
        if notes_etudiant.exists():
            moyenne = sum([n.valeur for n in notes_etudiant]) / notes_etudiant.count()

        nb_absences = absences_etudiant.count()

        if moyenne < 10 or nb_absences > 3:
            email = etudiant.user.email
            if email:
                sujet = "⚠️ Alerte - Portail Absences"
                message = f"""
Bonjour {etudiant.user.first_name},

Vous êtes détecté comme étudiant à risque :
- Moyenne : {round(moyenne, 2)}/20
- Nombre d'absences : {nb_absences}

Veuillez contacter votre administration.

Cordialement,
Portail Absences
                """
                send_mail(sujet, message, settings.DEFAULT_FROM_EMAIL, [email])
                alertes_envoyees += 1

    return Response({'message': f'{alertes_envoyees} alerte(s) envoyée(s) !'})
@api_view(['GET', 'PUT'])
@permission_classes([IsAuthenticated])
def profil(request):
    user = request.user
    if request.method == 'GET':
        return Response({
            'id': user.id,
            'username': user.username,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'email': user.email,
            'role': user.role,
        })
    elif request.method == 'PUT':
        user.first_name = request.data.get('first_name', user.first_name)
        user.last_name = request.data.get('last_name', user.last_name)
        user.email = request.data.get('email', user.email)
        user.save()
        return Response({'message': 'Profil mis à jour !'})
