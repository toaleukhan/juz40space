import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
const { formatBookingMessage, sendTelegramMessage, notifyCoordinatorsOfBooking } = require('./telegramNotify');

describe('formatBookingMessage', () => {
  it('formats an СТ booking with student count', () => {
    const text = formatBookingMessage({
      subject: 'ФИЗ', streamId: '01', curatorName: 'Аждаров Аңсар', type: 'st',
      studentsCount: '50', scheduledDate: '2026-07-27', startTime: '15:00', endTime: '16:00',
      meetLink: 'https://meet.google.com/abc-defg-hij',
    });
    expect(text).toBe(
      'ФИЗ-01 Аждаров Аңсар\n' +
      'Оқушы саны: 50\n' +
      'Уақыты: 27.07.2026 15:00–16:00\n' +
      'Сілтемесі: https://meet.google.com/abc-defg-hij'
    );
  });

  it('formats a personal booking without a student-count line', () => {
    const text = formatBookingMessage({
      subject: 'ФИЗ', streamId: '01', curatorName: 'Жұбатбек Алия', type: 'personal',
      studentsCount: null, scheduledDate: '2026-07-28', startTime: '14:00', endTime: '14:20',
      meetLink: 'https://meet.google.com/xyz-klmn-opq',
    });
    expect(text).toBe(
      'ФИЗ-01 Жұбатбек Алия (Жеке сөйлесу)\n' +
      'Уақыты: 28.07.2026 14:00–14:20\n' +
      'Сілтемесі: https://meet.google.com/xyz-klmn-opq'
    );
  });

  it('defaults student count to 0 when missing', () => {
    const text = formatBookingMessage({
      subject: 'МАТ', streamId: '11', curatorName: 'Test', type: 'st',
      studentsCount: '', scheduledDate: '2026-08-01', startTime: '09:00', endTime: '10:00', meetLink: 'x',
    });
    expect(text).toContain('Оқушы саны: 0');
  });
});

describe('sendTelegramMessage', () => {
  const originalFetch = global.fetch;
  const originalToken = process.env.TELEGRAM_BOT_TOKEN;

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.TELEGRAM_BOT_TOKEN = originalToken;
  });

  it('does nothing when TELEGRAM_BOT_TOKEN is not set', async () => {
    delete process.env.TELEGRAM_BOT_TOKEN;
    global.fetch = vi.fn();
    await sendTelegramMessage(123, 'hi');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('does nothing when chatId is missing', async () => {
    process.env.TELEGRAM_BOT_TOKEN = 'tok';
    global.fetch = vi.fn();
    await sendTelegramMessage(null, 'hi');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('POSTs to the Telegram Bot API with the right chat id and text', async () => {
    process.env.TELEGRAM_BOT_TOKEN = 'test-token';
    global.fetch = vi.fn().mockResolvedValue({ ok: true });
    await sendTelegramMessage(999, 'сәлем');
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.telegram.org/bottest-token/sendMessage',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ chat_id: 999, text: 'сәлем' }),
      })
    );
  });

  it('does not throw when the network call fails', async () => {
    process.env.TELEGRAM_BOT_TOKEN = 'test-token';
    global.fetch = vi.fn().mockRejectedValue(new Error('network down'));
    await expect(sendTelegramMessage(999, 'hi')).resolves.toBeUndefined();
  });
});

describe('notifyCoordinatorsOfBooking', () => {
  const originalFetch = global.fetch;
  const originalToken = process.env.TELEGRAM_BOT_TOKEN;

  beforeEach(() => {
    process.env.TELEGRAM_BOT_TOKEN = 'test-token';
    global.fetch = vi.fn().mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.TELEGRAM_BOT_TOKEN = originalToken;
  });

  const booking = {
    subject: 'ФИЗ', streamId: '01', curatorName: 'Аждаров Аңсар', type: 'st',
    studentsCount: '50', scheduledDate: '2026-07-27', startTime: '15:00', endTime: '16:00',
    meetLink: 'https://meet.google.com/abc-defg-hij',
  };

  it('sends a message to every linked coordinator for that subject/stream', async () => {
    const pool = { query: vi.fn().mockResolvedValue({ rows: [{ telegram_id: 111 }, { telegram_id: 222 }] }) };
    await notifyCoordinatorsOfBooking(pool, booking);
    expect(pool.query).toHaveBeenCalledWith(expect.stringContaining("role = 'coordinator'"), ['ФИЗ', '01']);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('sends nothing when no coordinator is linked for that subject/stream', async () => {
    const pool = { query: vi.fn().mockResolvedValue({ rows: [] }) };
    await notifyCoordinatorsOfBooking(pool, booking);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('does not throw when the coordinator lookup query fails', async () => {
    const pool = { query: vi.fn().mockRejectedValue(new Error('db down')) };
    await expect(notifyCoordinatorsOfBooking(pool, booking)).resolves.toBeUndefined();
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
