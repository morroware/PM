// List / table view with sortable columns and grouping by status
const List = ({ tasks, onOpenTask, onAddTask, onToggleStatus }) => {
  const [groupBy, setGroupBy] = React.useState('status');
  const [sortBy, setSortBy] = React.useState('priority');
  const [collapsed, setCollapsed] = React.useState({});

  const grouped = React.useMemo(() => {
    let groups = [];
    if (groupBy === 'status') {
      groups = STATUSES.map(s => ({
        key: s.id, title: s.name, color: s.color,
        tasks: tasks.filter(t => t.status === s.id),
      }));
    } else if (groupBy === 'project') {
      groups = PROJECTS.map(p => ({
        key: p.id, title: p.name, color: p.color,
        tasks: tasks.filter(t => t.project === p.id),
      }));
    } else if (groupBy === 'assignee') {
      groups = TEAM.map(u => ({
        key: u.id, title: u.name, color: u.color,
        tasks: tasks.filter(t => t.assignees.includes(u.id)),
      }));
    }
    // sort within groups
    groups.forEach(g => g.tasks.sort((a,b) => {
      if (sortBy === 'priority') return a.priority - b.priority;
      if (sortBy === 'due') return new Date(a.due) - new Date(b.due);
      if (sortBy === 'title') return a.title.localeCompare(b.title);
      return 0;
    }));
    return groups.filter(g => g.tasks.length);
  }, [tasks, groupBy, sortBy]);

  return (
    <div style={{ padding: '16px 20px' }}>
      <div style={{ display:'flex', gap: 8, marginBottom: 14 }}>
        <Segmented label="Group by" value={groupBy} onChange={setGroupBy} options={[
          {v:'status', l:'Status'},{v:'project', l:'Project'},{v:'assignee', l:'Assignee'}
        ]}/>
        <Segmented label="Sort" value={sortBy} onChange={setSortBy} options={[
          {v:'priority', l:'Priority'},{v:'due', l:'Due'},{v:'title', l:'Title'}
        ]}/>
      </div>

      <div style={{ background: 'var(--bg-2)', border:'1px solid var(--line)', borderRadius: 12, overflow:'hidden' }}>
        {/* Header */}
        <div style={{
          display:'grid', gridTemplateColumns: '26px 60px 1fr 140px 120px 110px 110px 80px 50px',
          padding: '10px 14px', borderBottom: '1px solid var(--line)',
          fontSize: 11, color: 'var(--fg-3)', letterSpacing:'0.06em', textTransform:'uppercase', fontWeight: 600,
          background: 'var(--bg-1)'
        }}>
          <div></div>
          <div>ID</div>
          <div>Task</div>
          <div>Labels</div>
          <div>Assignees</div>
          <div>Due</div>
          <div>Priority</div>
          <div>Progress</div>
          <div style={{textAlign:'right'}}></div>
        </div>

        {grouped.map(g => {
          const isCollapsed = collapsed[g.key];
          return (
            <div key={g.key}>
              <div onClick={() => setCollapsed(c => ({ ...c, [g.key]: !c[g.key] }))}
                style={{
                  display:'flex', alignItems:'center', gap: 8,
                  padding: '10px 14px', background: 'var(--bg-1)',
                  cursor:'pointer', borderTop:'1px solid var(--line)', borderBottom:'1px solid var(--line)',
                }}>
                <Icon name="chevronDown" size={12} style={{ transform: isCollapsed?'rotate(-90deg)':'none', transition:'transform 0.15s', color:'var(--fg-3)' }} />
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: g.color }} />
                <span style={{ fontSize: 12.5, fontWeight: 600 }}>{g.title}</span>
                <span className="mono" style={{ fontSize: 11, color:'var(--fg-3)', background:'var(--bg-3)', padding:'1px 6px', borderRadius:4 }}>{g.tasks.length}</span>
                <button className="btn-muted btn" style={{ marginLeft:'auto', padding:'3px 8px', fontSize: 11.5 }}
                  onClick={(e) => { e.stopPropagation(); onAddTask(groupBy === 'status' ? g.key : undefined); }}>
                  <Icon name="plus" size={11}/> Add
                </button>
              </div>
              {!isCollapsed && g.tasks.map(t => (
                <ListRow key={t.id} task={t} onOpen={() => onOpenTask(t.id)} onToggleStatus={onToggleStatus} />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const Segmented = ({ label, value, onChange, options }) => (
  <div className="hstack" style={{ gap: 6, background:'var(--bg-2)', border:'1px solid var(--line)', padding: '3px', borderRadius: 8 }}>
    <span style={{ fontSize: 11.5, color:'var(--fg-3)', padding:'0 6px', fontWeight: 500 }}>{label}</span>
    {options.map(o => (
      <button key={o.v} onClick={() => onChange(o.v)} style={{
        padding: '4px 10px', borderRadius: 6, fontSize: 12,
        background: value === o.v ? 'var(--bg-4)' : 'transparent',
        color: value === o.v ? 'var(--fg-0)' : 'var(--fg-2)',
        fontWeight: 500,
      }}>{o.l}</button>
    ))}
  </div>
);

const ListRow = ({ task, onOpen, onToggleStatus }) => {
  const proj = projectById(task.project);
  const sub = task.subtasks || [];
  const subDone = sub.filter(s => s.done).length;
  const pct = sub.length ? (subDone/sub.length)*100 : (task.status === 'done' ? 100 : 0);
  const done = task.status === 'done';

  return (
    <div onClick={onOpen}
      style={{
        display:'grid', gridTemplateColumns: '26px 60px 1fr 140px 120px 110px 110px 80px 50px',
        padding: '10px 14px', borderTop: '1px solid var(--line)',
        cursor: 'pointer', fontSize: 13, alignItems: 'center',
        background: 'var(--bg-2)', transition:'background 0.1s',
      }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-3)'}
      onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-2)'}>

      <div onClick={(e) => { e.stopPropagation(); onToggleStatus(task.id); }}>
        <Checkbox checked={done} />
      </div>

      <span className="mono" style={{ fontSize: 11, color:'var(--fg-3)' }}>{task.id}</span>

      <div style={{ display:'flex', alignItems:'center', gap: 8, minWidth: 0 }}>
        <span style={{ width: 6, height: 6, borderRadius: 2, background: proj.color, flexShrink: 0 }} title={proj.name} />
        <span style={{
          overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
          textDecoration: done ? 'line-through' : 'none',
          color: done ? 'var(--fg-3)' : 'var(--fg-0)',
          fontWeight: 500,
        }}>{task.title}</span>
      </div>

      <div className="hstack" style={{ gap: 3, flexWrap:'wrap' }}>
        {task.labels.slice(0, 2).map(l => <Tag key={l} labelId={l} small />)}
        {task.labels.length > 2 && <span style={{ fontSize: 10.5, color:'var(--fg-3)' }}>+{task.labels.length - 2}</span>}
      </div>

      <AvatarStack userIds={task.assignees} size={22} />

      <DueDate due={task.due} />

      <PriorityFlag p={task.priority} showLabel />

      <div style={{ display:'flex', alignItems:'center', gap: 6 }}>
        <div style={{ flex:1, height: 4, background:'var(--bg-4)', borderRadius: 2, overflow:'hidden' }}>
          <div style={{ width: `${pct}%`, height:'100%', background: pct===100?'var(--green)':'var(--acc-0)', transition:'width 0.3s' }} />
        </div>
      </div>

      <div style={{ textAlign:'right' }}>
        <button className="icon-btn" style={{ width: 24, height: 24 }} onClick={(e)=>{e.stopPropagation();}}><Icon name="more" size={14}/></button>
      </div>
    </div>
  );
};

const Checkbox = ({ checked, onClick, size = 16 }) => (
  <div
    onClick={onClick}
    style={{
      width: size, height: size, borderRadius: 4,
      border: `1.5px solid ${checked ? 'var(--green)' : 'var(--fg-4)'}`,
      background: checked ? 'var(--green)' : 'transparent',
      display:'grid', placeItems:'center',
      transition: 'all 0.15s', cursor: 'pointer',
    }}>
    {checked && (
      <svg width={size*0.7} height={size*0.7} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 6 9 17l-5-5"/>
      </svg>
    )}
  </div>
);

Object.assign(window, { List, Checkbox, Segmented });
