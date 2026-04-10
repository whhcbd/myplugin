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

  const [trait, setTrait] = useState(initTrait);
  const [inheritanceMode, setInheritanceMode] = useState(initMode);
  const [generations, setGenerations] = useState(initGens);
  const [selected, setSelected] = useState<Individual | null>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [showGenotype, setShowGenotype] = useState(false);

  useEffect(() => { setTrait(initTrait); }, [initTrait]);
  useEffect(() => { setInheritanceMode(initMode); }, [initMode]);
  useEffect(() => { setGenerations(initGens); setSelected(null); }, [initGens]);

  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
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

  const drawConnections = useCallback(() => {
    const svg = svgRef.current;
    if (!svg) return;
    while (svg.firstChild) svg.removeChild(svg.firstChild);

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
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", String(p1.x));
      line.setAttribute("y1", String(p1.y));
      line.setAttribute("x2", String(p2.x));
      line.setAttribute("y2", String(p2.y));
      line.setAttribute("stroke", ind.matingType === "consanguineous" ? "#ef4444" : "#182544");
      line.setAttribute("stroke-width", ind.matingType === "consanguineous" ? "2" : "1.5");
      if (ind.matingType === "divorced" || ind.matingType === "separated") {
        line.setAttribute("stroke-dasharray", "6 3");
      }
      svg.appendChild(line);
    }

    for (const group of groups) {
      const fp = positions.get(group.fatherId);
      const mp = positions.get(group.motherId);
      if (!fp || !mp) continue;

      const spouseKey = [group.fatherId, group.motherId].sort().join("-");
      if (!drawnSpouse.has(spouseKey)) {
        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute("x1", String(fp.x));
        line.setAttribute("y1", String(fp.y));
        line.setAttribute("x2", String(mp.x));
        line.setAttribute("y2", String(mp.y));
        line.setAttribute("stroke", "#182544");
        line.setAttribute("stroke-width", "1.5");
        svg.appendChild(line);
        drawnSpouse.add(spouseKey);
      }

      const midX = (fp.x + mp.x) / 2;
      const midY = fp.y + SYM;
      const sibY = fp.y + ROW_H * 0.55;

      const vl = document.createElementNS("http://www.w3.org/2000/svg", "line");
      vl.setAttribute("x1", String(midX));
      vl.setAttribute("y1", String(midY));
      vl.setAttribute("x2", String(midX));
      vl.setAttribute("y2", String(sibY));
      vl.setAttribute("stroke", "#182544");
      vl.setAttribute("stroke-width", "1.5");
      svg.appendChild(vl);

      const childPositions = group.childIds
        .map((cid) => positions.get(cid))
        .filter(Boolean) as { x: number; y: number }[];

      if (childPositions.length > 0) {
        const leftX = Math.min(...childPositions.map((c) => c.x));
        const rightX = Math.max(...childPositions.map((c) => c.x));
        const hl = document.createElementNS("http://www.w3.org/2000/svg", "line");
        hl.setAttribute("x1", String(Math.min(midX, leftX)));
        hl.setAttribute("y1", String(sibY));
        hl.setAttribute("x2", String(Math.max(midX, rightX)));
        hl.setAttribute("y2", String(sibY));
        hl.setAttribute("stroke", "#182544");
        hl.setAttribute("stroke-width", "1.5");
        svg.appendChild(hl);

        for (const cp of childPositions) {
          const cl = document.createElementNS("http://www.w3.org/2000/svg", "line");
          cl.setAttribute("x1", String(cp.x));
          cl.setAttribute("y1", String(sibY));
          cl.setAttribute("x2", String(cp.x));
          cl.setAttribute("y2", String(cp.y - SYM));
          cl.setAttribute("stroke", "#182544");
          cl.setAttribute("stroke-width", "1.5");
          svg.appendChild(cl);
        }
      }
    }
  }, [generations]);

  useEffect(() => {
    requestAnimationFrame(drawConnections);
  }, [drawConnections, scale, offset]);

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
        </div>
      </div>

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
            ref={svgRef}
            xmlns="http://www.w3.org/2000/svg"
            style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none" }}
          />

          {generations.map((gen, gi) => (
            <div key={gi} style={{ display: "flex", alignItems: "center", marginBottom: 4 }}>
              <div style={{ width: 60, fontSize: 11, color: "#9ca3af", fontWeight: 600, textAlign: "right", paddingRight: 8 }}>
                {toRoman(gi + 1)}
              </div>
              <div style={{ display: "flex", gap: 0 }}>
                {gen.individuals.map((ind) => {
                  const isSelected = selected?.id === ind.id;
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
                      {ind.isProband && (
                        <div style={{ width: 0, height: 0, borderLeft: "5px solid transparent", borderRight: "5px solid transparent", borderBottom: "8px solid #3b82f6", marginBottom: 2 }} />
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
                        {ind.phenotype === "carrier" && (
                          <circle cx={SYM} cy={SYM} r={4} fill="#182544" />
                        )}
                        {ind.phenotype === "uncertain" && (
                          <text x={SYM} y={SYM + 4} textAnchor="middle" fontSize={12} fill="#182544">?</text>
                        )}
                        {ind.isDeceased && (
                          <line x1={-2} y1={SYM * 2 + 2} x2={SYM * 2 + 2} y2={-2} stroke="#182544" strokeWidth={1} />
                        )}
                      </svg>
                      {ind.label && (
                        <div style={{ fontSize: 10, color: "#6b7280", marginTop: 2 }}>{ind.label}</div>
                      )}
                      {ind.age && (
                        <div style={{ fontSize: 9, color: "#9ca3af" }}>{ind.age}</div>
                      )}
                      {showGenotype && (
                        <div style={{ fontSize: 9, color: "#775a19", fontFamily: "monospace" }}>{ind.genotype || "?"}</div>
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

      <div style={{ marginTop: 10, padding: 10, background: "#fff", borderRadius: 6, border: "1px solid #e5e7eb", display: "flex", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <svg width={18} height={18}><rect x={1} y={1} width={16} height={16} fill="#fff" stroke="#182544" strokeWidth={1.5} /></svg>
          <span style={{ fontSize: 11, color: "#6b7280" }}>正常男性</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <svg width={18} height={18}><circle cx={9} cy={9} r={8} fill="#fff" stroke="#182544" strokeWidth={1.5} /></svg>
          <span style={{ fontSize: 11, color: "#6b7280" }}>正常女性</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <svg width={18} height={18}><rect x={1} y={1} width={16} height={16} fill="#182544" stroke="#182544" strokeWidth={1.5} /></svg>
          <span style={{ fontSize: 11, color: "#6b7280" }}>患病</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <svg width={18} height={18}><circle cx={9} cy={9} r={8} fill="#fff" stroke="#182544" strokeWidth={1.5} /><circle cx={9} cy={9} r={3} fill="#182544" /></svg>
          <span style={{ fontSize: 11, color: "#6b7280" }}>携带者</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 20, height: 0, borderTop: "1.5px solid #182544" }} />
          <span style={{ fontSize: 11, color: "#6b7280" }}>配偶/亲子</span>
        </div>
      </div>

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
