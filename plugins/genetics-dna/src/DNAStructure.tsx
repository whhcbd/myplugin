import { useState, useEffect, useCallback, useRef } from "react";

interface A2UINode {
  properties?: Record<string, unknown>;
}

function parseStr(val: unknown, fallback: string): string {
  return typeof val === "string" ? val : fallback;
}

function parseBool(val: unknown, fallback: boolean): boolean {
  return typeof val === "boolean" ? val : fallback;
}

const COMPLEMENTARY: Record<string, string> = { A: "T", T: "A", C: "G", G: "C" };
const BASE_NAMES: Record<string, string> = { A: "腺嘌呤", T: "胸腺嘧啶", C: "胞嘧啶", G: "鸟嘌呤" };
const BASE_COLORS: Record<string, string> = { A: "#f59e0b", T: "#3b82f6", C: "#10b981", G: "#ec4899" };

function isValidSequence(seq: string): boolean {
  return /^[ATCGatcg]+$/.test(seq);
}

function getSequenceStats(seq: string) {
  const upper = seq.toUpperCase();
  const counts: Record<string, number> = { A: 0, T: 0, C: 0, G: 0 };
  for (const ch of upper) if (counts[ch] !== undefined) counts[ch]++;
  const gcContent = upper.length > 0 ? ((counts.G + counts.C) / upper.length) * 100 : 0;
  return { counts, length: upper.length, gcContent };
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
  const [rotation, setRotation] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const angleRef = useRef<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ w: 600, h: 400 });

  useEffect(() => { setSequence(initSequence); }, [initSequence]);
  useEffect(() => { setShowLabels(initShowLabels); }, [initShowLabels]);
  useEffect(() => { setInteractive(initInteractive); }, [initInteractive]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.floor(entry.contentRect.width);
        setCanvasSize({ w, h: Math.max(300, Math.min(500, w * 0.65)) });
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const upperSeq = sequence.toUpperCase();
  const valid = isValidSequence(upperSeq);

  useEffect(() => {
    if (!valid || upperSeq.length === 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const W = canvasSize.w * dpr;
    const H = canvasSize.h * dpr;
    canvas.width = W;
    canvas.height = H;
    canvas.style.width = `${canvasSize.w}px`;
    canvas.style.height = `${canvasSize.h}px`;

    const ctx = canvas.getContext("2d")!;
    const bases = upperSeq.split("");
    const compBases = bases.map((b) => COMPLEMENTARY[b] || "?");
    const n = bases.length;

    function draw() {
      ctx.clearRect(0, 0, W, H);

      if (rotation === 0) {
        angleRef.current += 0.008;
      } else {
        angleRef.current = (rotation * Math.PI) / 180;
      }
      const angle = angleRef.current;

      const cx = W / 2;
      const cy = H / 2;
      const radiusX = Math.min(W * 0.35, (n * 14 * dpr));
      const radiusY = Math.min(H * 0.32, 120 * dpr);
      const stepAngle = (2 * Math.PI) / Math.max(n, 1);

      ctx.strokeStyle = "rgba(24,37,68,0.06)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(cx, cy, radiusX, radiusY, 0, 0, 2 * Math.PI);
      ctx.stroke();

      for (let i = 0; i < n; i++) {
        const theta = angle + i * stepAngle;
        const nextTheta = angle + ((i + 1) % n) * stepAngle;

        const x1 = cx + radiusX * Math.cos(theta);
        const y1 = cy + radiusY * Math.sin(theta);
        const z1 = Math.sin(theta);

        const x2 = cx + radiusX * Math.cos(nextTheta);
        const y2 = cy + radiusY * Math.sin(nextTheta);

        const alpha = 0.3 + 0.7 * ((z1 + 1) / 2);
        ctx.strokeStyle = `rgba(148, 163, 184, ${alpha * 0.5})`;
        ctx.lineWidth = 1.5 * dpr;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        const xBack = cx + radiusX * Math.cos(theta + Math.PI);
        const yBack = cy + radiusY * Math.sin(theta + Math.PI);
        ctx.strokeStyle = `rgba(148, 163, 184, ${alpha * 0.25})`;
        ctx.lineWidth = 1 * dpr;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(xBack, yBack);
        ctx.stroke();

        const midX = (x1 + xBack) / 2;
        const midY = (y1 + yBack) / 2;
        const isAT = bases[i] === "A" || bases[i] === "T";
        const hbCount = isAT ? 2 : 3;
        for (let h = 0; h < hbCount; h++) {
          const offset = ((h - (hbCount - 1) / 2) * 4) * dpr;
          ctx.strokeStyle = `rgba(107, 114, 128, ${alpha * 0.4})`;
          ctx.lineWidth = 1 * dpr;
          ctx.beginPath();
          ctx.moveTo(x1 + offset, y1);
          ctx.lineTo(xBack + offset, yBack);
          ctx.stroke();
        }
      }

      const items: { x: number; y: number; z: number; base: string; strand: "top" | "bottom"; idx: number }[] = [];
      for (let i = 0; i < n; i++) {
        const theta = angle + i * stepAngle;
        const z = Math.sin(theta);
        items.push({
          x: cx + radiusX * Math.cos(theta),
          y: cy + radiusY * Math.sin(theta),
          z, base: bases[i], strand: "top", idx: i,
        });
        items.push({
          x: cx + radiusX * Math.cos(theta + Math.PI),
          y: cy + radiusY * Math.sin(theta + Math.PI),
          z, base: compBases[i], strand: "bottom", idx: i,
        });
      }
      items.sort((a, b) => a.z - b.z);

      const r = 10 * dpr;
      for (const item of items) {
        const alpha = 0.4 + 0.6 * ((item.z + 1) / 2);
        const color = BASE_COLORS[item.base] || "#6b7280";

        ctx.globalAlpha = alpha;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(item.x, item.y, r, 0, 2 * Math.PI);
        ctx.fill();

        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 1.5 * dpr;
        ctx.stroke();

        ctx.fillStyle = "#fff";
        ctx.font = `bold ${9 * dpr}px monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(item.base, item.x, item.y);
        ctx.globalAlpha = 1;

        if (showLabels && item.strand === "top" && item.z > 0.3) {
          ctx.fillStyle = `rgba(107, 114, 128, ${alpha})`;
          ctx.font = `${8 * dpr}px Manrope, sans-serif`;
          ctx.fillText(`${item.idx + 1}`, item.x, item.y - r - 5 * dpr);
        }
      }

      ctx.fillStyle = "#6b7280";
      ctx.font = `${10 * dpr}px Manrope, sans-serif`;
      ctx.textAlign = "left";
      ctx.fillText("5'", cx - radiusX - 20 * dpr, cy);
      ctx.textAlign = "right";
      ctx.fillText("3'", cx + radiusX + 20 * dpr, cy);
      ctx.textAlign = "right";
      ctx.fillText("5'", cx + radiusX + 20 * dpr, cy + 14 * dpr);

      animRef.current = requestAnimationFrame(draw);
    }

    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [valid, upperSeq, showLabels, rotation, canvasSize]);

  const handleBaseClick = useCallback(
    (base: string, index: number) => {
      if (!interactive) return;
      setSelectedBase({ base, index, pair: COMPLEMENTARY[base] || "?" });
    },
    [interactive]
  );

  const closeModal = useCallback(() => setSelectedBase(null), []);

  if (!valid || upperSeq.length === 0) {
    return (
      <div style={{ background: "#faf9f5", borderRadius: 12, padding: 24, textAlign: "center", color: "#6b7280", fontFamily: "Manrope, sans-serif", fontStyle: "italic" }}>
        {upperSeq.length === 0 ? "请输入 DNA 序列（例如：ATCGATCG）" : "DNA 序列包含无效的碱基。请只使用 A、T、C、G。"}
      </div>
    );
  }

  const stats = getSequenceStats(upperSeq);
  const compStrand = upperSeq.split("").map((b) => COMPLEMENTARY[b] || "?").join("");

  const baseChip = (base: string) => ({
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 28,
    height: 28,
    borderRadius: 6,
    fontWeight: 700,
    fontSize: 13,
    fontFamily: "monospace",
    background: BASE_COLORS[base] || "#e5e7eb",
    color: "#fff",
  });

  return (
    <div ref={containerRef} style={{ background: "#faf9f5", borderRadius: 12, padding: 16, fontFamily: "Manrope, sans-serif", width: "100%", boxSizing: "border-box" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: "#182544" }}>DNA 双螺旋结构</div>
        {interactive && (
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ fontSize: 11, color: "#6b7280" }}>旋转</span>
            <input
              type="range" min={0} max={360} step={1} value={rotation}
              onChange={(e) => setRotation(Number(e.target.value))}
              style={{ width: 80, height: 4, appearance: "none", background: "#e5e7eb", borderRadius: 2 }}
            />
            <span style={{ fontSize: 11, color: "#6b7280", minWidth: 28 }}>{rotation}°</span>
            <button
              onClick={() => setRotation(0)}
              style={{ padding: "2px 8px", borderRadius: 4, border: "1px solid #e5e7eb", background: "#fff", fontSize: 11, cursor: "pointer", color: "#6b7280" }}
            >
              自动
            </button>
          </div>
        )}
      </div>

      <canvas
        ref={canvasRef}
        onClick={(e) => {
          if (!interactive) return;
          const rect = canvasRef.current?.getBoundingClientRect();
          if (!rect) return;
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;
          const dpr = window.devicePixelRatio || 1;
          const bases = upperSeq.split("");
          const compBases = bases.map((b) => COMPLEMENTARY[b] || "?");
          const n = bases.length;
          const W = canvasSize.w * dpr;
          const H = canvasSize.h * dpr;
          const cx = W / 2;
          const cy = H / 2;
          const radiusX = Math.min(W * 0.35, n * 14 * dpr);
          const radiusY = Math.min(H * 0.32, 120 * dpr);
          const stepAngle = (2 * Math.PI) / Math.max(n, 1);
          const angle = angleRef.current;
          const r = 14 * dpr;
          let closest: { idx: number; base: string; dist: number } | null = null;

          for (let i = 0; i < n; i++) {
            const theta = angle + i * stepAngle;

            const bx = (cx + radiusX * Math.cos(theta)) / dpr;
            const by = (cy + radiusY * Math.sin(theta)) / dpr;
            const dist = Math.hypot(x - bx, y - by);
            if (dist < r / dpr && (!closest || dist < closest.dist)) {
              closest = { idx: i, base: bases[i], dist };
            }

            const bbx = (cx + radiusX * Math.cos(theta + Math.PI)) / dpr;
            const bby = (cy + radiusY * Math.sin(theta + Math.PI)) / dpr;
            const bdist = Math.hypot(x - bbx, y - bby);
            if (bdist < r / dpr && (!closest || bdist < closest.dist)) {
              closest = { idx: i, base: compBases[i], dist: bdist };
            }
          }
          if (closest) handleBaseClick(closest.base, closest.idx);
        }}
        style={{ display: "block", borderRadius: 8, background: "#fff", width: "100%", cursor: interactive ? "pointer" : "default" }}
      />

      <div style={{ marginTop: 10, padding: 10, background: "#fff", borderRadius: 8, border: "1px solid #e5e7eb", borderLeft: "3px solid #182544" }}>
        <div style={{ fontFamily: "monospace", fontSize: 13, color: "#1b1c1a", lineHeight: 1.8, wordBreak: "break-all" }}>
          <strong>5'→3' 链：</strong>{upperSeq}<br />
          <strong>3'→5' 链：</strong>{compStrand}
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-around", marginTop: 10, padding: 10, background: "#fff", borderRadius: 8, border: "1px solid #e5e7eb" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 11, color: "#6b7280" }}>序列长度</div>
          <div style={{ fontSize: 17, fontWeight: 600, color: "#182544" }}>{stats.length} bp</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 11, color: "#6b7280" }}>GC 含量</div>
          <div style={{ fontSize: 17, fontWeight: 600, color: "#182544" }}>{stats.gcContent.toFixed(1)}%</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 11, color: "#6b7280" }}>碱基对</div>
          <div style={{ fontSize: 17, fontWeight: 600, color: "#182544" }}>{stats.length}</div>
        </div>
      </div>

      {showLabels && (
        <div style={{ marginTop: 10, padding: 10, background: "#fff", borderRadius: 8, border: "1px solid #e5e7eb" }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#182544", marginBottom: 8 }}>碱基配对规则</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8 }}>
            {(["A", "T", "C", "G"] as const).map((b) => (
              <div key={b} style={{ display: "flex", alignItems: "center", gap: 8, padding: 4, borderRadius: 4, background: "#fafafa" }}>
                <div style={baseChip(b) as React.CSSProperties}>{b}</div>
                <div style={{ fontSize: 11, color: "#6b7280" }}>
                  {BASE_NAMES[b]}<br />
                  <span style={{ fontSize: 10 }}>与 {BASE_NAMES[COMPLEMENTARY[b]]} ({COMPLEMENTARY[b]}) · {b === "A" || b === "T" ? 2 : 3} H键</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedBase && (
        <>
          <div onClick={closeModal} style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", zIndex: 999 }} />
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", background: "#fff", borderRadius: 12, padding: 24, boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)", zIndex: 1000, minWidth: 320, maxWidth: 500, border: "1px solid #e5e7eb" }}>
            <button onClick={closeModal} style={{ position: "absolute", top: 16, right: 16, background: "none", border: "none", fontSize: 20, color: "#6b7280", cursor: "pointer", lineHeight: 1 }}>×</button>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#182544", marginBottom: 16, paddingBottom: 12, borderBottom: "2px solid #e5e7eb" }}>碱基配对详情</div>
            <div style={{ fontSize: 14, color: "#6b7280", lineHeight: 1.8 }}>
              <p><strong style={{ color: "#182544" }}>选中碱基：</strong>{BASE_NAMES[selectedBase.base]} ({selectedBase.base})</p>
              <p><strong style={{ color: "#182544" }}>配对碱基：</strong>{BASE_NAMES[selectedBase.pair]} ({selectedBase.pair})</p>
              <p><strong style={{ color: "#182544" }}>氢键数量：</strong>{(selectedBase.base === "A" || selectedBase.base === "T") ? 2 : 3} 个</p>
              <p><strong style={{ color: "#182544" }}>配对规则：</strong></p>
              <ul style={{ margin: "8px 0", paddingLeft: 20 }}>
                {(selectedBase.base === "A" || selectedBase.base === "T") ? (
                  <><li>腺嘌呤 (A) 与 胸腺嘧啶 (T) 通过 <strong>2 个氢键</strong> 配对</li><li>嘌呤与嘧啶配对，保持 DNA 双螺旋结构稳定</li></>
                ) : (
                  <><li>鸟嘌呤 (G) 与 胞嘧啶 (C) 通过 <strong>3 个氢键</strong> 配对</li><li>G-C 配对比 A-T 配对更稳定（氢键更多）</li></>
                )}
              </ul>
              <p style={{ marginTop: 12, fontSize: 13, color: "#6b7280" }}>碱基互补配对是 DNA 复制和遗传信息传递的基础</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default DNAStructure;
