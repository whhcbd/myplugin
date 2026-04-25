import React, { ComponentType } from "react";
import type { A2UINode, Capability, PluginManifest, PluginModule } from "../types";

type ComponentLoader = () => Promise<PluginModule>;

interface RegistryEntry {
  manifest: PluginManifest;
  loaders: Record<string, ComponentLoader>;
}

export const pluginModules: Record<string, ComponentLoader> = {
  "physics-high-school": () =>
    import("@plugins/physics-high-school/src/index").then((m) => m as unknown as PluginModule),
  "genetics-dna": () =>
    import("@plugins/genetics-dna/src/index").then((m) => m as unknown as PluginModule),
  "genetics-punnett": () =>
    import("@plugins/genetics-punnett/src/index").then((m) => m as unknown as PluginModule),
  "genetics-phenotype": () =>
    import("@plugins/genetics-phenotype/src/index").then((m) => m as unknown as PluginModule),
  "genetics-centraldogma": () =>
    import("@plugins/genetics-centraldogma/src/index").then((m) => m as unknown as PluginModule),
  "genetics-flashcard": () =>
    import("@plugins/genetics-flashcard/src/index").then((m) => m as unknown as PluginModule),
  "genetics-pedigree": () =>
    import("@plugins/genetics-pedigree/src/index").then((m) => m as unknown as PluginModule),
  "genetics-heatmap": () =>
    import("@plugins/genetics-heatmap/src/index").then((m) => m as unknown as PluginModule),
  "genetics-mendel": () =>
    import("@plugins/genetics-mendel/src/index").then((m) => m as unknown as PluginModule),
  "genetics-naturalselection": () =>
    import("@plugins/genetics-naturalselection/src/index").then((m) => m as unknown as PluginModule),
  "genetics-crossover": () =>
    import("@plugins/genetics-crossover/src/index").then((m) => m as unknown as PluginModule),
  "genetics-volcano": () =>
    import("@plugins/genetics-volcano/src/index").then((m) => m as unknown as PluginModule),
};

const registry = new Map<string, RegistryEntry>();

export function registerPlugin(
  pluginId: string,
  manifest: PluginManifest,
  loaders: Record<string, ComponentLoader>
) {
  registry.set(pluginId, { manifest, loaders });
}

export function getPluginIds(): string[] {
  return Array.from(registry.keys());
}

export function getManifest(pluginId: string): PluginManifest | undefined {
  return registry.get(pluginId)?.manifest;
}

export function getCapability(
  pluginId: string,
  componentId: string
): Capability | undefined {
  const entry = registry.get(pluginId);
  if (!entry) return undefined;
  return entry.manifest.capabilities.find(
    (c) => c.component_id === componentId
  );
}

export async function loadComponent(
  pluginId: string,
  componentId: string
): Promise<ComponentType<{ node: A2UINode }> | null> {
  const entry = registry.get(pluginId);
  if (!entry) return null;
  const loader = entry.loaders[componentId];
  if (!loader) return null;
  try {
    const mod = await loader();
    return mod.default.components[componentId] ?? null;
  } catch (err) {
    console.error(`Failed to load ${pluginId}/${componentId}:`, err);
    return null;
  }
}

export function getAllCapabilities(): Array<{
  pluginId: string;
  capability: Capability;
}> {
  const result: Array<{ pluginId: string; capability: Capability }> = [];
  for (const [pluginId, entry] of registry) {
    for (const cap of entry.manifest.capabilities) {
      result.push({ pluginId, capability: cap });
    }
  }
  return result;
}

export function buildGalleryExamples(): Array<{
  pluginId: string;
  componentId: string;
  name: string;
  node: A2UINode;
}> {
  const examples: Array<{
    pluginId: string;
    componentId: string;
    name: string;
    node: A2UINode;
  }> = [];
  for (const [pluginId, entry] of registry) {
    for (const cap of entry.manifest.capabilities) {
      const properties: Record<string, unknown> = {};
      for (const [key, schema] of Object.entries(cap.props_schema)) {
        properties[key] = schema.default;
      }
      examples.push({
        pluginId,
        componentId: cap.component_id,
        name: cap.name,
        node: { properties },
      });
    }
  }
  return examples;
}

export async function registerPluginsFromManifests(manifests: PluginManifest[]) {
  for (const manifest of manifests) {
    const pid = manifest.id;
    if (!pluginModules[pid]) {
      console.warn(`No frontend loader for plugin: ${pid}`);
      continue;
    }
    const loaders: Record<string, ComponentLoader> = {};
    for (const cap of manifest.capabilities) {
      loaders[cap.component_id] = pluginModules[pid];
    }
    registerPlugin(pid, manifest, loaders);
  }
}
