import { useState, useCallback, useMemo, useEffect } from 'react';
import { useI18n } from '../../i18n';
import { BilingualText } from '../../i18n/translations';

interface Card {
  id: number;
  type: string;
  act?: BilingualText;
  text?: BilingualText;
  optA?: BilingualText;
  optB?: BilingualText;
  correct?: 'A' | 'B';
  penalty?: BilingualText;
  hint?: BilingualText;
  options?: { text: BilingualText; next?: number }[];
  verdict?: BilingualText;
}

interface GameData {
  id?: string;
  type?: string;
  cards: Card[];
}

interface Props {
  gameData: GameData;
  onVictory?: () => void;
  onBack?: () => void;
}

const ROTS = [-2.3, 1.8, -1.2, 2.7, -3.1, 0.9, 2.0, -1.7, 3.2, -0.8, 1.5, -2.5, -0.4, 2.2, -1.9, 1.1];
const getRot = (i: number) => ROTS[((i % ROTS.length) + ROTS.length) % ROTS.length];

const shuffleOptions = (card: Card, seed: number) => {
  if (card.type !== 'choice' || !card.optA) return null;
  const swap = seed % 2 === 0;
  if (!swap) return { optA: card.optA, optB: card.optB, correct: card.correct };
  return { optA: card.optB, optB: card.optA, correct: card.correct === 'A' ? ('B' as const) : ('A' as const) };
};

const _isDesktopCard = !/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
console.log('[MysteryCardEngine] ✅ loaded | isDesktop:', _isDesktopCard);

