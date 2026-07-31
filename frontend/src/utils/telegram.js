// Telegram Web App SDK-і (index.html-ге қосылған) тек Mini App контекстінде
// window.Telegram.WebApp-ты орнатады — кәдімгі браузерде бұл әрдайым жоқ.
export function isTelegramWebApp() {
  return Boolean(window.Telegram?.WebApp?.initData);
}

export function getTelegramInitData() {
  return window.Telegram?.WebApp?.initData || '';
}
