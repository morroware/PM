// Kanban board with drag & drop
const Kanban = ({ tasks, onOpenTask, onMoveTask, onAddTask }) => {
  const [dragging, setDragging] = React.useState(null);
  const [dragOver, setDragOver] = React.useState(null);

  const columns = STATUSES.map(s => ({
    ...s,
    tasks: tasks.filter(t => t.status === s.id),
  }));

  const onDragStart = (e, taskId) => {
    setDragging(taskId);
    e.dataTransfer.effectAllowed = 'move';
    // Set a transparent drag image for custom drop vibe
    try { e.dataTransfer.setDragImage(e.currentTarget, e.currentTarget.clientWidth/2, 20); } catch {}
  };
  const onDragEnd = () => { setDragging(null); setDragOver(null); };
  const onDragEnter = (statusId) => (e) => { e.preventDefault(); setDragOver(statusId); };
  const onDragOver = (e) => { e.preventDefault(); };
  const onDrop = (statusId) => (e) => {
    e.preventDefault();
    if (dragging) onMoveTask(dragging, statusId);
    setDragging(null); setDragOver(null);
  };

  return (
    <div style={{ display: 'flex', gap: 14, padding: 20, alignItems: 'flex-start', minHeight:'100%', overflowX:'auto' }}>
      {columns.map(col => (
        <div key={col.id} style={{ width: 300, flexShrink: 0, display:'flex', flexDirection:'column', maxHeight: 'calc(100vh - 180px)' }}>
          {/* Column header */}
          <div style={{
            padding: '10px 12px', display: 'flex', alignItems:'center', gap: 8,
            background: dragOver === col.id ? 'var(--bg-3)' : 'var(--bg-2)',
            border: `1px solid ${dragOver === col.id ? 'var(--acc-border)' : 'var(--line)'}`,
            borderRadius: '10px 10px 0 0', borderBottom: 'none',
            transition: 'all 0.15s'
          }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: col.color }} />
            <span style={{ fontSize: 12.5, fontWeight: 600, letterSpacing:'-0.01em' }}>{col.name}</span>
            <span className="mono" style={{ fontSize: 11, color: 'var(--fg-3)', background:'var(--bg-3)', padding:'1px 6px', borderRadius: 4 }}>{col.tasks.length}</span>
            <div style={{ marginLeft: 'auto', display:'flex', gap: 2 }}>
              <button className="icon-btn" style={{ width: 22, height: 22 }} onClick={() => onAddTask(col.id)}><Icon name="plus" size={13}/></button>
              <button className="icon-btn" style={{ width: 22, height: 22 }}><Icon name="more" size={13}/></button>
            </div>
          </div>

          {/* Column body */}
          <div
            onDragEnter={onDragEnter(col.id)}
            onDragOver={onDragOver}
            onDrop={onDrop(col.id)}
            style={{
              flex: 1, overflowY: 'auto',
              padding: 8,
              background: dragOver === col.id ? 'rgba(59,130,246,0.04)' : 'var(--bg-1)',
              border: `1px solid ${dragOver === col.id ? 'var(--acc-border)' : 'var(--line)'}`,
              borderTop: 'none', borderRadius: '0 0 10px 10px',
              display: 'flex', flexDirection: 'column', gap: 8,
              transition: 'all 0.15s',
              minHeight: 100,
            }}>
            {col.tasks.map(t => (
              <KanbanCard
                key={t.id}
                task={t}
                dragging={dragging === t.id}
                onDragStart={(e) => onDragStart(e, t.id)}
                onDragEnd={onDragEnd}
                onClick={() => onOpenTask(t.id)}
              />
            ))}
            {col.tasks.length === 0 && (
              <div style={{ textAlign:'center', padding: 30, color:'var(--fg-4)', fontSize: 12 }}>Drop tasks here</div>
            )}
            <button onClick={() => onAddTask(col.id)} style={{
              display:'flex', alignItems:'center', gap: 6, color:'var(--fg-3)',
              padding: '8px 10px', fontSize: 12.5, borderRadius: 7, textAlign:'left',
            }} onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-3)'; e.currentTarget.style.color = 'var(--fg-0)'; }}
               onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--fg-3)'; }}>
              <Icon name="plus" size={12} /> Add task
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

const KanbanCard = ({ task, dragging, onDragStart, onDragEnd, onClick }) => {
  const proj = projectById(task.project);
  const sub = task.subtasks || [];
  const subDone = sub.filter(s => s.done).length;
  const subPct = sub.length ? (subDone/sub.length)*100 : 0;

  const overdue = task.status !== 'done' && new Date(task.due) < today;

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      style={{
        background: 'var(--bg-3)', border: '1px solid var(--line-2)', borderRadius: 8,
        padding: 10, cursor: 'pointer', position:'relative',
        opacity: dragging ? 0.4 : 1, transform: dragging ? 'scale(0.98)' : 'none',
        transition: 'border-color 0.15s, transform 0.15s, box-shadow 0.15s',
      }}
      onMouseEnter={e => { if (!dragging) { e.currentTarget.style.borderColor = 'var(--acc-border)'; e.currentTarget.style.boxShadow = 'var(--shadow-2)'; }}}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--line-2)'; e.currentTarget.style.boxShadow = 'none'; }}>

      {/* project strip */}
      <div style={{ position:'absolute', top: 0, left: 0, right: 0, height: 2, background: proj.color, borderRadius: '8px 8px 0 0' }} />

      <div style={{ display:'flex', alignItems:'center', gap: 6, marginBottom: 8 }}>
        <span className="mono" style={{ fontSize: 10.5, color:'var(--fg-3)' }}>{task.id}</span>
        <span style={{ width: 3, height: 3, borderRadius:'50%', background:'var(--fg-4)' }} />
        <span style={{ fontSize: 11, color: proj.color, fontWeight: 500 }}>{proj.name}</span>
        <div style={{ marginLeft:'auto' }}>
          <PriorityFlag p={task.priority} />
        </div>
      </div>

      <div style={{ fontSize: 13.5, lineHeight: 1.35, fontWeight: 500, color:'var(--fg-0)', marginBottom: 10 }}>
        {task.title}
      </div>

      {task.labels.length > 0 && (
        <div className="hstack" style={{ gap: 4, marginBottom: 10, flexWrap:'wrap' }}>
          {task.labels.map(l => <Tag key={l} labelId={l} small />)}
        </div>
      )}

      {sub.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 10.5, color:'var(--fg-3)' }}>
              <Icon name="checkSquare" size={10} style={{ marginRight: 4, verticalAlign:'-1px' }}/>
              Subtasks
            </span>
            <span className="mono" style={{ fontSize: 10.5, color: 'var(--fg-2)' }}>{subDone}/{sub.length}</span>
          </div>
          <div style={{ height: 3, background: 'var(--bg-4)', borderRadius: 2, overflow:'hidden' }}>
            <div style={{ width: `${subPct}%`, height:'100%', background: subPct===100?'var(--green)':'var(--acc-0)', transition:'width 0.3s' }}/>
          </div>
        </div>
      )}

      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div className="hstack" style={{ gap: 8, fontSize: 11, color:'var(--fg-3)' }}>
          <DueDate due={task.due} small />
          {task.comments && <span className="hstack" style={{gap:3}}><Icon name="message" size={11}/> {task.comments}</span>}
          {task.attachments && <span className="hstack" style={{gap:3}}><Icon name="paperclip" size={11}/> {task.attachments}</span>}
        </div>
        <AvatarStack userIds={task.assignees} size={20} />
      </div>
    </div>
  );
};

Object.assign(window, { Kanban });
