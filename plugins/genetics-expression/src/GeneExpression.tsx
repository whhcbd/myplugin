import { useState, useEffect, useRef, useCallback } from "react";

interface A2UINode {
  properties?: Record<string, unknown>;
}

function parseStr(val: unknown, fallback: string): string {
  return typeof val === "string" ? val : fallback;
}
function parseBool(val: unknown, fallback: boolean): boolean {
  if (typeof val === "boolean") return val;
  if (typeof val === "string") return val === "true";
  return fallback;
}

interface GeneData {
  gene: string;
  expressionLevels: number[];
}

interface Condition {
  name: string;
  color?: string;
}

const COLORS = [
  "#182544", "#775a19", "#5a7752", "#8b3a3a", "#4a5568", "#6b4c8a", "#2c7a7b", "#975a16",
];

const defaultGenes: GeneData[] = [
  { gene: "lacZ", expressionLevels: [80, 45, 90] },
  { gene: "lacY", expressionLevels: [30, 60, 50] },
  { gene: "lacA", expressionLevels: [70, 20, 85] },
];

const defaultConditions: Condition[] = [
  { name: "正常", color: "#182544" },
  { name: "胁迫", color: "#775a19" },
  { name: "恢复", color: "#5a7752" },
];

function parseGenes(raw: string): GeneData[] {
  try {
    const p = JSON.parse(raw);
    if (Array.isArray(p) && p.length > 0) return p;
  } catch {}
  return defaultGenes;
}
function parseConditions(raw: string): Condition[] {
  try {
    const p = JSON.parse(raw);
    if (Array.isArray(p) && p.length > 0) return p;
  } catch {}
  return defaultConditions;
}

function condColor(idx: number, conditions: Condition[]): string {
  return conditions[idx]?.color || COLORS[idx % COLORS.length];
}

function getMaxLevel(genes: GeneData[]): number {
  let m = 0;
  for (const g of genes) for (const l of g.expressionLevels) if (l > m) m = l;
  return m;
}
function getAvgLevel(gene: GeneData): number {
  if (!gene.expressionLevels.length) return 0;
  return gene.expressionLevels.reduce((a, b) => a + b, 0) / gene.expressionLevels.length;
}
function getOverallAvg(genes: GeneData[]): string {
  if (!genes.length) return "0.0";
  const s = genes.reduce((t, g) => t + getAvgLevel(g), 0);
  return (s / genes.length).toFixed(1);
}

function useLineChart(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  genes: GeneData[],
  conditions: Condition[],
  selectedGene: { gene: string; condIdx: number } | null,
) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const cw = canvas.offsetWidth || 600;
    const ch = canvas.offsetHeight || 300;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = cw * dpr;
    canvas.height = ch * dpr;
    ctx.scale(dpr, dpr);

    const pl = 50, pr = 80, pt = 20, pb = 36;
    const w = cw - pl - pr;
    const h = ch - pt - pb;

    const maxL = getMaxLevel(genes);
    const yMax = maxL <= 0 ? 100 : Math.ceil(maxL / 25) * 25;

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
      ctx.fillText(String(val), pl - 6, y + 4);
    }

    const xStep = conditions.length > 1 ? w / (conditions.length - 1) : w / 2;
    ctx.fillStyle = "#6b7280";
    ctx.font = "11px Manrope, sans-serif";
    ctx.textAlign = "center";
    conditions.forEach((c, i) => {
      const x = pl + (conditions.length > 1 ? i * xStep : w / 2);
      ctx.fillText(c.name, x, ch - 8);
    });

    ctx.strokeStyle = "#d1d5db";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pl, pt);
    ctx.lineTo(pl, pt + h);
    ctx.lineTo(pl + w, pt + h);
    ctx.stroke();

    for (let gi = 0; gi < genes.length; gi++) {
      const gene = genes[gi];
      const color = condColor(gi, conditions);
      if (!gene.expressionLevels.length) continue;

      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      gene.expressionLevels.forEach((level, i) => {
        const x = pl + (conditions.length > 1 ? i * xStep : w / 2);
        const y = pt + h - (yMax > 0 ? (level / yMax) * h : 0);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      gene.expressionLevels.forEach((level, i) => {
        const x = pl + (conditions.length > 1 ? i * xStep : w / 2);
        const y = pt + h - (yMax > 0 ? (level / yMax) * h : 0);
        const isSelected = selectedGene?.gene === gene.gene && selectedGene?.condIdx === i;
        ctx.beginPath();
        ctx.fillStyle = color;
        ctx.arc(x, y, isSelected ? 7 : 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = isSelected ? "#775a19" : "#ffffff";
        ctx.lineWidth = isSelected ? 2 : 1.5;
        ctx.stroke();
      });

      const lastLvl = gene.expressionLevels[gene.expressionLevels.length - 1];
      const lastX = pl + (conditions.length > 1 ? (gene.expressionLevels.length - 1) * xStep : w / 2);
      const lastY = pt + h - (yMax > 0 ? (lastLvl / yMax) * h : 0);
      ctx.fillStyle = color;
      ctx.font = "bold 12px Manrope, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(gene.gene, lastX + 8, lastY + 4);
    }
  }, [canvasRef, genes, conditions, selectedGene]);
}

