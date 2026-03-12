import { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { AuthContext } from '../store/authStore';
import { queryWork } from '../api/queryWork';
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
  status: string;
  chapters: Chapter[];
}

export function MyStories() {
  const { token, isLoggedIn } = useContext(AuthContext);
  const navigate = useNavigate();
  const { t, lang } = useI18n();

  const [stories, setStories] = useState<Story[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [bg, setBg] = useState('');
  const [genre, setGenre] = useState<'mystery' | 'numeric'>('mystery');
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
        body: { title, background: bg, genre },
        token,
      });
      setTitle(''); setBg('');
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
              placeholder={lang === 'zh' ? '故事背景简介（可选，AI 自动翻译另一种语言）' : 'Background summary (optional, AI auto-translates)'}
              value={bg} onChange={e => setBg(e.target.value)} style={inputStyle}
            />
            <select value={genre} onChange={e => setGenre(e.target.value as any)} style={{ ...inputStyle, cursor: 'pointer' }}>
              <option value="mystery">{t('story_mystery')}</option>
              <option value="numeric">{t('story_numeric')}</option>
            </select>
            <button type="submit" disabled={creating} style={btnStyle}>
              {creating
                ? (lang === 'zh' ? 'AI 翻译中...' : 'Translating...')
                : t('story_create')}
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
  const [expanded, setExpanded] = useState(false);
  const [outline, setOutline] = useState('');
  const [generating, setGenerating] = useState<string | null>(null);
  const [err, setErr] = useState('');

  const publishedCount = story.chapters.filter(c => c.published).length;

  const addChapter = async () => {
    if (!outline.trim()) return;
    setErr('');
    try {
      await queryWork(`/api/stories/${story.id}/chapters`, { method: 'POST', body: { outline }, token });
      setOutline('');
      onRefresh();
    } catch (e: any) { setErr(e.message); }
  };

  const generate = async (ch: Chapter) => {
    setGenerating(ch.id);
    try {
      await queryWork(`/api/generate/${story.id}/${ch.id}`, { method: 'POST', token });
      // Poll until done
      const poll = setInterval(async () => {
        const s = await queryWork<Story>(`/api/stories/${story.id}`, { token });
        const updated = s.chapters.find(c => c.id === ch.id);
        if (updated?.is_generated && updated.content_zh !== '生成中...') {
          clearInterval(poll);
          setGenerating(null);
          onRefresh();
        }
      }, 2000);
    } catch (e: any) { setErr(e.message); setGenerating(null); }
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

  return (
    <div style={{ background: '#1e293b', borderRadius: 16, border: '1px solid #334155', overflow: 'hidden' }}>
      <div
        style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
        onClick={() => setExpanded(!expanded)}
      >
        <div>
          <h3 style={{ color: '#e2e8f0', margin: 0, fontSize: 16, fontWeight: 700 }}>{story.title_zh}</h3>
          <span style={{ color: '#64748b', fontSize: 12 }}>
            {story.genre} · {story.chapters.length} 章 · {publishedCount > 0 ? `${publishedCount} 章已发布` : t('story_status_draft')}
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
            {story.chapters.map((ch, idx) => {
              const prevGenerated = idx === 0 || !!story.chapters[idx - 1].is_generated;
              return (
                <ChapterRow
                  key={ch.id} ch={ch} lang={lang}
                  generating={generating === ch.id}
                  prevGenerated={prevGenerated}
                  onGenerate={() => generate(ch)}
                  onDelete={() => deleteChapter(ch)}
                  onPublish={() => publish(ch)}
                  t={t}
                />
              );
            })}
          </div>

          {/* Add chapter */}
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <input
              placeholder={t('story_outline')} value={outline}
              onChange={e => setOutline(e.target.value)} style={{ ...inputStyle, flex: 1 }}
            />
            <button onClick={addChapter} style={btnStyle}>{t('story_addChapter')}</button>
          </div>
        </div>
      )}
    </div>
  );
}

function ChapterRow({ ch, lang, generating, prevGenerated, onGenerate, onDelete, onPublish, t }: any) {
  const [showContent, setShowContent] = useState(false);

  return (
    <div style={{ background: '#0f172a', borderRadius: 10, padding: '12px 14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
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
            {generating && (
              <span style={{ color: '#64748b', fontSize: 11 }}>{lang === 'zh' ? '生成中...' : 'Generating...'}</span>
            )}
          </div>
          <p style={{ color: '#94a3b8', fontSize: 12, margin: 0 }}>{ch.outline_zh}</p>
          {!!ch.is_generated && ch.content_zh && ch.content_zh !== '生成中...' && (
            <button
              onClick={() => setShowContent(!showContent)}
              style={{ background: 'none', border: 'none', color: '#64748b', fontSize: 11, padding: '4px 0', cursor: 'pointer' }}
            >
              {showContent ? (lang === 'zh' ? '收起' : 'Hide') : (lang === 'zh' ? '预览内容' : 'Preview')} ›
            </button>
          )}
          {showContent && (
            <p style={{ color: '#94a3b8', fontSize: 12, lineHeight: 1.7, marginTop: 6, whiteSpace: 'pre-wrap' }}>
              {lang === 'zh' ? ch.content_zh : ch.content_en || ch.content_zh}
            </p>
          )}
        </div>

        {!ch.published && (
          <div style={{ display: 'flex', gap: 6, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <button
              onClick={onGenerate}
              disabled={!!generating || !prevGenerated}
              title={!prevGenerated ? (lang === 'zh' ? '请先生成上一章' : 'Generate previous chapter first') : undefined}
              style={smallBtn(!prevGenerated ? '#475569' : '#6366f1')}
            >
              {ch.is_generated ? t('story_regenerate') : t('story_generate')}
            </button>
            {ch.is_generated && (
              <button onClick={onPublish} style={smallBtn('#22c55e')}>{t('story_publish')}</button>
            )}
            <button onClick={onDelete} style={smallBtn('#ef4444')}>{t('story_delete')}</button>
          </div>
        )}
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
