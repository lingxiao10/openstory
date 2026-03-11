import { useState } from 'react';
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
}

const S = {
  root: {
    maxWidth: 700,
    margin: '0 auto',
    padding: '20px 20px 60px',
    fontFamily: 'Georgia, "Times New Roman", serif',
  } as React.CSSProperties,
  act: {
    textAlign: 'center' as const,
    color: '#6366f1',
    fontSize: 12,
    letterSpacing: 3,
    textTransform: 'uppercase' as const,
    marginBottom: 24,
    opacity: 0.8,
  },
  storyText: {
    color: '#e2e8f0',
    fontSize: 17,
    lineHeight: 1.9,
    marginBottom: 20,
  },
  clueBox: {
    background: '#1e293b',
    border: '1px solid #6366f155',
    borderRadius: 12,
    padding: '16px 20px',
    marginBottom: 16,
    color: '#a5b4fc',
    fontSize: 14,
    lineHeight: 1.7,
  },
  optionBtn: {
    display: 'block',
    width: '100%',
    background: '#1e293b',
    border: '1px solid #334155',
    borderRadius: 10,
    padding: '14px 20px',
    color: '#e2e8f0',
    fontSize: 15,
    textAlign: 'left' as const,
    cursor: 'pointer',
    marginBottom: 10,
    transition: 'all 0.2s',
    fontFamily: 'Georgia, serif',
  },
  nextBtn: {
    background: '#6366f1',
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    padding: '12px 32px',
    fontSize: 15,
    cursor: 'pointer',
    fontFamily: 'Georgia, serif',
    marginTop: 16,
  },
  verdict: {
    background: 'linear-gradient(135deg, #6366f122, #8b5cf622)',
    border: '1px solid #6366f1',
    borderRadius: 16,
    padding: '24px',
    textAlign: 'center' as const,
    marginTop: 20,
  },
};

