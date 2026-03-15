import React, { useState, useEffect, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { GameCard } from '../components/GameCard';
import { GameIndex, PublicStory } from '../types';
import { queryWork } from '../api/queryWork';
import { useI18n } from '../i18n';
import { TranslationKey } from '../i18n/translations';
import { useAudio } from '../components/AudioManager';
import { AuthContext } from '../store/authStore';

function LoginModal({ onSuccess }: { onSuccess: () => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [needCheckEmail, setNeedCheckEmail] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const { login } = useContext(AuthContext);
  const { t } = useI18n();

  useEffect(() => {
    queryWork<{ need_check_email: boolean }>('/api/auth/config')
      .then(d => setNeedCheckEmail(d.need_check_email))
      .catch(() => {});
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await queryWork<{ token: string; user: any }>('/api/auth/login', {
        method: 'POST', body: { email, password },
      });
      login(data.user, data.token);
      onSuccess();
    } catch (err: any) {
      setError(err.message || t('auth_error'));
    } finally {
      setLoading(false);
    }
  };

  const handleSendCode = async () => {
    setError('');
    setSendingCode(true);
    try {
      await queryWork('/api/auth/send-code', { method: 'POST', body: { email } });
      setCodeSent(true);
    } catch (err: any) {
      setError(err.message || t('auth_error'));
    } finally {
      setSendingCode(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await queryWork<{ token: string; user: any }>('/api/auth/register', {
        method: 'POST', body: { username, email, password, ...(needCheckEmail ? { code } : {}) },
      });
      login(data.user, data.token);
      onSuccess();
    } catch (err: any) {
      setError(err.message || t('auth_error'));
    } finally {
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    background: '#1e293b', border: '1px solid #334155', borderRadius: 10, padding: '12px 16px',
    color: '#e2e8f0', fontSize: 15, outline: 'none', width: '100%', boxSizing: 'border-box',
  };
  const btnStyle: React.CSSProperties = {
    background: '#6366f1', color: '#fff', border: 'none', borderRadius: 10, padding: '13px',
    fontSize: 15, fontWeight: 700, cursor: 'pointer', marginTop: 4,
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: '#0f172a', border: '1px solid #334155', borderRadius: 20,
        padding: '40px 36px', width: '100%', maxWidth: 420, boxSizing: 'border-box',
      }}>
        <h2 style={{ color: '#e2e8f0', marginBottom: 28, textAlign: 'center', fontSize: 24, fontWeight: 800 }}>
          {mode === 'login' ? t('auth_loginTitle') : t('auth_registerTitle')}
        </h2>

        {error && (
          <div style={{ background: '#7f1d1d22', border: '1px solid #ef4444', borderRadius: 8, padding: '10px 14px', color: '#ef4444', fontSize: 13, marginBottom: 16 }}>
            {error}
          </div>
        )}

        {mode === 'login' ? (
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <input type="email" placeholder={t('auth_email')} value={email} onChange={e => setEmail(e.target.value)} required style={inputStyle} />
            <input type="password" placeholder={t('auth_password')} value={password} onChange={e => setPassword(e.target.value)} required style={inputStyle} />
            <button type="submit" disabled={loading} style={btnStyle}>{loading ? t('common_loading') : t('auth_login')}</button>
          </form>
        ) : (
          <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <input type="text" placeholder={t('auth_username')} value={username} onChange={e => setUsername(e.target.value)} required style={inputStyle} />
            <input type="email" placeholder={t('auth_email')} value={email} onChange={e => setEmail(e.target.value)} required style={inputStyle} />
            {needCheckEmail && (
              <div style={{ display: 'flex', gap: 8 }}>
                <input type="text" placeholder={t('auth_verifyCode')} value={code} onChange={e => setCode(e.target.value)} required style={{ ...inputStyle, flex: 1 }} />
                <button type="button" onClick={handleSendCode} disabled={sendingCode || !email} style={{ background: '#334155', color: '#e2e8f0', border: 'none', borderRadius: 10, padding: '0 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  {sendingCode ? '...' : codeSent ? t('auth_resend') : t('auth_sendCode')}
                </button>
              </div>
            )}
            {codeSent && <div style={{ color: '#4ade80', fontSize: 13 }}>{t('auth_codeSent')}</div>}
            <input type="password" placeholder={t('auth_password')} value={password} onChange={e => setPassword(e.target.value)} required style={inputStyle} />
            <button type="submit" disabled={loading} style={btnStyle}>{loading ? t('common_loading') : t('auth_register')}</button>
          </form>
        )}

        <p style={{ textAlign: 'center', color: '#64748b', marginTop: 20, fontSize: 14 }}>
          {mode === 'login' ? (
            <>{t('auth_noAccount')}{' '}<span onClick={() => { setMode('register'); setError(''); }} style={{ color: '#6366f1', cursor: 'pointer' }}>{t('auth_registerLink')}</span></>
          ) : (
            <>{t('auth_hasAccount')}{' '}<span onClick={() => { setMode('login'); setError(''); }} style={{ color: '#6366f1', cursor: 'pointer' }}>{t('auth_loginLink')}</span></>
          )}
        </p>
      </div>
    </div>
  );
}

export function Home() {
  const [games, setGames] = useState<GameIndex[]>([]);
  const [publicStories, setPublicStories] = useState<PublicStory[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'mystery' | 'numeric'>('all');
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const { playClick } = useAudio();
  const { isLoggedIn } = useContext(AuthContext);

  useEffect(() => {
    Promise.all([
      queryWork<GameIndex[]>('/api/games'),
      queryWork<PublicStory[]>('/api/stories/public'),
    ]).then(([g, s]) => {
      setGames(g);
      setPublicStories(s);
    }).catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filteredGames = filter === 'all' ? games : games.filter(g => g.type === filter);
  const filteredStories = filter === 'all' ? publicStories : publicStories.filter(s => s.genre === filter);

  return (
    <Layout>
      {!isLoggedIn && <LoginModal onSuccess={() => {}} />}
      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes pulse-glow-green {
          0%, 100% { box-shadow: 0 0 0 1px rgba(34,197,94,0.3), 0 4px 24px rgba(34,197,94,0.25); }
          50% { box-shadow: 0 0 0 1px rgba(34,197,94,0.5), 0 4px 32px rgba(34,197,94,0.4); }
        }
        .play-generate-btn {
          animation: pulse-glow-green 3s ease-in-out infinite;
          position: relative;
          overflow: hidden;
        }
        .play-generate-btn::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.15) 50%, transparent 60%);
          background-size: 200% 100%;
          animation: shimmer 3.5s linear infinite;
          border-radius: 14px;
        }
        .play-generate-btn:hover {
          animation: none;
          box-shadow: 0 0 0 1px rgba(34,197,94,0.6), 0 8px 32px rgba(34,197,94,0.45) !important;
        }
        .play-generate-btn:hover::after {
          animation: shimmer 1s linear infinite;
        }
      `}</style>
      <div style={{ textAlign: 'center', marginBottom: 48, padding: '24px 0' }}>
        <h1 style={{
          fontSize: 'clamp(32px, 6vw, 56px)',
          fontWeight: 900,
          background: 'linear-gradient(135deg, #6366f1, #8b5cf6, #06b6d4)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          margin: '0 0 12px',
          letterSpacing: -1,
        }}>
          {t('home_title')}
        </h1>
        <p style={{ color: '#64748b', fontSize: 16, marginBottom: 28 }}>{t('home_subtitle')}</p>

        <button
          className="play-generate-btn"
          onClick={() => { playClick(); navigate('/my-stories?quick=1'); }}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 10,
            padding: '14px 36px', borderRadius: 14,
            border: '1px solid rgba(34,197,94,0.4)', cursor: 'pointer',
            background: 'linear-gradient(135deg, rgba(34,197,94,0.12), rgba(16,185,129,0.12))',
            color: '#4ade80', fontWeight: 700, fontSize: 16, letterSpacing: 0.5,
            backdropFilter: 'blur(8px)', transition: 'all 0.25s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'linear-gradient(135deg,rgba(34,197,94,0.25),rgba(16,185,129,0.25))'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'linear-gradient(135deg,rgba(34,197,94,0.12),rgba(16,185,129,0.12))'; }}
        >
          <span style={{ fontSize: 18 }}>⚡</span>
          {lang === 'zh' ? '边玩边生成' : 'Play While Generating'}
        </button>
        <div className="mobile-my-stories-link" style={{ display: 'none', marginTop: 14 }}>
          <Link
            to="/my-stories"
            style={{
              color: '#94a3b8', fontSize: 14, textDecoration: 'none',
              borderBottom: '1px solid #334155', paddingBottom: 1,
            }}
          >
            {lang === 'zh' ? '我的小说 →' : 'My Stories →'}
          </Link>
        </div>
        <style>{`
          @media (max-width: 640px) {
            .mobile-my-stories-link { display: block !important; }
          }
        `}</style>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 32, justifyContent: 'center' }}>
        {(['all', 'mystery', 'numeric'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: '8px 20px', borderRadius: 20, border: 'none', cursor: 'pointer',
            background: filter === f ? '#6366f1' : '#1e293b',
            color: filter === f ? '#fff' : '#94a3b8',
            fontWeight: filter === f ? 700 : 400, fontSize: 13, transition: 'all 0.2s',
          }}>
            {f === 'all' ? t('home_all') : t(`home_${f}` as TranslationKey)}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', color: '#64748b', padding: 60 }}>{t('common_loading')}</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 24 }}>
          {filteredStories.map(s => <StoryCard key={s.id} story={s} />)}
        </div>
      )}

    </Layout>
  );
}

const hasChinese = (s: string) => /[\u4e00-\u9fff]/.test(s);

const typeColors: Record<string, string> = { mystery: '#8b5cf6', numeric: '#06b6d4' };
const typeIcons: Record<string, string> = { mystery: '🔍', numeric: '⚡' };

function StoryCard({ story }: { story: PublicStory }) {
  const { t, lang } = useI18n();
  const color = typeColors[story.genre] || '#6366f1';
  const icon = typeIcons[story.genre] || '📖';

  // Title: in EN mode, use title_en only if it exists and is not Chinese
  const hasEnTitle = !!(story.title_en && !hasChinese(story.title_en) && story.title_en !== story.title_zh);
  const title = lang === 'en'
    ? (hasEnTitle ? story.title_en : t('common_titleGenerating'))
    : story.title_zh;

  // Summary: in EN mode, use summary_en or non-Chinese background_en
  const enSummary = story.summary_en
    || (!hasChinese(story.background_en ?? '') && story.background_en ? story.background_en : null);
  const hasEnSummary = !!enSummary;
  const summary = lang === 'en'
    ? enSummary
    : (story.summary_zh || story.background_zh || null);

  return (
    <div style={{ background: '#1e293b', borderRadius: 16, overflow: 'hidden', border: '1px solid #334155', display: 'flex', flexDirection: 'column' }}>
      <div style={{ background: `linear-gradient(135deg, ${color}22, ${color}44)`, padding: '20px 24px 16px', borderBottom: '1px solid #334155' }}>
        <h3 style={{ color: lang === 'en' && !hasEnTitle ? '#475569' : '#e2e8f0', fontSize: 18, fontWeight: 700, margin: '0 0 10px', fontStyle: lang === 'en' && !hasEnTitle ? 'italic' : 'normal' }}>{title}</h3>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 10px', borderRadius: 20, background: `${color}33`, color, fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase' }}>
            {icon} {t(`home_${story.genre}` as TranslationKey)}
          </span>
          <span style={{ color: '#64748b', fontSize: 11 }}>
            {story.published_count} {t('reader_chapters')}
          </span>
          <span style={{ background: '#6366f122', color: '#a5b4fc', fontSize: 11, padding: '2px 7px', borderRadius: 10 }}>
            {lang === 'zh' ? 'AI创作' : 'AI'}
          </span>
        </div>
      </div>
      <div style={{ padding: '16px 24px 20px', display: 'flex', flexDirection: 'column', flex: 1 }}>
        <p style={{
          color: summary ? '#94a3b8' : '#475569',
          fontStyle: summary ? 'normal' : 'italic',
          fontSize: 13, lineHeight: 1.7, margin: '0 0 16px',
          height: '44px', overflow: 'hidden',
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
        } as React.CSSProperties}>
          {summary ?? (lang === 'en' ? t('common_descGenerating') : t('common_noDescription'))}
        </p>
        <Link
          to={`/story/${story.id}`}
          style={{ display: 'block', textAlign: 'center', background: color, color: '#fff', textDecoration: 'none', padding: '10px', borderRadius: 10, fontWeight: 700, fontSize: 14, marginTop: 'auto' }}
        >
          {t('home_play')} →
        </Link>
      </div>
    </div>
  );
}
