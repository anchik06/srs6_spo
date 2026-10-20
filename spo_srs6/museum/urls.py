from django.urls import path
from . import views

urlpatterns = [
    path('', views.collection, name='collection'),
    path('plan/', views.plan, name='plan'),
    path('finished/', views.finished, name='finished'),
    path('api/projects/', views.project_list, name='project_list'),
    path('api/projects/create/', views.project_create, name='project_create'),
    path('api/projects/<int:project_id>/change/', views.project_change, name='project_change'),
    path('api/projects/<int:project_id>/delete/', views.project_delete, name='project_delete'),
    path('management/', views.management, name='management'),
]
