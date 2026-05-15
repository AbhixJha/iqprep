const API_BASE = 'http://localhost:8080/api';

const getToken = () => localStorage.getItem('iq3_token');
const setToken = (t) => localStorage.setItem('iq3_token', t);
const removeToken = () => localStorage.removeItem('iq3_token');

async function apiFetch(endpoint, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` }),
    ...options.headers
  };
  try {
    const res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Something went wrong!');
    return data;
  } catch (err) {
    console.error('API Error:', err);
    throw err;
  }
}

const Auth = {
  async register(payload) {
    const data = await apiFetch('/auth/register', { method: 'POST', body: JSON.stringify(payload) });
    setToken(data.token);
    S.set('iq3_user', {
      id: data.id, firstName: data.firstName, lastName: data.lastName,
      email: data.email, roles: data.roles, targetRole: data.targetRole,
      totalSessions: data.totalSessions, averageScore: data.averageScore
    });
    return data;
  },
  async login(payload) {
    const data = await apiFetch('/auth/login', { method: 'POST', body: JSON.stringify(payload) });
    setToken(data.token);
    S.set('iq3_user', {
      id: data.id, firstName: data.firstName, lastName: data.lastName,
      email: data.email, roles: data.roles, targetRole: data.targetRole,
      totalSessions: data.totalSessions, averageScore: data.averageScore
    });
    return data;
  },
  logout() {
    removeToken();
    S.del('iq3_user');
    S.del('iq3_history');
    window.location.href = '../index.html';
  }
};

const UserAPI = {
  async getProfile() { return await apiFetch('/user/profile'); },
  async updateProfile(payload) {
    const data = await apiFetch('/user/profile', { method: 'PUT', body: JSON.stringify(payload) });
    const current = S.get('iq3_user') || {};
    S.set('iq3_user', { ...current, ...payload });
    return data;
  },
  async getLeaderboard() { return await apiFetch('/user/leaderboard'); }
};

const Sessions = {
  async save(payload) { return await apiFetch('/sessions', { method: 'POST', body: JSON.stringify(payload) }); },
  async getAll() { return await apiFetch('/sessions'); },
  async getById(id) { return await apiFetch(`/sessions/${id}`); }
};

const Evaluate = {
  async answer(payload) { return await apiFetch('/evaluate', { method: 'POST', body: JSON.stringify(payload) }); }
};

const Analytics = {
  async get() { return await apiFetch('/analytics'); }
};