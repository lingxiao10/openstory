import { useState, useEffect, useContext, useRef, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';

// ─── QuickPlay Modal ("边看边生成") ────────────────────────────────────────────
const QUICK_MODEL_OPTIONS = [
  { value: 'deepseek-v3-2-251201', label: 'DeepSeek V3', provider: 'ark' },
  { value: 'doubao-seed-1-8-251228', label: 'Doubao 1.8', provider: 'ark' },
  { value: 'google/gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro', provider: 'openrouter' },
  { value: 'google/gemini-3-flash-preview', label: 'Gemini 3 Flash', provider: 'openrouter' },
] as const;

function QuickCreateModal({ lang, token, onClose }: {
  lang: string; token: string | null; onClose: () => void;
}) {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [bg, setBg] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [genre, setGenre] = useState<'mystery' | 'numeric'>('mystery');
  const [chapterCount, setChapterCount] = useState(2);
  const [aiModel, setAiModel] = useState('deepseek-v3-2-251201');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleStart = async () => {
    if (!title.trim() || !bg.trim() || !playerName.trim()) { setError('标题、背景和玩家角色名不能为空'); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/stream-game/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title: title.trim(), background: bg.trim(), genre, chapterCount, playerName: playerName.trim(), aiModel }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '创建失败');
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

// ─── Batch Create Modal ────────────────────────────────────────────────────
interface BatchStorySlot {
  id: number;
  title: string;
  bg: string;
  playerName: string;
  genre: 'mystery' | 'numeric';
  aiModel: string;
  chapterCount: number;
  status: 'idle' | 'creating' | 'done' | 'error';
  errorMsg: string;
}

let _batchId = 0;
function mkSlot(): BatchStorySlot {
  return { id: ++_batchId, title: '', bg: '', playerName: '', genre: 'mystery', aiModel: 'deepseek-v3-2-251201', chapterCount: 3, status: 'idle', errorMsg: '' };
}

function BatchCreateModal({ lang, token, onClose, onDone }: {
  lang: string; token: string | null; onClose: () => void; onDone: () => void;
}) {
  const [slots, setSlots] = useState<BatchStorySlot[]>([mkSlot()]);
  const [submitting, setSubmitting] = useState(false);

  const updSlot = (id: number, patch: Partial<BatchStorySlot>) =>
    setSlots(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s));

  const addSlot = () => { if (slots.length < 5) setSlots(prev => [...prev, mkSlot()]); };
  const removeSlot = (id: number) => { if (slots.length > 1) setSlots(prev => prev.filter(s => s.id !== id)); };

  const allIdle = slots.every(s => s.status === 'idle');
  const allDone = slots.every(s => s.status === 'done' || s.status === 'error');

  const handleSubmit = async () => {
    // validate
    for (const s of slots) {
      if (!s.title.trim() || !s.bg.trim()) return;
    }
    setSubmitting(true);
    setSlots(prev => prev.map(s => ({ ...s, status: 'creating', errorMsg: '' })));

    await Promise.allSettled(slots.map(async (s) => {
      try {
        await queryWork('/api/stories', {
          method: 'POST',
          body: { title: s.title, background: s.bg, genre: s.genre, chapterCount: s.chapterCount, playerName: s.playerName, aiModel: s.aiModel },
          token,
        });
        updSlot(s.id, { status: 'done' });
      } catch (e: any) {
        updSlot(s.id, { status: 'error', errorMsg: e.message ?? 'error' });
      }
    }));

    setSubmitting(false);
    onDone();
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: '#000c', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px 8px', overflowY: 'auto' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: '#0f172a', borderRadius: 20, border: '1px solid #334155', width: '100%', maxWidth: 680, padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 16, maxHeight: '90vh', overflowY: 'auto' }}
      >
        {/* header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 16 }}>
              {lang === 'zh' ? '批量生成故事' : 'Batch Create Stories'}
            </div>
            <div style={{ color: '#475569', fontSize: 12, marginTop: 2 }}>
              {lang === 'zh' ? `最多 5 个故事，并发生成` : 'Up to 5 stories, generated concurrently'}
            </div>
          </div>
          <button onClick={onClose} disabled={submitting} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: 22, cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>

        {/* slots */}
        {slots.map((s, idx) => (
          <div key={s.id} style={{ background: '#1e293b', borderRadius: 14, border: `1px solid ${s.status === 'done' ? '#22c55e44' : s.status === 'error' ? '#ef444444' : '#334155'}`, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* slot header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#6366f1', fontWeight: 700, fontSize: 13 }}>
                {lang === 'zh' ? `故事 ${idx + 1}` : `Story ${idx + 1}`}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {s.status === 'creating' && <span style={{ color: '#f59e0b', fontSize: 12 }}>⚡ {lang === 'zh' ? '生成中...' : 'Creating...'}</span>}
                {s.status === 'done' && <span style={{ color: '#22c55e', fontSize: 12 }}>✓ {lang === 'zh' ? '完成' : 'Done'}</span>}
                {s.status === 'error' && <span style={{ color: '#ef4444', fontSize: 12 }} title={s.errorMsg}>✗ {lang === 'zh' ? '失败' : 'Failed'}</span>}
                {slots.length > 1 && s.status === 'idle' && (
                  <button onClick={() => removeSlot(s.id)} style={{ background: 'none', border: 'none', color: '#475569', fontSize: 16, cursor: 'pointer', lineHeight: 1 }}>×</button>
                )}
              </div>
            </div>

            {/* fields */}
            <input
              placeholder={lang === 'zh' ? '故事标题（必填）' : 'Story title (required)'}
              value={s.title} onChange={e => updSlot(s.id, { title: e.target.value })}
              disabled={s.status !== 'idle'} required style={{ ...inputStyle, fontSize: 13 }}
            />
            <input
              placeholder={lang === 'zh' ? '故事背景简介（必填）' : 'Background summary (required)'}
              value={s.bg} onChange={e => updSlot(s.id, { bg: e.target.value })}
              disabled={s.status !== 'idle'} required style={{ ...inputStyle, fontSize: 13 }}
            />
            <input
              placeholder={lang === 'zh' ? '玩家角色名字（选填）' : 'Player character name (optional)'}
              value={s.playerName} onChange={e => updSlot(s.id, { playerName: e.target.value })}
              disabled={s.status !== 'idle'} style={{ ...inputStyle, fontSize: 13 }}
            />

            {/* genre + chapterCount row */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <select
                value={s.genre} onChange={e => updSlot(s.id, { genre: e.target.value as any })}
                disabled={s.status !== 'idle'}
                style={{ ...inputStyle, width: 'auto', fontSize: 12, padding: '6px 10px', cursor: 'pointer' }}
              >
                <option value="mystery">{lang === 'zh' ? '推理' : 'Mystery'}</option>
                <option value="numeric">{lang === 'zh' ? '数字' : 'Numeric'}</option>
              </select>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 160 }}>
                <span style={{ color: '#94a3b8', fontSize: 12, whiteSpace: 'nowrap' }}>
                  {lang === 'zh' ? `${s.chapterCount} 章` : `${s.chapterCount} ch.`}
                </span>
                <input
                  type="range" min={CHAPTER_COUNT_MIN} max={CHAPTER_COUNT_MAX} value={s.chapterCount}
                  onChange={e => updSlot(s.id, { chapterCount: Number(e.target.value) })}
                  disabled={s.status !== 'idle'}
                  style={{ flex: 1, accentColor: '#6366f1' }}
                />
              </div>
            </div>

            {/* model picker */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {MODEL_OPTIONS.map(opt => (
                <button
                  key={opt.value} type="button"
                  onClick={() => updSlot(s.id, { aiModel: opt.value })}
                  disabled={s.status !== 'idle'}
                  style={{ ...modelBtnStyle(s.aiModel === opt.value, opt.provider === 'openrouter'), fontSize: 11, padding: '4px 10px' }}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {s.status === 'error' && s.errorMsg && (
              <div style={{ color: '#ef4444', fontSize: 11 }}>{s.errorMsg}</div>
            )}
          </div>
        ))}

        {/* add slot + submit */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {slots.length < 5 && allIdle && (
            <button
              onClick={addSlot}
              style={{ background: '#1e293b', color: '#94a3b8', border: '1px dashed #334155', borderRadius: 10, padding: '10px 18px', fontSize: 13, cursor: 'pointer', flex: 1 }}
            >
              + {lang === 'zh' ? '添加故事' : 'Add Story'} ({slots.length}/5)
            </button>
          )}
          {!allDone && (
            <button
              onClick={handleSubmit}
              disabled={submitting || slots.some(s => !s.title.trim() || !s.bg.trim())}
              style={{ ...btnStyle, flex: 2, opacity: (submitting || slots.some(s => !s.title.trim() || !s.bg.trim())) ? 0.5 : 1 }}
            >
              {submitting
                ? (lang === 'zh' ? `生成中 (${slots.filter(s => s.status === 'creating').length}/${slots.length})...` : `Creating (${slots.filter(s => s.status === 'creating').length}/${slots.length})...`)
                : (lang === 'zh' ? `并发生成 ${slots.length} 个故事` : `Create ${slots.length} Stories`)}
            </button>
          )}
          {allDone && (
            <button onClick={onClose} style={{ ...btnStyle, flex: 1, background: '#22c55e' }}>
              {lang === 'zh' ? '完成，关闭' : 'Done, Close'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Gen Modal ─────────────────────────────────────────────────────────────
function GenModal({ lang, onOne, onAll, showAll, onClose }: {
  lang: string; onOne: () => void; onAll: () => void; showAll: boolean; onClose: () => void;
}) {
  return (
    <div
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
import { translations } from '../i18n/translations';

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
const CHAPTER_COUNT_MAX = 5;

const MODEL_OPTIONS = [
  { value: 'deepseek-v3-2-251201', label: 'DeepSeek V3', provider: 'ark' },
  { value: 'doubao-seed-1-8-251228', label: 'Doubao Seed 1.8', provider: 'ark' },
  { value: 'google/gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro', provider: 'openrouter' },
  { value: 'google/gemini-3-flash-preview', label: 'Gemini 3 Flash', provider: 'openrouter' },
] as const;

export function MyStories() {
  const { token, isLoggedIn } = useContext(AuthContext);
  const navigate = useNavigate();
  const { t, lang } = useI18n();

  const [stories, setStories] = useState<Story[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [showBatch, setShowBatch] = useState(false);
  const [showQuickCreate, setShowQuickCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [bg, setBg] = useState('');
  const [genre, setGenre] = useState<'mystery' | 'numeric'>('mystery');
  const [chapterCount, setChapterCount] = useState(3);
  const [autoGenerate, setAutoGenerate] = useState(true);
  const [playerName, setPlayerName] = useState('');
  const [aiModel, setAiModel] = useState('deepseek-v3-2-251201');
  const [creating, setCreating] = useState(false);
  const creatingRef = useRef(false);
  const [error, setError] = useState('');
  const [outlineGenText, setOutlineGenText] = useState('');
  const [outlineBoxVisible, setOutlineBoxVisible] = useState(false);
  const outlinePollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const outlineHideRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isLoggedIn) { navigate('/login'); return; }
    load();
    // Auto-open QuickCreate if redirected from home with ?quick=1
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

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (creatingRef.current) return;
    creatingRef.current = true;
    setError(''); setCreating(true);
    // 只在勾选了自动生成且有章节数时才需要显示进度框
    const actualChapterCount = autoGenerate ? chapterCount : 0;
    const needProgress = actualChapterCount > 0;
    const progressKey = needProgress ? `outline_${Date.now()}_${Math.random().toString(36).slice(2)}` : undefined;
    if (needProgress && progressKey) {
      if (outlineHideRef.current) { clearTimeout(outlineHideRef.current); outlineHideRef.current = null; }
      setOutlineGenText('');
      setOutlineBoxVisible(true);
      outlinePollRef.current = setInterval(async () => {
        try {
          const data = await queryWork<{ text: string | null }>(
            `/api/generate/progress/${progressKey}`, { token }
          );
          if (data.text != null) setOutlineGenText(data.text);
        } catch { /* ignore */ }
      }, 1500);
    }
    try {
      await queryWork('/api/stories', {
        method: 'POST',
        body: { title, background: bg, genre, chapterCount: actualChapterCount, progressKey, playerName, aiModel },
        token,
      });
      setTitle(''); setBg(''); setChapterCount(3); setPlayerName(''); setAiModel('deepseek-v3-2-251201'); setAutoGenerate(true);
      setShowForm(false);
      load();
    } catch (err: any) { setError(err.message); }
    finally {
      creatingRef.current = false;
      setCreating(false);
      if (outlinePollRef.current) { clearInterval(outlinePollRef.current); outlinePollRef.current = null; }
      outlineHideRef.current = setTimeout(() => { setOutlineBoxVisible(false); setOutlineGenText(''); }, 1000);
    }
  };

  return (
    <Layout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <h2 style={{ color: '#e2e8f0', margin: 0, fontSize: 24, fontWeight: 800 }}>{t('story_center')}</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button
            onClick={() => { setShowBatch(true); setShowForm(false); setShowQuickCreate(false); }}
            style={{ ...btnStyle, background: '#0f172a', border: '1px solid #6366f155', color: '#a5b4fc', fontSize: 12 }}
          >
            {lang === 'zh' ? '批量生成' : 'Batch Create'}
          </button>
          <button
            onClick={() => { setShowQuickCreate(true); setShowForm(false); setShowBatch(false); }}
            style={{ ...btnStyle, background: '#052e16', border: '1px solid #22c55e55', color: '#4ade80', fontSize: 12 }}
          >
            {lang === 'zh' ? '⚡ 边看边生成' : '⚡ Play While Gen'}
          </button>
          <button onClick={() => setShowForm(!showForm)} style={btnStyle}>
            {showForm ? '×' : `+ ${t('story_create')}`}
          </button>
        </div>
      </div>

      {showQuickCreate && (
        <QuickCreateModal lang={lang} token={token} onClose={() => setShowQuickCreate(false)} />
      )}

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
            <div>
              <input
                placeholder={lang === 'zh' ? '玩家角色名字（如：李明、张三）' : 'Player character name (e.g. John)'}
                value={playerName} onChange={e => setPlayerName(e.target.value)} style={inputStyle}
              />
              <div style={{ color: '#475569', fontSize: 11, marginTop: 4, paddingLeft: 2 }}>
                {lang === 'zh' ? '这是玩家扮演的角色的名字，AI 将以该角色第三人称视角生成故事' : 'The character the player controls. AI generates from this character\'s perspective.'}
              </div>
            </div>
            <select value={genre} onChange={e => setGenre(e.target.value as any)} style={{ ...inputStyle, cursor: 'pointer' }}>
              <option value="mystery">{t('story_mystery')}</option>
              <option value="numeric">{t('story_numeric')}</option>
            </select>
            <div>
              <div style={{ color: '#94a3b8', fontSize: 12, marginBottom: 6 }}>
                {lang === 'zh' ? 'AI 模型' : 'AI Model'}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {MODEL_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setAiModel(opt.value)}
                    style={modelBtnStyle(aiModel === opt.value, opt.provider === 'openrouter')}
                  >
                    {opt.label}
                    <span style={{ fontSize: 10, opacity: 0.7, marginLeft: 4 }}>({opt.provider})</span>
                  </button>
                ))}
              </div>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}>
              <input
                type="checkbox" checked={autoGenerate}
                onChange={e => setAutoGenerate(e.target.checked)}
                style={{ accentColor: '#6366f1', width: 15, height: 15, cursor: 'pointer' }}
              />
              <span style={{ color: '#94a3b8', fontSize: 13 }}>
                {lang === 'zh' ? '自动生成章节大纲' : 'Auto-generate chapter outlines'}
              </span>
            </label>
            {autoGenerate && (
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
            )}
            <button type="submit" disabled={creating} style={btnStyle}>
              {creating ? t('story_generatingOutline') : autoGenerate ? t('story_create') : (lang === 'zh' ? '创建故事' : 'Create Story')}
            </button>
          </form>
        </div>
      )}

      {showBatch && (
        <BatchCreateModal
          lang={lang}
          token={token}
          onClose={() => setShowBatch(false)}
          onDone={() => { load(); }}
        />
      )}

      {outlineBoxVisible && (
        <div style={{
          position: 'fixed', bottom: 20, right: 20,
          background: '#0f172a', border: '1px solid #6366f155',
          borderRadius: 12, padding: '10px 14px',
          width: 280, maxHeight: 180, zIndex: 9998,
          boxShadow: '0 4px 20px #00000066',
          display: 'flex', flexDirection: 'column', gap: 6,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#6366f1', fontSize: 11, fontWeight: 700 }}>
              ⚡ {lang === 'zh' ? '生成大纲中' : 'Generating Outlines'}
            </span>
            <span style={{ color: '#475569', fontSize: 11 }}>
              {outlineGenText.length} {lang === 'zh' ? '字' : 'chars'}
            </span>
          </div>
          <div style={{
            color: '#64748b', fontSize: 11, lineHeight: 1.6,
            overflow: 'hidden', maxHeight: 130,
            wordBreak: 'break-all', whiteSpace: 'pre-wrap',
          }}>
            {outlineGenText.length > 0 ? outlineGenText.slice(-300) : (lang === 'zh' ? '等待 AI 响应...' : 'Waiting for AI...')}
          </div>
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
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [genText, setGenText] = useState('');
  const [genBoxVisible, setGenBoxVisible] = useState(false);
  const genPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 轮询 AI 流式进度，显示在右下角消息框
  useEffect(() => {
    if (generating) {
      if (hideTimerRef.current) { clearTimeout(hideTimerRef.current); hideTimerRef.current = null; }
      setGenBoxVisible(true);
      genPollRef.current = setInterval(async () => {
        try {
          const data = await queryWork<{ text: string | null; chars: number }>(
            `/api/generate/${story.id}/${generating}/progress`, { token }
          );
          if (data.text != null) setGenText(data.text);
        } catch { /* ignore */ }
      }, 1500);
    } else {
      if (genPollRef.current) { clearInterval(genPollRef.current); genPollRef.current = null; }
      // 生成结束：1秒后关闭消息框
      hideTimerRef.current = setTimeout(() => {
        setGenBoxVisible(false);
        setGenText('');
      }, 1000);
    }
    return () => {
      if (genPollRef.current) { clearInterval(genPollRef.current); genPollRef.current = null; }
    };
  }, [generating]);

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

      {genBoxVisible && (
        <div style={{
          position: 'fixed', bottom: 20, right: 20,
          background: '#0f172a', border: '1px solid #6366f155',
          borderRadius: 12, padding: '10px 14px',
          width: 280, maxHeight: 180, zIndex: 9998,
          boxShadow: '0 4px 20px #00000066',
          display: 'flex', flexDirection: 'column', gap: 6,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#6366f1', fontSize: 11, fontWeight: 700 }}>
              ⚡ {lang === 'zh' ? 'AI 生成中' : 'AI Generating'}
            </span>
            <span style={{ color: '#475569', fontSize: 11 }}>
              {genText.length} {lang === 'zh' ? '字' : 'chars'}
            </span>
          </div>
          <div style={{
            color: '#64748b', fontSize: 11, lineHeight: 1.6,
            overflow: 'hidden', maxHeight: 130,
            wordBreak: 'break-all', whiteSpace: 'pre-wrap',
          }}>
            {genText.length > 0 ? genText.slice(-300) : (lang === 'zh' ? '等待 AI 响应...' : 'Waiting for AI...')}
          </div>
        </div>
      )}

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
          {story.chapters.length >= 5 && (
            <p style={{ color: '#64748b', fontSize: 12, marginTop: 16, textAlign: 'center' }}>
              {lang === 'zh' ? '最多支持 5 个章节' : 'Maximum 5 chapters allowed'}
            </p>
          )}
          {story.chapters.length < 5 && <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 8, marginTop: 16 }}>
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
          </div>}
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
              onClick={() => navigate(`/stream-game/${storyId}`)}
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
const modelBtnStyle = (active: boolean, isOpenRouter: boolean): CSSProperties => ({
  background: active ? (isOpenRouter ? '#0891b222' : '#6366f122') : '#0f172a',
  color: active ? (isOpenRouter ? '#22d3ee' : '#a5b4fc') : '#64748b',
  border: `1px solid ${active ? (isOpenRouter ? '#0891b244' : '#6366f144') : '#1e293b'}`,
  borderRadius: 6, padding: '5px 12px', fontSize: 12, cursor: 'pointer', fontWeight: active ? 700 : 400,
});
