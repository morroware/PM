// Shared UI atoms - avatar, tag, popover, etc.

const Avatar = ({ user, size = 22, ring = false }) => {
  if (!user) return null;
  return (
    <div className="avatar" title={user.name}
      style={{
        width: size, height: size, fontSize: Math.max(9, size * 0.38),
        background: user.color,
        boxShadow: ring ? '0 0 0 2px var(--bg-1)' : undefined,
      }}>
      {user.initials}
    </div>
  );
};

const AvatarStack = ({ userIds = [], max = 3, size = 22 }) => {
  const shown = userIds.slice(0, max);
  const extra = userIds.length - shown.length;
  return (
    <div className="av-stack">
      {shown.map(id => {
        const u = teamById(id); if (!u) return null;
        return (
          <div key={id} className="avatar" title={u.name}
            style={{
              width: size, height: size, fontSize: Math.max(9, size * 0.38),
              background: u.color,
            }}>{u.initials}</div>
        );
      })}
      {extra > 0 && <div className="av-more" style={{ width: size, height: size, fontSize: Math.max(9, size*0.38) }}>+{extra}</div>}
    </div>
  );
};

const Tag = ({ labelId, small = false }) => {
  const l = labelById(labelId);
  if (!l) return null;
  return <span className={`tag ${l.color}`} style={small ? { fontSize: 10.5, padding: '1px 6px' } : {}}>{l.name}</span>;
};

const PriorityFlag = ({ p, showLabel = false }) => {
  const labels = ['Urgent','High','Medium','Low'];
  return (
    <span className={`prio p${p}`} title={labels[p]}>
      <Icon name="flag" size={12} />
      {showLabel && <span>{labels[p]}</span>}
    </span>
  );
};

const StatusPill = ({ statusId }) => {
  const s = statusById(statusId);
  if (!s) return null;
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', gap:6,
      padding:'2px 8px', borderRadius: 5, fontSize: 11.5, fontWeight: 500,
      background: `${s.color}22`, color: s.color, border: `1px solid ${s.color}33`,
    }}>
      <span style={{width:6, height:6, borderRadius:'50%', background:s.color}} />
      {s.name}
    </span>
  );
};

const DueDate = ({ due, small = false }) => {
  if (!due) return null;
  const d = new Date(due);
  const diff = Math.round((d - today) / 86400000);
  let label, color = 'var(--fg-2)';
  if (diff < 0) { label = `${Math.abs(diff)}d overdue`; color = '#FCA5A5'; }
  else if (diff === 0) { label = 'Today'; color = '#FCD34D'; }
  else if (diff === 1) { label = 'Tomorrow'; color = 'var(--fg-1)'; }
  else if (diff < 7) { label = d.toLocaleDateString('en', { weekday: 'short' }); }
  else { label = d.toLocaleDateString('en', { month: 'short', day: 'numeric' }); }
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap: 4, fontSize: small ? 11 : 12, color }}>
      <Icon name="clock" size={small ? 11 : 12} />
      {label}
    </span>
  );
};

// Popover wrapper that closes on outside click
const Popover = ({ open, onClose, anchor, children, offset = 6, align = 'start' }) => {
  const popRef = React.useRef();
  const [pos, setPos] = React.useState({ top: 0, left: 0 });
  React.useLayoutEffect(() => {
    if (!open || !anchor?.current) return;
    const r = anchor.current.getBoundingClientRect();
    let left = r.left;
    if (align === 'end') left = r.right;
    setPos({ top: r.bottom + offset, left });
    const onDown = (e) => { if (popRef.current && !popRef.current.contains(e.target) && !anchor.current.contains(e.target)) onClose(); };
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    setTimeout(() => document.addEventListener('mousedown', onDown), 0);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open, anchor, align, offset, onClose]);
  if (!open) return null;
  const style = { top: pos.top, left: align === 'end' ? undefined : pos.left, right: align === 'end' ? window.innerWidth - pos.left : undefined };
  return ReactDOM.createPortal(
    <div ref={popRef} className="popover" style={style}>{children}</div>,
    document.body
  );
};

const AssigneePicker = ({ anchor, open, onClose, selected = [], onToggle }) => {
  const [query, setQuery] = React.useState('');
  const filtered = TEAM.filter(u => u.name.toLowerCase().includes(query.toLowerCase()));
  return (
    <Popover open={open} onClose={onClose} anchor={anchor}>
      <div className="pop-search"><input autoFocus placeholder="Assign to..." value={query} onChange={e => setQuery(e.target.value)} /></div>
      <div className="popover-header">Teammates</div>
      {filtered.map(u => (
        <div key={u.id} className={`pop-item ${selected.includes(u.id) ? 'selected' : ''}`}
          onClick={() => onToggle(u.id)}>
          <Avatar user={u} size={22} />
          <div>
            <div style={{fontWeight:500}}>{u.name}</div>
            <div style={{fontSize:11, color:'var(--fg-3)'}}>{u.role}</div>
          </div>
          <Icon name="check" size={14} className="check" />
        </div>
      ))}
    </Popover>
  );
};

const LabelPicker = ({ anchor, open, onClose, selected = [], onToggle }) => {
  const [query, setQuery] = React.useState('');
  const filtered = LABELS.filter(l => l.name.toLowerCase().includes(query.toLowerCase()));
  return (
    <Popover open={open} onClose={onClose} anchor={anchor}>
      <div className="pop-search"><input autoFocus placeholder="Find labels..." value={query} onChange={e=>setQuery(e.target.value)} /></div>
      <div className="popover-header">Labels</div>
      {filtered.map(l => (
        <div key={l.id} className={`pop-item ${selected.includes(l.id) ? 'selected' : ''}`}
          onClick={() => onToggle(l.id)}>
          <span className={`tag ${l.color}`}>{l.name}</span>
          <Icon name="check" size={14} className="check" style={{marginLeft:'auto'}} />
        </div>
      ))}
    </Popover>
  );
};

const StatusPicker = ({ anchor, open, onClose, value, onChange }) => (
  <Popover open={open} onClose={onClose} anchor={anchor}>
    <div className="popover-header">Change status</div>
    {STATUSES.map(s => (
      <div key={s.id} className={`pop-item ${value===s.id ? 'selected' : ''}`} onClick={() => { onChange(s.id); onClose(); }}>
        <span style={{width:8, height:8, borderRadius:'50%', background: s.color}} />
        <span>{s.name}</span>
        <Icon name="check" size={14} className="check" />
      </div>
    ))}
  </Popover>
);

const PriorityPicker = ({ anchor, open, onClose, value, onChange }) => {
  const opts = [{p:0,name:'Urgent'},{p:1,name:'High'},{p:2,name:'Medium'},{p:3,name:'Low'}];
  return (
    <Popover open={open} onClose={onClose} anchor={anchor}>
      <div className="popover-header">Priority</div>
      {opts.map(o => (
        <div key={o.p} className={`pop-item ${value===o.p?'selected':''}`} onClick={() => { onChange(o.p); onClose(); }}>
          <PriorityFlag p={o.p} />
          <span>{o.name}</span>
          <Icon name="check" size={14} className="check" />
        </div>
      ))}
    </Popover>
  );
};

Object.assign(window, { Avatar, AvatarStack, Tag, PriorityFlag, StatusPill, DueDate, Popover, AssigneePicker, LabelPicker, StatusPicker, PriorityPicker });
