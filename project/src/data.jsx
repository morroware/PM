// ---------- Team ----------
const TEAM = [
  { id: 'u1', name: 'Marcus Chen',    role: 'Lead Engineer',       initials: 'MC', color: '#3B82F6' },
  { id: 'u2', name: 'Priya Shah',     role: 'Systems Admin',       initials: 'PS', color: '#A855F7' },
  { id: 'u3', name: 'Diego Alvarez',  role: 'Network Tech',        initials: 'DA', color: '#F59E0B' },
  { id: 'u4', name: 'Aisha Okafor',   role: 'Maintenance',         initials: 'AO', color: '#22C55E' },
  { id: 'u5', name: 'Tom Reinhardt',  role: 'Field Tech',          initials: 'TR', color: '#EC4899' },
  { id: 'u6', name: 'You',            role: 'Ops Manager',         initials: 'YO', color: '#06B6D4' },
];
const ME = 'u6';

// ---------- Projects ----------
const PROJECTS = [
  { id: 'p1', name: 'Server Infrastructure', color: '#3B82F6' },
  { id: 'p2', name: 'Facility Maintenance',  color: '#22C55E' },
  { id: 'p3', name: 'Network Upgrades',      color: '#A855F7' },
  { id: 'p4', name: 'HVAC & Power',          color: '#F59E0B' },
  { id: 'p5', name: 'Security Systems',      color: '#EF4444' },
];

// ---------- Labels ----------
const LABELS = [
  { id: 'l1', name: 'Bug',         color: 'red' },
  { id: 'l2', name: 'Feature',     color: 'blue' },
  { id: 'l3', name: 'Urgent',      color: 'amber' },
  { id: 'l4', name: 'Preventive',  color: 'green' },
  { id: 'l5', name: 'Routine',     color: 'slate' },
  { id: 'l6', name: 'Research',    color: 'violet' },
  { id: 'l7', name: 'Safety',      color: 'pink' },
  { id: 'l8', name: 'Compliance',  color: 'cyan' },
];

// ---------- Statuses ----------
const STATUSES = [
  { id: 'backlog',     name: 'Backlog',     color: '#5D6679' },
  { id: 'todo',        name: 'To do',       color: '#8A94A8' },
  { id: 'in_progress', name: 'In progress', color: '#F59E0B' },
  { id: 'review',      name: 'In review',   color: '#A855F7' },
  { id: 'done',        name: 'Done',        color: '#22C55E' },
];

// ---------- Helpers ----------
const today = new Date(2026, 3, 21); // Apr 21, 2026
const daysFromNow = (n) => { const d = new Date(today); d.setDate(d.getDate() + n); return d.toISOString().slice(0,10); };

