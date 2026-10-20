from django.contrib import admin
from .models import Category, Project

admin.site.register(Category)


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ['title', 'category', 'status', 'favorite']
    list_filter = ['status', 'category']
    search_fields = ['title', 'description']
