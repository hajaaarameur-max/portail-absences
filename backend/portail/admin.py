from django.contrib import admin
from .models import User, Filiere, Groupe, Etudiant, Module, Note, Absence, EmploiDuTemps

admin.site.register(User)
admin.site.register(Filiere)
admin.site.register(Groupe)
admin.site.register(Etudiant)
admin.site.register(Module)
admin.site.register(Note)
admin.site.register(Absence)
admin.site.register(EmploiDuTemps)
