import { useState, useEffect, useRef, useCallback } from "react";

interface A2UINode {
  properties?: Record<string, unknown>;
}

function parseStr(val: unknown, fallback: string): string {
  return typeof val === "string" ? val : fallback;
}

function parseNum(val: unknown, fallback: number): number {
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}

type Phase = "idle" | "replication" | "transcription" | "translation" | "completed";

const BASE_COLORS: Record<string, string> = {
  A: "#ef4444",
  T: "#2563eb",
  C: "#16a34a",
  G: "#ca8a04",
  U: "#7c3aed",
};

const CODON_TABLE: Record<string, string> = {
  AUG: "甲硫氨酸 Met", UUU: "苯丙氨酸 Phe", UUC: "苯丙氨酸 Phe",
  UUA: "亮氨酸 Leu", UUG: "亮氨酸 Leu", CUU: "亮氨酸 Leu",
  CUC: "亮氨酸 Leu", CUA: "亮氨酸 Leu", CUG: "亮氨酸 Leu",
  AUU: "异亮氨酸 Ile", AUC: "异亮氨酸 Ile", AUA: "异亮氨酸 Ile",
  GUU: "缬氨酸 Val", GUC: "缬氨酸 Val", GUA: "缬氨酸 Val", GUG: "缬氨酸 Val",
  UCU: "丝氨酸 Ser", UCC: "丝氨酸 Ser", UCA: "丝氨酸 Ser", UCG: "丝氨酸 Ser",
  AGU: "丝氨酸 Ser", AGC: "丝氨酸 Ser",
  CCU: "脯氨酸 Pro", CCC: "脯氨酸 Pro", CCA: "脯氨酸 Pro", CCG: "脯氨酸 Pro",
  ACU: "苏氨酸 Thr", ACC: "苏氨酸 Thr", ACA: "苏氨酸 Thr", ACG: "苏氨酸 Thr",
  GCU: "丙氨酸 Ala", GCC: "丙氨酸 Ala", GCA: "丙氨酸 Ala", GCG: "丙氨酸 Ala",
  UAU: "酪氨酸 Tyr", UAC: "酪氨酸 Tyr",
  CAU: "组氨酸 His", CAC: "组氨酸 His", CAA: "谷氨酰胺 Gln", CAG: "谷氨酰胺 Gln",
  AAU: "天冬酰胺 Asn", AAC: "天冬酰胺 Asn", AAA: "赖氨酸 Lys", AAG: "赖氨酸 Lys",
  GAU: "天冬氨酸 Asp", GAC: "天冬氨酸 Asp", GAA: "谷氨酸 Glu", GAG: "谷氨酸 Glu",
  UGU: "半胱氨酸 Cys", UGC: "半胱氨酸 Cys", UGG: "色氨酸 Trp",
  CGU: "精氨酸 Arg", CGC: "精氨酸 Arg", CGA: "精氨酸 Arg", CGG: "精氨酸 Arg",
  AGA: "精氨酸 Arg", AGG: "精氨酸 Arg",
  GGU: "甘氨酸 Gly", GGC: "甘氨酸 Gly", GGA: "甘氨酸 Gly", GGG: "甘氨酸 Gly",
  UAA: "终止 Stop", UAG: "终止 Stop", UGA: "终止 Stop",
};

function getComplement(base: string, toRna: boolean): string {
  if (toRna) return ({ A: "U", T: "A", C: "G", G: "C" } as Record<string, string>)[base] ?? base;
  return ({ A: "T", T: "A", C: "G", G: "C" } as Record<string, string>)[base] ?? base;
}

function normalize(seq: string): string {
  return seq.toUpperCase().replace(/[^ATCG]/g, "");
}

