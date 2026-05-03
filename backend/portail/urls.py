from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'users', views.UserViewSet)
router.register(r'filieres', views.FiliereViewSet)
router.register(r'groupes', views.GroupeViewSet)
router.register(r'etudiants', views.EtudiantViewSet)
router.register(r'modules', views.ModuleViewSet)
router.register(r'notes', views.NoteViewSet)
router.register(r'absences', views.AbsenceViewSet)
router.register(r'emplois', views.EmploiDuTempsViewSet, basename='emploi')

urlpatterns = [
    path('', include(router.urls)),
    path('role/', views.get_role),
    path('alertes/', views.envoyer_alertes),
    path('profil/', views.profil),
    path('parcours/', views.parcours_academique),
]
