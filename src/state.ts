import { EmbeddedWhiteboardData, WhiteboardEdge, WhiteboardNode } from "./types";

export const WHITEBOARD_FENCE = "inline-whiteboard";
export const DEFAULT_BOARD_HEIGHT = 520;

const DEFAULT_NODE_WIDTH = 260;
const DEFAULT_NODE_HEIGHT = 180;

export function createId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createDefaultNode(overrides: Partial<WhiteboardNode> = {}): WhiteboardNode {
  return {
    id: createId("node"),
    type: "text",
    text: "Double-click to edit",
    color: "yellow",
    x: -DEFAULT_NODE_WIDTH / 2,
    y: -DEFAULT_NODE_HEIGHT / 2,
    width: DEFAULT_NODE_WIDTH,
    height: DEFAULT_NODE_HEIGHT,
    ...overrides
  };
}

export function createDefaultBoard(): EmbeddedWhiteboardData {
  return {
    nodes: [
      createDefaultNode({
        text: "# Embedded whiteboard\n\nDrag cards, resize them, and link them together.",
        x: -140,
        y: -80,
        width: 320,
        height: 220,
        color: "blue"
      })
    ],
    edges: [],
    viewport: {
      x: 0,
      y: 0,
      zoom: 1
    }
  };
}

export function parseBoard(raw: string): EmbeddedWhiteboardData {
  const parsed = JSON.parse(raw) as Partial<EmbeddedWhiteboardData>;
  const nodes = Array.isArray(parsed.nodes) ? parsed.nodes : [];
  const edges = Array.isArray(parsed.edges) ? parsed.edges : [];

  return {
    nodes: nodes
      .filter((node): node is WhiteboardNode => Boolean(node && typeof node.id === "string"))
      .map((node) => ({
        id: node.id,
        type: "text",
        text: typeof node.text === "string" ? node.text : "",
        color: typeof node.color === "string" ? node.color : "default",
        x: typeof node.x === "number" ? node.x : 0,
        y: typeof node.y === "number" ? node.y : 0,
        width: typeof node.width === "number" ? node.width : DEFAULT_NODE_WIDTH,
        height: typeof node.height === "number" ? node.height : DEFAULT_NODE_HEIGHT
      })),
    edges: edges
      .filter((edge): edge is WhiteboardEdge => Boolean(edge && typeof edge.id === "string"))
      .map((edge) => ({
        id: edge.id,
        fromNode: edge.fromNode,
        toNode: edge.toNode,
        fromSide: edge.fromSide ?? "right",
        toSide: edge.toSide ?? "left",
        label: edge.label
      })),
    viewport: {
      x: typeof parsed.viewport?.x === "number" ? parsed.viewport.x : 0,
      y: typeof parsed.viewport?.y === "number" ? parsed.viewport.y : 0,
      zoom: typeof parsed.viewport?.zoom === "number" ? parsed.viewport.zoom : 1
    }
  };
}

export function serializeBoard(board: EmbeddedWhiteboardData): string {
  return JSON.stringify(board, null, 2);
}

export function wrapBoard(board: EmbeddedWhiteboardData): string {
  return `\`\`\`${WHITEBOARD_FENCE}\n${serializeBoard(board)}\n\`\`\``;
}
