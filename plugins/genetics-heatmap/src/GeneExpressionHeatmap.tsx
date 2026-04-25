import { useEffect, useRef, useState } from "react";

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

interface Sample {
  name: string;
  group?: string;
}

const DEFAULT_GENES: GeneData[] = [
  { gene: "GAPDH", expressionLevels: [85, 90, 88, 45, 42, 48] },
  { gene: "TP53", expressionLevels: [120, 115, 125, 60, 58, 62] },
  { gene: "BRCA1", expressionLevels: [200, 195, 205, 100, 98, 102] },
  { gene: "MYC", expressionLevels: [150, 145, 155, 180, 175, 185] },
  { gene: "EGFR", expressionLevels: [95, 92, 98, 140, 138, 142] },
  { gene: "KRAS", expressionLevels: [110, 108, 112, 85, 82, 88] },
];

const DEFAULT_SAMPLES: Sample[] = [
  { name: "Tumor_01", group: "tumor" },
  { name: "Tumor_02", group: "tumor" },
  { name: "Tumor_03", group: "tumor" },
  { name: "Normal_01", group: "normal" },
  { name: "Normal_02", group: "normal" },
  { name: "Normal_03", group: "normal" },
];

function parseGenes(raw: string): GeneData[] {
  try {
    const p = JSON.parse(raw);
    if (Array.isArray(p) && p.length > 0) return p;
  } catch {}
  return DEFAULT_GENES;
}

function parseSamples(raw: string): Sample[] {
  try {
    const p = JSON.parse(raw);
    if (Array.isArray(p) && p.length > 0) return p;
  } catch {}
  return DEFAULT_SAMPLES;
}

// Z-score 标准化（行方向）
function zScoreNormalize(genes: GeneData[]): number[][] {
  return genes.map(gene => {
    const levels = gene.expressionLevels;
    const mean = levels.reduce((a, b) => a + b, 0) / levels.length;
    const variance = levels.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / levels.length;
    const std = Math.sqrt(variance);

    if (std === 0) return levels.map(() => 0);
    return levels.map(val => (val - mean) / std);
  });
}

// 获取颜色（发散色阶：蓝-白-红）
function getHeatmapColor(zScore: number): string {
  const clamped = Math.max(-3, Math.min(3, zScore));
  const normalized = (clamped + 3) / 6; // 映射到 [0, 1]

  if (normalized < 0.5) {
    // 蓝色到白色
    const t = normalized * 2;
    const r = Math.round(65 + (255 - 65) * t);
    const g = Math.round(105 + (255 - 105) * t);
    const b = Math.round(225 + (255 - 225) * t);
    return `rgb(${r}, ${g}, ${b})`;
  } else {
    // 白色到红色
    const t = (normalized - 0.5) * 2;
    const r = 255;
    const g = Math.round(255 - 255 * t);
    const b = Math.round(255 - 255 * t);
    return `rgb(${r}, ${g}, ${b})`;
  }
}

