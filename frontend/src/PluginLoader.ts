import React, { ComponentType, useEffect, useState } from "react";
import type { A2UINode, Capability, PluginManifest, PluginModule } from "./types";
import {
  getPluginIds,
  getManifest,
  loadComponent,
  getAllCapabilities,
  buildGalleryExamples,
  registerPluginsFromManifests,
} from "./a2ui-engine/CatalogRegistry";

async function loadManifestsFromBackend(): Promise<PluginManifest[]> {
  try {
    const res = await fetch("/api/v1/plugins");
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

async function initPlugins() {
  const manifests = await loadManifestsFromBackend();
  await registerPluginsFromManifests(manifests);
}

export function usePluginInit() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    initPlugins().then(() => setReady(true));
  }, []);
  return ready;
}

export { loadComponent, buildGalleryExamples, getAllCapabilities, getManifest, getPluginIds };
