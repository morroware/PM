// Main App shell
const { useState, useEffect, useMemo, useRef } = React;

const App = () => {
  const [tasks, setTasks] = useState(() => {
    const saved = localStorage.getItem('ctt_tasks');
    if (saved) { try { return JSON.parse(saved); } catch {} }
    return TASKS;
  });
  const [view, setView] = useState(() => localStorage.getItem('ctt_view') || 'dashboard');
  const [openTaskId, setOpenTaskId] = useState(null);
  const [search, setSearch] = useState('');
  const [filterProject, setFilterProject] = useState(() => {
    const s = localStorage.getItem('ctt_project');
    return s === 'null' || !s ? null : s;
  });
  const [filterAssignee, setFilterAssignee] = useState(null);
  const [filterLabels, setFilterLabels] = useState([]);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddStatus, setQuickAddStatus] = useState('todo');

  const projectBtn = useRef();
  const assigneeBtn = useRef();
  const labelBtn = useRef();
  const [showProj, setShowProj] = useState(false);
  const [showAsg, setShowAsg] = useState(false);
  const [showLbl, setShowLbl] = useState(false);

  useEffect(() => { localStorage.setItem('ctt_tasks', JSON.stringify(tasks)); }, [tasks]);
  useEffect(() => { localStorage.setItem('ctt_view', view); }, [view]);
  useEffect(() => { localStorage.setItem('ctt_project', filterProject || 'null'); }, [filterProject]);

  // keyboard shortcut for search
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        document.getElementById('global-search')?.focus();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'n' && !e.shiftKey && !openTaskId) {
        e.preventDefault();
        setQuickAddOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openTaskId]);

  // Filtered tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      if (filterProject && t.project !== filterProject) return false;
      if (filterAssignee && !t.assignees.includes(filterAssignee)) return false;
      if (filterLabels.length && !filterLabels.some(l => t.labels.includes(l))) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (!t.title.toLowerCase().includes(q) && !t.id.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [tasks, filterProject, filterAssignee, filterLabels, search]);

  // Handlers
  const updateTask = (id, patch) => setTasks(ts => ts.map(t => t.id === id ? { ...t, ...patch } : t));
  const moveTask = (id, statusId) => updateTask(id, { status: statusId });
  const toggleStatus = (id) => {
    const t = tasks.find(x => x.id === id);
    updateTask(id, { status: t.status === 'done' ? 'todo' : 'done' });
  };
  const toggleSubtask = (taskId, subId) => setTasks(ts => ts.map(t => {
    if (t.id !== taskId) return t;
    return { ...t, subtasks: (t.subtasks||[]).map(s => s.id === subId ? { ...s, done: !s.done } : s) };
  }));
  const addSubtask = (taskId, text) => setTasks(ts => ts.map(t => {
    if (t.id !== taskId) return t;
    return { ...t, subtasks: [...(t.subtasks||[]), { id: `s${Date.now()}`, text, done: false }] };
  }));
  const addTask = ({ title, status = 'todo', project = filterProject || 'p1', assignees = [ME], labels = [], priority = 2 }) => {
    const idNum = Math.max(...tasks.map(t => parseInt(t.id.split('-')[1]))) + 1;
    const newTask = {
      id: `CTT-${idNum}`, title, status, project, assignees, labels, priority,
      due: daysFromNow(3), estimate: '2h', subtasks: [],
    };
    setTasks(ts => [newTask, ...ts]);
    return newTask.id;
  };

  const openTask = tasks.find(t => t.id === openTaskId);

  const viewDef = [
    { key: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
    { key: 'kanban',    label: 'Kanban',    icon: 'kanban' },
    { key: 'list',      label: 'List',      icon: 'list' },
    { key: 'checklist', label: 'My tasks',  icon: 'checkSquare' },
    { key: 'calendar',  label: 'Calendar',  icon: 'calendar' },
  ];

  const currentProj = filterProject ? projectById(filterProject) : null;

  return (
    <div className="app">
      {/* SIDEBAR */}
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 21V8l9-5 9 5v13" />
              <path d="M9 21v-7h6v7" />
              <path d="M3 10h4M17 10h4M3 15h4M17 15h4" />
            </svg>
          </div>
          <div>
            <div className="brand-name">Castle</div>
            <div className="brand-sub">tech · tasks</div>
          </div>
        </div>

        <div className="workspace-switcher">
          <div className="ws-avatar">CT</div>
          <div className="ws-name">Castle Tech Ops</div>
          <Icon name="chevronDown" size={13} className="ws-chev" />
        </div>

        <div className="sidebar-scroll">
          <div className="nav-section">
            <div className="nav-item" onClick={() => { setView('dashboard'); setFilterProject(null); }}>
              <Icon name="home" size={15} /> Home
            </div>
            <div className="nav-item">
              <Icon name="inbox" size={15} /> Inbox
              <span className="count">3</span>
            </div>
            <div className={`nav-item ${view === 'checklist' && !filterProject ? 'active' : ''}`} onClick={() => { setView('checklist'); setFilterProject(null); }}>
              <Icon name="checkSquare" size={15} /> My tasks
              <span className="count">{tasks.filter(t => t.assignees.includes(ME) && t.status !== 'done').length}</span>
            </div>
          </div>

          <div className="nav-section">
            <div className="nav-label">
              Projects
              <span className="add"><Icon name="plus" size={12}/></span>
            </div>
            {PROJECTS.map(p => {
              const count = tasks.filter(t => t.project === p.id && t.status !== 'done').length;
              return (
                <div key={p.id} className={`nav-proj ${filterProject === p.id ? 'active' : ''}`}
                  style={filterProject === p.id ? { background: 'var(--acc-soft)', color: 'var(--fg-0)' } : {}}
                  onClick={() => { setFilterProject(filterProject === p.id ? null : p.id); if (view === 'dashboard') setView('kanban'); }}>
                  <span className="proj-dot" style={{ background: p.color }} />
                  <span className="proj-name">{p.name}</span>
                  <span className="proj-count">{count}</span>
                </div>
              );
            })}
          </div>

          <div className="nav-section">
            <div className="nav-label">Labels</div>
            {LABELS.slice(0, 5).map(l => (
              <div key={l.id} className="nav-item" style={{ padding:'5px 10px' }}>
                <span className="tag" style={{
                  width: 10, height: 10, padding: 0, borderRadius: 3,
                  background: l.color === 'red' ? '#EF4444' : l.color === 'blue' ? '#3B82F6' : l.color === 'amber' ? '#F59E0B' : l.color === 'green' ? '#22C55E' : l.color === 'violet' ? '#A855F7' : l.color === 'slate' ? '#64748B' : l.color === 'pink' ? '#EC4899' : '#06B6D4'
                }}/>
                <span style={{ fontSize: 12.5 }}>{l.name}</span>
              </div>
            ))}
          </div>

          <div className="nav-section">
            <div className="nav-label">Views</div>
            <div className="nav-item"><Icon name="star" size={14}/> Starred</div>
            <div className="nav-item"><Icon name="archive" size={14}/> Archive</div>
          </div>
        </div>

        <div className="sidebar-footer">
          <Avatar user={teamById(ME)} size={28} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="me">Ops Manager</div>
            <div className="me-role">castle-tech.co</div>
          </div>
          <button className="icon-btn" style={{ width: 26, height: 26 }}><Icon name="settings" size={14}/></button>
        </div>
      </aside>

      {/* MAIN */}
      <main className="main">
        <div className="topbar">
          <div className="crumbs">
            <span>Workspace</span>
            <Icon name="chevronRight" size={12} className="sep"/>
            {currentProj ? (<>
              <span>{currentProj.name}</span>
              <Icon name="chevronRight" size={12} className="sep"/>
            </>) : null}
            <span className="cur">{viewDef.find(v => v.key === view)?.label}</span>
          </div>
          <div className="search" style={{marginLeft:'auto'}}>
            <Icon name="search" size={14} style={{color:'var(--fg-3)'}}/>
            <input id="global-search" placeholder="Search tasks..." value={search} onChange={e => setSearch(e.target.value)}/>
            <span className="kbd">⌘K</span>
          </div>
          <button className="icon-btn" title="Notifications"><Icon name="bell" size={16}/>
            <span style={{ position:'absolute', top: 6, right: 6, width: 6, height: 6, borderRadius:'50%', background:'var(--red)' }}/>
          </button>
          <button className="btn btn-primary" onClick={() => { setQuickAddStatus('todo'); setQuickAddOpen(true); }}>
            <Icon name="plus" size={14}/> New task
          </button>
        </div>

        {/* filter & view toolbar */}
        <div className="filters">
          <div className="view-tabs">
            {viewDef.map(v => (
              <button key={v.key} className={`view-tab ${view === v.key ? 'active' : ''}`} onClick={() => setView(v.key)}>
                <Icon name={v.icon} size={13}/> {v.label}
              </button>
            ))}
          </div>

          {view !== 'dashboard' && view !== 'checklist' && (<>
            <div style={{ width: 1, height: 20, background: 'var(--line)', margin: '0 4px' }}/>
            <button ref={projectBtn} className="filter-pill" onClick={() => setShowProj(v=>!v)}>
              <Icon name="folder" size={12}/>
              {filterProject ? projectById(filterProject).name : 'All projects'}
              <Icon name="chevronDown" size={11}/>
            </button>
            <Popover open={showProj} onClose={() => setShowProj(false)} anchor={projectBtn}>
              <div className="pop-item" onClick={() => { setFilterProject(null); setShowProj(false); }}>All projects</div>
              {PROJECTS.map(p => (
                <div key={p.id} className={`pop-item ${filterProject === p.id ? 'selected' : ''}`} onClick={() => { setFilterProject(p.id); setShowProj(false); }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: p.color }}/>
                  <span>{p.name}</span>
                </div>
              ))}
            </Popover>

            <button ref={assigneeBtn} className="filter-pill" onClick={() => setShowAsg(v=>!v)}>
              <Icon name="user" size={12}/>
              {filterAssignee ? teamById(filterAssignee).name : 'Anyone'}
              <Icon name="chevronDown" size={11}/>
            </button>
            <AssigneePicker anchor={assigneeBtn} open={showAsg} onClose={() => setShowAsg(false)}
              selected={filterAssignee ? [filterAssignee] : []}
              onToggle={uid => { setFilterAssignee(filterAssignee === uid ? null : uid); setShowAsg(false); }}/>

            <button ref={labelBtn} className="filter-pill" onClick={() => setShowLbl(v=>!v)}>
              <Icon name="tag" size={12}/>
              {filterLabels.length ? `${filterLabels.length} labels` : 'Labels'}
              <Icon name="chevronDown" size={11}/>
            </button>
            <LabelPicker anchor={labelBtn} open={showLbl} onClose={() => setShowLbl(false)}
              selected={filterLabels}
              onToggle={lid => setFilterLabels(ls => ls.includes(lid) ? ls.filter(x=>x!==lid) : [...ls, lid])}/>

            {(filterProject || filterAssignee || filterLabels.length > 0) && (
              <button className="btn btn-muted" style={{fontSize: 11.5, padding:'4px 8px'}}
                onClick={() => { setFilterProject(null); setFilterAssignee(null); setFilterLabels([]); }}>
                <Icon name="x" size={11}/> Clear
              </button>
            )}

            <div style={{ marginLeft: 'auto' }} className="hstack">
              <span style={{ fontSize: 11.5, color: 'var(--fg-3)' }}>{filteredTasks.length} task{filteredTasks.length !== 1 ? 's' : ''}</span>
            </div>
          </>)}
        </div>

        {/* content */}
        <div className="content">
          {view === 'dashboard' && <Dashboard tasks={tasks} onOpenTask={setOpenTaskId} onNavigate={setView} />}
          {view === 'kanban' && <Kanban tasks={filteredTasks} onOpenTask={setOpenTaskId} onMoveTask={moveTask}
             onAddTask={(statusId) => { setQuickAddStatus(statusId); setQuickAddOpen(true); }}/>}
          {view === 'list' && <List tasks={filteredTasks} onOpenTask={setOpenTaskId} onToggleStatus={toggleStatus}
             onAddTask={(statusId) => { setQuickAddStatus(statusId || 'todo'); setQuickAddOpen(true); }}/>}
          {view === 'checklist' && <Checklist tasks={tasks} onOpenTask={setOpenTaskId} onToggleStatus={toggleStatus} onToggleSubtask={toggleSubtask}/>}
          {view === 'calendar' && <CalendarView tasks={filteredTasks} onOpenTask={setOpenTaskId}/>}
        </div>
      </main>

      {/* Task detail drawer */}
      {openTask && <TaskDetail task={openTask} onClose={() => setOpenTaskId(null)}
        onUpdate={updateTask} onToggleSubtask={toggleSubtask} onAddSubtask={addSubtask} />}

      {/* Quick-add modal */}
      {quickAddOpen && <QuickAdd
        defaultStatus={quickAddStatus}
        defaultProject={filterProject}
        onClose={() => setQuickAddOpen(false)}
        onCreate={(t) => { const id = addTask(t); setQuickAddOpen(false); setOpenTaskId(id); }}/>}
    </div>
  );
};

