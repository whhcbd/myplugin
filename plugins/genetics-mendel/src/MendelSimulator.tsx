import { useState, useEffect, useRef, useCallback } from "react";

interface A2UINode {
  properties?: Record<string, unknown>;
}

function parseStr(val: unknown, fb: string): string { return typeof val === "string" ? val : fb; }
function parseNum(val: unknown, fb: number): number {
  if (typeof val === "number") return val;
  if (typeof val === "string") { const n = Number(val); return isNaN(n) ? fb : n; }
  return fb;
}
function parseBool(val: unknown, fb: boolean): boolean {
  if (typeof val === "boolean") return val;
  if (typeof val === "string") return val === "true";
  return fb;
}

interface SimResult {
  genotype: string;
  count: number;
  percentage: number;
  expectedPercentage: number;
}
interface ChiSquare {
  value: number;
  df: number;
  pValue: number;
  significant: boolean;
}

function getGametes(gt: string): string[] {
  if (gt.length === 2) return [gt[0], gt[1]];
  if (gt.length === 4) return [gt[0]+gt[2], gt[0]+gt[3], gt[1]+gt[2], gt[1]+gt[3]];
  return [];
}

function normalizeGt(gt: string): string {
  if (gt.length === 2) {
    return gt.split("").sort((a, b) => {
      if (a === a.toUpperCase() && b === b.toLowerCase()) return -1;
      if (a === a.toLowerCase() && b === b.toUpperCase()) return 1;
      return a.localeCompare(b);
    }).join("");
  }
  if (gt.length === 4) {
    const s = (x: string) => x.split("").sort((a, b) => {
      if (a === a.toUpperCase() && b === b.toLowerCase()) return -1;
      if (a === a.toLowerCase() && b === b.toUpperCase()) return 1;
      return a.localeCompare(b);
    }).join("");
    return s(gt.slice(0, 2)) + s(gt.slice(2));
  }
  return gt;
}

function expectedPct(genotype: string, p1: string, p2: string): number {
  if (p1 === "Aa" && p2 === "Aa") {
    if (genotype === "AA") return 25;
    if (genotype === "Aa") return 50;
    if (genotype === "aa") return 25;
  }
  if (p1 === "AaBb" && p2 === "AaBb") {
    const m: Record<string, number> = { AABB:6.25,AABb:12.5,AAbb:6.25,AaBB:12.5,AaBb:25,Aabb:12.5,aaBB:6.25,aaBb:12.5,aabb:6.25 };
    return m[genotype] || 0;
  }
  const g1 = getGametes(p1), g2 = getGametes(p2);
  return 100 / (g1.length * g2.length);
}

function estimateP(chi: number, df: number): number {
  const cv: Record<number, number[]> = { 1:[3.84,6.63,10.83], 2:[5.99,9.21,13.82], 3:[7.81,11.34,16.27], 4:[9.49,13.28,18.47] };
  const c = cv[df] || [7.81, 11.34, 16.27];
  if (chi < c[0]) return 0.1;
  if (chi < c[1]) return 0.03;
  if (chi < c[2]) return 0.005;
  return 0.0001;
}

