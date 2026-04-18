import { useState, useCallback, useRef, useEffect } from "react";

interface A2UINode {
  properties?: Record<string, unknown>;
}

interface Gene {
  name: string;
  position: number;
  color?: string;
  description?: string;
}

interface CrossoverPoint {
  position: number;
  label?: string;
  type?: "single" | "double" | "multiple";
  confidence?: "high" | "medium" | "low";
}

interface CentromereInfo {
  position: number;
}

interface ChromosomeBand {
  start: number;
  end: number;
  name: string;
  type: "G-dark" | "G-light" | "R-dark" | "R-light";
}

function clamp(v: number, min: number, max: number) { return Math.min(max, Math.max(min, v)); }
function parseStr(v: unknown, fb: string): string { return typeof v === "string" ? v : fb; }
function parseNum(v: unknown, fb: number): number { return typeof v === "number" ? v : fb; }
function parseBool(v: unknown, fb: boolean): boolean { return typeof v === "boolean" ? v : fb; }
function parseArray<T>(v: unknown, fb: T[]): T[] { return Array.isArray(v) ? v : fb; }
function parseObj<T>(v: unknown, fb: T | null): T | null { return v != null && typeof v === "object" && !Array.isArray(v) ? (v as T) : fb; }

const DEFAULT_GENES: Gene[] = [
  { name: "A", position: 10, color: "#2563eb" },
  { name: "B", position: 30, color: "#16a34a" },
  { name: "C", position: 55, color: "#7c3aed" },
  { name: "D", position: 75, color: "#ea580c" },
];
const DEFAULT_CROSSOVERS: CrossoverPoint[] = [
  { position: 20, label: "交叉点1", type: "single", confidence: "high" },
  { position: 65, label: "交叉点2", type: "single", confidence: "medium" },
];

const BAND_COLORS: Record<string, string> = { "G-dark": "#0f172a", "G-light": "#94a3b8", "R-dark": "#dc2626", "R-light": "#fca5a5" };
const CONFIDENCE_LABEL: Record<string, string> = { high: "高", medium: "中", low: "低" };
const TYPE_LABEL: Record<string, string> = { single: "单交换", double: "双交换", multiple: "多交换" };

interface SelectedItem { kind: "gene" | "crossover"; data: Gene | CrossoverPoint; index: number; }

interface SimResult {
  genes: Gene[];
  recombinantCount: number;
  totalCount: number;
  recombFreq: number;
}

