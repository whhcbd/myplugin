import { useState, useCallback, useRef, useEffect, useMemo } from "react";

interface A2UINode {
  properties?: Record<string, unknown>;
}

interface AllelePair {
  gene: string;
  position: number;
  paternalAllele: string;
  maternalAllele: string;
  description?: string;
}

interface CrossoverPoint {
  position: number;
  label?: string;
  type?: "single" | "double" | "multiple";
}

interface GeneSegment {
  start: number;
  end: number;
  paternal: boolean;
}

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}
function parseStr(v: unknown, fb: string): string {
  return typeof v === "string" ? v : fb;
}
function parseNum(v: unknown, fb: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
}
function parseBool(v: unknown, fb: boolean): boolean {
  return typeof v === "boolean" ? v : fb;
}
function parseArray<T>(v: unknown, fb: T[]): T[] {
  return Array.isArray(v) ? v : fb;
}

const PATERNAL_COLOR = "#2563eb";
const PATERNAL_LIGHT = "#93bbfd";
const MATERNAL_COLOR = "#dc2626";
const MATERNAL_LIGHT = "#fca5a5";
const CROSSOVER_COLOR = "#f59e0b";
const BG = "#faf9f5";
const TEXT = "#1b1c1a";
const PRIMARY = "#182544";
const ACCENT = "#775a19";

const DEFAULT_ALLELES: AllelePair[] = [
  { gene: "A", position: 15, paternalAllele: "A", maternalAllele: "a" },
  { gene: "B", position: 40, paternalAllele: "B", maternalAllele: "b" },
  { gene: "D", position: 75, paternalAllele: "D", maternalAllele: "d" },
];
const DEFAULT_CROSSOVERS: CrossoverPoint[] = [
  { position: 55, label: "交叉点1", type: "single" },
];

interface Gamete {
  alleles: string[];
  type: "parental" | "recombinant";
  label: string;
  source: string;
}

function computeGametes(
  alleles: AllelePair[],
  crossoverPoints: CrossoverPoint[],
  chromosomeLength: number
): Gamete[] {
  if (alleles.length === 0 || crossoverPoints.length === 0) return [];

  const sorted = [...crossoverPoints].sort((a, b) => a.position - b.position);
  const nAlleles = alleles.length;
  const nCross = sorted.length;

  const totalOffspring = 1000;
  const gameteCounts: Record<string, number> = {};
  const gameteMeta: Record<string, { type: "parental" | "recombinant"; source: string }> = {};

  for (let i = 0; i < totalOffspring; i++) {
    const maternal = [true, true];
    for (const xo of sorted) {
      if (Math.random() < 0.5) {
        maternal[0] = !maternal[0];
      }
      if (Math.random() < 0.5) {
        maternal[1] = !maternal[1];
      }
    }

    const result: string[] = [];
    for (const a of alleles) {
      let switched = false;
      for (const xo of sorted) {
        if (a.position >= xo.position) {
          switched = !switched;
        }
      }
      const isMaternal = switched;
      result.push(isMaternal ? a.maternalAllele : a.paternalAllele);
    }

    const key = result.join("");
    gameteCounts[key] = (gameteCounts[key] || 0) + 1;

    if (!(key in gameteMeta)) {
      const isParental = result.every(
        (allele, idx) => allele === alleles[idx].paternalAllele
      ) || result.every(
        (allele, idx) => allele === alleles[idx].maternalAllele
      );
      gameteMeta[key] = {
        type: isParental ? "parental" : "recombinant",
        source: result.join(""),
      };
    }
  }

  const keys = Object.keys(gameteCounts).sort((a, b) => gameteCounts[b] - gameteCounts[a]);
  return keys.map((key) => ({
    alleles: key.split(""),
    type: gameteMeta[key].type,
    label: key,
    source: `${gameteCounts[key] / totalOffspring * 100}%`,
  }));
}

