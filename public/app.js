// ── API base URL ─────────────────────────────────────────────────
var API = '/api/todos';

// ── DOM refs ─────────────────────────────────────────────────────
var fab          = document.getElementById('fab');
var fabDelete    = document.getElementById('fab-delete');
var modalOverlay = document.getElementById('modal-overlay');
var modalClose   = document.getElementById('modal-close');
var taskForm     = document.getElementById('task-form');
var taskInput    = document.getElementById('task-input');
var taskList     = document.getElementById('task-list');
var emptyState   = document.getElementById('empty-state');
var taskCount    = document.getElementById('task-count');
var sortBtn      = document.getElementById('sort-btn');
var sortDropdown = document.getElementById('sort-dropdown');

// ── State ────────────────────────────────────────────────────────
var todos = [];
var selectedTaskId = null;
var currentSort = 'date'; // 'date' or 'name'

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

  // Sort button toggle
  sortBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    sortDropdown.classList.toggle('open');
    sortBtn.classList.toggle('active');
  });

  // Sort options
  var sortOptions = document.querySelectorAll('.sort-option');
  for (var i = 0; i < sortOptions.length; i++) {
    sortOptions[i].addEventListener('click', function () {
      currentSort = this.getAttribute('data-sort');
      // Update active state
      for (var j = 0; j < sortOptions.length; j++) {
        sortOptions[j].classList.remove('active');
      }
      this.classList.add('active');
      sortDropdown.classList.remove('open');
      sortBtn.classList.remove('active');
      render();
    });
  }

  // Mark default sort option as active
  document.querySelector('.sort-option[data-sort="date"]').classList.add('active');

  // Close dropdown when clicking outside
  document.addEventListener('click', function (e) {
    if (!e.target.closest('.sort-wrapper')) {
      sortDropdown.classList.remove('open');
      sortBtn.classList.remove('active');
    }
  });

  // Click outside task list to deselect
  document.addEventListener('click', function (e) {
    if (!e.target.closest('.task-item') && !e.target.closest('.fab-delete')) {
      deselectTask();
    }
  });

  // Floating delete button click
  fabDelete.addEventListener('click', function () {
    if (selectedTaskId !== null) {
      var item = document.querySelector('.task-item[data-id="' + selectedTaskId + '"]');
      if (item) {
        item.style.transform = 'translateX(60px)';
        item.style.opacity = '0';
      }
      var idToDelete = selectedTaskId;
      deselectTask();
      setTimeout(function () {
        deleteTodo(idToDelete);
      }, 250);
    }
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
function createTodo(text, description) {
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
  xhr.send(JSON.stringify({ text: text, description: description }));
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

    // Sort a copy of the array
    var sorted = todos.slice();
    if (currentSort === 'name') {
      sorted.sort(function (a, b) {
        return a.text.toLowerCase().localeCompare(b.text.toLowerCase());
      });
    } else {
      sorted.sort(function (a, b) {
        return b.timestamp - a.timestamp;
      });
    }

    for (var i = 0; i < sorted.length; i++) {
      taskList.appendChild(buildTaskElement(sorted[i]));
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
      (todo.description ? '<p class="task-description">' + escapeHtml(todo.description) + '</p>' : '') +
      '<div class="task-meta">' +
        '<span class="task-time">' + escapeHtml(todo.createdAt) + '</span>' +
      '</div>' +
    '</div>';

  // Event: click task to select it (show floating delete)
  item.addEventListener('click', function (e) {
    if (e.target.tagName === 'INPUT') return;
    if (selectedTaskId === todo.id) {
      deselectTask();
    } else {
      selectTask(todo.id);
    }
  });

  // Event: checkbox toggle
  var checkbox = item.querySelector('input[type="checkbox"]');
  checkbox.addEventListener('change', function () {
    toggleTodo(todo.id, this.checked);
  });

  return item;
}

// ── Select / Deselect task ───────────────────────────────────────
function selectTask(id) {
  deselectTask();
  selectedTaskId = id;
  var item = document.querySelector('.task-item[data-id="' + id + '"]');
  if (item) item.classList.add('selected');
  fabDelete.classList.add('visible');
}

function deselectTask() {
  selectedTaskId = null;
  var prev = document.querySelector('.task-item.selected');
  if (prev) prev.classList.remove('selected');
  fabDelete.classList.remove('visible');
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

  var descEl = document.getElementById('task-desc');
  var description = descEl ? descEl.value.trim() : '';

  createTodo(text, description);
  closeModal();
}

// ── Helpers ──────────────────────────────────────────────────────
function escapeHtml(str) {
  var div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}
