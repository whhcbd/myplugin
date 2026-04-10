import { useState, useCallback } from "react";

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

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function parseStr(val: unknown, fallback: string): string {
  return typeof val === "string" ? val : fallback;
}

function parseNum(val: unknown, fallback: number): number {
  return typeof val === "number" ? val : fallback;
}

function parseBool(val: unknown, fallback: boolean): boolean {
  return typeof val === "boolean" ? val : fallback;
}

function parseArray<T>(val: unknown, fallback: T[]): T[] {
  return Array.isArray(val) ? val : fallback;
}

function parseObj<T>(val: unknown, fallback: T | null): T | null {
  return val != null && typeof val === "object" && !Array.isArray(val) ? (val as T) : fallback;
}

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

function getBandColor(type: ChromosomeBand["type"]): string {
  switch (type) {
    case "G-dark":
      return "#0f172a";
    case "G-light":
      return "#94a3b8";
    case "R-dark":
      return "#dc2626";
    case "R-light":
      return "#fca5a5";
    default:
      return "#94a3b8";
  }
}

const CONFIDENCE_LABEL: Record<string, string> = {
  high: "高",
  medium: "中",
  low: "低",
};

const TYPE_LABEL: Record<string, string> = {
  single: "单交换",
  double: "双交换",
  multiple: "多交换",
};

interface SelectedItem {
  kind: "gene" | "crossover";
  data: Gene | CrossoverPoint;
  index: number;
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

  const centromerePos = clamp(
    centromereRaw?.position ?? chromosomeLength / 2,
    0,
    chromosomeLength
  );

  const recombinationRate =
    chromosomeLength > 0 ? crossoverPoints.length / chromosomeLength : 0;

  const toPercent = useCallback(
    (position: number) =>
      chromosomeLength > 0 ? clamp((position / chromosomeLength) * 100, 0, 100) : 0,
    [chromosomeLength]
  );

  const handleGeneClick = useCallback(
    (gene: Gene, index: number) => {
      if (!interactive) return;
      setSelected({ kind: "gene", data: gene, index });
    },
    [interactive]
  );

  const handleCrossoverClick = useCallback(
    (point: CrossoverPoint, index: number) => {
      if (!interactive) return;
      setSelected({ kind: "crossover", data: point, index });
    },
    [interactive]
  );

  const handleClearSelection = useCallback(() => setSelected(null), []);

  const geneColor = (gene: Gene, index: number) =>
    gene.color ?? ["#2563eb", "#16a34a", "#7c3aed", "#ea580c"][index % 4];

  const card: React.CSSProperties = {
    display: "grid",
    gap: 16,
    padding: 20,
    border: "1px solid #dbe3f0",
    borderRadius: 16,
    background: "linear-gradient(180deg, #f8fbff 0%, #eef4ff 100%)",
    boxShadow: "0 12px 30px rgba(15, 23, 42, 0.08)",
    color: "#0f172a",
    fontFamily: "Manrope, sans-serif",
  };

