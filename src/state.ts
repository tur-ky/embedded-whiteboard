import {
  DrawingTool,
  EmbeddedWhiteboardData,
  StrokeItem,
  TextItem,
  WhiteboardItem,
  WhiteboardLayer
} from "./types";

export const WHITEBOARD_FENCE = "inline-whiteboard";
export const DEFAULT_BOARD_HEIGHT = 620;
export const DEFAULT_COLORS = [
  "#111111",
  "#2563eb",
  "#14b8a6",
  "#22c55e",
  "#f59e0b",
  "#ef4444",
  "#e11d48",
  "#7c3aed"
] as const;

export const TOOL_PRESETS: Record<DrawingTool, { width: number; opacity: number }> = {
  pen: { width: 4, opacity: 1 },
  pencil: { width: 2, opacity: 0.72 },
  marker: { width: 12, opacity: 0.28 }
};

export function createId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createLayer(name = "Layer 1"): WhiteboardLayer {
  return {
    id: createId("layer"),
    name,
    visible: true,
    locked: false
  };
}

export function createDefaultBoard(): EmbeddedWhiteboardData {
  return {
    id: createId("board"),
    layers: [createLayer()],
    items: [],
    viewport: {
      x: 0,
      y: 0,
      zoom: 1
    }
  };
}

export function parseBoard(raw: string): EmbeddedWhiteboardData {
  const parsed = JSON.parse(raw) as Partial<EmbeddedWhiteboardData> & {
    nodes?: Array<Record<string, unknown>>;
  };

  if (Array.isArray(parsed.nodes)) {
    return migrateNodeBoard(parsed.nodes, parsed.viewport, parsed.id);
  }

  const layers = Array.isArray(parsed.layers)
    ? parsed.layers
        .filter((layer): layer is WhiteboardLayer => Boolean(layer && typeof layer.id === "string"))
        .map((layer, index) => ({
          id: layer.id,
          name: typeof layer.name === "string" ? layer.name : `Layer ${index + 1}`,
          visible: layer.visible !== false,
          locked: layer.locked === true
        }))
    : [];

  const safeLayers = layers.length > 0 ? layers : [createLayer()];
  const layerIds = new Set(safeLayers.map((layer) => layer.id));

  const items = Array.isArray(parsed.items)
    ? parsed.items
        .filter((item): item is WhiteboardItem => Boolean(item && typeof item.id === "string" && typeof item.type === "string"))
        .map((item) => normalizeItem(item, safeLayers[0].id))
        .filter((item): item is WhiteboardItem => Boolean(item && layerIds.has(item.layerId)))
    : [];

  return {
    id: typeof parsed.id === "string" ? parsed.id : createId("board"),
    layers: safeLayers,
    items,
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

function normalizeItem(item: WhiteboardItem, fallbackLayerId: string): WhiteboardItem | null {
  if (item.type === "stroke") {
    const stroke = item as Partial<StrokeItem>;
    return {
      id: stroke.id ?? createId("stroke"),
      type: "stroke",
      layerId: typeof stroke.layerId === "string" ? stroke.layerId : fallbackLayerId,
      tool: stroke.tool === "pencil" || stroke.tool === "marker" ? stroke.tool : "pen",
      color: typeof stroke.color === "string" ? stroke.color : DEFAULT_COLORS[0],
      width: typeof stroke.width === "number" ? stroke.width : TOOL_PRESETS.pen.width,
      opacity: typeof stroke.opacity === "number" ? stroke.opacity : TOOL_PRESETS.pen.opacity,
      points: Array.isArray(stroke.points)
        ? stroke.points
            .filter((point): point is { x: number; y: number; pressure?: number } => Boolean(point && typeof point.x === "number" && typeof point.y === "number"))
            .map((point) => ({
              x: point.x,
              y: point.y,
              pressure: typeof point.pressure === "number" ? point.pressure : 0.5
            }))
        : []
    };
  }

  if (item.type === "text") {
    const text = item as Partial<TextItem>;
    return {
      id: text.id ?? createId("text"),
      type: "text",
      layerId: typeof text.layerId === "string" ? text.layerId : fallbackLayerId,
      x: typeof text.x === "number" ? text.x : 0,
      y: typeof text.y === "number" ? text.y : 0,
      text: typeof text.text === "string" ? text.text : "",
      color: typeof text.color === "string" ? text.color : DEFAULT_COLORS[0],
      size: typeof text.size === "number" ? text.size : 20
    };
  }

  return null;
}

function migrateNodeBoard(
  nodes: Array<Record<string, unknown>>,
  viewport: Partial<EmbeddedWhiteboardData["viewport"]> | undefined,
  boardId: string | undefined
): EmbeddedWhiteboardData {
  const layer = createLayer();
  const items: TextItem[] = nodes
    .filter((node) => typeof node.id === "string")
    .map((node) => ({
      id: String(node.id),
      type: "text",
      layerId: layer.id,
      x: typeof node.x === "number" ? node.x : 0,
      y: typeof node.y === "number" ? node.y : 0,
      text: typeof node.text === "string" ? node.text : "",
      color: typeof node.color === "string" ? node.color : DEFAULT_COLORS[0],
      size: 18
    }));

  return {
    id: typeof boardId === "string" ? boardId : createId("board"),
    layers: [layer],
    items,
    viewport: {
      x: typeof viewport?.x === "number" ? viewport.x : 0,
      y: typeof viewport?.y === "number" ? viewport.y : 0,
      zoom: typeof viewport?.zoom === "number" ? viewport.zoom : 1
    }
  };
}
