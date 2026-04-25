import { useState, useEffect, useCallback, useRef } from "react";

interface A2UINode {
  properties?: Record<string, unknown>;
}

function parseStr(val: unknown, fallback: string): string {
  return typeof val === "string" && val.length > 0 ? val : fallback;
}

function parseBool(val: unknown, fallback: boolean): boolean {
  return typeof val === "boolean" ? val : fallback;
}

function parseNum(val: unknown, fallback: number): number {
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}

function parseArr<T>(val: unknown): T[] {
  return Array.isArray(val) ? val : [];
}

function parseObj<T>(val: unknown, fallback: T): T {
  return val && typeof val === "object" && !Array.isArray(val) ? (val as T) : fallback;
}

interface TraitDefinition {
  name: string;
  dominantTrait: string;
  recessiveTrait: string;
  incompleteDominance?: boolean;
  intermediateTrait?: string;
}

interface LinkageInfo {
  isLinked: boolean;
  recombinationFrequency?: number;
}

interface GenotypeData {
  genotype: string;
  phenotype: string;
  phenotypeDetail: string;
}

interface CellInfo {
  row: number;
  col: number;
  genotype: string;
  phenotype: string;
  phenotypeDetail: string;
  parentGamete: string;
  motherGamete: string;
}

const S: Record<string, React.CSSProperties> = {
  container: { background: "#faf9f5", borderRadius: 12, padding: 16, fontFamily: "Manrope, sans-serif", color: "#1b1c1a", maxWidth: 640, lineHeight: 1.6 },
  title: { fontSize: 16, fontWeight: 700, color: "#182544", textAlign: "center" as const, marginBottom: 12 },
  section: { marginTop: 12, padding: 12, background: "#fff", borderRadius: 8, border: "1px solid #e5e7eb" },
  sectionTitle: { fontWeight: 700, color: "#182544", marginBottom: 8, fontSize: 13 },
  row: { display: "flex", gap: 8, flexWrap: "wrap" as const, alignItems: "center" },
  label: { fontSize: 12, color: "#6b7280" },
  mono: { fontFamily: "monospace", fontWeight: 700, color: "#182544", fontSize: 13 },
  badge: { display: "inline-block", padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600 },
  btn: { padding: "6px 16px", borderRadius: 6, border: "none", fontWeight: 600, fontSize: 12, cursor: "pointer", fontFamily: "Manrope, sans-serif", transition: "background 0.2s" },
  btnPrimary: { background: "#182544", color: "#fff" },
  btnSecondary: { background: "#fff", color: "#6b7280", border: "1px solid #e5e7eb" },
  tipBox: { padding: "8px 12px", borderRadius: 6, fontSize: 12, lineHeight: 1.7 },
  tipInfo: { background: "#eff6ff", border: "1px solid #bfdbfe", color: "#1e40af" },
  tipWarn: { background: "#fef3c7", border: "1px solid #fde68a", color: "#92400e" },
  tipScope: { background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#166534" },
};

function getGametes(genotype: string): string[] {
  if (!genotype || genotype.length === 0 || genotype.length % 2 !== 0) return [];
  const genePairs: string[][] = [];
  for (let i = 0; i < genotype.length; i += 2) {
    genePairs.push([genotype[i], genotype[i + 1]]);
  }
  return cartesianProduct(genePairs).map((g) => g.join(""));
}

function cartesianProduct(arrays: string[][]): string[][] {
  if (arrays.length === 0) return [[]];
  if (arrays.length === 1) return arrays[0].map((x) => [x]);
  const [first, ...rest] = arrays;
  const restProduct = cartesianProduct(rest);
  const result: string[][] = [];
  for (const item of first) {
    for (const combo of restProduct) {
      result.push([item, ...combo]);
    }
  }
  return result;
}

function combineGametes(g1: string, g2: string): string {
  if (g1.length !== g2.length) return g1 + g2;
  let result = "";
  for (let i = 0; i < g1.length; i++) {
    const pair = [g1[i], g2[i]].sort((a, b) => {
      if (a === a.toUpperCase() && b === b.toLowerCase()) return -1;
      if (a === a.toLowerCase() && b === b.toUpperCase()) return 1;
      return a.localeCompare(b);
    });
    result += pair.join("");
  }
  return result;
}

function determinePhenotype(genotype: string, traitDefs: TraitDefinition[]): { code: string; display: string } {
  if (traitDefs.length > 0) {
    return determinePhenotypeWithTraits(genotype, traitDefs);
  }
  const geneCount = genotype.length / 2;
  if (geneCount === 1) {
    const allUpper = genotype === genotype.toUpperCase();
    const allLower = genotype === genotype.toLowerCase();
    if (allUpper) return { code: "dominant", display: "显性纯合" };
    if (allLower) return { code: "recessive", display: "隐性纯合" };
    return { code: "heterozygous", display: "杂合" };
  }
  const parts: string[] = [];
  const displays: string[] = [];
  for (let i = 0; i < genotype.length; i += 2) {
    const pair = genotype.slice(i, i + 2);
    const hasUpper = pair.split("").some((ch) => ch === ch.toUpperCase() && ch !== ch.toLowerCase());
    const allLower = pair === pair.toLowerCase();
    const allUpper = pair === pair.toUpperCase();
    if (allUpper) { parts.push("显"); displays.push("显性纯合"); }
    else if (allLower) { parts.push("隐"); displays.push("隐性纯合"); }
    else { parts.push("杂"); displays.push("杂合"); }
  }
  return { code: parts.join(""), display: displays.join("-") };
}

function determinePhenotypeWithTraits(genotype: string, traitDefs: TraitDefinition[]): { code: string; display: string } {
  const parts: string[] = [];
  for (let i = 0; i < genotype.length && i / 2 < traitDefs.length; i += 2) {
    const pair = genotype.slice(i, i + 2);
    const trait = traitDefs[i / 2];
    const upperCount = (pair.match(/[A-Z]/g) || []).length;
    if (trait.incompleteDominance) {
      if (upperCount === 2) parts.push(trait.dominantTrait);
      else if (upperCount === 1) parts.push(trait.intermediateTrait || "中间型");
      else parts.push(trait.recessiveTrait);
    } else {
      parts.push(upperCount >= 1 ? trait.dominantTrait : trait.recessiveTrait);
    }
  }
  const display = parts.join("-");
  return { code: display, display };
}

function calculateOffspring(parent1: string, parent2: string, traitDefs: TraitDefinition[]): GenotypeData[] {
  const gametes1 = getGametes(parent1);
  const gametes2 = getGametes(parent2);
  if (gametes1.length === 0 || gametes2.length === 0) return [];
  const offspring: GenotypeData[] = [];
  for (const g1 of gametes1) {
    for (const g2 of gametes2) {
      const genotype = combineGametes(g1, g2);
      const { code, display } = determinePhenotype(genotype, traitDefs);
      offspring.push({ genotype, phenotype: code, phenotypeDetail: display });
    }
  }
  return offspring;
}

function getPhenotypeRatios(offspring: GenotypeData[]): Map<string, number> {
  const ratios = new Map<string, number>();
  for (const item of offspring) {
    ratios.set(item.phenotype, (ratios.get(item.phenotype) || 0) + 1);
  }
  return ratios;
}

function getGenotypeRatios(offspring: GenotypeData[]): Map<string, number> {
  const ratios = new Map<string, number>();
  for (const item of offspring) {
    ratios.set(item.genotype, (ratios.get(item.genotype) || 0) + 1);
  }
  return ratios;
}

function getPhenotypeDisplayName(phenotype: string, traitDefs: TraitDefinition[]): string {
  if (traitDefs.length > 0) return phenotype;
  const labels: Record<string, string> = {
    dominant: "显性性状", recessive: "隐性性状", heterozygous: "显性性状（杂合）",
  };
  return labels[phenotype] || phenotype;
}

function getPhenotypeColor(code: string): string {
  if (code === "dominant" || code === "显" || code.includes("显") && !code.includes("隐") && !code.includes("杂")) return "#10b981";
  if (code === "recessive" || code === "隐") return "#ef4444";
  if (code === "heterozygous" || code === "杂") return "#f59e0b";
  if (code.includes("隐") && !code.includes("显") && !code.includes("杂")) return "#ef4444";
  if (code.includes("杂")) return "#f59e0b";
  return "#6366f1";
}

function getPhenotypeBg(code: string): string {
  const c = getPhenotypeColor(code);
  return c + "18";
}

function getCellExplanation(cell: CellInfo, traitDefs: TraitDefinition[], total: number, parent1: string, parent2: string): string {
  const phenoDisplay = traitDefs.length > 0 ? cell.phenotype : getPhenotypeDisplayName(cell.phenotype, traitDefs);
  const prob = (1 / total * 100).toFixed(1);
  const geneCount = parent1.length / 2;

  let explanation = `父本配子 [${cell.parentGamete}] × 母本配子 [${cell.motherGamete}] → 基因型 ${cell.genotype}`;
  explanation += `\n\n出现概率：1/${total} = ${prob}%`;

  if (geneCount === 1) {
    if (cell.genotype === cell.genotype.toUpperCase()) {
      explanation += `\n\n纯合显性：两个等位基因均为显性（${cell.genotype}），表现为${phenoDisplay}。`;
    } else if (cell.genotype === cell.genotype.toLowerCase()) {
      explanation += `\n\n纯合隐性：两个等位基因均为隐性（${cell.genotype}），表现为${phenoDisplay}。`;
    } else {
      explanation += `\n\n杂合子：含一个显性、一个隐性等位基因（${cell.genotype}），显性基因掩盖隐性基因，表现为${phenoDisplay}。`;
    }
  } else {
    explanation += `\n\n表型：${cell.phenotypeDetail}`;
  }
  return explanation;
}

function calculateChiSquare(offspring: GenotypeData[], observedData: number[]): { value: number; df: number; critical: number; accept: boolean; details: { phenotype: string; expected: number; observed: number; contribution: number }[] } | null {
  if (!observedData || observedData.length === 0) return null;
  const phenotypeRatios = getPhenotypeRatios(offspring);
  const phenotypes = Array.from(phenotypeRatios.keys());
  if (observedData.length !== phenotypes.length) return null;

  let chiSquare = 0;
  const details: { phenotype: string; expected: number; observed: number; contribution: number }[] = [];
  phenotypes.forEach((phenotype, index) => {
    const expected = phenotypeRatios.get(phenotype) || 0;
    const observed = observedData[index] || 0;
    const contribution = expected > 0 ? Math.pow(observed - expected, 2) / expected : 0;
    chiSquare += contribution;
    details.push({ phenotype, expected, observed, contribution });
  });

  const df = phenotypes.length - 1;
  const critical = df === 1 ? 3.841 : df === 2 ? 5.991 : df === 3 ? 7.815 : 9.488;
  return { value: chiSquare, df, critical, accept: chiSquare < critical, details };
}

function runSimulation(parent1: string, parent2: string, traitDefs: TraitDefinition[], count: number, onProgress?: (current: number, results: Map<string, number>) => void): Promise<Map<string, number>> {
  return new Promise((resolve) => {
    const gametes1 = getGametes(parent1);
    const gametes2 = getGametes(parent2);
    if (gametes1.length === 0 || gametes2.length === 0) { resolve(new Map()); return; }
    const results = new Map<string, number>();
    let i = 0;
    function batch() {
      const end = Math.min(i + 200, count);
      for (; i < end; i++) {
        const g1 = gametes1[Math.floor(Math.random() * gametes1.length)];
        const g2 = gametes2[Math.floor(Math.random() * gametes2.length)];
        const genotype = combineGametes(g1, g2);
        const { code } = determinePhenotype(genotype, traitDefs);
        results.set(code, (results.get(code) || 0) + 1);
      }
      if (onProgress) onProgress(i, results);
      if (i < count) setTimeout(batch, 0);
      else resolve(results);
    }
    batch();
  });
}

function renderRatioBar(percent: number, color: string) {
  return (
    <div style={{ height: 8, borderRadius: 4, background: "#e5e7eb", overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${percent}%`, borderRadius: 4, background: color, transition: "width 0.5s ease" }} />
    </div>
  );
}

export default function PunnettSquare({ node }: { node: A2UINode }) {
  const props = node.properties ?? {};

  const initP1 = parseStr(props.parent1Genotype, "Aa");
  const initP2 = parseStr(props.parent2Genotype, "Aa");
  const initTrait = parseStr(props.trait, "");
  const initShowPhenotype = parseBool(props.showPhenotype, true);
  const initInteractive = parseBool(props.interactive, true);
  const initTraitDefs = parseArr<TraitDefinition>(props.traitDefinitions);
  const initLinkage = parseObj<LinkageInfo>(props.linkageInfo, { isLinked: false });
  const initObserved = parseArr<number>(props.observedData);
  const initSexLinked = parseBool(props.sexLinked, false);
  const initShowTips = parseBool(props.showTips, true);
  const initFatherLabel = parseStr(props.fatherLabel, "父本");
  const initMotherLabel = parseStr(props.motherLabel, "母本");
  const initFatherPhenotype = parseStr(props.fatherPhenotype, "");
  const initMotherPhenotype = parseStr(props.motherPhenotype, "");

  const [parent1, setParent1] = useState(initP1);
  const [parent2, setParent2] = useState(initP2);
  const [trait, setTrait] = useState(initTrait);
  const [showPhenotype, setShowPhenotype] = useState(initShowPhenotype);
  const [interactive, setInteractive] = useState(initInteractive);
  const [traitDefs, setTraitDefs] = useState(initTraitDefs);
  const [linkageInfo, setLinkageInfo] = useState(initLinkage);
  const [observedData, setObservedData] = useState(initObserved);
  const [sexLinked, setSexLinked] = useState(initSexLinked);
  const [showTips, setShowTips] = useState(initShowTips);
  const [fatherLabel, setFatherLabel] = useState(initFatherLabel);
  const [motherLabel, setMotherLabel] = useState(initMotherLabel);
  const [fatherPhenotype, setFatherPhenotype] = useState(initFatherPhenotype);
  const [motherPhenotype, setMotherPhenotype] = useState(initMotherPhenotype);
  const [selectedCell, setSelectedCell] = useState<CellInfo | null>(null);
  const [simResults, setSimResults] = useState<Map<string, number> | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [simCount, setSimCount] = useState(1000);
  const [simProgress, setSimProgress] = useState(0);
  const cancelRef = useRef(false);

  useEffect(() => { setParent1(initP1); setSelectedCell(null); setSimResults(null); }, [initP1]);
  useEffect(() => { setParent2(initP2); setSelectedCell(null); setSimResults(null); }, [initP2]);
  useEffect(() => { setTrait(initTrait); }, [initTrait]);
  useEffect(() => { setShowPhenotype(initShowPhenotype); }, [initShowPhenotype]);
  useEffect(() => { setInteractive(initInteractive); }, [initInteractive]);
  useEffect(() => { setTraitDefs(initTraitDefs); setSelectedCell(null); }, [initTraitDefs]);
  useEffect(() => { setLinkageInfo(initLinkage); }, [initLinkage]);
  useEffect(() => { setObservedData(initObserved); }, [initObserved]);
  useEffect(() => { setSexLinked(initSexLinked); }, [initSexLinked]);
  useEffect(() => { setShowTips(initShowTips); }, [initShowTips]);
  useEffect(() => { setFatherLabel(initFatherLabel); }, [initFatherLabel]);
  useEffect(() => { setMotherLabel(initMotherLabel); }, [initMotherLabel]);
  useEffect(() => { setFatherPhenotype(initFatherPhenotype); }, [initFatherPhenotype]);
  useEffect(() => { setMotherPhenotype(initMotherPhenotype); }, [initMotherPhenotype]);

  const handleCellClick = useCallback((item: GenotypeData, row: number, col: number, gametes1: string[], gametes2: string[]) => {
    if (!interactive) return;
    setSelectedCell({
      row, col, genotype: item.genotype, phenotype: item.phenotype, phenotypeDetail: item.phenotypeDetail,
      parentGamete: gametes1[col], motherGamete: gametes2[row],
    });
  }, [interactive]);

  const handleSimulate = useCallback(async () => {
    if (simulating) return;
    setSimulating(true);
    setSimProgress(0);
    cancelRef.current = false;
    const results = await runSimulation(parent1, parent2, traitDefs, simCount, (current) => {
      if (cancelRef.current) return;
      setSimProgress(current);
    });
    if (!cancelRef.current) {
      setSimResults(results);
    }
    setSimulating(false);
    setSimProgress(0);
  }, [simulating, parent1, parent2, traitDefs, simCount]);

  const handleReset = useCallback(() => {
    cancelRef.current = true;
    setSimResults(null);
    setSelectedCell(null);
    setSimulating(false);
    setSimProgress(0);
  }, []);

  const offspring = calculateOffspring(parent1, parent2, traitDefs);
  const gametes1 = getGametes(parent1);
  const gametes2 = getGametes(parent2);

  if (offspring.length === 0) {
    return (
      <div style={{ background: "#faf9f5", borderRadius: 12, padding: 24, textAlign: "center", color: "#6b7280", fontFamily: "Manrope, sans-serif", fontStyle: "italic" }}>
        请输入有效的基因型（例如：Aa, AaBb）
      </div>
    );
  }

  const phenotypeRatios = getPhenotypeRatios(offspring);
  const genotypeRatios = getGenotypeRatios(offspring);
  const geneCount = parent1.length / 2;
  const isTwoGene = geneCount === 2;
  const chiSquareResult = calculateChiSquare(offspring, observedData);
  const sortedGenotypes = Array.from(genotypeRatios.entries()).sort((a, b) => b[1] - a[1]);
  const sortedPhenotypes = Array.from(phenotypeRatios.entries()).sort((a, b) => b[1] - a[1]);

  const p1Display = fatherPhenotype ? `${parent1}（${fatherPhenotype}）` : parent1;
  const p2Display = motherPhenotype ? `${parent2}（${motherPhenotype}）` : parent2;

  const dominantRule = traitDefs.length > 0
    ? traitDefs.map((t, i) => {
      const letter = String.fromCharCode(65 + i);
      const rule = t.incompleteDominance
        ? `${letter}${letter}=${t.dominantTrait}，${letter}${letter.toLowerCase()}=${t.intermediateTrait || "中间型"}，${letter.toLowerCase()}${letter.toLowerCase()}=${t.recessiveTrait}`
        : `${letter}控制${t.dominantTrait}，${letter.toLowerCase()}控制${t.recessiveTrait}，${letter}对${letter.toLowerCase()}为完全显性`;
      return rule;
    }).join("；")
    : geneCount === 1
    ? `${parent1[0]}对${parent1[1]}为完全显性`
    : "";

  function getGameteProbabilityLabel(gamete: string, parentGenotype: string): string {
    const allGametes = getGametes(parentGenotype);
    const count = allGametes.filter(g => g === gamete).length;
    return count > 0 ? `${count}/${allGametes.length}` : "";
  }

  function GenotypeRatioSection() {
    if (!showPhenotype) return null;
    return (
      <div style={S.section}>
        <div style={S.sectionTitle}>子代基因型比例</div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {sortedGenotypes.map(([geno, count]) => {
            const pct = (count / offspring.length * 100).toFixed(1);
            const item = offspring.find(o => o.genotype === geno);
            return (
              <div key={geno} style={{ flex: "1 1 100px", minWidth: 100 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <span style={{ ...S.mono, fontSize: 14 }}>{geno}</span>
                  {item && (
                    <span style={{
                      ...S.badge,
                      background: getPhenotypeBg(item.phenotype),
                      color: getPhenotypeColor(item.phenotype),
                    }}>
                      {item.phenotypeDetail}
                    </span>
                  )}
                </div>
                {renderRatioBar(Number(pct), "#182544")}
                <div style={{ ...S.label, marginTop: 2 }}>{count}/{offspring.length} = {pct}%</div>
              </div>
            );
          })}
        </div>
        <div style={{ marginTop: 8, fontSize: 12, color: "#6b7280" }}>
          基因型比例 = {sortedGenotypes.map(([, c]) => c).join(":")}
        </div>
      </div>
    );
  }

  function PhenotypeRatioSection() {
    if (!showPhenotype) return null;
    return (
      <div style={S.section}>
        <div style={S.sectionTitle}>子代表型比例</div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {sortedPhenotypes.map(([pheno, count]) => {
            const pct = (count / offspring.length * 100).toFixed(1);
            const displayName = traitDefs.length > 0 ? pheno : getPhenotypeDisplayName(pheno, traitDefs);
            const color = getPhenotypeColor(pheno);
            return (
              <div key={pheno} style={{ flex: "1 1 120px", minWidth: 120 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 3, background: color }} />
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{displayName}</span>
                </div>
                {renderRatioBar(Number(pct), color)}
                <div style={{ ...S.label, marginTop: 2 }}>{count}/{offspring.length} = {pct}%</div>
              </div>
            );
          })}
        </div>
        <div style={{ marginTop: 8, fontSize: 12, color: "#6b7280" }}>
          表型比例 = {sortedPhenotypes.map(([, c]) => c).join(":")}
          {" "}&#x2248;{" "}
          {(() => {
            const g = gcdArray(sortedPhenotypes.map(([, c]) => c));
            return sortedPhenotypes.map(([, c]) => c / g).join(":");
          })()}
        </div>
      </div>
    );
  }

  function TraitDefsSection() {
    if (traitDefs.length === 0) return null;
    return (
      <div style={S.section}>
        <div style={S.sectionTitle}>性状定义</div>
        {traitDefs.map((t, i) => {
          const letter = String.fromCharCode(65 + i);
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 4, fontSize: 13 }}>
              <span style={{ ...S.badge, background: "rgba(24,37,68,0.08)", color: "#182544" }}>{t.name}</span>
              <span style={S.mono}>{letter}{letter}</span>
              <span>= {t.dominantTrait}</span>
              <span style={{ color: "#d1d5db" }}>|</span>
              {t.incompleteDominance && t.intermediateTrait && (
                <>
                  <span style={S.mono}>{letter}{letter.toLowerCase()}</span>
                  <span>= {t.intermediateTrait}</span>
                  <span style={{ color: "#d1d5db" }}>|</span>
                </>
              )}
              <span style={S.mono}>{letter.toLowerCase()}{letter.toLowerCase()}</span>
              <span>= {t.recessiveTrait}</span>
            </div>
          );
        })}
        {dominantRule && (
          <div style={{ marginTop: 6, fontSize: 12, color: "#775a19", background: "rgba(119,90,25,0.06)", padding: "4px 8px", borderRadius: 4 }}>
            {dominantRule}
          </div>
        )}
      </div>
    );
  }

  function LinkageWarning() {
    if (!linkageInfo.isLinked) return null;
    return (
      <div style={{ ...S.tipBox, ...S.tipWarn, marginTop: 12 }}>
        <strong>连锁遗传提示</strong>
        <div>这些基因位于同一染色体上，不遵循自由组合定律。{linkageInfo.recombinationFrequency ? ` 重组频率约 ${linkageInfo.recombinationFrequency}%，实际后代比例可能偏离理论预测。` : ""}</div>
      </div>
    );
  }

  function ParentsSection() {
    return (
      <div style={{ marginTop: 10, textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div style={{ padding: "8px 14px", background: "rgba(59,130,246,0.08)", borderRadius: 8, border: "1px solid rgba(59,130,246,0.2)" }}>
            <div style={{ fontSize: 11, color: "#3b82f6", fontWeight: 600, marginBottom: 2 }}>
              {fatherLabel} ♂{sexLinked ? "（XY）" : ""}
            </div>
            <div style={S.mono}>{parent1}</div>
            {fatherPhenotype && <div style={{ fontSize: 11, color: "#6b7280" }}>{fatherPhenotype}</div>}
          </div>
          <div style={{ fontSize: 18, color: "#6b7280", fontWeight: 300 }}>x</div>
          <div style={{ padding: "8px 14px", background: "rgba(236,72,153,0.08)", borderRadius: 8, border: "1px solid rgba(236,72,153,0.2)" }}>
            <div style={{ fontSize: 11, color: "#ec4899", fontWeight: 600, marginBottom: 2 }}>
              {motherLabel} ♀{sexLinked ? "（XX）" : ""}
            </div>
            <div style={S.mono}>{parent2}</div>
            {motherPhenotype && <div style={{ fontSize: 11, color: "#6b7280" }}>{motherPhenotype}</div>}
          </div>
        </div>
        <div style={{ marginTop: 4, fontSize: 12, color: "#9ca3af" }}>
          P：{fatherLabel} {p1Display} x {motherLabel} {p2Display}
        </div>
      </div>
    );
  }

  function GridSection() {
    const gridCols = gametes1.length;
    return (
      <div style={{ overflowX: "auto", marginTop: 12 }}>
        <table style={{ borderCollapse: "collapse", margin: "0 auto", background: "#fff", borderRadius: 8, overflow: "hidden", border: "1px solid #e5e7eb" }}>
          <thead>
            <tr>
              <th style={{ width: 56, height: 56, background: "#f3f4f6", border: "1px solid #e5e7eb", fontSize: 10, color: "#9ca3af", position: "relative" }}>
                <div style={{ position: "absolute", top: 4, right: 6, color: "#3b82f6", fontSize: 9 }}>♂配子</div>
                <div style={{ position: "absolute", bottom: 4, left: 6, color: "#ec4899", fontSize: 9 }}>♀配子</div>
              </th>
              {gametes1.map((g, i) => (
                <th key={i} style={{ padding: "8px 10px", background: "rgba(59,130,246,0.06)", border: "1px solid #e5e7eb", fontWeight: 700, fontSize: 13, color: "#1e40af", fontFamily: "monospace", minWidth: 64, textAlign: "center" }}>
                  <div>{g}</div>
                  <div style={{ fontSize: 9, fontWeight: 400, color: "#93c5fd" }}>P={getGameteProbabilityLabel(g, parent1)}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {gametes2.map((g2, row) => (
              <tr key={row}>
                <td style={{ padding: "8px 10px", background: "rgba(236,72,153,0.06)", border: "1px solid #e5e7eb", fontWeight: 700, fontSize: 13, color: "#be185d", fontFamily: "monospace", textAlign: "center" }}>
                  <div>{g2}</div>
                  <div style={{ fontSize: 9, fontWeight: 400, color: "#f9a8d4" }}>P={getGameteProbabilityLabel(g2, parent2)}</div>
                </td>
                {gametes1.map((g1, col) => {
                  const idx = row * gridCols + col;
                  const item = offspring[idx];
                  if (!item) return null;
                  const isSelected = selectedCell?.row === row && selectedCell?.col === col;
                  const isPure = item.genotype === item.genotype.toUpperCase() || item.genotype === item.genotype.toLowerCase();
                  const phenoColor = getPhenotypeColor(item.phenotype);
                  const displayName = traitDefs.length > 0 ? item.phenotype : getPhenotypeDisplayName(item.phenotype, traitDefs);
                  return (
                    <td key={col}
                      onClick={() => handleCellClick(item, row, col, gametes1, gametes2)}
                      style={{
                        padding: "6px 10px",
                        border: "1px solid #e5e7eb",
                        textAlign: "center",
                        cursor: interactive ? "pointer" : "default",
                        background: isSelected ? "#dbeafe" : showPhenotype ? getPhenotypeBg(item.phenotype) : "#fff",
                        outline: isSelected ? "2px solid #3b82f6" : isPure ? "1px solid #d1d5db" : "none",
                        outlineOffset: "-1px",
                        transition: "background 0.15s",
                        minWidth: 64,
                      }}
                    >
                      <div style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 13, color: "#1b1c1a" }}>{item.genotype}</div>
                      {showPhenotype && (
                        <div style={{ fontSize: 10, color: phenoColor, marginTop: 2, fontWeight: 500 }}>{displayName}</div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  function DetailPanel() {
    if (!selectedCell || !interactive) return null;
    const explanation = getCellExplanation(selectedCell, traitDefs, offspring.length, parent1, parent2);
    return (
      <div style={{ ...S.section, borderLeft: "3px solid #3b82f6", marginTop: 12 }}>
        <div style={{ ...S.sectionTitle, fontSize: 14 }}>格子详情</div>
        <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "4px 12px", fontSize: 13 }}>
          <span style={S.label}>位置：</span>
          <span>第 {selectedCell.row + 1} 行, 第 {selectedCell.col + 1} 列</span>
          <span style={S.label}>配子：</span>
          <span style={S.mono}>♂[{selectedCell.parentGamete}] x ♀[{selectedCell.motherGamete}]</span>
          <span style={S.label}>基因型：</span>
          <span style={S.mono}>{selectedCell.genotype}</span>
          <span style={S.label}>表型：</span>
          <span>{selectedCell.phenotypeDetail}</span>
          <span style={S.label}>概率：</span>
          <span>1/{offspring.length} = {(1 / offspring.length * 100).toFixed(1)}%</span>
        </div>
        <div style={{ marginTop: 8, padding: "8px 10px", background: "#f8fafc", borderRadius: 6, fontSize: 12, color: "#475569", whiteSpace: "pre-line", lineHeight: 1.7 }}>
          {explanation}
        </div>
      </div>
    );
  }

  function SimulationSection() {
    if (!interactive) return null;
    return (
      <div style={{ ...S.section, marginTop: 12 }}>
        <div style={S.sectionTitle}>随机受精模拟实验</div>
        <div style={{ ...S.row, marginBottom: 8 }}>
          <span style={S.label}>模拟次数：</span>
          {[100, 1000, 10000].map(n => (
            <button key={n} onClick={() => { setSimCount(n); setSimResults(null); }}
              style={{
                ...S.btn, ...(simCount === n ? S.btnPrimary : S.btnSecondary),
                padding: "4px 12px", fontSize: 11,
              }}>
              {n}
            </button>
          ))}
        </div>
        <div style={{ ...S.row }}>
          <button onClick={handleSimulate} disabled={simulating}
            style={{ ...S.btn, ...S.btnPrimary, opacity: simulating ? 0.6 : 1, cursor: simulating ? "not-allowed" : "pointer" }}>
            {simulating ? `模拟中 ${simProgress}/${simCount}...` : "开始模拟"}
          </button>
          <button onClick={handleReset} style={{ ...S.btn, ...S.btnSecondary }}>
            重置
          </button>
        </div>
        {simResults && simResults.size > 0 && (
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#182544", marginBottom: 6 }}>
              模拟结果（共 {simCount} 次随机交配）
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {sortedPhenotypes.map(([pheno]) => {
                const count = simResults.get(pheno) || 0;
                const pct = (count / simCount * 100).toFixed(1);
                const theoreticalPct = (phenotypeRatios.get(pheno) || 0) / offspring.length * 100;
                const displayName = traitDefs.length > 0 ? pheno : getPhenotypeDisplayName(pheno, traitDefs);
                const color = getPhenotypeColor(pheno);
                return (
                  <div key={pheno} style={{ flex: "1 1 140px", minWidth: 140 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color, marginBottom: 4 }}>{displayName}</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: "#182544" }}>{pct}%</div>
                    <div style={S.label}>实际: {count}/{simCount}</div>
                    <div style={S.label}>理论: {theoreticalPct.toFixed(1)}%</div>
                    {renderRatioBar(Number(pct), color)}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  function ChiSquareSection() {
    if (!chiSquareResult || observedData.length === 0) return null;
    return (
      <div style={{ ...S.section, marginTop: 12 }}>
        <div style={S.sectionTitle}>卡方检验（χ² Test）</div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12 }}>
            <thead>
              <tr>
                {["表型", "理论期望(E)", "实际观察(O)", "(O-E)²/E"].map(h => (
                  <th key={h} style={{ padding: "6px 10px", background: "#f3f4f6", border: "1px solid #e5e7eb", fontWeight: 600, textAlign: "center" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {chiSquareResult.details.map((d, i) => {
                const displayName = traitDefs.length > 0 ? d.phenotype : getPhenotypeDisplayName(d.phenotype, traitDefs);
                return (
                  <tr key={i}>
                    <td style={{ padding: "4px 10px", border: "1px solid #e5e7eb", textAlign: "center" }}>{displayName}</td>
                    <td style={{ padding: "4px 10px", border: "1px solid #e5e7eb", textAlign: "center" }}>{d.expected}</td>
                    <td style={{ padding: "4px 10px", border: "1px solid #e5e7eb", textAlign: "center" }}>{d.observed}</td>
                    <td style={{ padding: "4px 10px", border: "1px solid #e5e7eb", textAlign: "center" }}>{d.contribution.toFixed(3)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{ marginTop: 8, fontSize: 13 }}>
          <strong>χ² = {chiSquareResult.value.toFixed(3)}</strong>，df = {chiSquareResult.df}，临界值 = {chiSquareResult.critical}
        </div>
        <div style={{ marginTop: 4, padding: "6px 10px", borderRadius: 6, fontSize: 12, fontWeight: 600, background: chiSquareResult.accept ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)", color: chiSquareResult.accept ? "#059669" : "#dc2626" }}>
          {chiSquareResult.accept
            ? "接受原假设：实际数据符合理论比例 (p > 0.05)"
            : "拒绝原假设：实际数据显著偏离理论比例 (p < 0.05)"}
        </div>
      </div>
    );
  }

  function TwoGeneBreakdown() {
    if (!isTwoGene || !showPhenotype) return null;
    const genotypeCounts = new Map<string, number>();
    for (const item of offspring) {
      genotypeCounts.set(item.genotype, (genotypeCounts.get(item.genotype) || 0) + 1);
    }
    const pureDominant = genotypeCounts.get(parent1[0] + parent1[0] + parent1[2] + parent1[2]) || 0;
    const doubleHet = genotypeCounts.get(parent1[0] + parent1[1] + parent1[2] + parent1[3]) || 0;
    return (
      <div style={{ ...S.section, marginTop: 12 }}>
        <div style={S.sectionTitle}>双基因自由组合拆解</div>
        <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.8 }}>
          <div>9:3:3:1 比例来源：两对等位基因独立遗传，各自遵循 3:1 分离比。</div>
          <div style={{ marginTop: 4 }}>
            <span style={{ fontWeight: 600 }}>纯合显性：</span>{pureDominant}/{offspring.length}
            <span style={{ margin: "0 8px", color: "#d1d5db" }}>|</span>
            <span style={{ fontWeight: 600 }}>双杂合子：</span>{doubleHet}/{offspring.length}
          </div>
        </div>
      </div>
    );
  }

  function ProbabilityBreakdown() {
    if (!showPhenotype) return null;
    return (
      <div style={{ ...S.section, marginTop: 12 }}>
        <div style={S.sectionTitle}>概率计算原理</div>
        <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.8 }}>
          <div>减数分裂：等位基因分离，非等位基因自由组合。</div>
          <div>雌雄配子随机结合，结合机会均等。</div>
          <div style={{ marginTop: 4 }}>
            <span style={{ fontWeight: 600 }}>乘法原理：</span>子代基因型概率 = 父本配子概率 x 母本配子概率
          </div>
          <div style={{ marginTop: 4, fontSize: 11, color: "#775a19" }}>
            {gametes1.map(g => `${g}(${getGameteProbabilityLabel(g, parent1)})`).join(", ")}
            {" x "}
            {gametes2.map(g => `${g}(${getGameteProbabilityLabel(g, parent2)})`).join(", ")}
          </div>
        </div>
      </div>
    );
  }

  function TipsSection() {
    if (!showTips) return null;
    return (
      <div style={{ marginTop: 12 }}>
        <div style={{ ...S.tipBox, ...S.tipInfo, marginBottom: 8 }}>
          <strong>核心原理</strong>
          <div>减数分裂：等位基因分离，非等位基因自由组合；雌雄配子随机结合，结合机会均等。</div>
        </div>
        <div style={{ ...S.tipBox, ...S.tipWarn, marginBottom: 8 }}>
          <strong>高频易错点</strong>
          <div>- 配子只能含每对等位基因中的 1 个，不能写成对（如 Aa）</div>
          <div>- 显性基因写在隐性基因前（如 Aa，不能写 aA）</div>
          <div>- 配子是单倍体，子代基因型是二倍体（配子 x 配子）</div>
        </div>
        <div style={{ ...S.tipBox, ...S.tipScope }}>
          <strong>适用范围</strong>
          <div>适用于真核生物有性生殖、细胞核基因遗传、遵循分离/自由组合定律。不适用于细胞质遗传、基因连锁互换、无性生殖。</div>
        </div>
      </div>
    );
  }

  function LegendSection() {
    if (!showPhenotype) return null;
    return (
      <div style={{ ...S.row, marginTop: 10, padding: "8px 12px", background: "#fff", borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 12, color: "#6b7280" }}>
        {sortedPhenotypes.map(([pheno]) => {
          const displayName = traitDefs.length > 0 ? pheno : getPhenotypeDisplayName(pheno, traitDefs);
          return (
            <div key={pheno} style={{ display: "flex", alignItems: "center", gap: 6, marginRight: 12 }}>
              <div style={{ width: 12, height: 12, borderRadius: 3, background: getPhenotypeColor(pheno) }} />
              <span>{displayName}</span>
            </div>
          );
        })}
      </div>
    );
  }

  function SexLinkedNote() {
    if (!sexLinked) return null;
    return (
      <div style={{ ...S.tipBox, ...S.tipInfo, marginTop: 12 }}>
        <strong>伴性遗传标注</strong>
        <div>该性状基因位于 X 染色体上，Y 染色体无对应等位基因。男性（XY）只需一个隐性等位基因即可表现隐性性状，女性（XX）需两个隐性等位基因。</div>
      </div>
    );
  }

  function gcd(a: number, b: number): number {
    return b === 0 ? a : gcd(b, a % b);
  }
  function gcdArray(arr: number[]): number {
    return arr.reduce((g, n) => gcd(g, n));
  }

  return (
    <div style={S.container}>
      <div style={S.title}>{trait || "孟德尔方格图（Punnett Square）"}</div>

      {showTips && traitDefs.length === 0 && dominantRule && (
        <div style={{ textAlign: "center", fontSize: 12, color: "#775a19", marginTop: 4, marginBottom: 4 }}>
          {dominantRule}
        </div>
      )}

      <TraitDefsSection />
      <LinkageWarning />
      <ParentsSection />
      <GridSection />
      <DetailPanel />
      <GenotypeRatioSection />
      <PhenotypeRatioSection />
      <TwoGeneBreakdown />
      <ProbabilityBreakdown />
      <SimulationSection />
      <ChiSquareSection />
      <LegendSection />
      <SexLinkedNote />
      <TipsSection />
    </div>
  );
}

export { PunnettSquare };
