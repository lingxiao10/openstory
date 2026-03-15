import { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { queryWork } from '../api/queryWork';
import { AuthContext } from '../store/authStore';
import { useI18n } from '../i18n';

interface Chapter {
  id: string;
  chapter_num: number;
  outline_zh: string;
  outline_en: string;
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
  const { t, lang } = useI18n();

  const [story, setStory] = useState<Story | null>(null);
  const [completed, setCompleted] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const fetchStory = isLoggedIn
      ? queryWork<Story>(`/api/stories/${id}`, { token })
          .catch(() => queryWork<Story>(`/api/stories/public/${id}`))
      : queryWork<Story>(`/api/stories/public/${id}`);

    Promise.all([
      fetchStory,
      isLoggedIn ? queryWork<string[]>('/api/progress', { token }) : Promise.resolve<string[]>([]),
    ]).then(([s, prog]) => {
      setStory(s);
      setCompleted(prog);
    }).catch(console.error)
      .finally(() => setLoading(false));
  }, [id, isLoggedIn]);

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
  // Only show background if there's a real English version (not same as zh)
  const background = lang === 'en'
    ? (story.background_en && story.background_en !== story.background_zh ? story.background_en : null)
    : story.background_zh;

  return (
    <div style={rootStyle}>
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '20px 20px 80px' }}>
        <button onClick={() => navigate('/')} style={backBtnStyle}>← {t('game_back')}</button>

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
            const locked = false; // TODO: restore locking: !ch.is_generated || (!prevDone && !isDone)

            return (
              <button
                key={ch.id}
                disabled={locked}
                onClick={() => !locked && navigate(`/stream-game/${id}?chapter=${ch.chapter_num}`, { state: { from: `/story/${id}` } })}
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
                    {t('reader_chapter').replace('{n}', String(ch.chapter_num))}
                  </div>
                  {(() => {
                    const outline = (lang === 'en' && ch.outline_en) ? ch.outline_en : ch.outline_zh;
                    if (!outline) return null;
                    return (
                      <div style={{ color: '#64748b', fontSize: 12 }}>
                        {outline.length > 30 ? outline.slice(0, 30) + '…' : outline}
                      </div>
                    );
                  })()}
                </div>
                <div style={{ fontSize: 18, flexShrink: 0, marginLeft: 12, color: '#ffffff' }}>
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
