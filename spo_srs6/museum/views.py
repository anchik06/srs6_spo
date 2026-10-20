from django.db.models import Q
from django.http import JsonResponse
from django.shortcuts import get_object_or_404, render
from django.template.loader import render_to_string
from django.views.decorators.http import require_GET, require_POST
from .forms import ProjectForm, StepForm
from .models import Category, Project


def get_statistics():
    total = Project.objects.count()
    finished = Project.objects.filter(status='finished').count()

    percent = 0
    if total > 0:
        percent = round(finished / total * 100)

    return {
        'total': total,
        'sleeping': Project.objects.filter(status='sleeping').count(),
        'active': Project.objects.filter(status='active').count(),
        'finished': finished,
        'favorite': Project.objects.filter(favorite=True).count(),
        'percent': percent,
    }


def get_projects(request):
    projects = Project.objects.select_related('category').all()
    section = request.GET.get('section', 'collection')
    status = request.GET.get('status', 'all')
    query = request.GET.get('q', '').strip()

    # На двух страницах статус задан назначением страницы.
    if section == 'plan':
        projects = projects.filter(status='active')
    elif section == 'finished':
        projects = projects.filter(status='finished')
    elif status in dict(Project.STATUS_CHOICES):
        projects = projects.filter(status=status)

    if query:
        projects = projects.filter(
            Q(title__icontains=query) | Q(description__icontains=query)
            | Q(category__name__icontains=query)
        )
    if request.GET.get('favorite') == '1':
        projects = projects.filter(favorite=True)
    return projects


def page_context(section):
    return {
        'section': section,
        'categories': Category.objects.all(),
        'stats': get_statistics(),
        'status_choices': Project.STATUS_CHOICES,
        'projects': Project.objects.select_related('category').all(),
    }


def collection(request):
    return render(request, 'collection.html', page_context('collection'))


def plan(request):
    context = page_context('plan')
    context['projects'] = context['projects'].filter(status='active')
    return render(request, 'plan.html', context)


def finished(request):
    context = page_context('finished')
    context['projects'] = context['projects'].filter(status='finished')
    return render(request, 'finished.html', context)


def list_response(request):
    projects = get_projects(request)
    html = render_to_string('partials/project_list.html', {
        'projects': projects,
        'status_choices': Project.STATUS_CHOICES,
    }, request=request)
    return JsonResponse({
        'html': html,
        'count': projects.count(),
        'stats': get_statistics(),
    })


def form_error(form):
    messages = []
    for field, errors in form.errors.items():
        label = form.fields[field].label if field in form.fields else field
        messages.append(f'{label}: {", ".join(errors)}')
    return JsonResponse({'error': ' '.join(messages)}, status=400)


@require_GET
def project_list(request):
    return list_response(request)


@require_POST
def project_create(request):
    form = ProjectForm(request.POST)
    if not form.is_valid():
        return form_error(form)
    form.save()
    return list_response(request)


@require_POST
def project_change(request, project_id):
    project = get_object_or_404(Project, pk=project_id)
    action = request.POST.get('action')

    if action == 'status':
        status = request.POST.get('status')
        if status not in dict(Project.STATUS_CHOICES):
            return JsonResponse({'error': 'Неизвестный статус.'}, status=400)
        project.status = status
        project.save(update_fields=['status'])
    elif action == 'favorite':
        project.favorite = not project.favorite
        project.save(update_fields=['favorite'])
    elif action == 'step':
        form = StepForm(request.POST, instance=project)
        if not form.is_valid():
            return form_error(form)
        form.save()
    else:
        return JsonResponse({'error': 'Неизвестное действие.'}, status=400)

    return list_response(request)


@require_POST
def project_delete(request, project_id):
    project = get_object_or_404(Project, pk=project_id)
    project.delete()
    return list_response(request)

def management(request):
    return render(request, 'management.html', {
        'section': 'management',
    })