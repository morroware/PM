// Dashboard — the hero view
const Dashboard = ({ tasks, onOpenTask, onNavigate }) => {
  const overdue = tasks.filter(t => t.status !== 'done' && new Date(t.due) < today);
  const dueToday = tasks.filter(t => t.due === daysFromNow(0) && t.status !== 'done');
  const inProgress = tasks.filter(t => t.status === 'in_progress');
  const completed = tasks.filter(t => t.status === 'done');
  const myTasks = tasks.filter(t => t.assignees.includes(ME) && t.status !== 'done');

  // Status distribution for chart
  const byStatus = STATUSES.map(s => ({ ...s, count: tasks.filter(t => t.status === s.id).length }));
  const total = tasks.length;
  const completionPct = Math.round((completed.length / total) * 100);

  // Workload per person
  const workload = TEAM.filter(u => u.id !== ME).map(u => {
    const open = tasks.filter(t => t.assignees.includes(u.id) && t.status !== 'done').length;
    return { user: u, open };
  }).sort((a,b) => b.open - a.open);
  const maxWork = Math.max(...workload.map(w => w.open), 1);

  // 14-day completion (fake synthetic)
  const velocityData = [2,3,1,4,3,5,2,4,6,3,5,7,4,6];

  return (
    <div style={{ padding: 24, display: 'grid', gap: 20, gridTemplateColumns: 'repeat(12, 1fr)' }}>
      {/* Greeting */}
      <div style={{ gridColumn: 'span 12', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 20 }}>
        <div>
          <div style={{ fontSize: 12, color: 'var(--fg-3)', letterSpacing: '0.06em', textTransform:'uppercase', fontWeight: 600, marginBottom: 6 }}>
            Tuesday · April 21, 2026
          </div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em' }}>Good morning, Ops.</h1>
          <p style={{ margin: '6px 0 0', color: 'var(--fg-2)', fontSize: 14 }}>
            {dueToday.length} due today, {overdue.length} overdue, {inProgress.length} in progress.
          </p>
        </div>
        <div className="hstack" style={{ gap: 8 }}>
          <button className="btn btn-ghost"><Icon name="calendar" size={14}/> This week</button>
          <button className="btn btn-primary"><Icon name="plus" size={14}/> New task</button>
        </div>
      </div>

      {/* Stat cards */}
      <StatCard label="Open tasks" value={total - completed.length} delta="+3 vs last week" trend="up" tone="blue" icon="checkSquare" />
      <StatCard label="Due today" value={dueToday.length} delta={overdue.length > 0 ? `${overdue.length} overdue` : 'on track'} trend={overdue.length > 0 ? 'down' : 'flat'} tone="amber" icon="clock" />
      <StatCard label="In progress" value={inProgress.length} delta="4 people active" trend="flat" tone="violet" icon="activity" />
      <StatCard label="Completion rate" value={`${completionPct}%`} delta="+5% this week" trend="up" tone="green" icon="trendUp" />

      {/* Focus / my tasks */}
      <Card style={{ gridColumn: 'span 7' }}>
        <CardHeader title="Your focus today" subtitle={`${myTasks.length} tasks assigned to you`} action={<button className="btn-muted btn" style={{padding:'4px 8px', fontSize:12}} onClick={()=>onNavigate('checklist')}>Open checklist <Icon name="chevronRight" size={12}/></button>} />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {myTasks.slice(0, 5).map(t => (
            <FocusRow key={t.id} task={t} onClick={() => onOpenTask(t.id)} />
          ))}
          {myTasks.length === 0 && <div className="empty">Nothing on your plate. Nice.</div>}
        </div>
      </Card>

      {/* Status breakdown */}
      <Card style={{ gridColumn: 'span 5' }}>
        <CardHeader title="Status breakdown" subtitle={`${total} total tasks`} />
        <div style={{ padding: '0 16px 18px' }}>
          {/* Stacked bar */}
          <div style={{ display:'flex', height: 10, borderRadius: 5, overflow:'hidden', background:'var(--bg-3)', marginBottom: 14 }}>
            {byStatus.map(s => (
              <div key={s.id} style={{ width: `${(s.count/total)*100}%`, background: s.color, transition:'width 0.3s' }} title={`${s.name}: ${s.count}`} />
            ))}
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            {byStatus.map(s => (
              <div key={s.id} style={{ display:'flex', alignItems:'center', gap: 10, fontSize: 13 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color }} />
                <span style={{ color: 'var(--fg-1)', flex: 1 }}>{s.name}</span>
                <span className="mono" style={{ color: 'var(--fg-2)', fontSize: 12 }}>{s.count}</span>
                <span className="mono" style={{ color: 'var(--fg-3)', fontSize: 11, width: 40, textAlign:'right' }}>{Math.round(s.count/total*100)}%</span>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Velocity */}
      <Card style={{ gridColumn: 'span 7' }}>
        <CardHeader title="Completion velocity" subtitle="Tasks closed per day · last 14 days" action={<span className="tag green"><Icon name="trendUp" size={10} /> +18%</span>} />
        <VelocityChart data={velocityData} />
      </Card>

      {/* Team workload */}
      <Card style={{ gridColumn: 'span 5' }}>
        <CardHeader title="Team workload" subtitle="Open tasks per teammate" />
        <div style={{ padding: '4px 16px 16px', display:'grid', gap: 10 }}>
          {workload.map(({ user, open }) => (
            <div key={user.id} style={{ display:'flex', alignItems:'center', gap: 10 }}>
              <Avatar user={user} size={26} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 500 }}>{user.name}</span>
                  <span className="mono" style={{ fontSize: 11, color: 'var(--fg-2)' }}>{open} open</span>
                </div>
                <div style={{ height: 6, background: 'var(--bg-3)', borderRadius: 3, overflow:'hidden' }}>
                  <div style={{ width: `${(open/maxWork)*100}%`, height:'100%', background: `linear-gradient(90deg, ${user.color}, ${user.color}aa)`, borderRadius: 3, transition:'width 0.5s' }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Projects grid */}
      <Card style={{ gridColumn: 'span 7' }}>
        <CardHeader title="Active projects" />
        <div style={{ padding: '0 16px 16px', display:'grid', gap: 8, gridTemplateColumns: 'repeat(2, 1fr)' }}>
          {PROJECTS.map(p => {
            const pTasks = tasks.filter(t => t.project === p.id);
            const pDone = pTasks.filter(t => t.status === 'done').length;
            const pct = Math.round((pDone/pTasks.length)*100);
            return (
              <div key={p.id} style={{ padding: 12, borderRadius: 10, background: 'var(--bg-3)', border: '1px solid var(--line)', cursor:'pointer' }}>
                <div style={{ display:'flex', alignItems:'center', gap: 10, marginBottom: 8 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: p.color }} />
                  <span style={{ fontWeight: 600, fontSize: 13, flex: 1 }}>{p.name}</span>
                  <span className="mono" style={{ fontSize: 11, color:'var(--fg-3)' }}>{pDone}/{pTasks.length}</span>
                </div>
                <div style={{ height: 4, background: 'var(--bg-4)', borderRadius: 2, overflow:'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: p.color, borderRadius: 2, transition:'width 0.5s' }} />
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', marginTop: 10, alignItems:'center' }}>
                  <AvatarStack userIds={[...new Set(pTasks.flatMap(t => t.assignees))].slice(0,4)} size={20} />
                  <span style={{ fontSize: 11, color: 'var(--fg-3)' }}>{pct}% complete</span>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Activity */}
      <Card style={{ gridColumn: 'span 5' }}>
        <CardHeader title="Recent activity" />
        <div style={{ padding: '0 16px 16px', display:'grid', gap: 10 }}>
          {ACTIVITY.map(a => {
            const u = teamById(a.who);
            return (
              <div key={a.id} style={{ display:'flex', gap: 10, alignItems:'flex-start' }}>
                <Avatar user={u} size={24} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, color:'var(--fg-1)', lineHeight: 1.35 }}>
                    <span style={{ fontWeight: 600 }}>{u.name}</span> <span style={{ color:'var(--fg-3)' }}>{a.action}</span> <span className="mono" style={{ color:'var(--acc-1)', fontSize: 11.5 }}>{a.task}</span>
                  </div>
                  <div style={{ fontSize: 11.5, color:'var(--fg-3)', marginTop: 2 }}>{a.detail}</div>
                </div>
                <span style={{ fontSize: 11, color:'var(--fg-4)', whiteSpace:'nowrap' }}>{a.at}</span>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
};

const Card = ({ children, style }) => (
  <div style={{
    background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 12,
    overflow: 'hidden', ...style
  }}>{children}</div>
);

const CardHeader = ({ title, subtitle, action }) => (
  <div style={{ padding: '14px 16px 10px', display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
    <div>
      <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em' }}>{title}</div>
      {subtitle && <div style={{ fontSize: 12, color:'var(--fg-3)', marginTop: 2 }}>{subtitle}</div>}
    </div>
    {action}
  </div>
);

const StatCard = ({ label, value, delta, trend, tone, icon }) => {
  const toneMap = {
    blue: { bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.2)', fg: '#60A5FA' },
    amber:{ bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)', fg: '#FCD34D' },
    violet:{bg: 'rgba(168,85,247,0.08)', border: 'rgba(168,85,247,0.2)', fg: '#D8B4FE' },
    green:{ bg: 'rgba(34,197,94,0.08)',  border: 'rgba(34,197,94,0.2)',  fg: '#86EFAC' },
  }[tone];
  return (
    <div style={{
      gridColumn: 'span 3', background: 'var(--bg-2)', border: '1px solid var(--line)',
      borderRadius: 12, padding: 16, position:'relative', overflow:'hidden'
    }}>
      <div style={{
        position:'absolute', top: 12, right: 12,
        width: 32, height: 32, borderRadius: 8,
        background: toneMap.bg, border:`1px solid ${toneMap.border}`, color: toneMap.fg,
        display:'grid', placeItems:'center'
      }}>
        <Icon name={icon} size={16} />
      </div>
      <div style={{ fontSize: 12, color:'var(--fg-3)', fontWeight: 600, letterSpacing:'0.02em' }}>{label}</div>
      <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-0.02em', marginTop: 4, fontFamily: 'var(--font-sans)' }}>{value}</div>
      <div style={{ fontSize: 11.5, color: trend === 'up' ? '#86EFAC' : trend === 'down' ? '#FCA5A5' : 'var(--fg-3)', marginTop: 6, display:'flex', alignItems:'center', gap: 4 }}>
        {trend === 'up' && <Icon name="trendUp" size={11} />}
        {trend === 'down' && <Icon name="trendDown" size={11} />}
        {delta}
      </div>
    </div>
  );
};

const FocusRow = ({ task, onClick }) => {
  const proj = projectById(task.project);
  const sub = task.subtasks || [];
  const subDone = sub.filter(s => s.done).length;
  return (
    <div onClick={onClick} style={{
      display:'flex', alignItems:'center', gap: 12, padding: '12px 16px',
      borderTop: '1px solid var(--line)', cursor:'pointer', transition:'background 0.1s',
    }}
    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-3)'}
    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
      <PriorityFlag p={task.priority} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display:'flex', alignItems:'center', gap: 8 }}>
          <span className="mono" style={{ fontSize: 10.5, color: 'var(--fg-3)' }}>{task.id}</span>
          <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--fg-4)' }} />
          <span style={{ fontSize: 11, color: proj.color }}>{proj.name}</span>
        </div>
        <div style={{ fontSize: 13.5, fontWeight: 500, marginTop: 2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{task.title}</div>
      </div>
      {sub.length > 0 && (
        <span className="mono" style={{ fontSize: 11, color:'var(--fg-3)' }}>{subDone}/{sub.length}</span>
      )}
      <div className="hstack" style={{ gap: 8 }}>
        {task.labels.slice(0, 2).map(l => <Tag key={l} labelId={l} small />)}
      </div>
      <DueDate due={task.due} small />
    </div>
  );
};

const VelocityChart = ({ data }) => {
  const max = Math.max(...data);
  const W = 100, H = 44;
  const step = W / (data.length - 1);
  const points = data.map((d, i) => [i * step, H - (d/max)*H]);
  const pathLine = points.map((p, i) => `${i===0?'M':'L'}${p[0]},${p[1]}`).join(' ');
  const pathFill = `${pathLine} L${W},${H} L0,${H} Z`;

  return (
    <div style={{ padding: '0 16px 16px' }}>
      <svg viewBox={`0 0 ${W} ${H+10}`} width="100%" style={{ display:'block', height: 120 }} preserveAspectRatio="none">
        <defs>
          <linearGradient id="velGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.35"/>
            <stop offset="100%" stopColor="#3B82F6" stopOpacity="0"/>
          </linearGradient>
        </defs>
        <path d={pathFill} fill="url(#velGrad)" />
        <path d={pathLine} fill="none" stroke="#3B82F6" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
        {points.map((p, i) => (
          <circle key={i} cx={p[0]} cy={p[1]} r="1.4" fill="#3B82F6" vectorEffect="non-scaling-stroke" />
        ))}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 10.5, color: 'var(--fg-4)' }} className="mono">
        <span>Apr 8</span><span>Apr 14</span><span>Apr 21</span>
      </div>
    </div>
  );
};

Object.assign(window, { Dashboard });
