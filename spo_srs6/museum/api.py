from django.db.models import Q
from django.db.models.deletion import ProtectedError
from rest_framework.authentication import SessionAuthentication
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import AllowAny
from rest_framework.viewsets import ModelViewSet
from .models import Category, Project
from .serializers import CategorySerializer, ProjectSerializer


class MuseumAuthentication(SessionAuthentication):
    def authenticate(self, request):
        self.enforce_csrf(request)
        return super().authenticate(request)


class MuseumViewSet(ModelViewSet):
    authentication_classes = [MuseumAuthentication]
    permission_classes = [AllowAny]


class CategoryViewSet(MuseumViewSet):
    queryset = Category.objects.order_by('name')
    serializer_class = CategorySerializer

    def perform_destroy(self, instance):
        try:
            instance.delete()
        except ProtectedError:
            raise PermissionDenied(
                'Нельзя удалить категорию, в которой есть проекты. '
                'Сначала перенесите проекты в другую категорию.'
            )


class ProjectViewSet(MuseumViewSet):
    queryset = Project.objects.select_related('category').all()
    serializer_class = ProjectSerializer

    def get_queryset(self):
        projects = super().get_queryset()
        params = self.request.query_params

        search = params.get('search', '').strip()
        category = params.get('category', '')
        status = params.get('status', '')
        favorite = params.get('favorite', '')
        ordering = params.get('ordering', '-created_at')

        if search:
            projects = projects.filter(
                Q(title__icontains=search)
                | Q(description__icontains=search)
                | Q(category__name__icontains=search)
            )

        if category:
            if not category.isascii() or not category.isdigit():
                raise ValidationError({
                    'category': 'Выберите существующую категорию.'
                })
            projects = projects.filter(category_id=int(category))

        if status:
            if status not in dict(Project.STATUS_CHOICES):
                raise ValidationError({
                    'status': 'Выбран неизвестный статус.'
                })
            projects = projects.filter(status=status)

        if favorite:
            if favorite not in ['true', 'false']:
                raise ValidationError({
                    'favorite': 'Некорректный фильтр избранного.'
                })
            projects = projects.filter(favorite=favorite == 'true')

        allowed_ordering = [
            'title',
            '-title',
            'created_at',
            '-created_at',
        ]

        if ordering not in allowed_ordering:
            raise ValidationError({
                'ordering': 'Выбрана неизвестная сортировка.'
            })

        return projects.order_by(ordering, 'id')