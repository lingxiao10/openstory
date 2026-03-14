/**
 * StreamNumericEngine — NumericEngine 的流式变体
 *
 * 关键修改（相对原引擎）：
 *  1. isWaiting prop：当玩家到达最后一张可用卡且 AI 仍在生成时，
 *     advance/applyChoice 检测到 nextIndex >= data.length 时不触发 win，
 *     而是进入等待状态。
 *  2. 当新卡到来（data.length 增加）后，等待自动解除。
 */
import { useState, useMemo, useEffect, useRef } from 'react';
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
  title?: BilingualText;
  description?: BilingualText;
  statDefs: Record<string, StatDef>;
  itemDefs: Record<string, ItemDef>;
  cards: StoryCard[];
  winText?: BilingualText;
}

interface Props {
  gameData: GameData;
  isWaiting?: boolean;
  onVictory?: () => void;
}

function getInitialStats(statDefs: Record<string, StatDef>): Record<string, number> {
  return Object.fromEntries(Object.keys(statDefs).map(k => [k, 10]));
}

const ROTS = [-0.6, 0.5, -0.3, 0.7, -0.8, 0.4, 0.6, -0.5, 0.8, -0.3, 0.4, -0.7, -0.2, 0.6, -0.5, 0.3];
const getRot = (i: number) => ROTS[((i % ROTS.length) + ROTS.length) % ROTS.length];

const CARD_CSS = `
  @keyframes numCardIn {
    from { opacity: 0; transform: translateY(14px) rotate(var(--card-r, 0deg)); }
    to   { opacity: 1; transform: translateY(0)   rotate(var(--card-r, 0deg)); }
  }
  @keyframes numFadeIn { from { opacity: 0 } to { opacity: 1 } }
  @keyframes waitPulse {
    0%,100% { opacity: 0.4; }
    50%     { opacity: 1; }
  }
`;

