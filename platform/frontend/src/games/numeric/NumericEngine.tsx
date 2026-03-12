import { useState, useMemo } from 'react';
import { useI18n } from '../../i18n';
import { BilingualText } from '../../i18n/translations';

interface StatDef {
  name: BilingualText;
  icon: string;
  color: string;
  bg: string;
}

interface ItemDef {
  name: BilingualText;
  icon: string;
  desc: BilingualText;
}

interface StoryCard {
  id: number;
  type: 'story' | 'choice' | 'end';
  act?: BilingualText;
  text?: BilingualText;
  choices?: StoryChoice[];
}

interface StoryChoice {
  label: BilingualText;
  text: BilingualText;
  effects?: Record<string, number>;
  giveItem?: string;
  bonusIf?: { item: string; bonus: Record<string, number> };
}

interface GameData {
  title: BilingualText;
  description: BilingualText;
  statDefs: Record<string, StatDef>;
  itemDefs: Record<string, ItemDef>;
  cards: StoryCard[];
  winText?: BilingualText;
}

interface Props {
  gameData: GameData;
  onVictory?: () => void;
  isLastChapter?: boolean;
}

function getInitialStats(statDefs: Record<string, StatDef>): Record<string, number> {
  return Object.fromEntries(Object.keys(statDefs).map(k => [k, 10]));
}

