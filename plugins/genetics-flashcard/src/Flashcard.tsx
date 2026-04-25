import { useState, useEffect, useCallback, useMemo } from "react";

interface A2UINode {
  properties?: Record<string, unknown>;
}

function parseStr(val: unknown, fallback: string): string {
  return typeof val === "string" ? val : fallback;
}

function parseBool(val: unknown, fallback: boolean): boolean {
  return typeof val === "boolean" ? val : fallback;
}

interface FlashcardItem {
  front: string;
  back: string;
  category?: string;
}

const DEFAULT_CARDS: FlashcardItem[] = [
  { front: "DNA的双螺旋结构由谁发现？", back: "1953年，Watson和Crick提出了DNA双螺旋结构模型", category: "分子遗传学" },
  { front: "孟德尔第一定律是什么？", back: "分离定律：等位基因在形成配子时彼此分离，分别进入不同的配子中", category: "经典遗传学" },
  { front: "什么是显性性状？", back: "在杂合子中能够表现出来的性状。由显性等位基因控制，用大写字母表示（如A）", category: "经典遗传学" },
  { front: "GC含量越高，DNA双链越稳定，为什么？", back: "G-C配对有3个氢键，而A-T配对只有2个氢键。因此GC含量高的DNA双链更稳定，熔解温度（Tm）也更高", category: "分子遗传学" },
  { front: "什么是连锁基因？", back: "位于同一条染色体上的基因，它们倾向于一起遗传给后代。连锁基因之间的距离越近，重组频率越低", category: "遗传学" },
  { front: "中心法则描述了什么？", back: "遗传信息的流动方向：DNA → RNA → 蛋白质。DNA复制传递遗传信息，转录将DNA信息传给RNA，翻译将RNA信息转化为蛋白质", category: "分子遗传学" },
  { front: "什么是基因型比例1:2:1？", back: "Aa×Aa杂交后代的基因型比例：1AA : 2Aa : 1aa。这是孟德尔分离定律的体现", category: "经典遗传学" },
  { front: "减数分裂产生几种配子？", back: "一次减数分裂产生4个单倍体配子（n），染色体数目减半。经过两次连续分裂（减数第一次分裂和第二次分裂）完成", category: "细胞遗传学" },
];

function parseCards(props: Record<string, unknown>): FlashcardItem[] {
  const rawCards = props.cards;
  let parsed: unknown = rawCards;
  if (typeof rawCards === "string") {
    try { parsed = JSON.parse(rawCards); } catch { parsed = null; }
  }
  if (Array.isArray(parsed) && parsed.length > 0) {
    return (parsed as any[]).map((c: any) => ({
      front: typeof c.front === "string" ? c.front : "",
      back: typeof c.back === "string" ? c.back : "",
      category: typeof c.category === "string" ? c.category : undefined,
    })).filter((c) => c.front && c.back);
  }
  const front = parseStr(props.front, "");
  const back = parseStr(props.back, "");
  if (front && back) {
    return [{ front, back, category: parseStr(props.category, "") || undefined }];
  }
  return DEFAULT_CARDS;
}

