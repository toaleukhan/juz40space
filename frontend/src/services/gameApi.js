import axios from 'axios';
import api from './api';

export const API_BASE = api.defaults.baseURL;

// Ойыншылар аккаунтсыз: олардың клиентінде JWT де, 401 кезіндегі /login
// редиректі де болмауы керек — әйтпесе оқушы кездейсоқ логин бетіне ұшып кетеді.
export const playApi = axios.create({ baseURL: API_BASE });

const KEY = 'juz40_player';

// Ойыншының құпия токені осында сақталады: бет жаңарса немесе қосылым
// үзілсе, ол сол ойынға өзі қайта кіреді. Жеке режимде localStorage
// қолжетімсіз болуы мүмкін — сондықтан бәрі try/catch ішінде.
export const playerSession = {
  get() {
    try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; }
  },
  set(value) {
    try { localStorage.setItem(KEY, JSON.stringify(value)); } catch { /* жеке режим */ }
  },
  clear() {
    try { localStorage.removeItem(KEY); } catch { /* жеке режим */ }
  },
};

export const errorText = (err, fallback) => err?.response?.data?.error || fallback;
export const errorCode = (err) => err?.response?.data?.code || null;
