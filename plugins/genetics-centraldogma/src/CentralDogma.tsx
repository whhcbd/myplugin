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

function parseBool(val: unknown, fallback: boolean): boolean {
  if (typeof val === "boolean") return val;
  if (val === "true" || val === "1") return true;
  if (val === "false" || val === "0") return false;
  return fallback;
}

type Phase =
  | "idle"
  | "replication"
  | "transcription"
  | "translation"
  | "reverseTranscription"
  | "rnaReplication"
  | "completed";

type Level = "junior" | "senior" | "exam";

const BASE_COLORS: Record<string, string> = {
  A: "#ef4444",
  T: "#2563eb",
  C: "#16a34a",
  G: "#ca8a04",
  U: "#7c3aed",
};

const CODON_TABLE: Record<string, string> = {
  AUG: "甲硫氨酸 Met",
  UUU: "苯丙氨酸 Phe",
  UUC: "苯丙氨酸 Phe",
  UUA: "亮氨酸 Leu",
  UUG: "亮氨酸 Leu",
  CUU: "亮氨酸 Leu",
  CUC: "亮氨酸 Leu",
  CUA: "亮氨酸 Leu",
  CUG: "亮氨酸 Leu",
  AUU: "异亮氨酸 Ile",
  AUC: "异亮氨酸 Ile",
  AUA: "异亮氨酸 Ile",
  GUU: "缬氨酸 Val",
  GUC: "缬氨酸 Val",
  GUA: "缬氨酸 Val",
  GUG: "缬氨酸 Val",
  UCU: "丝氨酸 Ser",
  UCC: "丝氨酸 Ser",
  UCA: "丝氨酸 Ser",
  UCG: "丝氨酸 Ser",
  AGU: "丝氨酸 Ser",
  AGC: "丝氨酸 Ser",
  CCU: "脯氨酸 Pro",
  CCC: "脯氨酸 Pro",
  CCA: "脯氨酸 Pro",
  CCG: "脯氨酸 Pro",
  ACU: "苏氨酸 Thr",
  ACC: "苏氨酸 Thr",
  ACA: "苏氨酸 Thr",
  ACG: "苏氨酸 Thr",
  GCU: "丙氨酸 Ala",
  GCC: "丙氨酸 Ala",
  GCA: "丙氨酸 Ala",
  GCG: "丙氨酸 Ala",
  UAU: "酪氨酸 Tyr",
  UAC: "酪氨酸 Tyr",
  CAU: "组氨酸 His",
  CAC: "组氨酸 His",
  CAA: "谷氨酰胺 Gln",
  CAG: "谷氨酰胺 Gln",
  AAU: "天冬酰胺 Asn",
  AAC: "天冬酰胺 Asn",
  AAA: "赖氨酸 Lys",
  AAG: "赖氨酸 Lys",
  GAU: "天冬氨酸 Asp",
  GAC: "天冬氨酸 Asp",
  GAA: "谷氨酸 Glu",
  GAG: "谷氨酸 Glu",
  UGU: "半胱氨酸 Cys",
  UGC: "半胱氨酸 Cys",
  UGG: "色氨酸 Trp",
  CGU: "精氨酸 Arg",
  CGC: "精氨酸 Arg",
  CGA: "精氨酸 Arg",
  CGG: "精氨酸 Arg",
  AGA: "精氨酸 Arg",
  AGG: "精氨酸 Arg",
  GGU: "甘氨酸 Gly",
  GGC: "甘氨酸 Gly",
  GGA: "甘氨酸 Gly",
  GGG: "甘氨酸 Gly",
  UAA: "终止 Stop",
  UAG: "终止 Stop",
  UGA: "终止 Stop",
};

interface ProcessDetail {
  template: string;
  rawMaterial: string;
  product: string;
  enzyme: string;
  location: string;
  basePairing: string;
  direction: string;
  notes: string[];
  minLevel: Level;
}

