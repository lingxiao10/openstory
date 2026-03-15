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

const STAT_INIT = 7;
const STAT_MAX = 14;

function getInitialStats(statDefs: Record<string, StatDef>): Record<string, number> {
  return Object.fromEntries(Object.keys(statDefs).map(k => [k, STAT_INIT]));
}

const _ua = navigator.userAgent;
const _isDesktop = !/Android|iPhone|iPad|iPod|Mobile/i.test(_ua);
console.log('[NumericEngine] ✅ module loaded | ua:', _ua, '| isDesktop:', _isDesktop);

const ROTS = [-0.6, 0.5, -0.3, 0.7, -0.8, 0.4, 0.6, -0.5, 0.8, -0.3, 0.4, -0.7, -0.2, 0.6, -0.5, 0.3];
const getRot = (i: number) => ROTS[((i % ROTS.length) + ROTS.length) % ROTS.length];

const FONT_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&display=swap');
  @keyframes cardIn {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes cardOut {
    from { opacity: 1; }
    to   { opacity: 0; }
  }
  @keyframes statChange {
    0%, 100% { transform: scale(1); filter: brightness(1); }
    50% { transform: scale(1.15); filter: brightness(1.3); }
  }
  @keyframes cardGlow {
    0%,100% { text-shadow: 0 0 8px #C9A84C66; }
    50%     { text-shadow: 0 0 22px #C9A84CAA, 0 0 4px #fff3; }
  }
  @keyframes cardFadeIn { from { opacity: 0 } to { opacity: 1 } }
`;

type CardTone = 'dark' | 'light';

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
  const [showNarrative, setShowNarrative] = useState(false);
  const [pendingWin, setPendingWin] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [changedStats, setChangedStats] = useState<Set<string>>(new Set());
  const [cardTone, setCardTone] = useState<CardTone>(
    () => (localStorage.getItem('card_tone') as CardTone) || 'dark'
  );

  const toggleTone = () => {
    const next: CardTone = cardTone === 'dark' ? 'light' : 'dark';
    setCardTone(next);
    localStorage.setItem('card_tone', next);
  };

  const T = cardTone === 'dark' ? darkTone : lightTone;
  const data = gameData.cards || [];
  const card = data[index] as StoryCard | undefined;
  const rot = _isDesktop ? 0 : getRot(index);

  const shuffledChoices = useMemo(() => {
    if (!card?.choices) return [];
    return [...card.choices].sort(() => Math.random() - 0.5);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  const applyChoice = (choice: StoryChoice) => {
    const newStats = { ...stats };
    const combined: Record<string, number> = {};
    const changed = new Set<string>();
    if (choice.effects) {
      for (const [k, v] of Object.entries(choice.effects)) {
        if (v !== 0) {
          combined[k] = (combined[k] || 0) + v;
          changed.add(k);
        }
        newStats[k] = Math.max(0, Math.min(STAT_MAX, (newStats[k] || 0) + v));
      }
    }
    if (choice.bonusIf && items.includes(choice.bonusIf.item)) {
      for (const [k, v] of Object.entries(choice.bonusIf.bonus)) {
        if (v !== 0) {
          combined[k] = (combined[k] || 0) + v;
          changed.add(k);
        }
        newStats[k] = Math.max(0, Math.min(STAT_MAX, (newStats[k] || 0) + v));
      }
    }
    const newItems = [...items];
    if (choice.giveItem) newItems.push(choice.giveItem);
    setStats(newStats);
    setItems(newItems);
    setNarrative(tf(choice.text));
    setLastEffects(combined);
    setLastItem(choice.giveItem || null);
    setChangedStats(changed);
    setTimeout(() => setChangedStats(new Set()), 600);

    const isDead = Object.entries(newStats).some(([k, v]) => gameData.statDefs[k] && v <= 0);
    if (isDead) { setGameOver(true); return; }

    const nextIndex = index + 1;
    const willWin = nextIndex >= data.length || data[nextIndex]?.type === 'end';
    setPendingWin(willWin);
    setShowNarrative(true);
  };

  const dismissNarrative = () => {
    setExiting(true);
    if (pendingWin) {
      setTimeout(() => {
        setWin(true);
        setPendingWin(false);
        setShowNarrative(false);
        setExiting(false);
      }, 700);
    } else {
      setIndex(i => i + 1);
      setCardKey(k => k + 1);
      setTimeout(() => {
        setShowNarrative(false);
        setExiting(false);
        setNarrative('');
        setLastEffects({});
        setLastItem(null);
      }, 700);
    }
  };

  const advance = () => {
    setExiting(true);
    setTimeout(() => {
      const nextIndex = index + 1;
      if (nextIndex >= data.length || data[nextIndex]?.type === 'end') { setWin(true); return; }
      setIndex(nextIndex);
      setCardKey(k => k + 1);
    }, 200);
    setTimeout(() => {
      setExiting(false);
    }, 1200);
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
    setShowNarrative(false);
    setPendingWin(false);
  };

  if (!card) return null;

  return (
    <>
      <style>{FONT_CSS}</style>
      <div style={{ ...S.root, background: T.rootBg }}>
        <div style={{ ...S.bgPattern, backgroundImage: T.bgPattern }} />
        <div style={{ ...S.bgVignette, background: T.bgVignette }} />

        {/* Tone toggle */}
        {!gameOver && !win && (
          <button onClick={toggleTone} style={{ ...S.backBtn, left: 'auto', right: 16, color: T.backBtnColor, fontSize: '0.75rem' }}>
            {cardTone === 'dark' ? t('game_lightMode') : t('game_darkMode')}
          </button>
        )}

        {/* Card container with absolute positioning for smooth transitions */}
        <div style={{ position: 'relative', width: 'min(380px, 90vw)', minHeight: 300, zIndex: 1 }}>
          {/* Narrative card */}
          {showNarrative && (
            <div
              onClick={exiting ? undefined : dismissNarrative}
              style={{
                ...S.card,
                position: 'absolute',
                top: 0,
                left: 0,
                background: T.cardBg,
                boxShadow: T.cardShadow,
                transform: `rotate(${rot}deg)`,
                animation: exiting ? 'cardOut 0.6s ease 0.1s forwards' : 'cardIn .4s cubic-bezier(.22,.68,0,1.2)',
                cursor: exiting ? 'default' : 'pointer',
                pointerEvents: exiting ? 'none' : 'auto'
              }}
            >
            <div style={{ ...S.cardInner, border: `1px solid ${T.cardBorder}` }}>
              <div style={{ ...S.storyText, color: T.textMain }}>{narrative}</div>
              {/* Stat effects */}
              {(Object.keys(lastEffects).length > 0 || lastItem) && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 18 }}>
                  {Object.entries(lastEffects).map(([k, v]) => {
                    const def = gameData.statDefs?.[k];
                    const positive = v > 0;
                    return (
                      <span key={k} style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: positive ? '#16a34a33' : '#7f1d1d33', color: positive ? '#86efac' : '#fca5a5', border: `1px solid ${positive ? '#16a34a55' : '#7f1d1d55'}` }}>
                        {def?.icon} {tf(def?.name)} {positive ? '+' : ''}{v}
                      </span>
                    );
                  })}
                  {lastItem && (() => {
                    const item = gameData.itemDefs?.[lastItem];
                    return item ? (
                      <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: T.actColor + '22', color: T.actColor, border: `1px solid ${T.actColor}55` }}>
                        {item.icon} {tf(item.name)} {t('game_itemGained')}
                      </span>
                    ) : null;
                  })()}
                </div>
              )}
              <div style={{ ...S.tapHint, color: T.tapHintColor }}>{t('game_tapToContinue')}</div>
            </div>
            <div style={{ ...S.cardCornerTL, borderColor: T.cornerColor }} />
            <div style={{ ...S.cardCornerBR, borderColor: T.cornerColor }} />
          </div>
        )}

          {/* Main card */}
          {(!showNarrative || exiting) && !gameOver && !win && (
            <div
              key={cardKey}
              style={{
                ...S.card,
                position: 'absolute',
                top: 0,
                left: 0,
                background: T.cardBg,
                boxShadow: T.cardShadow,
                transform: `rotate(${rot}deg)`,
                ['--card-r' as string]: `${rot}deg`,
                animation: exiting ? 'cardOut 1.2s ease forwards' : 'cardIn 0.2s ease',
                cursor: card.type === 'story' ? 'pointer' : 'default',
                willChange: 'opacity, transform',
                pointerEvents: exiting ? 'none' : 'auto',
              }}
              onClick={card.type === 'story' ? advance : undefined}
            >
            <div style={{ ...S.cardInner, border: `1px solid ${T.cardBorder}` }}>
              {card.act && <div style={{ ...S.actLabel, color: T.actColor }}>{tf(card.act)}</div>}

              {card.type === 'story' && (
                <>
                  <div style={{ ...S.storyText, color: T.textMain }}>{tf(card.text)}</div>
                  <div style={{ ...S.tapHint, color: T.tapHintColor }}>{t('game_tapToContinue')}</div>
                </>
              )}

              {card.type === 'choice' && (
                <>
                  <div style={{ ...S.choiceIcon, color: T.actColor }}>？</div>
                  <div style={{ ...S.choiceQuestion, color: T.textMain }}>{tf(card.text)}</div>
                  <div style={S.choiceRow}>
                    {shuffledChoices.map((choice, i) => (
                      <button key={i} style={{ ...S.choiceBtn, border: `1px solid ${T.choiceBorder}`, color: T.textMain }} onClick={() => applyChoice(choice)}>
                        <span style={{ ...S.choiceLetter, color: T.actColor }}>{String.fromCharCode(65 + i)}</span>
                        <span style={S.choiceText}>{tf(choice.label)}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            <div style={{ ...S.cardCornerTL, borderColor: T.cornerColor }} />
            <div style={{ ...S.cardCornerBR, borderColor: T.cornerColor }} />
          </div>
        )}
        </div>

        {/* Game over overlay */}
        {gameOver && (
          <div style={{ ...S.overlay, background: '#0A0A0Fcc' }}>
            <div style={{ ...S.card, background: T.cardBg, boxShadow: T.cardShadow, maxWidth: 360, transform: 'rotate(-1deg)', animation: 'cardIn .5s ease' }}>
              <div style={{ ...S.cardInner, border: `1px solid ${T.cardBorder}`, gap: 12 }}>
                <div style={{ fontSize: 40 }}>💀</div>
                <div style={{ ...S.actLabel, color: '#c0392b', fontSize: '1rem', letterSpacing: '0.15em' }}>{t('game_over')}</div>
                <button onClick={restart} style={{ ...S.startBtn, border: '1px solid #c0392b', color: '#c0392b', marginTop: 8 }}>{t('game_tryAgain')}</button>
              </div>
              <div style={{ ...S.cardCornerTL, borderColor: T.cornerColor }} />
              <div style={{ ...S.cardCornerBR, borderColor: T.cornerColor }} />
            </div>
          </div>
        )}

        {/* Win overlay */}
        {win && (
          <div style={{ ...S.overlay, background: '#0A0A0Fdd' }}>
            <div style={{ ...S.card, background: T.cardBg, boxShadow: T.cardShadow, maxWidth: 380, transform: 'rotate(-1deg)', animation: 'cardIn .8s ease' }}>
              <div style={{ ...S.cardInner, border: `1px solid ${T.cardBorder}` }}>
                <div style={{ ...S.storyText, color: T.textMain, whiteSpace: 'pre-line', lineHeight: 2 }}>
                  {gameData.winText ? tf(gameData.winText) : t('game_win')}
                </div>
                <div style={{ color: T.actColor, fontSize: '1.3rem', margin: '20px 0 8px', animation: 'cardGlow 2s infinite' }}>{t('game_storyComplete')}</div>
                <div style={{ display: 'flex', gap: 10, marginTop: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                  {onVictory && (
                    <button style={{ ...S.startBtn, border: `1px solid ${T.actColor}`, color: T.actColor }} onClick={onVictory}>
                      {isLastChapter ? t('game_endStory') : t('game_endChapter')}
                    </button>
                  )}
                  <button style={{ ...S.startBtn, border: `1px solid ${T.dimColor}`, color: T.dimColor }} onClick={restart}>{t('game_playAgain')}</button>
                </div>
              </div>
              <div style={{ ...S.cardCornerTL, borderColor: T.cornerColor }} />
              <div style={{ ...S.cardCornerBR, borderColor: T.cornerColor }} />
            </div>
          </div>
        )}

        {/* Items row (above stats) */}
        {items.length > 0 && !gameOver && !win && (
          <div style={{ position: 'absolute', bottom: 54, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 6, flexWrap: 'wrap', padding: '0 20px', zIndex: 10 }}>
            {[...new Set(items)].map(itemId => {
              const item = gameData.itemDefs?.[itemId];
              return item ? (
                <div key={itemId} title={tf(item.desc)} style={{ background: T.cardBg, border: `1px solid ${T.choiceBorder}`, borderRadius: 20, padding: '2px 10px', fontSize: 11, color: T.textSub, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span>{item.icon}</span><span>{tf(item.name)}</span>
                </div>
              ) : null;
            })}
          </div>
        )}

        {/* Stats bar — fixed at bottom */}
        {!gameOver && !win && (
          <div style={{ position: 'absolute', bottom: 10, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 10, padding: '0 20px', zIndex: 10 }}>
            {Object.entries(gameData.statDefs || {}).map(([key, def]) => {
              const val = stats[key] ?? STAT_INIT;
              const pct = Math.max(0, Math.min(100, (val / STAT_MAX) * 100));
              const isChanged = changedStats.has(key);
              return (
                <div key={key} style={{ position: 'relative', width: 52, height: 85, background: T.cardBg, border: `1px solid ${T.choiceBorder}`, borderRadius: 6, overflow: 'hidden', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', padding: '6px 4px', animation: isChanged ? 'statChange .6s ease' : 'none' }}>
                  {/* Fill from bottom */}
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: `${pct}%`, background: def.color || T.actColor, opacity: 0.3, transition: 'height .4s ease', zIndex: 0 }} />
                  <span style={{ fontSize: 15, zIndex: 1 }}>{def.icon}</span>
                  <span style={{ color: def.color || T.textMain, fontWeight: 700, fontSize: 14, zIndex: 1 }}>{val}</span>
                  <span style={{ color: T.textSub, fontSize: 10, zIndex: 1, lineHeight: 1 }}>{tf(def.name)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

interface Tone {
  rootBg: string; bgPattern: string; bgVignette: string; backBtnColor: string;
  cardBg: string; cardShadow: string; cardBorder: string; cornerColor: string;
  actColor: string; textMain: string; textSub: string; tapHintColor: string;
  choiceBorder: string; dimColor: string;
}

const darkTone: Tone = {
  rootBg: '#0A0A0F',
  bgPattern: `linear-gradient(45deg,#ffffff04 25%,transparent 25%),linear-gradient(-45deg,#ffffff04 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#ffffff04 75%),linear-gradient(-45deg,transparent 75%,#ffffff04 75%)`,
  bgVignette: 'radial-gradient(ellipse at 50% 50%, transparent 30%, #0A0A0F 90%)',
  backBtnColor: '#C9A84C88',
  cardBg: '#1C1510', cardShadow: '0 2px 4px #0008, 0 8px 20px #00000088, 0 20px 50px #00000055, inset 0 0 30px #0000001A',
  cardBorder: '#8B691466', cornerColor: '#8B6914AA', actColor: '#C9A84C',
  textMain: '#E8D5B0', textSub: '#A89070', tapHintColor: '#C9A84C44', choiceBorder: '#C9A84C44', dimColor: '#8B691466',
};

const lightTone: Tone = {
  rootBg: '#F0EAD6',
  bgPattern: `linear-gradient(45deg,#00000006 25%,transparent 25%),linear-gradient(-45deg,#00000006 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#00000006 75%),linear-gradient(-45deg,transparent 75%,#00000006 75%)`,
  bgVignette: 'radial-gradient(ellipse at 50% 50%, transparent 30%, #E8E0C8 90%)',
  backBtnColor: '#8B6914',
  cardBg: '#F4EAD5', cardShadow: '0 2px 4px #0002, 0 8px 20px #00000022, 0 20px 50px #00000015, inset 0 0 30px #0000000A',
  cardBorder: '#C4A88266', cornerColor: '#C4A882AA', actColor: '#8B6914',
  textMain: '#2C1810', textSub: '#5A4A30', tapHintColor: '#8B691466', choiceBorder: '#8B691455', dimColor: '#8B691466',
};

const S: Record<string, React.CSSProperties> = {
  root: { minHeight: '100vh', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: "'STKaiti','KaiTi','FangSong','STSong','Playfair Display',Georgia,serif", position: 'relative', overflow: 'hidden', padding: '20px 16px 100px', userSelect: 'none' },
  bgPattern: { position: 'absolute', inset: '0', zIndex: 0, pointerEvents: 'none', backgroundSize: '12px 12px' },
  bgVignette: { position: 'absolute', inset: '0', zIndex: 0, pointerEvents: 'none' },
  backBtn: { position: 'absolute', top: 16, left: 16, zIndex: 10, background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem', letterSpacing: '0.1em', fontFamily: 'inherit', padding: '4px 8px' },
  progress: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, background: '#ffffff0d', zIndex: 10 },
  progressBar: { height: '100%', background: 'linear-gradient(90deg, #8B6914, #C9A84C)', transition: 'width .4s ease' },
  card: { position: 'relative', width: 'min(380px, 90vw)', minHeight: 300, borderRadius: 4, zIndex: 1, padding: 0 },
  cardInner: { padding: '32px 28px 28px', margin: 8, minHeight: 260, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 0 },
  cardCornerTL: { position: 'absolute', top: 10, left: 10, width: 18, height: 18, borderTop: '1.5px solid', borderLeft: '1.5px solid' },
  cardCornerBR: { position: 'absolute', bottom: 10, right: 10, width: 18, height: 18, borderBottom: '1.5px solid', borderRight: '1.5px solid' },
  actLabel: { fontSize: '0.6rem', letterSpacing: '0.25em', textTransform: 'uppercase', marginBottom: 18, opacity: 0.85, fontFamily: "'Playfair Display', Georgia, serif" },
  storyText: { fontSize: '1.05rem', lineHeight: 1.9, textAlign: 'center', letterSpacing: '0.06em' },
  tapHint: { fontSize: '0.6rem', letterSpacing: '0.2em', marginTop: 24, fontFamily: 'Georgia, serif' },
  choiceIcon: { fontSize: '1.8rem', marginBottom: 12, opacity: 0.6 },
  choiceQuestion: { fontSize: '0.95rem', lineHeight: 1.8, textAlign: 'center', marginBottom: 20, letterSpacing: '0.05em' },
  choiceRow: { display: 'flex', flexDirection: 'column', gap: 10, width: '100%' },
  choiceBtn: { display: 'flex', alignItems: 'flex-start', gap: 10, background: 'transparent', borderRadius: 3, padding: '10px 12px', cursor: 'pointer', textAlign: 'left', transition: 'all .2s', fontFamily: 'inherit', width: '100%', outline: 'none' },
  choiceLetter: { fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700, fontSize: '1rem', minWidth: 18, marginTop: 1 },
  choiceText: { fontSize: '0.88rem', lineHeight: 1.6, letterSpacing: '0.04em' },
  startBtn: { padding: '10px 24px', background: 'transparent', fontSize: '0.9rem', letterSpacing: '0.15em', cursor: 'pointer', fontFamily: 'inherit', borderRadius: 2, transition: 'all .2s' },
  overlay: { position: 'fixed', inset: '0', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'cardFadeIn .3s ease', padding: 20 },
};
