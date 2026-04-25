import { useState, useEffect, useRef, useCallback } from "react";

interface A2UINode {
  properties?: Record<string, unknown>;
}

function parseStr(val: unknown, fb: string): string { return typeof val === "string" ? val : fb; }
function parseNum(val: unknown, fb: number): number {
  if (typeof val === "number") return val;
  if (typeof val === "string") { const n = Number(val); return isNaN(n) ? fb : n; }
  return fb;
}
function parseBool(val: unknown, fb: boolean): boolean {
  if (typeof val === "boolean") return val;
  if (typeof val === "string") return val === "true";
  return fb;
}

type Genotype = "AA" | "Aa" | "aa";
type Phenotype = "dark" | "medium" | "light";

interface Individual {
  id: number;
  genotype: Genotype;
  phenotype: Phenotype;
  x: number;
  y: number;
  alive: boolean;
}

interface GenData {
  generation: number;
  freqA: number;
  freqA_allele: number;
  population: number;
  survived: number;
}

function getPhenotype(gt: Genotype): Phenotype {
  if (gt === "AA") return "dark";
  if (gt === "Aa") return "medium";
  return "light";
}

function getFitness(ph: Phenotype, env: string, str: number): number {
  if (env === "dark") {
    if (ph === "dark") return 1.0;
    if (ph === "medium") return 1.0 - str * 0.3;
    return 1.0 - str;
  } else {
    if (ph === "light") return 1.0;
    if (ph === "medium") return 1.0 - str * 0.3;
    return 1.0 - str;
  }
}

function randAllele(gt: Genotype): "A" | "a" {
  if (gt === "AA") return "A";
  if (gt === "aa") return "a";
  return Math.random() < 0.5 ? "A" : "a";
}

function combine(a1: "A" | "a", a2: "A" | "a"): Genotype {
  if (a1 === "A" && a2 === "A") return "AA";
  if (a1 === "a" && a2 === "a") return "aa";
  return "Aa";
}

function calcGenData(pop: Individual[], gen: number): GenData {
  const alive = pop.filter(i => i.alive);
  const total = alive.length;
  let countA = 0;
  alive.forEach(i => {
    if (i.genotype === "AA") countA += 2;
    else if (i.genotype === "Aa") countA += 1;
  });
  const freqA_allele = total > 0 ? countA / (total * 2) : 0;
  const freqA = total > 0 ? alive.filter(i => i.genotype === "AA").length / total : 0;
  return { generation: gen, freqA, freqA_allele, population: pop.length, survived: total };
}

function usePopulationCanvas(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  population: Individual[],
  env: string,
) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !population.length) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const cw = canvas.offsetWidth || 500;
    const ch = canvas.offsetHeight || 400;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = cw * dpr;
    canvas.height = ch * dpr;
    ctx.scale(dpr, dpr);

    ctx.fillStyle = env === "dark" ? "#1f2937" : "#f3f4f6";
    ctx.fillRect(0, 0, cw, ch);

    population.forEach(ind => {
      const x = (ind.x / 100) * cw;
      const y = (ind.y / 100) * ch;
      const radius = ind.alive ? 4 : 3;

      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);

      if (!ind.alive) {
        ctx.fillStyle = "rgba(139, 58, 58, 0.5)";
        ctx.fill();
        ctx.strokeStyle = "#8b3a3a";
        ctx.lineWidth = 1;
        ctx.stroke();
        return;
      }

      if (ind.phenotype === "dark") ctx.fillStyle = "#1b1c1a";
      else if (ind.phenotype === "medium") ctx.fillStyle = "#6b7280";
      else ctx.fillStyle = "#d1d5db";

      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1;
      ctx.stroke();
    });
  }, [canvasRef, population, env]);
}

