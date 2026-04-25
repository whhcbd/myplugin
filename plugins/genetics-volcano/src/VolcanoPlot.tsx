import { useEffect, useRef, useState } from "react";

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

interface GenePoint {
  name: string;
  log2FC: number;
  pValue: number;
  negLog10P: number;
  category: "up" | "down" | "ns";
}

// 解析基因数据
function parseGeneData(
  geneNames: string,
  log2FCs: string,
  pValues: string,
  fcThreshold: number,
  pThreshold: number
): GenePoint[] {
  const names = geneNames.split(",").map((s) => s.trim()).filter(Boolean);
  const fcs = log2FCs.split(",").map((s) => Number(s.trim())).filter((n) => Number.isFinite(n));
  const ps = pValues.split(",").map((s) => Number(s.trim())).filter((n) => Number.isFinite(n) && n > 0);

  const minLen = Math.min(names.length, fcs.length, ps.length);
  const points: GenePoint[] = [];

  for (let i = 0; i < minLen; i++) {
    const log2FC = fcs[i];
    const pValue = ps[i];
    const negLog10P = -Math.log10(pValue);

    let category: "up" | "down" | "ns" = "ns";
    if (negLog10P >= -Math.log10(pThreshold)) {
      if (log2FC >= fcThreshold) category = "up";
      else if (log2FC <= -fcThreshold) category = "down";
    }

    points.push({
      name: names[i],
      log2FC,
      pValue,
      negLog10P,
      category,
    });
  }

  return points;
}

