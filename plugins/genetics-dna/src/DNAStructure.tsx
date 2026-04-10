import { useState, useEffect, useCallback } from "react";

interface A2UINode {
  properties?: Record<string, unknown>;
}

function parseNum(val: unknown, fallback: number): number {
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}

function parseStr(val: unknown, fallback: string): string {
  return typeof val === "string" ? val : fallback;
}

function parseBool(val: unknown, fallback: boolean): boolean {
  return typeof val === "boolean" ? val : fallback;
}

const COMPLEMENTARY: Record<string, string> = {
  A: "T",
  T: "A",
  C: "G",
  G: "C",
};

const BASE_NAMES: Record<string, string> = {
  A: "腺嘌呤",
  T: "胸腺嘧啶",
  C: "胞嘧啶",
  G: "鸟嘌呤",
};

const BASE_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  A: { bg: "#fef3c7", color: "#92400e", border: "#f59e0b" },
  T: { bg: "#dbeafe", color: "#1e40af", border: "#3b82f6" },
  C: { bg: "#d1fae5", color: "#065f46", border: "#10b981" },
  G: { bg: "#fce7f3", color: "#9f1239", border: "#ec4899" },
};

function getComplementaryBase(base: string): string {
  return COMPLEMENTARY[base.toUpperCase()] || "?";
}

function isValidSequence(seq: string): boolean {
  if (!seq) return false;
  return /^[ATCGatcg]+$/.test(seq);
}

function getSequenceStats(seq: string) {
  const upper = seq.toUpperCase();
  const counts: Record<string, number> = { A: 0, T: 0, C: 0, G: 0 };
  for (const ch of upper) {
    if (counts[ch] !== undefined) counts[ch]++;
  }
  const length = upper.length;
  const gcCount = counts.G + counts.C;
  const gcContent = length > 0 ? (gcCount / length) * 100 : 0;
  return { counts, length, gcContent };
}

interface SelectedBaseInfo {
  base: string;
  index: number;
  pair: string;
}

