// scheduleDb.js — Docx парсингінен кейін admin жариялаған (published=true)
// кестелерді серверден жүктеу. Бұл деректер scheduleData.js статикалық
// файлымен бірге "қабат" ретінде біріктіріледі (ауысу кезеңі): DB-де
// сол ай/түрге жарияланған нұсқа болса — сол көрінеді, болмаса — статикалық
// файл fallback ретінде қала береді.

import api from '../services/api';

export const EMPTY_PUBLISHED = { smart: {}, smartAdditional: {}, junior: {} };

export async function loadPublishedSchedules() {
  try {
    const { data } = await api.get('/schedule/published');
    return { ...EMPTY_PUBLISHED, ...data };
  } catch {
    return { ...EMPTY_PUBLISHED };
  }
}