const PROCESS_DETAILS: Record<string, ProcessDetail> = {
  replication: {
    template: "DNA双链",
    rawMaterial: "脱氧核苷酸(dNTP)",
    product: "子代DNA(半保留复制)",
    enzyme: "解旋酶、DNA聚合酶",
    location: "细胞核（主要）、线粒体、叶绿体",
    basePairing: "A—T、G—C",
    direction: "DNA → DNA",
    notes: [
      "半保留复制：每条子代DNA含一条亲代链和一条新合成链",
      "边解旋边复制，多起点双向复制（真核）",
      "需要RNA引物提供3'-OH端",
    ],
    minLevel: "junior",
  },
  transcription: {
    template: "DNA一条链（模板链/反义链）",
    rawMaterial: "核糖核苷酸(NTP)",
    product: "mRNA / tRNA / rRNA等",
    enzyme: "RNA聚合酶",
    location: "细胞核（主要）",
    basePairing: "A→U、T→A、G→C",
    direction: "DNA → RNA",
    notes: [
      "真核：转录后mRNA需加工（剪接去内含子、5'加帽、3'加尾）",
      "原核：边转录边翻译（时空偶联）",
      "编码链（非模板链）序列与mRNA相同（T换U）",
    ],
    minLevel: "junior",
  },
  translation: {
    template: "mRNA",
    rawMaterial: "氨基酸（20种）",
    product: "多肽链/蛋白质",
    enzyme: "—（核糖体催化）",
    location: "核糖体",
    basePairing: "密码子—反密码子（mRNA-tRNA）",
    direction: "RNA → 蛋白质",
    notes: [
      "起始密码子：AUG（编码甲硫氨酸）",
      "终止密码子：UAA / UAG / UGA（不编码氨基酸）",
      "tRNA携带氨基酸，反密码子与密码子互补配对",
      "密码子简并性：一种氨基酸可有多种密码子",
    ],
    minLevel: "junior",
  },
  reverseTranscription: {
    template: "RNA（病毒基因组）",
    rawMaterial: "脱氧核苷酸",
    product: "DNA(cDNA)",
    enzyme: "逆转录酶",
    location: "宿主细胞质",
    basePairing: "A—T、U—A、G—C",
    direction: "RNA → DNA",
    notes: [
      "仅发生于逆转录病毒（如HIV、致癌RNA病毒）",
      "不是细胞正常生理过程",
      "产物cDNA可整合到宿主基因组中",
    ],
    minLevel: "senior",
  },
  rnaReplication: {
    template: "RNA（病毒基因组）",
    rawMaterial: "核糖核苷酸",
    product: "子代RNA",
    enzyme: "RNA复制酶(RdRp)",
    location: "宿主细胞质",
    basePairing: "A—U、G—C",
    direction: "RNA → RNA",
    notes: [
      "仅发生于RNA复制病毒（如TMV、新冠病毒）",
      "不是细胞正常生理过程",
      "宿主细胞不含RNA复制酶",
    ],
    minLevel: "senior",
  },
};

const MISCONCEPTIONS: Record<string, string[]> = {
  replication: [
    "解旋酶解开双链 → DNA聚合酶合成新链，二者功能不同",
    "半保留复制≠全保留复制：两条子链各含一条旧链一条新链",
  ],
  transcription: [
    "转录发生在细胞核，不是核糖体（核糖体是翻译的场所）",
    "转录需要RNA聚合酶，不是DNA聚合酶",
    "真核mRNA需加工后才能翻译，原核则边转录边翻译",
  ],
  translation: [
    "翻译以mRNA为模板，不是DNA",
    "密码子在mRNA上；tRNA上的是反密码子，不叫密码子",
    "终止密码子(UAA/UAG/UGA)不编码任何氨基酸",
  ],
  reverseTranscription: [
    "逆转录仅发生于逆转录病毒侵染宿主时",
    "正常人体细胞不会进行逆转录",
  ],
  rnaReplication: [
    "RNA复制仅发生于RNA病毒",
    "细胞生物不含RNA复制酶，不能独立进行RNA复制",
  ],
};

const LEVEL_LABELS: Record<Level, string> = {
  junior: "初中",
  senior: "高中",
  exam: "高考",
};

const LEVEL_ORDER: Record<Level, number> = {
  junior: 0,
  senior: 1,
  exam: 2,
};