const FONT_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&display=swap');
  @keyframes mysteryCard_cardIn {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes mysteryCard_cardOut {
    from { opacity: 1; }
    to   { opacity: 0; }
  }
  @keyframes mysteryCard_cardShake {
    0%,100% { transform: translateX(0) rotate(var(--card-r, 0deg)); }
    18%  { transform: translateX(-10px) rotate(var(--card-r, 0deg)); }
    36%  { transform: translateX(10px)  rotate(var(--card-r, 0deg)); }
    54%  { transform: translateX(-6px)  rotate(var(--card-r, 0deg)); }
    72%  { transform: translateX(6px)   rotate(var(--card-r, 0deg)); }
  }
  @keyframes mysteryCard_cardGlow {
    0%,100% { text-shadow: 0 0 8px #C9A84C66; }
    50%     { text-shadow: 0 0 22px #C9A84CAA, 0 0 4px #fff3; }
  }
  @keyframes mysteryCard_cardFadeIn { from { opacity: 0 } to { opacity: 1 } }
`;

type CardTone = 'dark' | 'light';

export function MysteryCardEngine({ gameData, onVictory, onBack }: Props) {
  const { tf } = useI18n();
  const data = gameData.cards;

  const [index, setIndex] = useState(0);
  const [lives, setLives] = useState(3);
  const [phase, setPhase] = useState<'playing' | 'wrong' | 'gameover' | 'victory'>('playing');
  const [penalty, setPenalty] = useState({ msg: '', hint: '' });
  const [removedCards, setRemovedCards] = useState<Set<number>>(new Set());
  const [exitingCardIndex, setExitingCardIndex] = useState<number | null>(null);
  const [answeredCards, setAnsweredCards] = useState<Map<number, { correct: boolean; selectedOpt: 'A' | 'B' }>>(new Map());
  const [cardTone, setCardTone] = useState<CardTone>(
    () => (localStorage.getItem('card_tone') as CardTone) || 'dark'
  );

  const toggleTone = () => {
    const next: CardTone = cardTone === 'dark' ? 'light' : 'dark';
    setCardTone(next);
    localStorage.setItem('card_tone', next);
  };

  const T = cardTone === 'dark' ? darkTone : lightTone;

  const visibleCards = data.filter((_, i) => !removedCards.has(i));
  const firstVisibleIndex = visibleCards.length > 0 ? data.indexOf(visibleCards[0]) : -1;
  const card = data[firstVisibleIndex] as Card | undefined;

  useEffect(() => {
    // 当所有卡片都被移除后，显示胜利界面
    if (visibleCards.length === 0 && data.length > 0 && phase === 'playing') {
      const t = setTimeout(() => setPhase('victory'), 300);
      return () => clearTimeout(t);
    }
  }, [visibleCards.length, data.length, phase]);

  const advance = useCallback(() => {
    setExitingCardIndex(firstVisibleIndex);
    setTimeout(() => {
      setRemovedCards(prev => new Set([...prev, firstVisibleIndex]));
      setExitingCardIndex(null);
    }, 300);
  }, [firstVisibleIndex]);

  const choose = useCallback((opt: 'A' | 'B', cardShuffled: any) => {
    if (phase !== 'playing' || !card || card.type !== 'choice' || !cardShuffled) return;
    const isCorrect = opt === cardShuffled.correct;

    if (isCorrect) {
      // 正确：如果有verdict就显示，否则直接进入下一张
      if (card.verdict) {
        setAnsweredCards(prev => new Map(prev).set(firstVisibleIndex, { correct: true, selectedOpt: opt }));
      } else {
        advance();
      }
    } else {
      // 错误：显示反馈
      setAnsweredCards(prev => new Map(prev).set(firstVisibleIndex, { correct: false, selectedOpt: opt }));
      const nl = lives - 1;
      setLives(nl);
      if (nl <= 0) {
        setPhase('gameover');
      }
    }
  }, [phase, card, firstVisibleIndex, lives, advance]);

  const dismissWrong = useCallback(() => {
    setPhase('playing');
    // 恢复firstVisibleIndex之前的10张卡片
    setRemovedCards(prev => {
      const newSet = new Set(prev);
      for (let i = Math.max(0, firstVisibleIndex - 10); i < firstVisibleIndex; i++) {
        newSet.delete(i);
      }
      return newSet;
    });
    // 清除这些卡片的回答记录（包括当前卡片）
    setAnsweredCards(prev => {
      const newMap = new Map(prev);
      for (let i = Math.max(0, firstVisibleIndex - 10); i <= firstVisibleIndex; i++) {
        newMap.delete(i);
      }
      return newMap;
    });
  }, [firstVisibleIndex]);

  const restart = useCallback(() => {
    setIndex(0);
    setLives(3);
    setPhase('playing');
    setPenalty({ msg: '', hint: '' });
    setRemovedCards(new Set());
    setExitingCardIndex(null);
    setAnsweredCards(new Map());
  }, []);

  if (!card) return null;

  return (
    <>
      <style>{FONT_CSS}</style>
      <div style={{ ...S.root, background: T.rootBg }}>
        <div style={{ ...S.bgPattern, backgroundImage: T.bgPattern }} />
        <div style={{ ...S.bgVignette, background: T.bgVignette }} />

        {/* Back button */}
        {onBack && phase !== 'victory' && (
          <button onClick={onBack} style={{ ...S.backBtn, color: T.backBtnColor }}>← 返回</button>
        )}

        {/* Tone toggle */}
        {phase !== 'victory' && (
          <button onClick={toggleTone} style={{ ...S.backBtn, left: 'auto', right: 52, color: T.backBtnColor, fontSize: '0.75rem' }}>
            {cardTone === 'dark' ? '☀ 白色调' : '☾ 暗色调'}
          </button>
        )}

        {/* Lives */}
        {phase !== 'victory' && (
          <div style={S.lives}>
            {[0, 1, 2].map(i => (
              <span key={i} style={{ ...S.lifeGem, opacity: i < lives ? 1 : 0.18 }}>◆</span>
            ))}
          </div>
        )}

        {/* Cards container */}
        {(phase === 'playing' || phase === 'wrong') && (
          <div style={{ position: 'relative', width: 'min(380px, 90vw)', minHeight: 300 }}>
            {data.map((cardData, absoluteIndex) => {
              if (removedCards.has(absoluteIndex)) return null;

              const isFirstVisible = absoluteIndex === firstVisibleIndex;
              const isExitingCard = absoluteIndex === exitingCardIndex;
              const cardRot = _isDesktopCard ? 0 : getRot(absoluteIndex);
              const cardShuffled = shuffleOptions(cardData, absoluteIndex);

              return (
                <div
                  key={absoluteIndex}
                  style={{
                    ...S.card,
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    transform: `rotate(${cardRot}deg)`,
                    animation: isFirstVisible && phase === 'wrong' ? 'mysteryCard_cardShake .5s ease' : 'none',
                    ['--card-r' as string]: `${cardRot}deg`,
                    background: isFirstVisible && phase === 'wrong' ? T.cardWrongBg : T.cardBg,
                    boxShadow: T.cardShadow,
                    cursor: isFirstVisible && cardData.type === 'story' && !isExitingCard ? 'pointer' : 'default',
                    zIndex: 1000 - absoluteIndex,
                    opacity: isExitingCard ? 0 : 1,
                    transition: isExitingCard ? 'opacity 0.3s ease' : 'none',
                    pointerEvents: isFirstVisible ? 'auto' : 'none',
                    WebkitTapHighlightColor: 'transparent',
                    userSelect: 'none',
                  }}
                  onClick={isFirstVisible && cardData.type === 'story' && !isExitingCard ? advance : undefined}
                >
                  <div style={{ ...S.cardInner, border: `1px solid ${T.cardBorder}` }}>
                    {cardData.act && <div style={{ ...S.actLabel, color: T.actColor }}>{tf(cardData.act)}</div>}

                    {cardData.type === 'story' && (
                      <>
                        <div style={{ ...S.storyText, color: T.textMain }}>{tf(cardData.text)}</div>
                      </>
                    )}

                    {cardData.type === 'choice' && cardShuffled && (() => {
                      const answerState = answeredCards.get(absoluteIndex);

                      if (!answerState) {
                        // 未回答：显示问题和选项
                        return (
                          <>
                            <div style={{ ...S.choiceIcon, color: T.actColor }}> ？</div>
                            <div style={{ ...S.choiceQuestion, color: T.textMain }}>{tf(cardData.text)}</div>
                            <div style={S.choiceRow}>
                              {(['A', 'B'] as const).map(opt => (
                                <button
                                  key={opt}
                                  style={{
                                    ...S.choiceBtn,
                                    border: `1px solid ${T.choiceBorder}`,
                                    color: T.textMain,
                                    WebkitTapHighlightColor: 'transparent',
                                    transition: 'none',
                                  }}
                                  onClick={isFirstVisible ? () => choose(opt, cardShuffled) : undefined}
                                  disabled={!isFirstVisible}
                                >
                                  <span style={{ ...S.choiceLetter, color: T.actColor }}>{opt}</span>
                                  <span style={S.choiceText}>
                                    {tf(opt === 'A' ? cardShuffled.optA : cardShuffled.optB)}
                                  </span>
                                </button>
                              ))}
                            </div>
                          </>
                        );
                      } else {
                        // 已回答：显示反馈
                        if (answerState.correct) {
                          return (
                            <>
                              <div style={{ ...S.storyText, color: T.textMain, marginBottom: 20 }}>{tf(cardData.verdict)}</div>
                              <button onClick={advance} style={{ ...S.startBtn, border: `1px solid ${T.actColor}`, color: T.actColor }}>
                                继续
                              </button>
                            </>
                          );
                        } else {
                          return (
                            <>
                              <div style={{ ...S.storyText, color: '#ef4444', fontSize: '1.1rem', marginBottom: 12 }}>✗ 判断有误</div>
                              <div style={{ ...S.overlayMsg, color: T.textMain, marginBottom: 12 }}>{tf(cardData.penalty)}</div>
                              {cardData.hint && (
                                <div style={{ ...S.overlayHint, color: T.textSub, border: `1px solid ${T.choiceBorder}`, marginBottom: 16 }}>
                                  <span style={{ color: T.actColor }}>提示：</span>{tf(cardData.hint)}
                                </div>
                              )}
                              <button onClick={dismissWrong} style={{ ...S.startBtn, border: `1px solid #ef4444`, color: '#ef4444' }}>
                                倒退十张，重新审视
                              </button>
                            </>
                          );
                        }
                      }
                    })()}
                  </div>
                  <div style={{ ...S.cardCornerTL, borderColor: T.cornerColor }} />
                  <div style={{ ...S.cardCornerBR, borderColor: T.cornerColor }} />
                </div>
              );
            })}
          </div>
        )}

        {/* Wrong answer overlay */}
        {phase === 'wrong' && (
          <div style={S.overlay}>
            <div style={{ ...S.overlayBox, background: T.cardBg, border: `1px solid ${T.cornerColor}` }}>
              <div style={{ ...S.overlayTitle, color: T.actColor }}>判断有误</div>
              <div style={{ ...S.overlayMsg, color: T.textMain }}>{penalty.msg}</div>
              {penalty.hint && (
                <div style={{ ...S.overlayHint, color: T.textSub, border: `1px solid ${T.choiceBorder}` }}>
                  <span style={{ color: T.actColor }}>提示：</span>{penalty.hint}
                </div>
              )}
              <div style={S.overlayLives}>
                {[0, 1, 2].map(i => (
                  <span key={i} style={{ color: i < lives ? T.actColor : T.dimColor, fontSize: 20 }}>◆</span>
                ))}
              </div>
              <button style={{ ...S.overlayBtn, background: T.btnBg, color: T.btnText }} onClick={dismissWrong}>倒退十张，重新审视</button>
            </div>
          </div>
        )}

        {/* Game over overlay */}
        {phase === 'gameover' && (
          <div style={S.overlay}>
            <div style={{ ...S.overlayBox, background: T.cardBg, border: `1px solid ${T.cornerColor}` }}>
              <div style={{ ...S.overlayTitle, color: '#c0392b' }}>线索断裂</div>
              <div style={{ ...S.overlayMsg, color: T.textMain }}>
                三次机会均已耗尽。<br />真凶已经将证据销毁干净。<br />这个案子，需要从头再来。
              </div>
              {penalty.msg && <div style={{ ...S.overlayMsg, color: T.textMain }}><em>{penalty.msg}</em></div>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 20 }}>
                <button style={{ ...S.overlayBtn, background: '#8B1A1A', color: '#F4EAD5' }} onClick={restart}>
                  重新开始
                </button>
                {onBack && (
                  <button style={{ ...S.overlayBtn, background: 'transparent', border: '1px solid #8B1A1A', color: '#c0392b' }} onClick={onBack}>
                    返回章节列表
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Victory overlay */}
        {phase === 'victory' && (
          <div style={{ ...S.overlay, background: '#0A0A0Fdd' }}>
            <div style={{ ...S.card, background: T.cardBg, boxShadow: T.cardShadow, transform: 'rotate(-1deg)', animation: 'mysteryCard_cardIn .8s ease', maxWidth: 380 }}>
              <div style={{ ...S.cardInner, border: `1px solid ${T.cardBorder}` }}>
                {card.act && <div style={{ ...S.actLabel, color: T.actColor }}>{tf(card.act)}</div>}
                <div style={{ ...S.storyText, color: T.textMain, whiteSpace: 'pre-line', lineHeight: 2 }}>
                  {tf(card.verdict || card.text)}
                </div>
                <div style={{ color: T.actColor, fontSize: '1.3rem', margin: '20px 0 8px', animation: 'mysteryCard_cardGlow 2s infinite' }}>
                  ✦ 故事完结 ✦
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                  {onVictory && (
                    <button style={{ ...S.startBtn, border: `1px solid ${T.actColor}`, color: T.actColor }} onClick={onVictory}>完成本章</button>
                  )}
                  <button style={{ ...S.startBtn, border: `1px solid ${T.dimColor}`, color: T.dimColor }} onClick={restart}>
                    再玩一次
                  </button>
                </div>
              </div>
              <div style={{ ...S.cardCornerTL, borderColor: T.cornerColor }} />
              <div style={{ ...S.cardCornerBR, borderColor: T.cornerColor }} />
            </div>
          </div>
        )}
      </div>
    </>
  );
}

