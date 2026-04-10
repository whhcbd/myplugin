import { useEffect, useRef, useState } from "react";

interface A2UINode {
  properties?: Record<string, unknown>;
}

function parseNum(val: unknown, fallback: number): number {
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}

export function PhysicsOscillator({ node }: { node: A2UINode }) {
  const props = node.properties ?? {};

  const initAmp = parseNum(props.amplitude, 1);
  const initFreq = parseNum(props.freq, 1);
  const initPhase = parseNum(props.phase, 0);

  const [amplitude, setAmplitude] = useState(initAmp);
  const [freq, setFreq] = useState(initFreq);
  const [phase, setPhase] = useState(initPhase);

  useEffect(() => {
    setAmplitude(initAmp);
  }, [initAmp]);
  useEffect(() => {
    setFreq(initFreq);
  }, [initFreq]);
  useEffect(() => {
    setPhase(initPhase);
  }, [initPhase]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const timeRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;

    function draw() {
      if (!ctx) return;
      timeRef.current += 0.02;
      const t = timeRef.current;

      ctx.clearRect(0, 0, W, H);

      ctx.strokeStyle = "rgba(24,37,68,0.1)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, H / 2);
      ctx.lineTo(W, H / 2);
      ctx.stroke();

      ctx.strokeStyle = "#182544";
      ctx.lineWidth = 2.5;
      ctx.beginPath();

      const omega = 2 * Math.PI * freq;
      const ampPx = (Math.min(amplitude, 10) / 10) * (H / 2) * 0.85;

      for (let x = 0; x < W; x++) {
        const y = H / 2 - ampPx * Math.sin(omega * (x / W) * 4 + phase + t * omega);
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();

      ctx.fillStyle = "#775a19";
      const dotX = W * 0.75;
      const dotY = H / 2 - ampPx * Math.sin(omega * (dotX / W) * 4 + phase + t * omega);
      ctx.beginPath();
      ctx.arc(dotX, dotY, 5, 0, 2 * Math.PI);
      ctx.fill();

      animRef.current = requestAnimationFrame(draw);
    }

    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [amplitude, freq, phase]);

  const sliderStyle: React.CSSProperties = {
    flex: 1,
    height: 4,
    borderRadius: 2,
    background: "rgba(24,37,68,0.1)",
    appearance: "none",
    outline: "none",
  };

  const labelStyle: React.CSSProperties = {
    minWidth: 60,
    fontSize: 12,
    fontFamily: "Manrope, sans-serif",
    color: "#1b1c1a",
  };

  const valueStyle: React.CSSProperties = {
    minWidth: 40,
    textAlign: "right",
    fontSize: 12,
    fontFamily: "Manrope, sans-serif",
    color: "rgba(24,37,68,0.6)",
  };

  return (
    <div
      style={{
        background: "#faf9f5",
        borderRadius: 12,
        padding: 16,
        display: "inline-block",
        fontFamily: "Manrope, sans-serif",
      }}
    >
      <div
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: "#182544",
          marginBottom: 8,
        }}
      >
        简谐运动模拟器
      </div>
      <canvas
        ref={canvasRef}
        width={400}
        height={150}
        style={{
          display: "block",
          borderRadius: 8,
          background: "#fff",
        }}
      />
      <div
        style={{
          marginTop: 12,
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={labelStyle}>振幅</span>
          <input
            type="range"
            min={0}
            max={10}
            step={0.1}
            value={amplitude}
            onChange={(e) => setAmplitude(Number(e.target.value))}
            style={sliderStyle}
          />
          <span style={valueStyle}>{amplitude.toFixed(1)}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={labelStyle}>频率</span>
          <input
            type="range"
            min={0.1}
            max={5}
            step={0.1}
            value={freq}
            onChange={(e) => setFreq(Number(e.target.value))}
            style={sliderStyle}
          />
          <span style={valueStyle}>{freq.toFixed(1)} Hz</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={labelStyle}>相位</span>
          <input
            type="range"
            min={0}
            max={6.28}
            step={0.01}
            value={phase}
            onChange={(e) => setPhase(Number(e.target.value))}
            style={sliderStyle}
          />
          <span style={valueStyle}>{phase.toFixed(2)} rad</span>
        </div>
      </div>
    </div>
  );
}

export default PhysicsOscillator;
