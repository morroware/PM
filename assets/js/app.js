// Main app shell. Assumes icons.js, api.js, ui.js, and the view files have loaded.

(async function main() {
  const rootEl = document.getElementById('root');
  mount(rootEl, h('div', { class: 'empty', style: { padding: '80px 20px' } }, 'Loading…'));

  // Ensure session.
  try {
    const me = (await API.me()).user;
    if (!me) { location.href = 'login.html'; return; }
  } catch (e) {
    location.href = 'login.html'; return;
  }

  // Bootstrap all data.
  let boot;
  try { boot = await API.bootstrap(); }
  catch (e) { mount(rootEl, h('div', { class: 'empty' }, 'Failed to load: ' + e.message)); return; }

  // Global state (used by UI helpers that call `window.state`).
  const state = window.state = {
    me:       boot.me,
    users:    boot.users,
    projects: boot.projects,
    labels:   boot.labels,
    tasks:    boot.tasks,
    activity: [],
    view: localStorage.getItem('pm_view') || 'dashboard',
    filterProject: null,
    filterAssignee: null,
    filterLabels: [],
    search: '',
    openTaskId: null,
    quickAddOpen: false,
    quickAddStatus: 'todo',
  };
  const saved = localStorage.getItem('pm_project');
  if (saved && saved !== 'null') state.filterProject = parseInt(saved, 10);

  // Kick off activity fetch in background.
  API.listActivity().then(r => { state.activity = r.activity; if (state.view === 'dashboard') renderApp(); }).catch(() => {});

  // ----- actions -----
  async function refreshTasks() {
    const r = await API.listTasks();
    state.tasks = r.tasks;
    renderApp();
  }
  async function updateTask(id, patch) {
    const r = await API.updateTask(id, patch);
    state.tasks = state.tasks.map(t => t.id === id ? r.task : t);
    renderApp();
    return r;
  }
  async function moveTask(id, statusId) { return updateTask(id, { status: statusId }); }
  async function toggleStatus(id) {
    const t = state.tasks.find(x => x.id === id);
    if (!t) return;
    return updateTask(id, { status: t.status === 'done' ? 'todo' : 'done' });
  }
  async function toggleSubtask(taskId, subId, done) {
    await API.updateSubtask(taskId, subId, { done });
  }
  async function addSubtask(taskId, text) {
    return API.addSubtask(taskId, text);
  }
  async function deleteTask(id) {
    await API.deleteTask(id);
    state.tasks = state.tasks.filter(t => t.id !== id);
    renderApp();
  }
  async function createTask(data) {
    const r = await API.createTask(data);
    state.tasks = [r.task, ...state.tasks];
    renderApp();
    return r.task;
  }

  // ----- filter logic -----
  function filteredTasks() {
    const q = state.search.trim().toLowerCase();
    return state.tasks.filter(t => {
      if (state.filterProject && t.project != state.filterProject) return false;
      if (state.filterAssignee && !t.assignees.includes(state.filterAssignee)) return false;
      if (state.filterLabels.length && !state.filterLabels.some(l => t.labels.includes(l))) return false;
      if (q && !t.title.toLowerCase().includes(q) && !t.ref.toLowerCase().includes(q)) return false;
      return true;
    });
  }

  // ----- render root -----
  function renderApp() {
    const app = h('div', { class: 'app' });
    app.appendChild(renderSidebar());
    app.appendChild(renderMain());
    mount(rootEl, app);

    if (state.openTaskId) {
      const t = state.tasks.find(x => x.id === state.openTaskId);
      if (t) rootEl.appendChild(renderTaskDetail(t, {
        onClose: () => { state.openTaskId = null; renderApp(); },
        onUpdate: updateTask,
        onToggleSubtask: toggleSubtask,
        onAddSubtask: addSubtask,
        onDeleteTask: deleteTask,
      }));
      else state.openTaskId = null;
    }
    if (state.quickAddOpen) rootEl.appendChild(renderQuickAdd());
  }

  // ----- sidebar -----
  function renderSidebar() {
    const side = h('aside', { class: 'sidebar' });

    side.appendChild(h('div', { class: 'brand' },
      (() => {
        const m = h('div', { class: 'brand-mark' });
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('fill', 'none');
        svg.setAttribute('stroke', 'white');
        svg.setAttribute('stroke-width', '2.2');
        svg.setAttribute('stroke-linecap', 'round');
        svg.setAttribute('stroke-linejoin', 'round');
        svg.innerHTML = '<path d="M3 21V8l9-5 9 5v13" /><path d="M9 21v-7h6v7" /><path d="M3 10h4M17 10h4M3 15h4M17 15h4" />';
        m.appendChild(svg);
        return m;
      })(),
      h('div', null,
        h('div', { class: 'brand-name' }, 'Castle'),
        h('div', { class: 'brand-sub' }, 'tech · tasks'),
      ),
    ));

    side.appendChild(h('div', { class: 'workspace-switcher' },
      h('div', { class: 'ws-avatar' }, (state.me.initials || 'CT').slice(0, 2)),
      h('div', { class: 'ws-name' }, 'Workspace'),
      Icon('chevronDown', 13, 1.75, 'ws-chev'),
    ));

    const scroll = h('div', { class: 'sidebar-scroll' });

    // Section: main nav
    const nav1 = h('div', { class: 'nav-section' });
    nav1.appendChild(NavItem('home', 'Home', state.view === 'dashboard' && !state.filterProject, () => {
      state.view = 'dashboard'; state.filterProject = null; persist(); renderApp();
    }));
    const myOpen = state.tasks.filter(t => t.assignees.includes(state.me.id) && t.status !== 'done').length;
    nav1.appendChild(NavItem('checkSquare', 'My tasks', state.view === 'checklist' && !state.filterProject, () => {
      state.view = 'checklist'; state.filterProject = null; persist(); renderApp();
    }, String(myOpen)));
    scroll.appendChild(nav1);

    // Section: projects
    const projSection = h('div', { class: 'nav-section' });
    projSection.appendChild(h('div', { class: 'nav-label' }, 'Projects'));
    for (const p of state.projects) {
      const count = state.tasks.filter(t => t.project == p.id && t.status !== 'done').length;
      const isActive = state.filterProject == p.id;
      const row = h('div', {
        class: 'nav-proj' + (isActive ? ' active' : ''),
        onClick: () => {
          state.filterProject = isActive ? null : p.id;
          if (state.view === 'dashboard') state.view = 'kanban';
          persist(); renderApp();
        },
      },
        h('span', { class: 'proj-dot', style: { background: p.color } }),
        h('span', { class: 'proj-name' }, p.name),
        h('span', { class: 'proj-count' }, String(count)),
      );
      projSection.appendChild(row);
    }
    scroll.appendChild(projSection);

    // Section: labels (first 5)
    const labelSection = h('div', { class: 'nav-section' });
    labelSection.appendChild(h('div', { class: 'nav-label' }, 'Labels'));
    for (const l of state.labels.slice(0, 5)) {
      labelSection.appendChild(h('div', { class: 'nav-item', style: { padding: '5px 10px' },
        onClick: () => { state.filterLabels = [l.id]; state.view = 'list'; persist(); renderApp(); } },
        h('span', {
          style: {
            width: '10px', height: '10px', padding: 0, borderRadius: '3px',
            background: labelCssColor(l.color), display: 'inline-block',
          }
        }),
        h('span', { style: { fontSize: '12.5px' } }, l.name),
      ));
    }
    scroll.appendChild(labelSection);

    side.appendChild(scroll);

    // Footer (user)
    side.appendChild(h('div', { class: 'sidebar-footer' },
      Avatar(state.me, 28),
      h('div', { style: { flex: 1, minWidth: 0 } },
        h('div', { class: 'me' }, state.me.name),
        h('div', { class: 'me-role' }, state.me.role || ''),
      ),
      h('button', { class: 'icon-btn sm', title: 'Log out',
        onClick: async () => { await API.logout(); location.href = 'login.html'; } }, Icon('logout', 14)),
    ));

    return side;
  }

  function NavItem(icon, label, active, onClick, count) {
    const el = h('div', { class: 'nav-item' + (active ? ' active' : ''), onClick },
      Icon(icon, 15),
      h('span', null, label),
    );
    if (count) el.appendChild(h('span', { class: 'count' }, count));
    return el;
  }

  function labelCssColor(name) {
    return {
      red: '#EF4444', blue: '#3B82F6', amber: '#F59E0B', green: '#22C55E',
      violet: '#A855F7', slate: '#64748B', pink: '#EC4899', cyan: '#06B6D4',
    }[name] || '#64748B';
  }

  // ----- main area -----
  function renderMain() {
    const main = h('main', { class: 'main' });
    main.appendChild(renderTopbar());
    main.appendChild(renderFilters());
    const content = h('div', { class: 'content' });
    main.appendChild(content);

    const tasks = filteredTasks();
    const handlers = {
      onOpenTask: (id) => { state.openTaskId = id; renderApp(); },
      onAddTask: (statusId) => { state.quickAddStatus = statusId || 'todo'; state.quickAddOpen = true; renderApp(); },
      onMoveTask: (id, s) => moveTask(id, s),
      onToggleStatus: id => toggleStatus(id),
      onToggleSubtask: toggleSubtask,
      onNavigate: (v, projectId) => {
        state.view = v;
        if (projectId !== undefined) state.filterProject = projectId;
        persist(); renderApp();
      },
      activity: state.activity,
    };

    switch (state.view) {
      case 'dashboard': content.appendChild(renderDashboard(state.tasks, handlers)); break;
      case 'kanban':    content.appendChild(renderKanban(tasks, handlers)); break;
      case 'list':      content.appendChild(renderList(tasks, handlers)); break;
      case 'checklist': content.appendChild(renderChecklist(state.tasks, handlers)); break;
      case 'calendar':  content.appendChild(renderCalendar(tasks, handlers)); break;
      default: content.appendChild(h('div', { class: 'empty' }, 'Unknown view'));
    }
    return main;
  }

  function renderTopbar() {
    const bar = h('div', { class: 'topbar' });
    const proj = state.filterProject ? projectById(state.filterProject) : null;
    const viewLabels = { dashboard: 'Dashboard', kanban: 'Kanban', list: 'List', checklist: 'My tasks', calendar: 'Calendar' };
    bar.appendChild(h('div', { class: 'crumbs' },
      h('span', null, 'Workspace'),
      Icon('chevronRight', 12, 1.75, 'sep'),
      proj ? h('span', null, proj.name) : null,
      proj ? Icon('chevronRight', 12, 1.75, 'sep') : null,
      h('span', { class: 'cur' }, viewLabels[state.view] || ''),
    ));

    const search = h('div', { class: 'search', style: { marginLeft: 'auto' } });
    search.appendChild(Icon('search', 14, 1.75, ''));
    const input = h('input', {
      id: 'global-search', placeholder: 'Search tasks...', value: state.search,
      onInput: e => { state.search = e.target.value; renderMainContent(); },
    });
    search.appendChild(input);
    search.appendChild(h('span', { class: 'kbd' }, navigator.platform.includes('Mac') ? '⌘K' : 'Ctrl+K'));
    bar.appendChild(search);

    bar.appendChild(h('button', { class: 'btn btn-primary',
      onClick: () => { state.quickAddStatus = 'todo'; state.quickAddOpen = true; renderApp(); } },
      Icon('plus', 14), ' New task'));
    return bar;
  }

  // Re-render just main area (used for search typing to avoid losing focus)
  let mainRenderHandle = null;
  function renderMainContent() {
    clearTimeout(mainRenderHandle);
    mainRenderHandle = setTimeout(() => {
      const mainEl = rootEl.querySelector('.main');
      if (!mainEl) return renderApp();
      const newMain = renderMain();
      mainEl.replaceWith(newMain);
    }, 100);
  }

  function renderFilters() {
    const bar = h('div', { class: 'filters' });
    const viewDef = [
      ['dashboard', 'Dashboard', 'dashboard'],
      ['kanban',    'Kanban',    'kanban'],
      ['list',      'List',      'list'],
      ['checklist', 'My tasks',  'checkSquare'],
      ['calendar',  'Calendar',  'calendar'],
    ];
    const tabs = h('div', { class: 'view-tabs' });
    for (const [k, l, ic] of viewDef) {
      tabs.appendChild(h('button', {
        class: 'view-tab' + (state.view === k ? ' active' : ''),
        onClick: () => { state.view = k; persist(); renderApp(); },
      }, Icon(ic, 13), ' ' + l));
    }
    bar.appendChild(tabs);

    if (state.view !== 'dashboard' && state.view !== 'checklist') {
      bar.appendChild(h('div', { class: 'filters-sep' }));

      // Project filter
      const projName = state.filterProject ? projectById(state.filterProject)?.name : 'All projects';
      const projBtn = h('button', { class: 'filter-pill' }, Icon('folder', 12), ' ' + projName + ' ', Icon('chevronDown', 11));
      projBtn.addEventListener('click', () => {
        openPopover(projBtn, ({close}) => {
          const wrap = h('div');
          wrap.appendChild(PopoverItem({
            selected: !state.filterProject,
            onSelect: () => { state.filterProject = null; persist(); close(); renderApp(); },
            children: h('span', null, 'All projects'),
          }));
          return h('div', null, wrap, projectPickerContent(state.filterProject, (id) => {
            state.filterProject = id; persist(); renderApp();
          }, close));
        });
      });
      bar.appendChild(projBtn);

      // Assignee filter
      const asgLabel = state.filterAssignee ? (userById(state.filterAssignee)?.name || 'Someone') : 'Anyone';
      const asgBtn = h('button', { class: 'filter-pill' }, Icon('user', 12), ' ' + asgLabel + ' ', Icon('chevronDown', 11));
      asgBtn.addEventListener('click', () => {
        openPopover(asgBtn, ({close}) => assigneePickerContent(
          state.filterAssignee ? [state.filterAssignee] : [],
          uid => { state.filterAssignee = state.filterAssignee === uid ? null : uid; renderApp(); },
          close,
        ));
      });
      bar.appendChild(asgBtn);

      // Labels
      const lblLabel = state.filterLabels.length ? `${state.filterLabels.length} label${state.filterLabels.length > 1 ? 's' : ''}` : 'Labels';
      const lblBtn = h('button', { class: 'filter-pill' }, Icon('tag', 12), ' ' + lblLabel + ' ', Icon('chevronDown', 11));
      lblBtn.addEventListener('click', () => {
        openPopover(lblBtn, ({close}) => labelPickerContent(
          state.filterLabels,
          lid => {
            const set = new Set(state.filterLabels);
            set.has(lid) ? set.delete(lid) : set.add(lid);
            state.filterLabels = [...set];
            renderApp();
          },
          close, { keepOpen: true },
        ));
      });
      bar.appendChild(lblBtn);

      // Clear
      if (state.filterProject || state.filterAssignee || state.filterLabels.length) {
        bar.appendChild(h('button', {
          class: 'btn btn-muted', style: { fontSize: '11.5px', padding: '4px 8px' },
          onClick: () => { state.filterProject = null; state.filterAssignee = null; state.filterLabels = []; persist(); renderApp(); }
        }, Icon('x', 11), ' Clear'));
      }

      // Count
      const n = filteredTasks().length;
      bar.appendChild(h('div', { style: { marginLeft: 'auto' }, class: 'hstack' },
        h('span', { style: { fontSize: '11.5px', color: 'var(--fg-3)' } }, `${n} task${n !== 1 ? 's' : ''}`),
      ));
    }
    return bar;
  }

  // ----- quick-add modal -----
  function renderQuickAdd() {
    const form = {
      title: '', status: state.quickAddStatus || 'todo',
      project: state.filterProject || (state.projects[0] && state.projects[0].id),
      priority: 2, assignees: [state.me.id], labels: [],
    };

    const frag = document.createDocumentFragment();
    const scrim = h('div', { class: 'scrim', onClick: close });
    frag.appendChild(scrim);
    const modal = h('div', { class: 'modal' });
    frag.appendChild(modal);

    function close() {
      state.quickAddOpen = false;
      scrim.remove(); modal.remove();
    }
    async function submit() {
      const title = form.title.trim();
      if (!title) return;
      try {
        const t = await createTask({
          title, status: form.status, project: form.project,
          priority: form.priority, assignees: form.assignees, labels: form.labels,
        });
        close();
        state.openTaskId = t.id;
        renderApp();
      } catch (e) { toast(e.message, 'error'); }
    }

    function redraw() {
      modal.replaceChildren();
      const head = h('div', { class: 'modal-head' });
      head.appendChild(h('div', { class: 'modal-head-label' }, 'Create task'));
      const titleInput = h('input', {
        class: 'modal-title-input', autofocus: true, placeholder: 'What needs to be done?',
        value: form.title,
        onInput: e => { form.title = e.target.value; submitBtn.disabled = !form.title.trim(); },
        onKeydown: e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') close(); },
      });
      head.appendChild(titleInput);
      modal.appendChild(head);

      const body = h('div', { class: 'modal-body' });

      const projBtn = h('button', { class: 'chip' },
        form.project ? [
          h('span', { style: { width: '8px', height: '8px', borderRadius: '2px', background: projectById(form.project)?.color || '#64748B' } }),
          projectById(form.project)?.name || 'Project',
        ] : 'Project');
      projBtn.addEventListener('click', () => openPopover(projBtn, ({close}) => projectPickerContent(form.project, v => { form.project = v; redraw(); }, close)));
      body.appendChild(projBtn);

      const statBtn = h('button', { class: 'chip' }, StatusPill(form.status));
      statBtn.addEventListener('click', () => openPopover(statBtn, ({close}) => statusPickerContent(form.status, v => { form.status = v; redraw(); }, close)));
      body.appendChild(statBtn);

      const prioBtn = h('button', { class: 'chip' }, PriorityFlag(form.priority, true));
      prioBtn.addEventListener('click', () => openPopover(prioBtn, ({close}) => priorityPickerContent(form.priority, v => { form.priority = v; redraw(); }, close)));
      body.appendChild(prioBtn);

      const asgBtn = h('button', { class: 'chip' }, Icon('user', 11), ' ',
        form.assignees.length ? `${form.assignees.length} assignee${form.assignees.length > 1 ? 's' : ''}` : 'Unassigned');
      asgBtn.addEventListener('click', () => openPopover(asgBtn, ({close}) => assigneePickerContent(form.assignees, uid => {
        const set = new Set(form.assignees); set.has(uid) ? set.delete(uid) : set.add(uid);
        form.assignees = [...set]; redraw();
      }, close)));
      body.appendChild(asgBtn);

      const lblBtn = h('button', { class: 'chip' }, Icon('tag', 11), ' ',
        form.labels.length ? `${form.labels.length} label${form.labels.length > 1 ? 's' : ''}` : 'Labels');
      lblBtn.addEventListener('click', () => openPopover(lblBtn, ({close}) => labelPickerContent(form.labels, lid => {
        const set = new Set(form.labels); set.has(lid) ? set.delete(lid) : set.add(lid);
        form.labels = [...set]; redraw();
      }, close, { keepOpen: true })));
      body.appendChild(lblBtn);

      modal.appendChild(body);

      const foot = h('div', { class: 'modal-foot' });
      foot.appendChild(h('span', { class: 'hint' },
        h('span', { class: 'kbd-inline' }, 'Esc'), ' to close · ',
        h('span', { class: 'kbd-inline' }, 'Enter'), ' to create'));
      const submitBtn = h('button', { class: 'btn btn-primary', disabled: !form.title.trim(), onClick: submit }, 'Create task');
      foot.appendChild(h('div', { class: 'hstack' },
        h('button', { class: 'btn btn-ghost', onClick: close }, 'Cancel'),
        submitBtn,
      ));
      modal.appendChild(foot);

      setTimeout(() => titleInput.focus(), 0);
    }
    redraw();
    return frag;
  }

  // ----- persistence -----
  function persist() {
    localStorage.setItem('pm_view', state.view);
    localStorage.setItem('pm_project', state.filterProject == null ? 'null' : String(state.filterProject));
  }

  // ----- shortcuts -----
  window.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      document.getElementById('global-search')?.focus();
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'n' && !e.shiftKey && !state.openTaskId && !state.quickAddOpen) {
      e.preventDefault();
      state.quickAddStatus = 'todo';
      state.quickAddOpen = true;
      renderApp();
    }
  });

  renderApp();
})();
