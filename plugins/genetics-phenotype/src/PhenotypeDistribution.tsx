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

interface PhenotypeItem {
  phenotype: string;
  count: number;
  percentage: number;
}

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16"];

function parseData(phenotypes: string, counts: string): PhenotypeItem[] {
  const labels = phenotypes.split(",").map((s) => s.trim()).filter(Boolean);
  const nums = counts.split(",").map((s) => Number(s.trim())).filter((n) => Number.isFinite(n));
  const total = nums.reduce((a, b) => a + b, 0);
  return labels.map((label, i) => ({
    phenotype: label,
    count: nums[i] || 0,
    percentage: total > 0 ? ((nums[i] || 0) / total) * 100 : 0,
  }));
}

export function PhenotypeDistribution({ node }: { node: A2UINode }) {
  const props = node.properties ?? {};

  const initTrait = parseStr(props.trait, "豌豆颜色");
  const initPhenotypes = parseStr(props.phenotypes, "黄色,绿色");
  const initCounts = parseStr(props.counts, "75,25");
  const initInteractive = parseBool(props.interactive, true);

  const [trait, setTrait] = useState(initTrait);
  const [phenotypes, setPhenotypes] = useState(initPhenotypes);
  const [counts, setCounts] = useState(initCounts);
  const [interactive, setInteractive] = useState(initInteractive);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [filters, setFilters] = useState<Set<number>>(new Set());
  const [viewMode, setViewMode] = useState<"bar" | "pie">("bar");

  const pieCanvasRef = useRef<HTMLCanvasElement>(null);
  const [pieSize, setPieSize] = useState(260);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setTrait(initTrait); }, [initTrait]);
  useEffect(() => { setPhenotypes(initPhenotypes); setFilters(new Set()); }, [initPhenotypes]);
  useEffect(() => { setCounts(initCounts); }, [initCounts]);
  useEffect(() => { setInteractive(initInteractive); }, [initInteractive]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.floor(entry.contentRect.width);
        setPieSize(Math.max(180, Math.min(320, w - 60)));
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const data = parseData(phenotypes, counts);
  const filteredData = filters.size > 0 ? data.filter((_, i) => filters.has(i)) : data;
  const totalCount = filteredData.reduce((s, d) => s + d.count, 0);
  const maxCount = Math.max(...filteredData.map((d) => d.count), 1);

  const toggleFilter = useCallback((idx: number) => {
    setFilters((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) { next.delete(idx); if (next.size === 0) return new Set(); }
      else next.add(idx);
      return next;
    });
  }, []);

  useEffect(() => {
    if (viewMode !== "pie") return;
    const canvas = pieCanvasRef.current;
    if (!canvas || filteredData.length === 0) return;

    const dpr = window.devicePixelRatio || 1;
    const size = pieSize * dpr;
    canvas.width = size;
    canvas.height = size;
    canvas.style.width = `${pieSize}px`;
    canvas.style.height = `${pieSize}px`;

    const ctx = canvas.getContext("2d")!;
    const cx = size / 2;
    const cy = size / 2;
    const outerR = size * 0.42;
    const innerR = size * 0.22;
    const total = filteredData.reduce((s, d) => s + d.count, 0);
    if (total === 0) return;

    ctx.clearRect(0, 0, size, size);

    let startAngle = -Math.PI / 2;
    for (let i = 0; i < filteredData.length; i++) {
      const item = filteredData[i];
      const sweepAngle = (item.count / total) * 2 * Math.PI;
      const endAngle = startAngle + sweepAngle;
      const originalIdx = data.findIndex((d) => d.phenotype === item.phenotype);
      const color = COLORS[originalIdx % COLORS.length];
      const isSelected = selectedIdx === originalIdx;
      const offset = isSelected ? 8 * dpr : 0;
      const midAngle = startAngle + sweepAngle / 2;
      const ox = Math.cos(midAngle) * offset;
      const oy = Math.sin(midAngle) * offset;

      ctx.beginPath();
      ctx.arc(cx + ox, cy + oy, outerR, startAngle, endAngle);
      ctx.arc(cx + ox, cy + oy, innerR, endAngle, startAngle, true);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();

      if (isSelected) {
        ctx.strokeStyle = "#182544";
        ctx.lineWidth = 2 * dpr;
        ctx.stroke();
      }

      if (sweepAngle > 0.3) {
        const labelR = (outerR + innerR) / 2;
        const lx = cx + ox + Math.cos(midAngle) * labelR;
        const ly = cy + oy + Math.sin(midAngle) * labelR;
        ctx.fillStyle = "#fff";
        ctx.font = `bold ${10 * dpr}px Manrope, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(`${item.percentage.toFixed(0)}%`, lx, ly);
      }

      if (sweepAngle > 0.15) {
        const labelR2 = outerR + 18 * dpr;
        const lx2 = cx + Math.cos(midAngle) * labelR2;
        const ly2 = cy + Math.sin(midAngle) * labelR2;
        ctx.fillStyle = "#374151";
        ctx.font = `${9 * dpr}px Manrope, sans-serif`;
        ctx.textAlign = midAngle > Math.PI / 2 && midAngle < Math.PI * 1.5 ? "right" : "left";
        ctx.textBaseline = "middle";
        ctx.fillText(item.phenotype, lx2, ly2);
      }

      startAngle = endAngle;
    }

    ctx.fillStyle = "#182544";
    ctx.font = `bold ${14 * dpr}px Manrope, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${totalCount}`, cx, cy - 6 * dpr);
    ctx.fillStyle = "#6b7280";
    ctx.font = `${9 * dpr}px Manrope, sans-serif`;
    ctx.fillText("总计", cx, cy + 10 * dpr);
  }, [viewMode, filteredData, data, selectedIdx, pieSize]);

  useEffect(() => {
    if (viewMode !== "pie") return;
    const canvas = pieCanvasRef.current;
    if (!canvas || !interactive) return;
    const handler = (e: React.MouseEvent<HTMLCanvasElement>) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const cx = pieSize / 2;
      const cy = pieSize / 2;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.hypot(dx, dy);
      const outerR = pieSize * 0.42;
      const innerR = pieSize * 0.22;
      if (dist < innerR || dist > outerR) { setSelectedIdx(null); return; }
      let angle = Math.atan2(dy, dx);
      if (angle < -Math.PI / 2) angle += 2 * Math.PI;
      const total = filteredData.reduce((s, d) => s + d.count, 0);
      let cumAngle = -Math.PI / 2;
      for (let i = 0; i < filteredData.length; i++) {
        const sweep = (filteredData[i].count / total) * 2 * Math.PI;
        if (angle >= cumAngle && angle < cumAngle + sweep) {
          const origIdx = data.findIndex((d) => d.phenotype === filteredData[i].phenotype);
          setSelectedIdx(origIdx);
          return;
        }
        cumAngle += sweep;
      }
      setSelectedIdx(null);
    };
    canvas.addEventListener("click", handler as any);
    return () => canvas.removeEventListener("click", handler as any);
  }, [viewMode, filteredData, data, pieSize, interactive]);

  if (data.length === 0) {
    return <div style={{ background: "#faf9f5", borderRadius: 12, padding: 24, textAlign: "center", color: "#6b7280", fontFamily: "Manrope, sans-serif", fontStyle: "italic" }}>暂无表型分布数据</div>;
  }

  return (
    <div ref={containerRef} style={{ background: "#faf9f5", borderRadius: 12, padding: 16, fontFamily: "Manrope, sans-serif", maxWidth: 700, width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: "#182544" }}>{trait || "表型分布"}</div>
        <div style={{ display: "flex", gap: 4 }}>
          <button
            onClick={() => setViewMode("bar")}
            style={{ padding: "4px 12px", borderRadius: 6, border: "1px solid", borderColor: viewMode === "bar" ? "#182544" : "#e5e7eb", background: viewMode === "bar" ? "#182544" : "#fff", color: viewMode === "bar" ? "#fff" : "#6b7280", fontSize: 12, cursor: "pointer", fontFamily: "Manrope, sans-serif", fontWeight: 500 }}
          >
            柱状图
          </button>
          <button
            onClick={() => setViewMode("pie")}
            style={{ padding: "4px 12px", borderRadius: 6, border: "1px solid", borderColor: viewMode === "pie" ? "#182544" : "#e5e7eb", background: viewMode === "pie" ? "#182544" : "#fff", color: viewMode === "pie" ? "#fff" : "#6b7280", fontSize: 12, cursor: "pointer", fontFamily: "Manrope, sans-serif", fontWeight: 500 }}
          >
            环形图
          </button>
        </div>
      </div>

      {interactive && (
        <div style={{ marginBottom: 10, padding: 10, background: "#fff", borderRadius: 8, border: "1px solid #e5e7eb" }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#182544", marginBottom: 6 }}>筛选表型</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {data.map((item, i) => {
              const active = filters.size === 0 || filters.has(i);
              return (
                <label key={i} onClick={() => toggleFilter(i)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 10px", background: active ? "#182544" : "#fff", color: active ? "#fff" : "#1b1c1a", border: "1px solid", borderColor: active ? "#182544" : "#e5e7eb", borderRadius: 6, cursor: "pointer", fontSize: 12, transition: "all 0.2s" }}>
                  <input type="checkbox" checked={active} readOnly style={{ width: 12, height: 12, cursor: "pointer" }} />
                  {item.phenotype}
                </label>
              );
            })}
          </div>
        </div>
      )}

      {viewMode === "bar" ? (
        <div style={{ background: "#fff", padding: 14, borderRadius: 8, border: "1px solid #e5e7eb" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {filteredData.map((item) => {
              const originalIdx = data.findIndex((d) => d.phenotype === item.phenotype);
              const color = COLORS[originalIdx % COLORS.length];
              const barW = (item.count / maxCount) * 100;
              const isSelected = selectedIdx === originalIdx;
              return (
                <div key={item.phenotype} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ minWidth: 70, fontSize: 12, fontWeight: 500, color: "#6b7280", textAlign: "right" }}>{item.phenotype}</div>
                  <div style={{ flex: 1, height: 24, background: "#fafafa", borderRadius: 4, overflow: "hidden", border: "1px solid #e5e7eb" }}>
                    <div onClick={() => interactive && setSelectedIdx(isSelected ? null : originalIdx)} style={{ height: "100%", width: `${barW}%`, background: color, borderRadius: 4, display: "flex", alignItems: "center", paddingLeft: 8, transition: "width 0.5s ease-out, box-shadow 0.2s", cursor: interactive ? "pointer" : "default", boxShadow: isSelected ? `0 0 0 3px ${color}44` : "none" }}>
                      {barW > 15 && <span style={{ color: "#fff", fontWeight: 600, fontSize: 11, whiteSpace: "nowrap" }}>{item.percentage.toFixed(1)}%</span>}
                    </div>
                  </div>
                  <div style={{ minWidth: 70 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#182544" }}>{item.percentage.toFixed(1)}%</div>
                    <div style={{ fontSize: 10, color: "#6b7280" }}>{item.count}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div style={{ background: "#fff", padding: 14, borderRadius: 8, border: "1px solid #e5e7eb", display: "flex", justifyContent: "center" }}>
          <canvas ref={pieCanvasRef} style={{ cursor: interactive ? "pointer" : "default" }} />
        </div>
      )}

      <div style={{ marginTop: 10, padding: 10, background: "#fafafa", borderRadius: 6, border: "1px solid #e5e7eb", display: "flex", justifyContent: "space-around" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 10, color: "#6b7280" }}>总数量</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "#182544" }}>{totalCount}</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 10, color: "#6b7280" }}>表型种类</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "#182544" }}>{filteredData.length}</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 10, color: "#6b7280" }}>最大数量</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "#182544" }}>{Math.max(...filteredData.map((d) => d.count), 0)}</div>
        </div>
      </div>

      <div style={{ marginTop: 10, padding: 10, background: "#fff", borderRadius: 6, border: "1px solid #e5e7eb" }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "#182544", marginBottom: 6 }}>颜色图例</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 6 }}>
          {data.map((item, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: 4, borderRadius: 4, background: selectedIdx === i ? "#f3f4f6" : "transparent" }}>
              <div style={{ width: 14, height: 14, borderRadius: 3, background: COLORS[i % COLORS.length], flexShrink: 0 }} />
              <div style={{ fontSize: 11, color: "#6b7280" }}>
                <strong style={{ color: "#1b1c1a" }}>{item.phenotype}</strong>
                <br /><small>{item.percentage.toFixed(1)}% ({item.count})</small>
              </div>
            </div>
          ))}
        </div>
      </div>

      {selectedIdx !== null && data[selectedIdx] && (
        <>
          <div onClick={() => setSelectedIdx(null)} style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", zIndex: 999 }} />
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", background: "#fff", borderRadius: 12, padding: 24, boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)", zIndex: 1000, minWidth: 320, maxWidth: 500, border: "1px solid #e5e7eb" }}>
            <button onClick={() => setSelectedIdx(null)} style={{ position: "absolute", top: 16, right: 16, background: "none", border: "none", fontSize: 20, color: "#6b7280", cursor: "pointer", lineHeight: 1 }}>×</button>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#182544", marginBottom: 16, paddingBottom: 12, borderBottom: "2px solid #e5e7eb", display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 20, height: 20, borderRadius: 5, background: COLORS[selectedIdx % COLORS.length] }} />
              {data[selectedIdx].phenotype}
            </div>
            <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.8 }}>
              <p><strong style={{ color: "#182544" }}>数量：</strong>{data[selectedIdx].count} 个体</p>
              <p><strong style={{ color: "#182544" }}>百分比：</strong>{data[selectedIdx].percentage.toFixed(2)}%</p>
              <p><strong style={{ color: "#182544" }}>占比：</strong>{data[selectedIdx].count} / {totalCount}</p>
              <ul style={{ margin: "8px 0", paddingLeft: 20, lineHeight: 2 }}>
                <li>该表型在群体中的频率为 {data[selectedIdx].percentage.toFixed(2)}%</li>
                <li>共有 {data[selectedIdx].count} 个个体表现出该表型</li>
              </ul>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default PhenotypeDistribution;