function useGroupedBarChart(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  results: SimResult[],
) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !results.length) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const cw = canvas.offsetWidth || 500;
    const ch = canvas.offsetHeight || 400;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = cw * dpr;
    canvas.height = ch * dpr;
    ctx.scale(dpr, dpr);

    const pl = 60, pr = 20, pt = 30, pb = 60;
    const w = cw - pl - pr;
    const h = ch - pt - pb;

    const maxY = Math.max(100, ...results.map(r => Math.max(r.percentage, r.expectedPercentage)));
    const yMax = Math.ceil(maxY / 25) * 25;

    ctx.clearRect(0, 0, cw, ch);

    ctx.strokeStyle = "#e5e7eb";
    ctx.lineWidth = 1;
    ctx.fillStyle = "#9ca3af";
    ctx.font = "11px Manrope, sans-serif";
    ctx.textAlign = "right";
    for (let i = 0; i <= 5; i++) {
      const val = Math.round((yMax / 5) * (5 - i));
      const y = pt + (i / 5) * h;
      ctx.beginPath();
      ctx.moveTo(pl, y);
      ctx.lineTo(pl + w, y);
      ctx.stroke();
      ctx.fillText(val + "%", pl - 6, y + 4);
    }

    ctx.strokeStyle = "#d1d5db";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pl, pt);
    ctx.lineTo(pl, pt + h);
    ctx.lineTo(pl + w, pt + h);
    ctx.stroke();

    const groupW = w / results.length;
    const barW = groupW * 0.3;
    const gap = groupW * 0.1;

    results.forEach((r, i) => {
      const gx = pl + i * groupW + groupW * 0.15;

      const obsH = yMax > 0 ? (r.percentage / yMax) * h : 0;
      ctx.fillStyle = "#182544";
      ctx.fillRect(gx, pt + h - obsH, barW, obsH);

      const expH = yMax > 0 ? (r.expectedPercentage / yMax) * h : 0;
      ctx.fillStyle = "#775a19";
      ctx.fillRect(gx + barW + gap, pt + h - expH, barW, expH);

      ctx.fillStyle = "#1b1c1a";
      ctx.font = "12px Manrope, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(r.genotype, gx + barW + gap / 2, pt + h + 20);
    });

    ctx.font = "bold 11px Manrope, sans-serif";
    ctx.textAlign = "left";
    const lx = pl + 10, ly = pt + 16;
    ctx.fillStyle = "#182544";
    ctx.fillRect(lx, ly - 8, 12, 12);
    ctx.fillStyle = "#1b1c1a";
    ctx.fillText("实际比例", lx + 16, ly + 2);
    ctx.fillStyle = "#775a19";
    ctx.fillRect(lx + 90, ly - 8, 12, 12);
    ctx.fillStyle = "#1b1c1a";
    ctx.fillText("理论比例", lx + 106, ly + 2);

  }, [canvasRef, results]);
}

