// Thin wrapper over fetch for the PM API. All endpoints return JSON; errors throw.

const API = {
  base: 'api',

  async request(path, opts = {}) {
    const hasBody = Object.prototype.hasOwnProperty.call(opts, 'body');
    const isFormData = hasBody && (opts.body instanceof FormData);
    const res = await fetch(`${this.base}/${path}`, {
      credentials: 'same-origin',
      headers: isFormData
        ? { 'Accept': 'application/json' }
        : { 'Content-Type': 'application/json', 'Accept': 'application/json' },
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
  updateComment(taskId, commentId, body) { return this.patch(`tasks.php?id=${taskId}&comments=1&comment_id=${commentId}`, { body }); },
  deleteComment(taskId, commentId) { return this.del(`tasks.php?id=${taskId}&comments=1&comment_id=${commentId}`); },
  bulkUpdateTasks(taskIds, patch) { return this.patch('tasks.php?bulk=1', { task_ids: taskIds, patch }); },
  listAttachments(taskId) { return this.get(`attachments.php?task_id=${taskId}`); },
  uploadAttachment(taskId, file) {
    const form = new FormData();
    form.append('file', file);
    return this.request(`attachments.php?task_id=${taskId}`, { method: 'POST', body: form });
  },
  deleteAttachment(id) { return this.del(`attachments.php?id=${id}`); },

  // ---- projects ----
  listProjects(opts = {})   {
    const q = opts.onlyActive ? '?only_active=1' : '';
    return this.get('projects.php' + q);
  },
  getProject(id)            { return this.get(`projects.php?id=${id}`); },
  createProject(data)       { return this.post('projects.php', data); },
  updateProject(id, patch)  { return this.patch(`projects.php?id=${id}`, patch); },
  deleteProject(id, force=false) { return this.del(`projects.php?id=${id}${force ? '&force=1' : ''}`); },

  // ---- labels ----
  listLabels(opts = {})     {
    const parts = [];
    if (opts.includeArchived) parts.push('include_archived=1');
    if (opts.projectId != null) parts.push('project_id=' + opts.projectId);
    return this.get('labels.php' + (parts.length ? '?' + parts.join('&') : ''));
  },
  createLabel(data)         { return this.post('labels.php', data); },
  updateLabel(id, patch)    { return this.patch(`labels.php?id=${id}`, patch); },
  deleteLabel(id, force=false) { return this.del(`labels.php?id=${id}${force ? '&force=1' : ''}`); },

  // ---- slack integration ----
  getSlack()                { return this.get('slack.php'); },
  updateSlack(data)         { return this.post('slack.php?action=save', data); },
  testSlack(channel)        { return this.post('slack.php?action=test', { channel }); },

  // ---- recurring rules ----
  listRecurring()           { return this.get('recurring.php'); },
  createRecurring(data)     { return this.post('recurring.php', data); },
  updateRecurring(id, data) { return this.patch(`recurring.php?id=${id}`, data); },
  deleteRecurring(id)       { return this.del(`recurring.php?id=${id}`); },

  // ---- users (admin) ----
  updateUser(id, patch)     { return this.patch(`users.php?id=${id}`, patch); },
  deleteUser(id)            { return this.del(`users.php?id=${id}`); },

  // ---- misc ----
  listActivity()            { return this.get('activity.php'); },
  listUsers()               { return this.get('users.php'); },
  listSavedViews()          { return this.get('saved_views.php'); },
  createSavedView(data)     { return this.post('saved_views.php', data); },
  updateSavedView(id, data) { return this.patch(`saved_views.php?id=${id}`, data); },
  deleteSavedView(id)       { return this.del(`saved_views.php?id=${id}`); },
};

window.API = API;