export function MysteryEngine({ gameData }: Props) {
  const [index, setIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<'A' | 'B' | number | null>(null);
  const [feedback, setFeedback] = useState('');
  const [wrong, setWrong] = useState(false);
  const { tf, lang } = useI18n();

  const data = gameData.cards;
  const card = data[index] as Card;
  if (!card) return null;

  const advance = () => {
    setIndex(i => Math.min(i + 1, data.length - 1));
    setSelectedOption(null);
    setFeedback('');
    setWrong(false);
  };

  // Find the start of the current act (last card at or before index with an act label)
  const getActStart = () => {
    for (let i = index; i >= 0; i--) {
      if (data[i].act) return i;
    }
    return 0;
  };

  const restartAct = () => {
    setIndex(getActStart());
    setSelectedOption(null);
    setFeedback('');
    setWrong(false);
  };

  const goBack10 = () => {
    setIndex(i => Math.max(0, i - 10));
    setSelectedOption(null);
    setFeedback('');
    setWrong(false);
  };

  const handleOptAB = (opt: 'A' | 'B') => {
    setSelectedOption(opt);
    if (opt === card.correct) {
      setFeedback('✓ ' + (tf(card.hint) || (lang === 'en' ? 'Correct!' : '正确！')));
      setWrong(false);
    } else {
      setFeedback('✗ ' + (tf(card.penalty) || (lang === 'en' ? 'Wrong, try again.' : '选错了，继续推理。')));
      setWrong(true);
    }
  };

  const getNext = () => {
    if (typeof selectedOption === 'number' && card.options) {
      const opt = card.options[selectedOption];
      if (opt?.next !== undefined) {
        const nextIdx = data.findIndex(c => c.id === opt.next);
        setIndex(nextIdx >= 0 ? nextIdx : index + 1);
        setSelectedOption(null);
        setFeedback('');
        return;
      }
    }
    advance();
  };

  return (
    <div style={S.root}>
      {card.act && <div style={S.act}>{tf(card.act)}</div>}

      {card.type === 'story' && (
        <>
          <p style={S.storyText}>{tf(card.text)}</p>
          {index < data.length - 1 && (
            <button style={S.nextBtn} onClick={advance}>▶</button>
          )}
        </>
      )}

      {/* optA/optB format */}
      {card.type === 'choice' && card.optA && (
        <>
          <p style={S.storyText}>{tf(card.text)}</p>
          {(['A', 'B'] as const).map(opt => (
            <button
              key={opt}
              style={{
                ...S.optionBtn,
                background: selectedOption === opt ? (opt === card.correct ? '#16a34a22' : '#7f1d1d22') : '#1e293b',
                borderColor: selectedOption === opt ? (opt === card.correct ? '#22c55e' : '#ef4444') : '#334155',
                color: selectedOption === opt ? (opt === card.correct ? '#86efac' : '#fca5a5') : '#e2e8f0',
              }}
              onClick={() => handleOptAB(opt)}
            >
              {opt}. {tf(opt === 'A' ? card.optA : card.optB)}
            </button>
          ))}
          {feedback && (
            <div style={{
              padding: '12px 16px', borderRadius: 10, marginTop: 8,
              background: selectedOption === card.correct ? '#16a34a22' : '#7f1d1d22',
              color: selectedOption === card.correct ? '#86efac' : '#fca5a5',
              fontSize: 14, lineHeight: 1.7,
            }}>
              {feedback}
            </div>
          )}
          {selectedOption === card.correct && (
            <button style={{ ...S.nextBtn, marginTop: 16 }} onClick={advance}>
              {lang === 'en' ? 'Continue' : '继续'}
            </button>
          )}
          {wrong && (
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button style={retryBtnStyle} onClick={goBack10}>
                {lang === 'en' ? '← Back 10 cards' : '← 回退10张'}
              </button>
              <button style={retryBtnStyle} onClick={restartAct}>
                {lang === 'en' ? '↺ Restart chapter' : '↺ 重新开始本章'}
              </button>
            </div>
          )}
        </>
      )}

      {/* generic options[] format */}
      {card.type === 'choice' && card.options && !card.optA && (
        <>
          <p style={S.storyText}>{tf(card.text)}</p>
          {card.options.map((opt, i) => (
            <button
              key={i}
              style={{
                ...S.optionBtn,
                background: selectedOption === i ? '#6366f133' : '#1e293b',
                borderColor: selectedOption === i ? '#6366f1' : '#334155',
                color: selectedOption === i ? '#a5b4fc' : '#e2e8f0',
              }}
              onClick={() => setSelectedOption(i)}
            >
              {String.fromCharCode(65 + i)}. {tf(opt.text)}
            </button>
          ))}
          {typeof selectedOption === 'number' && (
            <button style={S.nextBtn} onClick={getNext}>{lang === 'en' ? 'Confirm' : '确认'}</button>
          )}
        </>
      )}

      {(card.type === 'verdict' || card.type === 'victory') && (
        <div style={S.verdict}>
          <div style={{ fontSize: 24, marginBottom: 12 }}>⚖️</div>
          <h3 style={{ color: '#a5b4fc', marginBottom: 12 }}>{lang === 'en' ? 'VERDICT' : '最终推理'}</h3>
          <p style={{ color: '#e2e8f0', lineHeight: 1.8 }}>{tf(card.verdict || card.text)}</p>
          {index < data.length - 1 && (
            <button style={{ ...S.nextBtn, marginTop: 20 }} onClick={advance}>▶</button>
          )}
        </div>
      )}

      {/* Progress dots */}
      <div style={{ position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 4 }}>
        {data.slice(0, Math.min(data.length, 24)).map((_, i) => (
          <div key={i} style={{
            width: i === index ? 20 : 6, height: 6, borderRadius: 3,
            background: i === index ? '#6366f1' : i < index ? '#334155' : '#1e293b',
            transition: 'all 0.3s',
          }} />
        ))}
      </div>
    </div>
  );
}

const retryBtnStyle: React.CSSProperties = {
  background: '#1e293b',
  border: '1px solid #ef444466',
  borderRadius: 10,
  padding: '10px 18px',
  color: '#fca5a5',
  fontSize: 13,
  cursor: 'pointer',
  fontFamily: 'Georgia, serif',
  flex: 1,
};