export default function MendelSimulator({ node }: { node: A2UINode }) {
  const props = node.properties ?? {};

  const [p1, setP1] = useState(parseStr(props.parent1Genotype, "Aa"));
  const [p2, setP2] = useState(parseStr(props.parent2Genotype, "Aa"));
  const [simCount, setSimCount] = useState(parseNum(props.simulationCount, 1000));
  const interactive = parseBool(props.interactive, true);

  const [results, setResults] = useState<SimResult[]>([]);
  const [chiSq, setChiSq] = useState<ChiSquare | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [speed, setSpeed] = useState<"slow" | "fast" | "instant">("fast");

  const chartRef = useRef<HTMLCanvasElement>(null);
  useGroupedBarChart(chartRef, results);

  useEffect(() => { setP1(parseStr(props.parent1Genotype, "Aa")); }, [props.parent1Genotype]);
  useEffect(() => { setP2(parseStr(props.parent2Genotype, "Aa")); }, [props.parent2Genotype]);
  useEffect(() => { setSimCount(parseNum(props.simulationCount, 1000)); }, [props.simulationCount]);

  const runSim = useCallback(async () => {
    if (simulating) return;
    setSimulating(true);
    setResults([]);
    setChiSq(null);

    const g1 = getGametes(p1);
    const g2 = getGametes(p2);
    const counts = new Map<string, number>();
    const total = simCount;
    const batch = speed === "instant" ? total : speed === "fast" ? 100 : 10;
    const delay = speed === "instant" ? 0 : speed === "fast" ? 10 : 50;

    for (let i = 0; i < total; i++) {
      const a1 = g1[Math.floor(Math.random() * g1.length)];
      const a2 = g2[Math.floor(Math.random() * g2.length)];
      const child = normalizeGt(a1 + a2);
      counts.set(child, (counts.get(child) || 0) + 1);

      if ((i + 1) % batch === 0 || i === total - 1) {
        const cur = i + 1;
        const res = Array.from(counts.entries()).map(([gt, cnt]) => ({
          genotype: gt,
          count: cnt,
          percentage: (cnt / cur) * 100,
          expectedPercentage: expectedPct(gt, p1, p2),
        })).sort((a, b) => b.count - a.count);
        setResults(res);
        if (delay > 0) await new Promise(r => setTimeout(r, delay));
      }
    }

    let chiVal = 0;
    const df = counts.size - 1;
    counts.forEach((obs, gt) => {
      const exp = (expectedPct(gt, p1, p2) / 100) * total;
      chiVal += Math.pow(obs - exp, 2) / exp;
    });
    const pVal = estimateP(chiVal, df);
    setChiSq({ value: chiVal, df, pValue: pVal, significant: pVal < 0.05 });
    setSimulating(false);
  }, [simulating, p1, p2, simCount, speed]);

  const handleReset = useCallback(() => {
    setResults([]);
    setChiSq(null);
  }, []);

  const S = {
    host: { display: "block", fontFamily: "Manrope, sans-serif", padding: 24, background: "#faf9f5", borderRadius: 12, color: "#1b1c1a" },
    box: { maxWidth: 1200, margin: "0 auto" },
    title: { fontSize: "1.5rem", fontWeight: 700, color: "#1b1c1a", marginBottom: 24, textAlign: "center" as const },
    ctrlBox: { background: "#fff", padding: 20, borderRadius: 12, marginBottom: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" },
    row: { display: "flex", gap: 16, alignItems: "flex-end", marginBottom: 16 },
    group: { flex: 1 },
    label: { display: "block", fontSize: "0.9rem", fontWeight: 600, color: "#1b1c1a", marginBottom: 8 },
    input: { width: "100%", padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: "0.9rem", fontFamily: "Manrope, sans-serif", boxSizing: "border-box" as const },
    btnRow: { display: "flex", gap: 12, marginTop: 20 },
    btn: (variant: "primary" | "secondary") => ({
      padding: "10px 20px", border: "none", borderRadius: 6, fontSize: "0.9rem", fontWeight: 600,
      cursor: "pointer", background: variant === "primary" ? "#182544" : "#6b7280", color: "#fff",
    }),
    resultBox: { background: "#fff", padding: 20, borderRadius: 12, marginBottom: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" },
    sectionTitle: { fontSize: "1.1rem", fontWeight: 600, color: "#1b1c1a", marginBottom: 16 },
    table: { width: "100%", borderCollapse: "collapse" as const, marginBottom: 20 },
    th: { background: "#f3f4f6", padding: 12, textAlign: "left" as const, fontWeight: 600, color: "#374151", borderBottom: "2px solid #e5e7eb" },
    td: { padding: 12, borderBottom: "1px solid #e5e7eb", color: "#6b7280" },
    gtCell: { fontFamily: "'Courier New', monospace", fontWeight: 600, color: "#1b1c1a" },
    chiBox: (sig: boolean) => ({
      background: sig ? "#fef2f2" : "#f0f4ff", border: `2px solid ${sig ? "#8b3a3a" : "#182544"}`,
      borderRadius: 8, padding: 16, marginTop: 20,
    }),
    chiVal: (sig: boolean) => ({ fontSize: "1.5rem", fontWeight: 700, color: sig ? "#8b3a3a" : "#182544", marginBottom: 8 }),
    chiInfo: { fontSize: "0.9rem", color: "#6b7280", lineHeight: 1.6 },
    chiConclusion: (sig: boolean) => ({
      marginTop: 12, padding: 12, background: "#fff", borderRadius: 6,
      fontSize: "0.9rem", fontWeight: 600, color: sig ? "#8b3a3a" : "#5a7752",
    }),
    empty: { textAlign: "center" as const, padding: "60px 20px", color: "#9ca3af" },
    spinner: { width: 40, height: 40, border: "4px solid #e5e7eb", borderTopColor: "#182544", borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto" },
  };

  return (
    <div style={S.host}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={S.box}>
        <h2 style={S.title}>🧬 孟德尔实验模拟器</h2>

        {interactive && (
          <>
            <div style={S.ctrlBox}>
              <div style={S.row}>
                <div style={S.group}>
                  <label style={S.label}>亲本1基因型</label>
                  <input style={S.input} value={p1} onChange={e => setP1(e.target.value.trim())} placeholder="例如: Aa 或 AaBb" />
                </div>
                <div style={S.group}>
                  <label style={S.label}>亲本2基因型</label>
                  <input style={S.input} value={p2} onChange={e => setP2(e.target.value.trim())} placeholder="例如: Aa 或 AaBb" />
                </div>
              </div>

              <div style={S.row}>
                <div style={S.group}>
                  <label style={S.label}>模拟次数</label>
                  <select style={S.input} value={simCount} onChange={e => setSimCount(parseInt(e.target.value, 10))}>
                    <option value={100}>100 次</option>
                    <option value={1000}>1000 次</option>
                    <option value={10000}>10000 次</option>
                  </select>
                </div>
                <div style={S.group}>
                  <label style={S.label}>模拟速度</label>
                  <select style={S.input} value={speed} onChange={e => setSpeed(e.target.value as "slow" | "fast" | "instant")}>
                    <option value="slow">慢速（动画）</option>
                    <option value="fast">快速</option>
                    <option value="instant">瞬时</option>
                  </select>
                </div>
              </div>

              <div style={S.btnRow}>
                <button style={S.btn("primary")} onClick={runSim} disabled={simulating}>
                  {simulating ? "模拟中..." : "开始模拟"}
                </button>
                <button style={S.btn("secondary")} onClick={handleReset} disabled={simulating || !results.length}>
                  重置
                </button>
              </div>
            </div>

            {results.length > 0 ? (
              <div style={S.resultBox}>
                {simulating && <div style={S.spinner} />}
                <h3 style={S.sectionTitle}>📊 模拟结果</h3>

                <table style={S.table}>
                  <thead>
                    <tr>
                      <th style={S.th}>基因型</th>
                      <th style={S.th}>数量</th>
                      <th style={S.th}>实际比例</th>
                      <th style={S.th}>理论比例</th>
                      <th style={S.th}>偏差</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map(r => {
                      const dev = r.percentage - r.expectedPercentage;
                      return (
                        <tr key={r.genotype}>
                          <td style={S.gtCell}>{r.genotype}</td>
                          <td style={S.td}>{r.count}</td>
                          <td style={{ ...S.td, fontWeight: 600 }}>{r.percentage.toFixed(2)}%</td>
                          <td style={S.td}>{r.expectedPercentage.toFixed(2)}%</td>
                          <td style={{ ...S.td, color: Math.abs(dev) > 5 ? "#8b3a3a" : "#6b7280", fontWeight: Math.abs(dev) > 5 ? 600 : 400 }}>
                            {dev > 0 ? "+" : ""}{dev.toFixed(2)}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                <canvas ref={chartRef} style={{ width: "100%", height: 400 }} />

                {chiSq && (
                  <div style={S.chiBox(chiSq.significant)}>
                    <div style={{ fontSize: "1rem", fontWeight: 600, color: "#1b1c1a", marginBottom: 12 }}>卡方检验（χ² Test）</div>
                    <div style={S.chiVal(chiSq.significant)}>χ² = {chiSq.value.toFixed(3)}</div>
                    <div style={S.chiInfo}>
                      自由度 (df) = {chiSq.df}<br />
                      p 值 ≈ {chiSq.pValue.toFixed(4)}<br />
                      显著性水平 α = 0.05
                    </div>
                    <div style={S.chiConclusion(chiSq.significant)}>
                      {chiSq.significant
                        ? "❌ 实际结果与理论比例存在显著差异（p < 0.05），拒绝原假设"
                        : "✅ 实际结果与理论比例无显著差异（p ≥ 0.05），符合孟德尔定律"}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div style={S.resultBox}>
                <div style={S.empty}>
                  <div style={{ fontSize: "3rem", marginBottom: 16 }}>🧪</div>
                  <div>点击"开始模拟"按钮运行孟德尔实验</div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
