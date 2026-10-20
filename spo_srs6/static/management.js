const api = '/api/v2/';
const messageBox = document.getElementById('message');
const filters = document.getElementById('filters');
const projectForm = document.getElementById('managed-project-form');
const categoryForm = document.getElementById('category-form');
const projectsBox = document.getElementById('managed-projects');
const categoriesBox = document.getElementById('managed-categories');
const token = document.querySelector('[name=csrfmiddlewaretoken]').value;

let categories = [];
let busy = false;
let searchTimer;
let listRequest = 0;

const fieldNames = {
    title: 'Название',
    name: 'Название категории',
    category: 'Категория',
    description: 'Описание',
    stop_reason: 'Причина остановки',
    next_step: 'Следующий шаг',
    status: 'Статус',
    favorite: 'Избранное',
    ordering: 'Сортировка',
    non_field_errors: 'Ошибка',
    detail: 'Ошибка',
};

function notify(text, success = false) {
    messageBox.textContent = text;
    messageBox.className = success
        ? 'alert alert-success'
        : 'alert alert-danger';
}

function validationText(data) {
    if (!data || typeof data !== 'object') {
        return 'Проверьте заполненные поля.';
    }

    return Object.entries(data).map(([field, errors]) => {
        const label = fieldNames[field] || field;
        const text = Array.isArray(errors) ? errors.join(' ') : String(errors);
        return `${label}: ${text}`;
    }).join(' ');
}

async function request(path, method = 'GET', data) {
    let response;

    try {
        response = await fetch(api + path, {
            method: method,
            credentials: 'same-origin',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': token,
            },
            body: data === undefined ? undefined : JSON.stringify(data),
        });
    } catch (error) {
        throw new Error('Нет связи с сервером. Проверьте, запущен ли Django.');
    }

    if (response.status === 204) {
        return null;
    }

    const result = await response.json().catch(() => null);

    if (!response.ok) {
        if (response.status === 400) {
            throw new Error(validationText(result));
        }

        if (response.status === 404) {
            throw new Error(
                'Объект не найден. Возможно, его уже удалили. Обновите список.'
            );
        }

        if (response.status === 403) {
            throw new Error(
                result?.detail ||
                'Операция запрещена. Обновите страницу и повторите попытку.'
            );
        }

        if (response.status >= 500) {
            throw new Error(
                'На сервере произошла ошибка. Попробуйте выполнить действие позже.'
            );
        }

        throw new Error('Не удалось выполнить запрос. Повторите попытку.');
    }

    if (result === null) {
        throw new Error('Сервер вернул некорректный ответ.');
    }

    return result;
}

function element(tag, className, text) {
    const node = document.createElement(tag);
    node.className = className;

    if (text !== undefined) {
        node.textContent = text;
    }

    return node;
}

function actionButton(text, handler, danger = false) {
    const button = element(
        'button',
        danger ? 'btn btn-outline-danger' : 'btn btn-outline-primary',
        text
    );

    button.type = 'button';

    button.addEventListener('click', () => {
        run(handler);
    });

    return button;
}

async function run(action) {
    if (busy) return;

    busy = true;

    const controls = Array.from(
        document.querySelectorAll('main button, main input, main select, main textarea')
    );
    const previous = controls.map(control => control.disabled);

    controls.forEach(control => {
        control.disabled = true;
    });

    try {
        await action();
    } catch (error) {
        notify(error.message);
    } finally {
        controls.forEach((control, index) => {
            control.disabled = previous[index];
        });
        busy = false;
    }
}

function resetProject() {
    projectForm.reset();
    projectForm.elements.id.value = '';
    document.getElementById('project-form-title').textContent = 'Новый проект';
}

function resetCategory() {
    categoryForm.reset();
    categoryForm.elements.id.value = '';
}

function fillCategorySelect(id, firstText) {
    const select = document.getElementById(id);
    const previous = select.value;

    select.replaceChildren(new Option(firstText, ''));

    categories.forEach(category => {
        select.add(new Option(category.name, category.id));
    });

    const exists = categories.some(category => String(category.id) === previous);
    select.value = exists ? previous : '';
}

async function loadCategories() {
    categories = await request('categories/');

    fillCategorySelect('filter-category', 'Все категории');
    fillCategorySelect('project-category', 'Выберите категорию');

    categoriesBox.replaceChildren();

    categories.forEach(category => {
        const row = element('div', 'border-bottom pb-3');
        row.append(element('div', 'fw-bold mb-2', category.name));

        const buttons = element('div', 'd-flex flex-wrap gap-2');

        buttons.append(
            actionButton('Изменить', async () => {
                const current = await request(`categories/${category.id}/`);
                categoryForm.elements.id.value = current.id;
                categoryForm.elements.name.value = current.name;
                categoryForm.scrollIntoView({behavior: 'smooth', block: 'center'});
            }),
            actionButton('Удалить', async () => {
                if (!confirm(`Вы действительно хотите удалить категорию «${category.name}»?`)) {
                    return;
                }

                await request(`categories/${category.id}/`, 'DELETE');

                if (categoryForm.elements.id.value === String(category.id)) {
                    resetCategory();
                }

                notify('Категория удалена.', true);
                await refresh();
            }, true)
        );

        row.append(buttons);
        categoriesBox.append(row);
    });

    if (!categories.length) {
        categoriesBox.append(
            element('p', 'text-secondary', 'Сначала создайте категорию.')
        );
    }
}

