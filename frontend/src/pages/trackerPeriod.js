// Сапа трекерінің 2 айлық кезеңдерін есептеу: Қаң-Ақп, Нау-Сәу, Мам-Мау, Шіл-Там, Қыр-Қаз, Қар-Жел

const KK_MONTHS = ['Қаңтар','Ақпан','Наурыз','Сәуір','Мамыр','Маусым','Шілде','Тамыз','Қыркүйек','Қазан','Қараша','Желтоқсан'];

export function getPeriodId(date = new Date()) {
  const y = date.getFullYear();
  const bucketStart = Math.floor(date.getMonth() / 2) * 2 + 1; // 1,3,5,7,9,11
  return `${y}-${String(bucketStart).padStart(2, '0')}`;
}

export function getPeriodLabel(periodId) {
  const [y, m] = periodId.split('-').map(Number);
  return `${KK_MONTHS[m - 1]} – ${KK_MONTHS[m]} ${y}`;
}
