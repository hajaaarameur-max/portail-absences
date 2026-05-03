from django.contrib.auth.models import AbstractUser
from django.db import models

class User(AbstractUser):
    ROLES = [('admin', 'Admin'), ('enseignant', 'Enseignant'), ('etudiant', 'Etudiant')]
    role = models.CharField(max_length=20, choices=ROLES)

class Filiere(models.Model):
    nom = models.CharField(max_length=100)
    code = models.CharField(max_length=20, blank=True)
    cycle = models.CharField(max_length=30, blank=True)
    description = models.TextField(blank=True)

    def __str__(self):
        return self.nom

class Groupe(models.Model):
    nom = models.CharField(max_length=100)
    code = models.CharField(max_length=30, unique=True)
    filiere = models.ForeignKey(Filiere, on_delete=models.CASCADE)
    annee = models.PositiveSmallIntegerField(default=1)
    niveau = models.CharField(max_length=10)
    cycle = models.CharField(max_length=30, blank=True)

    class Meta:
        ordering = ['annee', 'filiere__code', 'code']

    def __str__(self):
        return self.code

class Etudiant(models.Model):
    CYCLES = [
        ('preparatoire', 'Cycle preparatoire'),
        ('ingenieur', 'Cycle ingenieur'),
        ('master', 'Cycle master'),
    ]

    user = models.OneToOneField(User, on_delete=models.CASCADE)
    filiere = models.ForeignKey(Filiere, on_delete=models.SET_NULL, null=True)
    groupe = models.ForeignKey(Groupe, on_delete=models.SET_NULL, null=True, blank=True)
    niveau = models.CharField(max_length=10)
    annee = models.PositiveSmallIntegerField(default=1)
    cycle = models.CharField(max_length=30, choices=CYCLES, default='preparatoire')
    matricule = models.CharField(max_length=30, unique=True, null=True, blank=True)
    telephone = models.CharField(max_length=30, blank=True)
    adresse = models.CharField(max_length=180, blank=True)
    ville = models.CharField(max_length=80, blank=True)
    cin = models.CharField(max_length=30, blank=True)
    date_naissance = models.DateField(null=True, blank=True)

    class Meta:
        ordering = ['user__last_name', 'user__first_name', 'matricule']

    def __str__(self):
        return self.user.get_full_name()

class Module(models.Model):
    nom = models.CharField(max_length=100)
    coefficient = models.FloatField()
    def __str__(self):
        return self.nom

class Note(models.Model):
    etudiant = models.ForeignKey(Etudiant, on_delete=models.CASCADE)
    module = models.ForeignKey(Module, on_delete=models.CASCADE)
    valeur = models.FloatField()
    date = models.DateField(auto_now_add=True)

class Absence(models.Model):
    etudiant = models.ForeignKey(Etudiant, on_delete=models.CASCADE)
    module = models.ForeignKey(Module, on_delete=models.CASCADE)
    date = models.DateField()
    justifiee = models.BooleanField(default=False)

class EmploiDuTemps(models.Model):
    JOURS = [
        ('lundi', 'Lundi'),
        ('mardi', 'Mardi'),
        ('mercredi', 'Mercredi'),
        ('jeudi', 'Jeudi'),
        ('vendredi', 'Vendredi'),
        ('samedi', 'Samedi'),
    ]

    TYPES_SEANCE = [
        ('cours', 'Cours'),
        ('td', 'TD'),
        ('tp', 'TP'),
        ('projet', 'Projet'),
        ('atelier', 'Atelier'),
    ]

    filiere = models.ForeignKey(Filiere, on_delete=models.CASCADE)
    groupe = models.ForeignKey(Groupe, on_delete=models.CASCADE, null=True, blank=True)
    module = models.ForeignKey(Module, on_delete=models.CASCADE)
    annee = models.PositiveSmallIntegerField(default=1)
    niveau = models.CharField(max_length=10, default='1A')
    jour = models.CharField(max_length=20, choices=JOURS)
    heure_debut = models.TimeField()
    heure_fin = models.TimeField()
    salle = models.CharField(max_length=40)
    enseignant = models.CharField(max_length=100)
    type_seance = models.CharField(max_length=20, choices=TYPES_SEANCE, default='cours')

    class Meta:
        ordering = ['annee', 'groupe__code', 'jour', 'heure_debut']

    def __str__(self):
        groupe = self.groupe.code if self.groupe else self.niveau
        return f'{groupe} - {self.module} ({self.jour})'
