// scheduleOverrides.js — Басқарушы қолмен қосқан сабақтар
// scheduleData.js статикалық файл болғандықтан, "Енгізу" формасы арқылы
// қосылған сабақтар осы модуль арқылы серверде (Postgres) сақталып,
// негізгі кестемен render кезінде біріктіріледі (List / Calendar / Teachers
// бәрінде, барлық кураторда бірдей көрінеді).

import api from '../services/api';

export const EMPTY_OVERRIDES = { live: {}, additional: {}, junior: {} };

export async function loadOverrides() {
  try {
    const { data } = await api.get('/schedule/overrides');
    return { ...EMPTY_OVERRIDES, ...data };
  } catch {
    return { ...EMPTY_OVERRIDES };
  }
}

export async function saveOverrides(overrides) {
  try {
    await api.put('/schedule/overrides', overrides);
  } catch {
    // желі/сервер қатесі — үнсіз елемейміз, келесі өзгертуде қайта көреді
  }
}

const DAY_ORDER = ['Дүйсенбі','Сейсенбі','Сәрсенбі','Бейсенбі','Жұма','Сенбі','Жексенбі'];

// Екі day-block массивін (негізгі + қолмен қосылған) күн атауы бойынша біріктіреді
export function mergeDays(baseDays = [], overrideDays = []) {
  const names = [...new Set([...baseDays.map(d => d.day), ...overrideDays.map(d => d.day)])];
  names.sort((a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b));
  return names.map(day => {
    const b = baseDays.find(d => d.day === day);
    const o = overrideDays.find(d => d.day === day);
    return {
      day,
      type: b?.type || o?.type || 'live',
      lessons: [...(b?.lessons || []), ...(o?.lessons || [])],
    };
  });
}

// Жаңа сабақты overrides-қа қосады (immutable), bucket: 'live' | 'additional' | 'junior'
export function addLessonOverride(overrides, { bucket, monthId, day, type, lesson }) {
  const next = {
    live: { ...overrides.live },
    additional: { ...overrides.additional },
    junior: { ...overrides.junior },
  };
  const monthDays = [...(next[bucket][monthId] || [])];
  const idx = monthDays.findIndex(d => d.day === day);
  if (idx === -1) {
    monthDays.push({ day, type, lessons: [lesson] });
  } else {
    monthDays[idx] = { ...monthDays[idx], lessons: [...monthDays[idx].lessons, lesson] };
  }
  next[bucket] = { ...next[bucket], [monthId]: monthDays };
  return next;
}

// Барлық мұғалімдердің атын жинақтайды (статикалық + overrides), мұғалім таңдау үшін
export function getAllTeacherNames(monthId, overrides, staticSchedules) {
  const names = new Set();
  const collect = (days) => (days || []).forEach(d => (d.lessons || []).forEach(l => (l.teachers || []).forEach(t => names.add(t.name))));
  collect(staticSchedules.smart[monthId]);
  collect(staticSchedules.smartAdditional[monthId]);
  collect(staticSchedules.junior[monthId]);
  collect(overrides.live?.[monthId]);
  collect(overrides.additional?.[monthId]);
  collect(overrides.junior?.[monthId]);
  return Array.from(names).sort((a, b) => a.localeCompare(b, 'kk'));
}

export { DAY_ORDER };