  const header: React.CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "start",
  };

  const chip: React.CSSProperties = {
    padding: "6px 10px",
    borderRadius: 999,
    background: "rgba(37, 99, 235, 0.08)",
    color: "#1d4ed8",
    fontSize: "0.78rem",
    fontWeight: 600,
  };

  const trackShell: React.CSSProperties = {
    display: "grid",
    gap: 10,
  };

  const trackLabels: React.CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    fontSize: "0.78rem",
    color: "#64748b",
  };

  const track: React.CSSProperties = {
    position: "relative",
    height: 84,
    borderRadius: 999,
    background:
      "linear-gradient(90deg, rgba(14, 165, 233, 0.14), rgba(99, 102, 241, 0.18)), #ffffff",
    border: "1px solid rgba(148, 163, 184, 0.3)",
    overflow: "hidden",
  };

  const panel: React.CSSProperties = {
    padding: 12,
    borderRadius: 12,
    background: "rgba(255, 255, 255, 0.75)",
    border: "1px solid rgba(148, 163, 184, 0.24)",
  };

  return (
    <section style={card}>
      <div style={header}>
        <div>
          <div style={{ fontSize: "1.05rem", fontWeight: 700 }}>交叉互换图谱</div>
          <div style={{ color: "#475569", fontSize: "0.88rem" }}>
            染色体 {chromosomeId} · {chromosomeLength} cM
          </div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <span style={chip}>{genes.length} 个基因</span>
          <span style={chip}>{crossoverPoints.length} 个交叉点</span>
          {showRecombinationFreq && (
            <span style={chip}>重组频率 {(recombinationRate * 100).toFixed(2)}%</span>
          )}
        </div>
      </div>

      <div style={trackShell}>
        <div style={trackLabels}>
          <span>{paternalLabel}</span>
          <span>{maternalLabel}</span>
        </div>

        <div style={track}>
          {bands.map((band, i) => (
            <div
              key={`band-${i}`}
              title={`${band.name} (${band.start}-${band.end} cM)`}
              style={{
                position: "absolute",
                top: 18,
                bottom: 18,
                left: `${toPercent(band.start)}%`,
                width: `${toPercent(band.end - band.start)}%`,
                borderRadius: 999,
                opacity: 0.16,
                background: getBandColor(band.type),
              }}
            />
          ))}

          {showCentromere && (
            <div
              title="着丝粒"
              style={{
                position: "absolute",
                top: 0,
                bottom: 0,
                left: `${toPercent(centromerePos)}%`,
                width: 12,
                borderRadius: 999,
                background: "linear-gradient(180deg, #475569, #1e293b)",
                transform: "translateX(-50%)",
              }}
            />
          )}

          {genes.map((gene, index) => {
            const color = geneColor(gene, index);
            const isSelected =
              selected?.kind === "gene" && selected.index === index;
            return (
              <div
                key={`gene-${index}`}
                title={gene.name}
                onClick={() => handleGeneClick(gene, index)}
                style={{
                  position: "absolute",
                  top: 10,
                  left: `${toPercent(gene.position)}%`,
                  width: 2,
                  height: 64,
                  transform: "translateX(-50%)",
                  background: color,
                  cursor: interactive ? "pointer" : "default",
                  outline: isSelected ? "2px solid #2563eb" : "none",
                  outlineOffset: 2,
                  borderRadius: 1,
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: -2,
                    left: "50%",
                    transform: "translateX(-50%)",
                    whiteSpace: "nowrap",
                    fontSize: "0.72rem",
                    fontWeight: 600,
                    color,
                  }}
                >
                  {gene.name}
                </div>
                <div
                  style={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    width: 12,
                    height: 12,
                    borderRadius: "50%",
                    transform: "translate(-5px, 0)",
                    background: color,
                    boxShadow: "0 0 0 3px rgba(255, 255, 255, 0.9)",
                  }}
                />
              </div>
            );
          })}

          {crossoverPoints.map((point, index) => {
            const isSelected =
              selected?.kind === "crossover" && selected.index === index;
            return (
              <div
                key={`xo-${index}`}
                title={point.label ?? `交叉点 ${index + 1}`}
                onClick={() => handleCrossoverClick(point, index)}
                style={{
                  position: "absolute",
                  top: 24,
                  left: `${toPercent(point.position)}%`,
                  width: 18,
                  height: 18,
                  borderRadius: "50%",
                  transform: "translateX(-50%)",
                  background: index % 2 === 0 ? "#ef4444" : "#f97316",
                  boxShadow: isSelected
                    ? "0 0 0 4px rgba(37, 99, 235, 0.4)"
                    : "0 0 0 4px rgba(239, 68, 68, 0.16)",
                  cursor: interactive ? "pointer" : "default",
                }}
              />
            );
          })}
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, color: "#475569", fontSize: "0.78rem" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: 999, background: "#2563eb", display: "inline-block" }} />
          基因位点
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: 999, background: "#ef4444", display: "inline-block" }} />
          交叉点
        </span>
        {showCentromere && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: 999, background: "#334155", display: "inline-block" }} />
            着丝粒
          </span>
        )}
      </div>

      {selected && (
        <div
          style={{
            padding: 12,
            borderRadius: 12,
            background: "#fff",
            border: "1px solid #dbeafe",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontWeight: 600, fontSize: "0.85rem", color: "#182544" }}>
              {selected.kind === "gene" ? "基因详情" : "交叉点详情"}
            </span>
            <button
              onClick={handleClearSelection}
              style={{
                border: "none",
                background: "transparent",
                color: "#6b7280",
                cursor: "pointer",
                fontSize: 12,
                padding: "2px 6px",
                fontFamily: "Manrope, sans-serif",
              }}
            >
              关闭
            </button>
          </div>
          {selected.kind === "gene" ? (
            <div style={{ fontSize: "0.78rem", color: "#334155", display: "grid", gap: 4 }}>
              <div><strong>名称：</strong>{(selected.data as Gene).name}</div>
              <div><strong>位置：</strong>{(selected.data as Gene).position} cM</div>
              {(selected.data as Gene).description && (
                <div><strong>描述：</strong>{(selected.data as Gene).description}</div>
              )}
            </div>
          ) : (
            <div style={{ fontSize: "0.78rem", color: "#334155", display: "grid", gap: 4 }}>
              <div>
                <strong>标签：</strong>
                {(selected.data as CrossoverPoint).label ?? `交叉点 ${selected.index + 1}`}
              </div>
              <div><strong>位置：</strong>{(selected.data as CrossoverPoint).position} cM</div>
              {(selected.data as CrossoverPoint).type && (
                <div>
                  <strong>类型：</strong>
                  {TYPE_LABEL[(selected.data as CrossoverPoint).type!] ?? (selected.data as CrossoverPoint).type}
                </div>
              )}
              {(selected.data as CrossoverPoint).confidence && (
                <div>
                  <strong>可信度：</strong>
                  {CONFIDENCE_LABEL[(selected.data as CrossoverPoint).confidence!] ?? (selected.data as CrossoverPoint).confidence}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
        <div style={panel}>
          <h4 style={{ margin: "0 0 8px", fontSize: "0.85rem" }}>交叉点详情</h4>
          {crossoverPoints.length > 0 ? (
            <ul style={{ display: "grid", gap: 6, margin: 0, padding: 0, listStyle: "none", fontSize: "0.78rem", color: "#334155" }}>
              {crossoverPoints.map((point, index) => (
                <li key={index}>
                  {point.label ?? `交叉点 ${index + 1}`} · {point.position} cM
                  {point.confidence ? ` · ${CONFIDENCE_LABEL[point.confidence] ?? point.confidence}` : ""}
                </li>
              ))}
            </ul>
          ) : (
            <div style={{ color: "#64748b", fontSize: "0.78rem" }}>当前没有交叉点数据。</div>
          )}
        </div>

        <div style={panel}>
          <h4 style={{ margin: "0 0 8px", fontSize: "0.85rem" }}>观察摘要</h4>
          <ul style={{ display: "grid", gap: 6, margin: 0, padding: 0, listStyle: "none", fontSize: "0.78rem", color: "#334155" }}>
            <li>着丝粒位置：{centromerePos.toFixed(1)} cM</li>
            <li>交叉点密度：{(recombinationRate * 100).toFixed(2)}%</li>
            <li>基因数量：{genes.length}</li>
            <li>交互模式：{interactive ? "已启用" : "只读展示"}</li>
          </ul>
        </div>
      </div>
    </section>
  );
}

export default CrossoverMap;
