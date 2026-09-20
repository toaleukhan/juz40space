import * as XLSX from 'xlsx';

const secs = (ms) => (ms == null ? '' : Number((ms / 1000).toFixed(1)));
const safeName = (s) => String(s || 'viktorina').replace(/[\\/:*?"<>|]/g, '_').trim().slice(0, 60) || 'viktorina';

function sheet(rows, widths) {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = widths.map((wch) => ({ wch }));
  return ws;
}

// Ойын нәтижесін Excel-ге шығарады: сапа бөлімі кестемен жұмыс істеуге
// үйренген, сондықтан үш парақ — рейтинг, сұрақтар бойынша талдау және
// әр оқушының әр сұраққа жауабы.
export function exportResultsXlsx(data) {
  const { game, players, questions } = data;
  const played = Math.max(game.played, 1);
  const wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(wb, sheet([
    ['Орын', 'Лақап ат', 'Ұпай', 'Дұрыс жауап', 'Жауап берді', 'Дәлдік, %', 'Орташа уақыт, с'],
    ...players.map((p) => [
      p.rank, p.nickname, p.score, p.correctCount, p.answeredCount,
      Math.round((p.correctCount / played) * 100), secs(p.avgMs),
    ]),
  ], [7, 24, 9, 14, 13, 11, 16]), 'Рейтинг');

  XLSX.utils.book_append_sheet(wb, sheet([
    ['№', 'Сұрақ', 'Дұрыс жауап', 'Дұрыс, %', 'Дұрыс', 'Қате', 'Жауап бермеген', 'Орташа уақыт, с', 'A', 'B', 'C', 'D'],
    ...questions.map((q) => {
      const total = q.answeredCount + q.noAnswer;
      return [
        q.index + 1,
        q.prompt,
        q.correct.map((i) => q.options[i]).join(' / '),
        total ? Math.round((q.correctCount / total) * 100) : 0,
        q.correctCount,
        q.answeredCount - q.correctCount,
        q.noAnswer,
        secs(q.avgMs),
        ...[0, 1, 2, 3].map((i) => (q.options[i] === undefined ? '' : q.counts[i])),
      ];
    }),
  ], [5, 52, 30, 10, 8, 8, 15, 15, 6, 6, 6, 6]), 'Сұрақтар');

  XLSX.utils.book_append_sheet(wb, sheet([
    ['Лақап ат', ...questions.map((q) => `${q.index + 1}`), 'Ұпай'],
    ...players.map((p) => [
      p.nickname,
      ...p.answers.map((a) => (a ? (a.correct ? `✓ ${a.points}` : '✗') : '—')),
      p.score,
    ]),
  ], [24, ...questions.map(() => 8), 9]), 'Жауаптар');

  const date = new Date(game.createdAt).toISOString().slice(0, 10);
  XLSX.writeFile(wb, `${safeName(game.title)}_${date}.xlsx`);
}
