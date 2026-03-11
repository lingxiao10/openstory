import { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { queryWork } from '../api/queryWork';
import { AuthContext } from '../store/authStore';
import { useI18n } from '../i18n';

interface Chapter {
  id: string;
  chapter_num: number;
  outline_zh: string;
  content_zh: string;
  content_en: string;
  is_generated: boolean;
  published: boolean;
}

interface Story {
  id: string;
  title_zh: string;
  title_en: string;
  background_zh: string;
  background_en: string;
  genre: string;
  chapters: Chapter[];
}

export function StoryReader() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { token, isLoggedIn } = useContext(AuthContext);
  const { t, tf, lang } = useI18n();

  const [story, setStory] = useState<Story | null>(null);
  const [completed, setCompleted] = useState<string[]>([]);
  const [activeChapter, setActiveChapter] = useState<Chapter | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      queryWork<Story>(`/api/stories/public/${id}`),
      isLoggedIn ? queryWork<string[]>('/api/progress', { token }) : Promise.resolve<string[]>([]),
    ]).then(([s, prog]) => {
      setStory(s);
      setCompleted(prog);
    }).catch(console.error)
      .finally(() => setLoading(false));
  }, [id, isLoggedIn]);

  const completeChapter = async (ch: Chapter) => {
    if (!isLoggedIn) { navigate('/login'); return; }
    try {
      await queryWork(`/api/progress/${ch.id}/complete`, { method: 'POST', token });
      setCompleted(prev => [...prev, ch.id]);
      setActiveChapter(null);
    } catch (e: any) { console.error(e); }
  };

  if (loading) return (
    <div style={rootStyle}>
      <div style={{ textAlign: 'center', color: '#64748b', padding: 80 }}>{t('common_loading')}</div>
    </div>
  );

  if (!story) return (
    <div style={rootStyle}>
      <div style={{ textAlign: 'center', color: '#ef4444', padding: 80 }}>{t('game_error')}</div>
    </div>
  );

  const title = lang === 'en' && story.title_en ? story.title_en : story.title_zh;
  const background = lang === 'en' && story.background_en ? story.background_en : story.background_zh;

  // Reading view
  if (activeChapter) {
    const content = lang === 'en' && activeChapter.content_en ? activeChapter.content_en : activeChapter.content_zh;
    const isDone = completed.includes(activeChapter.id);
    return (
      <div style={rootStyle}>
        <div style={{ maxWidth: 680, margin: '0 auto', padding: '20px 20px 80px' }}>
          <button onClick={() => setActiveChapter(null)} style={backBtnStyle}>← {t('game_back')}</button>
          <div style={{ textAlign: 'center', color: '#6366f1', fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 24 }}>
            {title} · 第{activeChapter.chapter_num}章
          </div>
          <div style={{ color: '#94a3b8', fontSize: 13, fontStyle: 'italic', textAlign: 'center', marginBottom: 28 }}>
            {activeChapter.outline_zh}
          </div>
          <div style={{ color: '#e2e8f0', fontSize: 16, lineHeight: 2, whiteSpace: 'pre-wrap', fontFamily: 'Georgia, serif' }}>
            {content}
          </div>
          <div style={{ marginTop: 48, textAlign: 'center' }}>
            {isDone ? (
              <div style={{ color: '#22c55e', fontSize: 15 }}>✓ {t('reader_done')}</div>
            ) : (
              <button onClick={() => completeChapter(activeChapter)} style={completeBtnStyle}>
                {t('reader_complete')}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Chapter selection view
  return (
    <div style={rootStyle}>
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '20px 20px 80px' }}>
        <button onClick={() => navigate(-1)} style={backBtnStyle}>← {t('game_back')}</button>

        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <h1 style={{ color: '#e2e8f0', fontSize: 24, fontWeight: 800, margin: '0 0 8px' }}>{title}</h1>
          {background && <p style={{ color: '#64748b', fontSize: 14, margin: 0 }}>{background}</p>}
        </div>

        <p style={{ color: '#6366f1', fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', textAlign: 'center', marginBottom: 20 }}>
          {t('reader_select')}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {story.chapters.map((ch, i) => {
            const isDone = completed.includes(ch.id);
            const prevDone = i === 0 || completed.includes(story.chapters[i - 1].id);
            const locked = !prevDone && !isDone;

            return (
              <button
                key={ch.id}
                disabled={locked}
                onClick={() => !locked && setActiveChapter(ch)}
                style={{
                  background: locked ? '#0f172a' : isDone ? '#16a34a11' : '#1e293b',
                  border: `1px solid ${locked ? '#1e293b' : isDone ? '#22c55e44' : '#334155'}`,
                  borderRadius: 12, padding: '16px 20px',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  cursor: locked ? 'not-allowed' : 'pointer', textAlign: 'left',
                  opacity: locked ? 0.5 : 1, transition: 'all 0.2s',
                }}
              >
                <div>
                  <div style={{ color: locked ? '#475569' : isDone ? '#86efac' : '#e2e8f0', fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
                    第 {ch.chapter_num} 章
                  </div>
                  <div style={{ color: '#64748b', fontSize: 12 }}>{ch.outline_zh}</div>
                </div>
                <div style={{ fontSize: 18, flexShrink: 0, marginLeft: 12 }}>
                  {locked ? '🔒' : isDone ? '✓' : '▶'}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const rootStyle: React.CSSProperties = {
  minHeight: '100vh',
  background: '#0f172a',
  color: '#e2e8f0',
};
const backBtnStyle: React.CSSProperties = {
  background: 'none', border: 'none', color: '#6366f1',
  cursor: 'pointer', fontSize: 14, padding: '0 0 20px', display: 'block',
};
const completeBtnStyle: React.CSSProperties = {
  background: '#6366f1', color: '#fff', border: 'none', borderRadius: 12,
  padding: '14px 40px', fontSize: 16, fontWeight: 700, cursor: 'pointer',
};
