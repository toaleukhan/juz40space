import { badgeMeta } from './badges';
import BadgeIcon from './BadgeIcon';

// Апта ішіндегі орын өзгерісі: ▲2 / ▼1 / —
export function Movement({ row }) {
  if (!row.prevPlace) return null;
  const d = row.prevPlace - row.place;
  const title = `Бір апта бұрын ${row.prevPlace}-орында болды`;
  if (d > 0) return <span className="lv-mv is-up" title={title}>▲{d}</span>;
  if (d < 0) return <span className="lv-mv is-down" title={title}>▼{-d}</span>;
  return null; // орны өзгермесе — белгі қажет емес
}

// Қатарынан видео салған жұмыс күндері
export function Streak({ value }) {
  if (value >= 2) {
    return (
      <span className="lv-streak" title={`${value} жұмыс күні қатарынан видео салды`}>
        <BadgeIcon name="hit" size={12} />{value} күн
      </span>
    );
  }
  return null; // серия жоқ — шуыл қоспаймыз
}

// Бөлім атының жанындағы кішкене бейдждер
export function MiniBadges({ keys = [] }) {
  if (!keys.length) return null;
  return (
    <span className="lv-minis">
      {keys.map((k) => (
        <span key={k} className="lv-mini" style={{ '--b': badgeMeta[k].color }} title={`${badgeMeta[k].label}: ${badgeMeta[k].desc}`}>
          <BadgeIcon name={k} size={11} />
        </span>
      ))}
    </span>
  );
}
