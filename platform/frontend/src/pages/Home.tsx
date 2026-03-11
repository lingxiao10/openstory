import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { GameCard } from '../components/GameCard';
import { GameIndex, PublicStory } from '../types';
import { queryWork } from '../api/queryWork';
import { useI18n } from '../i18n';
import { TranslationKey } from '../i18n/translations';

export function Home() {
  const [games, setGames] = useState<GameIndex[]>([]);
  const [publicStories, setPublicStories] = useState<PublicStory[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'mystery' | 'numeric'>('all');
  const { t, lang } = useI18n();
  const navigate = useNavigate();

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
        <p style={{ color: '#64748b', fontSize: 16 }}>{t('home_subtitle')}</p>
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
        <>
          {/* Built-in games */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 24, marginBottom: 40 }}>
            {filteredGames.map(game => <GameCard key={game.id} game={game} />)}
          </div>

          {/* User published stories */}
          {filteredStories.length > 0 && (
            <>
              <div style={{ color: '#6366f1', fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 16 }}>
                {lang === 'zh' ? '— 用户创作 —' : '— Community Stories —'}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 24 }}>
                {filteredStories.map(s => <StoryCard key={s.id} story={s} />)}
              </div>
            </>
          )}
        </>
      )}

      {/* Floating AI Generate button */}
      <div style={{
        position: 'fixed',
        bottom: 80,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 100,
      }}>
        <button
          onClick={() => navigate('/create')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '14px 28px',
            borderRadius: 50,
            border: 'none',
            cursor: 'pointer',
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            color: '#fff',
            fontWeight: 700,
            fontSize: 15,
            boxShadow: '0 8px 32px rgba(99,102,241,0.5)',
            whiteSpace: 'nowrap',
            transition: 'transform 0.2s, box-shadow 0.2s',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.transform = 'scale(1.05)';
            (e.currentTarget as HTMLElement).style.boxShadow = '0 12px 40px rgba(99,102,241,0.7)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
            (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 32px rgba(99,102,241,0.5)';
          }}
        >
          ✨ {lang === 'zh' ? 'AI 生成游戏' : 'Generate AI Game'}
        </button>
      </div>
    </Layout>
  );
}

const typeColors: Record<string, string> = { mystery: '#8b5cf6', numeric: '#06b6d4' };
const typeIcons: Record<string, string> = { mystery: '🔍', numeric: '⚡' };

function StoryCard({ story }: { story: PublicStory }) {
  const { t, lang } = useI18n();
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
          to={`/story/${story.id}`}
          style={{ display: 'block', textAlign: 'center', background: color, color: '#fff', textDecoration: 'none', padding: '10px', borderRadius: 10, fontWeight: 700, fontSize: 14, marginTop: 'auto' }}
        >
          {t('home_play')} →
        </Link>
      </div>
    </div>
  );
}
