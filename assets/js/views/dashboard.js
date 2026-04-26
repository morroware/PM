// Dashboard view.
function renderDashboard(tasks, { onOpenTask, onNavigate, activity }) {
  const t = today();
  const overdue    = tasks.filter(x => x.status !== 'done' && x.due && parseISO(x.due) < t);
  const dueToday   = tasks.filter(x => x.due === daysFromNow(0) && x.status !== 'done');
  const inProgress = tasks.filter(x => x.status === 'in_progress');
  const completed  = tasks.filter(x => x.status === 'done');
  const me = window.state.me;
  const myTasks = tasks.filter(x => x.assignees.includes(me.id) && x.status !== 'done');

  const byStatus = STATUSES.map(s => ({ ...s, count: tasks.filter(x => x.status === s.id).length }));
  const total = tasks.length;
  const completionPct = total ? Math.round((completed.length / total) * 100) : 0;

  const workload = window.state.users
    .filter(u => u.id !== me.id)
    .map(u => ({ user: u, open: tasks.filter(x => x.assignees.includes(u.id) && x.status !== 'done').length }))
    .sort((a, b) => b.open - a.open);
  const maxWork = Math.max(...workload.map(w => w.open), 1);

  const projects = window.state.projects;

  const root = h('div', { style: { padding: '24px', display: 'grid', gap: '20px', gridTemplateColumns: 'repeat(12, 1fr)' } });

  // Greeting
  root.appendChild(h('div', { style: { gridColumn: 'span 12', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '20px' } },
    h('div', null,
      h('div', { style: { fontSize: '12px', color: 'var(--fg-3)', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: '600', marginBottom: '6px' } },
        t.toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })),
      h('h1', { style: { margin: 0, fontSize: '26px', fontWeight: '700', letterSpacing: '-0.02em' } }, `Good day, ${me.name.split(' ')[0]}.`),
      h('p', { style: { margin: '6px 0 0', color: 'var(--fg-2)', fontSize: '14px' } },
        `${dueToday.length} due today, ${overdue.length} overdue, ${inProgress.length} in progress.`),
    ),
    h('div', { class: 'hstack', style: { gap: '8px' } },
      h('button', { class: 'btn btn-ghost', onClick: () => onNavigate('calendar') }, Icon('calendar', 14), ' This week'),
    ),
  ));

  // Stat cards
  root.appendChild(StatCard('Open tasks',      total - completed.length,     inProgress.length + ' in progress', 'up',   'blue',   'checkSquare'));
  root.appendChild(StatCard('Due today',       dueToday.length,              overdue.length > 0 ? `${overdue.length} overdue` : 'on track', overdue.length ? 'down' : 'flat', 'amber', 'clock'));
  root.appendChild(StatCard('In progress',     inProgress.length,            `${new Set(inProgress.flatMap(x => x.assignees)).size} people active`, 'flat', 'violet', 'activity'));
  root.appendChild(StatCard('Completion rate', `${completionPct}%`,          `${completed.length} done`, 'up', 'green', 'trendUp'));

  // Focus / my tasks
  const focusCard = Card({ gridColumn: 'span 7' });
  focusCard.appendChild(CardHeader('Your focus', `${myTasks.length} open tasks assigned to you`,
    h('button', { class: 'btn btn-muted', style: { padding: '4px 8px', fontSize: '12px' },
      onClick: () => onNavigate('checklist') }, 'Open checklist ', Icon('chevronRight', 12))));
  const focusList = h('div', { style: { display: 'flex', flexDirection: 'column' } });
  for (const x of myTasks.slice(0, 5)) focusList.appendChild(FocusRow(x, () => onOpenTask(x.id)));
  if (myTasks.length === 0) focusList.appendChild(h('div', { class: 'empty' }, 'Nothing on your plate. Nice.'));
  focusCard.appendChild(focusList);
  root.appendChild(focusCard);

  // Status breakdown
  const sbCard = Card({ gridColumn: 'span 5' });
  sbCard.appendChild(CardHeader('Status breakdown', `${total} total tasks`));
  const sbBody = h('div', { style: { padding: '0 16px 18px' } });
  const bar = h('div', { style: { display: 'flex', height: '10px', borderRadius: '5px', overflow: 'hidden', background: 'var(--bg-3)', marginBottom: '14px' } });
  for (const s of byStatus) {
    bar.appendChild(h('div', {
      title: `${s.name}: ${s.count}`,
      style: { width: (total ? (s.count / total) * 100 : 0) + '%', background: s.color, transition: 'width 0.3s' }
    }));
  }
  sbBody.appendChild(bar);
  const sbList = h('div', { style: { display: 'grid', gap: '8px' } });
  for (const s of byStatus) {
    sbList.appendChild(h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px' } },
      h('span', { style: { width: '8px', height: '8px', borderRadius: '50%', background: s.color } }),
      h('span', { style: { color: 'var(--fg-1)', flex: 1 } }, s.name),
      h('span', { class: 'mono', style: { color: 'var(--fg-2)', fontSize: '12px' } }, String(s.count)),
      h('span', { class: 'mono', style: { color: 'var(--fg-3)', fontSize: '11px', width: '40px', textAlign: 'right' } },
        `${total ? Math.round(s.count / total * 100) : 0}%`),
    ));
  }
  sbBody.appendChild(sbList);
  sbCard.appendChild(sbBody);
  root.appendChild(sbCard);

  // Team workload
  const wlCard = Card({ gridColumn: 'span 5' });
  wlCard.appendChild(CardHeader('Team workload', 'Open tasks per teammate'));
  const wlBody = h('div', { style: { padding: '4px 16px 16px', display: 'grid', gap: '10px' } });
  if (!workload.length) {
    wlBody.appendChild(h('div', { class: 'empty', style: { padding: '16px' } }, 'No teammates to show yet.'));
  }
  for (const w of workload) {
    wlBody.appendChild(h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px' } },
      Avatar(w.user, 26),
      h('div', { style: { flex: 1, minWidth: 0 } },
        h('div', { style: { display: 'flex', justifyContent: 'space-between', marginBottom: '4px' } },
          h('span', { style: { fontSize: '12.5px', fontWeight: '500' } }, w.user.name),
          h('span', { class: 'mono', style: { fontSize: '11px', color: 'var(--fg-2)' } }, `${w.open} open`)),
        h('div', { style: { height: '6px', background: 'var(--bg-3)', borderRadius: '3px', overflow: 'hidden' } },
          h('div', { style: {
            width: (w.open / maxWork) * 100 + '%', height: '100%',
            background: `linear-gradient(90deg, ${w.user.color}, ${w.user.color}aa)`,
            borderRadius: '3px', transition: 'width 0.5s'
          } })),
      ),
    ));
  }
  wlCard.appendChild(wlBody);
  root.appendChild(wlCard);

  // Projects grid
  const pCard = Card({ gridColumn: 'span 7' });
  pCard.appendChild(CardHeader('Active projects'));
  const pBody = h('div', { style: { padding: '0 16px 16px', display: 'grid', gap: '8px', gridTemplateColumns: 'repeat(2, 1fr)' } });
  if (!projects.length) {
    pBody.appendChild(h('div', { class: 'empty', style: { gridColumn: '1 / -1', padding: '16px' } }, 'Create your first project in Admin settings.'));
  }
  for (const p of projects) {
    const pTasks = tasks.filter(x => x.project == p.id);
    const pDone = pTasks.filter(x => x.status === 'done').length;
    const pct = pTasks.length ? Math.round((pDone / pTasks.length) * 100) : 0;
    const tile = h('div', {
      style: { padding: '12px', borderRadius: '10px', background: 'var(--bg-3)', border: '1px solid var(--line)', cursor: 'pointer' },
      onClick: () => onNavigate('kanban', p.id),
    });
    tile.appendChild(h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' } },
      h('span', { style: { width: '10px', height: '10px', borderRadius: '3px', background: p.color } }),
      h('span', { style: { fontWeight: '600', fontSize: '13px', flex: 1 } }, p.name),
      h('span', { class: 'mono', style: { fontSize: '11px', color: 'var(--fg-3)' } }, `${pDone}/${pTasks.length}`),
    ));
    tile.appendChild(h('div', { style: { height: '4px', background: 'var(--bg-4)', borderRadius: '2px', overflow: 'hidden' } },
      h('div', { style: { width: pct + '%', height: '100%', background: p.color, borderRadius: '2px', transition: 'width 0.5s' } })));
    const allAssignees = [...new Set(pTasks.flatMap(x => x.assignees))].slice(0, 4);
    tile.appendChild(h('div', { style: { display: 'flex', justifyContent: 'space-between', marginTop: '10px', alignItems: 'center' } },
      AvatarStack(allAssignees, 4, 20),
      h('span', { style: { fontSize: '11px', color: 'var(--fg-3)' } }, `${pct}% complete`),
    ));
    pBody.appendChild(tile);
  }
  pCard.appendChild(pBody);
  root.appendChild(pCard);

  // Activity
  const aCard = Card({ gridColumn: 'span 5' });
  aCard.appendChild(CardHeader('Recent activity'));
  const aBody = h('div', { style: { padding: '0 16px 16px', display: 'grid', gap: '10px' } });
  const items = (activity || []).slice(0, 8);
  if (items.length === 0) {
    aBody.appendChild(h('div', { class: 'empty', style: { padding: '16px' } }, 'No activity yet.'));
  } else for (const a of items) {
    aBody.appendChild(h('div', { style: { display: 'flex', gap: '10px', alignItems: 'flex-start' } },
      Avatar(a.user, 24),
      h('div', { style: { flex: 1, minWidth: 0 } },
        h('div', { style: { fontSize: '12.5px', color: 'var(--fg-1)', lineHeight: '1.35' } },
          h('span', { style: { fontWeight: '600' } }, a.user.name),
          ' ',
          h('span', { style: { color: 'var(--fg-3)' } }, a.action),
          ' ',
          a.task ? h('span', { class: 'mono', style: { color: 'var(--acc-1)', fontSize: '11.5px' } }, a.task.ref) : null,
        ),
        a.detail ? h('div', { style: { fontSize: '11.5px', color: 'var(--fg-3)', marginTop: '2px' } }, a.detail) : null,
      ),
      h('span', { style: { fontSize: '11px', color: 'var(--fg-4)', whiteSpace: 'nowrap' } }, relTime(a.created_at)),
    ));
  }
  aCard.appendChild(aBody);
  root.appendChild(aCard);

  return root;
}

