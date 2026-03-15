import { useState, useEffect, useContext, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';

// ─── QuickPlay Modal ("边看边生成") ────────────────────────────────────────────
const QUICK_MODEL_OPTIONS = [
  { value: 'deepseek-v3-2-251201', label: 'DeepSeek V3', provider: 'ark' },
  { value: 'doubao-seed-1-8-251228', label: 'Doubao 1.8', provider: 'ark' },
  { value: 'google/gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro', provider: 'openrouter' },
  { value: 'google/gemini-3-flash-preview', label: 'Gemini 3 Flash', provider: 'openrouter' },
] as const;

const QUICK_LAST_KEY = 'quick_create_last';
interface QuickLast { title: string; bg: string; playerName: string; genre: 'mystery' | 'numeric'; chapterCount: number; aiModel: string; }

function QuickCreateModal({ lang, token, onClose }: {
  lang: string; token: string | null; onClose: () => void;
}) {
  const navigate = useNavigate();
  const { t: tq } = useI18n();
  const [title, setTitle] = useState('');
  const [bg, setBg] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [genre, setGenre] = useState<'mystery' | 'numeric'>('mystery');
  const [chapterCount, setChapterCount] = useState(2);
  const [aiModel, setAiModel] = useState('deepseek-v3-2-251201');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const lastFill: QuickLast | null = (() => { try { const s = localStorage.getItem(QUICK_LAST_KEY); return s ? JSON.parse(s) : null; } catch { return null; } })();

  const applyLast = () => {
    if (!lastFill) return;
    setTitle(lastFill.title);
    setBg(lastFill.bg);
    setPlayerName(lastFill.playerName);
    setGenre(lastFill.genre);
    setChapterCount(lastFill.chapterCount);
    setAiModel(lastFill.aiModel);
  };

  const handleStart = async () => {
    if (!title.trim() || !bg.trim() || !playerName.trim()) { setError(tq('quick_fieldRequired')); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/stream-game/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title: title.trim(), background: bg.trim(), genre, chapterCount, playerName: playerName.trim(), aiModel }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || tq('quick_createFailed'));
      localStorage.setItem(QUICK_LAST_KEY, JSON.stringify({ title: title.trim(), bg: bg.trim(), playerName: playerName.trim(), genre, chapterCount, aiModel }));
      navigate(`/stream-game/${data.storyId}`);
    } catch (e: any) {
      setError(e.message);
      setLoading(false);
    }
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: '#000c', zIndex: 1300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px 8px' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: '#0f172a', borderRadius: 20, border: '1px solid #334155', width: '100%', maxWidth: 520, padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 16 }}>
              {lang === 'zh' ? '⚡ 边看边生成' : '⚡ Play While Generating'}
            </div>
            <div style={{ color: '#475569', fontSize: 12, marginTop: 4 }}>
              {lang === 'zh' ? '生成大纲后立即可以开始游玩，无需等待' : 'Start playing right after outline generation'}
            </div>
          </div>
          <button onClick={onClose} disabled={loading} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: 22, cursor: 'pointer' }}>×</button>
        </div>

        {lastFill && (
          <button
            type="button"
            onClick={applyLast}
            disabled={loading}
            style={{ background: '#1e293b', border: '1px dashed #334155', borderRadius: 8, color: '#94a3b8', fontSize: 12, padding: '7px 12px', cursor: 'pointer', textAlign: 'left', lineHeight: 1.5 }}
          >
            ↩ {lang === 'zh' ? `上一次填写：${lastFill.title}` : `Last: ${lastFill.title}`}
          </button>
        )}

        {error && <div style={{ color: '#ef4444', fontSize: 12 }}>{error}</div>}

        <input
          placeholder={lang === 'zh' ? '故事标题（必填）' : 'Story title (required)'}
          value={title} onChange={e => setTitle(e.target.value)}
          disabled={loading} style={qiStyle}
        />
        <textarea
          placeholder={lang === 'zh' ? '故事背景简介（必填）' : 'Background summary (required)'}
          value={bg} onChange={e => setBg(e.target.value)}
          disabled={loading} rows={3}
          style={{ ...qiStyle, resize: 'vertical', minHeight: 72 }}
        />
        <input
          placeholder={lang === 'zh' ? '玩家角色名字（必填）' : 'Player character name (required)'}
          value={playerName} onChange={e => setPlayerName(e.target.value)}
          disabled={loading} required style={qiStyle}
        />

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            value={genre} onChange={e => setGenre(e.target.value as any)}
            disabled={loading}
            style={{ ...qiStyle, width: 'auto', padding: '7px 10px', cursor: 'pointer' }}
          >
            <option value="mystery">{lang === 'zh' ? '推理解谜' : 'Mystery'}</option>
            <option value="numeric">{lang === 'zh' ? '数值冒险' : 'Numeric'}</option>
          </select>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: '#94a3b8', fontSize: 12 }}>
              {lang === 'zh' ? `${chapterCount} 章` : `${chapterCount} ch.`}
            </span>
            <input
              type="range" min={1} max={5} value={chapterCount}
              onChange={e => setChapterCount(Number(e.target.value))}
              disabled={loading} style={{ accentColor: '#22c55e', width: 90 }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {QUICK_MODEL_OPTIONS.map(opt => (
            <button
              key={opt.value} type="button"
              onClick={() => setAiModel(opt.value)}
              disabled={loading}
              style={{
                background: aiModel === opt.value ? (opt.provider === 'openrouter' ? '#7c3aed22' : '#1e293b') : 'transparent',
                border: aiModel === opt.value ? `1px solid ${opt.provider === 'openrouter' ? '#7c3aed' : '#6366f1'}` : '1px solid #334155',
                color: aiModel === opt.value ? (opt.provider === 'openrouter' ? '#a78bfa' : '#818cf8') : '#475569',
                borderRadius: 8, padding: '4px 10px', fontSize: 11, cursor: 'pointer',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <button
          onClick={handleStart}
          disabled={loading || !title.trim() || !bg.trim() || !playerName.trim()}
          style={{
            background: loading ? '#1e293b' : 'linear-gradient(135deg, #22c55e, #16a34a)',
            color: '#fff', border: 'none', borderRadius: 12, padding: '14px 0',
            fontSize: 15, fontWeight: 700, cursor: loading ? 'default' : 'pointer',
            opacity: (!title.trim() || !bg.trim()) ? 0.4 : 1,
            transition: 'all .2s',
          }}
        >
          {loading
            ? (lang === 'zh' ? '⏳ 即将进入游戏，预计需要3-5秒…' : '⏳ Entering game, please wait…')
            : (lang === 'zh' ? '⚡ 立即开始玩' : '⚡ Start Playing Now')}
        </button>
      </div>
    </div>
  );
}

const qiStyle: CSSProperties = {
  background: '#1e293b', border: '1px solid #334155', borderRadius: 10,
  color: '#e2e8f0', padding: '10px 12px', fontSize: 13, outline: 'none', width: '100%',
  boxSizing: 'border-box',
};


function useIsMobile() {
  const [mobile, setMobile] = useState(() => window.innerWidth < 600);
  useEffect(() => {
    const h = () => setMobile(window.innerWidth < 600);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);
  return mobile;
}

import { Layout } from '../components/Layout';
import { AuthContext } from '../store/authStore';
import { queryWork } from '../api/queryWork';
import { useI18n } from '../i18n';
import { translations } from '../i18n/translations';

interface Chapter {
  id: string;
  chapter_num: number;
  outline_zh: string;
  outline_en?: string;
  content_zh: string;
  content_en: string;
  is_generated: boolean;
  generating_at: string | null;
  published: boolean;
}

interface Story {
  id: string;
  title_zh: string;
  title_en: string;
  background_zh: string;
  background_en: string;
  genre: string;
  status: string;
  chapters: Chapter[];
}


export function MyStories() {
  const { token, isLoggedIn, user } = useContext(AuthContext);
  const navigate = useNavigate();
  const { t, lang } = useI18n();

  const [stories, setStories] = useState<Story[]>([]);
  const [showQuickCreate, setShowQuickCreate] = useState(false);

  useEffect(() => {
    if (!isLoggedIn) { navigate('/login'); return; }
    load();
    const params = new URLSearchParams(window.location.search);
    if (params.get('quick') === '1') {
      setShowQuickCreate(true);
      window.history.replaceState({}, '', '/my-stories');
    }
  }, [isLoggedIn]);

  const load = async () => {
    try {
      const data = await queryWork<Story[]>('/api/stories', { token });
      setStories(data);
    } catch { /* ignore */ }
  };

  return (
    <Layout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <h2 style={{ color: '#e2e8f0', margin: 0, fontSize: 24, fontWeight: 800 }}>{t('story_center')}</h2>
        <button
          onClick={() => setShowQuickCreate(true)}
          style={{ ...btnStyle, background: '#052e16', border: '1px solid #22c55e55', color: '#4ade80', fontSize: 12 }}
        >
          {lang === 'zh' ? '⚡ 边看边生成' : '⚡ Play While Gen'}
        </button>
      </div>

      {showQuickCreate && (
        <QuickCreateModal lang={lang} token={token} onClose={() => setShowQuickCreate(false)} />
      )}

      {stories.length === 0 ? (
        <p style={{ color: '#64748b', textAlign: 'center', padding: 60 }}>{t('story_noStories')}</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {stories.map(story => (
            <StoryCard key={story.id} story={story} token={token} onRefresh={load} />
          ))}
        </div>
      )}

      {user?.isAdmin && (
        <div style={{ marginTop: 40, paddingTop: 24, borderTop: '1px solid #1e293b', display: 'flex', gap: 12 }}>
          <a href="/admin" style={{ background: '#f59e0b22', color: '#f59e0b', border: '1px solid #f59e0b44', borderRadius: 8, padding: '8px 18px', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
            {t('nav_admin')}
          </a>
          <a href="/stats" style={{ background: '#22c55e22', color: '#22c55e', border: '1px solid #22c55e44', borderRadius: 8, padding: '8px 18px', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
            {t('nav_stats')}
          </a>
        </div>
      )}
    </Layout>
  );
}
function StoryCard({ story, token, onRefresh }: { story: Story; token: string | null; onRefresh: () => void }) {
  const { t, lang } = useI18n();
  const isMobile = useIsMobile();
  const [expanded, setExpanded] = useState(false);
  const [err, setErr] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const publishedCount = story.chapters.filter(c => c.published).length;

  const deleteStory = async () => {
    setDeleting(true);
    try {
      await queryWork(`/api/stories/${story.id}`, { method: 'DELETE', token });
      setShowDeleteModal(false);
      onRefresh();
    } catch (e: any) { setErr(e.message); }
    finally { setDeleting(false); }
  };

  const deleteChapter = async (ch: Chapter) => {
    if (!confirm(lang === 'zh' ? `确定删除第${ch.chapter_num}章？` : `Delete chapter ${ch.chapter_num}?`)) return;
    try {
      await queryWork(`/api/stories/${story.id}/chapters/${ch.id}`, { method: 'DELETE', token });
      onRefresh();
    } catch (e: any) { setErr(e.message); }
  };

  const publish = async (ch: Chapter) => {
    try {
      await queryWork(`/api/stories/${story.id}/chapters/${ch.id}/publish`, { method: 'POST', token });
      onRefresh();
    } catch (e: any) {
      const key = e.code ? `err_${e.code}` : null;
      setErr(key && key in translations ? t(key as any) : e.message);
    }
  };

  const unpublish = async (ch: Chapter) => {
    try {
      await queryWork(`/api/stories/${story.id}/chapters/${ch.id}/unpublish`, { method: 'POST', token });
      onRefresh();
    } catch (e: any) { setErr(e.message); }
  };

  return (
    <div style={{ background: '#1e293b', borderRadius: 16, border: '1px solid #334155', overflow: 'hidden' }}>
      {showDeleteModal && (
        <div
          onClick={() => !deleting && setShowDeleteModal(false)}
          style={{ position: 'fixed', inset: 0, background: '#000b', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: '#1e293b', borderRadius: 20, padding: '28px 24px', maxWidth: 360, width: '100%', border: '1px solid #ef4444', textAlign: 'center' }}
          >
            <div style={{ fontSize: 36, marginBottom: 10 }}>🗑️</div>
            <h3 style={{ color: '#e2e8f0', marginBottom: 10, fontSize: 17 }}>
              {lang === 'zh' ? '删除故事' : 'Delete Story'}
            </h3>
            <p style={{ color: '#94a3b8', fontSize: 13, lineHeight: 1.7, marginBottom: 8 }}>
              {lang === 'zh' ? `确定删除《${story.title_zh}》吗？此操作不可撤销。` : `Delete "${story.title_en || story.title_zh}"? This cannot be undone.`}
            </p>
            {publishedCount > 0 && (
              <p style={{ color: '#fbbf24', fontSize: 12, lineHeight: 1.6, background: '#f59e0b11', border: '1px solid #f59e0b33', borderRadius: 8, padding: '8px 12px', marginBottom: 8 }}>
                {lang === 'zh'
                  ? `该故事有 ${publishedCount} 章已发布，删除后将自动全部下架。`
                  : `This story has ${publishedCount} published chapter(s). They will be unpublished automatically.`}
              </p>
            )}
            {err && <p style={{ color: '#ef4444', fontSize: 12, marginBottom: 8 }}>{err}</p>}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 16 }}>
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
                style={{ background: '#334155', color: '#94a3b8', border: 'none', borderRadius: 8, padding: '9px 22px', fontSize: 13, cursor: 'pointer' }}
              >
                {lang === 'zh' ? '取消' : 'Cancel'}
              </button>
              <button
                onClick={deleteStory}
                disabled={deleting}
                style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 22px', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: deleting ? 0.6 : 1 }}
              >
                {deleting ? (lang === 'zh' ? '删除中...' : 'Deleting...') : (lang === 'zh' ? '确认删除' : 'Delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      <div
        style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
        onClick={() => setExpanded(!expanded)}
      >
        <div>
          <h3 style={{ color: '#e2e8f0', margin: 0, fontSize: 16, fontWeight: 700 }}>{lang === 'en' ? (story.title_en || story.title_zh) : story.title_zh}</h3>
          <span style={{ color: '#64748b', fontSize: 12 }}>
            {t(story.genre === 'mystery' ? 'story_mystery' : 'story_numeric')} · {story.chapters.length} {t('reader_chapters')} · {publishedCount > 0 ? `${publishedCount} ${t('story_published')}` : t('story_status_draft')}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={e => { e.stopPropagation(); setErr(''); setShowDeleteModal(true); }}
            style={{ background: '#ef444422', color: '#ef4444', border: '1px solid #ef444433', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}
          >
            {lang === 'zh' ? '删除' : 'Delete'}
          </button>
          <span style={{ color: '#64748b' }}>{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {expanded && (
        <div style={{ padding: '0 20px 20px', borderTop: '1px solid #334155' }}>
          {story.background_zh && (
            <p style={{ color: '#64748b', fontSize: 12, margin: '12px 0 0', fontStyle: 'italic' }}>
              {lang === 'zh' ? story.background_zh : (story.background_en || story.background_zh)}
            </p>
          )}

          {err && <div style={{ color: '#ef4444', fontSize: 12, marginTop: 8 }}>{err}</div>}

          {/* Chapter list */}
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {(() => {
              const publishedNums = story.chapters.filter(c => c.published).map(c => c.chapter_num);
              const lastPublishedNum = publishedNums.length > 0 ? Math.max(...publishedNums) : -1;
              return story.chapters.map((ch) => {
                return (
                  <ChapterRow
                    key={ch.id} ch={ch} lang={lang} storyId={story.id} token={token}
                    isLastPublished={!!ch.published && ch.chapter_num === lastPublishedNum}
                    onDelete={() => deleteChapter(ch)}
                    onPublish={() => publish(ch)}
                    onUnpublish={() => unpublish(ch)}
                    onRefresh={onRefresh}
                    t={t}
                  />
                );
              });
            })()}
          </div>

        </div>
      )}
    </div>
  );
}

function ChapterRow({ ch, lang, storyId, token, isLastPublished, onDelete, onPublish, onUnpublish, onRefresh, t }: any) {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [editing, setEditing] = useState(false);
  const [editVal, setEditVal] = useState('');
  const [saving, setSaving] = useState(false);

  const startEdit = () => { setEditVal(ch.outline_zh); setEditing(true); };
  const cancelEdit = () => setEditing(false);
  const saveEdit = async () => {
    if (!editVal.trim()) return;
    setSaving(true);
    try {
      await queryWork(`/api/stories/${storyId}/chapters/${ch.id}`, { method: 'PATCH', body: { outline: editVal }, token });
      setEditing(false);
      onRefresh();
    } catch (e: any) { alert(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ background: '#0f172a', borderRadius: 10, padding: '12px 14px' }}>
      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ color: '#6366f1', fontSize: 12, fontWeight: 700 }}>{t('reader_chapter').replace('{n}', String(ch.chapter_num))}</span>
            {!!ch.published && (
              <span style={{ background: '#22c55e22', color: '#86efac', fontSize: 11, padding: '1px 7px', borderRadius: 10 }}>
                {t('story_published')}
              </span>
            )}
          </div>
          {editing ? (
            <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
              <input
                value={editVal} onChange={e => setEditVal(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit(); }}
                autoFocus
                style={{ ...inputStyle, flex: 1, fontSize: 12, padding: '5px 10px' }}
              />
              <button onClick={saveEdit} disabled={saving} style={smallBtn('#22c55e')}>
                {saving ? '...' : (lang === 'zh' ? '保存' : 'Save')}
              </button>
              <button onClick={cancelEdit} style={smallBtn('#64748b')}>
                {lang === 'zh' ? '取消' : 'Cancel'}
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <p style={{ color: '#94a3b8', fontSize: 12, margin: 0 }}>{lang === 'en' ? (ch.outline_en || ch.outline_zh) : ch.outline_zh}</p>
              {!ch.published && (
                <button onClick={startEdit} style={{ background: 'none', border: 'none', color: '#475569', fontSize: 11, cursor: 'pointer', padding: '0 2px', lineHeight: 1 }}>✏️</button>
              )}
            </div>
          )}
          <button
              onClick={() => navigate(`/stream-game/${storyId}?chapter=${ch.chapter_num}`)}
              style={{ background: 'none', border: '1px solid #6366f144', borderRadius: 6, color: '#a5b4fc', fontSize: 12, padding: '3px 10px', marginTop: 6, cursor: 'pointer' }}
            >
              ▶ {lang === 'zh' ? '试玩' : 'Play'}
            </button>
        </div>

        <div style={{ display: 'flex', gap: 6, flexShrink: 0, flexWrap: 'wrap', justifyContent: isMobile ? 'flex-start' : 'flex-end', marginTop: isMobile ? 10 : 0, width: isMobile ? '100%' : 'auto' }}>
          {!ch.published && (
            <>
              <button onClick={onPublish} style={smallBtn('#22c55e')}>{t('story_publish')}</button>
              <button onClick={onDelete} style={smallBtn('#ef4444')}>{t('story_delete')}</button>
            </>
          )}
          {isLastPublished && (
            <button onClick={onUnpublish} style={smallBtn('#f59e0b')}>
              {lang === 'zh' ? '取消发布' : 'Unpublish'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  background: '#0f172a', border: '1px solid #334155', borderRadius: 8, padding: '10px 14px',
  color: '#e2e8f0', fontSize: 14, outline: 'none', width: '100%', boxSizing: 'border-box',
};
const btnStyle: React.CSSProperties = {
  background: '#6366f1', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 18px',
  fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
};
const smallBtn = (color: string): React.CSSProperties => ({
  background: `${color}22`, color, border: `1px solid ${color}44`,
  borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer', fontWeight: 600,
});
