import { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';

function GenModal({ lang, onOne, onAll, showAll, onClose }: {
  lang: string; onOne: () => void; onAll: () => void; showAll: boolean; onClose: () => void;
}) {
  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: '#000a', zIndex: 1000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: '#1e293b', borderRadius: '16px 16px 0 0', width: '100%', maxWidth: 480, padding: '20px 20px 36px', border: '1px solid #334155' }}
      >
        <div style={{ color: '#94a3b8', fontSize: 13, marginBottom: 16, textAlign: 'center' }}>
          {lang === 'zh' ? '选择生成方式' : 'Select generation mode'}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button onClick={() => { onOne(); onClose(); }} style={modalBtnStyle('#6366f1')}>
            {lang === 'zh' ? '仅生成本章' : 'This chapter only'}
          </button>
          {showAll && (
            <button onClick={() => { onAll(); onClose(); }} style={modalBtnStyle('#f59e0b')}>
              {lang === 'zh' ? '生成所有剩余章节' : 'Generate all remaining'}
            </button>
          )}
          <button onClick={onClose} style={modalBtnStyle('#475569')}>
            {lang === 'zh' ? '取消' : 'Cancel'}
          </button>
        </div>
      </div>
    </div>
  );
}
const modalBtnStyle = (color: string): React.CSSProperties => ({
  background: `${color}22`, color, border: `1px solid ${color}44`,
  borderRadius: 10, padding: '13px 0', fontSize: 14, fontWeight: 700,
  cursor: 'pointer', width: '100%',
});

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

const GENERATE_TIMEOUT_MS = 5 * 60 * 1000; // must match backend

function isChapterGenerating(ch: Chapter): boolean {
  if (!ch.generating_at) return false;
  return Date.now() - new Date(ch.generating_at).getTime() < GENERATE_TIMEOUT_MS;
}