export default function VolcanoPlot({ node }: { node: A2UINode }) {
  const props = node.properties ?? {};

  const initGeneNames = parseStr(props.geneNames, "Gene_A,Gene_B,Gene_C,Gene_D,Gene_E,Gene_F,Gene_G,Gene_H,Gene_I,Gene_J");
  const initLog2FCs = parseStr(props.log2FCs, "3.2,-2.8,1.5,-0.8,4.1,-3.5,0.5,-1.2,2.3,-4.0");
  const initPValues = parseStr(props.pValues, "0.001,0.002,0.01,0.3,0.0001,0.0005,0.4,0.15,0.005,0.0002");
  const initFCThreshold = parseNum(props.fcThreshold, 1);
  const initPThreshold = parseNum(props.pThreshold, 0.05);
  const initTitle = parseStr(props.title, "差异表达基因火山图");
  const initComparison = parseStr(props.comparison, "Tumor vs Normal");
  const initShowLabels = parseBool(props.showLabels, true);
  const initTopN = parseNum(props.topN, 5);

  const [geneNames, setGeneNames] = useState(initGeneNames);
  const [log2FCs, setLog2FCs] = useState(initLog2FCs);
  const [pValues, setPValues] = useState(initPValues);
  const [fcThreshold, setFCThreshold] = useState(initFCThreshold);
  const [pThreshold, setPThreshold] = useState(initPThreshold);
  const [title, setTitle] = useState(initTitle);
  const [comparison, setComparison] = useState(initComparison);
  const [showLabels, setShowLabels] = useState(initShowLabels);
  const [topN, setTopN] = useState(initTopN);
  const [hoveredGene, setHoveredGene] = useState<GenePoint | null>(null);

  useEffect(() => { setGeneNames(initGeneNames); }, [initGeneNames]);
  useEffect(() => { setLog2FCs(initLog2FCs); }, [initLog2FCs]);
  useEffect(() => { setPValues(initPValues); }, [initPValues]);
  useEffect(() => { setFCThreshold(initFCThreshold); }, [initFCThreshold]);
  useEffect(() => { setPThreshold(initPThreshold); }, [initPThreshold]);
  useEffect(() => { setTitle(initTitle); }, [initTitle]);
  useEffect(() => { setComparison(initComparison); }, [initComparison]);
  useEffect(() => { setShowLabels(initShowLabels); }, [initShowLabels]);
  useEffect(() => { setTopN(initTopN); }, [initTopN]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const data = parseGeneData(geneNames, log2FCs, pValues, fcThreshold, pThreshold);

  const upCount = data.filter((d) => d.category === "up").length;
  const downCount = data.filter((d) => d.category === "down").length;
  const nsCount = data.filter((d) => d.category === "ns").length;

  // 绘制火山图
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const padding = { top: 40, right: 20, bottom: 50, left: 60 };
    const plotW = W - padding.left - padding.right;
    const plotH = H - padding.top - padding.bottom;

    ctx.clearRect(0, 0, W, H);

    if (data.length === 0) {
      ctx.fillStyle = "#1b1c1a";
      ctx.font = "14px Manrope, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("无数据", W / 2, H / 2);
      return;
    }

    // 计算坐标范围
    const maxAbsFC = Math.max(...data.map((d) => Math.abs(d.log2FC)), fcThreshold + 1);
    const xMin = -maxAbsFC - 0.5;
    const xMax = maxAbsFC + 0.5;
    const maxNegLog10P = Math.max(...data.map((d) => d.negLog10P), -Math.log10(pThreshold) + 1);
    const yMin = 0;
    const yMax = maxNegLog10P + 0.5;

    const scaleX = (x: number) => padding.left + ((x - xMin) / (xMax - xMin)) * plotW;
    const scaleY = (y: number) => padding.top + plotH - ((y - yMin) / (yMax - yMin)) * plotH;

    // 绘制背景网格
    ctx.strokeStyle = "rgba(27,28,26,0.1)";
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 5; i++) {
      const y = scaleY(yMin + (i / 5) * (yMax - yMin));
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(padding.left + plotW, y);
      ctx.stroke();
    }

    // 绘制坐标轴
    ctx.strokeStyle = "#1b1c1a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top);
    ctx.lineTo(padding.left, padding.top + plotH);
    ctx.lineTo(padding.left + plotW, padding.top + plotH);
    ctx.stroke();

    // 绘制 X=0 线（Y轴）
    const x0 = scaleX(0);
    ctx.strokeStyle = "rgba(27,28,26,0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x0, padding.top);
    ctx.lineTo(x0, padding.top + plotH);
    ctx.stroke();

    // 绘制阈值线
    ctx.strokeStyle = "rgba(27,28,26,0.4)";
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);

    // 垂直阈值线 (log2FC = ±threshold)
    const xThresholdPos = scaleX(fcThreshold);
    const xThresholdNeg = scaleX(-fcThreshold);
    ctx.beginPath();
    ctx.moveTo(xThresholdPos, padding.top);
    ctx.lineTo(xThresholdPos, padding.top + plotH);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(xThresholdNeg, padding.top);
    ctx.lineTo(xThresholdNeg, padding.top + plotH);
    ctx.stroke();

    // 水平阈值线 (P value threshold)
    const yThreshold = scaleY(-Math.log10(pThreshold));
    ctx.beginPath();
    ctx.moveTo(padding.left, yThreshold);
    ctx.lineTo(padding.left + plotW, yThreshold);
    ctx.stroke();

    ctx.setLineDash([]);

    // 绘制散点
    data.forEach((point) => {
      const x = scaleX(point.log2FC);
      const y = scaleY(point.negLog10P);

      if (point.category === "up") {
        ctx.fillStyle = "#ef4444"; // 红色 - 上调
      } else if (point.category === "down") {
        ctx.fillStyle = "#3b82f6"; // 蓝色 - 下调
      } else {
        ctx.fillStyle = "rgba(27,28,26,0.3)"; // 灰色 - 无显著差异
      }

      ctx.beginPath();
      ctx.arc(x, y, point.category === "ns" ? 3 : 4, 0, 2 * Math.PI);
      ctx.fill();
    });

    // 标注 Top N 基因
    if (showLabels && topN > 0) {
      const significantGenes = data.filter((d) => d.category !== "ns");
      const sortedGenes = significantGenes
        .sort((a, b) => {
          const scoreA = Math.abs(a.log2FC) * a.negLog10P;
          const scoreB = Math.abs(b.log2FC) * b.negLog10P;
          return scoreB - scoreA;
        })
        .slice(0, topN);

      ctx.fillStyle = "#1b1c1a";
      ctx.font = "10px Manrope, sans-serif";
      ctx.textAlign = "left";

      sortedGenes.forEach((gene) => {
        const x = scaleX(gene.log2FC);
        const y = scaleY(gene.negLog10P);

        // 绘制连接线
        ctx.strokeStyle = "rgba(27,28,26,0.3)";
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + 8, y - 8);
        ctx.stroke();

        // 绘制标签
        ctx.fillText(gene.name, x + 10, y - 8);
      });
    }

    // 绘制坐标轴标签
    ctx.fillStyle = "#1b1c1a";
    ctx.font = "12px Manrope, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("log₂(Fold Change)", W / 2, H - 10);

    ctx.save();
    ctx.translate(15, H / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("-log₁₀(P value)", 0, 0);
    ctx.restore();

    // 绘制刻度
    ctx.font = "10px Manrope, sans-serif";
    ctx.textAlign = "center";
    [-4, -2, 0, 2, 4].forEach((val) => {
      if (val >= xMin && val <= xMax) {
        const x = scaleX(val);
        ctx.fillText(val.toString(), x, padding.top + plotH + 20);
      }
    });

    ctx.textAlign = "right";
    for (let i = 0; i <= 5; i++) {
      const val = yMin + (i / 5) * (yMax - yMin);
      const y = scaleY(val);
      ctx.fillText(val.toFixed(1), padding.left - 10, y + 4);
    }
  }, [data, fcThreshold, pThreshold, showLabels, topN]);

  return (
    <div
      style={{
        background: "#faf9f5",
        borderRadius: 12,
        padding: 16,
        display: "inline-block",
        fontFamily: "Manrope, sans-serif",
        color: "#1b1c1a",
        minWidth: 600,
      }}
    >
      {/* 标题 */}
      <div style={{ marginBottom: 12, textAlign: "center" }}>
        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>{title}</div>
        <div style={{ fontSize: 12, color: "rgba(27,28,26,0.6)" }}>{comparison}</div>
      </div>

      {/* Canvas 火山图 */}
      <div style={{ position: "relative" }}>
        <canvas
          ref={canvasRef}
          width={600}
          height={400}
          style={{ display: "block", borderRadius: 8, background: "#fff" }}
          onMouseMove={(e) => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            const padding = { top: 40, right: 20, bottom: 50, left: 60 };
            const plotW = 600 - padding.left - padding.right;
            const plotH = 400 - padding.top - padding.bottom;

            const maxAbsFC = Math.max(...data.map((d) => Math.abs(d.log2FC)), fcThreshold + 1);
            const xMin = -maxAbsFC - 0.5;
            const xMax = maxAbsFC + 0.5;
            const maxNegLog10P = Math.max(...data.map((d) => d.negLog10P), -Math.log10(pThreshold) + 1);
            const yMin = 0;
            const yMax = maxNegLog10P + 0.5;

            const scaleX = (val: number) => padding.left + ((val - xMin) / (xMax - xMin)) * plotW;
            const scaleY = (val: number) => padding.top + plotH - ((val - yMin) / (yMax - yMin)) * plotH;

            let found: GenePoint | null = null;
            for (const point of data) {
              const px = scaleX(point.log2FC);
              const py = scaleY(point.negLog10P);
              const dist = Math.sqrt((x - px) ** 2 + (y - py) ** 2);
              if (dist < 8) {
                found = point;
                break;
              }
            }
            setHoveredGene(found);
          }}
          onMouseLeave={() => setHoveredGene(null)}
        />

        {/* 悬停提示 */}
        {hoveredGene && (
          <div
            style={{
              position: "absolute",
              top: 10,
              right: 10,
              background: "rgba(24,37,68,0.95)",
              color: "#fff",
              padding: "8px 12px",
              borderRadius: 8,
              fontSize: 11,
              lineHeight: 1.6,
              pointerEvents: "none",
            }}
          >
            <div style={{ fontWeight: 600 }}>{hoveredGene.name}</div>
            <div>log₂FC: {hoveredGene.log2FC.toFixed(2)}</div>
            <div>P value: {hoveredGene.pValue.toExponential(2)}</div>
            <div>-log₁₀(P): {hoveredGene.negLog10P.toFixed(2)}</div>
          </div>
        )}
      </div>

      {/* 统计信息 */}
      <div
        style={{
          marginTop: 12,
          display: "flex",
          justifyContent: "center",
          gap: 20,
          fontSize: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#ef4444" }} />
          <span>显著上调: {upCount}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#3b82f6" }} />
          <span>显著下调: {downCount}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 12, height: 12, borderRadius: "50%", background: "rgba(27,28,26,0.3)" }} />
          <span>无显著差异: {nsCount}</span>
        </div>
      </div>

      {/* 阈值说明 */}
      <div
        style={{
          marginTop: 12,
          padding: 10,
          background: "rgba(24,37,68,0.05)",
          borderRadius: 8,
          fontSize: 11,
          color: "rgba(27,28,26,0.7)",
          textAlign: "center",
        }}
      >
        阈值标准: |log₂FC| &gt; {fcThreshold.toFixed(1)} 且 P value &lt; {pThreshold}
        {showLabels && topN > 0 && ` | 标注 Top ${topN} 基因`}
      </div>

      {/* 控制面板 */}
      <div
        style={{
          marginTop: 12,
          padding: 12,
          background: "rgba(24,37,68,0.03)",
          borderRadius: 8,
          display: "flex",
          flexDirection: "column",
          gap: 10,
          fontSize: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ minWidth: 100 }}>FC 阈值:</span>
          <input
            type="range"
            min={0.5}
            max={3}
            step={0.1}
            value={fcThreshold}
            onChange={(e) => setFCThreshold(Number(e.target.value))}
            style={{ flex: 1 }}
          />
          <span style={{ minWidth: 40, textAlign: "right" }}>{fcThreshold.toFixed(1)}</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ minWidth: 100 }}>P 阈值:</span>
          <select
            value={pThreshold}
            onChange={(e) => setPThreshold(Number(e.target.value))}
            style={{
              flex: 1,
              padding: "4px 8px",
              borderRadius: 4,
              border: "1px solid rgba(24,37,68,0.2)",
              background: "#fff",
              fontSize: 12,
            }}
          >
            <option value={0.1}>0.1</option>
            <option value={0.05}>0.05</option>
            <option value={0.01}>0.01</option>
            <option value={0.001}>0.001</option>
          </select>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={showLabels}
              onChange={(e) => setShowLabels(e.target.checked)}
            />
            <span>显示基因标签</span>
          </label>
          {showLabels && (
            <>
              <span style={{ marginLeft: 10 }}>Top N:</span>
              <input
                type="number"
                min={1}
                max={20}
                value={topN}
                onChange={(e) => setTopN(Number(e.target.value))}
                style={{
                  width: 60,
                  padding: "4px 8px",
                  borderRadius: 4,
                  border: "1px solid rgba(24,37,68,0.2)",
                  fontSize: 12,
                }}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
