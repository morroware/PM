// Task detail drawer.
// Comments are cached per-task-id on the window so re-renders of the drawer
// (which happen on every state update) don't re-fetch the same comments.
window._pmCommentsCache = window._pmCommentsCache || {};
window._pmAttachmentsCache = window._pmAttachmentsCache || {};

function renderTaskDetail(task, { onClose, onUpdate, onToggleSubtask, onAddSubtask, onDeleteSubtask, onDeleteTask }) {
  const scrim = h('div', { class: 'scrim light', onClick: onClose });
  const drawer = h('div', { class: 'drawer' });
  const host = document.createDocumentFragment();
  host.appendChild(scrim);
  host.appendChild(drawer);

  let editingTitle = false;
  let tempTitle = task.title;
  let newSubtaskText = '';
  let comments = window._pmCommentsCache[task.id] || null;
  let attachments = window._pmAttachmentsCache[task.id] || null;
  let uploadingAttachment = false;

  async function loadComments() {
    try {
      const r = await API.listComments(task.id);
      comments = r.comments || [];
      window._pmCommentsCache[task.id] = comments;
      redraw();
    } catch (e) { toast('Could not load comments: ' + e.message, 'error'); }
  }
  if (comments === null) loadComments();
  async function loadAttachments() {
    try {
      const r = await API.listAttachments(task.id);
      attachments = r.attachments || [];
      window._pmAttachmentsCache[task.id] = attachments;
      redraw();
    } catch (e) { toast('Could not load attachments: ' + e.message, 'error'); }
  }
  if (attachments === null) loadAttachments();

  function redraw() {
    drawer.replaceChildren();
    const proj = projectById(task.project);
    const sub = task.subtasks || [];
    const subDone = sub.filter(s => s.done).length;
    const pct = sub.length ? (subDone / sub.length) * 100 : 0;

    // Head
    const head = h('div', { class: 'drawer-head' });
    head.appendChild(h('span', { class: 'mono', style: { fontSize: '11.5px', color: 'var(--fg-3)' } }, task.ref));
    if (proj) head.appendChild(h('span', { style: { display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11.5px', color: proj.color } },
      h('span', { style: { width: '8px', height: '8px', borderRadius: '2px', background: proj.color } }),
      proj.name));
    head.appendChild(h('div', { style: { marginLeft: 'auto' }, class: 'hstack' },
      h('button', { class: 'icon-btn', title: 'Copy link',
        onClick: () => { navigator.clipboard?.writeText(`${location.origin}${location.pathname}#task=${task.id}`); toast('Link copied'); } },
        Icon('link', 14)),
      h('button', { class: 'icon-btn', title: 'Delete',
        onClick: async () => {
          if (!confirm(`Delete ${task.ref}?\n\n${task.title}`)) return;
          try {
            await onDeleteTask(task.id);
            delete window._pmCommentsCache[task.id];
            delete window._pmAttachmentsCache[task.id];
            onClose();
          } catch (e) { toast(e.message, 'error'); }
        } }, Icon('trash', 14)),
      h('button', { class: 'icon-btn', onClick: onClose }, Icon('x', 14)),
    ));
    drawer.appendChild(head);

    // Body
    const body = h('div', { class: 'drawer-body' });

    // Title
    if (editingTitle) {
      const ta = h('textarea', {
        autofocus: true, value: tempTitle,
        onInput: e => { tempTitle = e.target.value; },
        onBlur: () => save(),
        onKeydown: e => {
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); save(); }
          if (e.key === 'Escape') { tempTitle = task.title; editingTitle = false; redraw(); }
        },
        style: {
          width: '100%', fontSize: '20px', fontWeight: '600', letterSpacing: '-0.01em',
          background: 'var(--bg-3)', border: '1px solid var(--acc-border)', borderRadius: '8px',
          padding: '10px', color: 'var(--fg-0)', outline: 'none', resize: 'none', minHeight: '60px',
        },
      });
      body.appendChild(ta);
      async function save() {
        const v = (tempTitle || '').trim();
        editingTitle = false;
        if (v && v !== task.title) {
          try { await onUpdate(task.id, { title: v }); task.title = v; }
          catch (e) { toast('Save failed: ' + e.message, 'error'); }
        }
        redraw();
      }
    } else {
      body.appendChild(h('h2', {
        onClick: () => { tempTitle = task.title; editingTitle = true; redraw(); },
        style: {
          margin: 0, fontSize: '20px', fontWeight: '600', letterSpacing: '-0.01em',
          cursor: 'text', padding: '8px', marginLeft: '-8px', borderRadius: '6px',
        },
        onMouseenter: e => e.currentTarget.style.background = 'var(--bg-3)',
        onMouseleave: e => e.currentTarget.style.background = 'transparent',
      }, task.title));
    }

    // Properties grid
    const grid = h('div', { style: { marginTop: '18px', display: 'grid', gridTemplateColumns: '110px 1fr', rowGap: '10px', alignItems: 'center' } });

    // Status
    grid.appendChild(PropLabel('activity', 'Status'));
    {
      const btn = h('button', { style: { background: 'transparent', padding: '4px', borderRadius: '6px' } }, StatusPill(task.status));
      btn.addEventListener('click', () => {
        openPopover(btn, ({close}) => statusPickerContent(task.status, async v => {
          try { const r = await onUpdate(task.id, { status: v }); Object.assign(task, r.task || {status:v}); redraw(); } catch(e){toast(e.message,'error');}
        }, close));
      });
      grid.appendChild(h('div', null, btn));
    }

    // Priority
    grid.appendChild(PropLabel('flag', 'Priority'));
    {
      const btn = h('button', { class: 'chip' }, PriorityFlag(task.priority, true));
      btn.addEventListener('click', () => {
        openPopover(btn, ({close}) => priorityPickerContent(task.priority, async v => {
          try { const r = await onUpdate(task.id, { priority: v }); Object.assign(task, r.task || {priority:v}); redraw(); } catch(e){toast(e.message,'error');}
        }, close));
      });
      grid.appendChild(h('div', null, btn));
    }

    // Assignees
    grid.appendChild(PropLabel('users', 'Assignees'));
    {
      const names = task.assignees.map(id => (userById(id)?.name || '').split(' ')[0]).filter(Boolean).join(', ');
      const btn = h('button', { class: 'chip', style: { padding: '3px 8px' } },
        AvatarStack(task.assignees, 3, 20),
        h('span', { style: { marginLeft: '4px' } }, names || 'Unassigned'));
      btn.addEventListener('click', () => {
        openPopover(btn, ({close}) => assigneePickerContent(task.assignees, async uid => {
          const set = new Set(task.assignees);
          set.has(uid) ? set.delete(uid) : set.add(uid);
          const arr = [...set];
          try { const r = await onUpdate(task.id, { assignees: arr }); Object.assign(task, r.task || {assignees: arr}); redraw(); } catch(e){toast(e.message,'error');}
        }, close));
      });
      grid.appendChild(h('div', null, btn));
    }

    // Due
    grid.appendChild(PropLabel('clock', 'Due date'));
    {
      const input = h('input', {
        type: 'date', value: task.due || '',
        style: { background: 'var(--bg-3)', border: '1px solid var(--line-2)', borderRadius: '6px', padding: '4px 8px', color: 'var(--fg-0)', fontSize: '12px', outline: 'none' },
        onChange: async e => {
          const v = e.target.value || null;
          try { const r = await onUpdate(task.id, { due: v }); Object.assign(task, r.task || {due:v}); redraw(); } catch(err){toast(err.message,'error');}
        },
      });
      grid.appendChild(h('div', { class: 'hstack' }, input, task.due ? DueDate(task.due) : null));
    }

    // Labels
    grid.appendChild(PropLabel('tag', 'Labels'));
    {
      const wrap = h('div', { style: { display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' } });
      task.labels.forEach(l => wrap.appendChild(Tag(l)));
      const add = h('button', { class: 'chip', style: { fontSize: '11.5px' } }, Icon('plus', 11), ' Add label');
      add.addEventListener('click', () => {
        openPopover(add, ({close}) => labelPickerContent(task.labels, async lid => {
          const set = new Set(task.labels);
          set.has(lid) ? set.delete(lid) : set.add(lid);
          const arr = [...set];
          try { const r = await onUpdate(task.id, { labels: arr }); Object.assign(task, r.task || {labels: arr}); redraw(); } catch(e){toast(e.message,'error');}
        }, close, {
          keepOpen: true,
          scopeProjectId: task.project,
          onCreateLabel: window.pmCreateLabelFromPicker,
        }));
      });
      wrap.appendChild(add);
      grid.appendChild(wrap);
    }

    // Estimate
    grid.appendChild(PropLabel('zap', 'Estimate'));
    {
      const input = h('input', {
        type: 'text', placeholder: '—', value: task.estimate || '',
        style: { background: 'var(--bg-3)', border: '1px solid var(--line-2)', borderRadius: '6px', padding: '4px 8px', color: 'var(--fg-0)', fontSize: '12px', outline: 'none', width: '100px' },
        onBlur: async e => {
          const v = e.target.value.trim() || null;
          if (v === (task.estimate || null)) return;
          try { const r = await onUpdate(task.id, { estimate: v }); Object.assign(task, r.task || {estimate:v}); } catch(err){toast(err.message,'error');}
        },
      });
      grid.appendChild(h('div', null, input));
    }
    body.appendChild(grid);

    // Description
    body.appendChild(h('div', { style: { marginTop: '22px' } },
      h('div', { style: { fontSize: '11px', color: 'var(--fg-3)', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: '600', marginBottom: '8px' } }, 'Description'),
      (() => {
        const ta = h('textarea', {
          placeholder: 'Add a description...',
          value: task.description || '',
          style: {
            width: '100%', minHeight: '70px', resize: 'vertical',
            background: 'var(--bg-3)', border: '1px solid var(--line)', borderRadius: '8px',
            padding: '12px', fontSize: '13.5px', color: 'var(--fg-1)', lineHeight: '1.55', outline: 'none',
          },
          onBlur: async e => {
            const v = e.target.value;
            if (v === (task.description || '')) return;
            try { const r = await onUpdate(task.id, { description: v }); Object.assign(task, r.task || {description:v}); } catch(err){toast(err.message,'error');}
          },
        });
        return ta;
      })(),
    ));

    // Subtasks
    const subSection = h('div', { style: { marginTop: '22px' } });
    subSection.appendChild(h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' } },
      h('div', { style: { fontSize: '11px', color: 'var(--fg-3)', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: '600' } }, 'Subtasks'),
      sub.length > 0 ? h('span', { class: 'mono', style: { fontSize: '11px', color: 'var(--fg-2)' } }, `${subDone}/${sub.length}`) : null,
    ));
    if (sub.length > 0) {
      subSection.appendChild(h('div', { style: { height: '4px', background: 'var(--bg-4)', borderRadius: '2px', overflow: 'hidden', marginBottom: '10px' } },
        h('div', { style: { width: pct + '%', height: '100%', background: pct === 100 ? 'var(--green)' : 'var(--acc-0)', transition: 'width 0.3s' } })));
    }
    const subBox = h('div', { style: { background: 'var(--bg-3)', border: '1px solid var(--line)', borderRadius: '8px' } });
    sub.forEach((s, i) => {
      const del = h('button', {
        class: 'icon-btn sm sub-del',
        title: 'Delete subtask',
        style: { opacity: '0', transition: 'opacity 0.1s' },
        onClick: async (e) => {
          e.stopPropagation();
          try {
            await onDeleteSubtask(task.id, s.id);
            task.subtasks = (task.subtasks || []).filter(x => x.id !== s.id);
            redraw();
          } catch(err) { toast(err.message, 'error'); }
        },
      }, Icon('trash', 12));
      const row = h('div', {
        style: {
          display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px',
          borderBottom: i === sub.length - 1 ? 'none' : '1px solid var(--line)',
          cursor: 'pointer',
        },
        onClick: async () => {
          try {
            await onToggleSubtask(task.id, s.id, !s.done);
            s.done = !s.done;
            redraw();
          } catch(e){toast(e.message,'error');}
        },
        onMouseenter: e => { e.currentTarget.style.background = 'var(--bg-4)'; del.style.opacity = '1'; },
        onMouseleave: e => { e.currentTarget.style.background = 'transparent'; del.style.opacity = '0'; },
      },
        Checkbox(s.done, 16),
        h('span', { style: { fontSize: '13px', flex: 1,
          color: s.done ? 'var(--fg-3)' : 'var(--fg-1)',
          textDecoration: s.done ? 'line-through' : 'none' } }, s.text),
        del,
      );
      subBox.appendChild(row);
    });
    const addRow = h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', borderTop: sub.length ? '1px solid var(--line)' : 'none' } });
    addRow.appendChild(h('div', { style: { width: '16px', height: '16px', borderRadius: '4px', border: '1.5px dashed var(--fg-4)' } }));
    const subInput = h('input', {
      placeholder: 'Add a subtask...', value: newSubtaskText,
      style: { flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: '13px', color: 'var(--fg-1)' },
      onInput: e => { newSubtaskText = e.target.value; },
      onKeydown: async e => {
        if (e.key === 'Enter' && newSubtaskText.trim()) {
          try {
            const text = newSubtaskText.trim();
            const r = await onAddSubtask(task.id, text);
            task.subtasks = task.subtasks || [];
            task.subtasks.push(r.subtask);
            newSubtaskText = '';
            redraw();
          } catch(err){toast(err.message,'error');}
        }
      },
    });
    addRow.appendChild(subInput);
    subBox.appendChild(addRow);
    subSection.appendChild(subBox);
    body.appendChild(subSection);

    // Attachments
    const attSection = h('div', { style: { marginTop: '24px' } });
    attSection.appendChild(h('div', {
      style: { fontSize: '11px', color: 'var(--fg-3)', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: '600', marginBottom: '10px' }
    }, `Attachments · ${attachments == null ? '…' : attachments.length}`));

    const attList = h('div', { style: { display: 'grid', gap: '8px' } });
    if (attachments && attachments.length) {
      attachments.forEach((a) => {
        attList.appendChild(h('div', {
          style: {
            display: 'flex', gap: '8px', alignItems: 'center',
            background: 'var(--bg-3)', border: '1px solid var(--line)', borderRadius: '8px', padding: '8px 10px',
          },
        },
          Icon('paperclip', 13),
          h('a', {
            href: a.download_url,
            style: { color: 'var(--fg-1)', fontSize: '12.5px', textDecoration: 'none', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
            title: a.name,
          }, a.name),
          h('span', { class: 'mono', style: { fontSize: '11px', color: 'var(--fg-3)' } }, formatBytes(a.size)),
          h('button', {
            class: 'btn btn-ghost',
            style: { fontSize: '11px', padding: '2px 6px' },
            onClick: async () => {
              if (!confirm(`Delete attachment \"${a.name}\"?`)) return;
              try {
                await API.deleteAttachment(a.id);
                attachments = attachments.filter(x => x.id !== a.id);
                window._pmAttachmentsCache[task.id] = attachments;
                task.attachments = Math.max(0, (task.attachments || 0) - 1);
                redraw();
              } catch (e) { toast(e.message, 'error'); }
            },
          }, 'Delete'),
        ));
      });
    } else if (attachments && attachments.length === 0) {
      attList.appendChild(h('div', { style: { color: 'var(--fg-3)', fontSize: '12px' } }, 'No attachments yet.'));
    }
    attSection.appendChild(attList);

    const fileInput = h('input', {
      type: 'file',
      style: { display: 'none' },
      onChange: async (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        uploadingAttachment = true;
        redraw();
        try {
          const r = await API.uploadAttachment(task.id, file);
          attachments = attachments || [];
          attachments.unshift(r.attachment);
          window._pmAttachmentsCache[task.id] = attachments;
          task.attachments = (task.attachments || 0) + 1;
          toast('Attachment uploaded', 'success');
        } catch (err) {
          toast('Upload failed: ' + err.message, 'error');
        } finally {
          uploadingAttachment = false;
          e.target.value = '';
          redraw();
        }
      },
    });
    attSection.appendChild(fileInput);
    attSection.appendChild(h('div', { style: { marginTop: '10px' } },
      h('button', {
        class: 'btn btn-ghost',
        disabled: uploadingAttachment,
        onClick: () => fileInput.click(),
      }, Icon('plus', 12), uploadingAttachment ? ' Uploading…' : ' Upload file'),
    ));
    body.appendChild(attSection);

    // Comments
    const cmtSection = h('div', { style: { marginTop: '24px' } });
    cmtSection.appendChild(h('div', {
      style: { fontSize: '11px', color: 'var(--fg-3)', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: '600', marginBottom: '10px' }
    }, `Activity · ${comments == null ? '…' : comments.length} comment${comments && comments.length === 1 ? '' : 's'}`));

    const list = h('div', { style: { display: 'grid', gap: '10px' } });
    if (comments) {
      for (const c of comments) {
        const canModerate = (window.state.me?.is_admin) || (c.user?.id === window.state.me?.id);
        const bodyEl = h('div', { style: { fontSize: '13px', color: 'var(--fg-1)', marginTop: '4px', whiteSpace: 'pre-wrap' } }, c.body);
        list.appendChild(h('div', { style: { display: 'flex', gap: '10px' } },
          Avatar(c.user, 28),
          h('div', { style: { flex: 1 } },
            h('div', { style: { fontSize: '12.5px', color: 'var(--fg-1)', display: 'flex', alignItems: 'center', gap: '6px' } },
              h('span', { style: { fontWeight: 600 } }, c.user.name),
              h('span', { style: { color: 'var(--fg-3)', fontSize: '11.5px' } }, relTime(c.created_at)),
              c.updated_at ? h('span', { style: { color: 'var(--fg-4)', fontSize: '10.5px' } }, '(edited)') : null,
              canModerate ? h('button', { class: 'btn btn-ghost', style: { marginLeft: 'auto', fontSize: '11px', padding: '2px 6px' }, onClick: async () => {
                const next = prompt('Edit comment', c.body);
                if (next == null) return;
                if (!next.trim()) return toast('Comment cannot be empty', 'error');
                try {
                  const r = await API.updateComment(task.id, c.id, next.trim());
                  const idx = comments.findIndex(x => x.id === c.id);
                  if (idx >= 0) comments[idx] = r.comment;
                  window._pmCommentsCache[task.id] = comments;
                  redraw();
                } catch (e) { toast(e.message, 'error'); }
              } }, 'Edit') : null,
              canModerate ? h('button', { class: 'btn btn-ghost', style: { fontSize: '11px', padding: '2px 6px' }, onClick: async () => {
                if (!confirm('Delete this comment?')) return;
                try {
                  await API.deleteComment(task.id, c.id);
                  comments = comments.filter(x => x.id !== c.id);
                  window._pmCommentsCache[task.id] = comments;
                  redraw();
                } catch (e) { toast(e.message, 'error'); }
              } }, 'Delete') : null,
            ),
            bodyEl,
          ),
        ));
      }
    }
    cmtSection.appendChild(list);

    // New comment box
    const me = window.state.me;
    const ccInput = h('input', {
      placeholder: 'Leave a comment...',
      style: { width: '100%', background: 'transparent', border: 'none', outline: 'none', fontSize: '13px', color: 'var(--fg-1)' },
    });
    const submit = async () => {
      const v = ccInput.value.trim();
      if (!v) return;
      try {
        const r = await API.addComment(task.id, v);
        comments = comments || [];
        comments.push(r.comment);
        window._pmCommentsCache[task.id] = comments;
        ccInput.value = '';
        redraw();
        window.pmRefreshActivity && window.pmRefreshActivity();
      } catch(e){toast(e.message,'error');}
    };
    ccInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); submit(); } });
    cmtSection.appendChild(h('div', { style: { display: 'flex', gap: '10px', marginTop: '12px' } },
      Avatar(me, 28),
      h('div', { style: { flex: 1, background: 'var(--bg-3)', border: '1px solid var(--line)', borderRadius: '8px', padding: '10px' } },
        ccInput,
        h('div', { style: { display: 'flex', justifyContent: 'flex-end', marginTop: '8px' } },
          h('button', { class: 'btn btn-primary', style: { padding: '4px 10px', fontSize: '12px' }, onClick: submit }, 'Comment')),
      ),
    ));
    body.appendChild(cmtSection);

    drawer.appendChild(body);
  }

  redraw();
  return host;
}

function PropLabel(icon, text) {
  return h('div', {
    style: { display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--fg-3)', fontSize: '12px', fontWeight: '500' }
  }, Icon(icon, 13), text);
}

function formatBytes(n) {
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let v = Math.max(0, Number(n) || 0);
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v >= 10 || i === 0 ? Math.round(v) : v.toFixed(1)} ${units[i]}`;
}

window.renderTaskDetail = renderTaskDetail;
