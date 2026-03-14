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

// Smaller rotation values for subtle tilt on mobile
const ROTS = [-0.6, 0.5, -0.3, 0.7, -0.8, 0.4, 0.6, -0.5, 0.8, -0.3, 0.4, -0.7, -0.2, 0.6, -0.5, 0.3];
const getRot = (i: number) => ROTS[((i % ROTS.length) + ROTS.length) % ROTS.length];

const CARD_CSS = `
  @keyframes numCardIn {
    from { opacity: 0; transform: translateY(14px) rotate(var(--card-r, 0deg)); }
    to   { opacity: 1; transform: translateY(0)   rotate(var(--card-r, 0deg)); }
  }
`;

export function NumericEngine({ gameData, onVictory, isLastChapter }: Props) {
  const { t, tf } = useI18n();
  const [stats, setStats] = useState<Record<string, number>>(() => getInitialStats(gameData.statDefs || {}));
  const [items, setItems] = useState<string[]>([]);
  const [index, setIndex] = useState(0);
  const [cardKey, setCardKey] = useState(0);
  const [narrative, setNarrative] = useState('');
  const [lastEffects, setLastEffects] = useState<Record<string, number>>({});
  const [lastItem, setLastItem] = useState<string | null>(null);
  const [gameOver, setGameOver] = useState(false);
  const [win, setWin] = useState(false);

  // Detect desktop (mouse/trackpad) — no rotation on desktop
  const isDesktop = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches,
    []
  );

  const data = gameData.cards || [];
  const card = data[index] as StoryCard | undefined;
  const rot = isDesktop ? 0 : getRot(index);

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
      setCardKey(k => k + 1);
    }
  };

  const advance = () => {
    setNarrative('');
    setLastEffects({});
    setLastItem(null);
    const nextIndex = index + 1;
    if (nextIndex >= data.length || data[nextIndex]?.type === 'end') { setWin(true); return; }
    setIndex(nextIndex);
    setCardKey(k => k + 1);
  };

  const restart = () => {
    setStats(getInitialStats(gameData.statDefs || {}));
    setItems([]);
    setIndex(0);
    setCardKey(k => k + 1);
    setNarrative('');
    setLastEffects({});
    setLastItem(null);
    setGameOver(false);
    setWin(false);
  };

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '20px 20px 80px', fontFamily: 'system-ui, sans-serif' }}>
      <style>{CARD_CSS}</style>

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
        <div style={{ position: 'relative', background: '#0f172a', border: '1px solid #6366f133', borderRadius: 8, padding: '14px 18px', marginBottom: 16 }}>
          {/* corner decorations */}
          <div style={{ position: 'absolute', top: 8, left: 8, width: 12, height: 12, borderTop: '1.5px solid #6366f166', borderLeft: '1.5px solid #6366f166' }} />
          <div style={{ position: 'absolute', bottom: 8, right: 8, width: 12, height: 12, borderBottom: '1.5px solid #6366f166', borderRight: '1.5px solid #6366f166' }} />
          <div style={{ color: '#a5b4fc', fontSize: 14, lineHeight: 1.8 }}>{narrative}</div>
          {(Object.keys(lastEffects).length > 0 || lastItem) && (
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #6366f122', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
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
        <div style={{ position: 'relative', background: '#0f172a', border: '1px solid #ef444433', borderRadius: 8, padding: 32, textAlign: 'center' }}>
          <div style={{ position: 'absolute', top: 10, left: 10, width: 16, height: 16, borderTop: '1.5px solid #ef444466', borderLeft: '1.5px solid #ef444466' }} />
          <div style={{ position: 'absolute', bottom: 10, right: 10, width: 16, height: 16, borderBottom: '1.5px solid #ef444466', borderRight: '1.5px solid #ef444466' }} />
          <div style={{ fontSize: 48, marginBottom: 16 }}>💀</div>
          <h3 style={{ color: '#ef4444', marginBottom: 16 }}>{t('game_over')}</h3>
          <button onClick={restart} style={restartBtnStyle}>{t('game_tryAgain')}</button>
        </div>
      ) : win ? (
        <div style={{ position: 'relative', background: '#0f172a', border: '1px solid #22c55e33', borderRadius: 8, padding: 32, textAlign: 'center' }}>
          <div style={{ position: 'absolute', top: 10, left: 10, width: 16, height: 16, borderTop: '1.5px solid #22c55e66', borderLeft: '1.5px solid #22c55e66' }} />
          <div style={{ position: 'absolute', bottom: 10, right: 10, width: 16, height: 16, borderBottom: '1.5px solid #22c55e66', borderRight: '1.5px solid #22c55e66' }} />
          <div style={{ fontSize: 48, marginBottom: 16 }}>🎉</div>
          <h3 style={{ color: '#22c55e', marginBottom: 16 }}>{gameData.winText ? tf(gameData.winText) : t('game_win')}</h3>
          <button onClick={onVictory} style={{ ...restartBtnStyle, background: '#22c55e' }}>
            {isLastChapter ? t('game_endStory') : t('game_endChapter')}
          </button>
        </div>
      ) : card ? (
        <div
          key={cardKey}
          style={{
            position: 'relative',
            background: '#0f172a',
            border: '1px solid #6366f144',
            borderRadius: 8,
            padding: 0,
            transform: `rotate(${rot}deg)`,
            ['--card-r' as string]: `${rot}deg`,
            animation: 'numCardIn .45s cubic-bezier(.22,.68,0,1.2)',
            boxShadow: '0 4px 24px #6366f118, 0 8px 40px #00000055',
          }}
        >
          {/* Corner decorations */}
          <div style={{ position: 'absolute', top: 10, left: 10, width: 16, height: 16, borderTop: '1.5px solid #6366f155', borderLeft: '1.5px solid #6366f155', borderTopLeftRadius: 2 }} />
          <div style={{ position: 'absolute', bottom: 10, right: 10, width: 16, height: 16, borderBottom: '1.5px solid #6366f155', borderRight: '1.5px solid #6366f155', borderBottomRightRadius: 2 }} />

          <div style={{ margin: 8, border: '1px solid #6366f11a', borderRadius: 4, padding: '28px 24px', minHeight: 200, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>

            {card.act && (
              <div style={{ color: '#6366f1', fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 16, textAlign: 'center', opacity: 0.8 }}>
                {tf(card.act)}
              </div>
            )}

            {card.type === 'story' && (
              <>
                <p style={{ color: '#e2e8f0', fontSize: 16, lineHeight: 1.9, marginBottom: 24, textAlign: 'center', letterSpacing: '0.03em' }}>{tf(card.text)}</p>
                <button onClick={advance} style={nextBtnStyle}>▶</button>
              </>
            )}

            {card.type === 'choice' && (
              <>
                <p style={{ color: '#e2e8f0', fontSize: 16, lineHeight: 1.9, marginBottom: 24, textAlign: 'center', letterSpacing: '0.03em' }}>{tf(card.text)}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
                  {shuffledChoices.map((choice, i) => (
                    <button
                      key={i}
                      onClick={() => applyChoice(choice)}
                      style={choiceBtnStyle}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#6366f1'; (e.currentTarget as HTMLElement).style.background = '#6366f111'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#6366f133'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                    >
                      <span style={{ color: '#6366f1', marginRight: 8, fontWeight: 700 }}>{String.fromCharCode(65 + i)}.</span>
                      {tf(choice.label)}
                    </button>
                  ))}
                </div>
              </>
            )}

          </div>
        </div>
      ) : null}

    </div>
  );
}

const nextBtnStyle: React.CSSProperties = {
  background: '#6366f1', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 32px', fontSize: 15, cursor: 'pointer',
};
const choiceBtnStyle: React.CSSProperties = {
  background: 'transparent', border: '1px solid #6366f133', borderRadius: 6, padding: '14px 20px',
  color: '#e2e8f0', fontSize: 14, textAlign: 'left', cursor: 'pointer', transition: 'all 0.2s', fontFamily: 'system-ui, sans-serif',
};
const restartBtnStyle: React.CSSProperties = {
  background: '#6366f1', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 32px', fontSize: 15, cursor: 'pointer', fontWeight: 700,
};