interface Chapter {
  id: string;
  chapter_num: number;
  outline_zh: string;
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

const CHAPTER_COUNT_MIN = 1;
const CHAPTER_COUNT_MAX = 10;

export function MyStories() {
  const { token, isLoggedIn } = useContext(AuthContext);
  const navigate = useNavigate();
  const { t, lang } = useI18n();

  const [stories, setStories] = useState<Story[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [bg, setBg] = useState('');
  const [genre, setGenre] = useState<'mystery' | 'numeric'>('mystery');
  const [chapterCount, setChapterCount] = useState(3);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isLoggedIn) { navigate('/login'); return; }
    load();
  }, [isLoggedIn]);

  const load = async () => {
    try {
      const data = await queryWork<Story[]>('/api/stories', { token });
      setStories(data);
    } catch { /* ignore */ }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setCreating(true);
    try {
      await queryWork('/api/stories', {
        method: 'POST',
        body: { title, background: bg, genre, chapterCount },
        token,
      });
      setTitle(''); setBg(''); setChapterCount(3);
      setShowForm(false);
      load();
    } catch (err: any) { setError(err.message); }
    finally { setCreating(false); }
  };

  return (
    <Layout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <h2 style={{ color: '#e2e8f0', margin: 0, fontSize: 24, fontWeight: 800 }}>{t('story_center')}</h2>
        <button onClick={() => setShowForm(!showForm)} style={btnStyle}>
          {showForm ? '×' : `+ ${t('story_create')}`}
        </button>
      </div>

      {showForm && (
        <div style={{ background: '#1e293b', borderRadius: 16, padding: 24, marginBottom: 28, border: '1px solid #334155' }}>
          <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {error && <div style={{ color: '#ef4444', fontSize: 13 }}>{error}</div>}
            <input
              placeholder={lang === 'zh' ? '故事标题（中文或英文均可）' : 'Story title (any language)'}
              value={title} onChange={e => setTitle(e.target.value)} required style={inputStyle}
            />
            <input
              placeholder={lang === 'zh' ? '故事背景简介（必填，AI 自动翻译另一种语言）' : 'Background summary (required, AI auto-translates)'}
              value={bg} onChange={e => setBg(e.target.value)} required style={inputStyle}
            />
            <select value={genre} onChange={e => setGenre(e.target.value as any)} style={{ ...inputStyle, cursor: 'pointer' }}>
              <option value="mystery">{t('story_mystery')}</option>
              <option value="numeric">{t('story_numeric')}</option>
            </select>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <label style={{ color: '#94a3b8', fontSize: 13, whiteSpace: 'nowrap' }}>
                {t('story_chapterCount')}：{chapterCount} {lang === 'zh' ? '章' : 'ch.'}
              </label>
              <input
                type="range" min={CHAPTER_COUNT_MIN} max={CHAPTER_COUNT_MAX} value={chapterCount}
                onChange={e => setChapterCount(Number(e.target.value))}
                style={{ flex: 1, accentColor: '#6366f1' }}
              />
              <span style={{ color: '#64748b', fontSize: 12, whiteSpace: 'nowrap' }}>{CHAPTER_COUNT_MIN}–{CHAPTER_COUNT_MAX}</span>
            </div>
            <button type="submit" disabled={creating} style={btnStyle}>
              {creating ? t('story_generatingOutline') : t('story_create')}
            </button>
          </form>
        </div>
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
    </Layout>
  );
}
function StoryCard({ story, token, onRefresh }: { story: Story; token: string | null; onRefresh: () => void }) {
  const { t, lang } = useI18n();
  const isMobile = useIsMobile();
  const [expanded, setExpanded] = useState(false);
  const [outline, setOutline] = useState('');
  const [generating, setGenerating] = useState<string | null>(null);
  const [queuedIds, setQueuedIds] = useState<string[]>([]);
  const [addingChapter, setAddingChapter] = useState(false);
  const [err, setErr] = useState('');
  const [toast, setToast] = useState(false);
  const [showQuotaModal, setShowQuotaModal] = useState(false);

  const showToast = () => {
    setToast(true);
    setTimeout(() => setToast(false), 5000);
  };

  const publishedCount = story.chapters.filter(c => c.published).length;
  // anyBusy: local session OR any chapter still marked generating in DB
  const anyBusy = !!generating || addingChapter || story.chapters.some(isChapterGenerating);

  const addChapter = async () => {
    if (!outline.trim() || anyBusy) return;
    setErr('');
    setAddingChapter(true);
    try {
      await queryWork(`/api/stories/${story.id}/chapters`, { method: 'POST', body: { outline }, token });
      setOutline('');
      onRefresh();
    } catch (e: any) { setErr(e.message); }
    finally { setAddingChapter(false); }
  };

  const pollUntilDone = (chId: string): Promise<void> =>
    new Promise((resolve, reject) => {
      const poll = setInterval(async () => {
        try {
          const s = await queryWork<Story>(`/api/stories/${story.id}`, { token });
          const updated = s.chapters.find(c => c.id === chId);
          // generating_at null = backend cleared it (success or failure)
          if (!updated?.generating_at) {
            clearInterval(poll);
            onRefresh();
            resolve();
          }
        } catch (e) { clearInterval(poll); reject(e); }
      }, 2000);
    });

  // Auto-resume polling after page refresh if a chapter is still generating in DB
  useEffect(() => {
    if (generating) return; // already tracking locally
    const active = story.chapters.find(isChapterGenerating);
    if (!active) return;
    setGenerating(active.id);
    pollUntilDone(active.id).finally(() => setGenerating(null));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story.id]);

  const generate = async (ch: Chapter) => {
    setGenerating(ch.id);
    setQueuedIds([]);
    showToast();
    try {
      await queryWork(`/api/generate/${story.id}/${ch.id}`, { method: 'POST', token });
      await pollUntilDone(ch.id);
    } catch (e: any) {
      if (e.code === 'QUOTA_EXCEEDED' || e.message?.includes('QUOTA_EXCEEDED') || e.status === 429) {
        setShowQuotaModal(true);
      } else {
        setErr(e.message);
      }
    }
    finally { setGenerating(null); }
  };

  const generateAll = async (startCh: Chapter) => {
    const toGenerate = story.chapters.filter(
      c => c.chapter_num >= startCh.chapter_num && !c.published && !c.is_generated
    );
    if (toGenerate.length === 0) return;
    setQueuedIds(toGenerate.slice(1).map(c => c.id));
    showToast();
    for (const ch of toGenerate) {
      setGenerating(ch.id);
      setQueuedIds(prev => prev.filter(id => id !== ch.id));
      try {
        await queryWork(`/api/generate/${story.id}/${ch.id}`, { method: 'POST', token });
        await pollUntilDone(ch.id);
      } catch (e: any) {
        if (e.code === 'QUOTA_EXCEEDED' || e.message?.includes('QUOTA_EXCEEDED') || e.status === 429) {
          setShowQuotaModal(true);
        } else {
          setErr(e.message);
        }
        break;
      }
    }
    setGenerating(null);
    setQueuedIds([]);
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
    } catch (e: any) { setErr(e.message); }
  };

  const unpublish = async (ch: Chapter) => {
    try {
      await queryWork(`/api/stories/${story.id}/chapters/${ch.id}/unpublish`, { method: 'POST', token });
      onRefresh();
    } catch (e: any) { setErr(e.message); }
  };

  return (
    <div style={{ background: '#1e293b', borderRadius: 16, border: '1px solid #334155', overflow: 'hidden' }}>
      {toast && (
        <div style={{
          position: 'fixed', bottom: 32, left: '50%', transform: 'translateX(-50%)',
          background: '#16a34a', borderRadius: 12,
          padding: '13px 28px', color: '#fff', fontSize: 15, fontWeight: 700,
          zIndex: 9999, boxShadow: '0 4px 32px #16a34a88', whiteSpace: 'nowrap',
          letterSpacing: 0.5,
        }}>
          ⚡ {lang === 'zh' ? '生成中...离开本页面将会在云端继续生成' : 'Generating... It will continue in the cloud if you leave.'}
        </div>
      )}

      {showQuotaModal && (
        <div
          onClick={() => setShowQuotaModal(false)}
          style={{ position: 'fixed', inset: 0, background: '#000b', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: '#1e293b', borderRadius: 20, padding: '32px 28px', maxWidth: 360, width: '100%', border: '1px solid #6366f1', textAlign: 'center' }}
          >
            <div style={{ fontSize: 40, marginBottom: 12 }}>⚡</div>
            <h3 style={{ color: '#e2e8f0', marginBottom: 12, fontSize: 18 }}>
              {lang === 'zh' ? '今日生成次数已用完' : 'Daily generation limit reached'}
            </h3>
            <p style={{ color: '#94a3b8', fontSize: 14, lineHeight: 1.7, marginBottom: 20 }}>
              {lang === 'zh'
                ? '您今日的章节生成次数已达上限。如需更多额度，请添加开发者微信联系开通：'
                : 'You have reached today\'s generation limit. Contact the developer on WeChat to get more quota:'}
            </p>
            <div style={{ background: '#0f172a', borderRadius: 12, padding: '14px 20px', marginBottom: 20, border: '1px solid #334155' }}>
              <div style={{ color: '#64748b', fontSize: 12, marginBottom: 4 }}>WeChat / 微信</div>
              <div style={{ color: '#6366f1', fontSize: 22, fontWeight: 800, letterSpacing: 2 }}>linginlove</div>
            </div>
            <button
              onClick={() => setShowQuotaModal(false)}
              style={{ background: '#6366f1', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 32px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
            >
              {lang === 'zh' ? '我知道了' : 'Got it'}
            </button>
          </div>
        </div>
      )}
      <div
        style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
        onClick={() => setExpanded(!expanded)}
      >
        <div>
          <h3 style={{ color: '#e2e8f0', margin: 0, fontSize: 16, fontWeight: 700 }}>{story.title_zh}</h3>
          <span style={{ color: '#64748b', fontSize: 12 }}>
            {t(story.genre === 'mystery' ? 'story_mystery' : 'story_numeric')} · {story.chapters.length} 章 · {publishedCount > 0 ? `${publishedCount} 章已发布` : t('story_status_draft')}
          </span>
        </div>
        <span style={{ color: '#64748b' }}>{expanded ? '▲' : '▼'}</span>
      </div>

      {expanded && (
        <div style={{ padding: '0 20px 20px', borderTop: '1px solid #334155' }}>
          {story.background_zh && (
            <p style={{ color: '#64748b', fontSize: 12, margin: '12px 0 0', fontStyle: 'italic' }}>
              {lang === 'zh' ? story.background_zh : story.background_en || story.background_zh}
            </p>
          )}

          {err && <div style={{ color: '#ef4444', fontSize: 12, marginTop: 8 }}>{err}</div>}

          {/* Chapter list */}
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {(() => {
              const publishedNums = story.chapters.filter(c => c.published).map(c => c.chapter_num);
              const lastPublishedNum = publishedNums.length > 0 ? Math.max(...publishedNums) : -1;
              return story.chapters.map((ch, idx) => {
                const prevGenerated = idx === 0 || !!story.chapters[idx - 1].is_generated;
                return (
                  <ChapterRow
                    key={ch.id} ch={ch} lang={lang} storyId={story.id} token={token}
                    generating={generating === ch.id || isChapterGenerating(ch)}
                    inQueue={queuedIds.includes(ch.id)}
                    anyBusy={anyBusy}
                    prevGenerated={prevGenerated}
                    isLastPublished={!!ch.published && ch.chapter_num === lastPublishedNum}
                    onGenerate={() => generate(ch)}
                    onGenerateAll={() => generateAll(ch)}
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

          {/* Add chapter */}
          <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 8, marginTop: 16 }}>
            <input
              placeholder={t('story_outline')} value={outline}
              onChange={e => setOutline(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addChapter()}
              disabled={anyBusy}
              style={{ ...inputStyle, flex: 1, opacity: anyBusy ? 0.5 : 1 }}
            />
            <button onClick={addChapter} disabled={anyBusy} style={{ ...btnStyle, opacity: anyBusy ? 0.5 : 1, width: isMobile ? '100%' : 'auto' }}>
              {addingChapter ? (lang === 'zh' ? 'AI翻译中...' : 'Translating...') : t('story_addChapter')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ChapterRow({ ch, lang, storyId, token, generating, inQueue, anyBusy, prevGenerated, isLastPublished, onGenerate, onGenerateAll, onDelete, onPublish, onUnpublish, onRefresh, t }: any) {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [editing, setEditing] = useState(false);
  const [editVal, setEditVal] = useState('');
  const [saving, setSaving] = useState(false);
  const [showGenModal, setShowGenModal] = useState(false);

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
            <span style={{ color: '#6366f1', fontSize: 12, fontWeight: 700 }}>第 {ch.chapter_num} 章</span>
            {!!ch.published && (
              <span style={{ background: '#22c55e22', color: '#86efac', fontSize: 11, padding: '1px 7px', borderRadius: 10 }}>
                {t('story_published')}
              </span>
            )}
            {!!ch.is_generated && !ch.published && (
              <span style={{ background: '#6366f122', color: '#a5b4fc', fontSize: 11, padding: '1px 7px', borderRadius: 10 }}>
                {lang === 'zh' ? '已生成' : 'Generated'}
              </span>
            )}
            {inQueue && (
              <span style={{ background: '#f59e0b22', color: '#fbbf24', fontSize: 11, padding: '1px 7px', borderRadius: 10 }}>
                {lang === 'zh' ? '排队中' : 'Queued'}
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
              <p style={{ color: '#94a3b8', fontSize: 12, margin: 0 }}>{ch.outline_zh}</p>
              {!ch.published && (
                <button onClick={startEdit} style={{ background: 'none', border: 'none', color: '#475569', fontSize: 11, cursor: 'pointer', padding: '0 2px', lineHeight: 1 }}>✏️</button>
              )}
            </div>
          )}
          {!!ch.is_generated && (
            <button
              onClick={() => navigate(`/story/${storyId}?ch=${ch.id}`)}
              style={{ background: 'none', border: '1px solid #6366f144', borderRadius: 6, color: '#a5b4fc', fontSize: 12, padding: '3px 10px', marginTop: 6, cursor: 'pointer' }}
            >
              ▶ {lang === 'zh' ? '试玩' : 'Play'}
            </button>
          )}
        </div>

        <div style={{ display: 'flex', gap: 6, flexShrink: 0, flexWrap: 'wrap', justifyContent: isMobile ? 'flex-start' : 'flex-end', marginTop: isMobile ? 10 : 0, width: isMobile ? '100%' : 'auto' }}>
          {!ch.published && (
            <>
              {generating ? (
                <button disabled style={{ ...smallBtn('#22c55e'), fontWeight: 700 }}>
                  ⚡ {lang === 'zh' ? '生成中...' : 'Generating...'}
                </button>
              ) : (
                <>
                  <button
                    onClick={() => { if (!anyBusy && prevGenerated) setShowGenModal(true); }}
                    disabled={anyBusy || !prevGenerated}
                    title={!prevGenerated ? (lang === 'zh' ? '请先生成上一章' : 'Generate previous chapter first') : undefined}
                    style={smallBtn(!prevGenerated || anyBusy ? '#475569' : '#6366f1')}
                  >
                    {ch.is_generated ? t('story_regenerate') : t('story_generate')}
                  </button>
                  {showGenModal && (
                    <GenModal
                      lang={lang}
                      onOne={onGenerate}
                      onAll={onGenerateAll}
                      showAll={!ch.is_generated}
                      onClose={() => setShowGenModal(false)}
                    />
                  )}
                </>
              )}
              {!!ch.is_generated && (
                <button onClick={onPublish} disabled={anyBusy} style={smallBtn(anyBusy ? '#475569' : '#22c55e')}>{t('story_publish')}</button>
              )}
              <button onClick={onDelete} disabled={anyBusy} style={smallBtn(anyBusy ? '#475569' : '#ef4444')}>{t('story_delete')}</button>
            </>
          )}
          {isLastPublished && (
            <button onClick={onUnpublish} disabled={anyBusy} style={smallBtn(anyBusy ? '#475569' : '#f59e0b')}>
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
