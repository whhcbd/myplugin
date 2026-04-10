export interface A2UINode {
  properties?: Record<string, unknown>;
}

export interface PluginManifest {
  id: string;
  version: string;
  subject: string;
  name: string;
  keywords: string[];
  entry: {
    js: string;
    vector_db?: string;
  };
  capabilities: Capability[];
}

export interface Capability {
  component_id: string;
  name: string;
  tags: string[];
  props_schema: Record<
    string,
    {
      type: string;
      default: unknown;
      min?: number;
      max?: number;
      description: string;
    }
  >;
  a2ui_hint: string;
  expresses: string[];
  educational_use: string;
  cannot_express: string[];
}

export interface PluginModule {
  default: {
    components: Record<string, React.ComponentType<{ node: A2UINode }>>;
  };
}
