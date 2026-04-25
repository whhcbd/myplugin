import { useState, useEffect, useRef, useCallback } from "react";

interface A2UINode {
  properties?: Record<string, unknown>;
}

function parseStr(val: unknown, fallback: string): string {
  return typeof val === "string" ? val : fallback;
}

type Gender = "male" | "female" | "unknown";
type Phenotype = "normal" | "affected" | "carrier" | "uncertain";
type InheritanceMode = "AR" | "AD" | "XR" | "XD" | "Y" | "mitochondrial" | "unknown";

interface Individual {
  id: string;
  gender: Gender;
  phenotype: Phenotype;
  generation: number;
  parents?: { father?: string; mother?: string };
  spouseId?: string;
  label?: string;
  age?: string;
  genotype?: string;
  isDeceased?: boolean;
  causeOfDeath?: string;
  isProband?: boolean;
  isAdopted?: boolean;
  isMiscarriage?: boolean;
  isStillborn?: boolean;
  isInfertile?: boolean;
  matingType?: "normal" | "consanguineous" | "divorced" | "separated";
  count?: number;
}

interface Generation {
  individuals: Individual[];
}

const DEFAULT_DATA: Generation[] = [
  {
    individuals: [
      { id: "I-1", gender: "male", phenotype: "normal", generation: 0 },
      { id: "I-2", gender: "female", phenotype: "carrier", generation: 0, spouseId: "I-1" },
    ],
  },
  {
    individuals: [
      { id: "II-1", gender: "male", phenotype: "affected", generation: 1, parents: { father: "I-1", mother: "I-2" }, isProband: true },
      { id: "II-2", gender: "female", phenotype: "normal", generation: 1, parents: { father: "I-1", mother: "I-2" } },
      { id: "II-3", gender: "male", phenotype: "normal", generation: 1, parents: { father: "I-1", mother: "I-2" } },
    ],
  },
];

function parseGenerations(raw: string): Generation[] {
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0 && Array.isArray(parsed[0].individuals)) {
      return parsed;
    }
  } catch {}
  return DEFAULT_DATA;
}

const MODE_LABELS: Record<string, string> = {
  AR: "常染色体隐性",
  AD: "常染色体显性",
  XR: "X连锁隐性",
  XD: "X连锁显性",
  Y: "Y连锁",
  mitochondrial: "线粒体遗传",
  unknown: "未知",
};

const PHENOTYPE_LABELS: Record<string, string> = {
  normal: "正常",
  affected: "患病",
  carrier: "携带者",
  uncertain: "不确定",
};

