import { useEffect, useState } from 'react';

// Ойынның тірі күйін SSE арқылы алады. Сервер әр қосылғанда толық күйді
// (snapshot) жібереді, сондықтан қосылым үзіліп қайта қосылса да, бет
// жаңартылса да, клиент ештеңе жоғалтпайды — «жетпей қалған оқиға» деген
// ұғым жоқ.
//
// offset = серверлік уақыт − жергілікті уақыт. Барлық таймер серверлік
// уақытқа есептеледі, сондықтан телефонының сағаты дұрыс емес ойыншы да
// сұрақ басталып-біткен сәтті бәрімен бірдей көреді.
export function useGameStream(url) {
  const [view, setView] = useState(null);
  const [conn, setConn] = useState('connecting'); // connecting | open | lost | closed
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    if (!url) return undefined;
    const es = new EventSource(url);
    es.onopen = () => setConn('open');
    es.addEventListener('snapshot', (e) => {
      const next = JSON.parse(e.data);
      setOffset(next.serverNow - Date.now());
      setView(next);
      setConn('open');
    });
    // Браузер үзілген қосылымды өзі қайта қосады ('lost'). Сервер 403/404
    // қайтарса, ол қайта қосылмайды — бұл 'closed'.
    es.onerror = () => setConn(es.readyState === EventSource.CLOSED ? 'closed' : 'lost');
    return () => es.close();
  }, [url]);

  return { view, conn, offset };
}

// Серверлік «қазір». Интервалмен жаңарады (requestAnimationFrame емес —
// бет фонда тұрса да таймер тоқтамайды).
export function useServerNow(offset, active = true, everyMs = 100) {
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (!active) return undefined;
    const tick = () => setNow(Date.now() + offset);
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, everyMs);
    return () => { clearTimeout(first); clearInterval(id); };
  }, [offset, active, everyMs]);
  return now;
}