function Card(extraStyle = {}) {
  return h('div', { class: 'card', style: extraStyle });
}
function CardHeader(title, subtitle, action) {
  const wrap = h('div', { class: 'card-head' });
  const left = h('div', null, h('h3', null, title));
  if (subtitle) left.appendChild(h('div', { class: 'sub' }, subtitle));
  wrap.appendChild(left);
  if (action) wrap.appendChild(action);
  return wrap;
}

function StatCard(label, value, delta, trend, tone, icon) {
  const tones = {
    blue:   { bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.2)', fg: '#60A5FA' },
    amber:  { bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)', fg: '#FCD34D' },
    violet: { bg: 'rgba(168,85,247,0.08)', border: 'rgba(168,85,247,0.2)', fg: '#D8B4FE' },
    green:  { bg: 'rgba(34,197,94,0.08)',  border: 'rgba(34,197,94,0.2)',  fg: '#86EFAC' },
  }[tone];
  return h('div', {
    style: {
      gridColumn: 'span 3', background: 'var(--bg-2)', border: '1px solid var(--line)',
      borderRadius: '12px', padding: '16px', position: 'relative', overflow: 'hidden'
    }
  },
    h('div', {
      style: {
        position: 'absolute', top: '12px', right: '12px',
        width: '32px', height: '32px', borderRadius: '8px',
        background: tones.bg, border: `1px solid ${tones.border}`, color: tones.fg,
        display: 'grid', placeItems: 'center'
      }
    }, Icon(icon, 16)),
    h('div', { style: { fontSize: '12px', color: 'var(--fg-3)', fontWeight: '600', letterSpacing: '0.02em' } }, label),
    h('div', { style: { fontSize: '30px', fontWeight: '700', letterSpacing: '-0.02em', marginTop: '4px' } }, String(value)),
    h('div', {
      style: {
        fontSize: '11.5px',
        color: trend === 'up' ? '#86EFAC' : trend === 'down' ? '#FCA5A5' : 'var(--fg-3)',
        marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px'
      }
    },
      trend === 'up'   ? Icon('trendUp', 11)   : null,
      trend === 'down' ? Icon('trendDown', 11) : null,
      delta),
  );
}

