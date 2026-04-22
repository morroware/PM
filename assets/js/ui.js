// Tiny hyperscript + UI atoms (avatars, tags, pills, pickers, popover, toast).

// -------- h() --------
// Usage: h('div', {class:'foo', onClick:fn, style:{color:'red'}}, child1, child2, ...)
// - tag may be a string or an existing DOM node (props are applied to it)
// - children may be strings, numbers, DOM nodes, arrays (flattened), or null/false/undefined (skipped)
function h(tag, props, ...children) {
  const el = typeof tag === 'string' ? document.createElement(tag) : tag;
  if (props) {
    for (const k in props) {
      const v = props[k];
      if (v == null || v === false) continue;
      if (k === 'class' || k === 'className') el.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k === 'dataset' && typeof v === 'object') Object.assign(el.dataset, v);
      else if (k === 'ref' && typeof v === 'function') v(el);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'html') el.innerHTML = v;
      else if (k in el && typeof el[k] !== 'function') {
        try { el[k] = v; } catch { el.setAttribute(k, v); }
      } else {
        el.setAttribute(k, v);
      }
    }
  }
  appendChildren(el, children);
  return el;
}
function appendChildren(el, children) {
  for (const c of children) {
    if (c == null || c === false) continue;
    if (Array.isArray(c)) { appendChildren(el, c); continue; }
    if (c instanceof Node) el.appendChild(c);
    else el.appendChild(document.createTextNode(String(c)));
  }
}
// Replace all children of `host` with the new node(s).
function mount(host, ...children) {
  host.replaceChildren();
  appendChildren(host, children);
}

// -------- look-ups (use window.state lazily) --------
const S = () => window.state;
const userById    = id => S().users.find(u => u.id == id);
const projectById = id => S().projects.find(p => p.id == id);
const labelById   = id => S().labels.find(l => l.id == id);
const STATUSES = [
  { id: 'backlog',     name: 'Backlog',     color: '#5D6679' },
  { id: 'todo',        name: 'To do',       color: '#8A94A8' },
  { id: 'in_progress', name: 'In progress', color: '#F59E0B' },
  { id: 'review',      name: 'In review',   color: '#A855F7' },
  { id: 'done',        name: 'Done',        color: '#22C55E' },
];
const statusById = id => STATUSES.find(s => s.id === id);

// -------- Date helpers --------
// All date math is local-wall-clock; we deliberately avoid toISOString() which
// returns UTC and can shift the calendar day for users east of UTC.
const today = () => { const d = new Date(); d.setHours(0,0,0,0); return d; };
const ymd = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};
const daysFromNow = (n) => {
  const d = today();
  d.setDate(d.getDate() + n);
  return ymd(d);
};
const parseISO = s => { if (!s) return null; const d = new Date(s); d.setHours(0,0,0,0); return d; };

// -------- Avatars --------
function Avatar(user, size = 22, ring = false) {
  if (!user) return document.createComment('no-user');
  const el = h('div', {
    class: 'avatar', title: user.name,
    style: {
      width: size + 'px', height: size + 'px',
      fontSize: Math.max(9, size * 0.38) + 'px',
      background: user.color,
      boxShadow: ring ? '0 0 0 2px var(--bg-1)' : undefined,
    },
  }, user.initials);
  return el;
}
function AvatarStack(userIds = [], max = 3, size = 22) {
  const shown = userIds.slice(0, max);
  const extra = userIds.length - shown.length;
  const wrap = h('div', { class: 'av-stack' });
  for (const id of shown) {
    const u = userById(id);
    if (!u) continue;
    wrap.appendChild(h('div', {
      class: 'avatar', title: u.name,
      style: {
        width: size + 'px', height: size + 'px',
        fontSize: Math.max(9, size * 0.38) + 'px',
        background: u.color,
      },
    }, u.initials));
  }
  if (extra > 0) wrap.appendChild(h('div', {
    class: 'av-more',
    style: { width: size + 'px', height: size + 'px', fontSize: Math.max(9, size * 0.38) + 'px' }
  }, '+' + extra));
  return wrap;
}

