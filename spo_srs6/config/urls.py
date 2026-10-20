from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/v2/', include('museum.api_urls')),
    path('', include('museum.urls')),
]