function toRoman(n: number): string {
  const map: [number, string][] = [[10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
  let r = "";
  for (const [val, sym] of map) while (n >= val) { r += sym; n -= val; }
  return r;
}

// 基因型推断算法
function inferGenotype(
  phenotype: Phenotype,
  gender: Gender,
  inheritanceMode: InheritanceMode,
  parents?: { father?: Individual; mother?: Individual }
): string {
  // 常染色体隐性遗传（AR）
  if (inheritanceMode === "AR") {
    if (phenotype === "affected") return "aa";
    if (phenotype === "carrier") return "Aa";
    if (phenotype === "normal") {
      // 如果父母都是携带者，正常个体可能是 AA 或 Aa
      if (parents?.father?.genotype === "Aa" && parents?.mother?.genotype === "Aa") {
        return "A_"; // 待定
      }
      return "A_"; // 默认待定
    }
  }

  // 常染色体显性遗传（AD）
  if (inheritanceMode === "AD") {
    if (phenotype === "affected") return "A_"; // Aa 或 AA
    if (phenotype === "normal") return "aa";
  }

  // X连锁隐性遗传（XR）
  if (inheritanceMode === "XR") {
    if (gender === "male") {
      if (phenotype === "affected") return "X^a Y";
      if (phenotype === "normal") return "X^A Y";
    } else {
      if (phenotype === "affected") return "X^a X^a";
      if (phenotype === "carrier") return "X^A X^a";
      if (phenotype === "normal") return "X^A X^-"; // 待定
    }
  }

  // X连锁显性遗传（XD）
  if (inheritanceMode === "XD") {
    if (gender === "male") {
      if (phenotype === "affected") return "X^A Y";
      if (phenotype === "normal") return "X^a Y";
    } else {
      if (phenotype === "affected") return "X^A X^-"; // 待定
      if (phenotype === "normal") return "X^a X^a";
    }
  }

  return "?";
}

// 概率计算算法（核心：条件概率）
function calculateCarrierProbability(
  individual: Individual,
  inheritanceMode: InheritanceMode,
  parents?: { father?: Individual; mother?: Individual }
): number | null {
  // 只计算表型正常个体的携带者概率
  if (individual.phenotype !== "normal") return null;

  // 常染色体隐性遗传（AR）
  if (inheritanceMode === "AR") {
    // 如果父母都是 Aa
    if (parents?.father?.genotype === "Aa" && parents?.mother?.genotype === "Aa") {
      // 子代理论比例：AA : Aa : aa = 1 : 2 : 1
      // 表型正常（排除 aa）：AA : Aa = 1 : 2
      // 所以 P(Aa | 正常) = 2/3
      return 2 / 3;
    }
    // 如果一方是 Aa，一方是 AA
    if (
      (parents?.father?.genotype === "Aa" && parents?.mother?.genotype === "AA") ||
      (parents?.father?.genotype === "AA" && parents?.mother?.genotype === "Aa")
    ) {
      // 子代：AA : Aa = 1 : 1
      return 1 / 2;
    }
  }

  // X连锁隐性遗传（XR）
  if (inheritanceMode === "XR" && individual.gender === "female") {
    // 如果父亲正常（X^A Y），母亲是携带者（X^A X^a）
    if (parents?.father?.genotype === "X^A Y" && parents?.mother?.genotype === "X^A X^a") {
      // 女儿：X^A X^A : X^A X^a = 1 : 1
      return 1 / 2;
    }
  }

  return null;
}

function getAllIndividuals(gens: Generation[]): Individual[] {
  return gens.flatMap((g) => g.individuals);
}

function getStats(gens: Generation[]) {
  const all = getAllIndividuals(gens);
  return {
    total: all.length,
    male: all.filter((i) => i.gender === "male").length,
    female: all.filter((i) => i.gender === "female").length,
    affected: all.filter((i) => i.phenotype === "affected").length,
    carriers: all.filter((i) => i.phenotype === "carrier").length,
    normal: all.filter((i) => i.phenotype === "normal").length,
    probands: all.filter((i) => i.isProband).length,
    deceased: all.filter((i) => i.isDeceased).length,
  };
}

interface ChildGroup { fatherId: string; motherId: string; childIds: string[]; }

function groupChildrenByParents(gens: Generation[]): ChildGroup[] {
  const map = new Map<string, ChildGroup>();
  for (const child of getAllIndividuals(gens)) {
    const fId = child.parents?.father;
    const mId = child.parents?.mother;
    if (fId && mId) {
      const key = `${fId}-${mId}`;
      if (!map.has(key)) map.set(key, { fatherId: fId, motherId: mId, childIds: [] });
      map.get(key)!.childIds.push(child.id);
    }
  }
  return Array.from(map.values());
}

const ROW_H = 120;
const IND_GAP = 90;
const SYM = 18;

export function PedigreeChart({ node }: { node: A2UINode }) {
  const props = node.properties ?? {};
  const initTrait = parseStr(props.trait, "");
  const initMode = parseStr(props.inheritanceMode, "unknown") as InheritanceMode;
  const initGens = parseGenerations(parseStr(props.generations, ""));

  // 新增：概率显示开关
  const initShowProb = props.showProbabilities === true || props.showProbabilities === "true";
  // 新增：口诀显示开关
  const initShowMnemonics = props.showMnemonics === true || props.showMnemonics === "true";

  const [trait, setTrait] = useState(initTrait);
  const [inheritanceMode, setInheritanceMode] = useState(initMode);
  const [generations, setGenerations] = useState(initGens);
  const [selected, setSelected] = useState<Individual | null>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [showGenotype, setShowGenotype] = useState(false);
  const [showProbabilities, setShowProbabilities] = useState(initShowProb);
  const [showMnemonics, setShowMnemonics] = useState(initShowMnemonics);

  useEffect(() => { setTrait(initTrait); }, [initTrait]);
  useEffect(() => { setInheritanceMode(initMode); }, [initMode]);
  useEffect(() => { setGenerations(initGens); setSelected(null); }, [initGens]);
  useEffect(() => { setShowProbabilities(initShowProb); }, [initShowProb]);
  useEffect(() => { setShowMnemonics(initShowMnemonics); }, [initShowMnemonics]);

  const containerRef = useRef<HTMLDivElement>(null);
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });
  const panOffset = useRef({ x: 0, y: 0 });

  const indMap = new Map<string, Individual>();
  getAllIndividuals(generations).forEach((ind) => indMap.set(ind.id, ind));

  const positions = new Map<string, { x: number; y: number }>();
  generations.forEach((gen, gi) => {
    const gap = Math.max(IND_GAP, Math.min(120, Math.floor(560 / Math.max(gen.individuals.length, 1))));
    const totalW = (gen.individuals.length - 1) * gap;
    gen.individuals.forEach((ind, ii) => {
      positions.set(ind.id, {
        x: 300 - totalW / 2 + ii * gap,
        y: 40 + gi * ROW_H,
      });
    });
  });

  const buildConnectionElements = useCallback(() => {
    const elements: JSX.Element[] = [];
    const groups = groupChildrenByParents(generations);

    const drawnSpouse = new Set<string>();
    for (const ind of getAllIndividuals(generations)) {
      if (!ind.spouseId) continue;
      const key = [ind.id, ind.spouseId].sort().join("-");
      if (drawnSpouse.has(key)) continue;
      drawnSpouse.add(key);
      const p1 = positions.get(ind.id);
      const p2 = positions.get(ind.spouseId);
      if (!p1 || !p2) continue;

      // 近亲婚配：双横线（教材规范）
      if (ind.matingType === "consanguineous") {
        const offset = 2;
        elements.push(
          <g key={`spouse-${key}`}>
            <line
              x1={p1.x} y1={p1.y - offset} x2={p2.x} y2={p2.y - offset}
              stroke="#ef4444"
              strokeWidth={1.5}
            />
            <line
              x1={p1.x} y1={p1.y + offset} x2={p2.x} y2={p2.y + offset}
              stroke="#ef4444"
              strokeWidth={1.5}
            />
          </g>
        );
      } else {
        elements.push(
          <line
            key={`spouse-${key}`}
            x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
            stroke="#182544"
            strokeWidth={1.5}
            strokeDasharray={ind.matingType === "divorced" || ind.matingType === "separated" ? "6 3" : undefined}
          />
        );
      }
    }

    for (const group of groups) {
      const fp = positions.get(group.fatherId);
      const mp = positions.get(group.motherId);
      if (!fp || !mp) continue;

      const spouseKey = [group.fatherId, group.motherId].sort().join("-");
      if (!drawnSpouse.has(spouseKey)) {
        elements.push(
          <line
            key={`spouse-${spouseKey}`}
            x1={fp.x} y1={fp.y} x2={mp.x} y2={mp.y}
            stroke="#182544"
            strokeWidth={1.5}
          />
        );
        drawnSpouse.add(spouseKey);
      }

      const midX = (fp.x + mp.x) / 2;
      const midY = fp.y + SYM;
      const sibY = fp.y + ROW_H * 0.55;

      elements.push(
        <line
          key={`vl-${group.fatherId}-${group.motherId}`}
          x1={midX} y1={midY} x2={midX} y2={sibY}
          stroke="#182544"
          strokeWidth={1.5}
        />
      );

      const childPositions = group.childIds
        .map((cid) => positions.get(cid))
        .filter(Boolean) as { x: number; y: number }[];

      if (childPositions.length > 0) {
        const leftX = Math.min(...childPositions.map((c) => c.x));
        const rightX = Math.max(...childPositions.map((c) => c.x));
        elements.push(
          <line
            key={`hl-${group.fatherId}-${group.motherId}`}
            x1={Math.min(midX, leftX)} y1={sibY} x2={Math.max(midX, rightX)} y2={sibY}
            stroke="#182544"
            strokeWidth={1.5}
          />
        );

        for (const cp of childPositions) {
          elements.push(
            <line
              key={`cl-${cp.x}-${cp.y}`}
              x1={cp.x} y1={sibY} x2={cp.x} y2={cp.y - SYM}
              stroke="#182544"
              strokeWidth={1.5}
            />
          );
        }
      }
    }
    return elements;
  }, [generations]);

  const connectionElements = buildConnectionElements();

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setScale((s) => Math.max(0.3, Math.min(3, s * (e.deltaY < 0 ? 1.1 : 0.9))));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    isPanning.current = true;
    panStart.current = { x: e.clientX, y: e.clientY };
    panOffset.current = { ...offset };
  }, [offset]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning.current) return;
    setOffset({
      x: panOffset.current.x + (e.clientX - panStart.current.x),
      y: panOffset.current.y + (e.clientY - panStart.current.y),
    });
  }, []);

  const handleMouseUp = useCallback(() => {
    isPanning.current = false;
  }, []);

  const stats = getStats(generations);

  const btnStyle = (active: boolean): React.CSSProperties => ({
    border: "1px solid",
    borderColor: active ? "#182544" : "#d1d5db",
    background: active ? "#182544" : "#fff",
    color: active ? "#fff" : "#182544",
    borderRadius: 8,
    padding: "6px 12px",
    fontSize: 12,
    cursor: "pointer",
    fontFamily: "Manrope, sans-serif",
  });

  return (
    <div style={{ background: "#faf9f5", borderRadius: 12, padding: 16, fontFamily: "Manrope, sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div>
          <span style={{ fontSize: 16, fontWeight: 700, color: "#182544" }}>
            {trait || "家系图"}
          </span>
          {inheritanceMode !== "unknown" && (
            <span style={{
              marginLeft: 8,
              fontSize: 11,
              fontWeight: 600,
              padding: "3px 8px",
              borderRadius: 4,
              background: "#182544",
              color: "#fff",
            }}>
              {MODE_LABELS[inheritanceMode] || inheritanceMode}
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          <button style={btnStyle(false)} onClick={() => setScale((s) => Math.min(3, s * 1.2))}>+</button>
          <span style={{ fontSize: 11, color: "#6b7280", alignSelf: "center", minWidth: 36, textAlign: "center" }}>{Math.round(scale * 100)}%</span>
          <button style={btnStyle(false)} onClick={() => setScale((s) => Math.max(0.3, s * 0.8))}>-</button>
          <button style={btnStyle(false)} onClick={() => { setScale(1); setOffset({ x: 0, y: 0 }); }}>O</button>
          <button style={btnStyle(showGenotype)} onClick={() => setShowGenotype((g) => !g)}>基因型</button>
          <button style={btnStyle(showProbabilities)} onClick={() => setShowProbabilities((p) => !p)}>概率</button>
          <button style={btnStyle(showMnemonics)} onClick={() => setShowMnemonics((m) => !m)}>口诀</button>
        </div>
      </div>

      {/* 性状说明卡片 - 教材规范 */}
      {trait && inheritanceMode !== "unknown" && (
        <div style={{
          background: "#fff",
          borderRadius: 8,
          padding: 12,
          marginBottom: 10,
          border: "1px solid #e5e7eb"
        }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#182544", marginBottom: 6 }}>
            性状说明
          </div>
          <div style={{ fontSize: 11, color: "#6b7280", lineHeight: 1.6 }}>
            <div style={{ marginBottom: 4 }}>
              <strong style={{ color: "#182544" }}>性状：</strong>{trait}（{MODE_LABELS[inheritanceMode]}）
            </div>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <svg width={16} height={16}>
                  <rect x={0} y={0} width={16} height={16} fill="#182544" stroke="#182544" strokeWidth={1.5} />
                </svg>
                <span>■/● = 患者</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <svg width={16} height={16}>
                  <circle cx={8} cy={8} r={7} fill="#fff" stroke="#182544" strokeWidth={1.5} />
                  <circle cx={8} cy={8} r={3.5} fill="#775a19" />
                </svg>
                <span>⊙ = 携带者（杂合子）</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <svg width={16} height={16}>
                  <rect x={0} y={0} width={16} height={16} fill="#fff" stroke="#182544" strokeWidth={1.5} />
                </svg>
                <span>□/○ = 正常</span>
              </div>
            </div>
            {inheritanceMode === "AR" && (
              <div style={{ marginTop: 6, fontSize: 10, color: "#775a19" }}>
                💡 基因型：AA/Aa = 正常，aa = 患者，Aa = 携带者
              </div>
            )}
            {inheritanceMode === "AD" && (
              <div style={{ marginTop: 6, fontSize: 10, color: "#775a19" }}>
                💡 基因型：AA/Aa = 患者，aa = 正常
              </div>
            )}
            {inheritanceMode === "XR" && (
              <div style={{ marginTop: 6, fontSize: 10, color: "#775a19" }}>
                💡 基因型：X^A X^A / X^A X^a / X^A Y = 正常，X^a X^a / X^a Y = 患者，X^A X^a = 女性携带者
              </div>
            )}
            {inheritanceMode === "XD" && (
              <div style={{ marginTop: 6, fontSize: 10, color: "#775a19" }}>
                💡 基因型：X^A X^A / X^A X^a / X^A Y = 患者，X^a X^a / X^a Y = 正常
              </div>
            )}
          </div>
        </div>
      )}

      <div
        ref={containerRef}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{
          background: "#fff",
          borderRadius: 8,
          border: "1px solid #e5e7eb",
          overflow: "hidden",
          cursor: isPanning.current ? "grabbing" : "grab",
          height: ROW_H * generations.length + 80,
          position: "relative",
        }}
      >
        <div style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`, transformOrigin: "center top", transition: "transform 0.1s ease" }}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none" }}
          >
            {connectionElements}
          </svg>

          {generations.map((gen, gi) => (
            <div key={gi} style={{ display: "flex", alignItems: "center", marginBottom: 4 }}>
              <div style={{ width: 60, fontSize: 11, color: "#9ca3af", fontWeight: 600, textAlign: "right", paddingRight: 8 }}>
                {toRoman(gi + 1)}
              </div>
              <div style={{ display: "flex", gap: 0 }}>
                {gen.individuals.map((ind) => {
                  const isSelected = selected?.id === ind.id;

                  // 获取父母信息用于基因型推断和概率计算
                  const father = ind.parents?.father ? indMap.get(ind.parents.father) : undefined;
                  const mother = ind.parents?.mother ? indMap.get(ind.parents.mother) : undefined;

                  // 推断基因型（如果没有提供）
                  const displayGenotype = ind.genotype || inferGenotype(
                    ind.phenotype,
                    ind.gender,
                    inheritanceMode,
                    { father, mother }
                  );

                  // 计算概率
                  const probability = calculateCarrierProbability(ind, inheritanceMode, { father, mother });

                  return (
                    <div
                      key={ind.id}
                      onClick={() => setSelected(isSelected ? null : ind)}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        width: IND_GAP,
                        cursor: "pointer",
                        position: "relative",
                      }}
                    >
                      {/* 先证者标记：向上箭头（教材规范） */}
                      {ind.isProband && (
                        <div style={{
                          position: "absolute",
                          bottom: -12,
                          left: "50%",
                          transform: "translateX(-50%)",
                          fontSize: 14,
                          color: "#3b82f6",
                          fontWeight: "bold"
                        }}>↑</div>
                      )}
                      <svg width={SYM * 2} height={SYM * 2} style={{ overflow: "visible" }}>
                        {ind.gender === "male" ? (
                          <rect
                            x={0} y={0} width={SYM * 2} height={SYM * 2}
                            fill={ind.phenotype === "affected" ? "#182544" : "#fff"}
                            stroke={isSelected ? "#3b82f6" : "#182544"}
                            strokeWidth={isSelected ? 2.5 : 1.5}
                            rx={ind.isAdopted ? 3 : 0}
                            strokeDasharray={ind.isDeceased ? "4 2" : ind.isMiscarriage ? "2 2" : undefined}
                          />
                        ) : (
                          <circle
                            cx={SYM} cy={SYM} r={SYM}
                            fill={ind.phenotype === "affected" ? "#182544" : "#fff"}
                            stroke={isSelected ? "#3b82f6" : "#182544"}
                            strokeWidth={isSelected ? 2.5 : 1.5}
                            strokeDasharray={ind.isDeceased ? "4 2" : ind.isMiscarriage ? "2 2" : undefined}
                          />
                        )}
                        {/* 携带者符号：中心实心点（教材规范） */}
                        {ind.phenotype === "carrier" && (
                          <circle cx={SYM} cy={SYM} r={5} fill="#775a19" />
                        )}
                        {ind.phenotype === "uncertain" && (
                          <text x={SYM} y={SYM + 4} textAnchor="middle" fontSize={12} fill="#182544">?</text>
                        )}
                        {/* 已故标记：斜杠（教材规范） */}
                        {ind.isDeceased && (
                          <line x1={-2} y1={SYM * 2 + 2} x2={SYM * 2 + 2} y2={-2} stroke="#6b7280" strokeWidth={1.5} />
                        )}
                      </svg>
                      {ind.label && (
                        <div style={{ fontSize: 10, color: "#6b7280", marginTop: 2 }}>{ind.label}</div>
                      )}
                      {ind.age && (
                        <div style={{ fontSize: 9, color: "#9ca3af" }}>{ind.age}</div>
                      )}
                      {/* 基因型显示 - 增强版 */}
                      {showGenotype && displayGenotype && (
                        <div style={{
                          fontSize: 10,
                          color: displayGenotype.includes("_") || displayGenotype.includes("-") ? "#9ca3af" : "#775a19",
                          fontFamily: "monospace",
                          fontWeight: 600,
                          marginTop: 2,
                          background: displayGenotype.includes("_") || displayGenotype.includes("-") ? "#f3f4f6" : "transparent",
                          padding: displayGenotype.includes("_") || displayGenotype.includes("-") ? "1px 4px" : "0",
                          borderRadius: 3
                        }}>
                          {displayGenotype}
                        </div>
                      )}
                      {/* 概率显示 - 新增功能 */}
                      {showProbabilities && probability !== null && (
                        <div style={{
                          fontSize: 9,
                          color: "#ef4444",
                          fontWeight: 600,
                          marginTop: 2
                        }}>
                          ({probability === 2/3 ? "2/3" : probability === 1/2 ? "1/2" : probability.toFixed(2)})
                        </div>
                      )}
                      {ind.count && ind.count > 1 && (
                        <div style={{ fontSize: 10, fontWeight: 600, color: "#182544" }}>{ind.count}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
        {[
          { l: "总人数", v: stats.total },
          { l: "男", v: stats.male },
          { l: "女", v: stats.female },
          { l: "患病", v: stats.affected },
          { l: "携带者", v: stats.carriers },
          { l: "正常", v: stats.normal },
          ...(stats.probands > 0 ? [{ l: "先证者", v: stats.probands }] : []),
          ...(stats.deceased > 0 ? [{ l: "已故", v: stats.deceased }] : []),
        ].map((s) => (
          <div key={s.l} style={{ textAlign: "center", flex: "1 1 60px", minWidth: 60, padding: "6px 4px", background: "#fff", borderRadius: 6, border: "1px solid #e5e7eb" }}>
            <div style={{ fontSize: 10, color: "#6b7280" }}>{s.l}</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: "#182544" }}>{s.v}</div>
          </div>
        ))}
      </div>

      {/* 图例面板 - 教材规范符号 */}
      <div style={{ marginTop: 10, padding: 12, background: "#fff", borderRadius: 8, border: "1px solid #e5e7eb" }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "#182544", marginBottom: 8 }}>符号图例</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
          {/* 基础符号 */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <svg width={20} height={20}><rect x={2} y={2} width={16} height={16} fill="#fff" stroke="#182544" strokeWidth={1.5} /></svg>
            <span style={{ fontSize: 11, color: "#6b7280" }}>正常男性</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <svg width={20} height={20}><circle cx={10} cy={10} r={8} fill="#fff" stroke="#182544" strokeWidth={1.5} /></svg>
            <span style={{ fontSize: 11, color: "#6b7280" }}>正常女性</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <svg width={20} height={20}><rect x={2} y={2} width={16} height={16} fill="#182544" stroke="#182544" strokeWidth={1.5} /></svg>
            <span style={{ fontSize: 11, color: "#6b7280" }}>患病男性</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <svg width={20} height={20}><circle cx={10} cy={10} r={8} fill="#182544" stroke="#182544" strokeWidth={1.5} /></svg>
            <span style={{ fontSize: 11, color: "#6b7280" }}>患病女性</span>
          </div>

          {/* 携带者符号 */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <svg width={20} height={20}>
              <circle cx={10} cy={10} r={8} fill="#fff" stroke="#182544" strokeWidth={1.5} />
              <circle cx={10} cy={10} r={4} fill="#775a19" />
            </svg>
            <span style={{ fontSize: 11, color: "#6b7280" }}>携带者（⊙）</span>
          </div>

          {/* 先证者标记 */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ position: "relative", width: 20, height: 20 }}>
              <svg width={20} height={16} style={{ position: "absolute", top: 4 }}>
                <rect x={2} y={0} width={16} height={16} fill="#182544" stroke="#182544" strokeWidth={1.5} />
              </svg>
              <div style={{ position: "absolute", bottom: -2, left: "50%", transform: "translateX(-50%)", fontSize: 12, color: "#3b82f6", fontWeight: "bold" }}>↑</div>
            </div>
            <span style={{ fontSize: 11, color: "#6b7280" }}>先证者</span>
          </div>

          {/* 已故标记 */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <svg width={20} height={20}>
              <rect x={2} y={2} width={16} height={16} fill="#fff" stroke="#182544" strokeWidth={1.5} />
              <line x1={1} y1={19} x2={19} y2={1} stroke="#6b7280" strokeWidth={1.5} />
            </svg>
            <span style={{ fontSize: 11, color: "#6b7280" }}>已故</span>
          </div>

          {/* 关系连线 */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 24, height: 2, background: "#182544" }} />
            <span style={{ fontSize: 11, color: "#6b7280" }}>婚配关系</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ position: "relative", width: 24, height: 8 }}>
              <div style={{ position: "absolute", top: 2, width: 24, height: 1.5, background: "#ef4444" }} />
              <div style={{ position: "absolute", top: 5, width: 24, height: 1.5, background: "#ef4444" }} />
            </div>
            <span style={{ fontSize: 11, color: "#6b7280" }}>近亲婚配</span>
          </div>
        </div>
      </div>

      {/* 解题口诀卡片 - 教学辅助 */}
      {showMnemonics && (
        <div style={{ marginTop: 10, padding: 12, background: "#fff", borderRadius: 8, border: "1px solid #e5e7eb" }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#182544", marginBottom: 8 }}>💡 解题口诀</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {/* 隐性遗传口诀 */}
            <div style={{ padding: 10, background: "#fef3c7", borderRadius: 6, borderLeft: "3px solid #f59e0b" }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#92400e", marginBottom: 4 }}>隐性遗传判断</div>
              <div style={{ fontSize: 10, color: "#78350f", lineHeight: 1.6 }}>
                <div>• <strong>无中生有为隐性</strong>（父母正常，子女患病）</div>
                <div>• <strong>隐性遗传看女病</strong>（看女性患者）</div>
                <div>• <strong>女病男正非伴性</strong>（女病父正 → 常染色体）</div>
              </div>
            </div>

            {/* 显性遗传口诀 */}
            <div style={{ padding: 10, background: "#dbeafe", borderRadius: 6, borderLeft: "3px solid #3b82f6" }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#1e40af", marginBottom: 4 }}>显性遗传判断</div>
              <div style={{ fontSize: 10, color: "#1e3a8a", lineHeight: 1.6 }}>
                <div>• <strong>有中生无为显性</strong>（父母患病，子女正常）</div>
                <div>• <strong>显性遗传看男病</strong>（看男性患者）</div>
                <div>• <strong>男病女正非伴性</strong>（男病母正 → 常染色体）</div>
              </div>
            </div>

            {/* 概率计算口诀 */}
            <div style={{ padding: 10, background: "#fee2e2", borderRadius: 6, borderLeft: "3px solid #ef4444" }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#991b1b", marginBottom: 4 }}>概率计算要点</div>
              <div style={{ fontSize: 10, color: "#7f1d1d", lineHeight: 1.6 }}>
                <div>• <strong>表型正常时，Aa 概率为 2/3</strong></div>
                <div>• 原理：Aa × Aa → AA:Aa:aa = 1:2:1</div>
                <div>• 排除 aa 后：AA:Aa = 1:2，所以 P(Aa) = 2/3</div>
                <div style={{ marginTop: 4, color: "#ef4444", fontWeight: 600 }}>
                  ⚠️ 常见错误：忽略"表型正常"前提，误写为 1/2
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {selected && (
        <>
          <div onClick={() => setSelected(null)} style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", zIndex: 999 }} />
          <div style={{
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            background: "#fff",
            borderRadius: 12,
            padding: 20,
            boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)",
            zIndex: 1000,
            minWidth: 300,
            maxWidth: 440,
            border: "1px solid #e5e7eb",
            fontFamily: "Manrope, sans-serif",
          }}>
            <button onClick={() => setSelected(null)} style={{ position: "absolute", top: 14, right: 14, background: "none", border: "none", fontSize: 18, color: "#6b7280", cursor: "pointer" }}>×</button>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#182544", marginBottom: 12, paddingBottom: 10, borderBottom: "2px solid #e5e7eb" }}>
              个体详情
            </div>
            <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 2 }}>
              <div><strong style={{ color: "#182544" }}>编号：</strong>{selected.label || selected.id}</div>
              <div><strong style={{ color: "#182544" }}>世代：</strong>第 {toRoman(selected.generation + 1)} 代</div>
              <div><strong style={{ color: "#182544" }}>性别：</strong>{selected.gender === "male" ? "男性" : selected.gender === "female" ? "女性" : "不明"}</div>
              <div><strong style={{ color: "#182544" }}>表型：</strong>{PHENOTYPE_LABELS[selected.phenotype] || selected.phenotype}</div>
              {selected.genotype && <div><strong style={{ color: "#182544" }}>基因型：</strong><code>{selected.genotype}</code></div>}
              {selected.age && <div><strong style={{ color: "#182544" }}>年龄：</strong>{selected.age}</div>}
              {selected.isProband && <div style={{ color: "#3b82f6" }}>先证者 (Proband)</div>}
              {selected.isDeceased && <div>已故{selected.causeOfDeath ? ` - ${selected.causeOfDeath}` : ""}</div>}
              {selected.isAdopted && <div>收养 (Adopted)</div>}
              <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid #e5e7eb", fontSize: 12, color: "#9ca3af" }}>
                {selected.phenotype === "affected"
                  ? "该个体表现出遗传性状，可能从父母一方或双方遗传了致病基因。"
                  : selected.phenotype === "carrier"
                  ? "该个体是携带者，自身不发病但携带致病基因，可能将其传递给后代。"
                  : "该个体表型正常，但仍可能携带隐性致病基因。"}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default PedigreeChart;