// -------- Tag / Priority / Status --------
function Tag(labelId, small = false) {
  const l = labelById(labelId);
  if (!l) return document.createComment('no-label');
  return h('span', { class: `tag ${l.color}${small ? ' small' : ''}` }, l.name);
}
const PRIO_LABELS = ['Urgent', 'High', 'Medium', 'Low'];
function PriorityFlag(p, showLabel = false) {
  const el = h('span', { class: `prio p${p}`, title: PRIO_LABELS[p] }, Icon('flag', 12));
  if (showLabel) el.appendChild(h('span', null, PRIO_LABELS[p]));
  return el;
}
function StatusPill(statusId) {
  const s = statusById(statusId);
  if (!s) return document.createComment('no-status');
  return h('span', {
    style: {
      display: 'inline-flex', alignItems: 'center', gap: '6px',
      padding: '2px 8px', borderRadius: '5px', fontSize: '11.5px', fontWeight: '500',
      background: s.color + '22', color: s.color, border: `1px solid ${s.color}33`,
    },
  },
    h('span', { style: { width: '6px', height: '6px', borderRadius: '50%', background: s.color } }),
    s.name);
}

// -------- Due date --------
function DueDate(due, small = false) {
  if (!due) return document.createComment('no-due');
  const d = parseISO(due);
  const t = today();
  const diff = Math.round((d - t) / 86400000);
  let label, color = 'var(--fg-2)';
  if (diff < 0) { label = `${Math.abs(diff)}d overdue`; color = '#FCA5A5'; }
  else if (diff === 0) { label = 'Today'; color = '#FCD34D'; }
  else if (diff === 1) { label = 'Tomorrow'; color = 'var(--fg-1)'; }
  else if (diff < 7) { label = d.toLocaleDateString('en', { weekday: 'short' }); }
  else { label = d.toLocaleDateString('en', { month: 'short', day: 'numeric' }); }
  return h('span', {
    style: {
      display: 'inline-flex', alignItems: 'center', gap: '4px',
      fontSize: small ? '11px' : '12px', color,
    },
  }, Icon('clock', small ? 11 : 12), label);
}

// -------- Checkbox --------
function Checkbox(checked, size = 16) {
  const el = h('div', { class: 'checkbox' + (checked ? ' checked' : ''),
    style: { width: size + 'px', height: size + 'px' } });
  if (checked) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', Math.round(size * 0.7));
    svg.setAttribute('height', Math.round(size * 0.7));
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'white');
    svg.setAttribute('stroke-width', '3.5');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.innerHTML = '<path d="M20 6 9 17l-5-5"/>';
    el.appendChild(svg);
  }
  return el;
}

// -------- Popover (portal to document.body) --------
// Opens under `anchor`, closes on outside click or Escape.
let _popoverCounter = 0;
function openPopover(anchor, buildContent, { offset = 6, align = 'start' } = {}) {
  const id = ++_popoverCounter;
  const pop = h('div', { class: 'popover', dataset: { popid: String(id) } });
  const content = buildContent({ close: () => closeMe() });
  appendChildren(pop, [content]);
  document.body.appendChild(pop);

  const r = anchor.getBoundingClientRect();
  const left = align === 'end' ? r.right - pop.offsetWidth : r.left;
  // clamp to viewport
  const maxLeft = window.innerWidth - pop.offsetWidth - 8;
  pop.style.top = (r.bottom + offset) + 'px';
  pop.style.left = Math.max(8, Math.min(left, maxLeft)) + 'px';

  function onDown(e) {
    if (!pop.contains(e.target) && !anchor.contains(e.target)) closeMe();
  }
  function onKey(e) { if (e.key === 'Escape') closeMe(); }
  function closeMe() {
    document.removeEventListener('mousedown', onDown, true);
    document.removeEventListener('keydown', onKey);
    pop.remove();
  }

  // Defer so the click that opened it doesn't immediately close it.
  setTimeout(() => document.addEventListener('mousedown', onDown, true), 0);
  document.addEventListener('keydown', onKey);
  // HTML `autofocus` only runs on initial page load; inputs added dynamically
  // need an explicit .focus() once they're in the DOM.
  setTimeout(() => {
    const input = pop.querySelector('input, textarea');
    if (input) input.focus();
  }, 0);
  return { close: closeMe, el: pop };
}

function PopoverItem({ selected = false, onSelect, children, leading } = {}) {
  const el = h('div', {
    class: 'pop-item' + (selected ? ' selected' : ''),
    onClick: onSelect,
  });
  if (leading) el.appendChild(leading);
  if (Array.isArray(children)) appendChildren(el, children);
  else if (children != null) appendChildren(el, [children]);
  el.appendChild(h('span', { class: 'check' }, Icon('check', 14)));
  return el;
}

