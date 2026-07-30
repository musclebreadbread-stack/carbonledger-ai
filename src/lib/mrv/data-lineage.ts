/**
 * Data Lineage Tracker
 * Tracks data from source through all transformations to final report output
 */

export interface LineageNode {
  id: string;
  stage: "measurement" | "calculation" | "verification" | "report";
  description: string;
  timestamp: string;
  input_data: Record<string, unknown>;
  output_data: Record<string, unknown>;
  transformation?: string;
  source?: string;
  parent_ids: string[];
}

export interface LineageGraph {
  nodes: LineageNode[];
  edges: { from: string; to: string }[];
  root_ids: string[];
  leaf_ids: string[];
}

/**
 * DataLineageTracker class
 * Tracks data provenance from raw measurement to final report
 */
export class DataLineageTracker {
  private nodes: Map<string, LineageNode> = new Map();
  private edges: { from: string; to: string }[] = [];

  /**
   * Add a new node to the lineage graph
   */
  addNode(
    stage: LineageNode["stage"],
    description: string,
    inputData: Record<string, unknown>,
    outputData: Record<string, unknown>,
    parentIds: string[] = [],
    options?: { transformation?: string; source?: string }
  ): string {
    const id = crypto.randomUUID();
    const node: LineageNode = {
      id,
      stage,
      description,
      timestamp: new Date().toISOString(),
      input_data: inputData,
      output_data: outputData,
      transformation: options?.transformation,
      source: options?.source,
      parent_ids: parentIds,
    };

    this.nodes.set(id, node);

    // Add edges from parents
    for (const parentId of parentIds) {
      this.edges.push({ from: parentId, to: id });
    }

    return id;
  }

  /**
   * Get the full lineage graph
   */
  getGraph(): LineageGraph {
    const allNodes = Array.from(this.nodes.values());
    const childIds = new Set(this.edges.map((e) => e.to));
    const parentIds = new Set(this.edges.map((e) => e.from));

    const rootIds = allNodes.filter((n) => !childIds.has(n.id)).map((n) => n.id);
    const leafIds = allNodes.filter((n) => !parentIds.has(n.id)).map((n) => n.id);

    return {
      nodes: allNodes,
      edges: [...this.edges],
      root_ids: rootIds,
      leaf_ids: leafIds,
    };
  }

  /**
   * Get lineage for a specific node (all ancestors)
   */
  getAncestors(nodeId: string): LineageNode[] {
    const ancestors: LineageNode[] = [];
    const visited = new Set<string>();

    const traverse = (id: string) => {
      if (visited.has(id)) return;
      visited.add(id);

      const node = this.nodes.get(id);
      if (!node) return;

      for (const parentId of node.parent_ids) {
        const parent = this.nodes.get(parentId);
        if (parent) {
          ancestors.push(parent);
          traverse(parentId);
        }
      }
    };

    traverse(nodeId);
    return ancestors;
  }

  /**
   * Get descendants of a specific node
   */
  getDescendants(nodeId: string): LineageNode[] {
    const descendants: LineageNode[] = [];
    const visited = new Set<string>();

    const traverse = (id: string) => {
      if (visited.has(id)) return;
      visited.add(id);

      const childEdges = this.edges.filter((e) => e.from === id);
      for (const edge of childEdges) {
        const child = this.nodes.get(edge.to);
        if (child) {
          descendants.push(child);
          traverse(edge.to);
        }
      }
    };

    traverse(nodeId);
    return descendants;
  }

  /**
   * Clear all lineage data
   */
  clear(): void {
    this.nodes.clear();
    this.edges = [];
  }

  /**
   * Get node by ID
   */
  getNode(nodeId: string): LineageNode | undefined {
    return this.nodes.get(nodeId);
  }

  /**
   * Get total number of nodes
   */
  getNodeCount(): number {
    return this.nodes.size;
  }
}
