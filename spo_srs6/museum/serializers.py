from rest_framework import serializers
from .models import Category, Project

class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ['id', 'name']

class ProjectSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(
        source='category.name',
        read_only=True,
    )
    status_name = serializers.CharField(
        source='get_status_display',
        read_only=True,
    )
    class Meta:
        model = Project
        fields = [
            'id',
            'title',
            'category',
            'category_name',
            'description',
            'stop_reason',
            'next_step',
            'status',
            'status_name',
            'favorite',
            'created_at',
        ]
        read_only_fields = ['id', 'created_at']