interface Tone {
  rootBg: string;
  bgPattern: string;
  bgVignette: string;
  backBtnColor: string;
  cardBg: string;
  cardWrongBg: string;
  cardShadow: string;
  cardBorder: string;
  cornerColor: string;
  actColor: string;
  textMain: string;
  textSub: string;
  tapHintColor: string;
  choiceBorder: string;
  dimColor: string;
  btnBg: string;
  btnText: string;
}

const darkTone: Tone = {
  rootBg: '#0A0A0F',
  bgPattern: `
    linear-gradient(45deg, #ffffff04 25%, transparent 25%),
    linear-gradient(-45deg, #ffffff04 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #ffffff04 75%),
    linear-gradient(-45deg, transparent 75%, #ffffff04 75%)
  `,
  bgVignette: 'radial-gradient(ellipse at 50% 50%, transparent 30%, #0A0A0F 90%)',
  backBtnColor: '#C9A84C88',
  cardBg: '#1C1510',
  cardWrongBg: '#2A1010',
  cardShadow: '0 2px 4px #0008, 0 8px 20px #00000088, 0 20px 50px #00000055, inset 0 0 30px #0000001A',
  cardBorder: '#8B691466',
  cornerColor: '#8B6914AA',
  actColor: '#C9A84C',
  textMain: '#E8D5B0',
  textSub: '#A89070',
  tapHintColor: '#C9A84C44',
  choiceBorder: '#C9A84C44',
  dimColor: '#8B691466',
  btnBg: '#C9A84C',
  btnText: '#1C1510',
};

