import { Notice } from "obsidian";
import {
  createDefaultBoard,
  createId,
  DEFAULT_BOARD_HEIGHT,
  DEFAULT_COLORS,
  TOOL_PRESETS
} from "./state";
import {
  DrawingTool,
  EmbeddedWhiteboardData,
  StrokeItem,
  StrokePoint,
  TextItem,
  WhiteboardItem,
  WhiteboardLayer,
  WhiteboardTool
} from "./types";

interface WhiteboardHost {
  sourcePath: string;
  save(board: EmbeddedWhiteboardData): Promise<void>;
}

interface WhiteboardHandle {
  destroy(): void;
}

type PointerMode =
  | { type: "idle" }
  | { type: "pan"; startX: number; startY: number; originX: number; originY: number }
  | { type: "draw"; pointerId: number }
  | {
      type: "move";
      pointerId: number;
      itemId: string;
      startX: number;
      startY: number;
      originText?: { x: number; y: number };
      originPoints?: StrokePoint[];
    }
  | { type: "erase"; pointerId: number; removed: boolean };

const TOOL_LABELS: Record<WhiteboardTool, string> = {
  pen: "Pen",
  pencil: "Pencil",
  marker: "Marker",
  eraser: "Eraser",
  text: "Text",
  select: "Select",
  hand: "Hand"
};

