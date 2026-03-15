import { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { queryWork } from '../api/queryWork';
import { AuthContext } from '../store/authStore';
import { useI18n } from '../i18n';
import { MysteryEngine } from '../games/mystery/MysteryEngine';
import { MysteryCardEngine } from '../games/mystery/MysteryCardEngine';
import { NumericEngine } from '../games/numeric/NumericEngine';

interface Chapter {
  id: string;
  chapter_num: number;
  outline_zh: string;
  outline_en: string;
  content_zh: string;
  content_en: string;
  content_json: string | null;
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
  const [searchParams] = useSearchParams();
  const { token, isLoggedIn } = useContext(AuthContext);
  const { t, lang } = useI18n();

  const [story, setStory] = useState<Story | null>(null);
  const [completed, setCompleted] = useState<string[]>([]);
  const [activeChapter, setActiveChapter] = useState<Chapter | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    if (!id) return;
    const fetchStory = isLoggedIn
      ? queryWork<Story>(`/api/stories/${id}`, { token }).then(s => { setIsOwner(true); return s; })
          .catch(() => queryWork<Story>(`/api/stories/public/${id}`))
      : queryWork<Story>(`/api/stories/public/${id}`);

    Promise.all([
      fetchStory,
      isLoggedIn ? queryWork<string[]>('/api/progress', { token }) : Promise.resolve<string[]>([]),
    ]).then(([s, prog]) => {
      setStory(s);
      setCompleted(prog);
      const chId = searchParams.get('ch');
      if (chId) {
        const target = s.chapters.find((c: Chapter) => c.id === chId);
        if (target) setActiveChapter(target);
      }
    }).catch(console.error)
      .finally(() => setLoading(false));
  }, [id, isLoggedIn]);

  const completeChapter = async (ch: Chapter) => {
    if (isOwner) { setActiveChapter(null); return; }
    if (!isLoggedIn) { navigate('/login'); return; }
    try {
      await queryWork(`/api/progress/${ch.id}/complete`, { method: 'POST', token });
      setCompleted(prev => [...prev, ch.id]);
      setActiveChapter(null);
    } catch (e: any) { console.error(e); }
  };

  const startReading = async (ch: Chapter) => {
    setActiveChapter(ch);
    if (isLoggedIn && token) {
      try {
        await queryWork('/api/reads/record', { method: 'POST', token, body: { chapterId: ch.id } });
      } catch (e: any) { console.error('[recordRead]', e); }
    }
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

  // Interactive chapter view
  if (activeChapter) {
    const isDone = completed.includes(activeChapter.id);

    // Has interactive JSON → use game engine
    if (activeChapter.content_json) {
      let gameData: any = null;
      try {
        const parsed = JSON.parse(activeChapter.content_json);
        if (story.genre === 'numeric') {
          if (parsed && Array.isArray(parsed.cards) && parsed.cards.length > 0) gameData = parsed;
        } else {
          if (Array.isArray(parsed) && parsed.length > 0) gameData = { cards: parsed };
        }
      } catch { /* ignore */ }

      if (gameData) {
        // Card theme: MysteryCardEngine is fully self-contained with back button
        if (story.genre === 'mystery') {
          return (
            <MysteryCardEngine
              gameData={gameData}
              onVictory={isDone ? undefined : () => completeChapter(activeChapter)}
              onBack={() => setActiveChapter(null)}
            />
          );
        }

        return (
          <div style={rootStyle}>
            <div style={{ padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button onClick={() => setActiveChapter(null)} style={backBtnStyle}>← {t('game_back')}</button>
              {isDone && <span style={{ color: '#22c55e', fontSize: 13 }}>✓ {t('reader_done')}</span>}
            </div>
            {story.genre === 'mystery'
              ? <MysteryEngine
                  gameData={gameData}
                  onVictory={isDone ? undefined : () => completeChapter(activeChapter)}
                />
              : <NumericEngine
                  gameData={gameData}
                  onVictory={() => completeChapter(activeChapter)}
                  isLastChapter={activeChapter.chapter_num === story.chapters.length}
                />
            }
          </div>
        );
      }
    }

    // Fallback: plain text reader
    const content = lang === 'en' && activeChapter.content_en ? activeChapter.content_en : activeChapter.content_zh;
    return (
      <div style={rootStyle}>
        <div style={{ maxWidth: 680, margin: '0 auto', padding: '20px 20px 80px' }}>
          <button onClick={() => setActiveChapter(null)} style={backBtnStyle}>← {t('game_back')}</button>
          <div style={{ textAlign: 'center', color: '#6366f1', fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 24 }}>
            {title} · {t('reader_chapter').replace('{n}', String(activeChapter.chapter_num))}
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
            const locked = isOwner ? !ch.is_generated : (!prevDone && !isDone);

            return (
              <button
                key={ch.id}
                disabled={locked}
                onClick={() => !locked && startReading(ch)}
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
                  <div style={{ color: '#64748b', fontSize: 12 }}>
                    {(() => {
                      const outline = (lang === 'en' && ch.outline_en) ? ch.outline_en : ch.outline_zh;
                      return outline && outline.length > 30 ? outline.slice(0, 30) + '…' : outline;
                    })()}
                  </div>
                  {ch.content_json && (
                    <div style={{ color: '#6366f1', fontSize: 11, marginTop: 4 }}>{t('reader_interactive')}</div>
                  )}
                  {isOwner && !ch.published && (
                    <div style={{ color: '#f59e0b', fontSize: 11, marginTop: 2 }}>{t('reader_unpublished')}</div>
                  )}
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
const completeBtnStyle: React.CSSProperties = {
  background: '#6366f1', color: '#fff', border: 'none', borderRadius: 12,
  padding: '14px 40px', fontSize: 16, fontWeight: 700, cursor: 'pointer',
};
