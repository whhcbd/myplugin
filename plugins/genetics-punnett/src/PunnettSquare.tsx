import { useState, useEffect, useCallback } from "react";

interface A2UINode {
  properties?: Record<string, unknown>;
}

function parseStr(val: unknown, fallback: string): string {
  return typeof val === "string" ? val : fallback;
}

function parseBool(val: unknown, fallback: boolean): boolean {
  return typeof val === "boolean" ? val : fallback;
}

interface GenotypeData {
  genotype: string;
  phenotype: string;
}

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

function determinePhenotype(genotype: string): string {
  const upperCaseCount = (genotype.match(/[A-Z]/g) || []).length;
  if (upperCaseCount === genotype.length) return "显性";
  if (upperCaseCount === 0) return "隐性";
  return "杂合";
}

function calculateOffspring(parent1: string, parent2: string): GenotypeData[] {
  const gametes1 = getGametes(parent1);
  const gametes2 = getGametes(parent2);
  if (gametes1.length === 0 || gametes2.length === 0) return [];
  const offspring: GenotypeData[] = [];
  for (const g1 of gametes1) {
    for (const g2 of gametes2) {
      const genotype = combineGametes(g1, g2);
      const phenotype = determinePhenotype(genotype);
      offspring.push({ genotype, phenotype });
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

function getPhenotypeColor(phenotype: string): string {
  if (phenotype.includes("显性")) return "#182544";
  if (phenotype.includes("隐性")) return "#d1d5db";
  return "#775a19";
}

interface CellInfo {
  row: number;
  col: number;
  genotype: string;
  phenotype: string;
}

function runSimulation(parent1: string, parent2: string, count: number): Map<string, number> {
  const gametes1 = getGametes(parent1);
  const gametes2 = getGametes(parent2);
  if (gametes1.length === 0 || gametes2.length === 0) return new Map();
  const results = new Map<string, number>();
  for (let i = 0; i < count; i++) {
    const g1 = gametes1[Math.floor(Math.random() * gametes1.length)];
    const g2 = gametes2[Math.floor(Math.random() * gametes2.length)];
    const genotype = combineGametes(g1, g2);
    const phenotype = determinePhenotype(genotype);
    results.set(phenotype, (results.get(phenotype) || 0) + 1);
  }
  return results;
}

export function PunnettSquare({ node }: { node: A2UINode }) {
  const props = node.properties ?? {};

  const initParent1 = parseStr(props.parent1Genotype, "Aa");
  const initParent2 = parseStr(props.parent2Genotype, "Aa");
  const initTrait = parseStr(props.trait, "");
  const initShowPhenotype = parseBool(props.showPhenotype, true);
  const initInteractive = parseBool(props.interactive, true);

  const [parent1, setParent1] = useState(initParent1);
  const [parent2, setParent2] = useState(initParent2);
  const [trait, setTrait] = useState(initTrait);
  const [showPhenotype, setShowPhenotype] = useState(initShowPhenotype);
  const [interactive, setInteractive] = useState(initInteractive);
  const [selectedCell, setSelectedCell] = useState<CellInfo | null>(null);
  const [simResults, setSimResults] = useState<Map<string, number> | null>(null);
  const [simulating, setSimulating] = useState(false);

  useEffect(() => { setParent1(initParent1); setSelectedCell(null); setSimResults(null); }, [initParent1]);
  useEffect(() => { setParent2(initParent2); setSelectedCell(null); setSimResults(null); }, [initParent2]);
  useEffect(() => { setTrait(initTrait); }, [initTrait]);
  useEffect(() => { setShowPhenotype(initShowPhenotype); }, [initShowPhenotype]);
  useEffect(() => { setInteractive(initInteractive); }, [initInteractive]);

  const handleCellClick = useCallback(
    (item: GenotypeData, row: number, col: number) => {
      if (!interactive) return;
      setSelectedCell({ row, col, genotype: item.genotype, phenotype: item.phenotype });
    },
    [interactive]
  );

  const handleSimulate = useCallback(() => {
    if (simulating) return;
    setSimulating(true);
    setTimeout(() => {
      const results = runSimulation(parent1, parent2, 1000);
      setSimResults(results);
      setSimulating(false);
    }, 50);
  }, [simulating, parent1, parent2]);

  const handleReset = useCallback(() => {
    setSimResults(null);
    setSelectedCell(null);
  }, []);

  const offspring = calculateOffspring(parent1, parent2);
  const gametes1 = getGametes(parent1);
  const gametes2 = getGametes(parent2);

  if (offspring.length === 0) {
    return (
      <div
        style={{
          background: "#faf9f5",
          borderRadius: 12,
          padding: 24,
          textAlign: "center",
          color: "#6b7280",
          fontFamily: "Manrope, sans-serif",
          fontStyle: "italic",
        }}
      >
        请输入有效的基因型（例如：Aa, AaBb）
      </div>
    );
  }

  const phenotypeRatios = showPhenotype ? getPhenotypeRatios(offspring) : null;
  const gridCols = gametes1.length;
  const gridRows = gametes2.length;

  const PHENOTYPE_LABELS: Record<string, string> = {
    显性: "显性性状",
    隐性: "隐性性状",
    杂合: "杂合子",
  };

  return (
    <div
      style={{
        background: "#faf9f5",
        borderRadius: 12,
        padding: 16,
        fontFamily: "Manrope, sans-serif",
      }}
    >
      <div
        style={{
          fontSize: 16,
          fontWeight: 600,
          color: "#182544",
          textAlign: "center",
          marginBottom: 12,
        }}
      >
        {trait || "孟德尔方格图"}
      </div>

      <div style={{ textAlign: "center", marginBottom: 8, fontSize: 13, color: "#1b1c1a" }}>
        <span style={{ fontWeight: 600 }}>{parent1}</span>
        <span style={{ margin: "0 8px", color: "#6b7280" }}>×</span>
        <span style={{ fontWeight: 600 }}>{parent2}</span>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table
          style={{
            borderCollapse: "collapse",
            margin: "0 auto",
            background: "#fff",
            borderRadius: 8,
            overflow: "hidden",
            border: "1px solid #e5e7eb",
          }}
        >
          <thead>
            <tr>
              <th
                style={{
                  width: 48,
                  height: 48,
                  background: "#f3f4f6",
                  border: "1px solid #e5e7eb",
                  fontSize: 10,
                  color: "#9ca3af",
                }}
              >
                ♂\♀
              </th>
              {gametes1.map((g, i) => (
                <th
                  key={i}
                  style={{
                    padding: "8px 12px",
                    background: "rgba(24,37,68,0.06)",
                    border: "1px solid #e5e7eb",
                    fontWeight: 700,
                    fontSize: 13,
                    color: "#182544",
                    fontFamily: "monospace",
                    minWidth: 60,
                    textAlign: "center",
                  }}
                >
                  {g}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {gametes2.map((g2, row) => (
              <tr key={row}>
                <td
                  style={{
                    padding: "8px 12px",
                    background: "rgba(24,37,68,0.06)",
                    border: "1px solid #e5e7eb",
                    fontWeight: 700,
                    fontSize: 13,
                    color: "#182544",
                    fontFamily: "monospace",
                    textAlign: "center",
                  }}
                >
                  {g2}
                </td>
                {gametes1.map((_, col) => {
                  const idx = row * gridCols + col;
                  const item = offspring[idx];
                  if (!item) return null;
                  const isSelected =
                    selectedCell?.row === row && selectedCell?.col === col;
                  return (
                    <td
                      key={col}
                      onClick={() => handleCellClick(item, row, col)}
                      style={{
                        padding: "8px 12px",
                        border: "1px solid #e5e7eb",
                        textAlign: "center",
                        cursor: interactive ? "pointer" : "default",
                        background: isSelected
                          ? "#d1fae5"
                          : showPhenotype
                          ? `${getPhenotypeColor(item.phenotype)}11`
                          : "#fff",
                        transition: "background 0.2s",
                        fontWeight: isSelected ? 700 : 500,
                        fontSize: 13,
                        color: "#1b1c1a",
                        fontFamily: "monospace",
                      }}
                    >
                      {item.genotype}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedCell && (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            background: "#fff",
            borderRadius: 8,
            border: "1px solid #d1fae5",
            fontSize: 13,
            color: "#1b1c1a",
          }}
        >
          <div style={{ fontWeight: 600, color: "#182544", marginBottom: 4 }}>
            格子详情 [{gametes2[selectedCell.row]}] × [{gametes1[selectedCell.col]}]
          </div>
          <div>基因型：{selectedCell.genotype}</div>
          <div>表型：{selectedCell.phenotype}</div>
          <div style={{ marginTop: 4, fontSize: 12, color: "#6b7280" }}>
            该格子概率：1/{offspring.length}
          </div>
        </div>
      )}

      {showPhenotype && phenotypeRatios && (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            background: "#fff",
            borderRadius: 8,
            border: "1px solid #e5e7eb",
          }}
        >
          <div style={{ fontWeight: 600, color: "#182544", marginBottom: 8, fontSize: 13 }}>
            表型比例分析
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {Array.from(phenotypeRatios.entries()).map(([pheno, count]) => {
              const pct = ((count / offspring.length) * 100).toFixed(1);
              return (
                <div key={pheno} style={{ flex: "1 1 120px", minWidth: 120 }}>
                  <div
                    style={{
                      fontSize: 12,
                      color: "#6b7280",
                      marginBottom: 4,
                    }}
                  >
                    {PHENOTYPE_LABELS[pheno] || pheno}
                  </div>
                  <div
                    style={{
                      height: 8,
                      borderRadius: 4,
                      background: "#e5e7eb",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${pct}%`,
                        borderRadius: 4,
                        background: getPhenotypeColor(pheno),
                        transition: "width 0.5s ease",
                      }}
                    />
                  </div>
                  <div style={{ fontSize: 12, color: "#1b1c1a", marginTop: 4 }}>
                    {count}/{offspring.length} ({pct}%)
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {interactive && (
        <div style={{ marginTop: 12, display: "flex", gap: 8, justifyContent: "center" }}>
          <button
            onClick={handleSimulate}
            disabled={simulating}
            style={{
              padding: "8px 20px",
              borderRadius: 8,
              border: "none",
              background: simulating ? "#d1d5db" : "#182544",
              color: "#fff",
              fontWeight: 600,
              fontSize: 13,
              cursor: simulating ? "not-allowed" : "pointer",
              fontFamily: "Manrope, sans-serif",
              transition: "background 0.2s",
            }}
          >
            {simulating ? "模拟中..." : "模拟实验 (1000次)"}
          </button>
          <button
            onClick={handleReset}
            style={{
              padding: "8px 20px",
              borderRadius: 8,
              border: "1px solid #e5e7eb",
              background: "#fff",
              color: "#6b7280",
              fontWeight: 500,
              fontSize: 13,
              cursor: "pointer",
              fontFamily: "Manrope, sans-serif",
            }}
          >
            重置
          </button>
        </div>
      )}

      {simResults && (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            background: "#fff",
            borderRadius: 8,
            border: "1px solid #e5e7eb",
          }}
        >
          <div style={{ fontWeight: 600, color: "#182544", marginBottom: 8, fontSize: 13 }}>
            模拟结果（1000次随机交配）
          </div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            {Array.from(simResults.entries()).map(([pheno, count]) => (
              <div key={pheno} style={{ textAlign: "center", minWidth: 80 }}>
                <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 2 }}>
                  {PHENOTYPE_LABELS[pheno] || pheno}
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#182544" }}>
                  {((count / 1000) * 100).toFixed(1)}%
                </div>
                <div style={{ fontSize: 11, color: "#9ca3af" }}>
                  ({count}/1000)
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showPhenotype && (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            background: "#fff",
            borderRadius: 8,
            border: "1px solid #e5e7eb",
            fontSize: 12,
            color: "#6b7280",
          }}
        >
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 12, height: 12, borderRadius: 3, background: "#182544" }} />
              <span>显性性状</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 12, height: 12, borderRadius: 3, background: "#d1d5db" }} />
              <span>隐性性状</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 12, height: 12, borderRadius: 3, background: "#775a19" }} />
              <span>杂合子</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PunnettSquare;
