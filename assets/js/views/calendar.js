// Month calendar view.
function renderCalendar(tasks, { onOpenTask, onMoveTaskDate }) {
  const state = { cursor: (() => { const d = today(); d.setDate(1); return d; })() };
  const root = h('div', { style: { padding: '20px', height: '100%', display: 'flex', flexDirection: 'column' } });

  function redraw() {
    root.replaceChildren();
    const cur = state.cursor;
    const year = cur.getFullYear(), month = cur.getMonth();
    const firstDay = new Date(year, month, 1);
    const startDow = firstDay.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < 42; i++) {
      const dayNum = i - startDow + 1;
      const d = new Date(year, month, dayNum);
      cells.push({ date: d, inMonth: dayNum >= 1 && dayNum <= daysInMonth });
    }
    const tasksByDate = {};
    for (const t of tasks) { if (!t.due) continue; (tasksByDate[t.due] = tasksByDate[t.due] || []).push(t); }

    const todayISO = ymd(today());
    const monthName = firstDay.toLocaleDateString('en', { month: 'long', year: 'numeric' });
    const dow = ['SUN','MON','TUE','WED','THU','FRI','SAT'];

    root.appendChild(h('div', { style: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' } },
      h('h2', { style: { margin: 0, fontSize: '18px', fontWeight: '600', letterSpacing: '-0.02em' } }, monthName),
      h('div', { class: 'hstack', style: { gap: '2px' } },
        h('button', { class: 'icon-btn', onClick: () => { state.cursor = new Date(year, month - 1, 1); redraw(); } }, Icon('chevronLeft', 14)),
        h('button', { class: 'btn btn-ghost', style: { padding: '4px 10px', fontSize: '12px' },
          onClick: () => { const d = today(); d.setDate(1); state.cursor = d; redraw(); } }, 'Today'),
        h('button', { class: 'icon-btn', onClick: () => { state.cursor = new Date(year, month + 1, 1); redraw(); } }, Icon('chevronRight', 14)),
      ),
    ));

    const grid = h('div', { class: 'cal-grid' });
    for (const d of dow) grid.appendChild(h('div', { class: 'cal-dow' }, d));
    cells.forEach((c, i) => {
      const iso = ymd(c.date);
      const dayTasks = tasksByDate[iso] || [];
      const isToday = iso === todayISO;
      const cell = h('div', { class: 'cal-cell' + (c.inMonth ? '' : ' not-in-month') + (i >= 35 ? ' last-row' : '') });
      cell.addEventListener('dragover', e => e.preventDefault());
      cell.addEventListener('drop', async (e) => {
        e.preventDefault();
        const tid = Number(e.dataTransfer.getData('text/task-id') || 0);
        if (!tid) return;
        try {
          await onMoveTaskDate?.(tid, iso);
        } catch (err) {
          toast(err.message || 'Could not reschedule task', 'error');
        }
      });
      cell.appendChild(h('div', { style: { display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' } },
        h('span', { class: 'cal-daynum' + (isToday ? ' today' : '') }, String(c.date.getDate())),
      ));
      const renderEvent = (t) => {
        const proj = projectById(t.project);
        const done = t.status === 'done';
        return h('div', {
          class: 'cal-event' + (done ? ' done' : ''),
          draggable: true,
          title: t.title + (t.comments ? ` · ${t.comments} comment${t.comments === 1 ? '' : 's'}` : ''),
          style: proj ? {
            background: proj.color + '18', color: proj.color,
            borderLeft: '2px solid ' + proj.color
          } : {},
          onDragstart: (e) => { e.dataTransfer.setData('text/task-id', String(t.id)); e.dataTransfer.effectAllowed = 'move'; },
          onClick: (e) => { e.stopPropagation(); onOpenTask(t.id); },
        },
          h('span', { style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 } }, t.title),
          t.comments > 0 ? h('span', { style: { marginLeft: '4px', fontSize: '10px', opacity: '0.8' } },
            Icon('message', 10), ' ' + t.comments) : null,
        );
      };
      for (const t of dayTasks.slice(0, 3)) cell.appendChild(renderEvent(t));
      if (dayTasks.length > 3) {
        const more = h('button', {
          style: {
            fontSize: '10.5px', color: 'var(--fg-2)', padding: '1px 6px',
            cursor: 'pointer', textAlign: 'left', borderRadius: '4px',
            background: 'var(--bg-3)', border: '1px solid var(--line)',
          },
          onClick: (e) => {
            e.stopPropagation();
            openPopover(more, ({ close }) => {
              const list = h('div', { style: { padding: '4px', minWidth: '240px' } });
              list.appendChild(h('div', { class: 'popover-header' },
                c.date.toLocaleDateString('en', { weekday: 'long', month: 'short', day: 'numeric' })));
              for (const t of dayTasks) {
                const ev = renderEvent(t);
                ev.addEventListener('click', () => close());
                list.appendChild(ev);
              }
              return list;
            });
          },
        }, `+${dayTasks.length - 3} more`);
        cell.appendChild(more);
      }
      grid.appendChild(cell);
    });
    root.appendChild(grid);
  }

  redraw();
  return root;
}

window.renderCalendar = renderCalendar;
