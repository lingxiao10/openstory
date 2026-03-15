import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { GameDetail } from '../types';
import { queryWork } from '../api/queryWork';
import { MysteryEngine } from '../games/mystery/MysteryEngine';
import { NumericEngine } from '../games/numeric/NumericEngine';
import { useI18n } from '../i18n';
import { useAudio } from '../components/AudioManager';

export function GamePlayer() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [game, setGame] = useState<GameDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { t } = useI18n();
  const { setBgmActive } = useAudio();

  useEffect(() => {
    setBgmActive(true);
    return () => setBgmActive(false);
  }, [setBgmActive]);

  useEffect(() => {
    if (!id) return;
    queryWork<GameDetail>(`/api/games/${id}`)
      .then(setGame)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <Layout><div style={{ textAlign: 'center', padding: 80, color: '#64748b' }}>{t('game_loading')}</div></Layout>;
  if (error || !game) return <Layout><div style={{ textAlign: 'center', padding: 80, color: '#ef4444' }}>{t('game_error')}</div></Layout>;

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#e2e8f0', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ padding: '12px 20px' }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: '#6366f1', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
          ← {t('game_back')}
        </button>
      </div>
      {game.type === 'mystery' && <MysteryEngine gameData={game.data} />}
      {game.type === 'numeric' && <NumericEngine gameData={game.data} />}
    </div>
  );
}
