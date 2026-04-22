// Kanban board with drag & drop.
function renderKanban(tasks, { onOpenTask, onMoveTask, onAddTask }) {
  const root = h('div', { class: 'kb-board' });
  let draggingId = null;

  for (const s of STATUSES) {
    const colTasks = tasks.filter(t => t.status === s.id);

    const head = h('div', { class: 'kb-col-head' },
      h('span', { style: { width: '8px', height: '8px', borderRadius: '50%', background: s.color } }),
      h('span', { style: { fontSize: '12.5px', fontWeight: '600', letterSpacing: '-0.01em' } }, s.name),
      h('span', { class: 'mono', style: { fontSize: '11px', color: 'var(--fg-3)', background: 'var(--bg-3)', padding: '1px 6px', borderRadius: '4px' } }, String(colTasks.length)),
      h('div', { style: { marginLeft: 'auto', display: 'flex', gap: '2px' } },
        h('button', { class: 'icon-btn sm', onClick: () => onAddTask(s.id) }, Icon('plus', 13)),
        h('button', { class: 'icon-btn sm' }, Icon('more', 13)),
      ),
    );

    const body = h('div', { class: 'kb-col-body' });

    body.addEventListener('dragenter', e => { e.preventDefault(); body.classList.add('drag-over'); head.classList.add('drag-over'); });
    body.addEventListener('dragover', e => e.preventDefault());
    body.addEventListener('dragleave', e => { if (e.target === body) { body.classList.remove('drag-over'); head.classList.remove('drag-over'); } });
    body.addEventListener('drop', e => {
      e.preventDefault();
      body.classList.remove('drag-over'); head.classList.remove('drag-over');
      if (draggingId) onMoveTask(draggingId, s.id);
      draggingId = null;
    });

    for (const t of colTasks) {
      body.appendChild(KanbanCard(t, {
        onOpen: () => onOpenTask(t.id),
        onDragStart: (e) => { draggingId = t.id; e.currentTarget.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; },
        onDragEnd:   (e) => { e.currentTarget.classList.remove('dragging'); draggingId = null; },
      }));
    }
    if (colTasks.length === 0) {
      body.appendChild(h('div', { style: { textAlign: 'center', padding: '30px', color: 'var(--fg-4)', fontSize: '12px' } }, 'Drop tasks here'));
    }
    body.appendChild(h('button', {
      onClick: () => onAddTask(s.id),
      style: {
        display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--fg-3)',
        padding: '8px 10px', fontSize: '12.5px', borderRadius: '7px', textAlign: 'left',
      },
      onMouseenter: e => { e.currentTarget.style.background = 'var(--bg-3)'; e.currentTarget.style.color = 'var(--fg-0)'; },
      onMouseleave: e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--fg-3)'; },
    }, Icon('plus', 12), ' Add task'));

    root.appendChild(h('div', { class: 'kb-col' }, head, body));
  }
  return root;
}

function KanbanCard(task, { onOpen, onDragStart, onDragEnd }) {
  const proj = projectById(task.project);
  const sub = task.subtasks || [];
  const subDone = sub.filter(s => s.done).length;
  const subPct = sub.length ? (subDone / sub.length) * 100 : 0;

  const card = h('div', {
    class: 'kb-card', draggable: true,
    onDragstart: onDragStart, onDragend: onDragEnd, onClick: onOpen,
  });

  if (proj) card.appendChild(h('div', { class: 'kb-card-strip', style: { background: proj.color } }));

  card.appendChild(h('div', { style: { display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' } },
    h('span', { class: 'mono', style: { fontSize: '10.5px', color: 'var(--fg-3)' } }, task.ref),
    h('span', { style: { width: '3px', height: '3px', borderRadius: '50%', background: 'var(--fg-4)' } }),
    proj ? h('span', { style: { fontSize: '11px', color: proj.color, fontWeight: '500' } }, proj.name) : null,
    h('div', { style: { marginLeft: 'auto' } }, PriorityFlag(task.priority)),
  ));

  card.appendChild(h('div', {
    style: { fontSize: '13.5px', lineHeight: '1.35', fontWeight: '500', color: 'var(--fg-0)', marginBottom: '10px' }
  }, task.title));

  if (task.labels.length > 0) {
    const row = h('div', { class: 'hstack', style: { gap: '4px', marginBottom: '10px', flexWrap: 'wrap' } });
    task.labels.forEach(l => row.appendChild(Tag(l, true)));
    card.appendChild(row);
  }

  if (sub.length > 0) {
    card.appendChild(h('div', { style: { marginBottom: '10px' } },
      h('div', { style: { display: 'flex', justifyContent: 'space-between', marginBottom: '4px' } },
        h('span', { style: { fontSize: '10.5px', color: 'var(--fg-3)' } }, Icon('checkSquare', 10), ' Subtasks'),
        h('span', { class: 'mono', style: { fontSize: '10.5px', color: 'var(--fg-2)' } }, `${subDone}/${sub.length}`),
      ),
      h('div', { style: { height: '3px', background: 'var(--bg-4)', borderRadius: '2px', overflow: 'hidden' } },
        h('div', { style: { width: subPct + '%', height: '100%', background: subPct === 100 ? 'var(--green)' : 'var(--acc-0)', transition: 'width 0.3s' } }),
      ),
    ));
  }

  const bottom = h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } });
  const bl = h('div', { class: 'hstack', style: { gap: '8px', fontSize: '11px', color: 'var(--fg-3)' } });
  bl.appendChild(DueDate(task.due, true));
  if (task.comments) bl.appendChild(h('span', { class: 'hstack', style: { gap: '3px' } }, Icon('message', 11), String(task.comments)));
  bottom.appendChild(bl);
  bottom.appendChild(AvatarStack(task.assignees, 3, 20));
  card.appendChild(bottom);

  return card;
}

window.renderKanban = renderKanban;