export function DNAStructure({ node }: { node: A2UINode }) {
  const props = node.properties ?? {};

  const initSequence = parseStr(props.sequence, "ATCGATCG");
  const initShowLabels = parseBool(props.showLabels, true);
  const initInteractive = parseBool(props.interactive, true);

  const [sequence, setSequence] = useState(initSequence);
  const [showLabels, setShowLabels] = useState(initShowLabels);
  const [interactive, setInteractive] = useState(initInteractive);
  const [selectedBase, setSelectedBase] = useState<SelectedBaseInfo | null>(null);

  useEffect(() => { setSequence(initSequence); }, [initSequence]);
  useEffect(() => { setShowLabels(initShowLabels); }, [initShowLabels]);
  useEffect(() => { setInteractive(initInteractive); }, [initInteractive]);

  const handleBaseClick = useCallback(
    (base: string, index: number) => {
      if (!interactive) return;
      const pair = getComplementaryBase(base);
      setSelectedBase({ base, index, pair });
    },
    [interactive]
  );

  const closeModal = useCallback(() => {
    setSelectedBase(null);
  }, []);

  const upperSeq = sequence.toUpperCase();
  const valid = isValidSequence(upperSeq);

  if (!valid || upperSeq.length === 0) {
    return (
      <div
        style={{
          background: "#faf9f5",
          borderRadius: 12,
          padding: 24,
          textAlign: "center",
          color: "#6b7280",
          fontFamily: "Manrope, sans-serif",
          fontStyle: "italic",
        }}
      >
        {upperSeq.length === 0
          ? "请输入 DNA 序列（例如：ATCGATCG）"
          : "DNA 序列包含无效的碱基。请只使用 A、T、C、G。"}
      </div>
    );
  }

  const stats = getSequenceStats(upperSeq);
  const complementaryStrand = upperSeq.split("").map(getComplementaryBase).join("");

  const baseStyle = (base: string, isSelected: boolean, isHighlighted: boolean): React.CSSProperties => ({
    width: 32,
    height: 32,
    borderRadius: 6,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 700,
    fontSize: 14,
    fontFamily: "monospace",
    transition: "all 0.2s ease",
    cursor: interactive ? "pointer" : "default",
    border: isHighlighted ? "3px solid #182544" : `2px solid ${BASE_COLORS[base]?.border || "#e5e7eb"}`,
    background: isSelected ? "#d1fae5" : (BASE_COLORS[base]?.bg || "#fafafa"),
    color: BASE_COLORS[base]?.color || "#1b1c1a",
    transform: isSelected ? "scale(1.1)" : undefined,
    boxShadow: isSelected ? "0 0 0 3px rgba(16,185,129,0.3)" : undefined,
  });

  return (
    <div
      style={{
        background: "#faf9f5",
        borderRadius: 12,
        padding: 16,
        fontFamily: "Manrope, sans-serif",
        maxWidth: 800,
      }}
    >
      <div
        style={{
          fontSize: 16,
          fontWeight: 600,
          color: "#182544",
          textAlign: "center",
          marginBottom: 12,
        }}
      >
        DNA 双螺旋结构
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 4,
          padding: 16,
          background: "#fff",
          borderRadius: 8,
          border: "1px solid #e5e7eb",
          overflowX: "auto",
        }}
      >
        <div style={{ display: "flex", gap: 0, padding: "4px 0" }}>
          {upperSeq.split("").map((base, i) => {
            const isSelected = selectedBase?.index === i;
            return (
              <div
                key={i}
                style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 40, position: "relative" }}
              >
                {isSelected &&
                  Array.from({ length: base === "A" || base === "T" ? 2 : 3 }).map((_, bi) => (
                    <div
                      key={bi}
                      style={{
                        position: "absolute",
                        width: 1,
                        background: "#6b7280",
                        left: "50%",
                        transform: "translateX(-50%)",
                        height: 12,
                        bottom: -16 + bi * 7,
                      }}
                    />
                  ))}
                <div
                  style={baseStyle(base, isSelected, false)}
                  onClick={() => handleBaseClick(base, i)}
                >
                  {base}
                </div>
                {showLabels && (
                  <div style={{ fontSize: 10, color: "#6b7280", marginTop: 2 }}>{i + 1}</div>
                )}
              </div>
            );
          })}
        </div>

        <div style={{ display: "flex", gap: 0, padding: "4px 0" }}>
          {upperSeq.split("").map((base, i) => {
            const comp = getComplementaryBase(base);
            const isSelected = selectedBase?.index === i;
            return (
              <div
                key={i}
                style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 40 }}
              >
                {showLabels && (
                  <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 2 }}>{i + 1}</div>
                )}
                <div
                  style={baseStyle(comp, isSelected, false)}
                  onClick={() => handleBaseClick(comp, i)}
                >
                  {comp}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div
        style={{
          marginTop: 12,
          padding: 12,
          background: "#fff",
          borderRadius: 8,
          border: "1px solid #e5e7eb",
          borderLeft: "3px solid #182544",
        }}
      >
        <div style={{ fontFamily: "monospace", fontSize: 14, color: "#1b1c1a", lineHeight: 1.8, wordBreak: "break-all" }}>
          <strong>5'→3' 链：</strong>{upperSeq}
          <br />
          <strong>3'→5' 链：</strong>{complementaryStrand}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-around",
          marginTop: 12,
          padding: 12,
          background: "#fff",
          borderRadius: 8,
          border: "1px solid #e5e7eb",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 12, color: "#6b7280" }}>序列长度</div>
          <div style={{ fontSize: 18, fontWeight: 600, color: "#182544" }}>{stats.length}</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 12, color: "#6b7280" }}>碱基对</div>
          <div style={{ fontSize: 18, fontWeight: 600, color: "#182544" }}>{stats.length}</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 12, color: "#6b7280" }}>GC 含量</div>
          <div style={{ fontSize: 18, fontWeight: 600, color: "#182544" }}>{stats.gcContent.toFixed(1)}%</div>
        </div>
      </div>

      {showLabels && (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            background: "#fff",
            borderRadius: 8,
            border: "1px solid #e5e7eb",
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, color: "#182544", marginBottom: 8 }}>
            碱基配对规则
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8 }}>
            {(["A", "T", "C", "G"] as const).map((b) => (
              <div key={b} style={{ display: "flex", alignItems: "center", gap: 8, padding: 4, borderRadius: 4, background: "#fafafa" }}>
                <div
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 4,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 700,
                    fontSize: 12,
                    fontFamily: "monospace",
                    background: BASE_COLORS[b].bg,
                    color: BASE_COLORS[b].color,
                    border: `2px solid ${BASE_COLORS[b].border}`,
                  }}
                >
                  {b}
                </div>
                <div style={{ fontSize: 12, color: "#6b7280" }}>
                  {BASE_NAMES[b]}
                  <br />
                  <span style={{ fontSize: 10 }}>
                    与 {BASE_NAMES[COMPLEMENTARY[b]]} ({COMPLEMENTARY[b]}) 配对 - {b === "A" || b === "T" ? 2 : 3} 个氢键
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedBase && (
        <>
          <div
            onClick={closeModal}
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(0,0,0,0.5)",
              zIndex: 999,
            }}
          />
          <div
            style={{
              position: "fixed",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              background: "#fff",
              borderRadius: 12,
              padding: 24,
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)",
              zIndex: 1000,
              minWidth: 320,
              maxWidth: 500,
              border: "1px solid #e5e7eb",
            }}
          >
            <button
              onClick={closeModal}
              style={{
                position: "absolute",
                top: 16,
                right: 16,
                background: "none",
                border: "none",
                fontSize: 20,
                color: "#6b7280",
                cursor: "pointer",
                lineHeight: 1,
              }}
            >
              ×
            </button>
            <div
              style={{
                fontSize: 15,
                fontWeight: 600,
                color: "#182544",
                marginBottom: 16,
                paddingBottom: 12,
                borderBottom: "2px solid #e5e7eb",
              }}
            >
              碱基配对详情
            </div>
            <div style={{ fontSize: 14, color: "#6b7280", lineHeight: 1.8 }}>
              <p><strong style={{ color: "#182544" }}>选中碱基：</strong>{BASE_NAMES[selectedBase.base]} ({selectedBase.base})</p>
              <p><strong style={{ color: "#182544" }}>配对碱基：</strong>{BASE_NAMES[selectedBase.pair]} ({selectedBase.pair})</p>
              <p><strong style={{ color: "#182544" }}>氢键数量：</strong>{(selectedBase.base === "A" || selectedBase.base === "T") ? 2 : 3} 个</p>
              <p><strong style={{ color: "#182544" }}>配对规则：</strong></p>
              <ul style={{ margin: "8px 0", paddingLeft: 20 }}>
                {(selectedBase.base === "A" || selectedBase.base === "T") ? (
                  <>
                    <li>腺嘌呤 (A) 与 胸腺嘧啶 (T) 通过 <strong>2 个氢键</strong> 配对</li>
                    <li>嘌呤与嘧啶配对，保持 DNA 双螺旋结构稳定</li>
                  </>
                ) : (
                  <>
                    <li>鸟嘌呤 (G) 与 胞嘧啶 (C) 通过 <strong>3 个氢键</strong> 配对</li>
                    <li>G-C 配对比 A-T 配对更稳定（氢键更多）</li>
                  </>
                )}
              </ul>
              <p style={{ marginTop: 12, fontSize: 13, color: "#6b7280" }}>
                碱基互补配对是 DNA 复制和遗传信息传递的基础
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default DNAStructure;
