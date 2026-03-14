/**
 * StreamGamePage — "边看边生成" 主页面
 *
 * 状态机:
 *   connecting → outline_received → playing → (chapter_done × N) → all_done
 *
 * SSE 事件消费:
 *   outline      → 设置章节大纲预览
 *   meta         → 设置 numeric GameData 元数据
 *   node         → 追加到对应章节的 cards 数组
 *   chapter_done → 标记章节完成
 *   chapter_error→ 标记章节出错，提供重试按钮
 *   done         → 所有章节生成完毕
 *   error        → 全局错误
 *
 * 玩家流程:
 *   第 1 章卡片到来 → 立即可以开始玩
 *   玩到最后一张卡（非 victory）且 isGenerating=true → 引擎显示"等待生成"提示
 *   玩家点击 onVictory（章节完成）→ currentChapterIdx 前进
 *   多章节自然过渡（过渡屏显示下一章大纲）
 */

import { useState, useEffect, useRef, useContext, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AuthContext } from '../store/authStore';
import { StreamMysteryEngine } from '../games/mystery/StreamMysteryEngine';
import { StreamNumericEngine } from '../games/numeric/StreamNumericEngine';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface ChapterState {
  num: number;
  outlineZh: string;
  cards: any[];
  numericMeta: any | null;
  isDone: boolean;
  hasError: boolean;
  errorMsg: string;
}

type PagePhase = 'connecting' | 'outline' | 'playing' | 'transition' | 'all_done' | 'fatal_error';

// ─── Component ─────────────────────────────────────────────────────────────────

