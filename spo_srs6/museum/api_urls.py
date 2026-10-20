from rest_framework.routers import DefaultRouter
from .api import CategoryViewSet, ProjectViewSet

router = DefaultRouter()
router.register('categories', CategoryViewSet)
router.register('projects', ProjectViewSet)

urlpatterns = router.urls

