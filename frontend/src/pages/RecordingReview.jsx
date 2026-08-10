// Куратордың СТ жазбасын бағалау беті: видео + "осы сәтті белгіле" арқылы
// жасалатын уақыт белгілі ескертулер тізімі (скриншотымен), ұсыныс және
// оқушы бойынша рейтинг ескертулері. Бұрын Google Doc-та қолмен жазылып
// жүрген кестенің орнын алады.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import api from '../services/api';
import { IconVideo, IconClose, IconCheck, IconAlert } from '../components/icons';

function fmtTime(sec) {
  sec = Math.max(0, Math.round(sec || 0));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const mm = String(m).padStart(h ? 2 : 1, '0');
  const ss = String(s).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${mm}:${ss}`;
}

export default function RecordingReview() {
  const { recordingId } = useParams();
  const navigate = useNavigate();
  const currentUser = useMemo(() => JSON.parse(localStorage.getItem('user') || '{}'), []);
  const canEdit = ['coordinator', 'admin'].includes(currentUser.role);

  const [record, setRecord] = useState(null);
  const [review, setReview] = useState(null);
  const [findings, setFindings] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [activeVideo, setActiveVideo] = useState(null);
  const [playTime, setPlayTime] = useState(0);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const [noteDraft, setNoteDraft] = useState(null); // { timestamp, screenshot } | null
  const [noteText, setNoteText] = useState('');
  const [saving, setSaving] = useState(false);

  const [recommendation, setRecommendation] = useState('');
  const [noIssues, setNoIssues] = useState(false);

  const [studentName, setStudentName] = useState('');
  const [studentOk, setStudentOk] = useState(true);
  const [studentNote, setStudentNote] = useState('');

  const videoLinks = record?.video_links?.length ? record.video_links : (record?.video_link ? [record.video_link] : []);

  const fetchAll = () => Promise.all([
    api.get(`/recordings/${recordingId}`),
    api.get(`/recordings/${recordingId}/review`),
  ]);

  const load = () => fetchAll()
    .then(([recRes, revRes]) => {
      setRecord(recRes.data);
      setReview(revRes.data.review);
      setFindings(revRes.data.findings);
      setStudents(revRes.data.students);
      setRecommendation(revRes.data.review?.recommendation || '');
      setNoIssues(revRes.data.review?.no_issues || false);
      const links = recRes.data.video_links?.length ? recRes.data.video_links : (recRes.data.video_link ? [recRes.data.video_link] : []);
      setActiveVideo((prev) => prev && links.includes(prev) ? prev : links[0] || null);
    })
    .catch((err) => setError(err.response?.data?.error || err.message))
    .finally(() => setLoading(false));

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordingId]);

  const videoSrc = activeVideo
    ? `${api.defaults.baseURL}/recordings/${recordingId}/video?url=${encodeURIComponent(activeVideo)}&token=${localStorage.getItem('token')}`
    : null;

  // "Осы сәтті белгіле" — видео БІЗДІҢ origin-нен келгендіктен (Drive
  // iframe емес), canvas.drawImage cross-origin қатесіз жұмыс істейді.
  const handleCaptureMoment = () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 360;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const screenshot = canvas.toDataURL('image/png');
    setNoteDraft({ timestamp: video.currentTime, screenshot });
    setNoteText('');
    video.pause();
  };

  const handleSaveFinding = async () => {
    if (!noteText.trim()) return;
    setSaving(true);
    try {
      const { data } = await api.post(`/recordings/${recordingId}/review/findings`, {
        videoUrl: activeVideo,
        timestampSeconds: Math.round(noteDraft.timestamp),
        description: noteText.trim(),
        screenshotBase64: noteDraft.screenshot,
      });
      setFindings((prev) => [...prev, data]);
      setNoIssues(false);
      setNoteDraft(null);
      setNoteText('');
    } catch (err) {
      alert('Қателік: ' + (err.response?.data?.error || err.message));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteFinding = async (id) => {
    try {
      await api.delete(`/recordings/review/findings/${id}`);
      setFindings((prev) => prev.filter((f) => f.id !== id));
    } catch (err) {
      alert('Қателік: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleSaveReview = async () => {
    setSaving(true);
    try {
      const { data } = await api.put(`/recordings/${recordingId}/review`, { noIssues, recommendation });
      setReview(data);
    } catch (err) {
      alert('Қателік: ' + (err.response?.data?.error || err.message));
    } finally {
      setSaving(false);
    }
  };

  const handleAddStudent = async () => {
    if (!studentName.trim()) return;
    try {
      const { data } = await api.post(`/recordings/${recordingId}/review/students`, {
        studentName: studentName.trim(), ok: studentOk, note: studentNote.trim() || null,
      });
      setStudents((prev) => [...prev, data]);
      setStudentName(''); setStudentNote(''); setStudentOk(true);
    } catch (err) {
      alert('Қателік: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleDeleteStudent = async (id) => {
    try {
      await api.delete(`/recordings/review/students/${id}`);
      setStudents((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      alert('Қателік: ' + (err.response?.data?.error || err.message));
    }
  };

  const jumpTo = (sec) => {
    if (videoRef.current) { videoRef.current.currentTime = sec; videoRef.current.play(); }
  };

  return (
    <div className="app-shell" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      <Sidebar />
      <main style={{ flex: 1, minWidth: 0, padding: '28px clamp(16px, 4vw, 40px) 60px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => navigate(-1)} style={{ padding: '7px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-sub)', fontWeight: 600, fontSize: 12.5, cursor: 'pointer' }}>
            ← Артқа
          </button>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '1px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Бағалау</div>
            <h1 style={{ fontSize: 20, fontWeight: 800, margin: '2px 0 0' }}>{record?.curator_name || '...'}</h1>
          </div>
        </div>

        {loading ? (
          <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>Жүктелуде...</div>
        ) : error ? (
          <div className="card" style={{ padding: 24, color: '#dc2626' }}>{error}</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 340px', gap: 20, alignItems: 'flex-start' }}>
            {/* ── Video + timeline ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {videoLinks.length > 1 && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {videoLinks.map((v, i) => (
                    <button key={v} onClick={() => setActiveVideo(v)}
                      style={{ padding: '6px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700,
                        background: v === activeVideo ? '#f59e0b' : 'var(--surface2)', color: v === activeVideo ? '#fff' : 'var(--text-sub)' }}>
                      Запись {i + 1}
                    </button>
                  ))}
                </div>
              )}

              {videoSrc ? (
                <video ref={videoRef} src={videoSrc} controls onTimeUpdate={(e) => setPlayTime(e.currentTarget.currentTime)}
                  style={{ width: '100%', borderRadius: 14, background: '#000', maxHeight: 480 }} />
              ) : (
                <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>Жазба сілтемесі жоқ</div>
              )}
              <canvas ref={canvasRef} style={{ display: 'none' }} />

              {canEdit && videoSrc && (
                <button onClick={handleCaptureMoment}
                  style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 10,
                    border: 'none', background: '#f59e0b', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                  <IconVideo style={{ width: 15, height: 15 }} /> Осы сәтті белгіле ({fmtTime(playTime)})
                </button>
              )}

              {noteDraft && (
                <div className="card" style={{ padding: 16, display: 'flex', gap: 14 }}>
                  <img src={noteDraft.screenshot} alt="" style={{ width: 160, borderRadius: 8, flexShrink: 0 }} />
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>{fmtTime(noteDraft.timestamp)} сәтіндегі ескерту</div>
                    <textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} rows={3} autoFocus
                      placeholder="Не байқалды? (мыс: Асан жанында дәптер тұрды)"
                      style={{ padding: 10, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: 13, resize: 'vertical' }} />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={handleSaveFinding} disabled={saving || !noteText.trim()}
                        style={{ padding: '7px 16px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', opacity: saving || !noteText.trim() ? 0.6 : 1 }}>
                        Сақтау
                      </button>
                      <button onClick={() => setNoteDraft(null)}
                        style={{ padding: '7px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-sub)', fontWeight: 600, fontSize: 12.5, cursor: 'pointer' }}>
                        Бас тарту
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Findings timeline ── */}
              <div className="card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 800 }}>Ескертулер ({findings.length})</div>
                {findings.length === 0 && !noIssues && (
                  <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Әлі ескерту қосылмаған.</div>
                )}
                {noIssues && findings.length === 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#059669', fontWeight: 700, fontSize: 13 }}>
                    <IconCheck style={{ width: 16, height: 16 }} /> Ескерту жоқ, жарайсыз!
                  </div>
                )}
                {findings.map((f) => (
                  <div key={f.id} style={{ display: 'flex', gap: 12, padding: '10px 0', borderTop: '1px solid var(--border)' }}>
                    {f.screenshot_url && (
                      <img src={f.screenshot_url} alt="" onClick={() => jumpTo(f.timestamp_seconds)}
                        style={{ width: 96, height: 54, objectFit: 'cover', borderRadius: 6, cursor: 'pointer', flexShrink: 0 }} />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <button onClick={() => jumpTo(f.timestamp_seconds)}
                        style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontFamily: 'monospace', fontSize: 11.5, fontWeight: 700, color: '#f59e0b' }}>
                        {fmtTime(f.timestamp_seconds)} →
                      </button>
                      <div style={{ fontSize: 13, color: 'var(--text)', marginTop: 3 }}>{f.description}</div>
                    </div>
                    {canEdit && (
                      <button onClick={() => handleDeleteFinding(f.id)} title="Өшіру"
                        style={{ border: 'none', background: 'none', color: 'var(--text-muted)', cursor: 'pointer', flexShrink: 0, height: 20 }}>
                        <IconClose style={{ width: 14, height: 14 }} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* ── Sidebar: recommendation + students ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, position: 'sticky', top: 18 }}>
              <div className="card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 800 }}>Қорытынды</div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 600, color: 'var(--text-sub)', cursor: canEdit ? 'pointer' : 'default' }}>
                  <input type="checkbox" checked={noIssues} disabled={!canEdit}
                    onChange={(e) => setNoIssues(e.target.checked)} />
                  Ескерту жоқ, жарайсыз!
                </label>
                <textarea value={recommendation} onChange={(e) => setRecommendation(e.target.value)} rows={4} disabled={!canEdit}
                  placeholder="Ұсыныс..."
                  style={{ padding: 10, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: 13, resize: 'vertical' }} />
                {canEdit && (
                  <button onClick={handleSaveReview} disabled={saving}
                    style={{ padding: '9px 16px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
                    Сақтау
                  </button>
                )}
                {review && <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>Соңғы жаңарту: {new Date(review.updated_at).toLocaleString('kk-KZ')}</div>}
              </div>

              <div className="card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 800 }}>Рейтинг балл сәйкестігі ({students.length})</div>
                {students.map((s) => (
                  <div key={s.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12.5 }}>
                    {s.ok ? <IconCheck style={{ width: 14, height: 14, color: '#059669', marginTop: 2, flexShrink: 0 }} /> : <IconAlert style={{ width: 14, height: 14, color: '#d97706', marginTop: 2, flexShrink: 0 }} />}
                    <div style={{ flex: 1 }}>
                      <b>{s.student_name}</b>{s.note ? <> — {s.note}</> : s.ok ? <> — талапқа сай!</> : null}
                    </div>
                    {canEdit && (
                      <button onClick={() => handleDeleteStudent(s.id)}
                        style={{ border: 'none', background: 'none', color: 'var(--text-muted)', cursor: 'pointer', flexShrink: 0 }}>
                        <IconClose style={{ width: 12, height: 12 }} />
                      </button>
                    )}
                  </div>
                ))}
                {canEdit && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                    <input value={studentName} onChange={(e) => setStudentName(e.target.value)} placeholder="Оқушының аты"
                      style={{ padding: '7px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: 12.5 }} />
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5 }}>
                      <input type="checkbox" checked={studentOk} onChange={(e) => setStudentOk(e.target.checked)} /> Талапқа сай
                    </label>
                    {!studentOk && (
                      <input value={studentNote} onChange={(e) => setStudentNote(e.target.value)} placeholder="Мәселе (мыс: 10,15 есеп жазылмаған)"
                        style={{ padding: '7px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: 12.5 }} />
                    )}
                    <button onClick={handleAddStudent}
                      style={{ padding: '7px 12px', borderRadius: 7, border: 'none', background: 'var(--surface2)', color: 'var(--text)', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                      + Қосу
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
