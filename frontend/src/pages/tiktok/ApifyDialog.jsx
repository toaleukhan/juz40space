import { useEffect, useState } from 'react';
import Modal from '../../components/common/Modal';
import { tiktok, errorText } from '../../services/tiktokApi';
import { fmtDateTime } from '../../utils/tiktok';

const CONSOLE_URL = 'https://console.apify.com/settings/integrations';

// Apify токені мен лимиті. Тегін аккаунттың $5 кредиті біткенде жаңа
// аккаунттың токенін осында қоясыз — Railway-ге кірудің қажеті жоқ.
// Токен сақталмас бұрын Apify-да тексеріледі, толық мәні ешқашан көрсетілмейді.
export default function ApifyDialog({ onClose, onSaved }) {
  const [status, setStatus] = useState(null);
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    tiktok.apifyStatus()
      .then((s) => alive && setStatus(s))
      .catch((err) => alive && setError(errorText(err, 'Apify күйін алу мүмкін болмады')));
    return () => { alive = false; };
  }, []);

  const save = async (e) => {
    e.preventDefault();
    if (!token.trim()) { setError('Токенді қойыңыз'); return; }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const s = await tiktok.saveApifyToken(token.trim());
      setStatus(s);
      setToken('');
      setNotice(s.account?.username ? `Сақталды — енді «${s.account.username}» аккаунты қолданылады` : 'Сақталды');
      onSaved?.();
    } catch (err) {
      setError(errorText(err, 'Токенді сақтау мүмкін болмады'));
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      setStatus(await tiktok.removeApifyToken());
      setNotice('Сайттағы токен өшірілді');
    } catch (err) {
      setError(errorText(err, 'Өшіру мүмкін болмады'));
    } finally {
      setBusy(false);
    }
  };

  const acc = status?.account;
  const pct = acc && acc.limitUsd ? Math.min(100, Math.round((acc.usedUsd / acc.limitUsd) * 100)) : null;

  return (
    <Modal title="Apify" description="TikTok видеоларын тартатын қызмет. Кредит біткенде жаңа аккаунттың токенін осында қойыңыз." onClose={onClose}>
      {status === null && !error ? (
        <div className="tt-loading"><span className="tt-spin" />Тексерілуде…</div>
      ) : status && (
        <div className="tt-apify">
          <div className="tt-apify-row">
            <span>Қазіргі токен</span>
            <b>{status.configured ? status.masked : 'қосылмаған'}</b>
          </div>
          <div className="tt-apify-row">
            <span>Қайдан</span>
            <b>{status.source === 'site' ? `сайттан · ${fmtDateTime(status.updatedAt)}` : status.source === 'env' ? 'Railway (APIFY_TOKEN)' : '—'}</b>
          </div>
          {acc && (
            <>
              <div className="tt-apify-row"><span>Аккаунт</span><b>{acc.username}{acc.plan ? ` · ${acc.plan}` : ''}</b></div>
              {pct !== null && (
                <div className="tt-apify-usage">
                  <div className="tt-apify-row">
                    <span>Осы айдағы шығын</span>
                    <b>${acc.usedUsd} / ${acc.limitUsd}</b>
                  </div>
                  <div className="tt-apify-bar" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Apify кредиті">
                    <span style={{ width: `${pct}%` }} className={pct >= 90 ? 'is-bad' : ''} />
                  </div>
                  {acc.cycleEnd && <small>Кредит {fmtDateTime(acc.cycleEnd)} жаңарады</small>}
                </div>
              )}
            </>
          )}
          {status.accountError && <p className="qz-alert" style={{ margin: 0 }}>{status.accountError}</p>}
        </div>
      )}

      <form onSubmit={save} className="tt-apify-form">
        <label>
          Жаңа токен
          <input type="password" value={token} onChange={(e) => { setToken(e.target.value); setError(''); }}
            placeholder="apify_api_…" autoComplete="off" spellCheck={false} />
        </label>
        <button type="submit" className="qz-btn qz-btn--primary" disabled={busy}>{busy ? 'Тексерілуде…' : 'Тексеріп, сақтау'}</button>
      </form>
      <p className="qz-note">
        Токенді <a href={CONSOLE_URL} target="_blank" rel="noreferrer">Apify Console → Settings → API &amp; Integrations</a> бетінен көшіріңіз.
        Қате токен сақталмайды — ескісі жұмыс істей береді.
      </p>
      {status?.source === 'site' && (
        <button type="button" className="qz-btn qz-btn--ghost" onClick={reset} disabled={busy}>Railway-дегі токенге қайту</button>
      )}
      {notice && <p className="tt-apify-ok" role="status">{notice}</p>}
      {error && <p className="qz-alert" role="alert" style={{ marginTop: 12, marginBottom: 0 }}>{error}</p>}
    </Modal>
  );
}