function computeSnapshot(dna: string) {
  const compDna = dna.split("").map((b) => getComplement(b, false)).join("");
  const mrna = dna.split("").map((b) => getComplement(b, true)).join("");
  const protein: string[] = [];
  for (let i = 0; i < mrna.length; i += 3) {
    const codon = mrna.slice(i, i + 3);
    if (codon.length < 3) break;
    const aa = CODON_TABLE[codon] ?? "未知";
    protein.push(aa);
    if (aa.includes("Stop")) break;
  }
  return { dna, compDna, mrna, protein };
}

export function CentralDogma({ node }: { node: A2UINode }) {
  const props = node.properties ?? {};

  const initDna = normalize(parseStr(props.dnaSequence, "ATCGATCG")) || "ATCGATCG";
  const initSpeed = parseNum(props.animationSpeed, 800);

  const [dna, setDna] = useState(initDna);
  const [speed, setSpeed] = useState(initSpeed);
  const [phase, setPhase] = useState<Phase>("idle");
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => { setDna(initDna); setPhase("idle"); setStep(0); setPlaying(false); }, [initDna]);
  useEffect(() => { setSpeed(initSpeed); }, [initSpeed]);
  useEffect(() => { return () => { if (timerRef.current !== null) clearTimeout(timerRef.current); }; }, []);

  const snap = computeSnapshot(dna);

  const phaseLength =
    phase === "translation"
      ? Math.max(1, Math.ceil(snap.mrna.length / 3))
      : Math.max(1, snap.dna.length);

  const PHASE_LABELS: Record<string, string> = {
    idle: "准备",
    replication: "DNA 复制",
    transcription: "转录",
    translation: "翻译",
  };

  const statusText =
    phase === "idle"
      ? "选择一个阶段后，可以播放该过程的逐步演示。"
      : phase === "completed"
      ? "中心法则流程已完成。"
      : `${PHASE_LABELS[phase]} 进度 ${Math.min(step, phaseLength)} / ${phaseLength}`;

  const doSetPhase = useCallback((p: Phase) => {
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    setPlaying(false);
    setPhase(p);
    setStep(0);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!playing) return;
    stopTimer();
    timerRef.current = window.setTimeout(() => {
      setStep((prev) => {
        const next = prev + 1;
        if (next >= phaseLength) {
          setPlaying(false);
          setPhase("completed");
          return phaseLength;
        }
        return next;
      });
    }, speed);
    return () => stopTimer();
  }, [playing, step, phaseLength, speed, stopTimer]);

  const togglePlay = useCallback(() => {
    if (phase === "idle") doSetPhase("replication");
    setPlaying((p) => !p);
  }, [phase, doSetPhase]);

  const doReset = useCallback(() => {
    stopTimer();
    setPlaying(false);
    setStep(0);
  }, [stopTimer]);

  const visibleCount = Math.max(0, Math.min(step, phaseLength));
  const visibleCodons = Math.max(0, Math.min(step, Math.ceil(snap.mrna.length / 3)));

  const btnStyle = (active: boolean): React.CSSProperties => ({
    border: "1px solid",
    borderColor: active ? "#182544" : "#d1d5db",
    background: active ? "#182544" : "#fff",
    color: active ? "#fff" : "#182544",
    borderRadius: 10,
    padding: "8px 14px",
    fontSize: 13,
    cursor: "pointer",
    fontFamily: "Manrope, sans-serif",
    transition: "all 0.2s",
  });

  const baseEl = (base: string, active: boolean, key: number) => (
    <span
      key={key}
      style={{
        minWidth: 28,
        height: 28,
        borderRadius: 8,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 700,
        fontSize: 13,
        color: "#fff",
        background: BASE_COLORS[base] ?? "#6b7280",
        opacity: active ? 1 : 0.3,
      }}
    >
      {base}
    </span>
  );

  return (
    <div style={{ background: "#faf9f5", borderRadius: 12, padding: 16, fontFamily: "Manrope, sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#182544" }}>中心法则演示</div>
          <div style={{ fontSize: 12, color: "#6b7280" }}>DNA 序列：{dna}</div>
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
        <button style={btnStyle(phase === "replication")} onClick={() => doSetPhase("replication")}>DNA 复制</button>
        <button style={btnStyle(phase === "transcription")} onClick={() => doSetPhase("transcription")}> 转录</button>
        <button style={btnStyle(phase === "translation")} onClick={() => doSetPhase("translation")}> 翻译</button>
        <button style={{ ...btnStyle(false), background: "#f3f4f6" }} onClick={togglePlay}>
          {playing ? "暂停" : "播放"}
        </button>
        <button style={{ ...btnStyle(false), background: "#f3f4f6" }} onClick={doReset}>重置</button>
      </div>

      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 14, padding: 16 }}>
        <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 10 }}>{statusText}</div>

        {(phase === "translation" || phase === "completed") ? (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "80px 1fr", gap: 10, alignItems: "start", marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: "#6b7280", paddingTop: 6 }}>mRNA</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {snap.mrna.split("").map((b, i) => baseEl(b, i < visibleCodons * 3 || phase === "completed", i))}
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "80px 1fr", gap: 10, alignItems: "start" }}>
              <div style={{ fontSize: 12, color: "#6b7280", paddingTop: 6 }}>蛋白链</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {snap.protein.slice(0, visibleCodons).length > 0
                  ? snap.protein.slice(0, visibleCodons).map((aa, i) => (
                      <span key={i} style={{ padding: "5px 10px", borderRadius: 999, background: "#dbeafe", color: "#1d4ed8", fontSize: 11, fontWeight: 600 }}>
                        {aa}
                      </span>
                    ))
                  : <span style={{ color: "#9ca3af", fontSize: 12 }}>等待翻译开始</span>
                }
              </div>
            </div>
          </>
        ) : phase === "transcription" ? (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "80px 1fr", gap: 10, alignItems: "start", marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: "#6b7280", paddingTop: 6 }}>DNA 模板链</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {snap.dna.split("").map((b, i) => baseEl(b, true, i))}
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "80px 1fr", gap: 10, alignItems: "start" }}>
              <div style={{ fontSize: 12, color: "#6b7280", paddingTop: 6 }}>mRNA</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {snap.mrna.split("").map((b, i) => baseEl(b, i < visibleCount, i))}
              </div>
            </div>
          </>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "80px 1fr", gap: 10, alignItems: "start", marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: "#6b7280", paddingTop: 6 }}>DNA</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {snap.dna.split("").map((b, i) => baseEl(b, true, i))}
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "80px 1fr", gap: 10, alignItems: "start" }}>
              <div style={{ fontSize: 12, color: "#6b7280", paddingTop: 6 }}>互补链</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {snap.compDna.split("").map((b, i) => baseEl(b, i < visibleCount, i))}
              </div>
            </div>
          </>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, marginTop: 14 }}>
          <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 10, background: "#f9fafb" }}>
            <h3 style={{ margin: "0 0 6px", fontSize: 12, color: "#182544" }}>互补 DNA</h3>
            <p style={{ margin: 0, fontSize: 11, color: "#4b5563", wordBreak: "break-all" }}>{snap.compDna}</p>
          </div>
          <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 10, background: "#f9fafb" }}>
            <h3 style={{ margin: "0 0 6px", fontSize: 12, color: "#182544" }}>mRNA</h3>
            <p style={{ margin: 0, fontSize: 11, color: "#4b5563", wordBreak: "break-all" }}>{snap.mrna}</p>
          </div>
          <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 10, background: "#f9fafb" }}>
            <h3 style={{ margin: "0 0 6px", fontSize: 12, color: "#182544" }}>蛋白质</h3>
            <p style={{ margin: 0, fontSize: 11, color: "#4b5563" }}>
              {snap.protein.length > 0 ? snap.protein.join(" / ") : "尚未生成完整蛋白质链"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CentralDogma;