function computeExactGametes(
  alleles: AllelePair[],
  crossoverPoints: CrossoverPoint[]
): { gametes: Gamete[]; rfPercent: number } {
  if (alleles.length < 2 || crossoverPoints.length === 0) {
    return { gametes: [], rfPercent: 0 };
  }

  const sorted = [...crossoverPoints].sort((a, b) => a.position - b.position);
  const n = sorted.length;

  const parental1 = alleles.map((a) => a.paternalAllele).join("");
  const parental2 = alleles.map((a) => a.maternalAllele).join("");

  interface GameteKey {
    alleles: string[];
    count: number;
  }

  const gameteMap: Record<string, number> = {};

  for (let mask = 0; mask < 1 << n; mask++) {
    const crossActive: boolean[] = [];
    for (let i = 0; i < n; i++) {
      crossActive.push(((mask >> i) & 1) === 1);
    }

    const result1: string[] = [];
    const result2: string[] = [];
    for (const a of alleles) {
      let switched = false;
      for (let i = 0; i < sorted.length; i++) {
        if (a.position >= sorted[i].position) {
          if (crossActive[i]) switched = !switched;
        }
      }
      result1.push(switched ? a.maternalAllele : a.paternalAllele);
      result2.push(switched ? a.paternalAllele : a.maternalAllele);
    }

    const key1 = result1.join("");
    const key2 = result2.join("");
    gameteMap[key1] = (gameteMap[key1] || 0) + 1;
    gameteMap[key2] = (gameteMap[key2] || 0) + 1;
  }

  const total = Object.values(gameteMap).reduce((s, c) => s + c, 0);
  let recombinantCount = 0;

  const keys = Object.keys(gameteMap).sort((a, b) => gameteMap[b] - gameteMap[a]);
  const gametes: Gamete[] = keys.map((key) => {
    const count = gameteMap[key];
    const isParental = key === parental1 || key === parental2;
    if (!isParental) recombinantCount += count;
    return {
      alleles: key.split(""),
      type: isParental ? "parental" : "recombinant",
      label: key,
      source: `${((count / total) * 100).toFixed(1)}%`,
    };
  });

  const rfPercent = (recombinantCount / total) * 100;
  return { gametes, rfPercent };
}

