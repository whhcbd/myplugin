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

interface PhenotypeItem {
  phenotype: string;
  count: number;
  percentage: number;
}

const COLORS = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#84cc16",
];

function parseData(
  phenotypes: string,
  counts: string
): PhenotypeItem[] {
  const labels = phenotypes.split(",").map((s) => s.trim()).filter(Boolean);
  const nums = counts.split(",").map((s) => Number(s.trim())).filter((n) => Number.isFinite(n));
  const total = nums.reduce((a, b) => a + b, 0);
  const items: PhenotypeItem[] = [];
  for (let i = 0; i < labels.length; i++) {
    const count = nums[i] || 0;
    items.push({
      phenotype: labels[i],
      count,
      percentage: total > 0 ? (count / total) * 100 : 0,
    });
  }
  return items;
}

export function PhenotypeDistribution({ node }: { node: A2UINode }) {
  const props = node.properties ?? {};

  const initTrait = parseStr(props.trait, "豌豆颜色");
  const initPhenotypes = parseStr(props.phenotypes, "黄色,绿色");
  const initCounts = parseStr(props.counts, "75,25");
  const initInteractive = parseBool(props.interactive, true);

  const [trait, setTrait] = useState(initTrait);
  const [phenotypes, setPhenotypes] = useState(initPhenotypes);
  const [counts, setCounts] = useState(initCounts);
  const [interactive, setInteractive] = useState(initInteractive);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [filters, setFilters] = useState<Set<number>>(new Set());

  useEffect(() => { setTrait(initTrait); }, [initTrait]);
  useEffect(() => { setPhenotypes(initPhenotypes); setFilters(new Set()); }, [initPhenotypes]);
  useEffect(() => { setCounts(initCounts); }, [initCounts]);
  useEffect(() => { setInteractive(initInteractive); }, [initInteractive]);

  const data = parseData(phenotypes, counts);

  const filteredData = filters.size > 0
    ? data.filter((_, i) => filters.has(i))
    : data;

  const totalCount = filteredData.reduce((s, d) => s + d.count, 0);
  const maxCount = Math.max(...filteredData.map((d) => d.count), 1);

  const toggleFilter = useCallback((idx: number) => {
    setFilters((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
        if (next.size === 0) return new Set();
      } else {
        next.add(idx);
      }
      return next;
    });
  }, []);

  if (data.length === 0) {
    return (
      <div style={{ background: "#faf9f5", borderRadius: 12, padding: 24, textAlign: "center", color: "#6b7280", fontFamily: "Manrope, sans-serif", fontStyle: "italic" }}>
        暂无表型分布数据
      </div>
    );
  }

  return (
    <div style={{ background: "#faf9f5", borderRadius: 12, padding: 16, fontFamily: "Manrope, sans-serif", maxWidth: 700 }}>
      <div style={{ fontSize: 16, fontWeight: 600, color: "#182544", textAlign: "center", marginBottom: 12 }}>
        {trait || "表型分布"}
      </div>

      {interactive && (
        <div style={{ marginBottom: 12, padding: 12, background: "#fff", borderRadius: 8, border: "1px solid #e5e7eb" }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#182544", marginBottom: 8 }}>筛选表型</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {data.map((item, i) => {
              const active = filters.size === 0 || filters.has(i);
              return (
                <label
                  key={i}
                  onClick={() => toggleFilter(i)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "6px 12px",
                    background: active ? "#182544" : "#fff",
                    color: active ? "#fff" : "#1b1c1a",
                    border: "1px solid",
                    borderColor: active ? "#182544" : "#e5e7eb",
                    borderRadius: 6,
                    cursor: "pointer",
                    fontSize: 12,
                    transition: "all 0.2s",
                  }}
                >
                  <input type="checkbox" checked={active} readOnly style={{ width: 14, height: 14, cursor: "pointer" }} />
                  {item.phenotype}
                </label>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ background: "#fff", padding: 16, borderRadius: 8, border: "1px solid #e5e7eb" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filteredData.map((item) => {
            const originalIdx = data.findIndex((d) => d.phenotype === item.phenotype);
            const color = COLORS[originalIdx % COLORS.length];
            const barW = (item.count / maxCount) * 100;
            const isSelected = selectedIdx === originalIdx;
            return (
              <div key={item.phenotype} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ minWidth: 80, fontSize: 13, fontWeight: 500, color: "#6b7280", textAlign: "right" }}>
                  {item.phenotype}
                </div>
                <div
                  style={{
                    flex: 1,
                    height: 28,
                    background: "#fafafa",
                    borderRadius: 4,
                    overflow: "hidden",
                    border: "1px solid #e5e7eb",
                  }}
                >
                  <div
                    onClick={() => interactive && setSelectedIdx(isSelected ? null : originalIdx)}
                    style={{
                      height: "100%",
                      width: `${barW}%`,
                      background: color,
                      borderRadius: 4,
                      display: "flex",
                      alignItems: "center",
                      paddingLeft: 10,
                      transition: "width 0.5s ease-out, box-shadow 0.2s",
                      cursor: interactive ? "pointer" : "default",
                      boxShadow: isSelected ? `0 0 0 3px ${color}44` : "none",
                    }}
                  >
                    {barW > 15 && (
                      <span style={{ color: "#fff", fontWeight: 600, fontSize: 12, whiteSpace: "nowrap" }}>
                        {item.percentage.toFixed(1)}%
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ minWidth: 80 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#182544" }}>{item.percentage.toFixed(1)}%</div>
                  <div style={{ fontSize: 11, color: "#6b7280" }}>{item.count}</div>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ marginTop: 14, padding: 10, background: "#fafafa", borderRadius: 6, border: "1px solid #e5e7eb", display: "flex", justifyContent: "space-around" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 11, color: "#6b7280" }}>总数量</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: "#182544" }}>{totalCount}</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 11, color: "#6b7280" }}>表型种类</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: "#182544" }}>{filteredData.length}</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 11, color: "#6b7280" }}>最大数量</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: "#182544" }}>{Math.max(...filteredData.map((d) => d.count), 0)}</div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 12, padding: 10, background: "#fff", borderRadius: 6, border: "1px solid #e5e7eb" }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "#182544", marginBottom: 8 }}>颜色图例</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 6 }}>
          {data.map((item, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: 4, borderRadius: 4, background: "#fafafa" }}>
              <div style={{ width: 14, height: 14, borderRadius: 3, background: COLORS[i % COLORS.length], flexShrink: 0 }} />
              <div style={{ fontSize: 11, color: "#6b7280" }}>
                <strong style={{ color: "#1b1c1a" }}>{item.phenotype}</strong>
                <br />
                <small>{item.percentage.toFixed(1)}%</small>
              </div>
            </div>
          ))}
        </div>
      </div>

      {selectedIdx !== null && data[selectedIdx] && (
        <>
          <div onClick={() => setSelectedIdx(null)} style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", zIndex: 999 }} />
          <div
            style={{
              position: "fixed",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              background: "#fff",
              borderRadius: 12,
              padding: 24,
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)",
              zIndex: 1000,
              minWidth: 320,
              maxWidth: 500,
              border: "1px solid #e5e7eb",
            }}
          >
            <button onClick={() => setSelectedIdx(null)} style={{ position: "absolute", top: 16, right: 16, background: "none", border: "none", fontSize: 20, color: "#6b7280", cursor: "pointer", lineHeight: 1 }}>×</button>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#182544", marginBottom: 16, paddingBottom: 12, borderBottom: "2px solid #e5e7eb", display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 20, height: 20, borderRadius: 5, background: COLORS[selectedIdx % COLORS.length] }} />
              {data[selectedIdx].phenotype}
            </div>
            <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.8 }}>
              <p><strong style={{ color: "#182544" }}>数量：</strong>{data[selectedIdx].count} 个体</p>
              <p><strong style={{ color: "#182544" }}>百分比：</strong>{data[selectedIdx].percentage.toFixed(2)}%</p>
              <p><strong style={{ color: "#182544" }}>占比：</strong>{data[selectedIdx].count} / {totalCount}</p>
              <ul style={{ margin: "8px 0", paddingLeft: 20, lineHeight: 2 }}>
                <li>该表型在群体中的频率为 {data[selectedIdx].percentage.toFixed(2)}%</li>
                <li>共有 {data[selectedIdx].count} 个个体表现出该表型</li>
              </ul>
              <p style={{ marginTop: 8, fontSize: 12, color: "#9ca3af" }}>表型分布反映了基因型与环境相互作用的结果</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default PhenotypeDistribution;
