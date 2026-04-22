// Thin wrapper over fetch for the PM API. All endpoints return JSON; errors throw.

const API = {
  base: 'api',

  async request(path, opts = {}) {
    const res = await fetch(`${this.base}/${path}`, {
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      ...opts,
    });
    let body;
    try { body = await res.json(); } catch { body = {}; }
    if (!res.ok) {
      const err = new Error(body.error || `HTTP ${res.status}`);
      err.status = res.status;
      err.body = body;
      throw err;
    }
    return body;
  },

  get(path)         { return this.request(path, { method: 'GET' }); },
  post(path, body)  { return this.request(path, { method: 'POST', body: JSON.stringify(body || {}) }); },
  patch(path, body) { return this.request(path, { method: 'PATCH', body: JSON.stringify(body || {}) }); },
  del(path)         { return this.request(path, { method: 'DELETE' }); },

  // ---- auth ----
  me()                     { return this.get('auth.php?action=me'); },
  login(email, password)   { return this.post('auth.php?action=login', { email, password }); },
  logout()                 { return this.post('auth.php?action=logout', {}); },
  register(data)           { return this.post('auth.php?action=register', data); },
  updateProfile(data)      { return this.post('auth.php?action=update_profile', data); },

  // ---- bundle: load everything the app needs on boot ----
  async bootstrap() {
    const [me, projects, labels, users, tasks] = await Promise.all([
      this.me(),
      this.get('projects.php'),
      this.get('labels.php'),
      this.get('users.php'),
      this.get('tasks.php'),
    ]);
    return {
      me:       me.user,
      projects: projects.projects,
      labels:   labels.labels,
      users:    users.users,
      tasks:    tasks.tasks,
    };
  },

  // ---- tasks ----
  listTasks()               { return this.get('tasks.php'); },
  createTask(data)          { return this.post('tasks.php', data); },
  updateTask(id, patch)     { return this.patch(`tasks.php?id=${id}`, patch); },
  deleteTask(id)            { return this.del(`tasks.php?id=${id}`); },

  addSubtask(taskId, text)  { return this.post(`tasks.php?id=${taskId}&subtasks=1`, { text }); },
  updateSubtask(taskId, subId, patch) { return this.patch(`tasks.php?id=${taskId}&subtask_id=${subId}`, patch); },
  deleteSubtask(taskId, subId)        { return this.del(`tasks.php?id=${taskId}&subtask_id=${subId}`); },

  listComments(taskId)      { return this.get(`tasks.php?id=${taskId}&comments=1`); },
  addComment(taskId, body)  { return this.post(`tasks.php?id=${taskId}&comments=1`, { body }); },

  // ---- misc ----
  listActivity()            { return this.get('activity.php'); },
  listUsers()               { return this.get('users.php'); },
  listProjects()            { return this.get('projects.php'); },
};

window.API = API;
