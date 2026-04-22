// Task detail side panel
const TaskDetail = ({ task, onClose, onUpdate, onToggleSubtask, onAddSubtask }) => {
  const [editingTitle, setEditingTitle] = React.useState(false);
  const [tempTitle, setTempTitle] = React.useState(task?.title || '');
  const [newSubtask, setNewSubtask] = React.useState('');
  const [showAssignees, setShowAssignees] = React.useState(false);
  const [showLabels, setShowLabels] = React.useState(false);
  const [showStatus, setShowStatus] = React.useState(false);
  const [showPriority, setShowPriority] = React.useState(false);
  const assigneeBtn = React.useRef();
  const labelBtn = React.useRef();
  const statusBtn = React.useRef();
  const priorityBtn = React.useRef();

  React.useEffect(() => { setTempTitle(task?.title || ''); setEditingTitle(false); }, [task?.id]);

  if (!task) return null;
  const proj = projectById(task.project);
  const sub = task.subtasks || [];
  const subDone = sub.filter(s => s.done).length;
  const pct = sub.length ? (subDone/sub.length)*100 : 0;

  const saveTitle = () => { onUpdate(task.id, { title: tempTitle.trim() || task.title }); setEditingTitle(false); };

  return (
    <>
      <div onClick={onClose} style={{
        position:'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 50,
        animation: 'fadeIn 0.15s'
      }}/>
      <div style={{
        position:'fixed', top: 0, right: 0, bottom: 0, width: 520,
        background: 'var(--bg-2)', borderLeft: '1px solid var(--line)',
        zIndex: 51, display:'flex', flexDirection:'column',
        animation: 'slideInRight 0.2s ease-out', boxShadow: 'var(--shadow-pop)'
      }}>
        {/* Header */}
        <div style={{ padding: '14px 18px', display:'flex', alignItems:'center', gap: 10, borderBottom: '1px solid var(--line)' }}>
          <span className="mono" style={{ fontSize: 11.5, color: 'var(--fg-3)' }}>{task.id}</span>
          <span style={{ display:'flex', alignItems:'center', gap: 5, fontSize: 11.5, color: proj.color }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: proj.color }} />
            {proj.name}
          </span>
          <div style={{ marginLeft:'auto' }} className="hstack">
            <button className="icon-btn" title="Copy link"><Icon name="link" size={14}/></button>
            <button className="icon-btn" title="Watch"><Icon name="eye" size={14}/></button>
            <button className="icon-btn"><Icon name="more" size={14}/></button>
            <button className="icon-btn" onClick={onClose}><Icon name="x" size={14}/></button>
          </div>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px 30px' }}>
          {/* Title */}
          {editingTitle ? (
            <textarea
              autoFocus value={tempTitle}
              onChange={e => setTempTitle(e.target.value)}
              onBlur={saveTitle}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveTitle(); } if (e.key === 'Escape') { setTempTitle(task.title); setEditingTitle(false); } }}
              style={{
                width:'100%', fontSize: 20, fontWeight: 600, letterSpacing:'-0.01em',
                background: 'var(--bg-3)', border: '1px solid var(--acc-border)', borderRadius: 8,
                padding: 10, color: 'var(--fg-0)', outline:'none', resize:'none', minHeight: 60,
              }}/>
          ) : (
            <h2 onClick={() => setEditingTitle(true)} style={{
              margin: 0, fontSize: 20, fontWeight: 600, letterSpacing: '-0.01em', cursor: 'text',
              padding: 8, marginLeft: -8, borderRadius: 6,
            }}
            onMouseEnter={e => e.currentTarget.style.background='var(--bg-3)'}
            onMouseLeave={e => e.currentTarget.style.background='transparent'}
            >{task.title}</h2>
          )}

          {/* Properties grid */}
          <div style={{ marginTop: 18, display:'grid', gridTemplateColumns: '110px 1fr', rowGap: 10, alignItems:'center' }}>
            <PropLabel icon="activity">Status</PropLabel>
            <div>
              <button ref={statusBtn} onClick={() => setShowStatus(v=>!v)} style={{ background:'transparent', padding: 4, borderRadius: 6 }}>
                <StatusPill statusId={task.status} />
              </button>
              <StatusPicker anchor={statusBtn} open={showStatus} onClose={() => setShowStatus(false)}
                value={task.status} onChange={v => onUpdate(task.id, { status: v })}/>
            </div>

            <PropLabel icon="flag">Priority</PropLabel>
            <div>
              <button ref={priorityBtn} onClick={() => setShowPriority(v=>!v)} className="chip">
                <PriorityFlag p={task.priority} showLabel />
              </button>
              <PriorityPicker anchor={priorityBtn} open={showPriority} onClose={() => setShowPriority(false)}
                value={task.priority} onChange={v => onUpdate(task.id, { priority: v })}/>
            </div>

            <PropLabel icon="users">Assignees</PropLabel>
            <div>
              <button ref={assigneeBtn} onClick={() => setShowAssignees(v=>!v)} className="chip" style={{ padding: '3px 8px' }}>
                <AvatarStack userIds={task.assignees} size={20} />
                <span style={{ marginLeft: 4 }}>{task.assignees.map(id => teamById(id)?.name.split(' ')[0]).join(', ')}</span>
              </button>
              <AssigneePicker anchor={assigneeBtn} open={showAssignees} onClose={() => setShowAssignees(false)}
                selected={task.assignees}
                onToggle={uid => {
                  const set = new Set(task.assignees);
                  set.has(uid) ? set.delete(uid) : set.add(uid);
                  onUpdate(task.id, { assignees: [...set] });
                }}/>
            </div>

            <PropLabel icon="clock">Due date</PropLabel>
            <div><span className="chip"><DueDate due={task.due} /></span></div>

            <PropLabel icon="tag">Labels</PropLabel>
            <div style={{ display:'flex', alignItems:'center', gap: 6, flexWrap:'wrap' }}>
              {task.labels.map(l => <Tag key={l} labelId={l} />)}
              <button ref={labelBtn} onClick={() => setShowLabels(v=>!v)} className="chip" style={{ fontSize: 11.5 }}>
                <Icon name="plus" size={11}/> Add label
              </button>
              <LabelPicker anchor={labelBtn} open={showLabels} onClose={() => setShowLabels(false)}
                selected={task.labels}
                onToggle={lid => {
                  const set = new Set(task.labels);
                  set.has(lid) ? set.delete(lid) : set.add(lid);
                  onUpdate(task.id, { labels: [...set] });
                }}/>
            </div>

            <PropLabel icon="zap">Estimate</PropLabel>
            <div><span className="chip mono">{task.estimate || '—'}</span></div>
          </div>

          {/* Description */}
          {task.description && (
            <div style={{ marginTop: 22 }}>
              <div style={{ fontSize: 11, color:'var(--fg-3)', letterSpacing:'0.06em', textTransform:'uppercase', fontWeight: 600, marginBottom: 8 }}>Description</div>
              <div style={{ background:'var(--bg-3)', border:'1px solid var(--line)', borderRadius: 8, padding: 12, fontSize: 13.5, color:'var(--fg-1)', lineHeight: 1.55 }}>
                {task.description}
              </div>
            </div>
          )}

          {/* Subtasks */}
          <div style={{ marginTop: 22 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: 10 }}>
              <div style={{ fontSize: 11, color:'var(--fg-3)', letterSpacing:'0.06em', textTransform:'uppercase', fontWeight: 600 }}>Subtasks</div>
              {sub.length > 0 && <span className="mono" style={{ fontSize: 11, color:'var(--fg-2)' }}>{subDone}/{sub.length}</span>}
            </div>
            {sub.length > 0 && (
              <div style={{ height: 4, background: 'var(--bg-4)', borderRadius: 2, overflow:'hidden', marginBottom: 10 }}>
                <div style={{ width: `${pct}%`, height:'100%', background: pct===100?'var(--green)':'var(--acc-0)', transition:'width 0.3s' }} />
              </div>
            )}
            <div style={{ background:'var(--bg-3)', border:'1px solid var(--line)', borderRadius: 8 }}>
              {sub.map((s, i) => (
                <div key={s.id} onClick={() => onToggleSubtask(task.id, s.id)}
                  style={{
                    display:'flex', alignItems:'center', gap: 10, padding: '9px 12px',
                    borderBottom: i === sub.length-1 ? 'none' : '1px solid var(--line)',
                    cursor:'pointer',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background='var(--bg-4)'}
                  onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                  <Checkbox checked={s.done} size={16} />
                  <span style={{
                    fontSize: 13, flex: 1,
                    color: s.done ? 'var(--fg-3)' : 'var(--fg-1)',
                    textDecoration: s.done ? 'line-through' : 'none',
                  }}>{s.text}</span>
                </div>
              ))}
              <div style={{ display:'flex', alignItems:'center', gap: 10, padding: '9px 12px', borderTop: sub.length ? '1px solid var(--line)' : 'none' }}>
                <div style={{ width: 16, height: 16, borderRadius: 4, border:'1.5px dashed var(--fg-4)' }}/>
                <input
                  value={newSubtask} onChange={e => setNewSubtask(e.target.value)}
                  placeholder="Add a subtask..."
                  onKeyDown={e => {
                    if (e.key === 'Enter' && newSubtask.trim()) {
                      onAddSubtask(task.id, newSubtask.trim());
                      setNewSubtask('');
                    }
                  }}
                  style={{ flex:1, background:'transparent', border:'none', outline:'none', fontSize: 13, color:'var(--fg-1)' }}/>
              </div>
            </div>
          </div>

          {/* Comments */}
          <div style={{ marginTop: 24 }}>
            <div style={{ fontSize: 11, color:'var(--fg-3)', letterSpacing:'0.06em', textTransform:'uppercase', fontWeight: 600, marginBottom: 10 }}>Activity · {task.comments || 0} comments</div>
            <div style={{ display:'flex', gap: 10 }}>
              <Avatar user={teamById(ME)} size={28} />
              <div style={{ flex: 1, background:'var(--bg-3)', border:'1px solid var(--line)', borderRadius: 8, padding: 10 }}>
                <input placeholder="Leave a comment..." style={{
                  width: '100%', background:'transparent', border: 'none', outline:'none',
                  fontSize: 13, color:'var(--fg-1)'
                }}/>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop: 8 }}>
                  <div className="hstack" style={{ gap: 4, color:'var(--fg-3)' }}>
                    <button className="icon-btn" style={{width:22,height:22}}><Icon name="paperclip" size={13}/></button>
                    <button className="icon-btn" style={{width:22,height:22}}><Icon name="link" size={13}/></button>
                  </div>
                  <button className="btn btn-primary" style={{ padding:'4px 10px', fontSize: 12 }}>Comment</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

const PropLabel = ({ icon, children }) => (
  <div style={{ display:'flex', alignItems:'center', gap: 8, color:'var(--fg-3)', fontSize: 12, fontWeight: 500 }}>
    <Icon name={icon} size={13} />
    {children}
  </div>
);

Object.assign(window, { TaskDetail });
