// List / table view grouped by status/project/assignee.
function renderList(tasks, { onOpenTask, onAddTask, onToggleStatus, onBulkLabels, onBulkUpdate }) {
  const root = h('div', { style: { padding: '16px 20px' } });
  const state = { groupBy: 'status', sortBy: 'priority', collapsed: {}, selected: new Set() };

  function redraw() {
    root.replaceChildren();
    root.appendChild(h('div', { style: { display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' } },
      Segmented('Group by', state.groupBy, v => { state.groupBy = v; redraw(); },
        [['status','Status'],['project','Project'],['assignee','Assignee']]),
      Segmented('Sort', state.sortBy, v => { state.sortBy = v; redraw(); },
        [['priority','Priority'],['due','Due'],['title','Title']]),
      state.selected.size ? h('div', { class: 'hstack', style: {
        marginLeft: 'auto', gap: '6px', background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: '8px', padding: '3px 6px',
      } },
        h('span', { style: { fontSize: '12px', color: 'var(--fg-2)', marginRight: '4px' } }, `${state.selected.size} selected`),
        h('button', { class: 'btn btn-ghost', style: { padding: '4px 8px', fontSize: '12px' }, onClick: (e) => {
          openPopover(e.currentTarget, ({close}) => labelPickerContent([], lid => {
            onBulkLabels?.([...state.selected], [lid], 'add')
              .then(() => { close(); state.selected.clear(); redraw(); })
              .catch(err => toast(err.message || 'Bulk update failed', 'error'));
          }, close, { keepOpen: true }));
        } }, 'Add label'),
        h('button', { class: 'btn btn-ghost', style: { padding: '4px 8px', fontSize: '12px' }, onClick: (e) => {
          openPopover(e.currentTarget, ({close}) => labelPickerContent([], lid => {
            onBulkLabels?.([...state.selected], [lid], 'remove')
              .then(() => { close(); state.selected.clear(); redraw(); })
              .catch(err => toast(err.message || 'Bulk update failed', 'error'));
          }, close, { keepOpen: true }));
        } }, 'Remove label'),
        h('button', { class: 'btn btn-ghost', style: { padding: '4px 8px', fontSize: '12px' }, onClick: async () => {
          try {
            await onBulkUpdate?.([...state.selected], { status: 'done' }, 'Marked done');
            state.selected.clear(); redraw();
          } catch (err) { toast(err.message || 'Bulk update failed', 'error'); }
        } }, 'Mark done'),
        h('button', { class: 'btn btn-ghost', style: { padding: '4px 8px', fontSize: '12px' }, onClick: async () => {
          const raw = prompt('Set due date for selected tasks (YYYY-MM-DD). Leave blank to clear.');
          if (raw == null) return;
          try {
            await onBulkUpdate?.([...state.selected], { due: raw.trim() || null }, 'Updated due date');
            state.selected.clear(); redraw();
          } catch (err) { toast(err.message || 'Bulk update failed', 'error'); }
        } }, 'Set due'),
        h('button', { class: 'btn btn-ghost', style: { padding: '4px 8px', fontSize: '12px' }, onClick: () => { state.selected.clear(); redraw(); } }, 'Clear'),
      ) : null,
    ));

    let groups = [];
    if (state.groupBy === 'status') {
      groups = STATUSES.map(s => ({ key: s.id, title: s.name, color: s.color,
        tasks: tasks.filter(t => t.status === s.id) }));
    } else if (state.groupBy === 'project') {
      groups = window.state.projects.map(p => ({ key: 'p'+p.id, title: p.name, color: p.color,
        tasks: tasks.filter(t => t.project == p.id) }));
    } else {
      groups = window.state.users.map(u => ({ key: 'u'+u.id, title: u.name, color: u.color,
        tasks: tasks.filter(t => t.assignees.includes(u.id)) }));
    }
    groups.forEach(g => g.tasks.sort((a, b) => {
      if (state.sortBy === 'priority') return a.priority - b.priority;
      if (state.sortBy === 'due') return new Date(a.due || '9999') - new Date(b.due || '9999');
      if (state.sortBy === 'title') return a.title.localeCompare(b.title);
      return 0;
    }));
    groups = groups.filter(g => g.tasks.length);

    const tbl = h('div', { class: 'list-wrap' },
      h('div', { class: 'list-header' },
        h('div'), h('div', null, 'ID'), h('div', null, 'Task'),
        h('div', null, 'Labels'), h('div', null, 'Assignees'),
        h('div', null, 'Due'), h('div', null, 'Priority'),
        h('div', null, 'Progress'), h('div'),
      )
    );

    for (const g of groups) {
      const isCollapsed = !!state.collapsed[g.key];
      const head = h('div', { class: 'list-group-head',
        onClick: () => { state.collapsed[g.key] = !isCollapsed; redraw(); } },
        h('span', { style: { display:'inline-flex', color:'var(--fg-3)', transform: isCollapsed ? 'rotate(-90deg)' : 'none', transition: 'transform 0.15s' } },
          Icon('chevronDown', 12)),
        h('span', { style: { width: '8px', height: '8px', borderRadius: '50%', background: g.color } }),
        h('span', { style: { fontSize: '12.5px', fontWeight: '600' } }, g.title),
        h('span', { class: 'mono', style: { fontSize: '11px', color: 'var(--fg-3)', background: 'var(--bg-3)', padding: '1px 6px', borderRadius: '4px' } }, String(g.tasks.length)),
        h('button', { class: 'btn btn-muted', style: { marginLeft: 'auto', padding: '3px 8px', fontSize: '11.5px' },
          onClick: (e) => {
            e.stopPropagation();
            const statusId = state.groupBy === 'status' ? g.key : undefined;
            const projectId = state.groupBy === 'project' ? parseInt(String(g.key).slice(1), 10) : undefined;
            const assigneeId = state.groupBy === 'assignee' ? parseInt(String(g.key).slice(1), 10) : undefined;
            onAddTask(statusId, { projectId, assigneeId });
          } },
          Icon('plus', 11), ' Add'),
      );
      tbl.appendChild(head);
      if (!isCollapsed) for (const t of g.tasks) {
        tbl.appendChild(ListRow(t, onOpenTask, onToggleStatus, {
          selected: state.selected.has(t.id),
          onSelect: (on) => {
            if (on) state.selected.add(t.id);
            else state.selected.delete(t.id);
            redraw();
          },
        }));
      }
    }

    root.appendChild(tbl);
  }
  redraw();
  return root;
}

function Segmented(label, value, onChange, options) {
  const wrap = h('div', { class: 'segmented' },
    h('span', { class: 'segmented-label' }, label),
  );
  for (const [v, l] of options) {
    wrap.appendChild(h('button', {
      class: value === v ? 'active' : '',
      onClick: () => onChange(v),
    }, l));
  }
  return wrap;
}

function ListRow(task, onOpen, onToggleStatus, { selected = false, onSelect } = {}) {
  const proj = projectById(task.project);
  const sub = task.subtasks || [];
  const subDone = sub.filter(s => s.done).length;
  const pct = sub.length ? (subDone / sub.length) * 100 : (task.status === 'done' ? 100 : 0);
  const done = task.status === 'done';

  const row = h('div', { class: 'list-row' + (done ? ' done' : ''), onClick: () => onOpen(task.id) });
  const checkWrap = h('div', { class: 'hstack', style: { gap: '8px' }, onClick: (e) => e.stopPropagation() },
    h('input', {
      type: 'checkbox',
      checked: selected,
      onClick: e => e.stopPropagation(),
      onChange: e => onSelect?.(!!e.target.checked),
    }),
    h('div', { onClick: (e) => { e.stopPropagation(); onToggleStatus(task.id); } }, Checkbox(done)),
  );
  row.appendChild(checkWrap);
  row.appendChild(h('span', { class: 'mono', style: { fontSize: '11px', color: 'var(--fg-3)' } }, task.ref));

  const titleCell = h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 } });
  if (proj) titleCell.appendChild(h('span', {
    title: proj.name,
    style: { width: '6px', height: '6px', borderRadius: '2px', background: proj.color, flexShrink: 0 }
  }));
  titleCell.appendChild(h('span', {
    class: 'title',
    style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: '500' }
  }, task.title));
  row.appendChild(titleCell);

  const labelsCell = h('div', { class: 'hstack', style: { gap: '3px', flexWrap: 'wrap' } });
  task.labels.slice(0, 2).forEach(l => labelsCell.appendChild(Tag(l, true)));
  if (task.labels.length > 2) labelsCell.appendChild(h('span', { style: { fontSize: '10.5px', color: 'var(--fg-3)' } }, '+' + (task.labels.length - 2)));
  if (task.comments > 0) labelsCell.appendChild(h('span', {
    class: 'hstack', title: task.comments + ' comment' + (task.comments === 1 ? '' : 's'),
    style: { gap: '3px', fontSize: '10.5px', color: 'var(--fg-3)' }
  }, Icon('message', 11), String(task.comments)));
  row.appendChild(labelsCell);

  row.appendChild(AvatarStack(task.assignees, 3, 22));
  row.appendChild(DueDate(task.due));
  row.appendChild(PriorityFlag(task.priority, true));
  row.appendChild(h('div', { style: { display: 'flex', alignItems: 'center', gap: '6px' } },
    h('div', { style: { flex: 1, height: '4px', background: 'var(--bg-4)', borderRadius: '2px', overflow: 'hidden' } },
      h('div', { style: { width: pct + '%', height: '100%', background: pct === 100 ? 'var(--green)' : 'var(--acc-0)', transition: 'width 0.3s' } }))));

  row.appendChild(h('div', { style: { textAlign: 'right' } },
    h('button', {
      class: 'icon-btn sm',
      title: 'Open task',
      onClick: (e) => { e.stopPropagation(); onOpen(task.id); },
    }, Icon('more', 14))));

  return row;
}

window.renderList = renderList;
