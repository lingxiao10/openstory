/**
 * StreamMysteryEngine — MysteryCardEngine 的流式变体
 *
 * 与原引擎唯一区别：
 *  - 接收 isWaiting prop（AI 仍在生成，玩家到达当前最后一张卡）
 *  - 当 showWaiting=true 时，把 tapHint 改成"— 正在生成下一幕 —"（带脉冲动画）
 *  - advance() 行为不变（Math.min 确保玩家停在最后一张，等新卡到来后自然可以前进）
 */
import { useState, useCallback, useMemo, useEffect } from 'react';
import { useI18n } from '../../i18n';
import { BilingualText } from '../../i18n/translations';
import { useAudio } from '../../components/AudioManager';

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
  verdict?: BilingualText;
}

interface GameData {
  cards: Card[];
}

interface Props {
  gameData: GameData;
  isWaiting?: boolean;
  onVictory?: () => void;
  onBack?: () => void;
}

const ROTS = [-2.3, 1.8, -1.2, 2.7, -3.1, 0.9, 2.0, -1.7, 3.2, -0.8, 1.5, -2.5, -0.4, 2.2, -1.9, 1.1];
const getRot = (i: number) => ROTS[((i % ROTS.length) + ROTS.length) % ROTS.length] * 0.4;

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
  @keyframes cardShake {
    0%,100% { transform: translateX(0) rotate(var(--card-r, 0deg)); }
    18%  { transform: translateX(-10px) rotate(var(--card-r, 0deg)); }
    36%  { transform: translateX(10px)  rotate(var(--card-r, 0deg)); }
    54%  { transform: translateX(-6px)  rotate(var(--card-r, 0deg)); }
    72%  { transform: translateX(6px)   rotate(var(--card-r, 0deg)); }
  }
  @keyframes cardGlow {
    0%,100% { text-shadow: 0 0 8px #C9A84C66; }
    50%     { text-shadow: 0 0 22px #C9A84CAA, 0 0 4px #fff3; }
  }
  @keyframes cardFadeIn { from { opacity: 0 } to { opacity: 1 } }
  @keyframes waitPulse {
    0%,100% { opacity: 0.4; }
    50%     { opacity: 1; }
  }
`;

type CardTone = 'dark' | 'light';

export function StreamMysteryEngine({ gameData, isWaiting = false, onVictory, onBack }: Props) {
  const { t, tf } = useI18n();
  const { playClick, toggleBgm, bgmEnabled, bgmVolume, setBgmVolume } = useAudio();
  const data = gameData.cards;

  const [index, setIndex] = useState(0);
  const [lives, setLives] = useState(3);
  const [phase, setPhase] = useState<'playing' | 'wrong' | 'gameover' | 'victory'>('playing');
  const [penalty, setPenalty] = useState({ msg: '', hint: '' });
  const [cardKey, setCardKey] = useState(0);
  const [pendingAdvance, setPendingAdvance] = useState(false); // 正确答案已选但下一张卡未到
  const [cardTone, setCardTone] = useState<CardTone>(
    () => (localStorage.getItem('card_tone') as CardTone) || 'dark'
  );
  const [settingsOpen, setSettingsOpen] = useState(false);

  const toggleTone = () => {
    const next: CardTone = cardTone === 'dark' ? 'light' : 'dark';
    setCardTone(next);
    localStorage.setItem('card_tone', next);
  };

  const T = cardTone === 'dark' ? darkTone : lightTone;

  const card = data[index] as Card | undefined;
  const nextCard = data[index + 1] as Card | undefined;
  const rot = getRot(index);
  const nextRot = getRot(index + 1);

  // Derived: should we show the waiting hint?
  const showWaiting = (isWaiting || pendingAdvance) && index === data.length - 1 && card?.type !== 'victory' && card?.type !== 'verdict';

  // 正确答案已选，等新卡到来后自动前进
  useEffect(() => {
    if (pendingAdvance && data.length > index + 1) {
      setPendingAdvance(false);
      setIndex(index + 1);
    }
  }, [pendingAdvance, data.length, index]);

  // 防止 SSE 重连导致 cards 重置后 index 越界 → 空白屏
  useEffect(() => {
    if (data.length > 0 && index >= data.length) {
      setIndex(data.length - 1);
    }
  }, [data.length, index]);

  useEffect(() => {
    if (card?.type === 'victory' || card?.type === 'verdict') {
      if (index >= data.length - 1) {
        const t = setTimeout(() => setPhase('victory'), 900);
        return () => clearTimeout(t);
      }
    }
  }, [index, card, data.length]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const shuffledAB = useMemo(() => {
    if (!card || card.type !== 'choice' || !card.optA) return null;
    const swap = Math.random() < 0.5;
    if (!swap) return { optA: card.optA, optB: card.optB, correct: card.correct };
    return { optA: card.optB, optB: card.optA, correct: card.correct === 'A' ? ('B' as const) : ('A' as const) };
  }, [index]); // eslint-disable-line react-hooks/exhaustive-deps

  const advance = useCallback(() => {
    playClick();
    if (index >= data.length - 1) {
      setPendingAdvance(true);
      return;
    }
    setIndex(i => i + 1);
  }, [data.length, index, playClick]);

  const choose = useCallback((opt: 'A' | 'B') => {
    if (phase !== 'playing' || !card || card.type !== 'choice' || !shuffledAB) return;
    playClick();
    if (opt === shuffledAB.correct) {
      if (index >= data.length - 1) {
        // 下一张卡还没到，先标记等待
        setPendingAdvance(true);
      } else {
        advance();
      }
    } else {
      const nl = lives - 1;
      setLives(nl);
      setPenalty({ msg: tf(card.penalty) || t('game_wrongJudgment'), hint: tf(card.hint) || '' });
      setPhase(nl <= 0 ? 'gameover' : 'wrong');
    }
  }, [phase, card, shuffledAB, lives, advance, tf, index, data.length]);

  const dismissWrong = useCallback(() => {
    setPhase('playing');
    setCardKey(k => k + 1);
    setIndex(i => Math.max(0, i - 10));
  }, []);

  const restart = useCallback(() => {
    setIndex(0);
    setLives(3);
    setPhase('playing');
    setPenalty({ msg: '', hint: '' });
    setCardKey(k => k + 1);
  }, []);

  if (!card) return <div style={{ minHeight: '100vh', background: '#0A0A0F' }} />;

  return (
    <>
      <style>{FONT_CSS}</style>
      <div style={{ ...S.root, background: T.rootBg }}>
        <div style={{ ...S.bgPattern, backgroundImage: T.bgPattern }} />
        <div style={{ ...S.bgVignette, background: T.bgVignette }} />

        {onBack && phase !== 'victory' && (
          <button onClick={onBack} style={{ ...S.backBtn, color: T.backBtnColor }}>← {t('game_back')}</button>
        )}

        {phase !== 'victory' && (
          <div style={{ position: 'absolute', top: 12, right: 16, zIndex: 20 }}>
            <button onClick={() => setSettingsOpen(o => !o)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', color: T.backBtnColor, padding: '4px 6px' }}>⚙</button>
            {settingsOpen && (
              <div style={{ position: 'absolute', top: 32, right: 0, background: T.cardBg, border: `1px solid ${T.cardBorder}`, borderRadius: 6, padding: '12px 14px', minWidth: 160, boxShadow: T.cardShadow }} onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <span style={{ color: T.textMain, fontSize: '0.75rem' }}>{t(bgmEnabled ? 'game_bgmOn' : 'game_bgmOff')}</span>
                  <button onClick={toggleBgm} style={{ background: bgmEnabled ? T.actColor : T.dimColor, border: 'none', borderRadius: 10, width: 36, height: 20, cursor: 'pointer', position: 'relative' }}>
                    <span style={{ position: 'absolute', top: 2, left: bgmEnabled ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left .2s' }} />
                  </button>
                </div>
                <div style={{ marginBottom: 10 }}>
                  <div style={{ color: T.textSub, fontSize: '0.65rem', marginBottom: 4 }}>{t('game_volume')}</div>
                  <input type="range" min="0" max="1" step="0.05" value={bgmVolume} onChange={e => setBgmVolume(parseFloat(e.target.value))} style={{ width: '100%', accentColor: T.actColor }} />
                </div>
                <button onClick={toggleTone} style={{ background: 'none', border: `1px solid ${T.cardBorder}`, borderRadius: 4, color: T.textMain, fontSize: '0.7rem', padding: '4px 8px', cursor: 'pointer', width: '100%', fontFamily: 'inherit' }}>
                  {cardTone === 'dark' ? t('game_lightMode') : t('game_darkMode')}
                </button>
              </div>
            )}
          </div>
        )}

        {phase !== 'victory' && (
          <div style={S.lives}>
            {[0, 1, 2].map(i => (
              <span key={i} style={{ ...S.lifeGem, opacity: i < lives ? 1 : 0.18 }}>◆</span>
            ))}
          </div>
        )}


        {/* Waiting badge */}
        {showWaiting && (
          <div style={S.waitBadge}>
            <span style={{ animation: 'waitPulse 1.4s ease infinite' }}>⧗</span> {t('game_generatingNext').replace('⧗ ', '')}
          </div>
        )}

        {(phase === 'playing' || phase === 'wrong') && card && (
          <div
            key={cardKey}
            style={{
              ...S.card,
              transform: `rotate(${rot}deg)`,
              animation: phase === 'wrong' ? 'cardShake .5s ease' : 'cardIn .2s ease',
              ['--card-r' as string]: `${rot}deg`,
              background: phase === 'wrong' ? T.cardWrongBg : T.cardBg,
              boxShadow: T.cardShadow,
            }}
            onClick={card.type === 'story' ? advance : undefined}
          >
            <div style={{ ...S.cardInner, border: `1px solid ${T.cardBorder}` }}>
              {card.act && <div style={{ ...S.actLabel, color: T.actColor }}>{tf(card.act)}</div>}

              {card.type === 'story' && (
                <>
                  <div style={{ ...S.storyText, color: T.textMain }}>{tf(card.text)}</div>
                  <div style={{
                    ...S.tapHint,
                    color: showWaiting ? T.actColor : T.tapHintColor,
                    animation: showWaiting ? 'waitPulse 1.4s ease infinite' : undefined,
                  }}>
                    {showWaiting ? t('game_generating') : t('game_tapToContinue')}
                  </div>
                </>
              )}

              {card.type === 'choice' && shuffledAB && (
                <>
                  <div style={{ ...S.choiceIcon, color: T.actColor }}> ？</div>
                  <div style={{ ...S.choiceQuestion, color: T.textMain }}>{tf(card.text)}</div>
                  {pendingAdvance ? (
                    <div style={{ ...S.tapHint, color: T.actColor, animation: 'waitPulse 1.4s ease infinite', marginTop: 16 }}>
                      {t('game_generatingNext')}
                    </div>
                  ) : (
                    <div style={S.choiceRow}>
                      {(['A', 'B'] as const).map(opt => (
                        <button key={opt} style={{ ...S.choiceBtn, border: `1px solid ${T.choiceBorder}`, color: T.textMain }} onClick={() => choose(opt)}>
                          <span style={{ ...S.choiceLetter, color: T.actColor }}>{opt}</span>
                          <span style={S.choiceText}>
                            {tf(opt === 'A' ? shuffledAB.optA : shuffledAB.optB)}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
            <div style={{ ...S.cardCornerTL, borderColor: T.cornerColor }} />
            <div style={{ ...S.cardCornerBR, borderColor: T.cornerColor }} />
          </div>
        )}

        {phase === 'wrong' && (
          <div style={S.overlay}>
            <div style={{ ...S.overlayBox, background: T.cardBg, border: `1px solid ${T.cornerColor}` }}>
              <div style={{ ...S.overlayTitle, color: T.actColor }}>{t('game_wrongJudgment')}</div>
              <div style={{ ...S.overlayMsg, color: T.textMain }}>{penalty.msg}</div>
              {penalty.hint && (
                <div style={{ ...S.overlayHint, color: T.textSub, border: `1px solid ${T.choiceBorder}` }}>
                  <span style={{ color: T.actColor }}>{t('game_hint')}</span>{penalty.hint}
                </div>
              )}
              <div style={S.overlayLives}>
                {[0, 1, 2].map(i => (
                  <span key={i} style={{ color: i < lives ? T.actColor : T.dimColor, fontSize: 20 }}>◆</span>
                ))}
              </div>
              <button style={{ ...S.overlayBtn, background: T.btnBg, color: T.btnText }} onClick={dismissWrong}>{t('game_backTen')}</button>
            </div>
          </div>
        )}

        {phase === 'gameover' && (
          <div style={S.overlay}>
            <div style={{ ...S.overlayBox, background: T.cardBg, border: `1px solid ${T.cornerColor}` }}>
              <div style={{ ...S.overlayTitle, color: '#c0392b' }}>{t('game_cluesBroken')}</div>
              <div style={{ ...S.overlayMsg, color: T.textMain }} dangerouslySetInnerHTML={{ __html: t('game_allChancesLost') }} />
              {penalty.msg && <div style={{ ...S.overlayMsg, color: T.textMain }}><em>{penalty.msg}</em></div>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 20 }}>
                <button style={{ ...S.overlayBtn, background: '#8B1A1A', color: '#F4EAD5' }} onClick={restart}>{t('game_restart')}</button>
                {onBack && (
                  <button style={{ ...S.overlayBtn, background: 'transparent', border: '1px solid #8B1A1A', color: '#c0392b' }} onClick={onBack}>{t('game_back')}</button>
                )}
              </div>
            </div>
          </div>
        )}

        {phase === 'victory' && (
          <div style={{ ...S.overlay, background: '#0A0A0Fdd' }}>
            <div style={{ ...S.card, background: T.cardBg, boxShadow: T.cardShadow, transform: 'rotate(-1deg)', animation: 'cardIn .8s ease', maxWidth: 380 }}>
              <div style={{ ...S.cardInner, border: `1px solid ${T.cardBorder}` }}>
                {card.act && <div style={{ ...S.actLabel, color: T.actColor }}>{tf(card.act)}</div>}
                <div style={{ ...S.storyText, color: T.textMain, whiteSpace: 'pre-line', lineHeight: 2 }}>
                  {tf(card.verdict || card.text)}
                </div>
                <div style={{ color: T.actColor, fontSize: '1.3rem', margin: '20px 0 8px', animation: 'cardGlow 2s infinite' }}>
                  {t('game_chapterComplete')}
                </div>
                {onVictory && (
                  <button style={{ ...S.startBtn, border: `1px solid ${T.actColor}`, color: T.actColor, marginTop: 8 }} onClick={onVictory}>{t('game_nextChapter')}</button>
                )}
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
  rootBg: string; bgPattern: string; bgVignette: string; backBtnColor: string;
  cardBg: string; cardWrongBg: string; cardShadow: string; cardBorder: string;
  cornerColor: string; actColor: string; textMain: string; textSub: string;
  tapHintColor: string; choiceBorder: string; dimColor: string; btnBg: string; btnText: string;
}

const darkTone: Tone = {
  rootBg: '#0A0A0F', bgPattern: 'linear-gradient(45deg,#ffffff04 25%,transparent 25%),linear-gradient(-45deg,#ffffff04 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#ffffff04 75%),linear-gradient(-45deg,transparent 75%,#ffffff04 75%)',
  bgVignette: 'radial-gradient(ellipse at 50% 50%,transparent 30%,#0A0A0F 90%)', backBtnColor: '#C9A84C88',
  cardBg: '#1C1510', cardWrongBg: '#2A1010', cardShadow: '0 2px 4px #0008,0 8px 20px #00000088,0 20px 50px #00000055,inset 0 0 30px #0000001A',
  cardBorder: '#8B691466', cornerColor: '#8B6914AA', actColor: '#C9A84C', textMain: '#E8D5B0', textSub: '#A89070',
  tapHintColor: '#C9A84C44', choiceBorder: '#C9A84C44', dimColor: '#8B691466', btnBg: '#C9A84C', btnText: '#1C1510',
};

const lightTone: Tone = {
  rootBg: '#F0EAD6', bgPattern: 'linear-gradient(45deg,#00000006 25%,transparent 25%),linear-gradient(-45deg,#00000006 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#00000006 75%),linear-gradient(-45deg,transparent 75%,#00000006 75%)',
  bgVignette: 'radial-gradient(ellipse at 50% 50%,transparent 30%,#E8E0C8 90%)', backBtnColor: '#8B6914',
  cardBg: '#F4EAD5', cardWrongBg: '#F9E8E8', cardShadow: '0 2px 4px #0002,0 8px 20px #00000022,0 20px 50px #00000015,inset 0 0 30px #0000000A',
  cardBorder: '#C4A88266', cornerColor: '#C4A882AA', actColor: '#8B6914', textMain: '#2C1810', textSub: '#5A4A30',
  tapHintColor: '#8B691466', choiceBorder: '#8B691455', dimColor: '#8B691466', btnBg: '#2C1810', btnText: '#F4EAD5',
};

const S: Record<string, React.CSSProperties> = {
  root: { minHeight: '100vh', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: "'STKaiti','KaiTi','FangSong','STSong','Playfair Display',Georgia,serif", position: 'relative', overflow: 'hidden', padding: '20px 16px', userSelect: 'none' },
  bgPattern: { position: 'absolute', inset: '0', zIndex: 0, pointerEvents: 'none', backgroundSize: '12px 12px' },
  bgVignette: { position: 'absolute', inset: '0', zIndex: 0, pointerEvents: 'none' },
  backBtn: { position: 'absolute', top: 16, left: 16, zIndex: 10, background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem', letterSpacing: '0.1em', fontFamily: 'inherit', padding: '4px 8px' },
  lives: { position: 'absolute', bottom: 20, right: 20, display: 'flex', alignItems: 'center', gap: 6, zIndex: 10 },
  lifeGem: { color: '#C9A84C', fontSize: 16, transition: 'opacity .4s', textShadow: '0 0 8px #C9A84C88' },
  progress: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, background: '#ffffff0d', zIndex: 10 },
  progressBar: { height: '100%', background: 'linear-gradient(90deg,#8B6914,#C9A84C)', transition: 'width .4s ease' },
  waitBadge: { position: 'absolute', top: 54, left: '50%', transform: 'translateX(-50%)', zIndex: 20, background: '#C9A84C22', border: '1px solid #C9A84C55', borderRadius: 20, padding: '4px 14px', color: '#C9A84C', fontSize: '0.72rem', letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' },
  card: { position: 'relative', width: 'min(380px, 90vw)', minHeight: 320, borderRadius: 4, zIndex: 1, padding: 0 },
  cardInner: { padding: '32px 28px 28px', margin: 8, height: 'calc(100% - 16px)', minHeight: 280, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 0 },
  cardCornerTL: { position: 'absolute', top: 10, left: 10, width: 18, height: 18, borderTop: '1.5px solid', borderLeft: '1.5px solid' },
  cardCornerBR: { position: 'absolute', bottom: 10, right: 10, width: 18, height: 18, borderBottom: '1.5px solid', borderRight: '1.5px solid' },
  actLabel: { fontSize: '0.6rem', letterSpacing: '0.25em', textTransform: 'uppercase', marginBottom: 18, opacity: 0.85, fontFamily: "'Playfair Display', Georgia, serif" },
  storyText: { fontSize: '1.05rem', lineHeight: 1.9, textAlign: 'center', letterSpacing: '0.06em' },
  tapHint: { fontSize: '0.6rem', letterSpacing: '0.2em', marginTop: 24, fontFamily: 'Georgia, serif' },
  choiceIcon: { fontSize: '1.8rem', marginBottom: 12, opacity: 0.6 },
  choiceQuestion: { fontSize: '0.95rem', lineHeight: 1.8, textAlign: 'center', marginBottom: 20, letterSpacing: '0.05em' },
  choiceRow: { display: 'flex', flexDirection: 'column', gap: 10, width: '100%' },
  choiceBtn: { display: 'flex', alignItems: 'flex-start', gap: 10, background: 'transparent', borderRadius: 3, padding: '15px 12px', textAlign: 'left', fontFamily: 'inherit', width: '100%', outline: 'none', WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation' },
  choiceLetter: { fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700, fontSize: '1rem', minWidth: 18, marginTop: 1 },
  choiceText: { fontSize: '0.88rem', lineHeight: 1.6, letterSpacing: '0.04em' },
  startBtn: { padding: '10px 24px', background: 'transparent', fontSize: '0.9rem', letterSpacing: '0.15em', cursor: 'pointer', fontFamily: 'inherit', borderRadius: 2, transition: 'all .2s' },
  overlay: { position: 'fixed', inset: '0', zIndex: 100, background: '#0A0A0Fcc', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'cardFadeIn .3s ease', padding: 20 },
  overlayBox: { borderRadius: 4, padding: '32px 28px', maxWidth: 360, width: '100%', textAlign: 'center', boxShadow: '0 20px 60px #000000AA' },
  overlayTitle: { fontSize: '1.1rem', letterSpacing: '0.2em', marginBottom: 16, fontFamily: "'Playfair Display',Georgia,serif" },
  overlayMsg: { fontSize: '0.9rem', lineHeight: 1.85, letterSpacing: '0.04em', marginBottom: 14 },
  overlayHint: { fontSize: '0.82rem', lineHeight: 1.8, background: '#00000008', borderRadius: 3, padding: '8px 12px', marginBottom: 16, letterSpacing: '0.04em' },
  overlayLives: { display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 20 },
  overlayBtn: { padding: '10px 22px', border: 'none', borderRadius: 3, fontSize: '0.88rem', letterSpacing: '0.12em', cursor: 'pointer', fontFamily: 'inherit' },
};
