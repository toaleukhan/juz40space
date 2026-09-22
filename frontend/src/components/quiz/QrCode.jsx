import { useMemo } from 'react';
import QRCode from 'qrcode';

// PIN-ді өзі жазудан да жылдамырақ: телефонның камерасын жаудырса, ойынға
// бірден кіреді (?pin= сілтемесі арқылы — PlayGame.jsx соны JoinFlow-ға
// беріп, тікелей лақап-ат қадамын ашады).
//
// QRCode.create(...) синхронды: сыртқы суретке (мысалы, "qr generator"
// API-ге) PIN жібермей, дәл осы жерде, желісіз-ақ құрастырамыз — оқушының
// сабаққа қосылу коды үшінші жаққа кетпейді.
export default function QrCode({ value, size = 176, fg = '#0a2a35', bg = '#ffffff' }) {
  const qr = useMemo(() => QRCode.create(value, { errorCorrectionLevel: 'M' }), [value]);
  const { size: n, data } = qr.modules;
  const quiet = 2; // ақ жиек (модуль санында) — камера кодты сенімді танысын
  const cell = size / (n + quiet * 2);
  const r = cell * 0.28; // модульдің дөңгеленген бұрышы — «пиксель» емес, брендтің жұмсақ тілі

  const cells = [];
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (data[y * n + x]) cells.push(`M${(x + quiet) * cell + r},${(y + quiet) * cell} h${cell - 2 * r} a${r},${r} 0 0 1 ${r},${r} v${cell - 2 * r} a${r},${r} 0 0 1 -${r},${r} h-${cell - 2 * r} a${r},${r} 0 0 1 -${r},-${r} v-${cell - 2 * r} a${r},${r} 0 0 1 ${r},-${r} z`);
    }
  }

  return (
    <svg
      className="qg-qr"
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      role="img"
      aria-label="QR код: сканерлеп ойынға қосылу"
    >
      <rect width={size} height={size} rx={cell * 1.6} fill={bg} />
      <path d={cells.join(' ')} fill={fg} />
    </svg>
  );
}
