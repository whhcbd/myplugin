import { useState, useEffect } from "react";

interface A2UINode {
  properties?: Record<string, unknown>;
}

function parseStr(val: unknown, fallback: string): string {
  return typeof val === "string" ? val : fallback;
}

export function Flashcard({ node }: { node: A2UINode }) {
  const props = node.properties ?? {};

  const initFront = parseStr(props.front, "DNA的双螺旋结构由谁发现？");
  const initBack = parseStr(props.back, "1953年，Watson和Crick提出了DNA双螺旋结构模型");
  const initCategory = parseStr(props.category, "分子遗传学");

  const [front, setFront] = useState(initFront);
  const [back, setBack] = useState(initBack);
  const [category, setCategory] = useState(initCategory);
  const [flipped, setFlipped] = useState(false);

  useEffect(() => { setFront(initFront); setFlipped(false); }, [initFront]);
  useEffect(() => { setBack(initBack); setFlipped(false); }, [initBack]);
  useEffect(() => { setCategory(initCategory); }, [initCategory]);

  return (
    <div
      style={{
        perspective: 1000,
        width: "100%",
        maxWidth: 340,
        minWidth: 280,
        margin: "0 auto",
      }}
    >
      <div
        onClick={() => setFlipped((f) => !f)}
        style={{
          width: "100%",
          height: 320,
          position: "relative",
          cursor: "pointer",
          transformStyle: "preserve-3d" as const,
          transition: "transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)",
          transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            backfaceVisibility: "hidden" as const,
            borderRadius: 14,
            padding: 16,
            display: "flex",
            flexDirection: "column",
            boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
            overflow: "hidden",
            background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
            color: "#fff",
          }}
        >
          <span
            style={{
              position: "absolute",
              top: 12,
              right: 12,
              fontSize: 10,
              fontWeight: 600,
              textTransform: "uppercase" as const,
              background: "rgba(255,255,255,0.2)",
              padding: "4px 8px",
              borderRadius: 4,
            }}
          >
            问题
          </span>
          {category && (
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                textTransform: "uppercase" as const,
                letterSpacing: 0.5,
                opacity: 0.8,
                marginBottom: 12,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span style={{ width: 8, height: 8, background: "currentColor", borderRadius: "50%", opacity: 0.6, display: "inline-block" }} />
              {category}
            </div>
          )}
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              fontSize: 16,
              fontWeight: 600,
              lineHeight: 1.5,
              padding: 8,
              overflowY: "auto" as const,
            }}
          >
            {front}
          </div>
          <div
            style={{
              fontSize: 11,
              opacity: 0.7,
              textAlign: "center",
              marginTop: 10,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
            }}
          >
            <span style={{ fontSize: 16 }}>↻</span>
            点击查看答案
          </div>
        </div>

        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            backfaceVisibility: "hidden" as const,
            borderRadius: 14,
            padding: 16,
            display: "flex",
            flexDirection: "column",
            boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
            overflow: "hidden",
            background: "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)",
            color: "#fff",
            transform: "rotateY(180deg)",
          }}
        >
          <span
            style={{
              position: "absolute",
              top: 12,
              right: 12,
              fontSize: 10,
              fontWeight: 600,
              textTransform: "uppercase" as const,
              background: "rgba(255,255,255,0.2)",
              padding: "4px 8px",
              borderRadius: 4,
            }}
          >
            答案
          </span>
          {category && (
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                textTransform: "uppercase" as const,
                letterSpacing: 0.5,
                opacity: 0.8,
                marginBottom: 12,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span style={{ width: 8, height: 8, background: "currentColor", borderRadius: "50%", opacity: 0.6, display: "inline-block" }} />
              {category}
            </div>
          )}
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "center",
              textAlign: "left",
              fontSize: 13,
              fontWeight: 500,
              lineHeight: 1.45,
              padding: 8,
              overflowY: "auto" as const,
            }}
          >
            {back}
          </div>
          <div
            style={{
              fontSize: 11,
              opacity: 0.7,
              textAlign: "center",
              marginTop: 10,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
            }}
          >
            <span style={{ fontSize: 16 }}>↻</span>
            点击查看问题
          </div>
        </div>
      </div>
    </div>
  );
}

export default Flashcard;