const lightTone: Tone = {
  rootBg: '#F0EAD6',
  bgPattern: `
    linear-gradient(45deg, #00000006 25%, transparent 25%),
    linear-gradient(-45deg, #00000006 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #00000006 75%),
    linear-gradient(-45deg, transparent 75%, #00000006 75%)
  `,
  bgVignette: 'radial-gradient(ellipse at 50% 50%, transparent 30%, #E8E0C8 90%)',
  backBtnColor: '#8B6914',
  cardBg: '#F4EAD5',
  cardWrongBg: '#F9E8E8',
  cardShadow: '0 2px 4px #0002, 0 8px 20px #00000022, 0 20px 50px #00000015, inset 0 0 30px #0000000A',
  cardBorder: '#C4A88266',
  cornerColor: '#C4A882AA',
  actColor: '#8B6914',
  textMain: '#2C1810',
  textSub: '#5A4A30',
  tapHintColor: '#8B691466',
  choiceBorder: '#8B691455',
  dimColor: '#8B691466',
  btnBg: '#2C1810',
  btnText: '#F4EAD5',
};

const S: Record<string, React.CSSProperties> = {
  root: {
    minHeight: '100vh',
    width: '100%',
    background: '#0A0A0F',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: "'STKaiti','KaiTi','FangSong','STSong','Playfair Display',Georgia,serif",
    position: 'relative',
    overflow: 'hidden',
    padding: '20px 16px',
    userSelect: 'none',
  },
  bgPattern: {
    position: 'absolute', inset: '0', zIndex: 0, pointerEvents: 'none',
    backgroundImage: `
      linear-gradient(45deg, #ffffff04 25%, transparent 25%),
      linear-gradient(-45deg, #ffffff04 25%, transparent 25%),
      linear-gradient(45deg, transparent 75%, #ffffff04 75%),
      linear-gradient(-45deg, transparent 75%, #ffffff04 75%)
    `,
    backgroundSize: '12px 12px',
  },
  bgVignette: {
    position: 'absolute', inset: '0', zIndex: 0, pointerEvents: 'none',
    background: 'radial-gradient(ellipse at 50% 50%, transparent 30%, #0A0A0F 90%)',
  },
  backBtn: {
    position: 'absolute', top: 16, left: 16, zIndex: 10,
    background: 'none', border: 'none',
    color: '#C9A84C88', cursor: 'pointer',
    fontSize: '0.8rem', letterSpacing: '0.1em',
    fontFamily: 'inherit', padding: '4px 8px',
  },
  lives: {
    position: 'absolute', bottom: 20, right: 20,
    display: 'flex', alignItems: 'center', gap: 6, zIndex: 10,
  },
  lifeGem: {
    color: '#C9A84C', fontSize: 16,
    transition: 'opacity .4s',
    textShadow: '0 0 8px #C9A84C88',
  },
  progress: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: 2, background: '#ffffff0d', zIndex: 10,
  },
  progressBar: {
    height: '100%',
    background: 'linear-gradient(90deg, #8B6914, #C9A84C)',
    transition: 'width .4s ease',
  },
  card: {
    position: 'relative',
    width: 'min(380px, 90vw)',
    minHeight: 300,
    background: '#F4EAD5',
    borderRadius: 4,
    boxShadow: `
      0 2px 4px #0006,
      0 8px 20px #00000055,
      0 20px 50px #00000033,
      inset 0 0 30px #0000000A
    `,
    zIndex: 1,
    padding: 0,
  },
  cardInner: {
    padding: '32px 28px 28px',
    border: '1px solid #C4A88266',
    margin: 8,
    height: 'calc(100% - 16px)',
    minHeight: 260,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 0,
  },
  cardCornerTL: {
    position: 'absolute', top: 10, left: 10,
    width: 18, height: 18,
    borderTop: '1.5px solid #C4A882AA',
    borderLeft: '1.5px solid #C4A882AA',
  },
  cardCornerBR: {
    position: 'absolute', bottom: 10, right: 10,
    width: 18, height: 18,
    borderBottom: '1.5px solid #C4A882AA',
    borderRight: '1.5px solid #C4A882AA',
  },
  actLabel: {
    color: '#8B6914', fontSize: '0.6rem',
    letterSpacing: '0.25em', textTransform: 'uppercase',
    marginBottom: 18, opacity: 0.85,
    fontFamily: "'Playfair Display', Georgia, serif",
  },
  storyText: {
    color: '#2C1810', fontSize: '1.05rem',
    lineHeight: 1.9, textAlign: 'center', letterSpacing: '0.06em',
  },
  tapHint: {
    color: '#8B691466', fontSize: '0.6rem',
    letterSpacing: '0.2em', marginTop: 24,
    fontFamily: 'Georgia, serif',
  },
  choiceIcon: {
    fontSize: '1.8rem', color: '#8B6914',
    marginBottom: 12, opacity: 0.6,
  },
  choiceQuestion: {
    color: '#2C1810', fontSize: '0.95rem',
    lineHeight: 1.8, textAlign: 'center',
    marginBottom: 20, letterSpacing: '0.05em',
  },
  choiceRow: {
    display: 'flex', flexDirection: 'column', gap: 10, width: '100%',
  },
  choiceBtn: {
    display: 'flex', alignItems: 'flex-start', gap: 10,
    background: 'transparent', border: '1px solid #8B691455',
    borderRadius: 3, padding: '10px 12px',
    cursor: 'pointer', textAlign: 'left',
    transition: 'all .2s', fontFamily: 'inherit',
    color: '#2C1810', width: '100%', outline: 'none',
  },
  choiceLetter: {
    fontFamily: "'Playfair Display', Georgia, serif",
    fontWeight: 700, color: '#8B6914',
    fontSize: '1rem', minWidth: 18, marginTop: 1,
  },
  choiceText: {
    fontSize: '0.88rem', lineHeight: 1.6, letterSpacing: '0.04em',
  },
  startBtn: {
    padding: '10px 24px', background: 'transparent',
    border: '1px solid #8B6914', color: '#8B6914',
    fontSize: '0.9rem', letterSpacing: '0.15em',
    cursor: 'pointer', fontFamily: 'inherit',
    borderRadius: 2, transition: 'all .2s',
  },
  overlay: {
    position: 'fixed', inset: '0', zIndex: 100,
    background: '#0A0A0Fcc',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    animation: 'mysteryCard_cardFadeIn .3s ease', padding: 20,
  },
  overlayBox: {
    background: '#F4EAD5', border: '1px solid #C4A882',
    borderRadius: 4, padding: '32px 28px',
    maxWidth: 360, width: '100%',
    textAlign: 'center', boxShadow: '0 20px 60px #000000AA',
  },
  overlayTitle: {
    color: '#8B6914', fontSize: '1.1rem',
    letterSpacing: '0.2em', marginBottom: 16,
    fontFamily: "'Playfair Display',Georgia,serif",
  },
  overlayMsg: {
    color: '#2C1810', fontSize: '0.9rem',
    lineHeight: 1.85, letterSpacing: '0.04em', marginBottom: 14,
  },
  overlayHint: {
    color: '#5A4A30', fontSize: '0.82rem', lineHeight: 1.8,
    background: '#00000008', border: '1px solid #C4A88244',
    borderRadius: 3, padding: '8px 12px',
    marginBottom: 16, letterSpacing: '0.04em',
  },
  overlayLives: {
    display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 20,
  },
  overlayBtn: {
    padding: '10px 22px', background: '#2C1810',
    color: '#F4EAD5', border: 'none', borderRadius: 3,
    fontSize: '0.88rem', letterSpacing: '0.12em',
    cursor: 'pointer', fontFamily: 'inherit',
  },
};