function shuffleArray<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function Flashcard({ node }: { node: A2UINode }) {
  const props = node.properties ?? {};
  const initCards = useMemo(() => parseCards(props), [props.cards, props.front, props.back, props.category]);
  const initInteractive = parseBool(props.interactive, true);

  const [cards, setCards] = useState<FlashcardItem[]>(initCards);
  const [interactive, setInteractive] = useState(initInteractive);
  const [order, setOrder] = useState<number[]>(() => initCards.map((_, i) => i));
  const [currentIdx, setCurrentIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [knownSet, setKnownSet] = useState<Set<number>>(new Set());
  const [animDir, setAnimDir] = useState<"left" | "right" | null>(null);

  useEffect(() => { setCards(initCards); setOrder(initCards.map((_, i) => i)); setCurrentIdx(0); setFlipped(false); setKnownSet(new Set()); }, [initCards]);
  useEffect(() => { setInteractive(initInteractive); }, [initInteractive]);

  const totalCards = cards.length;
  const knownCount = knownSet.size;
  const unknownCount = totalCards - knownCount;
  const progressPct = totalCards > 0 ? ((currentIdx + 1) / totalCards) * 100 : 0;
  const currentCard = cards[order[currentIdx]] ?? cards[0];
  const categories = useMemo(() => [...new Set(cards.map((c) => c.category).filter(Boolean) as string[])], [cards]);

  const goNext = useCallback(() => {
    if (currentIdx < totalCards - 1) {
      setAnimDir("left");
      setFlipped(false);
      setTimeout(() => { setCurrentIdx((i) => i + 1); setAnimDir(null); }, 200);
    }
  }, [currentIdx, totalCards]);

  const goPrev = useCallback(() => {
    if (currentIdx > 0) {
      setAnimDir("right");
      setFlipped(false);
      setTimeout(() => { setCurrentIdx((i) => i - 1); setAnimDir(null); }, 200);
    }
  }, [currentIdx]);

  const toggleKnown = useCallback(() => {
    if (!interactive) return;
    const cardKey = order[currentIdx];
    setKnownSet((prev) => {
      const next = new Set(prev);
      if (next.has(cardKey)) next.delete(cardKey);
      else next.add(cardKey);
      return next;
    });
  }, [interactive, currentIdx, order]);

  const handleShuffle = useCallback(() => {
    if (!interactive) return;
    setOrder(shuffleArray(cards.map((_, i) => i)));
    setCurrentIdx(0);
    setFlipped(false);
    setKnownSet(new Set());
  }, [interactive, cards]);

  const handleReset = useCallback(() => {
    setOrder(cards.map((_, i) => i));
    setCurrentIdx(0);
    setFlipped(false);
    setKnownSet(new Set());
  }, [cards]);

  if (totalCards === 0) {
    return (
      <div style={{ background: "#faf9f5", borderRadius: 12, padding: 24, textAlign: "center", color: "#6b7280", fontFamily: "Manrope, sans-serif", fontStyle: "italic" }}>
        暂无卡片数据
      </div>
    );
  }

  const cardInner: React.CSSProperties = {
    width: "100%",
    height: 300,
    position: "relative",
    cursor: "pointer",
    transformStyle: "preserve-3d" as const,
    transition: "transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)",
    transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
  };

  const faceBase: React.CSSProperties = {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    backfaceVisibility: "hidden" as const,
    borderRadius: 14,
    padding: 20,
    display: "flex",
    flexDirection: "column",
    boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
    overflow: "hidden",
    color: "#fff",
  };

  const btnBase: React.CSSProperties = {
    padding: "8px 16px",
    borderRadius: 8,
    border: "none",
    fontWeight: 600,
    fontSize: 13,
    cursor: "pointer",
    fontFamily: "Manrope, sans-serif",
    transition: "all 0.2s",
  };

  return (
    <div style={{ background: "#faf9f5", borderRadius: 12, padding: 16, fontFamily: "Manrope, sans-serif", maxWidth: 420, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#182544" }}>记忆卡片</div>
        <div style={{ fontSize: 12, color: "#6b7280" }}>
          {currentIdx + 1} / {totalCards}
        </div>
      </div>

      <div style={{ height: 4, borderRadius: 2, background: "#e5e7eb", marginBottom: 12, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${progressPct}%`, background: "#182544", borderRadius: 2, transition: "width 0.3s ease" }} />
      </div>

      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 12,
          fontSize: 12,
          color: "#6b7280",
          flexWrap: "wrap",
        }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 4, background: "#dcfce7", color: "#166534" }}>
          已知 {knownCount}
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 4, background: "#fee2e2", color: "#991b1b" }}>
          未学 {unknownCount}
        </span>
        {categories.slice(0, 3).map((cat) => (
          <span key={cat} style={{ padding: "2px 8px", borderRadius: 4, background: "#f3f4f6", color: "#374151" }}>
            {cat}
          </span>
        ))}
      </div>

      <div
        style={{
          perspective: 1000,
          opacity: animDir ? 0.5 : 1,
          transform: animDir === "left" ? "translateX(-10px)" : animDir === "right" ? "translateX(10px)" : "none",
          transition: "all 0.2s ease",
        }}
      >
        <div onClick={() => setFlipped((f) => !f)} style={cardInner}>
          <div style={{ ...faceBase, background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)" }}>
            <span style={{ position: "absolute", top: 12, right: 12, fontSize: 10, fontWeight: 600, textTransform: "uppercase", background: "rgba(255,255,255,0.2)", padding: "4px 8px", borderRadius: 4 }}>
              问题
            </span>
            {currentCard?.category && (
              <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, opacity: 0.8, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 8, height: 8, background: "currentColor", borderRadius: "50%", opacity: 0.6, display: "inline-block" }} />
                {currentCard.category}
              </div>
            )}
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", fontSize: 16, fontWeight: 600, lineHeight: 1.5, padding: 8, overflowY: "auto" }}>
              {currentCard?.front}
            </div>
            <div style={{ fontSize: 11, opacity: 0.7, textAlign: "center", marginTop: 6, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <span style={{ fontSize: 16 }}>↻</span> 点击查看答案
            </div>
          </div>

          <div style={{ ...faceBase, background: "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)", transform: "rotateY(180deg)" }}>
            <span style={{ position: "absolute", top: 12, right: 12, fontSize: 10, fontWeight: 600, textTransform: "uppercase", background: "rgba(255,255,255,0.2)", padding: "4px 8px", borderRadius: 4 }}>
              答案
            </span>
            {currentCard?.category && (
              <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, opacity: 0.8, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 8, height: 8, background: "currentColor", borderRadius: "50%", opacity: 0.6, display: "inline-block" }} />
                {currentCard.category}
              </div>
            )}
            <div style={{ flex: 1, display: "flex", alignItems: "flex-start", justifyContent: "center", textAlign: "left", fontSize: 13, fontWeight: 500, lineHeight: 1.5, padding: 8, overflowY: "auto" }}>
              {currentCard?.back}
            </div>
            <div style={{ fontSize: 11, opacity: 0.7, textAlign: "center", marginTop: 6, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <span style={{ fontSize: 16 }}>↻</span> 点击查看问题
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 14 }}>
        <button
          onClick={goPrev}
          disabled={currentIdx === 0}
          style={{ ...btnBase, background: currentIdx === 0 ? "#e5e7eb" : "#182544", color: currentIdx === 0 ? "#9ca3af" : "#fff", cursor: currentIdx === 0 ? "not-allowed" : "pointer" }}
        >
          ← 上一张
        </button>
        <button
          onClick={toggleKnown}
          disabled={!interactive}
          style={{
            ...btnBase,
            background: knownSet.has(order[currentIdx]) ? "#dcfce7" : "#fff",
            color: knownSet.has(order[currentIdx]) ? "#166534" : "#182544",
            border: "1px solid",
            borderColor: knownSet.has(order[currentIdx]) ? "#86efac" : "#e5e7eb",
            cursor: interactive ? "pointer" : "default",
          }}
        >
          {knownSet.has(order[currentIdx]) ? "✓ 已掌握" : "标记已掌握"}
        </button>
        <button
          onClick={goNext}
          disabled={currentIdx >= totalCards - 1}
          style={{ ...btnBase, background: currentIdx >= totalCards - 1 ? "#e5e7eb" : "#182544", color: currentIdx >= totalCards - 1 ? "#9ca3af" : "#fff", cursor: currentIdx >= totalCards - 1 ? "not-allowed" : "pointer" }}
        >
          下一张 →
        </button>
      </div>

      <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 10 }}>
        <button
          onClick={handleShuffle}
          disabled={!interactive}
          style={{ ...btnBase, background: "#fff", color: "#6b7280", border: "1px solid #e5e7eb", fontSize: 12, cursor: interactive ? "pointer" : "default" }}
        >
          🔀 打乱顺序
        </button>
        <button
          onClick={handleReset}
          style={{ ...btnBase, background: "#fff", color: "#6b7280", border: "1px solid #e5e7eb", fontSize: 12, cursor: "pointer" }}
        >
          ↺ 重置进度
        </button>
      </div>

      {totalCards > 1 && (
        <div style={{ marginTop: 12, display: "flex", gap: 4, justifyContent: "center", flexWrap: "wrap" }}>
          {cards.map((_, i) => {
            const key = order[i];
            const isCurrent = i === currentIdx;
            const isKnown = knownSet.has(key);
            return (
              <div
                key={i}
                onClick={() => { setCurrentIdx(i); setFlipped(false); }}
                style={{
                  width: isCurrent ? 20 : 8,
                  height: 8,
                  borderRadius: 4,
                  background: isCurrent ? "#182544" : isKnown ? "#86efac" : "#d1d5db",
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

export default Flashcard;