export function CrossoverMap({ node }: { node: A2UINode }) {
  const props = node.properties ?? {};

  const initChromosomeId = parseStr(props.chromosomeId, "1");
  const initChromosomeLength = parseNum(props.chromosomeLength, 100);
  const initAlleles = parseArray<AllelePair>(props.alleles, DEFAULT_ALLELES);
  const initCrossoverPoints = parseArray<CrossoverPoint>(
    props.crossoverPoints,
    DEFAULT_CROSSOVERS
  );
  const initCentromerePosition = parseNum(props.centromerePosition, 48);
  const initShowCentromere = parseBool(props.showCentromere, true);
  const initInteractive = parseBool(props.interactive, true);
  const initShowTeachingTips = parseBool(props.showTeachingTips, true);
  const initMaternalLabel = parseStr(props.maternalLabel, "母源 ♀");
  const initPaternalLabel = parseStr(props.paternalLabel, "父源 ♂");
  const initStage = parseStr(props.stage, "减数第一次分裂前期（四分体时期）");

  const [chromosomeId] = useState(initChromosomeId);
  const [chromosomeLength] = useState(initChromosomeLength);
  const [alleles, setAlleles] = useState<AllelePair[]>(initAlleles);
  const [crossoverPoints, setCrossoverPoints] = useState<CrossoverPoint[]>(initCrossoverPoints);
  const [centromerePosition] = useState(initCentromerePosition);
  const [showCentromere] = useState(initShowCentromere);
  const [interactive] = useState(initInteractive);
  const [showTeachingTips] = useState(initShowTeachingTips);
  const [maternalLabel] = useState(initMaternalLabel);
  const [paternalLabel] = useState(initPaternalLabel);
  const [stage] = useState(initStage);
  const [hoveredGamete, setHoveredGamete] = useState<string | null>(null);
  const [selectedCrossover, setSelectedCrossover] = useState<number | null>(null);

  useEffect(() => { setAlleles(initAlleles); }, [initAlleles]);
  useEffect(() => { setCrossoverPoints(initCrossoverPoints); }, [initCrossoverPoints]);

  const containerRef = useRef<HTMLDivElement>(null);
  const [svgWidth, setSvgWidth] = useState(700);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      for (const entry of entries)
        setSvgWidth(Math.max(400, Math.floor(entry.contentRect.width)));
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const MARGIN = 50;
  const toX = useCallback(
    (pos: number) => {
      return chromosomeLength > 0
        ? MARGIN + (pos / chromosomeLength) * (svgWidth - MARGIN * 2)
        : MARGIN;
    },
    [chromosomeLength, svgWidth]
  );

  const { gametes, rfPercent } = useMemo(
    () => computeExactGametes(alleles, crossoverPoints),
    [alleles, crossoverPoints]
  );

  const recombGametes = gametes.filter((g) => g.type === "recombinant");
  const parentGametes = gametes.filter((g) => g.type === "parental");
  const totalGametes = gametes.length;

  const chrY1 = 55;
  const chrY2 = 135;
  const chrY3 = 210;
  const chrY4 = 290;
  const chrHeight = 60;
  const CHROMATID_GAP = 3;
  const SVG_H = chrY4 + chrHeight + 30;

  const alleleConnectY = chrY2 + chrHeight + 8;

  function getSegmentColor(
    pos: number,
    chromatidIndex: 0 | 1 | 2 | 3,
    crossoverPoints: CrossoverPoint[]
  ): string {
    const sorted = [...crossoverPoints].sort((a, b) => a.position - b.position);
    let isMaternal = chromatidIndex >= 2;
    let switched = false;
    for (const xo of sorted) {
      if (pos >= xo.position) {
        switched = !switched;
      }
    }
    if (switched) isMaternal = !isMaternal;
    const isLight = chromatidIndex === 1 || chromatidIndex === 3;
    if (isMaternal) return isLight ? MATERNAL_LIGHT : MATERNAL_COLOR;
    return isLight ? PATERNAL_LIGHT : PATERNAL_COLOR;
  }

  function drawChromatid(
    xStart: number,
    xEnd: number,
    yTop: number,
    h: number,
    chromatidIndex: 0 | 1 | 2 | 3,
    crossoverPoints: CrossoverPoint[]
  ) {
    const sorted = [...crossoverPoints].sort((a, b) => a.position - b.position);
    const segments: { x1: number; x2: number; color: string }[] = [];

    const points = [0, ...sorted.map((cp) => cp.position), chromosomeLength];
    for (let i = 0; i < points.length - 1; i++) {
      const segStart = points[i];
      const segEnd = points[i + 1];
      const midPos = (segStart + segEnd) / 2;
      segments.push({
        x1: toX(segStart),
        x2: toX(segEnd),
        color: getSegmentColor(midPos, chromatidIndex, crossoverPoints),
      });
    }

    return segments.map((seg, i) => (
      <rect
        key={`chr${chromatidIndex}_seg${i}`}
        x={seg.x1}
        y={yTop}
        width={Math.max(seg.x2 - seg.x1, 1)}
        height={h}
        rx={4}
        fill={seg.color}
        opacity={chromatidIndex === 1 || chromatidIndex === 3 ? 0.5 : 0.85}
      />
    ));
  }

  function drawCrossoverMark(xp: number, yTop: number, h: number, idx: number) {
    const isSelected = selectedCrossover === idx;
    const cy = yTop + h / 2;
    const r = isSelected ? 12 : 10;
    return (
      <g
        key={`xo${idx}`}
        onClick={() => interactive && setSelectedCrossover(isSelected ? null : idx)}
        style={{ cursor: interactive ? "pointer" : "default" }}
      >
        <line
          x1={xp - 7}
          y1={cy - 7}
          x2={xp + 7}
          y2={cy + 7}
          stroke={CROSSOVER_COLOR}
          strokeWidth={3}
        />
        <line
          x1={xp + 7}
          y1={cy - 7}
          x2={xp - 7}
          y2={cy + 7}
          stroke={CROSSOVER_COLOR}
          strokeWidth={3}
        />
        <circle
          cx={xp}
          cy={cy}
          r={r}
          fill="none"
          stroke={isSelected ? PRIMARY : CROSSOVER_COLOR}
          strokeWidth={isSelected ? 2.5 : 1.5}
          opacity={0.7}
        >
          <animate
            attributeName="r"
            values={`${r};${r + 3};${r}`}
            dur="2s"
            repeatCount="indefinite"
          />
        </circle>
      </g>
    );
  }

  const crossY = (chrY1 + chrY4 + chrHeight) / 2;

  const chromatidH = chrHeight / 2 - CHROMATID_GAP;

  const paternalTopY = chrY1;
  const maternalTopY = chrY3;

  return (
    <section
      style={{
        display: "grid",
        gap: 14,
        padding: 18,
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        background: BG,
        color: TEXT,
        fontFamily: "Manrope, sans-serif",
        maxWidth: 800,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "start",
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ fontSize: "1.05rem", fontWeight: 700 }}>交叉互换图谱</div>
          <div style={{ color: "#475569", fontSize: "0.82rem" }}>
            染色体 {chromosomeId} &middot; {chromosomeLength} cM &middot; {stage}
          </div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          <span
            style={{
              padding: "4px 8px",
              borderRadius: 999,
              background: "rgba(37,99,235,0.08)",
              color: "#1d4ed8",
              fontSize: "0.72rem",
              fontWeight: 600,
            }}
          >
            {alleles.length} 个基因
          </span>
          <span
            style={{
              padding: "4px 8px",
              borderRadius: 999,
              background: "rgba(239,68,68,0.08)",
              color: "#dc2626",
              fontSize: "0.72rem",
              fontWeight: 600,
            }}
          >
            {crossoverPoints.length} 个交叉点
          </span>
          {gametes.length > 0 && (
            <span
              style={{
                padding: "4px 8px",
                borderRadius: 999,
                background: "rgba(245,158,11,0.08)",
                color: ACCENT,
                fontSize: "0.72rem",
                fontWeight: 600,
              }}
            >
              RF = {rfPercent.toFixed(1)}% = {rfPercent.toFixed(1)} cM
            </span>
          )}
        </div>
      </div>

      <div ref={containerRef}>
        <svg
          width={svgWidth}
          height={SVG_H}
          style={{ display: "block", borderRadius: 8, background: "#fff", border: "1px solid #e5e7eb" }}
        >
          <defs>
            <linearGradient id="chrGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(24,37,68,0.04)" />
              <stop offset="100%" stopColor="rgba(24,37,68,0.08)" />
            </linearGradient>
            <filter id="shadow" x="-2%" y="-2%" width="104%" height="104%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodOpacity="0.08" />
            </filter>
          </defs>

          <text
            x={toX(0)}
            y={chrY1 - 8}
            fontSize={11}
            fontWeight={600}
            fill={PATERNAL_COLOR}
          >
            {paternalLabel}
          </text>
          <text
            x={toX(0)}
            y={chrY3 - 8}
            fontSize={11}
            fontWeight={600}
            fill={MATERNAL_COLOR}
          >
            {maternalLabel}
          </text>

          {drawChromatid(toX(0), toX(chromosomeLength), paternalTopY, chromatidH, 0, crossoverPoints)}
          {drawChromatid(toX(0), toX(chromosomeLength), paternalTopY + chromatidH + CHROMATID_GAP * 2, chromatidH, 1, crossoverPoints)}
          {drawChromatid(toX(0), toX(chromosomeLength), maternalTopY, chromatidH, 2, crossoverPoints)}
          {drawChromatid(toX(0), toX(chromosomeLength), maternalTopY + chromatidH + CHROMATID_GAP * 2, chromatidH, 3, crossoverPoints)}

          {showCentromere && (
            <>
              <rect
                x={toX(centromerePosition) - 4}
                y={paternalTopY - 2}
                width={8}
                height={chrHeight + 4}
                rx={3}
                fill="#334155"
                opacity={0.25}
              />
              <rect
                x={toX(centromerePosition) - 4}
                y={maternalTopY - 2}
                width={8}
                height={chrHeight + 4}
                rx={3}
                fill="#334155"
                opacity={0.25}
              />
              <text
                x={toX(centromerePosition)}
                y={maternalTopY + chrHeight + 16}
                textAnchor="middle"
                fontSize={9}
                fill="#64748b"
              >
                着丝粒
              </text>
            </>
          )}

          {crossoverPoints.map((point, i) => {
            const xp = toX(point.position);
            return drawCrossoverMark(xp, paternalTopY + chrHeight + 4, maternalTopY - paternalTopY - chrHeight - 4, i);
          })}

          {alleles.map((a, i) => {
            const xp = toX(a.position);
            const topPatY = paternalTopY - 4;
            const topMatY = maternalTopY - 4;
            return (
              <g key={`allele${i}`}>
                <line
                  x1={xp}
                  y1={topPatY}
                  x2={xp}
                  y2={topPatY - 14}
                  stroke={PATERNAL_COLOR}
                  strokeWidth={1}
                  opacity={0.5}
                />
                <circle cx={xp} cy={topPatY - 18} r={9} fill={PATERNAL_COLOR} />
                <text
                  x={xp}
                  y={topPatY - 15}
                  textAnchor="middle"
                  fontSize={10}
                  fontWeight={700}
                  fill="#fff"
                >
                  {a.paternalAllele}
                </text>

                <line
                  x1={xp}
                  y1={topMatY}
                  x2={xp}
                  y2={topMatY - 14}
                  stroke={MATERNAL_COLOR}
                  strokeWidth={1}
                  opacity={0.5}
                />
                <circle cx={xp} cy={topMatY - 18} r={9} fill={MATERNAL_COLOR} />
                <text
                  x={xp}
                  y={topMatY - 15}
                  textAnchor="middle"
                  fontSize={10}
                  fontWeight={700}
                  fill="#fff"
                >
                  {a.maternalAllele}
                </text>

                <line
                  x1={xp}
                  y1={topPatY - 27}
                  x2={xp}
                  y2={topMatY - 27}
                  stroke="#94a3b8"
                  strokeWidth={1}
                  strokeDasharray="3 3"
                  opacity={0.4}
                />
                <text
                  x={xp + 12}
                  y={topPatY - 24}
                  fontSize={8}
                  fill="#94a3b8"
                >
                  {a.gene}位
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          color: "#475569",
          fontSize: "0.72rem",
        }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <span style={{ width: 10, height: 10, borderRadius: 999, background: PATERNAL_COLOR, display: "inline-block" }} />
          父源染色体
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <span style={{ width: 10, height: 10, borderRadius: 999, background: PATERNAL_LIGHT, display: "inline-block" }} />
          父源姐妹单体
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <span style={{ width: 10, height: 10, borderRadius: 999, background: MATERNAL_COLOR, display: "inline-block" }} />
          母源染色体
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <span style={{ width: 10, height: 10, borderRadius: 999, background: MATERNAL_LIGHT, display: "inline-block" }} />
          母源姐妹单体
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: CROSSOVER_COLOR, display: "inline-block" }} />
          交叉互换点
        </span>
        {showCentromere && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 10, height: 10, borderRadius: 999, background: "#334155", display: "inline-block" }} />
            着丝粒
          </span>
        )}
      </div>

      {selectedCrossover !== null && crossoverPoints[selectedCrossover] && (
        <div
          style={{
            padding: 12,
            borderRadius: 12,
            background: "#fff",
            border: "1px solid #fde68a",
            fontSize: "0.78rem",
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 4, color: ACCENT }}>
            交叉点详情：{crossoverPoints[selectedCrossover].label ?? `交叉点 ${selectedCrossover + 1}`}
          </div>
          <div style={{ color: "#334155" }}>
            位置：{crossoverPoints[selectedCrossover].position} cM
            {crossoverPoints[selectedCrossover].type &&
              ` · 类型：${crossoverPoints[selectedCrossover].type === "single" ? "单交换" : crossoverPoints[selectedCrossover].type === "double" ? "双交换" : "多交换"}`}
          </div>
          <div style={{ color: "#64748b", marginTop: 4, fontSize: "0.72rem" }}>
            交换发生在非姐妹染色单体之间（父源的一条单体与母源的一条单体之间）
          </div>
        </div>
      )}

      {gametes.length > 0 && (
        <div
          style={{
            padding: 14,
            borderRadius: 12,
            background: "#fff",
            border: "1px solid #e5e7eb",
          }}
        >
          <div
            style={{
              fontWeight: 600,
              fontSize: "0.85rem",
              marginBottom: 10,
              color: PRIMARY,
            }}
          >
            减数分裂后配子类型
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
              gap: 8,
            }}
          >
            {gametes.map((g) => {
              const isHovered = hoveredGamete === g.label;
              const isParental = g.type === "parental";
              return (
                <div
                  key={g.label}
                  onMouseEnter={() => setHoveredGamete(g.label)}
                  onMouseLeave={() => setHoveredGamete(null)}
                  style={{
                    padding: 10,
                    borderRadius: 10,
                    border: `1px solid ${isParental ? "rgba(37,99,235,0.2)" : "rgba(245,158,11,0.3)"}`,
                    background: isHovered
                      ? isParental
                        ? "rgba(37,99,235,0.05)"
                        : "rgba(245,158,11,0.05)"
                      : "#fff",
                    transition: "background 0.15s",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 4,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 600,
                        padding: "2px 6px",
                        borderRadius: 999,
                        background: isParental
                          ? "rgba(37,99,235,0.1)"
                          : "rgba(245,158,11,0.1)",
                        color: isParental ? "#1d4ed8" : ACCENT,
                      }}
                    >
                      {isParental ? "亲本型" : "重组型"}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: PRIMARY }}>
                      {g.source}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 2, justifyContent: "center" }}>
                    {g.alleles.map((allele, ai) => {
                      const alleleDef = alleles[ai];
                      const isPaternal = alleleDef && allele === alleleDef.paternalAllele;
                      return (
                        <span
                          key={ai}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: 26,
                            height: 26,
                            borderRadius: 6,
                            fontSize: 13,
                            fontWeight: 700,
                            color: "#fff",
                            background: isPaternal ? PATERNAL_COLOR : MATERNAL_COLOR,
                          }}
                        >
                          {allele}
                        </span>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {gametes.length > 0 && (
        <div
          style={{
            padding: 14,
            borderRadius: 12,
            background: "#fff",
            border: "1px solid #e5e7eb",
          }}
        >
          <div
            style={{
              fontWeight: 600,
              fontSize: "0.85rem",
              marginBottom: 10,
              color: PRIMARY,
            }}
          >
            重组频率计算
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: 8,
              marginBottom: 12,
            }}
          >
            <div
              style={{
                textAlign: "center",
                padding: 10,
                borderRadius: 10,
                background: "#f8fbff",
                border: "1px solid rgba(37,99,235,0.1)",
              }}
            >
              <div style={{ fontSize: 10, color: "#6b7280" }}>亲本型</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: PATERNAL_COLOR }}>
                {parentGametes.length > 0
                  ? parentGametes
                      .reduce((s, g) => s + parseFloat(g.source), 0)
                      .toFixed(1) + "%"
                  : "0%"}
              </div>
            </div>
            <div
              style={{
                textAlign: "center",
                padding: 10,
                borderRadius: 10,
                background: "#fffbf5",
                border: "1px solid rgba(245,158,11,0.15)",
              }}
            >
              <div style={{ fontSize: 10, color: "#6b7280" }}>重组型</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: ACCENT }}>
                {recombGametes.length > 0
                  ? recombGametes
                      .reduce((s, g) => s + parseFloat(g.source), 0)
                      .toFixed(1) + "%"
                  : "0%"}
              </div>
            </div>
            <div
              style={{
                textAlign: "center",
                padding: 10,
                borderRadius: 10,
                background: "#f5f5ff",
                border: "1px solid rgba(24,37,68,0.1)",
              }}
            >
              <div style={{ fontSize: 10, color: "#6b7280" }}>图距</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: PRIMARY }}>
                {rfPercent.toFixed(1)} cM
              </div>
            </div>
          </div>

          <div
            style={{
              padding: 12,
              borderRadius: 10,
              background: "#f8fafc",
              fontSize: "0.76rem",
              lineHeight: 1.8,
              color: "#334155",
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 4, color: PRIMARY }}>
              计算过程：
            </div>
            <div>
              RF = 重组型配子数 / 总配子数 &times; 100%
            </div>
            {totalGametes > 0 && (
              <>
                <div>
                  RF = {recombGametes.reduce((s, g) => s + parseFloat(g.source), 0).toFixed(1)}% / 100% &times; 100%
                </div>
                <div style={{ fontWeight: 600, color: ACCENT }}>
                  RF = {rfPercent.toFixed(1)}% &rarr; 图距 = {rfPercent.toFixed(1)} cM
                </div>
                <div style={{ color: "#64748b", marginTop: 4, fontSize: "0.72rem" }}>
                  1% 重组率 = 1 cM（厘摩） | 重组率范围：0% ~ 50%
                  {rfPercent > 0 && rfPercent <= 50 && (
                    <span>
                      {" "}
                      | {rfPercent > 10
                        ? "基因间距离适中，连锁较松"
                        : "基因间距离较近，连锁紧密"}
                    </span>
                  )}
                </div>
              </>
            )}
          </div>

          {crossoverPoints.length >= 1 && alleles.length >= 2 && (
            <div
              style={{
                marginTop: 8,
                fontSize: "0.72rem",
                color: "#64748b",
                lineHeight: 1.7,
              }}
            >
              💡 交换的细胞比例 &asymp; {rfPercent > 0 ? (rfPercent * 2).toFixed(0) : "?"}%（因为一次交换只影响4条染色单体中的2条，重组率 &asymp; 1/2 &times; 交换细胞比例）
            </div>
          )}
        </div>
      )}

      {showTeachingTips && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 8,
          }}
        >
          <div
            style={{
              padding: 10,
              borderRadius: 10,
              background: "#fff",
              border: "1px solid #e5e7eb",
              fontSize: "0.72rem",
            }}
          >
            <h4 style={{ margin: "0 0 6px", fontSize: "0.82rem", color: PRIMARY }}>
              核心要点
            </h4>
            <ul
              style={{
                display: "grid",
                gap: 4,
                margin: 0,
                padding: 0,
                listStyle: "none",
                color: "#334155",
                lineHeight: 1.6,
              }}
            >
              <li>&#x2713; 交换发生在<strong>非姐妹染色单体</strong>之间</li>
              <li>&#x2713; 交叉互换 &ne; 易位（易位是非同源染色体间）</li>
              <li>&#x2713; 重组率上限 <strong>50%</strong>，超过则不连锁</li>
              <li>&#x2713; 1% 重组率 = 1 cM</li>
            </ul>
          </div>
          <div
            style={{
              padding: 10,
              borderRadius: 10,
              background: "#fff",
              border: "1px solid #e5e7eb",
              fontSize: "0.72rem",
            }}
          >
            <h4 style={{ margin: "0 0 6px", fontSize: "0.82rem", color: "#dc2626" }}>
              常见错误警示
            </h4>
            <ul
              style={{
                display: "grid",
                gap: 4,
                margin: 0,
                padding: 0,
                listStyle: "none",
                color: "#334155",
                lineHeight: 1.6,
              }}
            >
              <li>&#x2717; 姐妹染色单体间画交换 &rarr; 应在非姐妹间</li>
              <li>&#x2717; 重组率10%=10%细胞交换 &rarr; 实际&asymp;20%</li>
              <li>&#x2717; cM直接等于Mb &rarr; 不成正比</li>
              <li>&#x2717; 忽略双交换 &rarr; 会导致基因顺序判断错误</li>
            </ul>
          </div>
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 8,
        }}
      >
        <div
          style={{
            padding: 10,
            borderRadius: 10,
            background: "#fff",
            border: "1px solid #e5e7eb",
          }}
        >
          <h4
            style={{ margin: "0 0 6px", fontSize: "0.82rem", color: PRIMARY }}
          >
            观察摘要
          </h4>
          <ul
            style={{
              display: "grid",
              gap: 4,
              margin: 0,
              padding: 0,
              listStyle: "none",
              fontSize: "0.72rem",
              color: "#334155",
            }}
          >
            <li>着丝粒：{centromerePosition} cM</li>
            <li>基因位点：{alleles.map((a) => a.paternalAllele).join("")}/{alleles.map((a) => a.maternalAllele).join("")}</li>
            <li>交叉点数：{crossoverPoints.length}</li>
            <li>配子种类：{totalGametes}</li>
            <li>模式：{interactive ? "交互" : "只读"}</li>
          </ul>
        </div>
        <div
          style={{
            padding: 10,
            borderRadius: 10,
            background: "#fff",
            border: "1px solid #e5e7eb",
          }}
        >
          <h4
            style={{ margin: "0 0 6px", fontSize: "0.82rem", color: PRIMARY }}
          >
            适用范围
          </h4>
          <ul
            style={{
              display: "grid",
              gap: 4,
              margin: 0,
              padding: 0,
              listStyle: "none",
              fontSize: "0.72rem",
              color: "#334155",
            }}
          >
            <li>&#x2713; 真核生物有性生殖核基因</li>
            <li>&#x2713; 同一染色体上 &lt;50cM 的基因</li>
            <li>&#x2713; 减数分裂过程教学</li>
            <li>&#x2717; 不适用于原核生物 / 体细胞分裂</li>
          </ul>
        </div>
      </div>
    </section>
  );
}

export default CrossoverMap;