function useFreqChart(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  history: GenData[],
) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || history.length < 2) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const cw = canvas.offsetWidth || 500;
    const ch = canvas.offsetHeight || 400;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = cw * dpr;
    canvas.height = ch * dpr;
    ctx.scale(dpr, dpr);

    const pl = 60, pr = 20, pt = 30, pb = 50;
    const w = cw - pl - pr;
    const h = ch - pt - pb;

    ctx.clearRect(0, 0, cw, ch);

    ctx.strokeStyle = "#e5e7eb";
    ctx.lineWidth = 1;
    ctx.fillStyle = "#9ca3af";
    ctx.font = "11px Manrope, sans-serif";
    ctx.textAlign = "right";
    for (let i = 0; i <= 5; i++) {
      const val = (1 - i / 5).toFixed(1);
      const y = pt + (i / 5) * h;
      ctx.beginPath();
      ctx.moveTo(pl, y);
      ctx.lineTo(pl + w, y);
      ctx.stroke();
      ctx.fillText(val, pl - 6, y + 4);
    }

    const gens = history.map(d => d.generation);
    const maxGen = Math.max(...gens, 1);

    ctx.fillStyle = "#6b7280";
    ctx.font = "11px Manrope, sans-serif";
    ctx.textAlign = "center";
    const step = Math.max(1, Math.floor(gens.length / 10));
    gens.forEach((g, i) => {
      if (i % step === 0 || i === gens.length - 1) {
        const x = pl + (g / maxGen) * w;
        ctx.fillText(String(g), x, ch - 12);
      }
    });

    ctx.strokeStyle = "#d1d5db";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pl, pt);
    ctx.lineTo(pl, pt + h);
    ctx.lineTo(pl + w, pt + h);
    ctx.stroke();

    const freqs = history.map(d => d.freqA_allele);
    const color = "#182544";

    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    freqs.forEach((f, i) => {
      const x = pl + (gens[i] / maxGen) * w;
      const y = pt + h - f * h;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    freqs.forEach((f, i) => {
      const x = pl + (gens[i] / maxGen) * w;
      const y = pt + h - f * h;
      ctx.beginPath();
      ctx.fillStyle = color;
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.font = "bold 11px Manrope, sans-serif";
    ctx.textAlign = "left";
    ctx.fillStyle = color;
    ctx.fillRect(pl + 10, pt + 8, 12, 12);
    ctx.fillStyle = "#1b1c1a";
    ctx.fillText("A 等位基因频率", pl + 26, pt + 18);

  }, [canvasRef, history]);
}

export default function NaturalSelectionSimulator({ node }: { node: A2UINode }) {
  const props = node.properties ?? {};

  const [popSize, setPopSize] = useState(parseNum(props.populationSize, 100));
  const [initFreq, setInitFreq] = useState(parseNum(props.initialFreqA, 0.5));
  const [envType, setEnvType] = useState(parseStr(props.environmentType, "dark"));
  const [selStr, setSelStr] = useState(parseNum(props.selectionStrength, 0.5));
  const interactive = parseBool(props.interactive, true);

  const [population, setPopulation] = useState<Individual[]>([]);
  const [generation, setGeneration] = useState(0);
  const [history, setHistory] = useState<GenData[]>([]);
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);

  const popCanvasRef = useRef<HTMLCanvasElement>(null);
  const freqCanvasRef = useRef<HTMLCanvasElement>(null);
  const runRef = useRef(false);
  const pauseRef = useRef(false);
  const genRef = useRef(0);
  const popRef = useRef<Individual[]>([]);
  const histRef = useRef<GenData[]>([]);

  usePopulationCanvas(popCanvasRef, population, envType);
  useFreqChart(freqCanvasRef, history);

  useEffect(() => {
    return () => { runRef.current = false; };
  }, []);

  useEffect(() => { setPopSize(parseNum(props.populationSize, 100)); }, [props.populationSize]);
  useEffect(() => { setInitFreq(parseNum(props.initialFreqA, 0.5)); }, [props.initialFreqA]);
  useEffect(() => { setEnvType(parseStr(props.environmentType, "dark")); }, [props.environmentType]);
  useEffect(() => { setSelStr(parseNum(props.selectionStrength, 0.5)); }, [props.selectionStrength]);

  const initPop = useCallback(() => {
    const freqA = initFreq;
    const freqAA = freqA * freqA;
    const freqAa = 2 * freqA * (1 - freqA);
    const pop: Individual[] = [];
    for (let i = 0; i < popSize; i++) {
      const r = Math.random();
      let gt: Genotype;
      if (r < freqAA) gt = "AA";
      else if (r < freqAA + freqAa) gt = "Aa";
      else gt = "aa";
      pop.push({ id: i, genotype: gt, phenotype: getPhenotype(gt), x: Math.random() * 100, y: Math.random() * 100, alive: true });
    }
    genRef.current = 0;
    popRef.current = pop;
    histRef.current = [calcGenData(pop, 0)];
    setPopulation(pop);
    setGeneration(0);
    setHistory([calcGenData(pop, 0)]);
  }, [popSize, initFreq]);

  const step = useCallback(async () => {
    const pop = popRef.current.map(i => ({ ...i }));

    pop.forEach(ind => {
      if (!ind.alive) return;
      const fitness = getFitness(ind.phenotype, envType, selStr);
      if (Math.random() > fitness) ind.alive = false;
    });
    popRef.current = pop;
    setPopulation([...pop]);
    await new Promise(r => setTimeout(r, 800));

    const survivors = pop.filter(i => i.alive);
    if (survivors.length < 2) { runRef.current = false; setRunning(false); return; }

    const newPop: Individual[] = [];
    let nextId = pop.length;
    while (newPop.length < popSize) {
      const p1 = survivors[Math.floor(Math.random() * survivors.length)];
      const p2 = survivors[Math.floor(Math.random() * survivors.length)];
      const gt = combine(randAllele(p1.genotype), randAllele(p2.genotype));
      newPop.push({ id: nextId++, genotype: gt, phenotype: getPhenotype(gt), x: Math.random() * 100, y: Math.random() * 100, alive: true });
    }
    genRef.current += 1;
    popRef.current = newPop;
    const gd = calcGenData(newPop, genRef.current);
    histRef.current = [...histRef.current, gd];
    setPopulation([...newPop]);
    setGeneration(genRef.current);
    setHistory([...histRef.current]);
    await new Promise(r => setTimeout(r, 400));
  }, [envType, selStr, popSize]);

  const runLoop = useCallback(async () => {
    while (runRef.current && genRef.current < 50) {
      if (pauseRef.current) {
        await new Promise(r => setTimeout(r, 200));
        continue;
      }
      await step();
    }
    runRef.current = false;
    setRunning(false);
  }, [step]);

  const handleStart = useCallback(() => {
    if (!interactive) return;
    initPop();
    runRef.current = true;
    pauseRef.current = false;
    setRunning(true);
    setPaused(false);
    setTimeout(() => runLoop(), 100);
  }, [interactive, initPop, runLoop]);

  const handlePause = useCallback(() => {
    if (!interactive) return;
    pauseRef.current = !pauseRef.current;
    setPaused(pauseRef.current);
  }, [interactive]);

  const handleStop = useCallback(() => {
    if (!interactive) return;
    runRef.current = false;
    pauseRef.current = false;
    setRunning(false);
    setPaused(false);
  }, [interactive]);

  const handleReset = useCallback(() => {
    if (!interactive) return;
    runRef.current = false;
    pauseRef.current = false;
    setRunning(false);
    setPaused(false);
    setPopulation([]);
    setGeneration(0);
    setHistory([]);
  }, [interactive]);

  const curData = history[history.length - 1];

  const S = {
    host: { display: "block", fontFamily: "Manrope, sans-serif", padding: 24, background: "#faf9f5", borderRadius: 12, color: "#1b1c1a" },
    box: { maxWidth: 1200, margin: "0 auto" },
    title: { fontSize: "1.5rem", fontWeight: 700, color: "#1b1c1a", marginBottom: 24, textAlign: "center" as const },
    ctrlBox: { background: "#fff", padding: 20, borderRadius: 12, marginBottom: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" },
    row: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 },
    group: { marginBottom: 0 },
    label: { display: "block", fontSize: "0.9rem", fontWeight: 600, color: "#1b1c1a", marginBottom: 8 },
    rangeVal: { display: "inline-block", marginLeft: 12, fontWeight: 600, color: "#182544" },
    rangeInput: { width: "100%", padding: 0, border: "none" },
    selectInput: { width: "100%", padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: "0.9rem", fontFamily: "Manrope, sans-serif", boxSizing: "border-box" as const },
    btnRow: { display: "flex", gap: 12, marginTop: 20 },
    btn: (variant: "primary" | "warning" | "secondary") => ({
      padding: "10px 20px", border: "none", borderRadius: 6, fontSize: "0.9rem", fontWeight: 600,
      cursor: "pointer", color: "#fff",
      background: variant === "primary" ? "#182544" : variant === "warning" ? "#775a19" : "#6b7280",
    }),
    vizRow: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 24 },
    canvasBox: { background: "#fff", padding: 20, borderRadius: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" },
    sectionTitle: { fontSize: "1.1rem", fontWeight: 600, color: "#1b1c1a", marginBottom: 16 },
    statsBox: { background: "#fff", padding: 20, borderRadius: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" },
    statsGrid: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginTop: 16 },
    statCard: { padding: 16, background: "#f9fafb", borderRadius: 6, textAlign: "center" as const },
    statLabel: { fontSize: "0.85rem", color: "#6b7280", marginBottom: 8 },
    statValue: { fontSize: "1.5rem", fontWeight: 700, color: "#1b1c1a" },
    empty: { textAlign: "center" as const, padding: "60px 20px", color: "#9ca3af" },
  };

  return (
    <div style={S.host}>
      <div style={S.box}>
        <h2 style={S.title}>🦋 自然选择模拟器</h2>

        {interactive && (
          <>
            <div style={S.ctrlBox}>
              <div style={S.row}>
                <div style={S.group}>
                  <label style={S.label}>种群大小 <span style={S.rangeVal}>{popSize}</span></label>
                  <input type="range" min={50} max={200} step={10} value={popSize}
                    onChange={e => setPopSize(parseInt(e.target.value, 10))} disabled={running} style={S.rangeInput} />
                </div>
                <div style={S.group}>
                  <label style={S.label}>初始 A 等位基因频率 <span style={S.rangeVal}>{initFreq.toFixed(2)}</span></label>
                  <input type="range" min={0} max={1} step={0.05} value={initFreq}
                    onChange={e => setInitFreq(parseFloat(e.target.value))} disabled={running} style={S.rangeInput} />
                </div>
              </div>
              <div style={S.row}>
                <div style={S.group}>
                  <label style={S.label}>环境类型</label>
                  <select style={S.selectInput} value={envType} onChange={e => setEnvType(e.target.value)} disabled={running}>
                    <option value="dark">深色环境（有利于深色个体）</option>
                    <option value="light">浅色环境（有利于浅色个体）</option>
                  </select>
                </div>
                <div style={S.group}>
                  <label style={S.label}>选择压力强度 <span style={S.rangeVal}>{selStr.toFixed(2)}</span></label>
                  <input type="range" min={0} max={1} step={0.1} value={selStr}
                    onChange={e => setSelStr(parseFloat(e.target.value))} disabled={running} style={S.rangeInput} />
                </div>
              </div>

              <div style={S.btnRow}>
                <button style={S.btn("primary")} onClick={handleStart} disabled={running}>开始模拟</button>
                <button style={S.btn("warning")} onClick={handlePause} disabled={!running}>{paused ? "继续" : "暂停"}</button>
                <button style={S.btn("secondary")} onClick={handleStop} disabled={!running}>停止</button>
                <button style={S.btn("secondary")} onClick={handleReset} disabled={running}>重置</button>
              </div>
            </div>

            {population.length > 0 ? (
              <>
                <div style={S.vizRow}>
                  <div style={S.canvasBox}>
                    <h3 style={S.sectionTitle}>种群分布</h3>
                    <canvas ref={popCanvasRef} style={{ width: "100%", height: 400, border: "2px solid #e5e7eb", borderRadius: 6 }} />
                  </div>
                  <div style={S.canvasBox}>
                    <h3 style={S.sectionTitle}>等位基因频率变化</h3>
                    <canvas ref={freqCanvasRef} style={{ width: "100%", height: 400 }} />
                  </div>
                </div>

                {curData && (
                  <div style={S.statsBox}>
                    <h3 style={S.sectionTitle}>当前统计数据</h3>
                    <div style={S.statsGrid}>
                      <div style={S.statCard}><div style={S.statLabel}>当前世代</div><div style={S.statValue}>{curData.generation}</div></div>
                      <div style={S.statCard}><div style={S.statLabel}>种群数量</div><div style={S.statValue}>{curData.population}</div></div>
                      <div style={S.statCard}><div style={S.statLabel}>存活数量</div><div style={S.statValue}>{curData.survived}</div></div>
                      <div style={S.statCard}><div style={S.statLabel}>A 频率</div><div style={S.statValue}>{curData.freqA_allele.toFixed(3)}</div></div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div style={S.statsBox}>
                <div style={S.empty}>
                  <div style={{ fontSize: "3rem", marginBottom: 16 }}>🧬</div>
                  <div>点击"开始模拟"按钮运行自然选择模拟</div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