export default function GeneExpressionHeatmap({ node }: { node: A2UINode }) {
  const props = node.properties ?? {};

  const rawGenes = parseStr(props.genes, "");
  const rawSamples = parseStr(props.samples, "");
  const showDendrogram = parseBool(props.showDendrogram, false);
  const showAnnotation = parseBool(props.showAnnotation, true);

  const [genes] = useState<GeneData[]>(() => parseGenes(rawGenes));
  const [samples] = useState<Sample[]>(() => parseSamples(rawSamples));
  const [normalizedData] = useState<number[][]>(() => zScoreNormalize(parseGenes(rawGenes)));
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  // 绘制热图
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const cellSize = 40;
    const labelWidth = 80;
    const labelHeight = 100;
    const annotationHeight = showAnnotation ? 20 : 0;

    const width = labelWidth + samples.length * cellSize;
    const height = labelHeight + annotationHeight + genes.length * cellSize;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, width, height);

    // 绘制样本分组注释条
    if (showAnnotation) {
      samples.forEach((sample, i) => {
        const x = labelWidth + i * cellSize;
        const y = labelHeight;
        ctx.fillStyle = sample.group === "tumor" ? "#ef4444" : "#3b82f6";
        ctx.fillRect(x, y, cellSize, annotationHeight);
      });
    }

    // 绘制热图单元格
    normalizedData.forEach((row, i) => {
      row.forEach((zScore, j) => {
        const x = labelWidth + j * cellSize;
        const y = labelHeight + annotationHeight + i * cellSize;

        ctx.fillStyle = getHeatmapColor(zScore);
        ctx.fillRect(x, y, cellSize, cellSize);

        // 绘制边框
        ctx.strokeStyle = "#e5e7eb";
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, cellSize, cellSize);

        // 选中效果
        if (selectedCell?.row === i && selectedCell?.col === j) {
          ctx.strokeStyle = "#775a19";
          ctx.lineWidth = 3;
          ctx.strokeRect(x, y, cellSize, cellSize);
        }
      });
    });

    // 绘制基因名标签
    ctx.fillStyle = "#1b1c1a";
    ctx.font = "12px Manrope, sans-serif";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    genes.forEach((gene, i) => {
      const y = labelHeight + annotationHeight + i * cellSize + cellSize / 2;
      ctx.fillText(gene.gene, labelWidth - 8, y);
    });

    // 绘制样本名标签（旋转）
    ctx.save();
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    samples.forEach((sample, i) => {
      const x = labelWidth + i * cellSize + cellSize / 2;
      const y = labelHeight - 8;
      ctx.translate(x, y);
      ctx.rotate(-Math.PI / 4);
      ctx.fillText(sample.name, 0, 0);
      ctx.rotate(Math.PI / 4);
      ctx.translate(-x, -y);
    });
    ctx.restore();

  }, [genes, samples, normalizedData, selectedCell, showAnnotation]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const cellSize = 40;
    const labelWidth = 80;
    const labelHeight = 100;
    const annotationHeight = showAnnotation ? 20 : 0;

    const col = Math.floor((x - labelWidth) / cellSize);
    const row = Math.floor((y - labelHeight - annotationHeight) / cellSize);

    if (row >= 0 && row < genes.length && col >= 0 && col < samples.length) {
      setSelectedCell({ row, col });
    } else {
      setSelectedCell(null);
    }
  };

  const styles = {
    host: {
      display: "block",
      padding: 16,
      fontFamily: "Manrope, sans-serif",
      background: "#faf9f5",
      borderRadius: 12,
      color: "#1b1c1a"
    },
    container: { maxWidth: 1000, margin: "0 auto" },
    title: {
      fontSize: "1.25rem",
      fontWeight: 600,
      color: "#1b1c1a",
      textAlign: "center" as const,
      marginBottom: 16
    },
    heatmapBox: {
      background: "#fff",
      padding: 20,
      borderRadius: 12,
      border: "1px solid #e5e7eb",
      overflowX: "auto" as const
    },
    canvas: {
      display: "block",
      cursor: "pointer"
    },
    colorBar: {
      marginTop: 20,
      padding: 16,
      background: "#faf9f5",
      borderRadius: 8,
      border: "1px solid #e5e7eb"
    },
    colorBarTitle: {
      fontSize: "0.9rem",
      fontWeight: 600,
      color: "#1b1c1a",
      marginBottom: 12
    },
    colorBarGradient: {
      display: "flex",
      alignItems: "center",
      gap: 12
    },
    gradient: {
      flex: 1,
      height: 20,
      borderRadius: 4,
      background: "linear-gradient(to right, rgb(65, 105, 225), rgb(255, 255, 255), rgb(255, 0, 0))",
      border: "1px solid #e5e7eb"
    },
    colorBarLabels: {
      display: "flex",
      justifyContent: "space-between",
      marginTop: 8,
      fontSize: "0.8rem",
      color: "#6b7280"
    },
    legend: {
      marginTop: 16,
      padding: 12,
      background: "#faf9f5",
      borderRadius: 8,
      border: "1px solid #e5e7eb"
    },
    legendTitle: {
      fontSize: "0.9rem",
      fontWeight: 600,
      color: "#1b1c1a",
      marginBottom: 8
    },
    legendGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
      gap: 8
    },
    legendItem: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      padding: 6,
      borderRadius: 4,
      background: "#fff",
      border: "1px solid #e5e7eb"
    },
    legendColor: {
      width: 16,
      height: 16,
      borderRadius: 4,
      flexShrink: 0
    },
    legendText: {
      fontSize: "0.85rem",
      color: "#6b7280",
      flex: 1
    },
    info: {
      marginTop: 16,
      padding: 12,
      background: "#fff",
      borderRadius: 8,
      border: "1px solid #e5e7eb"
    },
    infoTitle: {
      fontSize: "0.9rem",
      fontWeight: 600,
      color: "#1b1c1a",
      marginBottom: 8
    },
    infoContent: {
      fontSize: "0.85rem",
      color: "#6b7280",
      lineHeight: 1.6
    },
    cellDetail: {
      marginTop: 16,
      padding: 12,
      background: "#fff",
      borderRadius: 8,
      border: "2px solid #775a19"
    },
    cellDetailTitle: {
      fontSize: "0.9rem",
      fontWeight: 600,
      color: "#775a19",
      marginBottom: 8
    },
    cellDetailGrid: {
      display: "grid",
      gridTemplateColumns: "auto 1fr",
      gap: "8px 16px",
      fontSize: "0.85rem"
    },
    cellDetailLabel: {
      color: "#6b7280",
      fontWeight: 500
    },
    cellDetailValue: {
      color: "#1b1c1a",
      fontWeight: 600
    },
  };

  const uniqueGroups = Array.from(new Set(samples.map(s => s.group).filter(Boolean)));

  return (
    <div style={styles.host}>
      <div style={styles.container}>
        <div style={styles.title}>基因表达热图（Heatmap）</div>

        <div style={styles.heatmapBox}>
          <canvas
            ref={canvasRef}
            style={styles.canvas}
            onClick={handleCanvasClick}
          />
        </div>

        <div style={styles.colorBar}>
          <div style={styles.colorBarTitle}>色阶图例（Color Bar）</div>
          <div style={styles.colorBarGradient}>
            <span style={{ fontSize: "0.8rem", color: "#6b7280", minWidth: 40 }}>-3</span>
            <div style={styles.gradient} />
            <span style={{ fontSize: "0.8rem", color: "#6b7280", minWidth: 40 }}>+3</span>
          </div>
          <div style={styles.colorBarLabels}>
            <span>低表达</span>
            <span>基线（均值）</span>
            <span>高表达</span>
          </div>
          <div style={{ marginTop: 8, fontSize: "0.75rem", color: "#9ca3af", textAlign: "center" as const }}>
            数值单位：Z-score（行方向标准化）
          </div>
        </div>

        {showAnnotation && uniqueGroups.length > 0 && (
          <div style={styles.legend}>
            <div style={styles.legendTitle}>样本分组注释</div>
            <div style={styles.legendGrid}>
              <div style={styles.legendItem}>
                <div style={{ ...styles.legendColor, backgroundColor: "#ef4444" }} />
                <span style={styles.legendText}>肿瘤样本（Tumor）</span>
              </div>
              <div style={styles.legendItem}>
                <div style={{ ...styles.legendColor, backgroundColor: "#3b82f6" }} />
                <span style={styles.legendText}>正常样本（Normal）</span>
              </div>
            </div>
          </div>
        )}

        <div style={styles.info}>
          <div style={styles.infoTitle}>热图说明</div>
          <div style={styles.infoContent}>
            • <strong>行（Row）</strong>：每行代表一个基因<br />
            • <strong>列（Column）</strong>：每列代表一个样本<br />
            • <strong>颜色含义</strong>：蓝色=低表达，白色=均值，红色=高表达<br />
            • <strong>标准化方法</strong>：行方向Z-score标准化，消除基因间表达量差异<br />
            • <strong>交互</strong>：点击单元格查看详细数值
          </div>
        </div>

        {selectedCell && (
          <div style={styles.cellDetail}>
            <div style={styles.cellDetailTitle}>📊 选中单元格详情</div>
            <div style={styles.cellDetailGrid}>
              <span style={styles.cellDetailLabel}>基因：</span>
              <span style={styles.cellDetailValue}>{genes[selectedCell.row].gene}</span>

              <span style={styles.cellDetailLabel}>样本：</span>
              <span style={styles.cellDetailValue}>{samples[selectedCell.col].name}</span>

              <span style={styles.cellDetailLabel}>原始表达量：</span>
              <span style={styles.cellDetailValue}>
                {genes[selectedCell.row].expressionLevels[selectedCell.col].toFixed(2)}
              </span>

              <span style={styles.cellDetailLabel}>Z-score：</span>
              <span style={styles.cellDetailValue}>
                {normalizedData[selectedCell.row][selectedCell.col].toFixed(3)}
              </span>

              <span style={styles.cellDetailLabel}>表达水平：</span>
              <span style={styles.cellDetailValue}>
                {normalizedData[selectedCell.row][selectedCell.col] > 1 ? "高表达 ↑" :
                 normalizedData[selectedCell.row][selectedCell.col] < -1 ? "低表达 ↓" : "正常"}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
