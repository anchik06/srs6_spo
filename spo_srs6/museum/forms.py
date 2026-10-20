from django import forms
from .models import Project


class ProjectForm(forms.ModelForm):
    class Meta:
        model = Project
        fields = ['title', 'category', 'description', 'stop_reason', 'next_step']


class StepForm(forms.ModelForm):
    class Meta:
        model = Project
        fields = ['next_step']
