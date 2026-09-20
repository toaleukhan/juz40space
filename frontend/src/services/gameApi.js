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

// Сервер JSON-қате қайтарса — сол мәтін. Әйтпесе себебін ажыратамыз: жауап
// мүлде келмесе — байланыс; JSON емес 404 — backend әлі жаңартылмаған
// (Vercel Railway-ден ерте деплойланғанда осылай болады).
export const errorText = (err, fallback) => {
  const fromServer = err?.response?.data?.error;
  if (fromServer) return fromServer;
  if (!err?.response) return 'Серверге қосылу мүмкін болмады. Интернетті тексеріп, қайталаңыз.';
  if (err.response.status === 404) return 'Сервер жаңартылып жатыр (викторина модулі әлі қосылмаған). 1–2 минуттан кейін қайталаңыз.';
  return fallback;
};
export const errorCode = (err) => err?.response?.data?.code || null;
