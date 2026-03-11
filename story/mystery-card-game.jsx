
import { useState, useEffect, useCallback } from "react";

const FONT_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&display=swap');
  @keyframes cardIn {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes fadeIn { from { opacity:0 } to { opacity:1 } }
  @keyframes shake {
    0%,100% { transform: translateX(0) rotate(var(--r,0deg)); }
    18%  { transform: translateX(-10px) rotate(var(--r,0deg)); }
    36%  { transform: translateX( 10px) rotate(var(--r,0deg)); }
    54%  { transform: translateX(-6px)  rotate(var(--r,0deg)); }
    72%  { transform: translateX( 6px)  rotate(var(--r,0deg)); }
  }
  @keyframes glow {
    0%,100% { text-shadow: 0 0 8px #C9A84C66; }
    50%     { text-shadow: 0 0 22px #C9A84CAA, 0 0 4px #fff3; }
  }
  * { box-sizing: border-box; }
  ::selection { background: #C9A84C44; }
  
  /* Scrollbar styles for webkit */
  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #8B691455; border-radius: 3px; }
`;

const ROTS = [-2.3, 1.8, -1.2, 2.7, -3.1, 0.9, 2.0, -1.7, 3.2, -0.8, 1.5, -2.5, -0.4, 2.2, -1.9, 1.1];
const getRot = i => ROTS[((i % ROTS.length) + ROTS.length) % ROTS.length];

/* ═══════════════════════════════════════════════
   主组件
═══════════════════════════════════════════════ */
export default function App() {
  const [stories, setStories] = useState([]);
  const [currentStoryMeta, setCurrentStoryMeta] = useState(null);
  const [cardsData, setCardsData] = useState([]);

  const [idx, setIdx]       = useState(-1);        // -1 = intro
  const [lives, setLives]   = useState(3);
  const [phase, setPhase]   = useState("menu");    // menu|intro|playing|wrong|gameover|victory
  const [penalty, setPenalty] = useState({ msg:"", hint:"" });
  const [cardKey, setCardKey] = useState(0);       // triggers re-animation

  const total = cardsData.length;
  const card = idx >= 0 && idx < total ? cardsData[idx] : null;

  /* ── 挂载时加载菜单 ── */
  useEffect(() => {
    fetch('data/index.json')
      .then(res => res.json())
      .then(data => setStories(data))
      .catch(err => console.error("Failed to load stories:", err));
  }, []);

  /* ── 加载故事 ── */
  const loadStory = useCallback((meta) => {
    fetch(meta.file)
      .then(res => res.json())
      .then(data => {
        setCardsData(data);
        setCurrentStoryMeta(meta);
        setIdx(-1);
        setLives(3);
        setPhase("intro");
        setCardKey(k => k + 1);
      })
      .catch(err => console.error("Failed to load story data:", err));
  }, []);

  /* ── 翻下一张 ── */
  const next = useCallback(() => {
    setCardKey(k => k + 1);
    setIdx(i => i + 1);
  }, []);

  /* ── 选择处理 ── */
  const choose = useCallback((opt) => {
    if (phase !== "playing" || !card || card.type !== "choice") return;
    if (opt === card.correct) {
      next();
    } else {
      const nl = lives - 1;
      setLives(nl);
      setPenalty({ msg: card.penalty, hint: card.hint || "" });
      setPhase(nl <= 0 ? "gameover" : "wrong");
    }
  }, [phase, card, lives, next]);

  /* ── 惩罚确认（倒退10张）── */
  const dismissWrong = useCallback(() => {
    setPhase("playing");
    setCardKey(k => k + 1);
    setIdx(i => Math.max(0, i - 10));
  }, []);

  /* ── 重新开始 ── */
  const restart = useCallback(() => {
    setIdx(0); setLives(3); setPhase("playing"); setPenalty({msg:"",hint:""}); setCardKey(k=>k+1);
  }, []);

  /* ── 开始游戏 ── */
  const startGame = useCallback(() => {
    setIdx(0); setLives(3); setPhase("playing"); setCardKey(k=>k+1);
  }, []);

  /* ── 返回目录 ── */
  const backToMenu = useCallback(() => {
    setPhase("menu");
    setCurrentStoryMeta(null);
    setCardsData([]);
  }, []);

  /* ── 检测胜利 ── */
  useEffect(() => {
    if (card?.type === "victory") {
      const t = setTimeout(() => setPhase("victory"), 900);
      return () => clearTimeout(t);
    }
  }, [idx, card]);

  const rot = getRot(idx >= 0 ? idx : 0);

  /* ── 渲染 ── */
  return (
    <>
      <style>{FONT_CSS}</style>
      <div style={S.root}>
        {/* 背景装饰纹样 */}
        <div style={S.bgPattern} />
        <div style={S.bgVignette} />

        {/* ══════════════════════════════════════════
            菜单页
        ══════════════════════════════════════════ */}
        {phase === "menu" && (
          <div style={S.menuContainer}>
            <div style={S.header}>
              <div style={S.titleEn}>INTERACTIVE FICTION</div>
              <div style={S.titleZh}>故事剧本</div>
            </div>
            <div style={S.menuList}>
              {stories.length === 0 && <div style={{ color: "#C9A84C88", textAlign: "center" }}>加载中...</div>}
              {stories.map(story => (
                <div key={story.id} style={S.menuItem} onClick={() => loadStory(story)}>
                  <div style={S.menuItemContent}>
                    <div style={S.menuItemTitleEn}>{story.titleEn}</div>
                    <div style={S.menuItemTitleZh}>{story.titleZh}</div>
                    <div style={S.menuItemDesc}>{story.desc}</div>
                  </div>
                  <div style={S.menuItemAction}>
                    <button style={S.menuItemBtn}>进入</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 下面是处于游戏中时显示的公用元素 */}
        {phase !== "menu" && (
          <>
            {/* ── 标题 ── */}
            <div style={S.header}>
              <div style={S.titleEn}>{currentStoryMeta?.titleEn}</div>
              <div style={S.titleZh}>{currentStoryMeta?.titleZh}</div>
            </div>

            {/* ── 生命值 ── */}
            {phase !== "intro" && phase !== "victory" && (
              <div style={S.lives}>
                {[0,1,2].map(i => (
                  <span key={i} style={{ ...S.lifeGem, opacity: i < lives ? 1 : 0.18 }}>◆</span>
                ))}
                <span style={S.livesLabel}>生命值</span>
              </div>
            )}

            {/* ── 进度 ── */}
            {phase !== "intro" && phase !== "victory" && total > 0 && (
              <div style={S.progress}>
                <div style={{ ...S.progressBar, width: `${(idx/total)*100}%` }} />
              </div>
            )}
          </>
        )}

        {/* ══════════════════════════════════════════
            介绍页
        ══════════════════════════════════════════ */}
        {phase === "intro" && (
          <div style={{ ...S.card, transform:"rotate(-1.5deg)", animation:"cardIn .6s ease" }}>
            <div style={S.cardInner}>
              <div style={S.actLabel}>游戏说明</div>
              <div style={{ ...S.storyText, whiteSpace: "pre-line" }}>
                {currentStoryMeta?.desc}
              </div>
              <div style={{ ...S.storyText, fontSize:"0.82rem", opacity:0.7, marginTop:16 }}>
                点击卡片继续故事<br/>
                在选择节点做出正确判断<br/>
                答错扣除一次机会，并倒退十张<br/>
                共有三次机会
              </div>
              <div style={{ display: "flex", gap: "10px", marginTop: 24 }}>
                <button style={S.startBtn} onClick={startGame}>
                  开始故事
                </button>
                <button style={{ ...S.startBtn, border: "1px solid #8B691466", color: "#8B6914aa" }} onClick={backToMenu}>
                  返回目录
                </button>
              </div>
            </div>
            <div style={S.cardCornerTL} />
            <div style={S.cardCornerBR} />
          </div>
        )}

        {/* ══════════════════════════════════════════
            故事卡 & 选择卡
        ══════════════════════════════════════════ */}
        {(phase === "playing" || phase === "wrong") && card && (
          <div
            key={cardKey}
            style={{
              ...S.card,
              transform: `rotate(${rot}deg)`,
              animation: phase === "wrong"
                ? `shake .5s ease`
                : "cardIn .5s cubic-bezier(.22,.68,0,1.2)",
              "--r": `${rot}deg`,
              background: phase === "wrong" ? "#F9E8E8" : "#F4EAD5",
              cursor: card.type === "story" ? "pointer" : "default",
            }}
            onClick={card.type === "story" ? next : undefined}
          >
            <div style={S.cardInner}>
              {/* 幕标 */}
              {card.act && <div style={S.actLabel}>{card.act}</div>}

              {/* 故事文字 */}
              {card.type === "story" && (
                <>
                  <div style={S.storyText}>{card.text}</div>
                  <div style={S.tapHint}>— 轻触继续 —</div>
                </>
              )}

              {/* 选择卡 */}
              {card.type === "choice" && (
                <>
                  <div style={S.choiceIcon}>？</div>
                  <div style={S.choiceQuestion}>{card.text}</div>
                  <div style={S.choiceRow}>
                    <button style={S.choiceBtn} onClick={() => choose("A")}>
                      <span style={S.choiceLetter}>A</span>
                      <span style={S.choiceText}>{card.optA}</span>
                    </button>
                    <button style={S.choiceBtn} onClick={() => choose("B")}>
                      <span style={S.choiceLetter}>B</span>
                      <span style={S.choiceText}>{card.optB}</span>
                    </button>
                  </div>
                </>
              )}
            </div>
            <div style={S.cardCornerTL} />
            <div style={S.cardCornerBR} />
          </div>
        )}

        {/* ══════════════════════════════════════════
            答错覆层
        ══════════════════════════════════════════ */}
        {phase === "wrong" && (
          <div style={S.overlay}>
            <div style={S.overlayBox}>
              <div style={S.overlayTitle}>判断有误</div>
              <div style={S.overlayMsg}>{penalty.msg}</div>
              {penalty.hint && (
                <div style={S.overlayHint}>
                  <span style={{ color:"#C9A84C" }}>提示：</span>{penalty.hint}
                </div>
              )}
              <div style={S.overlayLives}>
                {[0,1,2].map(i => (
                  <span key={i} style={{ color: i < lives ? "#C9A84C" : "#333", fontSize:20 }}>◆</span>
                ))}
              </div>
              <button style={S.overlayBtn} onClick={dismissWrong}>
                倒退十张，重新审视
              </button>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════
            游戏结束
        ══════════════════════════════════════════ */}
        {phase === "gameover" && (
          <div style={S.overlay}>
            <div style={S.overlayBox}>
              <div style={{ ...S.overlayTitle, color:"#8B1A1A" }}>线索断裂</div>
              <div style={S.overlayMsg}>
                三次机会均已耗尽。<br/>真凶已经将证据销毁干净。<br/>这个案子，需要从头再来。
              </div>
              <div style={S.overlayMsg} dangerouslySetInnerHTML={{__html: `<em>${penalty.msg}</em>`}} />
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: 20 }}>
                <button style={{ ...S.overlayBtn, background:"#8B1A1A" }} onClick={restart}>
                  重新开始本故事
                </button>
                <button style={{ ...S.overlayBtn, background:"transparent", border:"1px solid #8B1A1A", color:"#8B1A1A" }} onClick={backToMenu}>
                  返回目录
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════
            胜利
        ══════════════════════════════════════════ */}
        {phase === "victory" && (
          <div style={{ ...S.overlay, background:"#0A0A0Fdd" }}>
            <div style={{ ...S.card, transform:"rotate(-1deg)", animation:"cardIn .8s ease", maxWidth:380 }}>
              <div style={S.cardInner}>
                {card && card.act && <div style={S.actLabel}>{card.act}</div>}
                <div style={{ ...S.storyText, whiteSpace:"pre-line", lineHeight:2 }}>
                  {card?.text}
                </div>
                <div style={{ color:"#C9A84C", fontSize:"1.3rem", margin:"20px 0 8px", animation:"glow 2s infinite" }}>
                  ✦ 故事完结 ✦
                </div>
                <div style={{ display: "flex", gap: "10px", marginTop: 24 }}>
                  <button style={S.startBtn} onClick={restart}>再玩一次</button>
                  <button style={{ ...S.startBtn, border: "1px solid #8B691466", color: "#8B6914aa" }} onClick={backToMenu}>
                    返回目录
                  </button>
                </div>
              </div>
              <div style={S.cardCornerTL} />
              <div style={S.cardCornerBR} />
            </div>
          </div>
        )}
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════
   样式对象
═══════════════════════════════════════════════ */
const S = {
  root: {
    minHeight: "100vh",
    width: "100%",
    background: "#0A0A0F",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "'STKaiti','KaiTi','FangSong','STSong','Playfair Display',Georgia,serif",
    position: "relative",
    overflow: "hidden",
    padding: "20px 16px",
    userSelect: "none",
  },
  bgPattern: {
    position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none",
    backgroundImage: `
      linear-gradient(45deg, #ffffff04 25%, transparent 25%),
      linear-gradient(-45deg, #ffffff04 25%, transparent 25%),
      linear-gradient(45deg, transparent 75%, #ffffff04 75%),
      linear-gradient(-45deg, transparent 75%, #ffffff04 75%)
    `,
    backgroundSize: "12px 12px",
  },
  bgVignette: {
    position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none",
    background: "radial-gradient(ellipse at 50% 50%, transparent 30%, #0A0A0F 90%)",
  },
  
  /* ── 菜单样式 ── */
  menuContainer: {
    position: "relative",
    width: "min(480px, 95vw)",
    maxHeight: "85vh",
    zIndex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  menuList: {
    width: "100%",
    overflowY: "auto",
    paddingRight: "8px",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    maxHeight: "65vh",
  },
  menuItem: {
    background: "#F4EAD5",
    borderRadius: "4px",
    padding: "20px 24px",
    display: "flex",
    flexDirection: "column",
    boxShadow: "0 4px 12px #00000066, inset 0 0 20px #00000005",
    border: "1px solid #C4A882",
    cursor: "pointer",
    transition: "transform 0.2s, box-shadow 0.2s",
  },
  menuItemContent: {
    marginBottom: "12px",
  },
  menuItemTitleEn: {
    color: "#8B6914",
    fontSize: "0.6rem",
    letterSpacing: "0.2em",
    textTransform: "uppercase",
    fontFamily: "'Playfair Display', Georgia, serif",
    marginBottom: "4px",
  },
  menuItemTitleZh: {
    color: "#2C1810",
    fontSize: "1.2rem",
    letterSpacing: "0.1em",
    fontWeight: "bold",
    marginBottom: "8px",
  },
  menuItemDesc: {
    color: "#5A4A30",
    fontSize: "0.85rem",
    lineHeight: 1.6,
    whiteSpace: "pre-line",
  },
  menuItemAction: {
    display: "flex",
    justifyContent: "flex-end",
    borderTop: "1px dashed #C4A88255",
    paddingTop: "12px",
  },
  menuItemBtn: {
    background: "none",
    border: "1px solid #8B6914",
    color: "#8B6914",
    padding: "6px 16px",
    fontSize: "0.8rem",
    borderRadius: "2px",
    cursor: "pointer",
    fontFamily: "inherit",
    letterSpacing: "0.1em",
  },

  header: {
    textAlign: "center",
    marginBottom: 28,
    zIndex: 1,
  },
  titleEn: {
    color: "#C9A84C",
    fontSize: "0.65rem",
    letterSpacing: "0.35em",
    opacity: 0.6,
    textTransform: "uppercase",
    fontFamily: "'Playfair Display', Georgia, serif",
    minHeight: "1rem",
  },
  titleZh: {
    color: "#C9A84C",
    fontSize: "1.4rem",
    letterSpacing: "0.15em",
    animation: "glow 3s ease-in-out infinite",
    fontFamily: "'STKaiti','KaiTi',Georgia,serif",
    marginTop: 4,
    minHeight: "2rem",
  },
  lives: {
    position: "absolute", top: 20, right: 20,
    display: "flex", alignItems: "center", gap: 6,
    zIndex: 10,
  },
  lifeGem: {
    color: "#C9A84C",
    fontSize: 16,
    transition: "opacity .4s",
    textShadow: "0 0 8px #C9A84C88",
  },
  livesLabel: {
    color: "#C9A84C66",
    fontSize: "0.6rem",
    letterSpacing: "0.1em",
    marginLeft: 4,
  },
  progress: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    height: 2,
    background: "#ffffff0d",
    zIndex: 10,
  },
  progressBar: {
    height: "100%",
    background: "linear-gradient(90deg, #8B6914, #C9A84C)",
    transition: "width .4s ease",
  },
  card: {
    position: "relative",
    width: "min(380px, 90vw)",
    minHeight: 300,
    background: "#F4EAD5",
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
    padding: "32px 28px 28px",
    border: "1px solid #C4A88266",
    margin: 8,
    height: "calc(100% - 16px)",
    minHeight: 260,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 0,
  },
  cardCornerTL: {
    position: "absolute", top: 10, left: 10,
    width: 18, height: 18,
    borderTop: "1.5px solid #C4A882AA",
    borderLeft: "1.5px solid #C4A882AA",
  },
  cardCornerBR: {
    position: "absolute", bottom: 10, right: 10,
    width: 18, height: 18,
    borderBottom: "1.5px solid #C4A882AA",
    borderRight: "1.5px solid #C4A882AA",
  },
  actLabel: {
    color: "#8B6914",
    fontSize: "0.6rem",
    letterSpacing: "0.25em",
    textTransform: "uppercase",
    marginBottom: 18,
    opacity: 0.85,
    fontFamily: "'Playfair Display', Georgia, serif",
  },
  storyText: {
    color: "#2C1810",
    fontSize: "1.05rem",
    lineHeight: 1.9,
    textAlign: "center",
    letterSpacing: "0.06em",
  },
  tapHint: {
    color: "#8B691466",
    fontSize: "0.6rem",
    letterSpacing: "0.2em",
    marginTop: 24,
    fontFamily: "Georgia, serif",
  },
  choiceIcon: {
    fontSize: "1.8rem",
    color: "#8B6914",
    marginBottom: 12,
    opacity: 0.6,
  },
  choiceQuestion: {
    color: "#2C1810",
    fontSize: "0.95rem",
    lineHeight: 1.8,
    textAlign: "center",
    marginBottom: 20,
    letterSpacing: "0.05em",
  },
  choiceRow: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    width: "100%",
  },
  choiceBtn: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    background: "transparent",
    border: "1px solid #8B691455",
    borderRadius: 3,
    padding: "10px 12px",
    cursor: "pointer",
    textAlign: "left",
    transition: "all .2s",
    fontFamily: "inherit",
    color: "#2C1810",
    width: "100%",
    outline: "none",
  },
  choiceLetter: {
    fontFamily: "'Playfair Display', Georgia, serif",
    fontWeight: 700,
    color: "#8B6914",
    fontSize: "1rem",
    minWidth: 18,
    marginTop: 1,
  },
  choiceText: {
    fontSize: "0.88rem",
    lineHeight: 1.6,
    letterSpacing: "0.04em",
  },
  startBtn: {
    marginTop: 0,
    padding: "10px 24px",
    background: "transparent",
    border: "1px solid #8B6914",
    color: "#8B6914",
    fontSize: "0.9rem",
    letterSpacing: "0.15em",
    cursor: "pointer",
    fontFamily: "inherit",
    borderRadius: 2,
    transition: "all .2s",
  },
  overlay: {
    position: "fixed", inset: 0, zIndex: 100,
    background: "#0A0A0Fcc",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    animation: "fadeIn .3s ease",
    padding: 20,
  },
  overlayBox: {
    background: "#F4EAD5",
    border: "1px solid #C4A882",
    borderRadius: 4,
    padding: "32px 28px",
    maxWidth: 360,
    width: "100%",
    textAlign: "center",
    boxShadow: "0 20px 60px #000000AA",
  },
  overlayTitle: {
    color: "#8B6914",
    fontSize: "1.1rem",
    letterSpacing: "0.2em",
    marginBottom: 16,
    fontFamily: "'Playfair Display',Georgia,serif",
  },
  overlayMsg: {
    color: "#2C1810",
    fontSize: "0.9rem",
    lineHeight: 1.85,
    letterSpacing: "0.04em",
    marginBottom: 14,
  },
  overlayHint: {
    color: "#5A4A30",
    fontSize: "0.82rem",
    lineHeight: 1.8,
    background: "#00000008",
    border: "1px solid #C4A88244",
    borderRadius: 3,
    padding: "8px 12px",
    marginBottom: 16,
    letterSpacing: "0.04em",
  },
  overlayLives: {
    display: "flex", justifyContent: "center", gap: 8,
    marginBottom: 20,
  },
  overlayBtn: {
    padding: "10px 22px",
    background: "#2C1810",
    color: "#F4EAD5",
    border: "none",
    borderRadius: 3,
    fontSize: "0.88rem",
    letterSpacing: "0.12em",
    cursor: "pointer",
    fontFamily: "inherit",
  },
};
