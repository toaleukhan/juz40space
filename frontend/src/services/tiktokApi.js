import api from './api';

// TikTok жарысы API-інің жіңішке қабаты — бет тек осыны шақырады.
export const tiktok = {
  overview: (month) => api.get('/tiktok/overview', { params: { month } }).then((r) => r.data),

  departments: () => api.get('/tiktok/departments').then((r) => r.data),
  addDepartment: (body) => api.post('/tiktok/departments', body).then((r) => r.data),
  updateDepartment: (id, body) => api.put(`/tiktok/departments/${id}`, body).then((r) => r.data),
  deleteDepartment: (id) => api.delete(`/tiktok/departments/${id}`).then((r) => r.data),

  startSync: (month) => api.post('/tiktok/sync', { month }).then((r) => r.data),
  syncStatus: (id) => api.get(`/tiktok/sync/${id}`, { timeout: 120000 }).then((r) => r.data),

  saveScores: (month, deptId, body) => api.put(`/tiktok/scores/${month}/${deptId}`, body).then((r) => r.data),

  // Gemini бір минуттан асуы мүмкін
  analyze: (month) => api.post('/tiktok/analysis', { month }, { timeout: 150000 }).then((r) => r.data),
};

export const errorText = (err, fallback) => err?.response?.data?.error || fallback;
