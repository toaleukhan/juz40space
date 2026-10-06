import { useEffect, useState } from 'react';
import Modal from '../../components/common/Modal';
import { tiktok, errorText } from '../../services/tiktokApi';

const EMPTY = { name: '', username: '', teamTag: '', isTeamAccount: false };

// Бөлімдердің TikTok аккаунттары. Juz40_team — бөлек белгі: ол рейтингке
// кірмейді, бөлімдердің оған қосқан видеолары хештег бойынша есептеледі.
export default function DepartmentsDialog({ onClose, onChanged }) {
  const [list, setList] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmId, setConfirmId] = useState(null);

  const reload = () => tiktok.departments().then(setList).catch((err) => setError(errorText(err, 'Тізімді жүктеу мүмкін болмады')));
  useEffect(() => { reload(); }, []);

  const hasTeam = list?.some((d) => d.isTeamAccount);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (editId) await tiktok.updateDepartment(editId, form);
      else await tiktok.addDepartment(form);
      setForm(EMPTY);
      setEditId(null);
      await reload();
      onChanged();
    } catch (err) {
      setError(errorText(err, 'Сақтау мүмкін болмады'));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id) => {
    setBusy(true);
    try {
      await tiktok.deleteDepartment(id);
      setConfirmId(null);
      await reload();
      onChanged();
    } catch (err) {
      setError(errorText(err, 'Өшіру мүмкін болмады'));
    } finally {
      setBusy(false);
    }
  };

  const edit = (d) => {
    setEditId(d.id);
    setForm({ name: d.name, username: d.username, teamTag: d.teamTag, isTeamAccount: d.isTeamAccount });
  };

  return (
    <Modal title="Бөлімдер" wide
      description="Әр бөлімнің TikTok аккаунты. Хештег — бөлім Juz40_team аккаунтына видео салғанда қоятын белгі (мыс. juz40_fizika)."
      onClose={onClose}>
      <div className="tt-depts">
        {list === null ? <div className="tt-loading"><span className="tt-spin" />Жүктелуде…</div>
          : list.length === 0 ? <div className="qz-empty" style={{ padding: 20 }}>Әзірге бөлім жоқ</div>
            : list.map((d) => (
              <div key={d.id} className="tt-deptrow">
                <div>
                  <b>{d.isTeamAccount ? '⭐ Juz40_team' : d.name}</b>
                  <small>@{d.username}{d.teamTag ? ` · #${d.teamTag}` : ''}{d.isTeamAccount ? ' · рейтингке кірмейді' : ''}</small>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button type="button" className="qz-btn qz-btn--ghost" onClick={() => edit(d)}>Өзгерту</button>
                  {confirmId === d.id ? (
                    <button type="button" className="qz-btn qz-btn--danger" disabled={busy} onClick={() => remove(d.id)}>Растау</button>
                  ) : (
                    <button type="button" className="qz-btn qz-btn--ghost" onClick={() => { setConfirmId(d.id); setTimeout(() => setConfirmId(null), 3500); }}>Өшіру</button>
                  )}
                </div>
              </div>
            ))}
      </div>

      <form onSubmit={submit}>
        <div className="tt-deptform">
          <label>
            Бөлім атауы
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              disabled={form.isTeamAccount} placeholder={form.isTeamAccount ? 'Juz40_team' : 'Физика'} maxLength={120} />
          </label>
          <label>
            TikTok @username немесе сілтеме
            <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="juz40_fizika" required />
          </label>
          <label>
            Juz40_team хештегі
            <input value={form.teamTag} onChange={(e) => setForm({ ...form, teamTag: e.target.value })}
              disabled={form.isTeamAccount} placeholder="міндетті емес" />
          </label>
          <button type="submit" className="qz-btn qz-btn--primary" disabled={busy}>{editId ? 'Сақтау' : 'Қосу'}</button>
        </div>
        {!editId && !hasTeam && (
          <label className="tt-check">
            <input type="checkbox" checked={form.isTeamAccount}
              onChange={(e) => setForm({ ...EMPTY, username: form.username, isTeamAccount: e.target.checked })} />
            Бұл — Juz40_team ортақ аккаунты
          </label>
        )}
        {editId && (
          <button type="button" className="qz-btn qz-btn--ghost" style={{ marginTop: 8 }} onClick={() => { setEditId(null); setForm(EMPTY); }}>
            Өзгертуді болдырмау
          </button>
        )}
        {error && <p className="qz-alert" role="alert" style={{ marginTop: 12, marginBottom: 0 }}>{error}</p>}
      </form>
    </Modal>
  );
}
