import { useEffect, useState } from 'react';
import Modal from '../../components/common/Modal';
import { tiktok, errorText } from '../../services/tiktokApi';

// Apify токенін ауыстыру — тек енгізу өрісі. Қазіргі токеннің соңғы
// 4 таңбасы өрістің ішінде (placeholder) көрінеді. Токен сақталмас бұрын
// backend оны Apify-да тексереді, қате болса ескісі қалады.
export default function ApifyDialog({ onClose, onSaved }) {
  const [current, setCurrent] = useState(null);
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    tiktok.apifyStatus()
      .then((s) => alive && setCurrent(s.configured ? s.masked : null))
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const save = async (e) => {
    e.preventDefault();
    if (!token.trim()) return;
    setBusy(true);
    setError('');
    setSaved(false);
    try {
      const s = await tiktok.saveApifyToken(token.trim());
      setCurrent(s.masked);
      setToken('');
      setSaved(true);
      onSaved?.();
    } catch (err) {
      setError(errorText(err, 'Токенді сақтау мүмкін болмады'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Apify" onClose={onClose}>
      <form onSubmit={save} className="tt-apify-form tt-apify-form--solo">
        <input type="password" value={token} aria-label="Apify токені" autoFocus
          onChange={(e) => { setToken(e.target.value); setError(''); setSaved(false); }}
          placeholder={current || 'apify_api_…'} autoComplete="off" spellCheck={false} />
        <button type="submit" className="qz-btn qz-btn--primary" disabled={busy || !token.trim()}>
          {busy ? 'Тексерілуде…' : saved ? 'Сақталды ✓' : 'Сақтау'}
        </button>
      </form>
      {error && <p className="qz-alert" role="alert" style={{ marginTop: 12, marginBottom: 0 }}>{error}</p>}
    </Modal>
  );
}
