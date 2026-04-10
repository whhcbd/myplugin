import React, { useEffect, useState } from "react";
import type { A2UINode } from "./types";
import { usePluginInit, loadComponent, buildGalleryExamples } from "./PluginLoader";

function PluginRenderer({
  pluginId,
  componentId,
  node,
}: {
  pluginId: string;
  componentId: string;
  node: A2UINode;
}) {
  const [Comp, setComp] = useState<React.ComponentType<{ node: A2UINode }> | null>(null);

  useEffect(() => {
    loadComponent(pluginId, componentId).then((c) => setComp(() => c));
  }, [pluginId, componentId]);

  if (!Comp) {
    return (
      <div style={{ padding: 20, color: "#999", fontFamily: "Manrope, sans-serif" }}>
        Loading {componentId}...
      </div>
    );
  }
  return <Comp node={node} />;
}

function Gallery() {
  const examples = buildGalleryExamples();
  if (examples.length === 0) {
    return (
      <div style={{ padding: 20, color: "#999", fontFamily: "Manrope, sans-serif" }}>
        No plugins registered.
      </div>
    );
  }
  return (
    <div style={{ padding: 24, fontFamily: "Manrope, sans-serif" }}>
      <h1 style={{ color: "#182544", marginBottom: 24, fontSize: 22 }}>
        AhaTutor Plugin Gallery
      </h1>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 20 }}>
        {examples.map((ex) => (
          <div key={`${ex.pluginId}-${ex.componentId}`}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "#775a19",
                marginBottom: 8,
              }}
            >
              {ex.name}
              <span style={{ fontWeight: 400, color: "#999", marginLeft: 8 }}>
                {ex.pluginId}/{ex.componentId}
              </span>
            </div>
            <PluginRenderer
              pluginId={ex.pluginId}
              componentId={ex.componentId}
              node={ex.node}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function SimulateChat() {
  const [jsonInput, setJsonInput] = useState(
    JSON.stringify(
      {
        pluginId: "physics-high-school",
        componentId: "PhysicsOscillator",
        properties: { amplitude: 3, freq: 2, phase: 0 },
      },
      null,
      2
    )
  );
  const [node, setNode] = useState<A2UINode | null>(null);
  const [target, setTarget] = useState<{
    pluginId: string;
    componentId: string;
  } | null>(null);

  const handleRender = () => {
    try {
      const parsed = JSON.parse(jsonInput);
      setTarget({ pluginId: parsed.pluginId, componentId: parsed.componentId });
      setNode({ properties: parsed.properties ?? {} });
    } catch (e) {
      alert("Invalid JSON: " + (e as Error).message);
    }
  };

  return (
    <div style={{ padding: 24, fontFamily: "Manrope, sans-serif" }}>
      <h2 style={{ color: "#182544", marginBottom: 16, fontSize: 18 }}>
        Simulate LLM Call
      </h2>
      <p style={{ fontSize: 13, color: "#666", marginBottom: 12 }}>
        Paste JSON to simulate an LLM rendering a plugin component (like A2UI would):
      </p>
      <textarea
        value={jsonInput}
        onChange={(e) => setJsonInput(e.target.value)}
        rows={10}
        style={{
          width: "100%",
          maxWidth: 480,
          fontFamily: "monospace",
          fontSize: 13,
          padding: 12,
          borderRadius: 8,
          border: "1px solid #ddd",
          background: "#fff",
          color: "#1b1c1a",
          display: "block",
        }}
      />
      <button
        onClick={handleRender}
        style={{
          marginTop: 12,
          padding: "8px 20px",
          borderRadius: 8,
          border: "none",
          background: "#182544",
          color: "#fff",
          fontFamily: "Manrope, sans-serif",
          fontWeight: 600,
          cursor: "pointer",
          fontSize: 13,
        }}
      >
        Render
      </button>
      {target && node && (
        <div style={{ marginTop: 20 }}>
          <PluginRenderer
            pluginId={target.pluginId}
            componentId={target.componentId}
            node={node}
          />
        </div>
      )}
    </div>
  );
}

function App() {
  const ready = usePluginInit();
  const [tab, setTab] = useState<"gallery" | "chat">("gallery");

  if (!ready) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          fontFamily: "Manrope, sans-serif",
          color: "#999",
        }}
      >
        Loading plugins...
      </div>
    );
  }

  const isGallery = window.location.search.includes("gallery=1");

  return (
    <div style={{ minHeight: "100vh", background: "#faf9f5" }}>
      {!isGallery && (
        <div
          style={{
            display: "flex",
            gap: 0,
            borderBottom: "2px solid #e8e5de",
            fontFamily: "Manrope, sans-serif",
          }}
        >
          <button
            onClick={() => setTab("gallery")}
            style={{
              padding: "12px 24px",
              border: "none",
              background: tab === "gallery" ? "#182544" : "transparent",
              color: tab === "gallery" ? "#fff" : "#182544",
              fontWeight: 600,
              fontSize: 14,
              cursor: "pointer",
              fontFamily: "Manrope, sans-serif",
            }}
          >
            Gallery
          </button>
          <button
            onClick={() => setTab("chat")}
            style={{
              padding: "12px 24px",
              border: "none",
              background: tab === "chat" ? "#182544" : "transparent",
              color: tab === "chat" ? "#fff" : "#182544",
              fontWeight: 600,
              fontSize: 14,
              cursor: "pointer",
              fontFamily: "Manrope, sans-serif",
            }}
          >
            Simulate Chat
          </button>
        </div>
      )}
      {tab === "gallery" || isGallery ? <Gallery /> : <SimulateChat />}
    </div>
  );
}

export default App;