export function mountWhiteboard(
  container: HTMLElement,
  initialBoard: EmbeddedWhiteboardData,
  host: WhiteboardHost
): WhiteboardHandle {
  container.empty();
  container.addClass("embedded-whiteboard");

  const root = container.createDiv({ cls: "embedded-whiteboard__shell" });
  const toolbar = root.createDiv({ cls: "embedded-whiteboard__toolbar" });
  const workspace = root.createDiv({ cls: "embedded-whiteboard__workspace" });
  const viewport = workspace.createDiv({ cls: "embedded-whiteboard__viewport" });
  const grid = viewport.createDiv({ cls: "embedded-whiteboard__grid" });
  const scene = viewport.createEl("svg", { cls: "embedded-whiteboard__scene" });
  scene.setAttribute("width", "100%");
  scene.setAttribute("height", "100%");
  const strokeLayer = scene.createEl("g", { cls: "embedded-whiteboard__stroke-layer" });
  const draftLayer = scene.createEl("g", { cls: "embedded-whiteboard__draft-layer" });
  const draftPath = draftLayer.createEl("path", { cls: "embedded-whiteboard__draft-path" });
  const textWorld = viewport.createDiv({ cls: "embedded-whiteboard__text-world" });
  const sidebar = workspace.createDiv({ cls: "embedded-whiteboard__sidebar" });
  const layerHeader = sidebar.createDiv({ cls: "embedded-whiteboard__sidebar-header" });
  layerHeader.createSpan({ text: "Layers" });
  const addLayerButton = layerHeader.createEl("button", {
    cls: "embedded-whiteboard__mini-button",
    text: "+ Layer"
  });
  addLayerButton.type = "button";
  const layersList = sidebar.createDiv({ cls: "embedded-whiteboard__layers" });
  const status = toolbar.createDiv({ cls: "embedded-whiteboard__status", text: "Ready" });

  let board = structuredClone(initialBoard);
  if (board.layers.length === 0) {
    board = createDefaultBoard();
  }

  let activeTool: WhiteboardTool = "pen";
  let activeColor = DEFAULT_COLORS[0];
  let brushSize = TOOL_PRESETS.pen.width;
  let opacity = TOOL_PRESETS.pen.opacity;
  let activeLayerId = board.layers[0].id;
  let selectedItemId: string | null = null;
  let pointerMode: PointerMode = { type: "idle" };
  let draftStroke: StrokeItem | null = null;
  let saveTimer: number | null = null;
  let destroyed = false;
  let activeTextEditor: HTMLTextAreaElement | null = null;
  let history = [structuredClone(board)];
  let historyIndex = 0;

  const toolButtons = new Map<WhiteboardTool, HTMLButtonElement>();
  const undoButton = toolbar.createEl("button", { cls: "embedded-whiteboard__button", text: "Undo" });
  undoButton.type = "button";
  const redoButton = toolbar.createEl("button", { cls: "embedded-whiteboard__button", text: "Redo" });
  redoButton.type = "button";

  const toolOrder: WhiteboardTool[] = ["pen", "pencil", "marker", "eraser", "text", "select", "hand"];
  for (const tool of toolOrder) {
    const button = toolbar.createEl("button", {
      cls: "embedded-whiteboard__button embedded-whiteboard__tool-button",
      text: TOOL_LABELS[tool]
    });
    button.type = "button";
    button.addEventListener("click", () => setActiveTool(tool));
    toolButtons.set(tool, button);
  }

  const colorInput = toolbar.createEl("input", { cls: "embedded-whiteboard__color-input" });
  colorInput.type = "color";
  colorInput.value = activeColor;

  const swatches = toolbar.createDiv({ cls: "embedded-whiteboard__swatches" });
  for (const color of DEFAULT_COLORS) {
    const swatch = swatches.createEl("button", { cls: "embedded-whiteboard__swatch" });
    swatch.type = "button";
    swatch.style.backgroundColor = color;
    swatch.addEventListener("click", () => {
      activeColor = color;
      colorInput.value = color;
      updateToolbar();
    });
  }

  const sizeInput = toolbar.createEl("input", { cls: "embedded-whiteboard__range" });
  sizeInput.type = "range";
  sizeInput.min = "1";
  sizeInput.max = "36";
  sizeInput.value = String(brushSize);

  const opacityInput = toolbar.createEl("input", { cls: "embedded-whiteboard__range" });
  opacityInput.type = "range";
  opacityInput.min = "0.1";
  opacityInput.max = "1";
  opacityInput.step = "0.05";
  opacityInput.value = String(opacity);

  toolbar.appendChild(status);
  viewport.style.minHeight = `${DEFAULT_BOARD_HEIGHT}px`;

  undoButton.addEventListener("click", () => undo());
  redoButton.addEventListener("click", () => redo());
  addLayerButton.addEventListener("click", () => addLayer());
  colorInput.addEventListener("input", () => {
    activeColor = colorInput.value;
  });
  sizeInput.addEventListener("input", () => {
    brushSize = Number(sizeInput.value);
  });
  opacityInput.addEventListener("input", () => {
    opacity = Number(opacityInput.value);
  });

  function setActiveTool(tool: WhiteboardTool): void {
    activeTool = tool;
    if (tool === "pen" || tool === "pencil" || tool === "marker") {
      brushSize = TOOL_PRESETS[tool].width;
      opacity = TOOL_PRESETS[tool].opacity;
      sizeInput.value = String(brushSize);
      opacityInput.value = String(opacity);
    }
    updateToolbar();
    updateStatus(`${TOOL_LABELS[tool]} ready`);
  }

  function updateToolbar(): void {
    for (const [tool, button] of toolButtons) {
      button.toggleClass("is-active", tool === activeTool);
    }
    undoButton.disabled = historyIndex === 0;
    redoButton.disabled = historyIndex === history.length - 1;
  }

  function updateStatus(message = "Ready"): void {
    status.setText(message);
  }

  function queueSave(): void {
    if (destroyed) {
      return;
    }

    if (saveTimer !== null) {
      window.clearTimeout(saveTimer);
    }

    saveTimer = window.setTimeout(async () => {
      saveTimer = null;
      try {
        await host.save(structuredClone(board));
        updateStatus("Saved");
      } catch (error) {
        console.error(error);
        new Notice("Unable to save embedded whiteboard");
        updateStatus("Save failed");
      }
    }, 160);
  }

  function pushHistory(): void {
    const snapshot = structuredClone(board);
    history = history.slice(0, historyIndex + 1);
    history.push(snapshot);
    historyIndex = history.length - 1;
    updateToolbar();
  }

  function undo(): void {
    if (historyIndex === 0) {
      return;
    }
    historyIndex -= 1;
    board = structuredClone(history[historyIndex]);
    ensureActiveLayer();
    selectedItemId = null;
    renderBoard();
    queueSave();
  }

  function redo(): void {
    if (historyIndex >= history.length - 1) {
      return;
    }
    historyIndex += 1;
    board = structuredClone(history[historyIndex]);
    ensureActiveLayer();
    selectedItemId = null;
    renderBoard();
    queueSave();
  }

  function ensureActiveLayer(): void {
    if (!board.layers.some((layer) => layer.id === activeLayerId)) {
      activeLayerId = board.layers[0]?.id ?? createDefaultBoard().layers[0].id;
    }
  }

  function getLayer(layerId: string): WhiteboardLayer | undefined {
    return board.layers.find((layer) => layer.id === layerId);
  }

  function getItem(itemId: string): WhiteboardItem | undefined {
    return board.items.find((item) => item.id === itemId);
  }

  function isLayerVisible(layerId: string): boolean {
    return getLayer(layerId)?.visible !== false;
  }

  function isLayerLocked(layerId: string): boolean {
    return getLayer(layerId)?.locked === true;
  }

  function applyViewport(): void {
    scene.style.transform = `translate(${board.viewport.x}px, ${board.viewport.y}px) scale(${board.viewport.zoom})`;
    textWorld.style.transform = `translate(${board.viewport.x}px, ${board.viewport.y}px) scale(${board.viewport.zoom})`;
    const gridSize = 48 * board.viewport.zoom;
    grid.style.backgroundSize = `${gridSize}px ${gridSize}px`;
    grid.style.backgroundPosition = `${board.viewport.x}px ${board.viewport.y}px`;
  }

  function renderLayers(): void {
    layersList.empty();

    for (const layer of [...board.layers].reverse()) {
      const row = layersList.createDiv({ cls: "embedded-whiteboard__layer-row" });
      row.toggleClass("is-active", layer.id === activeLayerId);

      const visibilityButton = row.createEl("button", {
        cls: "embedded-whiteboard__layer-visibility",
        text: layer.visible ? "Hide" : "Show"
      });
      visibilityButton.type = "button";
      visibilityButton.addEventListener("click", () => {
        layer.visible = !layer.visible;
        renderBoard();
        pushHistory();
        queueSave();
      });

      const lockButton = row.createEl("button", {
        cls: "embedded-whiteboard__layer-lock",
        text: layer.locked ? "Unlock" : "Lock"
      });
      lockButton.type = "button";
      lockButton.addEventListener("click", () => {
        layer.locked = !layer.locked;
        renderBoard();
        pushHistory();
        queueSave();
      });

      const nameButton = row.createEl("button", {
        cls: "embedded-whiteboard__layer-name",
        text: layer.name
      });
      nameButton.type = "button";
      nameButton.addEventListener("click", () => {
        activeLayerId = layer.id;
        renderLayers();
        updateStatus(`Active layer: ${layer.name}`);
      });
    }
  }

  function renderBoard(): void {
    cleanupTextEditor();
    applyViewport();
    renderItems();
    renderLayers();
    updateToolbar();
  }

  function renderItems(): void {
    strokeLayer.empty();
    textWorld.empty();

    for (const item of board.items) {
      if (!isLayerVisible(item.layerId)) {
        continue;
      }

      if (item.type === "stroke") {
        const path = strokeLayer.createEl("path", { cls: "embedded-whiteboard__stroke" });
        path.setAttribute("d", pointsToPath(item.points));
        path.setAttribute("stroke", item.color);
        path.setAttribute("stroke-width", String(item.width));
        path.setAttribute("stroke-linecap", "round");
        path.setAttribute("stroke-linejoin", "round");
        path.setAttribute("fill", "none");
        path.style.opacity = String(item.opacity);
        path.dataset.itemId = item.id;
        path.dataset.tool = item.tool;
        path.toggleClass("is-selected", item.id === selectedItemId);
      } else {
        const textEl = textWorld.createDiv({ cls: "embedded-whiteboard__text-item" });
        textEl.dataset.itemId = item.id;
        textEl.style.left = `${item.x}px`;
        textEl.style.top = `${item.y}px`;
        textEl.style.color = item.color;
        textEl.style.fontSize = `${item.size}px`;
        textEl.style.whiteSpace = "pre-wrap";
        textEl.setText(item.text || "Text");
        textEl.toggleClass("is-selected", item.id === selectedItemId);
      }
    }
  }

  function renderDraftStroke(): void {
    if (!draftStroke) {
      draftPath.setAttribute("d", "");
      return;
    }

    draftPath.setAttribute("d", pointsToPath(draftStroke.points));
    draftPath.setAttribute("stroke", draftStroke.color);
    draftPath.setAttribute("stroke-width", String(draftStroke.width));
    draftPath.setAttribute("stroke-linecap", "round");
    draftPath.setAttribute("stroke-linejoin", "round");
    draftPath.setAttribute("fill", "none");
    draftPath.style.opacity = String(draftStroke.opacity);
  }

  function cleanupTextEditor(): void {
    if (activeTextEditor) {
      activeTextEditor.remove();
      activeTextEditor = null;
    }
  }

  function openTextEditor(point: { x: number; y: number }, existing?: TextItem): void {
    cleanupTextEditor();

    const editor = textWorld.createEl("textarea", { cls: "embedded-whiteboard__text-editor" });
    editor.value = existing?.text ?? "";
    editor.style.left = `${existing?.x ?? point.x}px`;
    editor.style.top = `${existing?.y ?? point.y}px`;
    editor.style.color = existing?.color ?? activeColor;
    editor.style.fontSize = `${existing?.size ?? 20}px`;
    activeTextEditor = editor;
    editor.focus();

    const commit = (): void => {
      const text = editor.value.trimEnd();
      const target = existing ?? {
        id: createId("text"),
        type: "text" as const,
        layerId: activeLayerId,
        x: point.x,
        y: point.y,
        text: "",
        color: activeColor,
        size: 20
      };

      if (text.trim().length === 0) {
        cleanupTextEditor();
        renderBoard();
        return;
      }

      target.text = text;
      target.color = existing?.color ?? activeColor;
      target.size = existing?.size ?? 20;

      if (!existing) {
        board.items.push(target);
      }

      cleanupTextEditor();
      selectedItemId = target.id;
      renderBoard();
      pushHistory();
      queueSave();
    };

    editor.addEventListener("blur", commit, { once: true });
    editor.addEventListener("keydown", (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        editor.blur();
      }
    });
  }

  function addLayer(): void {
    const layer: WhiteboardLayer = {
      id: createId("layer"),
      name: `Layer ${board.layers.length + 1}`,
      visible: true,
      locked: false
    };
    board.layers.push(layer);
    activeLayerId = layer.id;
    renderLayers();
    pushHistory();
    queueSave();
  }

  function getWorldPoint(event: PointerEvent): { x: number; y: number } {
    const bounds = viewport.getBoundingClientRect();
    return {
      x: (event.clientX - bounds.left - board.viewport.x) / board.viewport.zoom,
      y: (event.clientY - bounds.top - board.viewport.y) / board.viewport.zoom
    };
  }

  function beginStroke(point: { x: number; y: number }, event: PointerEvent): void {
    if (isLayerLocked(activeLayerId)) {
      updateStatus("Active layer is locked");
      return;
    }

    const tool = activeTool === "pen" || activeTool === "pencil" || activeTool === "marker" ? activeTool : "pen";
    draftStroke = {
      id: createId("stroke"),
      type: "stroke",
      layerId: activeLayerId,
      tool,
      color: activeColor,
      width: brushSize,
      opacity,
      points: [
        {
          x: point.x,
          y: point.y,
          pressure: normalizePressure(event.pressure)
        }
      ]
    };
    pointerMode = { type: "draw", pointerId: event.pointerId };
    renderDraftStroke();
  }

  function commitStroke(): void {
    if (!draftStroke) {
      return;
    }
    if (draftStroke.points.length > 1) {
      board.items.push(draftStroke);
      selectedItemId = draftStroke.id;
      pushHistory();
      queueSave();
    }
    draftStroke = null;
    renderDraftStroke();
    renderBoard();
  }

  function eraseAt(point: { x: number; y: number }): boolean {
    const item = hitTest(point, true);
    if (!item) {
      return false;
    }

    board.items = board.items.filter((candidate) => candidate.id !== item.id);
    if (selectedItemId === item.id) {
      selectedItemId = null;
    }
    renderBoard();
    return true;
  }

  function hitTest(point: { x: number; y: number }, ignoreLocked = false): WhiteboardItem | null {
    for (const item of [...board.items].reverse()) {
      if (!isLayerVisible(item.layerId)) {
        continue;
      }
      if (!ignoreLocked && isLayerLocked(item.layerId)) {
        continue;
      }

      if (item.type === "text") {
        if (
          point.x >= item.x - 8 &&
          point.x <= item.x + 320 &&
          point.y >= item.y - 8 &&
          point.y <= item.y + 64
        ) {
          return item;
        }
      } else if (isPointNearStroke(point, item)) {
        return item;
      }
    }

    return null;
  }

  function beginMove(item: WhiteboardItem, point: { x: number; y: number }, event: PointerEvent): void {
    if (item.type === "text") {
      pointerMode = {
        type: "move",
        pointerId: event.pointerId,
        itemId: item.id,
        startX: point.x,
        startY: point.y,
        originText: { x: item.x, y: item.y }
      };
      return;
    }

    pointerMode = {
      type: "move",
      pointerId: event.pointerId,
      itemId: item.id,
      startX: point.x,
      startY: point.y,
      originPoints: item.points.map((current) => ({ ...current }))
    };
  }

  function translateItem(mode: Extract<PointerMode, { type: "move" }>, point: { x: number; y: number }): void {
    const item = getItem(mode.itemId);
    if (!item) {
      return;
    }

    const dx = point.x - mode.startX;
    const dy = point.y - mode.startY;

    if (item.type === "text" && mode.originText) {
      item.x = mode.originText.x + dx;
      item.y = mode.originText.y + dy;
    }

    if (item.type === "stroke" && mode.originPoints) {
      item.points = mode.originPoints.map((origin) => ({
        x: origin.x + dx,
        y: origin.y + dy,
        pressure: origin.pressure
      }));
    }

    renderBoard();
  }

  viewport.addEventListener("pointerdown", (event) => {
    cleanupTextEditor();
    viewport.setPointerCapture(event.pointerId);
    const point = getWorldPoint(event);
    const textTarget = (event.target as HTMLElement).closest<HTMLElement>(".embedded-whiteboard__text-item");
    const targetedItem = textTarget?.dataset.itemId ? getItem(textTarget.dataset.itemId) : hitTest(point);

    if (activeTool === "hand" || event.button === 1) {
      pointerMode = {
        type: "pan",
        startX: event.clientX,
        startY: event.clientY,
        originX: board.viewport.x,
        originY: board.viewport.y
      };
      return;
    }

    if (activeTool === "text") {
      if (targetedItem?.type === "text") {
        selectedItemId = targetedItem.id;
        openTextEditor({ x: targetedItem.x, y: targetedItem.y }, targetedItem);
      } else {
        selectedItemId = null;
        openTextEditor(point);
      }
      renderBoard();
      return;
    }

    if (activeTool === "eraser") {
      const removed = eraseAt(point);
      pointerMode = { type: "erase", pointerId: event.pointerId, removed };
      return;
    }

    if (activeTool === "select") {
      if (targetedItem) {
        selectedItemId = targetedItem.id;
        if (!isLayerLocked(targetedItem.layerId)) {
          beginMove(targetedItem, point, event);
        }
      } else {
        selectedItemId = null;
        renderBoard();
      }
      renderBoard();
      return;
    }

    beginStroke(point, event);
  });

  viewport.addEventListener("pointermove", (event) => {
    const point = getWorldPoint(event);

    if (pointerMode.type === "pan") {
      board.viewport.x = pointerMode.originX + (event.clientX - pointerMode.startX);
      board.viewport.y = pointerMode.originY + (event.clientY - pointerMode.startY);
      applyViewport();
      return;
    }

    if (pointerMode.type === "draw" && draftStroke) {
      draftStroke.points.push({
        x: point.x,
        y: point.y,
        pressure: normalizePressure(event.pressure)
      });
      renderDraftStroke();
      return;
    }

    if (pointerMode.type === "move") {
      translateItem(pointerMode, point);
      return;
    }

    if (pointerMode.type === "erase") {
      const removed = eraseAt(point) || pointerMode.removed;
      pointerMode = { ...pointerMode, removed };
    }
  });

  const stopPointer = (): void => {
    if (pointerMode.type === "draw") {
      commitStroke();
    } else if (pointerMode.type === "move") {
      pushHistory();
      queueSave();
    } else if (pointerMode.type === "erase" && pointerMode.removed) {
      pushHistory();
      queueSave();
    } else if (pointerMode.type === "pan") {
      queueSave();
    }

    pointerMode = { type: "idle" };
  };

  viewport.addEventListener("pointerup", stopPointer);
  viewport.addEventListener("pointerleave", stopPointer);

  viewport.addEventListener(
    "wheel",
    (event) => {
      event.preventDefault();

      const bounds = viewport.getBoundingClientRect();
      const cursorX = event.clientX - bounds.left;
      const cursorY = event.clientY - bounds.top;
      const worldX = (cursorX - board.viewport.x) / board.viewport.zoom;
      const worldY = (cursorY - board.viewport.y) / board.viewport.zoom;
      const nextZoom = clamp(board.viewport.zoom * (event.deltaY < 0 ? 1.08 : 0.92), 0.2, 4);

      board.viewport.zoom = nextZoom;
      board.viewport.x = cursorX - worldX * nextZoom;
      board.viewport.y = cursorY - worldY * nextZoom;
      applyViewport();
      queueSave();
    },
    { passive: false }
  );

  setActiveTool("pen");
  renderBoard();

  return {
    destroy() {
      destroyed = true;
      if (saveTimer !== null) {
        window.clearTimeout(saveTimer);
      }
      cleanupTextEditor();
      container.empty();
    }
  };
}