export function StreamGamePage() {
  const { storyId } = useParams<{ storyId: string }>();
  const navigate = useNavigate();
  const { token } = useContext(AuthContext);

  const [phase, setPhase] = useState<PagePhase>('connecting');
  const [chapters, setChapters] = useState<ChapterState[]>([]);
  const [currentChapterIdx, setCurrentChapterIdx] = useState(0);
  const [isGenerating, setIsGenerating] = useState(true);
  const [fatalError, setFatalError] = useState('');
  const [genre, setGenre] = useState<'mystery' | 'numeric'>('mystery');

  const sseRef = useRef<EventSource | null>(null);
  const chaptersRef = useRef<ChapterState[]>([]); // mutable ref for SSE callbacks

  // Keep ref in sync with state
  useEffect(() => { chaptersRef.current = chapters; }, [chapters]);

  // ── SSE connection ───────────────────────────────────────────────────────────

  const connectSse = useCallback(() => {
    if (!storyId || !token) return;
    if (sseRef.current) sseRef.current.close();

    const url = `/api/stream-game/${storyId}/events?token=${encodeURIComponent(token)}`;
    const sse = new EventSource(url);
    sseRef.current = sse;

    sse.addEventListener('outline', (e) => {
      const { chapters: outlineList } = JSON.parse(e.data) as {
        chapters: Array<{ num: number; zh: string; en: string }>;
      };
      const initialChapters: ChapterState[] = outlineList.map(o => ({
        num: o.num,
        outlineZh: o.zh,
        cards: [],
        numericMeta: null,
        isDone: false,
        hasError: false,
        errorMsg: '',
      }));
      setChapters(initialChapters);
      chaptersRef.current = initialChapters;
      setPhase('playing');
    });

    sse.addEventListener('meta', (e) => {
      const { chapter, meta } = JSON.parse(e.data) as { chapter: number; meta: any };
      // Detect genre from meta presence
      if (meta?.statDefs) setGenre('numeric');
      setChapters(prev => prev.map(c =>
        c.num === chapter ? { ...c, numericMeta: meta } : c
      ));
    });

    sse.addEventListener('node', (e) => {
      const { chapter, node } = JSON.parse(e.data) as { chapter: number; node: any };
      if (chaptersRef.current.length === 0) return; // outline not yet received
      setChapters(prev => prev.map(c =>
        c.num === chapter ? { ...c, cards: [...c.cards, node] } : c
      ));
    });

    sse.addEventListener('chapter_done', (e) => {
      const { chapter } = JSON.parse(e.data) as { chapter: number };
      setChapters(prev => prev.map(c =>
        c.num === chapter ? { ...c, isDone: true } : c
      ));
    });

    sse.addEventListener('chapter_error', (e) => {
      const { chapter, message } = JSON.parse(e.data) as { chapter: number; message: string };
      setChapters(prev => prev.map(c =>
        c.num === chapter ? { ...c, hasError: true, errorMsg: message } : c
      ));
    });

    sse.addEventListener('done', () => {
      setIsGenerating(false);
    });

    sse.addEventListener('error', (e: any) => {
      try {
        const data = JSON.parse(e.data ?? '{}');
        setFatalError(data.message || '生成出错');
      } catch {
        setFatalError('连接中断');
      }
      setPhase('fatal_error');
      setIsGenerating(false);
    });

    sse.onerror = () => {
      // EventSource auto-reconnects; we just log
      console.warn('[StreamGame] SSE connection error, will retry');
    };
  }, [storyId, token]);

  useEffect(() => {
    connectSse();
    return () => { sseRef.current?.close(); };
  }, [connectSse]);

  // ── Chapter navigation ───────────────────────────────────────────────────────

  const handleVictory = useCallback(() => {
    const nextIdx = currentChapterIdx + 1;
    if (nextIdx >= chapters.length) {
      setPhase('all_done');
      return;
    }
    // Show transition screen briefly, then jump to next chapter
    setPhase('transition');
    setTimeout(() => {
      setCurrentChapterIdx(nextIdx);
      setPhase('playing');
    }, 2200);
  }, [currentChapterIdx, chapters.length]);

  const handleRetry = useCallback(async (chapterNum: number) => {
    if (!storyId || !token) return;
    await fetch(`/api/stream-game/${storyId}/retry/${chapterNum}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    setChapters(prev => prev.map(c =>
      c.num === chapterNum ? { ...c, hasError: false, errorMsg: '', cards: [] } : c
    ));
    setIsGenerating(true);
  }, [storyId, token]);

  // ── Derived ──────────────────────────────────────────────────────────────────

  const currentChapter = chapters[currentChapterIdx];
  const isCurrentDone = currentChapter?.isDone ?? false;
  // isWaiting = chapter is still generating AND has at least 1 card so engine is running
  const isWaiting = isGenerating && !isCurrentDone && (currentChapter?.cards.length ?? 0) > 0;

  // ── Render ───────────────────────────────────────────────────────────────────

  if (phase === 'connecting') {
    return <LoadingScreen message="正在连接，生成故事大纲中…" onBack={() => navigate('/my-stories')} />;
  }

  if (phase === 'fatal_error') {
    return (
      <ErrorScreen
        message={fatalError}
        onBack={() => navigate('/my-stories')}
        onRetry={connectSse}
      />
    );
  }

  if (phase === 'transition' && currentChapter) {
    const next = chapters[currentChapterIdx + 1];
    return <ChapterTransitionScreen chapterNum={(next?.num ?? currentChapterIdx + 2)} outlineZh={next?.outlineZh ?? ''} />;
  }

  if (phase === 'all_done') {
    return <AllDoneScreen onBack={() => navigate('/my-stories')} />;
  }

  if (!currentChapter) {
    return <LoadingScreen message="加载章节中…" onBack={() => navigate('/my-stories')} />;
  }

  // Show chapter error
  if (currentChapter.hasError) {
    return (
      <ErrorScreen
        message={`第 ${currentChapter.num} 章生成失败：${currentChapter.errorMsg}`}
        onBack={() => navigate('/my-stories')}
        onRetry={() => handleRetry(currentChapter.num)}
      />
    );
  }

  // No cards yet — show waiting skeleton
  if (currentChapter.cards.length === 0) {
    return (
      <LoadingScreen
        message={`第 ${currentChapter.num} 章生成中…`}
        subMessage={currentChapter.outlineZh}
        onBack={() => navigate('/my-stories')}
      />
    );
  }

  // Playing
  if (genre === 'numeric') {
    const numericGameData = {
      title: currentChapter.numericMeta?.title ?? { zh: `第 ${currentChapter.num} 章`, en: `Chapter ${currentChapter.num}` },
      description: currentChapter.numericMeta?.description ?? { zh: '', en: '' },
      statDefs: currentChapter.numericMeta?.statDefs ?? {},
      itemDefs: currentChapter.numericMeta?.itemDefs ?? {},
      cards: currentChapter.cards,
      winText: currentChapter.numericMeta?.winText,
    };
    // Wait for meta before rendering (statDefs needed)
    if (!currentChapter.numericMeta) {
      return <LoadingScreen message="加载章节数据…" onBack={() => navigate('/my-stories')} />;
    }
    return (
      <StreamNumericEngine
        gameData={numericGameData}
        isWaiting={isWaiting}
        onVictory={handleVictory}
      />
    );
  }

  // Mystery (default)
  return (
    <StreamMysteryEngine
      gameData={{ cards: currentChapter.cards }}
      isWaiting={isWaiting}
      onVictory={handleVictory}
      onBack={() => navigate('/my-stories')}
    />
  );
}

// ─── Sub-screens ───────────────────────────────────────────────────────────────

function LoadingScreen({ message, subMessage, onBack }: { message: string; subMessage?: string; onBack: () => void }) {
  return (
    <div style={SS.root}>
      <div style={SS.spinner} />
      <div style={SS.msg}>{message}</div>
      {subMessage && (
        <div style={SS.sub}>{subMessage.slice(0, 80)}{subMessage.length > 80 ? '…' : ''}</div>
      )}
      <button onClick={onBack} style={SS.backBtn}>← 返回</button>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function ErrorScreen({ message, onBack, onRetry }: { message: string; onBack: () => void; onRetry?: () => void }) {
  return (
    <div style={SS.root}>
      <div style={{ ...SS.msg, color: '#ef4444' }}>出错了</div>
      <div style={SS.sub}>{message}</div>
      <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
        {onRetry && (
          <button onClick={onRetry} style={{ ...SS.backBtn, background: '#ef444422', borderColor: '#ef444466', color: '#ef4444' }}>
            重试
          </button>
        )}
        <button onClick={onBack} style={SS.backBtn}>← 返回</button>
      </div>
    </div>
  );
}

function ChapterTransitionScreen({ chapterNum, outlineZh }: { chapterNum: number; outlineZh: string }) {
  return (
    <div style={{ ...SS.root, background: '#050810' }}>
      <div style={{ color: '#C9A84C55', fontSize: '0.65rem', letterSpacing: '0.3em', marginBottom: 16 }}>CHAPTER</div>
      <div style={{ color: '#C9A84C', fontSize: '2rem', fontFamily: 'Georgia, serif', marginBottom: 20 }}>
        第 {chapterNum} 章
      </div>
      {outlineZh && (
        <div style={{ color: '#E8D5B060', fontSize: '0.85rem', lineHeight: 1.8, maxWidth: 300, textAlign: 'center' }}>
          {outlineZh.slice(0, 60)}…
        </div>
      )}
      <style>{`@keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }`}</style>
    </div>
  );
}

function AllDoneScreen({ onBack }: { onBack: () => void }) {
  return (
    <div style={SS.root}>
      <div style={{ color: '#C9A84C', fontSize: '1.8rem', fontFamily: 'Georgia, serif', marginBottom: 12 }}>✦ 故事完结 ✦</div>
      <div style={SS.sub}>所有章节已通关，感谢你的游玩。</div>
      <button onClick={onBack} style={{ ...SS.backBtn, marginTop: 24 }}>← 返回我的故事</button>
    </div>
  );
}

const SS: Record<string, React.CSSProperties> = {
  root: {
    minHeight: '100vh', width: '100%',
    background: '#0A0A0F',
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    fontFamily: "'STKaiti','KaiTi','FangSong',Georgia,serif",
    gap: 16, padding: 24,
    animation: 'fadeIn .4s ease',
  },
  spinner: {
    width: 36, height: 36,
    border: '3px solid #C9A84C33',
    borderTop: '3px solid #C9A84C',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  msg: { color: '#E8D5B0', fontSize: '1rem', letterSpacing: '0.1em', textAlign: 'center' },
  sub: { color: '#8B6914', fontSize: '0.8rem', lineHeight: 1.8, maxWidth: 320, textAlign: 'center' },
  backBtn: {
    background: 'transparent',
    border: '1px solid #C9A84C44',
    color: '#C9A84C88',
    borderRadius: 8,
    padding: '8px 20px',
    fontSize: '0.8rem',
    cursor: 'pointer',
    fontFamily: 'inherit',
    letterSpacing: '0.08em',
  },
};