// -------- Picker builders --------
function assigneePickerContent(selectedIds, onToggle, close) {
  const wrap = h('div');
  const input = h('input', { placeholder: 'Assign to...', autofocus: true });
  wrap.appendChild(h('div', { class: 'pop-search' }, input));
  wrap.appendChild(h('div', { class: 'popover-header' }, 'Teammates'));
  const list = h('div');
  wrap.appendChild(list);

  function render(query = '') {
    list.replaceChildren();
    const users = S().users.filter(u => u.name.toLowerCase().includes(query.toLowerCase()));
    for (const u of users) {
      list.appendChild(PopoverItem({
        selected: selectedIds.includes(u.id),
        onSelect: () => { onToggle(u.id); close(); },
        leading: Avatar(u, 22),
        children: h('div', null,
          h('div', { style: { fontWeight: '500' } }, u.name),
          h('div', { style: { fontSize: '11px', color: 'var(--fg-3)' } }, u.role || '')
        ),
      }));
    }
  }
  input.addEventListener('input', e => render(e.target.value));
  render();
  return wrap;
}

function labelPickerContent(selectedIds, onToggle, close, { keepOpen = false } = {}) {
  const wrap = h('div');
  const input = h('input', { placeholder: 'Find labels...', autofocus: true });
  wrap.appendChild(h('div', { class: 'pop-search' }, input));
  wrap.appendChild(h('div', { class: 'popover-header' }, 'Labels'));
  const list = h('div');
  wrap.appendChild(list);
  function render(query = '') {
    list.replaceChildren();
    const labels = S().labels.filter(l => l.name.toLowerCase().includes(query.toLowerCase()));
    for (const l of labels) {
      list.appendChild(PopoverItem({
        selected: selectedIds.includes(l.id),
        onSelect: () => { onToggle(l.id); if (!keepOpen) close(); else render(input.value); },
        leading: Tag(l.id),
      }));
    }
  }
  input.addEventListener('input', e => render(e.target.value));
  render();
  return wrap;
}

function statusPickerContent(value, onChange, close) {
  const wrap = h('div');
  wrap.appendChild(h('div', { class: 'popover-header' }, 'Change status'));
  for (const s of STATUSES) {
    wrap.appendChild(PopoverItem({
      selected: value === s.id,
      onSelect: () => { onChange(s.id); close(); },
      leading: h('span', { style: { width: '8px', height: '8px', borderRadius: '50%', background: s.color } }),
      children: h('span', null, s.name),
    }));
  }
  return wrap;
}

function priorityPickerContent(value, onChange, close) {
  const wrap = h('div');
  wrap.appendChild(h('div', { class: 'popover-header' }, 'Priority'));
  for (let p = 0; p < 4; p++) {
    wrap.appendChild(PopoverItem({
      selected: value === p,
      onSelect: () => { onChange(p); close(); },
      leading: PriorityFlag(p),
      children: h('span', null, PRIO_LABELS[p]),
    }));
  }
  return wrap;
}

function projectPickerContent(value, onChange, close) {
  const wrap = h('div');
  wrap.appendChild(h('div', { class: 'popover-header' }, 'Project'));
  for (const p of S().projects) {
    wrap.appendChild(PopoverItem({
      selected: value == p.id,
      onSelect: () => { onChange(p.id); close(); },
      leading: h('span', { style: { width: '10px', height: '10px', borderRadius: '3px', background: p.color } }),
      children: h('span', null, p.name),
    }));
  }
  return wrap;
}

// -------- Toast --------
function toast(msg, kind = 'info', ms = 3200) {
  let host = document.querySelector('.toast-host');
  if (!host) {
    host = h('div', { class: 'toast-host' });
    document.body.appendChild(host);
  }
  const t = h('div', { class: 'toast ' + kind }, msg);
  host.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity 0.2s'; }, ms - 200);
  setTimeout(() => t.remove(), ms);
}

window.h = h;
window.mount = mount;
window.STATUSES = STATUSES;
window.statusById = statusById;
window.userById = userById;
window.projectById = projectById;
window.labelById = labelById;
window.today = today;
window.ymd = ymd;
window.daysFromNow = daysFromNow;
window.parseISO = parseISO;
window.Avatar = Avatar;
window.AvatarStack = AvatarStack;
window.Tag = Tag;
window.PriorityFlag = PriorityFlag;
window.StatusPill = StatusPill;
window.DueDate = DueDate;
window.Checkbox = Checkbox;
window.openPopover = openPopover;
window.PopoverItem = PopoverItem;
window.assigneePickerContent = assigneePickerContent;
window.labelPickerContent = labelPickerContent;
window.statusPickerContent = statusPickerContent;
window.priorityPickerContent = priorityPickerContent;
window.projectPickerContent = projectPickerContent;
window.toast = toast;
window.PRIO_LABELS = PRIO_LABELS;
