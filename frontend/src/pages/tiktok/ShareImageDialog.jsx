import { useEffect, useState } from 'react';
import Modal from '../../components/common/Modal';
import { buildImageModel, renderRankingPng } from '../../utils/rankingImage';
import juz40Logo from '../../assets/juz40-logo.png';

// Рейтингті PNG сурет етіп (1080×1920, story өлшемі) алдын ала көрсетіп,
// жүктеп алуға береді.
export default function ShareImageDialog({ data, onClose }) {
  const [url, setUrl] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    let objectUrl = null;
    renderRankingPng(buildImageModel(data), juz40Logo)
      .then((blob) => {
        if (!alive || !blob) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => alive && setError('Суретті жасау мүмкін болмады'));
    return () => { alive = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [data]);

  return (
    <Modal title="Рейтинг суреті" description="1080×1920 — TikTok, Instagram story және чатқа жіберуге ыңғайлы." onClose={onClose}>
      <div style={{ display: 'grid', placeItems: 'center', marginTop: 14, minHeight: 200 }}>
        {error ? <p className="qz-alert" role="alert">{error}</p>
          : url ? <img src={url} alt="TikTok рейтингі" style={{ width: '100%', maxWidth: 300, borderRadius: 14, boxShadow: '0 8px 30px rgba(0,0,0,.25)' }} />
            : <div className="tt-loading"><span className="tt-spin" />Сурет салынып жатыр…</div>}
      </div>
      <div className="qz-modal__actions" style={{ marginTop: 16 }}>
        <button type="button" className="qz-btn" onClick={onClose}>Жабу</button>
        <a className={`qz-btn qz-btn--primary ${url ? '' : 'is-disabled'}`} href={url || undefined}
          download={`juz40-tiktok-reiting-${data.month}.png`} aria-disabled={!url}
          style={url ? undefined : { pointerEvents: 'none', opacity: 0.45 }}>
          Жүктеп алу (PNG)
        </a>
      </div>
    </Modal>
  );
}