// ---------- Tasks (all shapes: project, status, labels, assignees, due, prio, subtasks) ----------
const TASKS = [
  // --- Server Infrastructure ---
  { id: 'CTT-101', title: 'Replace failing drive in RAID array on NAS-03', project: 'p1', status: 'in_progress', labels:['l1','l3'], assignees:['u1','u2'], due: daysFromNow(0), priority: 0, estimate: '4h',
    description: 'Drive 3 in NAS-03 is reporting SMART errors. Replace with hot-swap spare and let array rebuild overnight.',
    subtasks: [
      { id:'s1', text:'Verify spare drive matches model', done:true },
      { id:'s2', text:'Schedule maintenance window', done:true },
      { id:'s3', text:'Hot-swap drive', done:false },
      { id:'s4', text:'Monitor rebuild to completion', done:false },
      { id:'s5', text:'Update asset inventory', done:false },
    ],
    attachments: 2, comments: 5,
  },
  { id: 'CTT-102', title: 'Upgrade PostgreSQL to 16.2 on prod cluster', project: 'p1', status: 'todo', labels:['l2','l8'], assignees:['u1'], due: daysFromNow(5), priority: 1, estimate: '8h',
    subtasks:[{id:'s1',text:'Backup + snapshot',done:false},{id:'s2',text:'Staging dry-run',done:false},{id:'s3',text:'Prod cutover',done:false}],
    comments: 2 },
  { id: 'CTT-103', title: 'Quarterly off-site backup verification', project: 'p1', status: 'review', labels:['l4','l8'], assignees:['u2','u6'], due: daysFromNow(-1), priority: 2, estimate: '2h',
    subtasks:[{id:'s1',text:'Restore 10 random files',done:true},{id:'s2',text:'Integrity hash check',done:true},{id:'s3',text:'File compliance report',done:false}],
    comments: 1 },
  { id: 'CTT-104', title: 'Decommission legacy app server (web-07)', project: 'p1', status: 'backlog', labels:['l5'], assignees:['u1'], due: daysFromNow(21), priority: 3, estimate: '1d' },
  { id: 'CTT-105', title: 'Patch Tuesday — April 2026 rollout', project: 'p1', status: 'done', labels:['l5','l7'], assignees:['u2'], due: daysFromNow(-5), priority: 2, estimate: '6h',
    subtasks:[{id:'s1',text:'Test ring',done:true},{id:'s2',text:'Broad rollout',done:true},{id:'s3',text:'Post-patch validation',done:true}], comments: 8 },

  // --- Facility Maintenance ---
  { id: 'CTT-201', title: 'Replace HEPA filters on lab floor (3rd)', project: 'p2', status: 'todo', labels:['l4','l7'], assignees:['u4'], due: daysFromNow(2), priority: 2, estimate: '3h',
    subtasks:[{id:'s1',text:'Order replacement filters',done:true},{id:'s2',text:'Coordinate with lab',done:false},{id:'s3',text:'Swap + log',done:false}] },
  { id: 'CTT-202', title: 'Leak under sink — Kitchen B', project: 'p2', status: 'in_progress', labels:['l1','l3'], assignees:['u4','u5'], due: daysFromNow(0), priority: 0, estimate: '2h',
    description:'Slow drip reported near dishwasher shutoff. Kitchen is out of service until repair.',
    subtasks:[{id:'s1',text:'Shut off supply',done:true},{id:'s2',text:'Identify failed component',done:true},{id:'s3',text:'Replace shutoff valve',done:false}],
    comments: 3 },
  { id: 'CTT-203', title: 'Monthly emergency lighting test', project: 'p2', status: 'todo', labels:['l4','l7','l8'], assignees:['u4'], due: daysFromNow(3), priority: 2, estimate: '2h' },
  { id: 'CTT-204', title: 'Re-paint loading dock safety lines', project: 'p2', status: 'backlog', labels:['l5','l7'], assignees:['u5'], due: daysFromNow(14), priority: 3, estimate: '1d' },
  { id: 'CTT-205', title: 'Loose ceiling tile — conference room 4A', project: 'p2', status: 'done', labels:['l1'], assignees:['u4'], due: daysFromNow(-2), priority: 2, estimate: '30m' },

  // --- Network Upgrades ---
  { id: 'CTT-301', title: 'Install new 10G switches in MDF', project: 'p3', status: 'in_progress', labels:['l2'], assignees:['u3','u1'], due: daysFromNow(1), priority: 1, estimate: '6h',
    subtasks:[{id:'s1',text:'Rack & power',done:true},{id:'s2',text:'Fiber patch',done:true},{id:'s3',text:'VLAN config',done:false},{id:'s4',text:'Fail-over test',done:false}],
    attachments: 4, comments: 6 },
  { id: 'CTT-302', title: 'Wi-Fi coverage survey — 4th floor', project: 'p3', status: 'review', labels:['l6'], assignees:['u3'], due: daysFromNow(-1), priority: 2, estimate: '4h',
    subtasks:[{id:'s1',text:'Walk survey',done:true},{id:'s2',text:'Heatmap report',done:true}] },
  { id: 'CTT-303', title: 'Replace aging AP in cafeteria', project: 'p3', status: 'todo', labels:['l1'], assignees:['u3'], due: daysFromNow(4), priority: 2, estimate: '1h' },
  { id: 'CTT-304', title: 'Firewall ruleset audit', project: 'p3', status: 'todo', labels:['l8','l7'], assignees:['u1','u3'], due: daysFromNow(7), priority: 1, estimate: '1d' },

  // --- HVAC & Power ---
  { id: 'CTT-401', title: 'UPS battery replacement — data center A', project: 'p4', status: 'in_progress', labels:['l4','l7'], assignees:['u4','u1'], due: daysFromNow(2), priority: 1, estimate: '1d',
    subtasks:[{id:'s1',text:'Order batteries',done:true},{id:'s2',text:'Schedule downtime',done:true},{id:'s3',text:'Install + load test',done:false}],
    comments: 4 },
  { id: 'CTT-402', title: 'Calibrate thermostat zones 2-5', project: 'p4', status: 'todo', labels:['l4'], assignees:['u5'], due: daysFromNow(5), priority: 2, estimate: '3h' },
  { id: 'CTT-403', title: 'Generator monthly load test', project: 'p4', status: 'done', labels:['l4','l8'], assignees:['u4'], due: daysFromNow(-7), priority: 2, estimate: '2h' },
  { id: 'CTT-404', title: 'Investigate spike on chiller 2 amp draw', project: 'p4', status: 'backlog', labels:['l6','l1'], assignees:['u5'], due: daysFromNow(10), priority: 2, estimate: '4h' },

  // --- Security Systems ---
  { id: 'CTT-501', title: 'Replace camera at loading dock (offline)', project: 'p5', status: 'todo', labels:['l1','l3'], assignees:['u3','u5'], due: daysFromNow(1), priority: 0, estimate: '2h',
    description: 'Camera LD-03 has been offline for 48h. Likely PoE port or camera failure.' },
  { id: 'CTT-502', title: 'Audit badge-access logs, Q1', project: 'p5', status: 'review', labels:['l8','l7'], assignees:['u2'], due: daysFromNow(-2), priority: 2, estimate: '6h',
    subtasks:[{id:'s1',text:'Pull Q1 access logs',done:true},{id:'s2',text:'Flag anomalies',done:true},{id:'s3',text:'Report to compliance',done:true}], comments: 2 },
  { id: 'CTT-503', title: 'Update door controller firmware (all zones)', project: 'p5', status: 'in_progress', labels:['l2','l7'], assignees:['u3'], due: daysFromNow(3), priority: 1, estimate: '1d' },
  { id: 'CTT-504', title: 'Annual fire panel inspection', project: 'p5', status: 'done', labels:['l4','l8'], assignees:['u4'], due: daysFromNow(-10), priority: 1, estimate: '4h' },
];

