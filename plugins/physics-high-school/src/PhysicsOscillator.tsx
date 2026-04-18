import { useEffect, useRef, useState, useCallback } from "react";

interface A2UINode {
  properties?: Record<string, unknown>;
}

function parseNum(val: unknown, fallback: number): number {
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}

function parseBool(val: unknown, fallback: boolean): boolean {
  return typeof val === "boolean" ? val : fallback;
}

export function PhysicsOscillator({ node }: { node: A2UINode }) {
  const props = node.properties ?? {};

  const initAmp = parseNum(props.amplitude, 1);
  const initFreq = parseNum(props.freq, 1);
  const initPhase = parseNum(props.phase, 0);
  const initInteractive = parseBool(props.interactive, true);

  const [amplitude, setAmplitude] = useState(initAmp);
  const [freq, setFreq] = useState(initFreq);
  const [phase, setPhase] = useState(initPhase);
  const [interactive, setInteractive] = useState(initInteractive);
  const [playing, setPlaying] = useState(true);
  const [liveDisp, setLiveDisp] = useState(0);

  useEffect(() => { setAmplitude(initAmp); }, [initAmp]);
  useEffect(() => { setFreq(initFreq); }, [initFreq]);
  useEffect(() => { setPhase(initPhase); }, [initPhase]);
  useEffect(() => { setInteractive(initInteractive); }, [initInteractive]);

  const waveCanvasRef = useRef<HTMLCanvasElement>(null);
  const springCanvasRef = useRef<HTMLCanvasElement>(null);
  const historyCanvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const timeRef = useRef<number>(0);
  const historyRef = useRef<number[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasWidth, setCanvasWidth] = useState(600);

  const HISTORY_MAX = 300;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setCanvasWidth(Math.floor(entry.contentRect.width));
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const drawSpring = useCallback((
    ctx: CanvasRenderingContext2D,
    W: number,
    H: number,
    displacement: number,
    dpr: number
  ) => {
    ctx.clearRect(0, 0, W, H);

    const wallX = 30 * dpr;
    const anchorY = H / 2;
    const massX = wallX + (W * 0.6 - wallX) * 0.5 + displacement * (W * 0.3);
    const massSize = 24 * dpr;
    const coils = 8;
    const coilWidth = 12 * dpr;

    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 2 * dpr;
    ctx.beginPath();
    ctx.moveTo(wallX - 10 * dpr, anchorY - 30 * dpr);
    ctx.lineTo(wallX - 10 * dpr, anchorY + 30 * dpr);
    ctx.stroke();

    ctx.strokeStyle = "#182544";
    ctx.lineWidth = 2 * dpr;
    ctx.beginPath();
    ctx.moveTo(wallX, anchorY);
    const springLen = massX - wallX;
    const segLen = springLen / (coils * 2 + 2);
    let x = wallX + segLen;
    ctx.lineTo(x, anchorY);
    for (let i = 0; i < coils * 2; i++) {
      x += segLen;
      const y = anchorY + (i % 2 === 0 ? -coilWidth : coilWidth);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(massX, anchorY);
    ctx.stroke();

    const grad = ctx.createLinearGradient(massX - massSize / 2, anchorY - massSize / 2, massX + massSize / 2, anchorY + massSize / 2);
    grad.addColorStop(0, "#182544");
    grad.addColorStop(1, "#334155");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(massX - massSize / 2, anchorY - massSize / 2, massSize, massSize, 4 * dpr);
    ctx.fill();

    ctx.fillStyle = "#fff";
    ctx.font = `${10 * dpr}px Manrope, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("m", massX, anchorY);

    if (Math.abs(displacement) > 0.05) {
      const arrowLen = Math.abs(displacement) * 40 * dpr;
      const arrowY = anchorY + massSize / 2 + 14 * dpr;
      const dir = displacement > 0 ? 1 : -1;
      ctx.strokeStyle = "#775a19";
      ctx.lineWidth = 2 * dpr;
      ctx.beginPath();
      ctx.moveTo(massX, arrowY);
      ctx.lineTo(massX + dir * arrowLen, arrowY);
      ctx.stroke();
      ctx.fillStyle = "#775a19";
      ctx.beginPath();
      ctx.moveTo(massX + dir * arrowLen, arrowY);
      ctx.lineTo(massX + dir * (arrowLen - 6 * dpr), arrowY - 4 * dpr);
      ctx.lineTo(massX + dir * (arrowLen - 6 * dpr), arrowY + 4 * dpr);
      ctx.closePath();
      ctx.fill();
    }
  }, []);

  const drawWave = useCallback((
    ctx: CanvasRenderingContext2D,
    W: number,
    H: number,
    t: number,
    dpr: number
  ) => {
    ctx.clearRect(0, 0, W, H);

    ctx.strokeStyle = "rgba(24,37,68,0.08)";
    ctx.lineWidth = 1;
    for (const y of [H * 0.25, H * 0.5, H * 0.75]) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }

    const omega = 2 * Math.PI * freq;
    const ampPx = (Math.min(amplitude, 10) / 10) * (H / 2) * 0.8;

    ctx.strokeStyle = "rgba(24,37,68,0.12)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, H / 2);
    ctx.lineTo(W, H / 2);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.strokeStyle = "#182544";
    ctx.lineWidth = 2.5 * dpr;
    ctx.beginPath();
    for (let x = 0; x < W; x++) {
      const y = H / 2 - ampPx * Math.sin(omega * (x / W) * 4 + phase + t * omega);
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();

    const dotX = W * 0.75;
    const dotY = H / 2 - ampPx * Math.sin(omega * (dotX / W) * 4 + phase + t * omega);
    ctx.fillStyle = "#775a19";
    ctx.beginPath();
    ctx.arc(dotX, dotY, 6 * dpr, 0, 2 * Math.PI);
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2 * dpr;
    ctx.stroke();

    ctx.fillStyle = "#6b7280";
    ctx.font = `${10 * dpr}px Manrope, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("x", W / 2, H - 4 * dpr);
    ctx.save();
    ctx.translate(10 * dpr, H / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("y", 0, 0);
    ctx.restore();
  }, [amplitude, freq, phase]);

  const drawHistory = useCallback((
    ctx: CanvasRenderingContext2D,
    W: number,
    H: number,
    dpr: number
  ) => {
    ctx.clearRect(0, 0, W, H);

    ctx.strokeStyle = "rgba(24,37,68,0.08)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, H / 2);
    ctx.lineTo(W, H / 2);
    ctx.stroke();

    const history = historyRef.current;
    if (history.length < 2) return;

    ctx.strokeStyle = "#775a19";
    ctx.lineWidth = 2 * dpr;
    ctx.beginPath();
    const step = W / HISTORY_MAX;
    for (let i = 0; i < history.length; i++) {
      const x = i * step;
      const y = H / 2 - history[i] * (H / 2) * 0.85;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();

    ctx.fillStyle = "#6b7280";
    ctx.font = `${9 * dpr}px Manrope, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("时间 t", W / 2, H - 2 * dpr);
    ctx.save();
    ctx.translate(8 * dpr, H / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("位移 x(t)", 0, 0);
    ctx.restore();
  }, []);

  useEffect(() => {
    const waveCanvas = waveCanvasRef.current;
    const springCanvas = springCanvasRef.current;
    const histCanvas = historyCanvasRef.current;
    if (!waveCanvas || !springCanvas || !histCanvas) return;

    const dpr = window.devicePixelRatio || 1;
    const W1 = canvasWidth * dpr;
    const H1 = 160 * dpr;
    const H2 = 100 * dpr;
    const H3 = 100 * dpr;

    waveCanvas.width = W1;
    waveCanvas.height = H1;
    waveCanvas.style.width = `${canvasWidth}px`;
    waveCanvas.style.height = "160px";

    springCanvas.width = W1;
    springCanvas.height = H2;
    springCanvas.style.width = `${canvasWidth}px`;
    springCanvas.style.height = "100px";

    histCanvas.width = W1;
    histCanvas.height = H3;
    histCanvas.style.width = `${canvasWidth}px`;
    histCanvas.style.height = "100px";

    const wCtx = waveCanvas.getContext("2d")!;
    const sCtx = springCanvas.getContext("2d")!;
    const hCtx = histCanvas.getContext("2d")!;

    function animate() {
      if (playing) {
        timeRef.current += 0.02;
      }
      const t = timeRef.current;

      drawWave(wCtx, W1, H1, t, dpr);

      const omega = 2 * Math.PI * freq;
      const disp = Math.sin(omega * t + phase) * (amplitude / 10);
      drawSpring(sCtx, W1, H2, disp, dpr);

      if (playing) {
        historyRef.current.push(disp);
        if (historyRef.current.length > HISTORY_MAX) {
          historyRef.current.shift();
        }
        setLiveDisp(Math.sin(omega * t + phase) * amplitude);
      }
      drawHistory(hCtx, W1, H3, dpr);

      animRef.current = requestAnimationFrame(animate);
    }

    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, [amplitude, freq, phase, playing, canvasWidth, drawWave, drawSpring, drawHistory]);

  const togglePlay = useCallback(() => setPlaying((p) => !p), []);
  const handleReset = useCallback(() => {
    timeRef.current = 0;
    historyRef.current = [];
    setPlaying(true);
  }, []);

  const sliderStyle: React.CSSProperties = {
    flex: 1,
    height: 4,
    borderRadius: 2,
    background: "rgba(24,37,68,0.1)",
    appearance: "none",
    outline: "none",
  };

  const btnStyle: React.CSSProperties = {
    padding: "6px 16px",
    borderRadius: 8,
    border: "none",
    fontWeight: 600,
    fontSize: 12,
    cursor: "pointer",
    fontFamily: "Manrope, sans-serif",
    transition: "all 0.2s",
  };

  const sectionLabel: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
    color: "#6b7280",
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
    marginBottom: 4,
  };

  return (
    <div ref={containerRef} style={{ background: "#faf9f5", borderRadius: 12, padding: 16, fontFamily: "Manrope, sans-serif", width: "100%", boxSizing: "border-box" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#182544" }}>简谐运动模拟器</div>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            onClick={togglePlay}
            style={{ ...btnStyle, background: playing ? "#182544" : "#fff", color: playing ? "#fff" : "#182544", border: playing ? "none" : "1px solid #e5e7eb" }}
          >
            {playing ? "⏸ 暂停" : "▶ 播放"}
          </button>
          <button
            onClick={handleReset}
            style={{ ...btnStyle, background: "#fff", color: "#6b7280", border: "1px solid #e5e7eb" }}
          >
            ↺ 重置
          </button>
        </div>
      </div>

      <div style={sectionLabel}>波形图 y(x, t)</div>
      <canvas ref={waveCanvasRef} style={{ display: "block", borderRadius: 8, background: "#fff", width: "100%", marginBottom: 8 }} />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
        <div>
          <div style={sectionLabel}>弹簧质点</div>
          <canvas ref={springCanvasRef} style={{ display: "block", borderRadius: 8, background: "#fff", width: "100%" }} />
        </div>
        <div>
          <div style={sectionLabel}>位移-时间图 x(t)</div>
          <canvas ref={historyCanvasRef} style={{ display: "block", borderRadius: 8, background: "#fff", width: "100%" }} />
        </div>
      </div>

      {interactive && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ minWidth: 50, fontSize: 12, color: "#1b1c1a" }}>振幅</span>
            <input type="range" min={0} max={10} step={0.1} value={amplitude} onChange={(e) => setAmplitude(Number(e.target.value))} style={sliderStyle} />
            <span style={{ minWidth: 40, textAlign: "right", fontSize: 12, color: "rgba(24,37,68,0.6)" }}>{amplitude.toFixed(1)}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ minWidth: 50, fontSize: 12, color: "#1b1c1a" }}>频率</span>
            <input type="range" min={0.1} max={5} step={0.1} value={freq} onChange={(e) => setFreq(Number(e.target.value))} style={sliderStyle} />
            <span style={{ minWidth: 50, textAlign: "right", fontSize: 12, color: "rgba(24,37,68,0.6)" }}>{freq.toFixed(1)} Hz</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ minWidth: 50, fontSize: 12, color: "#1b1c1a" }}>相位</span>
            <input type="range" min={0} max={6.28} step={0.01} value={phase} onChange={(e) => setPhase(Number(e.target.value))} style={sliderStyle} />
            <span style={{ minWidth: 50, textAlign: "right", fontSize: 12, color: "rgba(24,37,68,0.6)" }}>{phase.toFixed(2)} rad</span>
          </div>
        </div>
      )}

      <div style={{ marginTop: 10, padding: 10, background: "#fff", borderRadius: 8, border: "1px solid #e5e7eb", display: "flex", justifyContent: "space-around", fontSize: 12 }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ color: "#6b7280", fontSize: 10 }}>位移</div>
          <div style={{ fontWeight: 600, color: "#182544" }}>
            {liveDisp.toFixed(2)}
          </div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ color: "#6b7280", fontSize: 10 }}>周期</div>
          <div style={{ fontWeight: 600, color: "#182544" }}>
            {freq > 0 ? (1 / freq).toFixed(2) : "∞"} s
          </div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ color: "#6b7280", fontSize: 10 }}>角频率</div>
          <div style={{ fontWeight: 600, color: "#182544" }}>
            {(2 * Math.PI * freq).toFixed(2)} rad/s
          </div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ color: "#6b7280", fontSize: 10 }}>能量比</div>
          <div style={{ fontWeight: 600, color: "#182544" }}>
            {(amplitude * amplitude).toFixed(2)}
          </div>
        </div>
      </div>
    </div>
  );
}

export default PhysicsOscillator;
