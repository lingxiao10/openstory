import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { GameCard } from '../components/GameCard';
import { GameIndex, PublicStory } from '../types';
import { queryWork } from '../api/queryWork';
import { useI18n } from '../i18n';
import { TranslationKey } from '../i18n/translations';
import { useAudio } from '../components/AudioManager';

export function Home() {
  const [games, setGames] = useState<GameIndex[]>([]);
  const [publicStories, setPublicStories] = useState<PublicStory[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'mystery' | 'numeric'>('all');
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const { playClick } = useAudio();

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

const typeColors: Record<string, string> = { mystery: '#8b5cf6', numeric: '#06b6d4' };
const typeIcons: Record<string, string> = { mystery: '🔍', numeric: '⚡' };

function StoryCard({ story }: { story: PublicStory }) {
  const { t, lang } = useI18n();
  const { playClick } = useAudio();
  const title = lang === 'en' && story.title_en ? story.title_en : story.title_zh;
  const bg = lang === 'en' && story.background_en ? story.background_en : story.background_zh;
  const color = typeColors[story.genre] || '#6366f1';
  const icon = typeIcons[story.genre] || '📖';

  return (
    <div style={{ background: '#1e293b', borderRadius: 16, overflow: 'hidden', border: '1px solid #334155', display: 'flex', flexDirection: 'column' }}>
      <div style={{ background: `linear-gradient(135deg, ${color}22, ${color}44)`, padding: '20px 24px 16px', borderBottom: '1px solid #334155' }}>
        <h3 style={{ color: '#e2e8f0', fontSize: 18, fontWeight: 700, margin: '0 0 10px' }}>{title}</h3>
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
          color: '#94a3b8', fontSize: 13, lineHeight: 1.7, margin: '0 0 16px',
          height: '66px',
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitLineClamp: 3,
          WebkitBoxOrient: 'vertical',
        } as React.CSSProperties}>{bg}</p>
        <Link
          to={`/stream-game/${story.id}`}
          onClick={playClick}
          style={{ display: 'block', textAlign: 'center', background: color, color: '#fff', textDecoration: 'none', padding: '10px', borderRadius: 10, fontWeight: 700, fontSize: 14, marginTop: 'auto' }}
        >
          {t('home_play')} →
        </Link>
      </div>
    </div>
  );
}