export default function GeneExpression({ node }: { node: A2UINode }) {
  const props = node.properties ?? {};

  const rawGenes = parseStr(props.genes, "");
  const rawConds = parseStr(props.conditions, "");
  const interactive = parseBool(props.interactive, true);

  const [genes, setGenes] = useState<GeneData[]>(() => parseGenes(rawGenes));
  const [conditions] = useState<Condition[]>(() => parseConditions(rawConds));
  const [chartType, setChartType] = useState<"bar" | "line">("bar");
  const [selectedGene, setSelectedGene] = useState<{ gene: string; condIdx: number } | null>(null);
  const [lacMode, setLacMode] = useState(false);
  const [lactose, setLactose] = useState(false);

  const lineCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    setGenes(parseGenes(rawGenes));
  }, [rawGenes]);

  useLineChart(lineCanvasRef, genes, conditions, selectedGene);

  const handleBarClick = useCallback((gene: string, condIdx: number) => {
    if (!interactive) return;
    setSelectedGene({ gene, condIdx });
  }, [interactive]);

  const handleSlider = useCallback((geneIdx: number, condIdx: number, value: number) => {
    if (!interactive) return;
    setGenes(prev => {
      const next = prev.map((g, i) => {
        if (i !== geneIdx) return g;
        const levels = [...g.expressionLevels];
        levels[condIdx] = value;
        return { ...g, expressionLevels: levels };
      });
      return next;
    });
  }, [interactive]);

  const toggleLac = useCallback(() => {
    if (!interactive) return;
    setLacMode(prev => {
      if (!prev) setLactose(false);
      return !prev;
    });
  }, [interactive]);

  const toggleLactose = useCallback(() => {
    if (!interactive || !lacMode) return;
    setLactose(prev => !prev);
  }, [interactive, lacMode]);

  useEffect(() => {
    if (!lacMode) return;
    const lacNames = ["lacZ", "lacY", "lacA"];
    setGenes(prev => prev.map(g => {
      if (!lacNames.includes(g.gene)) return g;
      const levels = g.expressionLevels.map(() => {
        const target = lactose ? 85 + Math.random() * 10 : 5 + Math.random() * 5;
        return Math.round(target);
      });
      return { ...g, expressionLevels: levels };
    }));
  }, [lacMode, lactose]);

  const maxVal = getMaxLevel(genes);
  const yMax = maxVal <= 0 ? 100 : Math.ceil(maxVal / 25) * 25;
  const yTicks = [yMax, Math.round(yMax * 0.75), Math.round(yMax * 0.5), Math.round(yMax * 0.25), 0];

  const styles = {
    host: { display: "block", padding: 16, fontFamily: "Manrope, sans-serif", background: "#faf9f5", borderRadius: 12, color: "#1b1c1a" },
    container: { maxWidth: 900, margin: "0 auto" },
    title: { fontSize: "1.25rem", fontWeight: 600, color: "#1b1c1a", textAlign: "center" as const, marginBottom: 16 },
    chartBox: { background: "#fff", padding: 20, borderRadius: 12, border: "1px solid #e5e7eb" },
    typeRow: { display: "flex", justifyContent: "center", gap: 16, marginBottom: 16 },
    typeBtn: (active: boolean) => ({
      padding: "8px 16px", border: `1px solid ${active ? "#182544" : "#e5e7eb"}`,
      background: active ? "#182544" : "#fff", borderRadius: 6, cursor: "pointer",
      fontWeight: 500 as const, color: active ? "#fff" : "#6b7280", fontSize: 14,
    }),
    geneRow: { background: "#faf9f5", borderRadius: 8, padding: "12px 12px 32px", border: "1px solid #e5e7eb", marginBottom: 16 },
    geneName: { fontSize: "0.95rem", fontWeight: 600, color: "#1b1c1a", marginBottom: 8 },
    chartArea: { display: "flex", alignItems: "stretch", gap: 4 },
    yAxis: { display: "flex", flexDirection: "column" as const, justifyContent: "space-between", alignItems: "flex-end" as const, paddingBottom: 20, minWidth: 36 },
    yTick: { fontSize: "0.72rem", color: "#9ca3af", lineHeight: 1 },
    barsBox: { flex: 1, display: "flex", gap: 8, alignItems: "flex-end" as const, height: 200, borderLeft: "1px solid #e5e7eb", borderBottom: "1px solid #e5e7eb", padding: "4px 4px 0" },
    barWrap: { flex: 1, display: "flex", flexDirection: "column" as const, alignItems: "center" as const, justifyContent: "flex-end" as const, height: "100%", position: "relative" as const },
    bar: (selected: boolean) => ({
      width: "100%", borderRadius: "4px 4px 0 0", transition: "height 0.3s ease", cursor: interactive ? "pointer" : "default",
      minHeight: 4, position: "relative" as const,
      boxShadow: selected ? "0 0 0 3px #775a19" : undefined,
    }),
    barLabel: { position: "absolute" as const, bottom: -22, left: "50%", transform: "translateX(-50%)", fontSize: "0.72rem", color: "#6b7280", textAlign: "center" as const, whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis", maxWidth: 60 },
    barValue: { position: "absolute" as const, top: -22, left: "50%", transform: "translateX(-50%)", fontSize: "0.78rem", fontWeight: 600, color: "#1b1c1a", background: "#fff", padding: "2px 5px", borderRadius: 3, border: "1px solid #e5e7eb", whiteSpace: "nowrap" as const },
    lineChart: { position: "relative" as const, height: 300, padding: 20 },
    legend: { marginTop: 16, padding: 12, background: "#faf9f5", borderRadius: 8, border: "1px solid #e5e7eb" },
    legendTitle: { fontSize: "0.9rem", fontWeight: 600, color: "#1b1c1a", marginBottom: 8 },
    legendGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8 },
    legendItem: { display: "flex", alignItems: "center", gap: 8, padding: 4, borderRadius: 4, background: "#fff", border: "1px solid #e5e7eb" },
    legendColor: { width: 16, height: 16, borderRadius: 4, flexShrink: 0 },
    legendText: { fontSize: "0.85rem", color: "#6b7280", flex: 1 },
    stats: { marginTop: 16, padding: 12, background: "#faf9f5", borderRadius: 8, display: "flex", justifyContent: "space-around", border: "1px solid #e5e7eb" },
    statItem: { textAlign: "center" as const },
    statLabel: { fontSize: "0.8rem", color: "#6b7280", marginBottom: 4 },
    statValue: { fontSize: "1.1rem", fontWeight: 600, color: "#1b1c1a" },
    controls: { marginTop: 16, padding: 16, background: "#faf9f5", borderRadius: 8, border: "1px solid #e5e7eb", marginBottom: 16 },
    ctrlTitle: { fontSize: "0.9rem", fontWeight: 600, color: "#1b1c1a", marginBottom: 12 },
    ctrlHint: { fontSize: "0.8rem", color: "#9ca3af", marginBottom: 10 },
    sliderGroup: { display: "flex", flexDirection: "column" as const, gap: 12 },
    sliderItem: { display: "flex", alignItems: "center", gap: 12, padding: "8px 10px", background: "#fff", borderRadius: 6, border: "1px solid #e5e7eb" },
    sliderLabel: { minWidth: 120, fontSize: "0.88rem", fontWeight: 500, color: "#1b1c1a" },
    sliderInput: { flex: 1, height: 6, borderRadius: 3, background: "#e5e7eb", outline: "none", appearance: "none" as never, WebkitAppearance: "none" as never, cursor: "pointer" },
    sliderVal: { minWidth: 50, textAlign: "right" as const, fontSize: "0.9rem", fontWeight: 600, color: "#1b1c1a" },
    toggleRow: { display: "flex", alignItems: "center", gap: 12, padding: 8, background: "#fff", borderRadius: 6, border: "1px solid #e5e7eb" },
    toggleLabel: { flex: 1, fontSize: "0.9rem", color: "#1b1c1a" },
    toggleSwitch: (on: boolean) => ({
      position: "relative" as const, width: 48, height: 24, background: on ? "#5a7752" : "#e5e7eb",
      borderRadius: 12, cursor: "pointer", transition: "background 0.3s",
    }),
    toggleKnob: (on: boolean) => ({
      position: "absolute" as const, top: 2, left: 2, width: 20, height: 20, background: "#fff",
      borderRadius: "50%", transition: "transform 0.3s", boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
      transform: on ? "translateX(24px)" : "translateX(0)",
    }),
    operonInfo: { padding: 12, background: "#fff", borderRadius: 6, border: "1px solid #e5e7eb", fontSize: "0.85rem", color: "#6b7280", lineHeight: 1.5 },
    empty: { textAlign: "center" as const, padding: 40, color: "#6b7280", fontStyle: "italic" },
  };

  if (!genes.length) return <div style={styles.host}><div style={styles.empty}>暂无基因表达数据</div></div>;

  const sliderMax = Math.max(100, Math.ceil(getMaxLevel(genes) / 25) * 25);

  return (
    <div style={styles.host}>
      <div style={styles.container}>
        <div style={styles.title}>基因表达水平</div>

        {interactive && (
          <div style={styles.controls}>
            <div style={styles.ctrlTitle}>调节基因表达水平</div>
            <div style={styles.ctrlHint}>拖动滑块可实时改变对应条件下的基因表达量</div>
            <div style={styles.sliderGroup}>
              {genes.map((g, gi) =>
                conditions.map((c, ci) => (
                  <div key={`${gi}-${ci}`} style={styles.sliderItem}>
                    <span style={styles.sliderLabel}>{g.gene} — {c.name}</span>
                    <input
                      type="range" min={0} max={sliderMax}
                      value={g.expressionLevels[ci] ?? 0}
                      onChange={e => handleSlider(gi, ci, parseInt(e.target.value, 10))}
                      style={styles.sliderInput}
                    />
                    <span style={styles.sliderVal}>{g.expressionLevels[ci] ?? 0}</span>
                  </div>
                ))
              )}
            </div>

            <div style={{ marginTop: 16 }}>
              <div style={styles.ctrlTitle}>lac 操纵子模拟</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={styles.toggleRow}>
                  <span style={styles.toggleLabel}>启用 lac 操纵子模式</span>
                  <div style={styles.toggleSwitch(lacMode)} onClick={toggleLac} role="switch" aria-checked={lacMode}>
                    <div style={styles.toggleKnob(lacMode)} />
                  </div>
                </div>
                {lacMode && (
                  <>
                    <div style={styles.toggleRow}>
                      <span style={styles.toggleLabel}>乳糖存在</span>
                      <div style={styles.toggleSwitch(lactose)} onClick={toggleLactose} role="switch" aria-checked={lactose}>
                        <div style={styles.toggleKnob(lactose)} />
                      </div>
                    </div>
                    <div style={styles.operonInfo}>
                      {lactose
                        ? "✓ 乳糖存在：lac 操纵子开启，lacZ、lacY、lacA 基因高表达（>80%），编码分解乳糖的酶"
                        : "✗ 无乳糖：lac 操纵子关闭，阻遏蛋白结合操纵子，基因表达受抑制（<10%）"}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        <div style={styles.chartBox}>
          <div style={styles.typeRow}>
            <button style={styles.typeBtn(chartType === "bar")} onClick={() => setChartType("bar")}>条形图</button>
            <button style={styles.typeBtn(chartType === "line")} onClick={() => setChartType("line")}>折线图</button>
          </div>

          {chartType === "bar" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {genes.map((g, gi) => (
                <div key={gi} style={styles.geneRow}>
                  <div style={styles.geneName}>{g.gene}</div>
                  <div style={styles.chartArea}>
                    <div style={styles.yAxis}>
                      {yTicks.map(t => <span key={t} style={styles.yTick}>{t}</span>)}
                    </div>
                    <div style={styles.barsBox}>
                      {g.expressionLevels.map((level, li) => {
                        const pct = yMax > 0 ? (level / yMax) * 100 : 0;
                        const isSelected = selectedGene?.gene === g.gene && selectedGene?.condIdx === li;
                        const condName = conditions[li]?.name || ("条件 " + (li + 1));
                        return (
                          <div key={li} style={styles.barWrap}>
                            <div
                              style={{
                                ...styles.bar(isSelected),
                                height: `${pct}%`,
                                backgroundColor: condColor(li, conditions),
                              }}
                              onClick={() => handleBarClick(g.gene, li)}
                            >
                              {pct > 12 && <div style={styles.barValue}>{level}</div>}
                            </div>
                            <div style={styles.barLabel}>{condName}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={styles.lineChart}>
              <canvas ref={lineCanvasRef} style={{ width: "100%", height: "100%" }} />
            </div>
          )}
        </div>

        <div style={styles.legend}>
          <div style={styles.legendTitle}>条件图例</div>
          <div style={styles.legendGrid}>
            {conditions.map((c, i) => (
              <div key={i} style={styles.legendItem}>
                <div style={{ ...styles.legendColor, backgroundColor: condColor(i, conditions) }} />
                <span style={styles.legendText}>{c.name}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={styles.stats}>
          <div style={styles.statItem}><div style={styles.statLabel}>基因数量</div><div style={styles.statValue}>{genes.length}</div></div>
          <div style={styles.statItem}><div style={styles.statLabel}>条件数量</div><div style={styles.statValue}>{conditions.length}</div></div>
          <div style={styles.statItem}><div style={styles.statLabel}>最高表达量</div><div style={styles.statValue}>{maxVal}</div></div>
          <div style={styles.statItem}><div style={styles.statLabel}>平均表达量</div><div style={styles.statValue}>{getOverallAvg(genes)}</div></div>
        </div>
      </div>
    </div>
  );
}
