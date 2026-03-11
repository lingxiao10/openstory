import React from 'react';
import { Link } from 'react-router-dom';
import { GameIndex } from '../types';
import { useI18n } from '../i18n';
import { TranslationKey } from '../i18n/translations';

interface Props {
  game: GameIndex;
}

const typeColors: Record<string, string> = {
  mystery: '#8b5cf6',
  numeric: '#06b6d4',
};

const typeIcons: Record<string, string> = {
  mystery: '🔍',
  numeric: '⚡',
};

export function GameCard({ game }: Props) {
  const { t, tf } = useI18n();
  const color = typeColors[game.type] || '#6366f1';
  const icon = typeIcons[game.type] || '📖';

  return (
    <div style={{
      background: '#1e293b',
      borderRadius: 16,
      overflow: 'hidden',
      border: '1px solid #334155',
      transition: 'transform 0.2s, box-shadow 0.2s',
      cursor: 'pointer',
      display: 'flex',
      flexDirection: 'column',
    }}
    onMouseEnter={e => {
      (e.currentTarget as HTMLElement).style.transform = 'translateY(-4px)';
      (e.currentTarget as HTMLElement).style.boxShadow = '0 12px 40px rgba(0,0,0,0.4)';
    }}
    onMouseLeave={e => {
      (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
      (e.currentTarget as HTMLElement).style.boxShadow = 'none';
    }}
    >
      <div style={{
        background: `linear-gradient(135deg, ${color}22, ${color}44)`,
        padding: '20px 24px 16px',
        borderBottom: '1px solid #334155',
      }}>
        <h3 style={{ color: '#e2e8f0', fontSize: 18, fontWeight: 700, margin: '0 0 10px' }}>
          {tf(game.title)}
        </h3>
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          padding: '2px 10px',
          borderRadius: 20,
          background: `${color}33`,
          color,
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: 1,
          textTransform: 'uppercase',
        }}>
          {icon} {t(`home_${game.type}` as TranslationKey)}
        </span>
      </div>

      <div style={{ padding: '16px 24px 20px', display: 'flex', flexDirection: 'column', flex: 1 }}>
        <p style={{
          color: '#94a3b8', fontSize: 13, lineHeight: 1.7, margin: '0 0 16px',
          height: '66px',
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitLineClamp: 3,
          WebkitBoxOrient: 'vertical',
        } as React.CSSProperties}>
          {tf(game.desc)}
        </p>
        <Link
          to={`/game/${game.id}`}
          style={{
            display: 'block',
            textAlign: 'center',
            background: color,
            color: '#fff',
            textDecoration: 'none',
            padding: '10px',
            borderRadius: 10,
            fontWeight: 700,
            fontSize: 14,
            marginTop: 'auto',
          }}
        >
          {t('home_play')} →
        </Link>
      </div>
    </div>
  );
}