function FocusRow(task, onClick) {
  const proj = projectById(task.project);
  const sub = task.subtasks || [];
  const subDone = sub.filter(s => s.done).length;
  const row = h('div', {
    onClick,
    style: {
      display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px',
      borderTop: '1px solid var(--line)', cursor: 'pointer', transition: 'background 0.1s',
    },
    onMouseenter: e => e.currentTarget.style.background = 'var(--bg-3)',
    onMouseleave: e => e.currentTarget.style.background = 'transparent',
  });
  row.appendChild(PriorityFlag(task.priority));
  const body = h('div', { style: { flex: 1, minWidth: 0 } });
  body.appendChild(h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
    h('span', { class: 'mono', style: { fontSize: '10.5px', color: 'var(--fg-3)' } }, task.ref),
    h('span', { style: { width: '4px', height: '4px', borderRadius: '50%', background: 'var(--fg-4)' } }),
    proj ? h('span', { style: { fontSize: '11px', color: proj.color } }, proj.name) : null,
  ));
  body.appendChild(h('div', {
    style: { fontSize: '13.5px', fontWeight: '500', marginTop: '2px',
      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
  }, task.title));
  row.appendChild(body);
  if (sub.length > 0) row.appendChild(h('span', { class: 'mono', style: { fontSize: '11px', color: 'var(--fg-3)' } }, `${subDone}/${sub.length}`));
  const labelRow = h('div', { class: 'hstack', style: { gap: '8px' } });
  task.labels.slice(0, 2).forEach(l => labelRow.appendChild(Tag(l, true)));
  row.appendChild(labelRow);
  if (task.due) row.appendChild(DueDate(task.due, true));
  return row;
}

function relTime(iso) {
  if (!iso) return '';
  const then = new Date(iso.replace(' ', 'T') + 'Z');
  const secs = Math.floor((Date.now() - then.getTime()) / 1000);
  if (secs < 60) return 'just now';
  if (secs < 3600) return Math.floor(secs / 60) + 'm ago';
  if (secs < 86400) return Math.floor(secs / 3600) + 'h ago';
  if (secs < 604800) return Math.floor(secs / 86400) + 'd ago';
  return then.toLocaleDateString();
}

window.renderDashboard = renderDashboard;
