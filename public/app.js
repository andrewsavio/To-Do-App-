// ── API base URL ─────────────────────────────────────────────────
var API = '/api/todos';

// ── DOM refs ─────────────────────────────────────────────────────
var fab          = document.getElementById('fab');
var modalOverlay = document.getElementById('modal-overlay');
var modalClose   = document.getElementById('modal-close');
var taskForm     = document.getElementById('task-form');
var taskInput    = document.getElementById('task-input');
var taskList     = document.getElementById('task-list');
var emptyState   = document.getElementById('empty-state');
var taskCount    = document.getElementById('task-count');

// ── State ────────────────────────────────────────────────────────
var todos = [];

// ── Init ─────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function () {
  fetchTodos();

  fab.addEventListener('click', openModal);
  modalClose.addEventListener('click', closeModal);
  modalOverlay.addEventListener('click', function (e) {
    if (e.target === modalOverlay) closeModal();
  });
  taskForm.addEventListener('submit', handleSubmit);

  // Escape key closes modal
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeModal();
  });
});

// ── Fetch all todos from server ──────────────────────────────────
function fetchTodos() {
  var xhr = new XMLHttpRequest();
  xhr.open('GET', API, true);
  xhr.onreadystatechange = function () {
    if (xhr.readyState === 4 && xhr.status === 200) {
      todos = JSON.parse(xhr.responseText);
      render();
    }
  };
  xhr.send();
}

// ── Create a new todo ────────────────────────────────────────────
function createTodo(text, priority) {
  var xhr = new XMLHttpRequest();
  xhr.open('POST', API, true);
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.onreadystatechange = function () {
    if (xhr.readyState === 4 && xhr.status === 201) {
      var newTodo = JSON.parse(xhr.responseText);
      todos.push(newTodo);
      render();
    }
  };
  xhr.send(JSON.stringify({ text: text, priority: priority }));
}

// ── Toggle todo completed ────────────────────────────────────────
function toggleTodo(id, completed) {
  var xhr = new XMLHttpRequest();
  xhr.open('PUT', API + '/' + id, true);
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.onreadystatechange = function () {
    if (xhr.readyState === 4 && xhr.status === 200) {
      var updated = JSON.parse(xhr.responseText);
      for (var i = 0; i < todos.length; i++) {
        if (todos[i].id === updated.id) {
          todos[i] = updated;
          break;
        }
      }
      render();
    }
  };
  xhr.send(JSON.stringify({ completed: completed }));
}

// ── Delete a todo ────────────────────────────────────────────────
function deleteTodo(id) {
  var xhr = new XMLHttpRequest();
  xhr.open('DELETE', API + '/' + id, true);
  xhr.onreadystatechange = function () {
    if (xhr.readyState === 4 && xhr.status === 200) {
      todos = todos.filter(function (t) { return t.id !== id; });
      render();
    }
  };
  xhr.send();
}

// ── Render ───────────────────────────────────────────────────────
function render() {
  taskList.innerHTML = '';

  if (todos.length === 0) {
    emptyState.classList.remove('hidden');
    taskCount.textContent = '';
  } else {
    emptyState.classList.add('hidden');
    var pending = todos.filter(function (t) { return !t.completed; }).length;
    taskCount.textContent = pending + ' pending';

    for (var i = 0; i < todos.length; i++) {
      taskList.appendChild(buildTaskElement(todos[i]));
    }
  }
}

// ── Build a task DOM element ─────────────────────────────────────
function buildTaskElement(todo) {
  var item = document.createElement('div');
  item.className = 'task-item' + (todo.completed ? ' completed' : '');
  item.setAttribute('data-id', todo.id);

  item.innerHTML =
    '<label class="task-check">' +
      '<input type="checkbox"' + (todo.completed ? ' checked' : '') + ' />' +
      '<span class="checkmark">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">' +
          '<polyline points="20 6 9 17 4 12"/>' +
        '</svg>' +
      '</span>' +
    '</label>' +
    '<div class="task-content">' +
      '<p class="task-text">' + escapeHtml(todo.text) + '</p>' +
      '<div class="task-meta">' +
        '<span class="task-priority-badge ' + todo.priority + '">' + todo.priority + '</span>' +
        '<span class="task-time">' + escapeHtml(todo.createdAt) + '</span>' +
      '</div>' +
    '</div>' +
    '<button class="task-delete" aria-label="Delete task">' +
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">' +
        '<polyline points="3 6 5 6 21 6"/>' +
        '<path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>' +
        '<path d="M10 11v6"/><path d="M14 11v6"/>' +
        '<path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>' +
      '</svg>' +
    '</button>';

  // Event: checkbox toggle
  var checkbox = item.querySelector('input[type="checkbox"]');
  checkbox.addEventListener('change', function () {
    toggleTodo(todo.id, this.checked);
  });

  // Event: delete
  var deleteBtn = item.querySelector('.task-delete');
  deleteBtn.addEventListener('click', function () {
    item.style.transform = 'translateX(60px)';
    item.style.opacity = '0';
    setTimeout(function () {
      deleteTodo(todo.id);
    }, 250);
  });

  return item;
}

// ── Modal controls ───────────────────────────────────────────────
function openModal() {
  modalOverlay.classList.add('open');
  fab.classList.add('active');
  setTimeout(function () { taskInput.focus(); }, 300);
}

function closeModal() {
  modalOverlay.classList.remove('open');
  fab.classList.remove('active');
  taskForm.reset();
}

// ── Form submit ──────────────────────────────────────────────────
function handleSubmit(e) {
  e.preventDefault();

  var text = taskInput.value.trim();
  if (!text) return;

  var priorityEl = document.querySelector('input[name="priority"]:checked');
  var priority = priorityEl ? priorityEl.value : 'low';

  createTodo(text, priority);
  closeModal();
}

// ── Helpers ──────────────────────────────────────────────────────
function escapeHtml(str) {
  var div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}