// Helper lookups
const teamById = (id) => TEAM.find(u => u.id === id);
const projectById = (id) => PROJECTS.find(p => p.id === id);
const labelById = (id) => LABELS.find(l => l.id === id);
const statusById = (id) => STATUSES.find(s => s.id === id);

// Activity feed
const ACTIVITY = [
  { id:'a1', who:'u1', action:'moved', task:'CTT-301', detail:'To do → In progress', at:'2h ago' },
  { id:'a2', who:'u2', action:'completed', task:'CTT-105', detail:'Patch Tuesday — April 2026 rollout', at:'5h ago' },
  { id:'a3', who:'u4', action:'commented', task:'CTT-202', detail:'Ordered new shutoff valve, arrives tomorrow', at:'6h ago' },
  { id:'a4', who:'u3', action:'assigned', task:'CTT-501', detail:'to Tom Reinhardt', at:'yesterday' },
  { id:'a5', who:'u6', action:'created', task:'CTT-402', detail:'Calibrate thermostat zones 2-5', at:'yesterday' },
  { id:'a6', who:'u1', action:'closed', task:'CTT-504', detail:'Annual fire panel inspection', at:'2d ago' },
];

Object.assign(window, { TEAM, ME, PROJECTS, LABELS, STATUSES, TASKS, ACTIVITY, teamById, projectById, labelById, statusById, today, daysFromNow });