export function NumericEngine({ gameData, onVictory, isLastChapter }: Props) {
  const { t, tf, lang } = useI18n();
  const [stats, setStats] = useState<Record<string, number>>(() => getInitialStats(gameData.statDefs || {}));
  const [items, setItems] = useState<string[]>([]);
  const [index, setIndex] = useState(0);
  const [narrative, setNarrative] = useState('');
  const [lastEffects, setLastEffects] = useState<Record<string, number>>({});
  const [lastItem, setLastItem] = useState<string | null>(null);
  const [gameOver, setGameOver] = useState(false);
  const [win, setWin] = useState(false);

  const data = gameData.cards || [];
  const card = data[index] as StoryCard | undefined;

  // Shuffle choices once per card index to randomize option order each encounter
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const shuffledChoices = useMemo(() => {
    if (!card?.choices) return [];
    return [...card.choices].sort(() => Math.random() - 0.5);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  const applyChoice = (choice: StoryChoice) => {
    const newStats = { ...stats };
    const combined: Record<string, number> = {};
    if (choice.effects) {
      for (const [k, v] of Object.entries(choice.effects)) {
        if (v !== 0) combined[k] = (combined[k] || 0) + v;
        newStats[k] = Math.max(0, (newStats[k] || 0) + v);
      }
    }
    // Apply bonus if item condition met
    if (choice.bonusIf && items.includes(choice.bonusIf.item)) {
      for (const [k, v] of Object.entries(choice.bonusIf.bonus)) {
        if (v !== 0) combined[k] = (combined[k] || 0) + v;
        newStats[k] = Math.max(0, (newStats[k] || 0) + v);
      }
    }
    const newItems = [...items];
    if (choice.giveItem) newItems.push(choice.giveItem);

    setStats(newStats);
    setItems(newItems);
    setNarrative(tf(choice.text));
    setLastEffects(combined);
    setLastItem(choice.giveItem || null);

    const isDead = Object.entries(newStats).some(([k, v]) => gameData.statDefs[k] && v <= 0);
    if (isDead) { setGameOver(true); return; }

    const nextIndex = index + 1;
    if (nextIndex >= data.length || data[nextIndex]?.type === 'end') {
      setWin(true);
    } else {
      setIndex(nextIndex);
    }
  };

  const advance = () => {
    setNarrative('');
    setLastEffects({});
    setLastItem(null);
    const nextIndex = index + 1;
    if (nextIndex >= data.length || data[nextIndex]?.type === 'end') { setWin(true); return; }
    setIndex(nextIndex);
  };

  const restart = () => {
    setStats(getInitialStats(gameData.statDefs || {}));
    setItems([]);
    setIndex(0);
    setNarrative('');
    setLastEffects({});
    setLastItem(null);
    setGameOver(false);
    setWin(false);
  };

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '20px 20px 80px', fontFamily: 'system-ui, sans-serif' }}>

      {/* Stats bar */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
        {Object.entries(gameData.statDefs || {}).map(([key, def]) => (
          <div key={key} style={{ background: def.bg || '#1e293b', borderRadius: 10, padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>{def.icon}</span>
            <span style={{ color: def.color || '#e2e8f0', fontWeight: 700, fontSize: 15, minWidth: 20 }}>{stats[key] ?? 10}</span>
            <span style={{ color: '#94a3b8', fontSize: 12 }}>{tf(def.name)}</span>
          </div>
        ))}
      </div>

      {/* Items */}
      {items.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          {[...new Set(items)].map(itemId => {
            const item = gameData.itemDefs?.[itemId];
            return item ? (
              <div key={itemId} title={tf(item.desc)} style={{ background: '#1e293b', borderRadius: 8, padding: '4px 10px', fontSize: 12, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span>{item.icon}</span><span>{tf(item.name)}</span>
              </div>
            ) : null;
          })}
        </div>
      )}

      {/* Narrative after choice */}
      {narrative && (
        <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 12, padding: '14px 18px', marginBottom: 16, color: '#a5b4fc', fontSize: 14, lineHeight: 1.8 }}>
          <div>{narrative}</div>
          {(Object.keys(lastEffects).length > 0 || lastItem) && (
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #334155', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {Object.entries(lastEffects).map(([k, v]) => {
                const def = gameData.statDefs?.[k];
                const name = def ? tf(def.name) : k;
                const icon = def?.icon || '';
                const positive = v > 0;
                return (
                  <span key={k} style={{
                    fontSize: 13, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
                    background: positive ? '#16a34a22' : '#7f1d1d22',
                    color: positive ? '#86efac' : '#fca5a5',
                  }}>
                    {icon} {name}{positive ? '+' : ''}{v}
                  </span>
                );
              })}
              {lastItem && (() => {
                const item = gameData.itemDefs?.[lastItem];
                return item ? (
                  <span style={{ fontSize: 13, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: '#6366f122', color: '#a5b4fc' }}>
                    {item.icon} {tf(item.name)} {t('game_itemGained')}
                  </span>
                ) : null;
              })()}
            </div>
          )}
        </div>
      )}

      {gameOver ? (
        <div style={{ background: '#1e293b', borderRadius: 16, padding: 32, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>💀</div>
          <h3 style={{ color: '#ef4444', marginBottom: 16 }}>{t('game_over')}</h3>
          <button onClick={restart} style={restartBtnStyle}>{t('game_tryAgain')}</button>
        </div>
      ) : win ? (
        <div style={{ background: '#1e293b', borderRadius: 16, padding: 32, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🎉</div>
          <h3 style={{ color: '#22c55e', marginBottom: 16 }}>{gameData.winText ? tf(gameData.winText) : t('game_win')}</h3>
          <button onClick={onVictory} style={{ ...restartBtnStyle, background: '#22c55e' }}>
            {isLastChapter ? t('game_endStory') : t('game_endChapter')}
          </button>
        </div>
      ) : card ? (
        <>
          {card.act && (
            <div style={{ color: '#6366f1', fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 16, textAlign: 'center' }}>
              {tf(card.act)}
            </div>
          )}

          {card.type === 'story' && (
            <>
              <p style={{ color: '#e2e8f0', fontSize: 16, lineHeight: 1.9, marginBottom: 24 }}>{tf(card.text)}</p>
              <button onClick={advance} style={nextBtnStyle}>▶</button>
            </>
          )}

          {card.type === 'choice' && (
            <>
              <p style={{ color: '#e2e8f0', fontSize: 16, lineHeight: 1.9, marginBottom: 24 }}>{tf(card.text)}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {shuffledChoices.map((choice, i) => (
                  <button
                    key={i}
                    onClick={() => applyChoice(choice)}
                    style={choiceBtnStyle}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#6366f1'; (e.currentTarget as HTMLElement).style.background = '#6366f111'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#334155'; (e.currentTarget as HTMLElement).style.background = '#1e293b'; }}
                  >
                    <span style={{ color: '#6366f1', marginRight: 8, fontWeight: 700 }}>{String.fromCharCode(65 + i)}.</span>
                    {tf(choice.label)}
                  </button>
                ))}
              </div>
            </>
          )}
        </>
      ) : null}

    </div>
  );
}

const nextBtnStyle: React.CSSProperties = {
  background: '#6366f1', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 32px', fontSize: 15, cursor: 'pointer',
};
const choiceBtnStyle: React.CSSProperties = {
  background: '#1e293b', border: '1px solid #334155', borderRadius: 10, padding: '14px 20px',
  color: '#e2e8f0', fontSize: 14, textAlign: 'left', cursor: 'pointer', transition: 'all 0.2s', fontFamily: 'system-ui, sans-serif',
};
const restartBtnStyle: React.CSSProperties = {
  background: '#6366f1', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 32px', fontSize: 15, cursor: 'pointer', fontWeight: 700,
};