const PHASE_LABELS: Record<string, string> = {
  idle: "准备",
  replication: "DNA复制",
  transcription: "转录",
  translation: "翻译",
  reverseTranscription: "逆转录",
  rnaReplication: "RNA复制",
};

function getComplement(base: string, toRna: boolean): string {
  if (toRna)
    return ({ A: "U", T: "A", C: "G", G: "C" } as Record<string, string>)[
      base
    ] ?? base;
  return ({ A: "T", T: "A", C: "G", G: "C" } as Record<string, string>)[
    base
  ] ?? base;
}

function normalize(seq: string): string {
  return seq.toUpperCase().replace(/[^ATCG]/g, "");
}

function computeSnapshot(dna: string) {
  const compDna = dna
    .split("")
    .map((b) => getComplement(b, false))
    .join("");
  const mrna = dna
    .split("")
    .map((b) => getComplement(b, true))
    .join("");
  const protein: string[] = [];
  for (let i = 0; i < mrna.length; i += 3) {
    const codon = mrna.slice(i, i + 3);
    if (codon.length < 3) break;
    const aa = CODON_TABLE[codon] ?? "未知";
    protein.push(aa);
    if (aa.includes("Stop")) break;
  }
  const codons: string[] = [];
  for (let i = 0; i < mrna.length; i += 3) {
    const codon = mrna.slice(i, i + 3);
    if (codon.length === 3) codons.push(codon);
  }
  return { dna, compDna, mrna, protein, codons };
}

