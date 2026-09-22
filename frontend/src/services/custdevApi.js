import api from './api';

// CustDev API-нің жіңішке қабаты — беттер тек осыны шақырады.
export const custdev = {
  roles: () => api.get('/custdev/roles').then((r) => r.data),

  rounds: () => api.get('/custdev/rounds').then((r) => r.data),
  createRound: (body) => api.post('/custdev/rounds', body).then((r) => r.data),
  round: (id) => api.get(`/custdev/rounds/${id}`).then((r) => r.data),
  updateRound: (id, body) => api.put(`/custdev/rounds/${id}`, body).then((r) => r.data),
  deleteRound: (id) => api.delete(`/custdev/rounds/${id}`).then((r) => r.data),
  exportRound: (id) => api.get(`/custdev/rounds/${id}/export`).then((r) => r.data),

  createSession: (roundId, body) => api.post(`/custdev/rounds/${roundId}/sessions`, body).then((r) => r.data),
  session: (id) => api.get(`/custdev/sessions/${id}`).then((r) => r.data),
  updateSession: (id, body) => api.put(`/custdev/sessions/${id}`, body).then((r) => r.data),
  deleteSession: (id) => api.delete(`/custdev/sessions/${id}`).then((r) => r.data),
  generate: (id) => api.post(`/custdev/sessions/${id}/generate`).then((r) => r.data),
};

export const errorText = (err, fallback) => err?.response?.data?.error || fallback;