function normalizePressure(pressure: number): number {
  if (pressure > 0 && Number.isFinite(pressure)) {
    return pressure;
  }
  return 0.5;
}

function pointsToPath(points: StrokePoint[]): string {
  if (points.length === 0) {
    return "";
  }

  if (points.length === 1) {
    const point = points[0];
    return `M ${point.x} ${point.y} L ${point.x + 0.01} ${point.y + 0.01}`;
  }

  let path = `M ${points[0].x} ${points[0].y}`;
  for (let index = 1; index < points.length - 1; index += 1) {
    const current = points[index];
    const next = points[index + 1];
    const midX = (current.x + next.x) / 2;
    const midY = (current.y + next.y) / 2;
    path += ` Q ${current.x} ${current.y} ${midX} ${midY}`;
  }

  const last = points[points.length - 1];
  path += ` L ${last.x} ${last.y}`;
  return path;
}

function isPointNearStroke(point: { x: number; y: number }, stroke: StrokeItem): boolean {
  const threshold = Math.max(stroke.width * 1.5, 10);

  for (let index = 1; index < stroke.points.length; index += 1) {
    const previous = stroke.points[index - 1];
    const current = stroke.points[index];
    if (distanceToSegment(point, previous, current) <= threshold) {
      return true;
    }
  }

  return false;
}

function distanceToSegment(
  point: { x: number; y: number },
  start: { x: number; y: number },
  end: { x: number; y: number }
): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;

  if (dx === 0 && dy === 0) {
    return Math.hypot(point.x - start.x, point.y - start.y);
  }

  const t = clamp(((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy), 0, 1);
  const projectionX = start.x + t * dx;
  const projectionY = start.y + t * dy;
  return Math.hypot(point.x - projectionX, point.y - projectionY);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