async function editProject(id) {
    const project = await request(`projects/${id}/`);

    for (const field of [
        'id', 'title', 'category', 'description',
        'stop_reason', 'next_step', 'status',
    ]) {
        projectForm.elements[field].value = project[field];
    }

    projectForm.elements.favorite.checked = project.favorite;
    document.getElementById('project-form-title').textContent =
        'Редактирование проекта';

    projectForm.scrollIntoView({behavior: 'smooth', block: 'start'});
}

async function loadProjects() {
    const number = ++listRequest;
    const params = new URLSearchParams(new FormData(filters));
    let projects;

    try {
        projects = await request('projects/?' + params.toString());
    } catch (error) {
        if (number !== listRequest) return;
        throw error;
    }

    if (number !== listRequest) return;

    projectsBox.replaceChildren();
    document.getElementById('project-count').textContent =
        `Найдено проектов: ${projects.length}`;

    projects.forEach(project => {
        const card = element('article', 'card card-body project-card');

        card.append(
            element('h3', 'card-title', project.title),
            element(
                'p',
                'text-secondary',
                `${project.category_name} · ${project.status_name}`
            ),
            element('p', '', project.description),
            element('p', '', `Причина паузы: ${project.stop_reason}`),
            element('p', '', `Следующий шаг: ${project.next_step}`)
        );

        const buttons = element('div', 'd-flex flex-wrap gap-2');

        buttons.append(
            actionButton('Редактировать', () => editProject(project.id)),
            actionButton(
                project.favorite ? 'Убрать из избранного' : 'В избранное',
                async () => {
                    await request(`projects/${project.id}/`, 'PATCH', {
                        favorite: !project.favorite,
                    });
                    notify('Избранное обновлено.', true);
                    await loadProjects();
                }
            ),
            actionButton('Удалить', async () => {
                if (!confirm(`Вы действительно хотите удалить «${project.title}»?`)) {
                    return;
                }

                await request(`projects/${project.id}/`, 'DELETE');

                if (projectForm.elements.id.value === String(project.id)) {
                    resetProject();
                }

                notify('Проект удалён.', true);
                await loadProjects();
            }, true)
        );

        card.append(buttons);
        projectsBox.append(card);
    });

    if (!projects.length) {
        projectsBox.append(
            element('p', 'text-secondary', 'Проекты не найдены.')
        );
    }
}

async function refresh() {
    await loadCategories();
    await loadProjects();
}

projectForm.addEventListener('submit', event => {
    event.preventDefault();

    const fields = projectForm.elements;
    const id = fields.namedItem('id').value;

    const data = {
        title: fields.namedItem('title').value.trim(),
        category: Number(fields.namedItem('category').value),
        description: fields.namedItem('description').value.trim(),
        stop_reason: fields.namedItem('stop_reason').value.trim(),
        next_step: fields.namedItem('next_step').value.trim(),
        status: fields.namedItem('status').value,
        favorite: fields.namedItem('favorite').checked,
    };

    if (!data.category) {
        notify('Выберите категорию проекта.');
        return;
    }

    run(async () => {
        await request(
            id ? `projects/${id}/` : 'projects/',
            id ? 'PATCH' : 'POST',
            data
        );

        resetProject();

        notify(
            id ? 'Изменения проекта сохранены.' : 'Проект создан.',
            true
        );

        await loadProjects();
    });
});

categoryForm.addEventListener('submit', event => {
    event.preventDefault();

    run(async () => {
        const id = categoryForm.elements.id.value;
        const data = {
            name: categoryForm.elements.name.value.trim(),
        };

        await request(
            id ? `categories/${id}/` : 'categories/',
            id ? 'PATCH' : 'POST',
            data
        );

        resetCategory();
        notify(id ? 'Категория изменена.' : 'Категория создана.', true);
        await refresh();
    });
});

document.getElementById('cancel-project').addEventListener('click', resetProject);
document.getElementById('cancel-category').addEventListener('click', resetCategory);

filters.addEventListener('submit', event => event.preventDefault());

filters.addEventListener('input', () => {
    clearTimeout(searchTimer);

    searchTimer = setTimeout(() => {
        loadProjects().catch(error => notify(error.message));
    }, 300);
});

const menuButton = document.getElementById('menu-button');

menuButton.addEventListener('click', () => {
    const open = document.getElementById('menu').classList.toggle('open');
    menuButton.setAttribute('aria-expanded', String(open));
});

refresh().catch(error => notify(error.message));