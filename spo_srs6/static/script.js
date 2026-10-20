function getSetting(name, defaultValue) {
    try {
        return localStorage.getItem(name) || defaultValue;
    } catch (error) {
        return defaultValue;
    }
}

function saveSetting(name, value) {
    try {
        localStorage.setItem(name, value);
    } catch (error) {
    }
}

const menuButton = document.getElementById('menu-button');
menuButton.addEventListener('click', function () {
    const open = document.getElementById('menu').classList.toggle('open');
    menuButton.setAttribute('aria-expanded', String(open));
});

const projectList = document.getElementById('project-list');
const searchInput = document.getElementById('search');
const statusFilter = document.getElementById('status-filter');
const favoriteFilter = document.getElementById('favorite-filter');
favoriteFilter.checked = getSetting('museum-favorite', '0') === '1';
const message = document.getElementById('message');
const token = document.querySelector('[name=csrfmiddlewaretoken]').value;

if (statusFilter) {
    const savedStatus = getSetting('museum-status', 'all');
    const allowed = ['all', 'sleeping', 'active', 'finished'];
    statusFilter.value = allowed.includes(savedStatus) ? savedStatus : 'all';
}

function showMessage(text, success) {
    message.textContent = text;
    message.className = success ? 'alert alert-success' : 'alert alert-danger';
}

function getFilters() {
    return new URLSearchParams({
        section: projectList.dataset.section,
        q: searchInput.value,
        status: statusFilter ? statusFilter.value : 'all',
        favorite: favoriteFilter.checked ? '1' : '0',
    });
}

let requestNumber = 0;
async function sendRequest(url, data) {
    const number = ++requestNumber;
    const options = {method: 'GET'};
    if (data) {
        options.method = 'POST';
        options.headers = {'X-CSRFToken': token};
        options.body = new URLSearchParams(data);
    }

    const response = await fetch(url + '?' + getFilters().toString(), options);
    if (!response.ok) {
        if (response.status === 400) {
            const result = await response.json();
            throw new Error(result.error);
        }
        throw new Error('Ошибка сервера: ' + response.status);
    }
    const result = await response.json();
    if (number !== requestNumber) return;

    projectList.innerHTML = result.html;
    document.querySelectorAll('[data-stat]').forEach(function (element) {
        element.textContent = result.stats[element.dataset.stat];
    });
}

function refreshList() {
    sendRequest('/api/projects/').catch(function (error) {
        showMessage(error.message, false);
    });
}

let searchTimer;
searchInput.addEventListener('input', function () {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(refreshList, 300);
});
if (statusFilter) {
    statusFilter.addEventListener('change', function () {
        saveSetting('museum-status', statusFilter.value);
        refreshList();
    });
}
favoriteFilter.addEventListener('change', function () {
    saveSetting('museum-favorite', favoriteFilter.checked ? '1' : '0');
    refreshList();
});
refreshList();

let busy = false;
function setBusy(value) {
    busy = value;
    document.querySelectorAll('#project-list button, #project-list select, #project-form button, #search, #status-filter, #favorite-filter').forEach(function (element) {
        element.disabled = value;
    });
}

const projectForm = document.getElementById('project-form');
if (projectForm) {
    projectForm.addEventListener('submit', async function (event) {
        event.preventDefault();
        if (busy) return;
        clearTimeout(searchTimer);
        setBusy(true);
        try {
            await sendRequest('/api/projects/create/', new FormData(projectForm));
            projectForm.reset();
            showMessage('Проект добавлен со статусом «На паузе». Если он скрыт, выберите «Все статусы».', true);
        } catch (error) {
            showMessage(error.message, false);
        } finally {
            setBusy(false);
        }
    });
}

async function changeProject(element) {
    if (busy) return;
    const card = element.closest('[data-id]');
    const id = card.dataset.id;
    const action = element.dataset.action;
    let url = '/api/projects/' + id + '/change/';
    let data = {action: action};
    let successText = 'Изменения сохранены.';

    if (action === 'delete') {
        if (!confirm('Удалить проект из музея?')) return;
        url = '/api/projects/' + id + '/delete/';
        successText = 'Проект удалён.';
    } else if (action === 'status') {
        data.status = element.value;
        successText = 'Статус сохранён. Проект появится в соответствующем зале.';
    } else if (action === 'step') {
        const input = card.querySelector('.step-input');
        if (!input.reportValidity()) return;
        data.next_step = input.value;
    }

    clearTimeout(searchTimer);
    setBusy(true);
    try {
        await sendRequest(url, data);
        showMessage(successText, true);
    } catch (error) {
        showMessage(error.message, false);
        if (action === 'status') refreshList();
    } finally {
        setBusy(false);
    }
}
projectList.addEventListener('click', function (event) {
    const button = event.target.closest('button[data-action]');
    if (button) changeProject(button);
});
projectList.addEventListener('change', function (event) {
    if (event.target.dataset.action === 'status') changeProject(event.target);
});