// Quick-add modal
const QuickAdd = ({ defaultStatus, defaultProject, onClose, onCreate }) => {
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState(defaultStatus || 'todo');
  const [project, setProject] = useState(defaultProject || 'p1');
  const [priority, setPriority] = useState(2);
  const [assignees, setAssignees] = useState([ME]);
  const [labels, setLabels] = useState([]);

  const asgRef = useRef(), lblRef = useRef(), statRef = useRef(), prioRef = useRef(), projRef = useRef();
  const [showA, setShowA] = useState(false), [showL, setShowL] = useState(false);
  const [showS, setShowS] = useState(false), [showP, setShowP] = useState(false);
  const [showPr, setShowPr] = useState(false);

  const submit = () => { if (title.trim()) onCreate({ title: title.trim(), status, project, priority, assignees, labels }); };

  return (
    <>
      <div onClick={onClose} style={{ position:'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 70, animation:'fadeIn 0.15s' }}/>
      <div style={{
        position:'fixed', top: '18%', left: '50%', transform: 'translateX(-50%)',
        width: 560, background: 'var(--bg-2)', border:'1px solid var(--line-2)', borderRadius: 14,
        boxShadow: 'var(--shadow-pop)', zIndex: 71, animation:'scaleIn 0.15s',
      }}>
        <div style={{ padding: '18px 20px 10px', borderBottom:'1px solid var(--line)' }}>
          <div style={{ fontSize: 11, color:'var(--fg-3)', letterSpacing:'0.06em', textTransform:'uppercase', fontWeight: 600, marginBottom: 10 }}>Create task</div>
          <input autoFocus placeholder="What needs to be done?" value={title}
            onChange={e => setTitle(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onClose(); }}
            style={{ width:'100%', background:'transparent', border:'none', outline:'none', fontSize: 17, fontWeight: 500, color:'var(--fg-0)' }}/>
        </div>
        <div style={{ padding: 14, display:'flex', flexWrap:'wrap', gap: 8 }}>
          <button ref={projRef} className="chip" onClick={() => setShowP(v=>!v)}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: projectById(project).color }}/>
            {projectById(project).name}
          </button>
          <Popover open={showP} onClose={() => setShowP(false)} anchor={projRef}>
            {PROJECTS.map(p => (
              <div key={p.id} className={`pop-item ${project === p.id ? 'selected' : ''}`} onClick={() => { setProject(p.id); setShowP(false); }}>
                <span style={{ width:10, height:10, borderRadius: 3, background: p.color }}/>{p.name}
              </div>
            ))}
          </Popover>

          <button ref={statRef} className="chip" onClick={() => setShowS(v=>!v)}><StatusPill statusId={status}/></button>
          <StatusPicker anchor={statRef} open={showS} onClose={() => setShowS(false)} value={status} onChange={setStatus}/>

          <button ref={prioRef} className="chip" onClick={() => setShowPr(v=>!v)}>
            <PriorityFlag p={priority} showLabel/>
          </button>
          <PriorityPicker anchor={prioRef} open={showPr} onClose={() => setShowPr(false)} value={priority} onChange={setPriority}/>

          <button ref={asgRef} className="chip" onClick={() => setShowA(v=>!v)}>
            <Icon name="user" size={11}/> {assignees.length ? `${assignees.length} assignee${assignees.length>1?'s':''}` : 'Unassigned'}
          </button>
          <AssigneePicker anchor={asgRef} open={showA} onClose={() => setShowA(false)}
            selected={assignees}
            onToggle={uid => setAssignees(a => a.includes(uid) ? a.filter(x=>x!==uid) : [...a, uid])}/>

          <button ref={lblRef} className="chip" onClick={() => setShowL(v=>!v)}>
            <Icon name="tag" size={11}/> {labels.length ? `${labels.length} label${labels.length>1?'s':''}` : 'Labels'}
          </button>
          <LabelPicker anchor={lblRef} open={showL} onClose={() => setShowL(false)}
            selected={labels}
            onToggle={lid => setLabels(ls => ls.includes(lid) ? ls.filter(x=>x!==lid) : [...ls, lid])}/>
        </div>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding: '10px 14px', borderTop:'1px solid var(--line)' }}>
          <span style={{ fontSize: 11.5, color:'var(--fg-3)' }}><span className="mono" style={{ background:'var(--bg-3)', padding:'1px 5px', borderRadius: 4, border:'1px solid var(--line-2)' }}>Esc</span> to close · <span className="mono" style={{ background:'var(--bg-3)', padding:'1px 5px', borderRadius: 4, border:'1px solid var(--line-2)' }}>Enter</span> to create</span>
          <div className="hstack">
            <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={submit} disabled={!title.trim()} style={{ opacity: title.trim()?1:0.5 }}>
              Create task
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