export function CrossoverMap({ node }: { node: A2UINode }) {
  const props = node.properties ?? {};

  const chromosomeId = parseStr(props.chromosomeId, "1");
  const chromosomeLength = parseNum(props.chromosomeLength, 100);
  const genes = parseArray<Gene>(props.genes, DEFAULT_GENES);
  const crossoverPoints = parseArray<CrossoverPoint>(props.crossoverPoints, DEFAULT_CROSSOVERS);
  const centromereRaw = parseObj<CentromereInfo>(props.centromerePosition, null);
  const bands = parseArray<ChromosomeBand>(props.bands, []);
  const showCentromere = parseBool(props.showCentromere, true);
  const showRecombinationFreq = parseBool(props.showRecombinationFreq, true);
  const interactive = parseBool(props.interactive, true);
  const maternalLabel = parseStr(props.maternalLabel, "母源");
  const paternalLabel = parseStr(props.paternalLabel, "父源");

  const [selected, setSelected] = useState<SelectedItem | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [simProgress, setSimProgress] = useState(0);
  const [simResult, setSimResult] = useState<SimResult | null>(null);
  const svgTrackRef = useRef<SVGSVGElement>(null);
  const [svgWidth, setSvgWidth] = useState(700);
  const containerRef = useRef<HTMLDivElement>(null);

  const centromerePos = clamp(centromereRaw?.position ?? chromosomeLength / 2, 0, chromosomeLength);
  const recombinationRate = chromosomeLength > 0 ? crossoverPoints.length / chromosomeLength : 0;

  const toX = useCallback((position: number, w: number) => {
    const margin = 40;
    return chromosomeLength > 0 ? margin + (position / chromosomeLength) * (w - margin * 2) : margin;
  }, [chromosomeLength]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      for (const entry of entries) setSvgWidth(Math.floor(entry.contentRect.width));
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const geneColor = (gene: Gene, index: number) => gene.color ?? ["#2563eb", "#16a34a", "#7c3aed", "#ea580c"][index % 4];

  const runSimulation = useCallback(() => {
    if (simulating || crossoverPoints.length === 0 || genes.length === 0) return;
    setSimulating(true);
    setSimProgress(0);
    setSimResult(null);

    const sortedXO = [...crossoverPoints].sort((a, b) => a.position - b.position);
    const totalOffspring = 100;
    let recombinant = 0;
    const segments: { start: number; end: number; maternal: boolean }[] = [];

    let step = 0;
    const interval = setInterval(() => {
      step++;
      setSimProgress(Math.min(step / totalOffspring, 1));

      if (step <= totalOffspring) {
        let maternal = true;
        let segStart = 0;
        for (const xo of sortedXO) {
          if (Math.random() < 0.5) {
            segments.push({ start: segStart, end: xo.position, maternal });
            maternal = !maternal;
            segStart = xo.position;
          }
        }
        segments.push({ start: segStart, end: chromosomeLength, maternal });

        const parentGenes = genes.map((g) => {
          for (const seg of segments) {
            if (g.position >= seg.start && g.position < seg.end) return { ...g, isMaternal: seg.maternal };
          }
          return { ...g, isMaternal: maternal };
        });

        const hasRecombinant = genes.some((g, i) => {
          const matGenes = genes.filter((gg) => gg.position < g.position);
          if (matGenes.length === 0) return false;
          const prevIdx = genes.indexOf(matGenes[matGenes.length - 1]);
          return parentGenes[i].isMaternal !== parentGenes[prevIdx].isMaternal;
        });

        if (hasRecombinant) recombinant++;
        segments.length = 0;
      }

      if (step > totalOffspring) {
        clearInterval(interval);
        setSimulating(false);
        setSimResult({
          genes,
          recombinantCount: recombinant,
          totalCount: totalOffspring,
          recombFreq: totalOffspring > 0 ? recombinant / totalOffspring : 0,
        });
      }
    }, 15);
  }, [simulating, crossoverPoints, genes, chromosomeLength]);

  const TRACK_H = 120;
  const GENE_TOP = 20;
  const DOT_R = 7;

  return (
    <section style={{ display: "grid", gap: 14, padding: 18, border: "1px solid #dbe3f0", borderRadius: 16, background: "linear-gradient(180deg, #f8fbff 0%, #eef4ff 100%)", boxShadow: "0 12px 30px rgba(15, 23, 42, 0.08)", color: "#0f172a", fontFamily: "Manrope, sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start" }}>
        <div>
          <div style={{ fontSize: "1.05rem", fontWeight: 700 }}>交叉互换图谱</div>
          <div style={{ color: "#475569", fontSize: "0.88rem" }}>染色体 {chromosomeId} · {chromosomeLength} cM</div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          <span style={{ padding: "4px 8px", borderRadius: 999, background: "rgba(37,99,235,0.08)", color: "#1d4ed8", fontSize: "0.72rem", fontWeight: 600 }}>{genes.length} 基因</span>
          <span style={{ padding: "4px 8px", borderRadius: 999, background: "rgba(239,68,68,0.08)", color: "#dc2626", fontSize: "0.72rem", fontWeight: 600 }}>{crossoverPoints.length} 交叉点</span>
          {showRecombinationFreq && <span style={{ padding: "4px 8px", borderRadius: 999, background: "rgba(37,99,235,0.08)", color: "#1d4ed8", fontSize: "0.72rem", fontWeight: 600 }}>重组率 {(recombinationRate * 100).toFixed(2)}%</span>}
        </div>
      </div>

      <div ref={containerRef}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", color: "#64748b", marginBottom: 4 }}>
          <span>{paternalLabel}</span><span>{maternalLabel}</span>
        </div>

        <svg ref={svgTrackRef} width={svgWidth} height={TRACK_H} style={{ display: "block", borderRadius: 10, background: "linear-gradient(90deg, rgba(14,165,233,0.08), rgba(99,102,241,0.12)), #fff", border: "1px solid rgba(148,163,184,0.3)" }}>
          <defs>
            <linearGradient id="chrGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(14,165,233,0.14)" />
              <stop offset="100%" stopColor="rgba(99,102,241,0.18)" />
            </linearGradient>
          </defs>

          {bands.map((band, i) => {
            const x1 = toX(band.start, svgWidth);
            const x2 = toX(band.end, svgWidth);
            return <rect key={`b${i}`} x={x1} y={30} width={x2 - x1} height={TRACK_H - 60} rx={4} fill={BAND_COLORS[band.type] || "#94a3b8"} opacity={0.16} />;
          })}

          <rect x={toX(0, svgWidth)} y={TRACK_H / 2 - 16} width={toX(chromosomeLength, svgWidth) - toX(0, svgWidth)} height={32} rx={16} fill="url(#chrGrad)" />

          {showCentromere && (
            <rect x={toX(centromerePos, svgWidth) - 5} y={TRACK_H / 2 - 20} width={10} height={40} rx={5} fill="url(#chrGrad)" stroke="#334155" strokeWidth={1.5}>
              <animate attributeName="opacity" values="0.7;1;0.7" dur="2s" repeatCount="indefinite" />
            </rect>
          )}

          {crossoverPoints.map((point, i) => {
            const cx = toX(point.position, svgWidth);
            const isSelected = selected?.kind === "crossover" && selected.index === i;
            return (
              <g key={`xo${i}`} onClick={() => interactive && setSelected({ kind: "crossover", data: point, index: i })} style={{ cursor: interactive ? "pointer" : "default" }}>
                <line x1={cx} y1={TRACK_H / 2 - 24} x2={cx} y2={TRACK_H / 2 + 24} stroke={i % 2 === 0 ? "#ef4444" : "#f97316"} strokeWidth={2} strokeDasharray="4 3" opacity={0.6} />
                <circle cx={cx} cy={TRACK_H / 2} r={isSelected ? 9 : DOT_R} fill={i % 2 === 0 ? "#ef4444" : "#f97316"} stroke={isSelected ? "#2563eb" : "none"} strokeWidth={isSelected ? 2 : 0} style={{ cursor: "pointer", transition: "r 0.2s" }}>
                  <animate attributeName="r" values={`${DOT_R};${DOT_R + 2};${DOT_R}`} dur="1.5s" repeatCount="indefinite" />
                </circle>
              </g>
            );
          })}

          {genes.map((gene, i) => {
            const cx = toX(gene.position, svgWidth);
            const color = geneColor(gene, i);
            const isSelected = selected?.kind === "gene" && selected.index === i;
            return (
              <g key={`g${i}`} onClick={() => interactive && setSelected({ kind: "gene", data: gene, index: i })} style={{ cursor: interactive ? "pointer" : "default" }}>
                <line x1={cx} y1={GENE_TOP + 14} x2={cx} y2={TRACK_H - 20} stroke={color} strokeWidth={2} opacity={0.5} />
                <circle cx={cx} cy={TRACK_H - 14} r={DOT_R} fill={color} stroke="#fff" strokeWidth={2} style={{ transition: "all 0.2s" }} />
                {isSelected && <circle cx={cx} cy={TRACK_H - 14} r={DOT_R + 4} fill="none" stroke="#2563eb" strokeWidth={2} />}
                <text x={cx} y={GENE_TOP + 10} textAnchor="middle" fontSize={11} fontWeight={600} fill={color}>{gene.name}</text>
              </g>
            );
          })}
        </svg>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, color: "#475569", fontSize: "0.72rem" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: 999, background: "#2563eb", display: "inline-block" }} />基因位点</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: 999, background: "#ef4444", display: "inline-block" }} />交叉点</span>
        {showCentromere && <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: 999, background: "#334155", display: "inline-block" }} />着丝粒</span>}
      </div>

      {selected && (
        <div style={{ padding: 12, borderRadius: 12, background: "#fff", border: "1px solid #dbeafe" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <span style={{ fontWeight: 600, fontSize: "0.82rem", color: "#182544" }}>{selected.kind === "gene" ? "基因详情" : "交叉点详情"}</span>
            <button onClick={() => setSelected(null)} style={{ border: "none", background: "transparent", color: "#6b7280", cursor: "pointer", fontSize: 12, padding: "2px 6px", fontFamily: "Manrope, sans-serif" }}>关闭</button>
          </div>
          {selected.kind === "gene" ? (
            <div style={{ fontSize: "0.76rem", color: "#334155", display: "grid", gap: 3 }}>
              <div><strong>名称：</strong>{(selected.data as Gene).name}</div>
              <div><strong>位置：</strong>{(selected.data as Gene).position} cM</div>
              {(selected.data as Gene).description && <div><strong>描述：</strong>{(selected.data as Gene).description}</div>}
            </div>
          ) : (
            <div style={{ fontSize: "0.76rem", color: "#334155", display: "grid", gap: 3 }}>
              <div><strong>标签：</strong>{(selected.data as CrossoverPoint).label ?? `交叉点 ${selected.index + 1}`}</div>
              <div><strong>位置：</strong>{(selected.data as CrossoverPoint).position} cM</div>
              {(selected.data as CrossoverPoint).type && <div><strong>类型：</strong>{TYPE_LABEL[(selected.data as CrossoverPoint).type!]}</div>}
              {(selected.data as CrossoverPoint).confidence && <div><strong>可信度：</strong>{CONFIDENCE_LABEL[(selected.data as CrossoverPoint).confidence!]}</div>}
            </div>
          )}
        </div>
      )}

      {interactive && crossoverPoints.length > 0 && genes.length > 1 && (
        <div style={{ padding: 12, borderRadius: 12, background: "#fff", border: "1px solid #e5e7eb" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontWeight: 600, fontSize: "0.82rem", color: "#182544" }}>重组模拟</span>
            <button
              onClick={runSimulation}
              disabled={simulating}
              style={{ padding: "5px 14px", borderRadius: 6, border: "none", background: simulating ? "#d1d5db" : "#182544", color: "#fff", fontWeight: 600, fontSize: 12, cursor: simulating ? "not-allowed" : "pointer", fontFamily: "Manrope, sans-serif" }}
            >
              {simulating ? `模拟中 ${Math.round(simProgress * 100)}%` : "运行模拟 (100次)"}
            </button>
          </div>
          {simulating && (
            <div style={{ height: 4, borderRadius: 2, background: "#e5e7eb", overflow: "hidden", marginBottom: 8 }}>
              <div style={{ height: "100%", width: `${simProgress * 100}%`, background: "#182544", borderRadius: 2, transition: "width 0.1s" }} />
            </div>
          )}
          {simResult && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
              <div style={{ textAlign: "center", padding: 8, borderRadius: 8, background: "#f8fbff" }}>
                <div style={{ fontSize: 10, color: "#6b7280" }}>重组体</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#ef4444" }}>{simResult.recombinantCount}</div>
              </div>
              <div style={{ textAlign: "center", padding: 8, borderRadius: 8, background: "#f8fbff" }}>
                <div style={{ fontSize: 10, color: "#6b7280" }}>亲本型</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#2563eb" }}>{simResult.totalCount - simResult.recombinantCount}</div>
              </div>
              <div style={{ textAlign: "center", padding: 8, borderRadius: 8, background: "#f8fbff" }}>
                <div style={{ fontSize: 10, color: "#6b7280" }}>重组频率</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#182544" }}>{(simResult.recombFreq * 100).toFixed(1)}%</div>
              </div>
            </div>
          )}
          {simResult && (
            <div style={{ marginTop: 8, fontSize: 12, color: "#6b7280", lineHeight: 1.6 }}>
              模拟 {simResult.totalCount} 次减数分裂，{simResult.recombinantCount} 次发生重组。
              {simResult.recombFreq > 0.5
                ? " 重组频率较高，说明基因间距离较远或存在多个交叉点。"
                : simResult.recombFreq > 0.1
                ? " 重组频率适中，符合一般连锁基因的预期。"
                : " 重组频率很低，说明基因间距离较近，连锁紧密。"}
            </div>
          )}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8 }}>
        <div style={{ padding: 10, borderRadius: 10, background: "rgba(255,255,255,0.75)", border: "1px solid rgba(148,163,184,0.24)" }}>
          <h4 style={{ margin: "0 0 6px", fontSize: "0.82rem" }}>交叉点详情</h4>
          {crossoverPoints.length > 0 ? (
            <ul style={{ display: "grid", gap: 4, margin: 0, padding: 0, listStyle: "none", fontSize: "0.72rem", color: "#334155" }}>
              {crossoverPoints.map((p, i) => <li key={i}>{p.label ?? `交叉点 ${i + 1}`} · {p.position} cM{p.confidence ? ` · ${CONFIDENCE_LABEL[p.confidence]}` : ""}</li>)}
            </ul>
          ) : <div style={{ color: "#64748b", fontSize: "0.72rem" }}>暂无交叉点</div>}
        </div>
        <div style={{ padding: 10, borderRadius: 10, background: "rgba(255,255,255,0.75)", border: "1px solid rgba(148,163,184,0.24)" }}>
          <h4 style={{ margin: "0 0 6px", fontSize: "0.82rem" }}>观察摘要</h4>
          <ul style={{ display: "grid", gap: 4, margin: 0, padding: 0, listStyle: "none", fontSize: "0.72rem", color: "#334155" }}>
            <li>着丝粒：{centromerePos.toFixed(1)} cM</li>
            <li>交叉点密度：{(recombinationRate * 100).toFixed(2)}%</li>
            <li>基因数量：{genes.length}</li>
            <li>模式：{interactive ? "交互" : "只读"}</li>
          </ul>
        </div>
      </div>
    </section>
  );
}

export default CrossoverMap;