export function CentralDogma({ node }: { node: A2UINode }) {
  const props = node.properties ?? {};

  const initDna = normalize(parseStr(props.dnaSequence, "ATCGATCG")) || "ATCGATCG";
  const initSpeed = parseNum(props.animationSpeed, 1000);
  const initLevel = (() => {
    const v = parseStr(props.level, "senior");
    return v === "junior" || v === "senior" || v === "exam" ? v : "senior";
  })();
  const initShowCodon = parseBool(props.showCodonTable, false);

  const [dna, setDna] = useState(initDna);
  const [speed, setSpeed] = useState(initSpeed);
  const [level, setLevel] = useState<Level>(initLevel);
  const [showCodon, setShowCodon] = useState(initShowCodon);
  const [phase, setPhase] = useState<Phase>("idle");
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    setDna(initDna);
    setPhase("idle");
    setStep(0);
    setPlaying(false);
  }, [initDna]);
  useEffect(() => {
    setSpeed(initSpeed);
  }, [initSpeed]);
  useEffect(() => {
    setLevel(initLevel);
  }, [initLevel]);
  useEffect(() => {
    setShowCodon(initShowCodon);
  }, [initShowCodon]);
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, []);

  const snap = computeSnapshot(dna);

  const isAdvancedPhase =
    phase === "reverseTranscription" || phase === "rnaReplication";

  const phaseLength = (() => {
    if (phase === "translation") return Math.max(1, snap.codons.length);
    if (phase === "reverseTranscription" || phase === "rnaReplication")
      return Math.max(1, snap.mrna.length);
    return Math.max(1, snap.dna.length);
  })();

  const statusText =
    phase === "idle"
      ? "选择一个阶段后，可以播放该过程的逐步演示。"
      : phase === "completed"
      ? "当前阶段流程已完成。"
      : `${PHASE_LABELS[phase] || ""} 进度 ${Math.min(step, phaseLength)} / ${phaseLength}`;

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
  const visibleCodons = Math.max(0, Math.min(step, snap.codons.length));

  const LEVEL_TIER: Record<Level, number> = { junior: 0, senior: 1, exam: 2 };
  const isLevelVisible = (minLevel: Level) =>
    LEVEL_TIER[level] >= LEVEL_TIER[minLevel];

  const S: Record<string, React.CSSProperties> = {
    root: {
      background: "#faf9f5",
      borderRadius: 12,
      padding: 16,
      fontFamily: "Manrope, sans-serif",
      color: "#1b1c1a",
      fontSize: 13,
      lineHeight: 1.6,
    },
    row: { display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 },
    btn: (active: boolean): React.CSSProperties => ({
      border: "1px solid",
      borderColor: active ? "#182544" : "#d1d5db",
      background: active ? "#182544" : "#fff",
      color: active ? "#fff" : "#182544",
      borderRadius: 10,
      padding: "7px 13px",
      fontSize: 12,
      cursor: "pointer",
      fontFamily: "Manrope, sans-serif",
      transition: "all 0.2s",
    }),
    btnSec: {
      border: "1px solid #d1d5db",
      background: "#f3f4f6",
      color: "#182544",
      borderRadius: 10,
      padding: "7px 13px",
      fontSize: 12,
      cursor: "pointer",
      fontFamily: "Manrope, sans-serif",
    },
    panel: {
      background: "#fff",
      border: "1px solid #e5e7eb",
      borderRadius: 14,
      padding: 14,
      marginBottom: 10,
    },
    label: {
      fontSize: 11,
      color: "#6b7280",
      fontWeight: 600,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: 6,
    },
    badge: (bg: string, fg: string): React.CSSProperties => ({
      display: "inline-block",
      padding: "3px 10px",
      borderRadius: 999,
      background: bg,
      color: fg,
      fontSize: 11,
      fontWeight: 600,
    }),
    warnBox: {
      background: "#fef9c3",
      border: "1px solid #fde68a",
      borderRadius: 10,
      padding: "10px 14px",
      marginTop: 10,
    },
    infoGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
      gap: 8,
    },
    infoCard: {
      border: "1px solid #e5e7eb",
      borderRadius: 10,
      padding: 10,
      background: "#f9fafb",
    },
    infoTitle: { fontSize: 11, color: "#775a19", fontWeight: 700, margin: 0 },
    infoVal: { fontSize: 11, color: "#4b5563", margin: "4px 0 0" },
  };

  const baseEl = (base: string, active: boolean, key: number) => (
    <span
      key={key}
      style={{
        minWidth: 26,
        height: 26,
        borderRadius: 7,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 700,
        fontSize: 12,
        color: "#fff",
        background: BASE_COLORS[base] ?? "#6b7280",
        opacity: active ? 1 : 0.3,
        transition: "opacity 0.2s",
      }}
    >
      {base}
    </span>
  );

  const flowNode = (
    label: string,
    highlight: boolean,
    sublabel?: string
  ) => (
    <div
      style={{
        textAlign: "center",
        padding: "6px 14px",
        borderRadius: 10,
        border: highlight ? "2px solid #182544" : "1px solid #d1d5db",
        background: highlight ? "#182544" : "#fff",
        color: highlight ? "#fff" : "#182544",
        fontWeight: 700,
        fontSize: 12,
        minWidth: 64,
        transition: "all 0.3s",
      }}
    >
      {label}
      {sublabel && (
        <div
          style={{
            fontSize: 9,
            fontWeight: 400,
            opacity: 0.7,
            marginTop: 2,
          }}
        >
          {sublabel}
        </div>
      )}
    </div>
  );

  const flowArrow = (
    label: string,
    horizontal: boolean,
    isMain: boolean,
    highlight: boolean
  ) => (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
        transform: horizontal ? undefined : "rotate(90deg)",
      }}
    >
      <span
        style={{
          fontSize: 16,
          color: highlight ? "#182544" : isMain ? "#9ca3af" : "#d1d5db",
          fontWeight: 700,
          letterSpacing: -2,
        }}
      >
        {isMain ? "═══►" : "- - ►"}
      </span>
      <span
        style={{
          fontSize: 9,
          color: highlight ? "#775a19" : "#9ca3af",
          fontWeight: highlight ? 700 : 400,
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </span>
    </div>
  );

  const currentDetail =
    phase !== "idle" && phase !== "completed"
      ? PROCESS_DETAILS[phase]
      : undefined;
  const currentWarnings =
    phase !== "idle" && phase !== "completed"
      ? MISCONCEPTIONS[phase]
      : undefined;

  const renderSequencePanel = () => {
    if (phase === "translation" || (phase === "completed" && !isAdvancedPhase)) {
      return (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "72px 1fr",
              gap: 8,
              alignItems: "start",
              marginBottom: 10,
            }}
          >
            <div style={{ fontSize: 11, color: "#6b7280", paddingTop: 4 }}>
              mRNA
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
              {snap.mrna.split("").map((b, i) =>
                baseEl(
                  b,
                  i < visibleCodons * 3 || phase === "completed",
                  i
                )
              )}
            </div>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "72px 1fr",
              gap: 8,
              alignItems: "start",
              marginBottom: 10,
            }}
          >
            <div style={{ fontSize: 11, color: "#6b7280", paddingTop: 4 }}>
              密码子
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {snap.codons.map((codon, i) => (
                <span
                  key={i}
                  style={{
                    padding: "3px 8px",
                    borderRadius: 6,
                    background:
                      i < visibleCodons || phase === "completed"
                        ? "#e0e7ff"
                        : "#f3f4f6",
                    color:
                      i < visibleCodons || phase === "completed"
                        ? "#3730a3"
                        : "#9ca3af",
                    fontSize: 11,
                    fontFamily: "monospace",
                    fontWeight: 600,
                    opacity:
                      i < visibleCodons || phase === "completed" ? 1 : 0.4,
                  }}
                >
                  {codon}
                </span>
              ))}
            </div>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "72px 1fr",
              gap: 8,
              alignItems: "start",
            }}
          >
            <div style={{ fontSize: 11, color: "#6b7280", paddingTop: 4 }}>
              蛋白链
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {snap.protein.slice(0, visibleCodons).length > 0 ? (
                snap.protein.slice(0, visibleCodons).map((aa, i) => (
                  <span
                    key={i}
                    style={{
                      padding: "4px 10px",
                      borderRadius: 999,
                      background: "#dbeafe",
                      color: "#1d4ed8",
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                  >
                    {aa}
                  </span>
                ))
              ) : (
                <span style={{ color: "#9ca3af", fontSize: 11 }}>
                  等待翻译开始
                </span>
              )}
            </div>
          </div>
        </>
      );
    }

    if (phase === "transcription") {
      return (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "72px 1fr",
              gap: 8,
              alignItems: "start",
              marginBottom: 10,
            }}
          >
            <div style={{ fontSize: 11, color: "#6b7280", paddingTop: 4 }}>
              DNA模板链
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
              {snap.dna.split("").map((b, i) => baseEl(b, true, i))}
            </div>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "72px 1fr",
              gap: 8,
              alignItems: "start",
            }}
          >
            <div style={{ fontSize: 11, color: "#6b7280", paddingTop: 4 }}>
              mRNA
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
              {snap.mrna.split("").map((b, i) =>
                baseEl(b, i < visibleCount, i)
              )}
            </div>
          </div>
        </>
      );
    }

    if (phase === "reverseTranscription") {
      const cdna = snap.mrna
        .split("")
        .map((b) => (b === "U" ? "A" : b === "A" ? "T" : b === "G" ? "C" : "G"))
        .join("");
      return (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "72px 1fr",
              gap: 8,
              alignItems: "start",
              marginBottom: 10,
            }}
          >
            <div style={{ fontSize: 11, color: "#6b7280", paddingTop: 4 }}>
              RNA模板
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
              {snap.mrna.split("").map((b, i) => baseEl(b, true, i))}
            </div>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "72px 1fr",
              gap: 8,
              alignItems: "start",
            }}
          >
            <div style={{ fontSize: 11, color: "#6b7280", paddingTop: 4 }}>
              cDNA
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
              {cdna.split("").map((b, i) =>
                baseEl(b, i < visibleCount, i)
              )}
            </div>
          </div>
        </>
      );
    }

    if (phase === "rnaReplication") {
      const rnaCopy = snap.mrna;
      return (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "72px 1fr",
              gap: 8,
              alignItems: "start",
              marginBottom: 10,
            }}
          >
            <div style={{ fontSize: 11, color: "#6b7280", paddingTop: 4 }}>
              RNA模板
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
              {snap.mrna.split("").map((b, i) => baseEl(b, true, i))}
            </div>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "72px 1fr",
              gap: 8,
              alignItems: "start",
            }}
          >
            <div style={{ fontSize: 11, color: "#6b7280", paddingTop: 4 }}>
              子代RNA
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
              {rnaCopy.split("").map((b, i) =>
                baseEl(b, i < visibleCount, i)
              )}
            </div>
          </div>
        </>
      );
    }

    return (
      <>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "72px 1fr",
            gap: 8,
            alignItems: "start",
            marginBottom: 10,
          }}
        >
          <div style={{ fontSize: 11, color: "#6b7280", paddingTop: 4 }}>
            DNA
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
            {snap.dna.split("").map((b, i) => baseEl(b, true, i))}
          </div>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "72px 1fr",
            gap: 8,
            alignItems: "start",
          }}
        >
          <div style={{ fontSize: 11, color: "#6b7280", paddingTop: 4 }}>
            互补链
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
            {snap.compDna.split("").map((b, i) =>
              baseEl(b, i < visibleCount, i)
            )}
          </div>
        </div>
      </>
    );
  };

  const renderProcessInfo = () => {
    if (!currentDetail || !isLevelVisible(currentDetail.minLevel)) return null;
    return (
      <div style={S.panel}>
        <div style={{ ...S.label, marginBottom: 8 }}>
          {PHASE_LABELS[phase]} — 过程详情
        </div>
        <div style={S.infoGrid}>
          <div style={S.infoCard}>
            <p style={S.infoTitle}>方向</p>
            <p style={S.infoVal}>{currentDetail.direction}</p>
          </div>
          <div style={S.infoCard}>
            <p style={S.infoTitle}>模板</p>
            <p style={S.infoVal}>{currentDetail.template}</p>
          </div>
          <div style={S.infoCard}>
            <p style={S.infoTitle}>原料</p>
            <p style={S.infoVal}>{currentDetail.rawMaterial}</p>
          </div>
          <div style={S.infoCard}>
            <p style={S.infoTitle}>产物</p>
            <p style={S.infoVal}>{currentDetail.product}</p>
          </div>
          <div style={S.infoCard}>
            <p style={S.infoTitle}>关键酶</p>
            <p style={S.infoVal}>{currentDetail.enzyme}</p>
          </div>
          <div style={S.infoCard}>
            <p style={S.infoTitle}>场所(真核)</p>
            <p style={S.infoVal}>{currentDetail.location}</p>
          </div>
          <div style={S.infoCard}>
            <p style={S.infoTitle}>碱基配对</p>
            <p style={S.infoVal}>{currentDetail.basePairing}</p>
          </div>
        </div>
        {currentDetail.notes.length > 0 && (
          <div style={{ marginTop: 8 }}>
            {currentDetail.notes.map((note, i) => (
              <div
                key={i}
                style={{ fontSize: 11, color: "#6b7280", lineHeight: 1.6 }}
              >
                • {note}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderMisconceptions = () => {
    if (!currentWarnings || !isLevelVisible("senior")) return null;
    return (
      <div style={S.warnBox}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "#92400e",
            marginBottom: 4,
          }}
        >
          易错提醒
        </div>
        {currentWarnings.map((w, i) => (
          <div key={i} style={{ fontSize: 11, color: "#78350f", lineHeight: 1.6 }}>
            {w}
          </div>
        ))}
      </div>
    );
  };

  const renderComparison = () => {
    if (level === "junior") return null;
    return (
      <div style={{ ...S.panel, marginTop: 10 }}>
        <div style={S.label}>真核 vs 原核 基因表达差异</div>
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: 11,
              minWidth: 400,
            }}
          >
            <thead>
              <tr>
                {["特征", "真核生物", "原核生物"].map((h) => (
                  <th
                    key={h}
                    style={{
                      border: "1px solid #e5e7eb",
                      padding: "6px 10px",
                      background: "#f3f4f6",
                      fontWeight: 700,
                      textAlign: "left",
                      color: "#374151",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                ["转录场所", "细胞核", "细胞质"],
                ["翻译场所", "细胞质核糖体", "细胞质核糖体"],
                ["时空关系", "先转录后翻译（分离）", "边转录边翻译（偶联）"],
                ["mRNA加工", "需剪接、加帽、加尾", "一般不需要"],
                ["基因结构", "有内含子和外显子", "一般无内含子"],
              ].map((row, ri) => (
                <tr key={ri}>
                  {row.map((cell, ci) => (
                    <td
                      key={ci}
                      style={{
                        border: "1px solid #e5e7eb",
                        padding: "5px 10px",
                        color: "#4b5563",
                        background: ri % 2 === 0 ? "#fff" : "#fafbfc",
                      }}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderCodonTable = () => {
    if (!showCodon) return null;
    const entries = Object.entries(CODON_TABLE);
    return (
      <div style={{ ...S.panel, marginTop: 10 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 8,
          }}
        >
          <div style={S.label}>密码子表（标准）</div>
          <button style={S.btnSec} onClick={() => setShowCodon(false)}>
            收起
          </button>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
            gap: 4,
          }}
        >
          {entries.map(([codon, aa]) => (
            <div
              key={codon}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "3px 8px",
                borderRadius: 6,
                background: aa.includes("Stop") ? "#fee2e2" : "#f9fafb",
                fontSize: 10,
              }}
            >
              <span
                style={{
                  fontFamily: "monospace",
                  fontWeight: 700,
                  color: aa.includes("Stop") ? "#dc2626" : "#374151",
                }}
              >
                {codon}
              </span>
              <span style={{ color: "#6b7280" }}>{aa}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderFlowDiagram = () => {
    const hl = (p: string) =>
      phase === p || (phase === "completed" && false);
    return (
      <div
        style={{
          ...S.panel,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 6,
          padding: "12px 16px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          {flowNode("DNA", phase === "replication")}
          {flowArrow("复制", true, true, phase === "replication")}
          {flowNode("DNA", phase === "replication")}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          <div style={{ width: 70 }} />
          {flowArrow("转录", true, true, phase === "transcription")}
          <div style={{ width: 50 }} />
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          {flowNode("RNA", phase === "translation" || isAdvancedPhase)}
          {flowArrow("翻译", true, true, phase === "translation")}
          {flowNode("蛋白质", phase === "translation")}
        </div>
        {isLevelVisible("senior") && (
          <div
            style={{
              marginTop: 6,
              padding: "6px 12px",
              background: "#f9fafb",
              borderRadius: 8,
              border: "1px dashed #d1d5db",
              fontSize: 10,
              color: "#9ca3af",
              textAlign: "center",
              lineHeight: 1.6,
            }}
          >
            <div style={{ fontWeight: 600, color: "#6b7280", marginBottom: 2 }}>
              特殊途径（仅病毒）
            </div>
            <span
              style={{
                color:
                  phase === "reverseTranscription" ? "#775a19" : "#9ca3af",
                fontWeight: phase === "reverseTranscription" ? 700 : 400,
              }}
            >
              RNA → DNA (逆转录, 逆转录酶)
            </span>
            <span style={{ margin: "0 8px", color: "#d1d5db" }}>|</span>
            <span
              style={{
                color: phase === "rnaReplication" ? "#775a19" : "#9ca3af",
                fontWeight: phase === "rnaReplication" ? 700 : 400,
              }}
            >
              RNA → RNA (RNA复制, RdRp)
            </span>
          </div>
        )}
        <div style={{ fontSize: 9, color: "#9ca3af", marginTop: 2 }}>
          ═══ 主要途径（实线，所有细胞生物） &nbsp; - - ▷ 特殊途径（虚线，仅某些病毒）
        </div>
      </div>
    );
  };

  return (
    <div style={S.root}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 10,
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#182544" }}>
            中心法则演示
          </div>
          <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>
            DNA序列：{dna}
          </div>
        </div>
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          {(["junior", "senior", "exam"] as Level[]).map((lv) => (
            <button
              key={lv}
              onClick={() => setLevel(lv)}
              style={{
                ...S.btnSec,
                padding: "4px 10px",
                fontSize: 10,
                background: level === lv ? "#182544" : "#f3f4f6",
                color: level === lv ? "#fff" : "#182544",
                border:
                  level === lv ? "1px solid #182544" : "1px solid #d1d5db",
              }}
            >
              {LEVEL_LABELS[lv]}
            </button>
          ))}
        </div>
      </div>

      {renderFlowDiagram()}

      <div style={S.row}>
        <button
          style={S.btn(phase === "replication")}
          onClick={() => doSetPhase("replication")}
        >
          DNA复制
        </button>
        <button
          style={S.btn(phase === "transcription")}
          onClick={() => doSetPhase("transcription")}
        >
          转录
        </button>
        <button
          style={S.btn(phase === "translation")}
          onClick={() => doSetPhase("translation")}
        >
          翻译
        </button>
        {isLevelVisible("senior") && (
          <>
            <button
              style={{
                ...S.btn(phase === "reverseTranscription"),
                borderColor:
                  phase === "reverseTranscription" ? "#775a19" : "#d1d5db",
                background:
                  phase === "reverseTranscription" ? "#775a19" : "#fff",
                color:
                  phase === "reverseTranscription" ? "#fff" : "#775a19",
                borderStyle: "dashed",
              }}
              onClick={() => doSetPhase("reverseTranscription")}
            >
              逆转录
            </button>
            <button
              style={{
                ...S.btn(phase === "rnaReplication"),
                borderColor:
                  phase === "rnaReplication" ? "#775a19" : "#d1d5db",
                background:
                  phase === "rnaReplication" ? "#775a19" : "#fff",
                color: phase === "rnaReplication" ? "#fff" : "#775a19",
                borderStyle: "dashed",
              }}
              onClick={() => doSetPhase("rnaReplication")}
            >
              RNA复制
            </button>
          </>
        )}
        <button style={S.btnSec} onClick={togglePlay}>
          {playing ? "暂停" : "播放"}
        </button>
        <button style={S.btnSec} onClick={doReset}>
          重置
        </button>
      </div>

      <div style={S.panel}>
        <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 8 }}>
          {statusText}
        </div>
        {renderSequencePanel()}
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              isLevelVisible("senior")
                ? "repeat(auto-fit, minmax(140px, 1fr))"
                : "repeat(auto-fit, minmax(150px, 1fr))",
            gap: 8,
            marginTop: 12,
          }}
        >
          <div style={S.infoCard}>
            <h3 style={S.infoTitle}>互补DNA</h3>
            <p style={{ ...S.infoVal, wordBreak: "break-all" }}>
              {snap.compDna}
            </p>
          </div>
          <div style={S.infoCard}>
            <h3 style={S.infoTitle}>mRNA</h3>
            <p style={{ ...S.infoVal, wordBreak: "break-all" }}>
              {snap.mrna}
            </p>
          </div>
          <div style={S.infoCard}>
            <h3 style={S.infoTitle}>蛋白质</h3>
            <p style={S.infoVal}>
              {snap.protein.length > 0
                ? snap.protein.join(" / ")
                : "尚未生成完整蛋白质链"}
            </p>
          </div>
          {isLevelVisible("senior") && (
            <div style={S.infoCard}>
              <h3 style={S.infoTitle}>起始/终止密码子</h3>
              <p style={S.infoVal}>
                起始：AUG → 甲硫氨酸
                <br />
                终止：UAA / UAG / UGA
              </p>
            </div>
          )}
          {isLevelVisible("exam") && (
            <div style={S.infoCard}>
              <h3 style={S.infoTitle}>信息流向</h3>
              <p style={S.infoVal}>
                DNA → DNA（复制）
                <br />
                DNA → RNA（转录）
                <br />
                RNA → 蛋白质（翻译）
                <br />
                <span style={{ color: "#9ca3af" }}>
                  RNA → DNA（逆转录，仅病毒）
                </span>
              </p>
            </div>
          )}
        </div>
      </div>

      {renderProcessInfo()}
      {renderMisconceptions()}
      {renderComparison()}

      {!showCodon && (
        <div style={{ marginTop: 8 }}>
          <button style={S.btnSec} onClick={() => setShowCodon(true)}>
            查看密码子表
          </button>
        </div>
      )}
      {renderCodonTable()}
    </div>
  );
}

export default CentralDogma;
