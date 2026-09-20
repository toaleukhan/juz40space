// Рейтинг: ұпай көп — жоғары; тең болса, барлық жауапқа жұмсаған уақыты
// аз (жылдамырақ) — жоғары; ол да тең болса, ертерек қосылған. Бұл
// тәртіп детерминді, сондықтан екі бірдей адам бір орында тұрып қалмайды.
function compare(a, b) {
  if (b.score !== a.score) return b.score - a.score;
  if (a.totalMs !== b.totalMs) return a.totalMs - b.totalMs;
  if (a.joinedAtMs !== b.joinedAtMs) return a.joinedAtMs - b.joinedAtMs;
  return a.id - b.id;
}

// players: [{ id, score, totalMs, joinedAtMs, ... }] — өзгертпей, орны
// (rank, 1-ден) қосылған жаңа сұрыпталған массив қайтарады.
function rankPlayers(players) {
  return [...players].sort(compare).map((p, i) => ({ ...p, rank: i + 1 }));
}

// Алдыңғы сұраққа дейінгі орынды есептеу (рейтингте ▲▼ көрсету үшін).
// deltas: Map<playerId, { points, ms }> — сол сұрақта қосылған мәндер.
function previousRanks(players, deltas) {
  const rewound = players.map((p) => {
    const d = deltas.get(p.id) || { points: 0, ms: 0 };
    return { ...p, score: p.score - d.points, totalMs: p.totalMs - d.ms };
  });
  const map = new Map();
  rankPlayers(rewound).forEach((p) => map.set(p.id, p.rank));
  return map;
}

module.exports = { rankPlayers, previousRanks, compare };