export function StreamNumericEngine({ gameData, isWaiting = false, onVictory }: Props) {
  const { tf } = useI18n();
  const [stats, setStats] = useState<Record<string, number>>(() => getInitialStats(gameData.statDefs || {}));
  const [items, setItems] = useState<string[]>([]);
  const [index, setIndex] = useState(0);
  const [cardKey, setCardKey] = useState(0);
  const [narrative, setNarrative] = useState('');
  const [lastEffects, setLastEffects] = useState<Record<string, number>>({});
  const [lastItem, setLastItem] = useState<string | null>(null);
  const [gameOver, setGameOver] = useState(false);
  const [win, setWin] = useState(false);
  const [waiting, setWaiting] = useState(false);

  const isDesktop = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches,
    []
  );

  const data = gameData.cards || [];
  const card = data[index] as StoryCard | undefined;
  const rot = isDesktop ? 0 : getRot(index);

  const shuffledChoices = useMemo(() => {
    if (!card?.choices) return [];
    return [...card.choices].sort(() => Math.random() - 0.5);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  // Auto-resume when new cards arrive while in waiting state
  const prevDataLenRef = useRef(data.length);
  useEffect(() => {
    if (waiting && data.length > prevDataLenRef.current) {
      prevDataLenRef.current = data.length;
      setWaiting(false);
      setIndex(i => Math.min(i + 1, data.length - 1));
      setCardKey(k => k + 1);
    } else {
      prevDataLenRef.current = data.length;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.length, waiting]);

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
    if (data[nextIndex]?.type === 'end') {
      setWin(true);
    } else if (nextIndex >= data.length) {
      // Stream not done yet — wait instead of winning
      if (isWaiting) {
        setWaiting(true);
      } else {
        setWin(true);
      }
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
    if (data[nextIndex]?.type === 'end') { setWin(true); return; }
    if (nextIndex >= data.length) {
      if (isWaiting) {
        setWaiting(true);
      } else {
        setWin(true);
      }
      return;
    }
    setIndex(nextIndex);
    setCardKey(k => k + 1);
  };


  if (!card) return <div style={{ color: '#fff', textAlign: 'center', padding: 40 }}>加载中…</div>;

  const statKeys = Object.keys(gameData.statDefs || {});

  return (
    <>
      <style>{CARD_CSS}</style>
      <div style={NS.root}>
        {/* Header stats */}
        <div style={NS.statsBar}>
          {statKeys.map(k => {
            const def = gameData.statDefs[k];
            const val = stats[k] ?? 0;
            const pct = Math.max(0, Math.min(100, (val / 10) * 100));
            const delta = lastEffects[k];
            return (
              <div key={k} style={{ ...NS.statItem, background: def.bg }}>
                <span style={NS.statIcon}>{def.icon}</span>
                <div style={NS.statTrack}>
                  <div style={{ ...NS.statFill, width: `${pct}%`, background: def.color }} />
                </div>
                <span style={{ ...NS.statVal, color: def.color }}>{val}</span>
                {delta !== undefined && delta !== 0 && (
                  <span style={{ ...NS.statDelta, color: delta > 0 ? '#4ade80' : '#f87171' }}>
                    {delta > 0 ? `+${delta}` : delta}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Waiting overlay */}
        {(waiting) && (
          <div style={{ ...NS.overlay, background: '#00000088' }}>
            <div style={{ color: '#f59e0b', fontSize: '1rem', animation: 'waitPulse 1.4s ease infinite', letterSpacing: '0.1em' }}>
              ⧗ 正在生成下一段…
            </div>
          </div>
        )}

        {/* Waiting badge (top) when at last card but not blocked */}
        {isWaiting && index === data.length - 1 && card.type !== 'end' && !waiting && (
          <div style={NS.waitBadge}>
            <span style={{ animation: 'waitPulse 1.4s ease infinite' }}>⧗</span> 正在生成下一幕…
          </div>
        )}

        {/* Card */}
        <div
          key={cardKey}
          style={{
            ...NS.card,
            transform: `rotate(${rot}deg)`,
            ['--card-r' as string]: `${rot}deg`,
            animation: 'numCardIn .4s cubic-bezier(.22,.68,0,1.2)',
          }}
        >
          {card.act && <div style={NS.actLabel}>{tf(card.act)}</div>}

          {card.type === 'story' && (
            <>
              <div style={NS.storyText}>{tf(card.text)}</div>
              {narrative && <div style={NS.narrative}>{narrative}</div>}
              {lastItem && gameData.itemDefs[lastItem] && (
                <div style={NS.itemGain}>
                  获得：{gameData.itemDefs[lastItem].icon} {tf(gameData.itemDefs[lastItem].name)}
                </div>
              )}
              <button style={NS.nextBtn} onClick={advance}>
                {isWaiting && index === data.length - 1 ? '— 正在生成下一幕 —' : '继续 →'}
              </button>
            </>
          )}

          {card.type === 'choice' && (
            <>
              <div style={NS.choiceQ}>{tf(card.text)}</div>
              <div style={NS.choiceList}>
                {shuffledChoices.map((ch, i) => (
                  <button key={i} style={NS.choiceBtn} onClick={() => applyChoice(ch)}>
                    <span style={NS.choiceLetter}>{String.fromCharCode(65 + i)}</span>
                    <span style={NS.choiceText}>{tf(ch.label)}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Game over overlay */}
        {gameOver && (
          <div style={NS.overlay}>
            <div style={NS.overlayBox}>
              <div style={{ color: '#ef4444', fontSize: '1.2rem', marginBottom: 12 }}>生命耗尽</div>
              <div style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: 20 }}>你在这段旅程中力竭而倒。</div>
              <button style={NS.retryBtn} onClick={() => {
                setStats(getInitialStats(gameData.statDefs || {}));
                setItems([]);
                setIndex(0);
                setCardKey(k => k + 1);
                setNarrative('');
                setLastEffects({});
                setLastItem(null);
                setGameOver(false);
                setWaiting(false);
              }}>重新开始</button>
            </div>
          </div>
        )}

        {/* Win overlay */}
        {win && (
          <div style={NS.overlay}>
            <div style={NS.overlayBox}>
              <div style={{ color: '#f59e0b', fontSize: '1.3rem', marginBottom: 12 }}>✦ 章节完成 ✦</div>
              <div style={{ color: '#e2e8f0', fontSize: '0.9rem', lineHeight: 1.8, marginBottom: 20 }}>
                {tf(gameData.winText) || '你完成了这一章的旅程。'}
              </div>
              {onVictory && (
                <button style={{ ...NS.retryBtn, background: '#f59e0b22', border: '1px solid #f59e0b66', color: '#f59e0b' }} onClick={onVictory}>
                  下一章
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

const NS: Record<string, React.CSSProperties> = {
  root: { minHeight: '100vh', width: '100%', background: '#0f172a', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui,sans-serif', position: 'relative', overflow: 'hidden', padding: '16px' },
  statsBar: { display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 440, width: '100%' },
  statItem: { display: 'flex', alignItems: 'center', gap: 4, borderRadius: 8, padding: '4px 8px', flex: '1 1 90px', minWidth: 90 },
  statIcon: { fontSize: 14 },
  statTrack: { flex: 1, height: 4, background: '#ffffff22', borderRadius: 2, overflow: 'hidden' },
  statFill: { height: '100%', borderRadius: 2, transition: 'width .4s ease' },
  statVal: { fontSize: 13, fontWeight: 700, minWidth: 16, textAlign: 'right' },
  statDelta: { fontSize: 11, fontWeight: 700, minWidth: 24, textAlign: 'right', animation: 'numFadeIn .3s' },
  card: { background: '#1e293b', borderRadius: 16, border: '1px solid #334155', padding: '28px 24px', maxWidth: 400, width: '100%', boxShadow: '0 8px 32px #00000044', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, zIndex: 1 },
  actLabel: { color: '#f59e0b', fontSize: '0.65rem', letterSpacing: '0.2em', textTransform: 'uppercase', opacity: 0.8 },
  storyText: { color: '#e2e8f0', fontSize: '1rem', lineHeight: 1.9, textAlign: 'center', letterSpacing: '0.04em' },
  narrative: { color: '#94a3b8', fontSize: '0.85rem', lineHeight: 1.7, textAlign: 'center', borderTop: '1px solid #334155', paddingTop: 12, width: '100%' },
  itemGain: { color: '#4ade80', fontSize: '0.8rem', background: '#4ade8011', border: '1px solid #4ade8033', borderRadius: 8, padding: '4px 12px' },
  nextBtn: { background: '#f59e0b22', border: '1px solid #f59e0b55', color: '#f59e0b', borderRadius: 10, padding: '10px 28px', fontSize: '0.9rem', cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '0.05em', marginTop: 4 },
  choiceQ: { color: '#e2e8f0', fontSize: '0.95rem', lineHeight: 1.8, textAlign: 'center' },
  choiceList: { display: 'flex', flexDirection: 'column', gap: 10, width: '100%' },
  choiceBtn: { display: 'flex', alignItems: 'flex-start', gap: 10, background: '#334155', border: '1px solid #475569', borderRadius: 10, padding: '12px 14px', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', transition: 'all .2s', color: '#e2e8f0' },
  choiceLetter: { color: '#f59e0b', fontWeight: 700, minWidth: 18, marginTop: 1 },
  choiceText: { fontSize: '0.88rem', lineHeight: 1.6 },
  waitBadge: { position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', background: '#f59e0b22', border: '1px solid #f59e0b55', borderRadius: 20, padding: '4px 14px', color: '#f59e0b', fontSize: '0.72rem', letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', zIndex: 10 },
  overlay: { position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, animation: 'numFadeIn .3s', padding: 20 },
  overlayBox: { background: '#1e293b', border: '1px solid #334155', borderRadius: 16, padding: '32px 28px', maxWidth: 340, width: '100%', textAlign: 'center', boxShadow: '0 20px 60px #000000AA' },
  retryBtn: { background: '#ef444422', border: '1px solid #ef444466', color: '#ef4444', borderRadius: 10, padding: '10px 28px', fontSize: '0.9rem', cursor: 'pointer', fontFamily: 'inherit' },
};
