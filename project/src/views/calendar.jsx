// Calendar view (month grid)
const CalendarView = ({ tasks, onOpenTask }) => {
  // Use today's month (April 2026)
  const year = 2026, month = 3; // 0-indexed April
  const firstDay = new Date(year, month, 1);
  const startDow = firstDay.getDay(); // Sunday = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // show 6 weeks (42 cells)
  const cells = [];
  for (let i = 0; i < 42; i++) {
    const dayNum = i - startDow + 1;
    const d = new Date(year, month, dayNum);
    cells.push({ date: d, inMonth: dayNum >= 1 && dayNum <= daysInMonth });
  }

  const tasksByDate = React.useMemo(() => {
    const m = {};
    tasks.forEach(t => { (m[t.due] = m[t.due] || []).push(t); });
    return m;
  }, [tasks]);

  const monthName = firstDay.toLocaleDateString('en', { month: 'long', year: 'numeric' });
  const dow = ['SUN','MON','TUE','WED','THU','FRI','SAT'];

  return (
    <div style={{ padding: 20, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display:'flex', alignItems:'center', gap: 12, marginBottom: 14 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, letterSpacing:'-0.02em' }}>{monthName}</h2>
        <div className="hstack" style={{ gap: 2 }}>
          <button className="icon-btn"><Icon name="chevronLeft" size={14}/></button>
          <button className="btn btn-ghost" style={{ padding:'4px 10px', fontSize: 12 }}>Today</button>
          <button className="icon-btn"><Icon name="chevronRight" size={14}/></button>
        </div>
        <div style={{ marginLeft: 'auto' }} className="hstack">
          <div className="view-tabs">
            <button className="view-tab">Day</button>
            <button className="view-tab">Week</button>
            <button className="view-tab active">Month</button>
          </div>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns: 'repeat(7, 1fr)', border:'1px solid var(--line)', borderRadius: 12, overflow:'hidden', background: 'var(--bg-2)', flex: 1, minHeight: 0 }}>
        {dow.map(d => (
          <div key={d} style={{
            padding: '10px 12px', fontSize: 10.5, color:'var(--fg-3)', fontWeight: 600,
            letterSpacing:'0.06em', borderBottom:'1px solid var(--line)', background:'var(--bg-1)'
          }}>{d}</div>
        ))}
        {cells.map((c, i) => {
          const iso = c.date.toISOString().slice(0,10);
          const dayTasks = tasksByDate[iso] || [];
          const isToday = iso === daysFromNow(0);
          return (
            <div key={i} style={{
              minHeight: 110,
              padding: 6,
              borderRight: (i % 7 !== 6) ? '1px solid var(--line)' : 'none',
              borderBottom: i < 35 ? '1px solid var(--line)' : 'none',
              background: c.inMonth ? 'var(--bg-2)' : 'var(--bg-1)',
              opacity: c.inMonth ? 1 : 0.55,
              display: 'flex', flexDirection:'column', gap: 3, minWidth: 0,
            }}>
              <div style={{ display:'flex', alignItems:'center', gap: 6, marginBottom: 2 }}>
                <span style={{
                  fontSize: 11.5, fontWeight: 600,
                  width: 20, height: 20, borderRadius: 5,
                  display:'grid', placeItems:'center',
                  background: isToday ? 'var(--acc-0)' : 'transparent',
                  color: isToday ? 'white' : (c.inMonth ? 'var(--fg-1)' : 'var(--fg-4)'),
                }}>{c.date.getDate()}</span>
              </div>
              {dayTasks.slice(0, 3).map(t => {
                const proj = projectById(t.project);
                const done = t.status === 'done';
                return (
                  <div key={t.id} onClick={() => onOpenTask(t.id)}
                    style={{
                      fontSize: 11, padding: '3px 6px', borderRadius: 4,
                      background: `${proj.color}18`, color: proj.color,
                      borderLeft: `2px solid ${proj.color}`,
                      cursor:'pointer', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
                      textDecoration: done ? 'line-through' : 'none',
                      opacity: done ? 0.55 : 1,
                      fontWeight: 500,
                    }}
                    title={t.title}>
                    {t.title}
                  </div>
                );
              })}
              {dayTasks.length > 3 && (
                <div style={{ fontSize: 10.5, color: 'var(--fg-3)', padding: '1px 6px', cursor:'pointer' }}>
                  +{dayTasks.length - 3} more
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

Object.assign(window, { CalendarView });
