// Checklist (my tasks today) - personal focus view
const Checklist = ({ tasks, onOpenTask, onToggleStatus, onToggleSubtask }) => {
  const myTasks = tasks.filter(t => t.assignees.includes(ME));

  const groups = [
    { key: 'overdue', title: 'Overdue', desc: 'needs attention', color:'#EF4444',
      items: myTasks.filter(t => t.status !== 'done' && new Date(t.due) < today) },
    { key: 'today', title: 'Today', desc: 'Tuesday, April 21', color:'#F59E0B',
      items: myTasks.filter(t => t.due === daysFromNow(0) && t.status !== 'done') },
    { key: 'tomorrow', title: 'Tomorrow', desc: 'Wednesday', color:'#3B82F6',
      items: myTasks.filter(t => t.due === daysFromNow(1) && t.status !== 'done') },
    { key: 'thisweek', title: 'Later this week', desc: '',  color:'#A855F7',
      items: myTasks.filter(t => { const d = new Date(t.due); const diff = (d-today)/86400000; return diff > 1 && diff <= 7 && t.status !== 'done'; }) },
    { key: 'later', title: 'Later', desc: '', color:'#8A94A8',
      items: myTasks.filter(t => { const d = new Date(t.due); const diff = (d-today)/86400000; return diff > 7 && t.status !== 'done'; }) },
    { key: 'done', title: 'Completed', desc: '', color:'#22C55E',
      items: myTasks.filter(t => t.status === 'done') },
  ];

  const totalOpen = myTasks.filter(t => t.status !== 'done').length;
  const totalDone = myTasks.filter(t => t.status === 'done').length;

  return (
    <div style={{ maxWidth: 820, margin: '0 auto', padding: '24px 24px 60px' }}>
      {/* Greeting */}
      <div style={{ marginBottom: 24, display: 'flex', alignItems:'flex-end', justifyContent:'space-between' }}>
        <div>
          <div style={{ fontSize: 12, color: 'var(--fg-3)', letterSpacing: '0.06em', textTransform:'uppercase', fontWeight: 600 }}>My checklist</div>
          <h1 style={{ margin: '4px 0 0', fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em' }}>
            {totalOpen} thing{totalOpen!==1?'s':''} to do today
          </h1>
          <p style={{ margin: '4px 0 0', color: 'var(--fg-2)', fontSize: 13.5 }}>
            {totalDone} done · stay focused
          </p>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap: 14 }}>
          <CompletionRing done={totalDone} total={totalOpen + totalDone} />
        </div>
      </div>

      {/* Groups */}
      <div style={{ display: 'grid', gap: 16 }}>
        {groups.filter(g => g.items.length).map(g => (
          <section key={g.key}>
            <div style={{ display:'flex', alignItems:'center', gap: 10, marginBottom: 8 }}>
              <span style={{ width: 6, height: 18, borderRadius: 3, background: g.color }}/>
              <h3 style={{ margin:0, fontSize: 13.5, fontWeight: 600, letterSpacing:'-0.01em' }}>{g.title}</h3>
              {g.desc && <span style={{ fontSize: 12, color: 'var(--fg-3)' }}>· {g.desc}</span>}
              <span className="mono" style={{ fontSize: 11, color:'var(--fg-3)', marginLeft: 'auto' }}>{g.items.length}</span>
            </div>
            <div style={{ background: 'var(--bg-2)', border:'1px solid var(--line)', borderRadius: 10 }}>
              {g.items.map((t, i) => (
                <ChecklistItem key={t.id} task={t} isLast={i===g.items.length-1}
                  onOpen={() => onOpenTask(t.id)}
                  onToggleStatus={() => onToggleStatus(t.id)}
                  onToggleSubtask={onToggleSubtask} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
};

const ChecklistItem = ({ task, onOpen, onToggleStatus, onToggleSubtask, isLast }) => {
  const proj = projectById(task.project);
  const [expanded, setExpanded] = React.useState(false);
  const sub = task.subtasks || [];
  const subDone = sub.filter(s => s.done).length;
  const done = task.status === 'done';

  return (
    <div style={{ borderBottom: isLast ? 'none' : '1px solid var(--line)' }}>
      <div style={{ display:'flex', alignItems:'flex-start', gap: 12, padding: '12px 14px' }}>
        <div style={{ paddingTop: 1 }} onClick={onToggleStatus}>
          <Checkbox checked={done} size={18} />
        </div>
        <div style={{ flex: 1, minWidth: 0, cursor:'pointer' }} onClick={onOpen}>
          <div style={{ display:'flex', alignItems:'center', gap: 8, flexWrap:'wrap' }}>
            <span style={{
              fontSize: 14, fontWeight: 500,
              textDecoration: done ? 'line-through' : 'none',
              color: done ? 'var(--fg-3)' : 'var(--fg-0)',
            }}>{task.title}</span>
            <PriorityFlag p={task.priority} />
          </div>
          <div style={{ display:'flex', alignItems:'center', gap: 10, marginTop: 5, flexWrap:'wrap', fontSize: 11.5, color:'var(--fg-3)' }}>
            <span className="mono" style={{ color:'var(--fg-3)' }}>{task.id}</span>
            <span style={{ display:'flex', alignItems:'center', gap: 4 }}>
              <span style={{ width: 6, height: 6, borderRadius: 2, background: proj.color }} />
              {proj.name}
            </span>
            <DueDate due={task.due} small />
            {sub.length > 0 && (
              <button onClick={(e) => { e.stopPropagation(); setExpanded(v=>!v); }} style={{
                display:'flex', alignItems:'center', gap: 4, color:'var(--fg-2)', fontSize: 11.5,
              }}>
                <Icon name="chevronRight" size={11} style={{ transform: expanded?'rotate(90deg)':'none', transition:'transform 0.15s' }}/>
                <Icon name="checkSquare" size={11}/>
                {subDone}/{sub.length} subtasks
              </button>
            )}
            {task.labels.slice(0,3).map(l => <Tag key={l} labelId={l} small />)}
          </div>
        </div>
        <AvatarStack userIds={task.assignees} size={22} />
      </div>
      {expanded && sub.length > 0 && (
        <div style={{ padding: '2px 14px 12px 44px', display:'grid', gap: 4 }}>
          {sub.map(s => (
            <div key={s.id} style={{ display:'flex', alignItems:'center', gap: 10, padding: '4px 8px', borderRadius: 6, cursor:'pointer' }}
              onClick={() => onToggleSubtask(task.id, s.id)}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-3)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <Checkbox checked={s.done} size={14} />
              <span style={{ fontSize: 12.5, color: s.done?'var(--fg-3)':'var(--fg-1)', textDecoration: s.done?'line-through':'none' }}>{s.text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const CompletionRing = ({ done, total }) => {
  const pct = total ? (done / total) : 0;
  const R = 22, C = 2 * Math.PI * R;
  return (
    <div style={{ display: 'flex', alignItems:'center', gap: 10, background:'var(--bg-2)', border:'1px solid var(--line)', padding: '8px 14px 8px 10px', borderRadius: 999 }}>
      <svg width="52" height="52" viewBox="0 0 52 52">
        <circle cx="26" cy="26" r={R} fill="none" stroke="var(--bg-4)" strokeWidth="4"/>
        <circle cx="26" cy="26" r={R} fill="none" stroke="var(--green)" strokeWidth="4"
          strokeDasharray={C} strokeDashoffset={C * (1 - pct)}
          strokeLinecap="round"
          transform="rotate(-90 26 26)" style={{ transition:'stroke-dashoffset 0.5s' }} />
        <text x="26" y="30" textAnchor="middle" fontSize="12" fontWeight="700" fill="var(--fg-0)">{Math.round(pct*100)}%</text>
      </svg>
      <div>
        <div style={{ fontSize: 12, fontWeight: 600 }}>{done} of {total}</div>
        <div style={{ fontSize: 11, color:'var(--fg-3)' }}>completed</div>
      </div>
    </div>
  );
};

Object.assign(window, { Checklist });
