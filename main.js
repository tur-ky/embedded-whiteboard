"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// main.ts
var main_exports = {};
__export(main_exports, {
  default: () => EmbeddedWhiteboardPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian2 = require("obsidian");

// src/state.ts
var WHITEBOARD_FENCE = "inline-whiteboard";
var DEFAULT_BOARD_HEIGHT = 620;
var DEFAULT_COLORS = [
  "#111111",
  "#2563eb",
  "#14b8a6",
  "#22c55e",
  "#f59e0b",
  "#ef4444",
  "#e11d48",
  "#7c3aed"
];
var TOOL_PRESETS = {
  pen: { width: 4, opacity: 1 },
  pencil: { width: 2, opacity: 0.72 },
  marker: { width: 12, opacity: 0.28 }
};
function createId(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}
function createLayer(name = "Layer 1") {
  return {
    id: createId("layer"),
    name,
    visible: true,
    locked: false
  };
}
function createDefaultUiState(layerId) {
  return {
    activeTool: "pen",
    activeColor: DEFAULT_COLORS[0],
    brushSize: TOOL_PRESETS.pen.width,
    opacity: TOOL_PRESETS.pen.opacity,
    activeLayerId: layerId
  };
}
function createDefaultBoard() {
  const layer = createLayer();
  return {
    id: createId("board"),
    layers: [layer],
    items: [],
    viewport: {
      x: 0,
      y: 0,
      zoom: 1
    },
    ui: createDefaultUiState(layer.id)
  };
}
function parseBoard(raw) {
  const parsed = JSON.parse(raw);
  if (Array.isArray(parsed.nodes)) {
    return migrateNodeBoard(parsed.nodes, parsed.viewport, parsed.id);
  }
  const layers = Array.isArray(parsed.layers) ? parsed.layers.filter((layer) => Boolean(layer && typeof layer.id === "string")).map((layer, index) => ({
    id: layer.id,
    name: typeof layer.name === "string" ? layer.name : `Layer ${index + 1}`,
    visible: layer.visible !== false,
    locked: layer.locked === true
  })) : [];
  const safeLayers = layers.length > 0 ? layers : [createLayer()];
  const layerIds = new Set(safeLayers.map((layer) => layer.id));
  const items = Array.isArray(parsed.items) ? parsed.items.filter((item) => Boolean(item && typeof item.id === "string" && typeof item.type === "string")).map((item) => normalizeItem(item, safeLayers[0].id)).filter((item) => Boolean(item && layerIds.has(item.layerId))) : [];
  const defaultUi = createDefaultUiState(safeLayers[0].id);
  return {
    id: typeof parsed.id === "string" ? parsed.id : createId("board"),
    layers: safeLayers,
    items,
    viewport: {
      x: typeof parsed.viewport?.x === "number" ? parsed.viewport.x : 0,
      y: typeof parsed.viewport?.y === "number" ? parsed.viewport.y : 0,
      zoom: typeof parsed.viewport?.zoom === "number" ? parsed.viewport.zoom : 1
    },
    ui: {
      activeTool: isWhiteboardTool(parsed.ui?.activeTool) ? parsed.ui.activeTool : defaultUi.activeTool,
      activeColor: typeof parsed.ui?.activeColor === "string" ? parsed.ui.activeColor : defaultUi.activeColor,
      brushSize: typeof parsed.ui?.brushSize === "number" ? parsed.ui.brushSize : defaultUi.brushSize,
      opacity: typeof parsed.ui?.opacity === "number" ? parsed.ui.opacity : defaultUi.opacity,
      activeLayerId: typeof parsed.ui?.activeLayerId === "string" && layerIds.has(parsed.ui.activeLayerId) ? parsed.ui.activeLayerId : defaultUi.activeLayerId
    }
  };
}
function serializeBoard(board) {
  return JSON.stringify(board, null, 2);
}
function wrapBoard(board) {
  return `\`\`\`${WHITEBOARD_FENCE}
${serializeBoard(board)}
\`\`\``;
}
function isWhiteboardTool(value) {
  return value === "pen" || value === "pencil" || value === "marker" || value === "eraser" || value === "text" || value === "select" || value === "hand";
}
function normalizeItem(item, fallbackLayerId) {
  if (item.type === "stroke") {
    const stroke = item;
    return {
      id: stroke.id ?? createId("stroke"),
      type: "stroke",
      layerId: typeof stroke.layerId === "string" ? stroke.layerId : fallbackLayerId,
      tool: stroke.tool === "pencil" || stroke.tool === "marker" ? stroke.tool : "pen",
      color: typeof stroke.color === "string" ? stroke.color : DEFAULT_COLORS[0],
      width: typeof stroke.width === "number" ? stroke.width : TOOL_PRESETS.pen.width,
      opacity: typeof stroke.opacity === "number" ? stroke.opacity : TOOL_PRESETS.pen.opacity,
      points: Array.isArray(stroke.points) ? stroke.points.filter((point) => Boolean(point && typeof point.x === "number" && typeof point.y === "number")).map((point) => ({
        x: point.x,
        y: point.y,
        pressure: typeof point.pressure === "number" ? point.pressure : 0.5
      })) : []
    };
  }
  if (item.type === "text") {
    const text = item;
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
function migrateNodeBoard(nodes, viewport, boardId) {
  const layer = createLayer();
  const items = nodes.filter((node) => typeof node.id === "string").map((node) => ({
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
    },
    ui: createDefaultUiState(layer.id)
  };
}

// src/whiteboard.ts
var import_obsidian = require("obsidian");
var TOOL_LABELS = {
  pen: "Pen",
  pencil: "Pencil",
  marker: "Marker",
  eraser: "Eraser",
  text: "Text",
  select: "Select",
  hand: "Hand"
};
function mountWhiteboard(container, initialBoard, host) {
  container.empty();
  container.addClass("embedded-whiteboard");
  const root = container.createDiv({ cls: "embedded-whiteboard__shell" });
  const toolbar = root.createDiv({ cls: "embedded-whiteboard__toolbar" });
  const workspace = root.createDiv({ cls: "embedded-whiteboard__workspace" });
  const viewport = workspace.createDiv({ cls: "embedded-whiteboard__viewport" });
  const grid = viewport.createDiv({ cls: "embedded-whiteboard__grid" });
  const scene = viewport.createSvg("svg", { cls: "embedded-whiteboard__scene" });
  scene.setAttribute("width", "100%");
  scene.setAttribute("height", "100%");
  const strokeLayer = scene.createSvg("g", { cls: "embedded-whiteboard__stroke-layer" });
  const draftLayer = scene.createSvg("g", { cls: "embedded-whiteboard__draft-layer" });
  const draftPath = draftLayer.createSvg("path", { cls: "embedded-whiteboard__draft-path" });
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
  let activeTool = board.ui.activeTool;
  let activeColor = board.ui.activeColor;
  let brushSize = board.ui.brushSize;
  let opacity = board.ui.opacity;
  let activeLayerId = board.ui.activeLayerId ?? board.layers[0].id;
  let selectedItemId = null;
  let pointerMode = { type: "idle" };
  let draftStroke = null;
  let saveTimer = null;
  let destroyed = false;
  let activeTextEditor = null;
  let history = [structuredClone(board)];
  let historyIndex = 0;
  const toolButtons = /* @__PURE__ */ new Map();
  const undoButton = toolbar.createEl("button", { cls: "embedded-whiteboard__button", text: "Undo" });
  undoButton.type = "button";
  const redoButton = toolbar.createEl("button", { cls: "embedded-whiteboard__button", text: "Redo" });
  redoButton.type = "button";
  const toolOrder = ["pen", "pencil", "marker", "eraser", "text", "select", "hand"];
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
      syncUiState();
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
    syncUiState();
  });
  sizeInput.addEventListener("input", () => {
    brushSize = Number(sizeInput.value);
    syncUiState();
  });
  opacityInput.addEventListener("input", () => {
    opacity = Number(opacityInput.value);
    syncUiState();
  });
  function syncUiState() {
    board.ui.activeTool = activeTool;
    board.ui.activeColor = activeColor;
    board.ui.brushSize = brushSize;
    board.ui.opacity = opacity;
    board.ui.activeLayerId = activeLayerId;
  }
  function setActiveTool(tool) {
    activeTool = tool;
    if (tool === "pen" || tool === "pencil" || tool === "marker") {
      brushSize = TOOL_PRESETS[tool].width;
      opacity = TOOL_PRESETS[tool].opacity;
      sizeInput.value = String(brushSize);
      opacityInput.value = String(opacity);
    }
    syncUiState();
    updateToolbar();
    updateStatus(`${TOOL_LABELS[tool]} ready`);
  }
  function updateToolbar() {
    for (const [tool, button] of toolButtons) {
      button.toggleClass("is-active", tool === activeTool);
    }
    undoButton.disabled = historyIndex === 0;
    redoButton.disabled = historyIndex === history.length - 1;
  }
  function updateStatus(message = "Ready") {
    status.setText(message);
  }
  function queueSave() {
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
        new import_obsidian.Notice("Unable to save embedded whiteboard");
        updateStatus("Save failed");
      }
    }, 160);
  }
  function pushHistory() {
    const snapshot = structuredClone(board);
    history = history.slice(0, historyIndex + 1);
    history.push(snapshot);
    historyIndex = history.length - 1;
    updateToolbar();
  }
  function undo() {
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
  function redo() {
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
  function ensureActiveLayer() {
    if (!board.layers.some((layer) => layer.id === activeLayerId)) {
      activeLayerId = board.layers[0]?.id ?? createDefaultBoard().layers[0].id;
    }
  }
  function getLayer(layerId) {
    return board.layers.find((layer) => layer.id === layerId);
  }
  function getItem(itemId) {
    return board.items.find((item) => item.id === itemId);
  }
  function isLayerVisible(layerId) {
    return getLayer(layerId)?.visible !== false;
  }
  function isLayerLocked(layerId) {
    return getLayer(layerId)?.locked === true;
  }
  function applyViewport() {
    scene.style.transform = `translate(${board.viewport.x}px, ${board.viewport.y}px) scale(${board.viewport.zoom})`;
    textWorld.style.transform = `translate(${board.viewport.x}px, ${board.viewport.y}px) scale(${board.viewport.zoom})`;
    const gridSize = 48 * board.viewport.zoom;
    grid.style.backgroundSize = `${gridSize}px ${gridSize}px`;
    grid.style.backgroundPosition = `${board.viewport.x}px ${board.viewport.y}px`;
  }
  function renderLayers() {
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
        syncUiState();
        renderLayers();
        updateStatus(`Active layer: ${layer.name}`);
      });
    }
  }
  function renderBoard() {
    cleanupTextEditor();
    applyViewport();
    renderItems();
    renderLayers();
    updateToolbar();
  }
  function renderItems() {
    strokeLayer.empty();
    textWorld.empty();
    for (const item of board.items) {
      if (!isLayerVisible(item.layerId)) {
        continue;
      }
      if (item.type === "stroke") {
        const path = strokeLayer.createSvg("path", { cls: "embedded-whiteboard__stroke" });
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
  function renderDraftStroke() {
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
  function cleanupTextEditor() {
    if (activeTextEditor) {
      if (activeTextEditor.isConnected) {
        activeTextEditor.remove();
      }
      activeTextEditor = null;
    }
  }
  function openTextEditor(point, existing) {
    cleanupTextEditor();
    const editor = textWorld.createEl("textarea", { cls: "embedded-whiteboard__text-editor" });
    editor.value = existing?.text ?? "";
    editor.style.left = `${existing?.x ?? point.x}px`;
    editor.style.top = `${existing?.y ?? point.y}px`;
    editor.style.color = existing?.color ?? activeColor;
    editor.style.fontSize = `${existing?.size ?? 20}px`;
    activeTextEditor = editor;
    editor.focus();
    const commit = () => {
      const text = editor.value.trimEnd();
      const target = existing ?? {
        id: createId("text"),
        type: "text",
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
  function addLayer() {
    const layer = {
      id: createId("layer"),
      name: `Layer ${board.layers.length + 1}`,
      visible: true,
      locked: false
    };
    board.layers.push(layer);
    activeLayerId = layer.id;
    syncUiState();
    renderLayers();
    pushHistory();
    queueSave();
  }
  function getWorldPoint(event) {
    const bounds = viewport.getBoundingClientRect();
    return {
      x: (event.clientX - bounds.left - board.viewport.x) / board.viewport.zoom,
      y: (event.clientY - bounds.top - board.viewport.y) / board.viewport.zoom
    };
  }
  function beginStroke(point, event) {
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
  function commitStroke() {
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
  function eraseAt(point) {
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
  function hitTest(point, ignoreLocked = false) {
    for (const item of [...board.items].reverse()) {
      if (!isLayerVisible(item.layerId)) {
        continue;
      }
      if (!ignoreLocked && isLayerLocked(item.layerId)) {
        continue;
      }
      if (item.type === "text") {
        if (point.x >= item.x - 8 && point.x <= item.x + 320 && point.y >= item.y - 8 && point.y <= item.y + 64) {
          return item;
        }
      } else if (isPointNearStroke(point, item)) {
        return item;
      }
    }
    return null;
  }
  function beginMove(item, point, event) {
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
  function translateItem(mode, point) {
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
    const textTarget = event.target.closest(".embedded-whiteboard__text-item");
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
      pointerMode = { type: "idle" };
      if (targetedItem?.type === "text") {
        selectedItemId = targetedItem.id;
        renderBoard();
        openTextEditor({ x: targetedItem.x, y: targetedItem.y }, targetedItem);
      } else {
        selectedItemId = null;
        renderBoard();
        openTextEditor(point);
      }
      updateStatus("Editing text");
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
  const stopPointer = () => {
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
  syncUiState();
  updateToolbar();
  updateStatus(`${TOOL_LABELS[activeTool]} ready`);
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
function normalizePressure(pressure) {
  if (pressure > 0 && Number.isFinite(pressure)) {
    return pressure;
  }
  return 0.5;
}
function pointsToPath(points) {
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
function isPointNearStroke(point, stroke) {
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
function distanceToSegment(point, start, end) {
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
function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

// main.ts
var EmbeddedWhiteboardPlugin = class extends import_obsidian2.Plugin {
  async onload() {
    this.registerMarkdownCodeBlockProcessor(
      WHITEBOARD_FENCE,
      async (source, el, ctx) => {
        const board = this.parseOrCreateBoard(source);
        const handle = mountWhiteboard(el, board, {
          sourcePath: ctx.sourcePath,
          save: async (nextBoard) => {
            await this.persistBlock(ctx.sourcePath, nextBoard);
          }
        });
        this.register(() => handle.destroy());
      }
    );
    this.addCommand({
      id: "insert-embedded-whiteboard",
      name: "Insert embedded whiteboard",
      editorCallback: (editor) => {
        this.insertEmbeddedWhiteboard(editor);
      }
    });
    this.addCommand({
      id: "append-embedded-whiteboard",
      name: "Append embedded whiteboard to current note",
      checkCallback: (checking) => {
        const view = this.app.workspace.getActiveViewOfType(import_obsidian2.MarkdownView);
        if (!view?.file) {
          return false;
        }
        if (!checking) {
          void this.appendBoardToFile(view.file);
        }
        return true;
      }
    });
    this.registerEvent(
      this.app.workspace.on("editor-menu", (menu, editor) => {
        menu.addItem((item) => {
          item.setTitle("Insert embedded whiteboard").setIcon("layout-dashboard").onClick(() => {
            this.insertEmbeddedWhiteboard(editor);
          });
        });
      })
    );
  }
  parseOrCreateBoard(source) {
    try {
      return parseBoard(source);
    } catch (error) {
      console.error(error);
      return createDefaultBoard();
    }
  }
  async appendBoardToFile(file) {
    const content = await this.app.vault.read(file);
    const suffix = content.endsWith("\n") ? "" : "\n";
    await this.app.vault.modify(file, `${content}${suffix}
${wrapBoard(createDefaultBoard())}
`);
    new import_obsidian2.Notice("Embedded whiteboard appended to the note");
  }
  insertEmbeddedWhiteboard(editor) {
    const board = wrapBoard(createDefaultBoard());
    const cursor = editor.getCursor();
    const needsLeadingBreak = cursor.line > 0 ? "\n" : "";
    editor.replaceRange(`${needsLeadingBreak}${board}
`, cursor);
  }
  async persistBlock(sourcePath, board) {
    const file = this.app.vault.getAbstractFileByPath(sourcePath);
    if (!(file instanceof import_obsidian2.TFile)) {
      throw new Error(`Unable to find source note: ${sourcePath}`);
    }
    const current = await this.app.vault.read(file);
    const block = this.findBlockByBoardId(current, board.id) ?? this.findSingleWhiteboardBlock(current);
    if (!block) {
      throw new Error("Unable to find the embedded whiteboard block in the source note");
    }
    const nextBlock = wrapBoard(board);
    const updated = `${current.slice(0, block.from)}${nextBlock}${current.slice(block.to)}`;
    await this.app.vault.modify(file, updated);
  }
  findBlockByBoardId(content, boardId) {
    for (const block of this.iterateWhiteboardBlocks(content)) {
      try {
        const parsed = parseBoard(block.content);
        if (parsed.id === boardId) {
          return block;
        }
      } catch {
        continue;
      }
    }
    return null;
  }
  findSingleWhiteboardBlock(content) {
    const blocks = [...this.iterateWhiteboardBlocks(content)];
    return blocks.length === 1 ? blocks[0] : null;
  }
  *iterateWhiteboardBlocks(content) {
    const opening = `\`\`\`${WHITEBOARD_FENCE}`;
    let searchFrom = 0;
    while (searchFrom < content.length) {
      const start = content.indexOf(opening, searchFrom);
      if (start === -1) {
        return;
      }
      const afterOpening = content.indexOf("\n", start);
      if (afterOpening === -1) {
        return;
      }
      const close = content.indexOf("\n```", afterOpening);
      if (close === -1) {
        return;
      }
      const end = close + 4;
      yield {
        from: start,
        to: end,
        content: content.slice(afterOpening + 1, close)
      };
      searchFrom = end;
    }
  }
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsibWFpbi50cyIsICJzcmMvc3RhdGUudHMiLCAic3JjL3doaXRlYm9hcmQudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImltcG9ydCB7XG4gIEVkaXRvcixcbiAgTWFya2Rvd25WaWV3LFxuICBOb3RpY2UsXG4gIFBsdWdpbixcbiAgVEZpbGVcbn0gZnJvbSBcIm9ic2lkaWFuXCI7XG5pbXBvcnQge1xuICBjcmVhdGVEZWZhdWx0Qm9hcmQsXG4gIHBhcnNlQm9hcmQsXG4gIFdISVRFQk9BUkRfRkVOQ0UsXG4gIHdyYXBCb2FyZFxufSBmcm9tIFwiLi9zcmMvc3RhdGVcIjtcbmltcG9ydCB7IEVtYmVkZGVkV2hpdGVib2FyZERhdGEgfSBmcm9tIFwiLi9zcmMvdHlwZXNcIjtcbmltcG9ydCB7IG1vdW50V2hpdGVib2FyZCB9IGZyb20gXCIuL3NyYy93aGl0ZWJvYXJkXCI7XG5cbmludGVyZmFjZSBMb2NhdGVkQmxvY2sge1xuICBmcm9tOiBudW1iZXI7XG4gIHRvOiBudW1iZXI7XG4gIGNvbnRlbnQ6IHN0cmluZztcbn1cblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgRW1iZWRkZWRXaGl0ZWJvYXJkUGx1Z2luIGV4dGVuZHMgUGx1Z2luIHtcbiAgYXN5bmMgb25sb2FkKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIHRoaXMucmVnaXN0ZXJNYXJrZG93bkNvZGVCbG9ja1Byb2Nlc3NvcihcbiAgICAgIFdISVRFQk9BUkRfRkVOQ0UsXG4gICAgICBhc3luYyAoc291cmNlLCBlbCwgY3R4KSA9PiB7XG4gICAgICAgIGNvbnN0IGJvYXJkID0gdGhpcy5wYXJzZU9yQ3JlYXRlQm9hcmQoc291cmNlKTtcblxuICAgICAgICBjb25zdCBoYW5kbGUgPSBtb3VudFdoaXRlYm9hcmQoZWwsIGJvYXJkLCB7XG4gICAgICAgICAgc291cmNlUGF0aDogY3R4LnNvdXJjZVBhdGgsXG4gICAgICAgICAgc2F2ZTogYXN5bmMgKG5leHRCb2FyZCkgPT4ge1xuICAgICAgICAgICAgYXdhaXQgdGhpcy5wZXJzaXN0QmxvY2soY3R4LnNvdXJjZVBhdGgsIG5leHRCb2FyZCk7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgICAgICB0aGlzLnJlZ2lzdGVyKCgpID0+IGhhbmRsZS5kZXN0cm95KCkpO1xuICAgICAgfVxuICAgICk7XG5cbiAgICB0aGlzLmFkZENvbW1hbmQoe1xuICAgICAgaWQ6IFwiaW5zZXJ0LWVtYmVkZGVkLXdoaXRlYm9hcmRcIixcbiAgICAgIG5hbWU6IFwiSW5zZXJ0IGVtYmVkZGVkIHdoaXRlYm9hcmRcIixcbiAgICAgIGVkaXRvckNhbGxiYWNrOiAoZWRpdG9yKSA9PiB7XG4gICAgICAgIHRoaXMuaW5zZXJ0RW1iZWRkZWRXaGl0ZWJvYXJkKGVkaXRvcik7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICB0aGlzLmFkZENvbW1hbmQoe1xuICAgICAgaWQ6IFwiYXBwZW5kLWVtYmVkZGVkLXdoaXRlYm9hcmRcIixcbiAgICAgIG5hbWU6IFwiQXBwZW5kIGVtYmVkZGVkIHdoaXRlYm9hcmQgdG8gY3VycmVudCBub3RlXCIsXG4gICAgICBjaGVja0NhbGxiYWNrOiAoY2hlY2tpbmcpID0+IHtcbiAgICAgICAgY29uc3QgdmlldyA9IHRoaXMuYXBwLndvcmtzcGFjZS5nZXRBY3RpdmVWaWV3T2ZUeXBlKE1hcmtkb3duVmlldyk7XG4gICAgICAgIGlmICghdmlldz8uZmlsZSkge1xuICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghY2hlY2tpbmcpIHtcbiAgICAgICAgICB2b2lkIHRoaXMuYXBwZW5kQm9hcmRUb0ZpbGUodmlldy5maWxlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgdGhpcy5yZWdpc3RlckV2ZW50KFxuICAgICAgdGhpcy5hcHAud29ya3NwYWNlLm9uKFwiZWRpdG9yLW1lbnVcIiwgKG1lbnUsIGVkaXRvcikgPT4ge1xuICAgICAgICBtZW51LmFkZEl0ZW0oKGl0ZW0pID0+IHtcbiAgICAgICAgICBpdGVtXG4gICAgICAgICAgICAuc2V0VGl0bGUoXCJJbnNlcnQgZW1iZWRkZWQgd2hpdGVib2FyZFwiKVxuICAgICAgICAgICAgLnNldEljb24oXCJsYXlvdXQtZGFzaGJvYXJkXCIpXG4gICAgICAgICAgICAub25DbGljaygoKSA9PiB7XG4gICAgICAgICAgICAgIHRoaXMuaW5zZXJ0RW1iZWRkZWRXaGl0ZWJvYXJkKGVkaXRvcik7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgICB9KVxuICAgICk7XG4gIH1cblxuICBwcml2YXRlIHBhcnNlT3JDcmVhdGVCb2FyZChzb3VyY2U6IHN0cmluZyk6IEVtYmVkZGVkV2hpdGVib2FyZERhdGEge1xuICAgIHRyeSB7XG4gICAgICByZXR1cm4gcGFyc2VCb2FyZChzb3VyY2UpO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKGVycm9yKTtcbiAgICAgIHJldHVybiBjcmVhdGVEZWZhdWx0Qm9hcmQoKTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIGFwcGVuZEJvYXJkVG9GaWxlKGZpbGU6IFRGaWxlKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgY29udGVudCA9IGF3YWl0IHRoaXMuYXBwLnZhdWx0LnJlYWQoZmlsZSk7XG4gICAgY29uc3Qgc3VmZml4ID0gY29udGVudC5lbmRzV2l0aChcIlxcblwiKSA/IFwiXCIgOiBcIlxcblwiO1xuICAgIGF3YWl0IHRoaXMuYXBwLnZhdWx0Lm1vZGlmeShmaWxlLCBgJHtjb250ZW50fSR7c3VmZml4fVxcbiR7d3JhcEJvYXJkKGNyZWF0ZURlZmF1bHRCb2FyZCgpKX1cXG5gKTtcbiAgICBuZXcgTm90aWNlKFwiRW1iZWRkZWQgd2hpdGVib2FyZCBhcHBlbmRlZCB0byB0aGUgbm90ZVwiKTtcbiAgfVxuXG4gIHByaXZhdGUgaW5zZXJ0RW1iZWRkZWRXaGl0ZWJvYXJkKGVkaXRvcjogRWRpdG9yKTogdm9pZCB7XG4gICAgY29uc3QgYm9hcmQgPSB3cmFwQm9hcmQoY3JlYXRlRGVmYXVsdEJvYXJkKCkpO1xuICAgIGNvbnN0IGN1cnNvciA9IGVkaXRvci5nZXRDdXJzb3IoKTtcbiAgICBjb25zdCBuZWVkc0xlYWRpbmdCcmVhayA9IGN1cnNvci5saW5lID4gMCA/IFwiXFxuXCIgOiBcIlwiO1xuICAgIGVkaXRvci5yZXBsYWNlUmFuZ2UoYCR7bmVlZHNMZWFkaW5nQnJlYWt9JHtib2FyZH1cXG5gLCBjdXJzb3IpO1xuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyBwZXJzaXN0QmxvY2soc291cmNlUGF0aDogc3RyaW5nLCBib2FyZDogRW1iZWRkZWRXaGl0ZWJvYXJkRGF0YSk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IGZpbGUgPSB0aGlzLmFwcC52YXVsdC5nZXRBYnN0cmFjdEZpbGVCeVBhdGgoc291cmNlUGF0aCk7XG4gICAgaWYgKCEoZmlsZSBpbnN0YW5jZW9mIFRGaWxlKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbmFibGUgdG8gZmluZCBzb3VyY2Ugbm90ZTogJHtzb3VyY2VQYXRofWApO1xuICAgIH1cblxuICAgIGNvbnN0IGN1cnJlbnQgPSBhd2FpdCB0aGlzLmFwcC52YXVsdC5yZWFkKGZpbGUpO1xuICAgIGNvbnN0IGJsb2NrID0gdGhpcy5maW5kQmxvY2tCeUJvYXJkSWQoY3VycmVudCwgYm9hcmQuaWQpID8/IHRoaXMuZmluZFNpbmdsZVdoaXRlYm9hcmRCbG9jayhjdXJyZW50KTtcbiAgICBpZiAoIWJsb2NrKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJVbmFibGUgdG8gZmluZCB0aGUgZW1iZWRkZWQgd2hpdGVib2FyZCBibG9jayBpbiB0aGUgc291cmNlIG5vdGVcIik7XG4gICAgfVxuXG4gICAgY29uc3QgbmV4dEJsb2NrID0gd3JhcEJvYXJkKGJvYXJkKTtcbiAgICBjb25zdCB1cGRhdGVkID0gYCR7Y3VycmVudC5zbGljZSgwLCBibG9jay5mcm9tKX0ke25leHRCbG9ja30ke2N1cnJlbnQuc2xpY2UoYmxvY2sudG8pfWA7XG4gICAgYXdhaXQgdGhpcy5hcHAudmF1bHQubW9kaWZ5KGZpbGUsIHVwZGF0ZWQpO1xuICB9XG5cbiAgcHJpdmF0ZSBmaW5kQmxvY2tCeUJvYXJkSWQoY29udGVudDogc3RyaW5nLCBib2FyZElkOiBzdHJpbmcpOiBMb2NhdGVkQmxvY2sgfCBudWxsIHtcbiAgICBmb3IgKGNvbnN0IGJsb2NrIG9mIHRoaXMuaXRlcmF0ZVdoaXRlYm9hcmRCbG9ja3MoY29udGVudCkpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IHBhcnNlZCA9IHBhcnNlQm9hcmQoYmxvY2suY29udGVudCk7XG4gICAgICAgIGlmIChwYXJzZWQuaWQgPT09IGJvYXJkSWQpIHtcbiAgICAgICAgICByZXR1cm4gYmxvY2s7XG4gICAgICAgIH1cbiAgICAgIH0gY2F0Y2gge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIHByaXZhdGUgZmluZFNpbmdsZVdoaXRlYm9hcmRCbG9jayhjb250ZW50OiBzdHJpbmcpOiBMb2NhdGVkQmxvY2sgfCBudWxsIHtcbiAgICBjb25zdCBibG9ja3MgPSBbLi4udGhpcy5pdGVyYXRlV2hpdGVib2FyZEJsb2Nrcyhjb250ZW50KV07XG4gICAgcmV0dXJuIGJsb2Nrcy5sZW5ndGggPT09IDEgPyBibG9ja3NbMF0gOiBudWxsO1xuICB9XG5cbiAgcHJpdmF0ZSAqaXRlcmF0ZVdoaXRlYm9hcmRCbG9ja3MoY29udGVudDogc3RyaW5nKTogR2VuZXJhdG9yPExvY2F0ZWRCbG9jaz4ge1xuICAgIGNvbnN0IG9wZW5pbmcgPSBgXFxgXFxgXFxgJHtXSElURUJPQVJEX0ZFTkNFfWA7XG4gICAgbGV0IHNlYXJjaEZyb20gPSAwO1xuXG4gICAgd2hpbGUgKHNlYXJjaEZyb20gPCBjb250ZW50Lmxlbmd0aCkge1xuICAgICAgY29uc3Qgc3RhcnQgPSBjb250ZW50LmluZGV4T2Yob3BlbmluZywgc2VhcmNoRnJvbSk7XG4gICAgICBpZiAoc3RhcnQgPT09IC0xKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgY29uc3QgYWZ0ZXJPcGVuaW5nID0gY29udGVudC5pbmRleE9mKFwiXFxuXCIsIHN0YXJ0KTtcbiAgICAgIGlmIChhZnRlck9wZW5pbmcgPT09IC0xKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgY29uc3QgY2xvc2UgPSBjb250ZW50LmluZGV4T2YoXCJcXG5gYGBcIiwgYWZ0ZXJPcGVuaW5nKTtcbiAgICAgIGlmIChjbG9zZSA9PT0gLTEpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBlbmQgPSBjbG9zZSArIDQ7XG4gICAgICB5aWVsZCB7XG4gICAgICAgIGZyb206IHN0YXJ0LFxuICAgICAgICB0bzogZW5kLFxuICAgICAgICBjb250ZW50OiBjb250ZW50LnNsaWNlKGFmdGVyT3BlbmluZyArIDEsIGNsb3NlKVxuICAgICAgfTtcblxuICAgICAgc2VhcmNoRnJvbSA9IGVuZDtcbiAgICB9XG4gIH1cbn1cclxuIiwgImltcG9ydCB7XG4gIERyYXdpbmdUb29sLFxuICBFbWJlZGRlZFdoaXRlYm9hcmREYXRhLFxuICBTdHJva2VJdGVtLFxuICBUZXh0SXRlbSxcbiAgV2hpdGVib2FyZEl0ZW0sXG4gIFdoaXRlYm9hcmRMYXllcixcbiAgV2hpdGVib2FyZFRvb2wsXG4gIFdoaXRlYm9hcmRVaVN0YXRlXG59IGZyb20gXCIuL3R5cGVzXCI7XG5cbmV4cG9ydCBjb25zdCBXSElURUJPQVJEX0ZFTkNFID0gXCJpbmxpbmUtd2hpdGVib2FyZFwiO1xuZXhwb3J0IGNvbnN0IERFRkFVTFRfQk9BUkRfSEVJR0hUID0gNjIwO1xuZXhwb3J0IGNvbnN0IERFRkFVTFRfQ09MT1JTID0gW1xuICBcIiMxMTExMTFcIixcbiAgXCIjMjU2M2ViXCIsXG4gIFwiIzE0YjhhNlwiLFxuICBcIiMyMmM1NWVcIixcbiAgXCIjZjU5ZTBiXCIsXG4gIFwiI2VmNDQ0NFwiLFxuICBcIiNlMTFkNDhcIixcbiAgXCIjN2MzYWVkXCJcbl0gYXMgY29uc3Q7XG5cbmV4cG9ydCBjb25zdCBUT09MX1BSRVNFVFM6IFJlY29yZDxEcmF3aW5nVG9vbCwgeyB3aWR0aDogbnVtYmVyOyBvcGFjaXR5OiBudW1iZXIgfT4gPSB7XG4gIHBlbjogeyB3aWR0aDogNCwgb3BhY2l0eTogMSB9LFxuICBwZW5jaWw6IHsgd2lkdGg6IDIsIG9wYWNpdHk6IDAuNzIgfSxcbiAgbWFya2VyOiB7IHdpZHRoOiAxMiwgb3BhY2l0eTogMC4yOCB9XG59O1xuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlSWQocHJlZml4OiBzdHJpbmcpOiBzdHJpbmcge1xuICByZXR1cm4gYCR7cHJlZml4fS0ke01hdGgucmFuZG9tKCkudG9TdHJpbmcoMzYpLnNsaWNlKDIsIDEwKX1gO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlTGF5ZXIobmFtZSA9IFwiTGF5ZXIgMVwiKTogV2hpdGVib2FyZExheWVyIHtcbiAgcmV0dXJuIHtcbiAgICBpZDogY3JlYXRlSWQoXCJsYXllclwiKSxcbiAgICBuYW1lLFxuICAgIHZpc2libGU6IHRydWUsXG4gICAgbG9ja2VkOiBmYWxzZVxuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlRGVmYXVsdFVpU3RhdGUobGF5ZXJJZD86IHN0cmluZyk6IFdoaXRlYm9hcmRVaVN0YXRlIHtcbiAgcmV0dXJuIHtcbiAgICBhY3RpdmVUb29sOiBcInBlblwiLFxuICAgIGFjdGl2ZUNvbG9yOiBERUZBVUxUX0NPTE9SU1swXSxcbiAgICBicnVzaFNpemU6IFRPT0xfUFJFU0VUUy5wZW4ud2lkdGgsXG4gICAgb3BhY2l0eTogVE9PTF9QUkVTRVRTLnBlbi5vcGFjaXR5LFxuICAgIGFjdGl2ZUxheWVySWQ6IGxheWVySWRcbiAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZURlZmF1bHRCb2FyZCgpOiBFbWJlZGRlZFdoaXRlYm9hcmREYXRhIHtcbiAgY29uc3QgbGF5ZXIgPSBjcmVhdGVMYXllcigpO1xuICByZXR1cm4ge1xuICAgIGlkOiBjcmVhdGVJZChcImJvYXJkXCIpLFxuICAgIGxheWVyczogW2xheWVyXSxcbiAgICBpdGVtczogW10sXG4gICAgdmlld3BvcnQ6IHtcbiAgICAgIHg6IDAsXG4gICAgICB5OiAwLFxuICAgICAgem9vbTogMVxuICAgIH0sXG4gICAgdWk6IGNyZWF0ZURlZmF1bHRVaVN0YXRlKGxheWVyLmlkKVxuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcGFyc2VCb2FyZChyYXc6IHN0cmluZyk6IEVtYmVkZGVkV2hpdGVib2FyZERhdGEge1xuICBjb25zdCBwYXJzZWQgPSBKU09OLnBhcnNlKHJhdykgYXMgUGFydGlhbDxFbWJlZGRlZFdoaXRlYm9hcmREYXRhPiAmIHtcbiAgICBub2Rlcz86IEFycmF5PFJlY29yZDxzdHJpbmcsIHVua25vd24+PjtcbiAgfTtcblxuICBpZiAoQXJyYXkuaXNBcnJheShwYXJzZWQubm9kZXMpKSB7XG4gICAgcmV0dXJuIG1pZ3JhdGVOb2RlQm9hcmQocGFyc2VkLm5vZGVzLCBwYXJzZWQudmlld3BvcnQsIHBhcnNlZC5pZCk7XG4gIH1cblxuICBjb25zdCBsYXllcnMgPSBBcnJheS5pc0FycmF5KHBhcnNlZC5sYXllcnMpXG4gICAgPyBwYXJzZWQubGF5ZXJzXG4gICAgICAgIC5maWx0ZXIoKGxheWVyKTogbGF5ZXIgaXMgV2hpdGVib2FyZExheWVyID0+IEJvb2xlYW4obGF5ZXIgJiYgdHlwZW9mIGxheWVyLmlkID09PSBcInN0cmluZ1wiKSlcbiAgICAgICAgLm1hcCgobGF5ZXIsIGluZGV4KSA9PiAoe1xuICAgICAgICAgIGlkOiBsYXllci5pZCxcbiAgICAgICAgICBuYW1lOiB0eXBlb2YgbGF5ZXIubmFtZSA9PT0gXCJzdHJpbmdcIiA/IGxheWVyLm5hbWUgOiBgTGF5ZXIgJHtpbmRleCArIDF9YCxcbiAgICAgICAgICB2aXNpYmxlOiBsYXllci52aXNpYmxlICE9PSBmYWxzZSxcbiAgICAgICAgICBsb2NrZWQ6IGxheWVyLmxvY2tlZCA9PT0gdHJ1ZVxuICAgICAgICB9KSlcbiAgICA6IFtdO1xuXG4gIGNvbnN0IHNhZmVMYXllcnMgPSBsYXllcnMubGVuZ3RoID4gMCA/IGxheWVycyA6IFtjcmVhdGVMYXllcigpXTtcbiAgY29uc3QgbGF5ZXJJZHMgPSBuZXcgU2V0KHNhZmVMYXllcnMubWFwKChsYXllcikgPT4gbGF5ZXIuaWQpKTtcblxuICBjb25zdCBpdGVtcyA9IEFycmF5LmlzQXJyYXkocGFyc2VkLml0ZW1zKVxuICAgID8gcGFyc2VkLml0ZW1zXG4gICAgICAgIC5maWx0ZXIoKGl0ZW0pOiBpdGVtIGlzIFdoaXRlYm9hcmRJdGVtID0+IEJvb2xlYW4oaXRlbSAmJiB0eXBlb2YgaXRlbS5pZCA9PT0gXCJzdHJpbmdcIiAmJiB0eXBlb2YgaXRlbS50eXBlID09PSBcInN0cmluZ1wiKSlcbiAgICAgICAgLm1hcCgoaXRlbSkgPT4gbm9ybWFsaXplSXRlbShpdGVtLCBzYWZlTGF5ZXJzWzBdLmlkKSlcbiAgICAgICAgLmZpbHRlcigoaXRlbSk6IGl0ZW0gaXMgV2hpdGVib2FyZEl0ZW0gPT4gQm9vbGVhbihpdGVtICYmIGxheWVySWRzLmhhcyhpdGVtLmxheWVySWQpKSlcbiAgICA6IFtdO1xuXG4gIGNvbnN0IGRlZmF1bHRVaSA9IGNyZWF0ZURlZmF1bHRVaVN0YXRlKHNhZmVMYXllcnNbMF0uaWQpO1xuXG4gIHJldHVybiB7XG4gICAgaWQ6IHR5cGVvZiBwYXJzZWQuaWQgPT09IFwic3RyaW5nXCIgPyBwYXJzZWQuaWQgOiBjcmVhdGVJZChcImJvYXJkXCIpLFxuICAgIGxheWVyczogc2FmZUxheWVycyxcbiAgICBpdGVtcyxcbiAgICB2aWV3cG9ydDoge1xuICAgICAgeDogdHlwZW9mIHBhcnNlZC52aWV3cG9ydD8ueCA9PT0gXCJudW1iZXJcIiA/IHBhcnNlZC52aWV3cG9ydC54IDogMCxcbiAgICAgIHk6IHR5cGVvZiBwYXJzZWQudmlld3BvcnQ/LnkgPT09IFwibnVtYmVyXCIgPyBwYXJzZWQudmlld3BvcnQueSA6IDAsXG4gICAgICB6b29tOiB0eXBlb2YgcGFyc2VkLnZpZXdwb3J0Py56b29tID09PSBcIm51bWJlclwiID8gcGFyc2VkLnZpZXdwb3J0Lnpvb20gOiAxXG4gICAgfSxcbiAgICB1aToge1xuICAgICAgYWN0aXZlVG9vbDogaXNXaGl0ZWJvYXJkVG9vbChwYXJzZWQudWk/LmFjdGl2ZVRvb2wpID8gcGFyc2VkLnVpLmFjdGl2ZVRvb2wgOiBkZWZhdWx0VWkuYWN0aXZlVG9vbCxcbiAgICAgIGFjdGl2ZUNvbG9yOiB0eXBlb2YgcGFyc2VkLnVpPy5hY3RpdmVDb2xvciA9PT0gXCJzdHJpbmdcIiA/IHBhcnNlZC51aS5hY3RpdmVDb2xvciA6IGRlZmF1bHRVaS5hY3RpdmVDb2xvcixcbiAgICAgIGJydXNoU2l6ZTogdHlwZW9mIHBhcnNlZC51aT8uYnJ1c2hTaXplID09PSBcIm51bWJlclwiID8gcGFyc2VkLnVpLmJydXNoU2l6ZSA6IGRlZmF1bHRVaS5icnVzaFNpemUsXG4gICAgICBvcGFjaXR5OiB0eXBlb2YgcGFyc2VkLnVpPy5vcGFjaXR5ID09PSBcIm51bWJlclwiID8gcGFyc2VkLnVpLm9wYWNpdHkgOiBkZWZhdWx0VWkub3BhY2l0eSxcbiAgICAgIGFjdGl2ZUxheWVySWQ6XG4gICAgICAgIHR5cGVvZiBwYXJzZWQudWk/LmFjdGl2ZUxheWVySWQgPT09IFwic3RyaW5nXCIgJiYgbGF5ZXJJZHMuaGFzKHBhcnNlZC51aS5hY3RpdmVMYXllcklkKVxuICAgICAgICAgID8gcGFyc2VkLnVpLmFjdGl2ZUxheWVySWRcbiAgICAgICAgICA6IGRlZmF1bHRVaS5hY3RpdmVMYXllcklkXG4gICAgfVxuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc2VyaWFsaXplQm9hcmQoYm9hcmQ6IEVtYmVkZGVkV2hpdGVib2FyZERhdGEpOiBzdHJpbmcge1xuICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoYm9hcmQsIG51bGwsIDIpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gd3JhcEJvYXJkKGJvYXJkOiBFbWJlZGRlZFdoaXRlYm9hcmREYXRhKTogc3RyaW5nIHtcbiAgcmV0dXJuIGBcXGBcXGBcXGAke1dISVRFQk9BUkRfRkVOQ0V9XFxuJHtzZXJpYWxpemVCb2FyZChib2FyZCl9XFxuXFxgXFxgXFxgYDtcbn1cblxuZnVuY3Rpb24gaXNXaGl0ZWJvYXJkVG9vbCh2YWx1ZTogdW5rbm93bik6IHZhbHVlIGlzIFdoaXRlYm9hcmRUb29sIHtcbiAgcmV0dXJuIHZhbHVlID09PSBcInBlblwiIHx8IHZhbHVlID09PSBcInBlbmNpbFwiIHx8IHZhbHVlID09PSBcIm1hcmtlclwiIHx8IHZhbHVlID09PSBcImVyYXNlclwiIHx8IHZhbHVlID09PSBcInRleHRcIiB8fCB2YWx1ZSA9PT0gXCJzZWxlY3RcIiB8fCB2YWx1ZSA9PT0gXCJoYW5kXCI7XG59XG5cbmZ1bmN0aW9uIG5vcm1hbGl6ZUl0ZW0oaXRlbTogV2hpdGVib2FyZEl0ZW0sIGZhbGxiYWNrTGF5ZXJJZDogc3RyaW5nKTogV2hpdGVib2FyZEl0ZW0gfCBudWxsIHtcbiAgaWYgKGl0ZW0udHlwZSA9PT0gXCJzdHJva2VcIikge1xuICAgIGNvbnN0IHN0cm9rZSA9IGl0ZW0gYXMgUGFydGlhbDxTdHJva2VJdGVtPjtcbiAgICByZXR1cm4ge1xuICAgICAgaWQ6IHN0cm9rZS5pZCA/PyBjcmVhdGVJZChcInN0cm9rZVwiKSxcbiAgICAgIHR5cGU6IFwic3Ryb2tlXCIsXG4gICAgICBsYXllcklkOiB0eXBlb2Ygc3Ryb2tlLmxheWVySWQgPT09IFwic3RyaW5nXCIgPyBzdHJva2UubGF5ZXJJZCA6IGZhbGxiYWNrTGF5ZXJJZCxcbiAgICAgIHRvb2w6IHN0cm9rZS50b29sID09PSBcInBlbmNpbFwiIHx8IHN0cm9rZS50b29sID09PSBcIm1hcmtlclwiID8gc3Ryb2tlLnRvb2wgOiBcInBlblwiLFxuICAgICAgY29sb3I6IHR5cGVvZiBzdHJva2UuY29sb3IgPT09IFwic3RyaW5nXCIgPyBzdHJva2UuY29sb3IgOiBERUZBVUxUX0NPTE9SU1swXSxcbiAgICAgIHdpZHRoOiB0eXBlb2Ygc3Ryb2tlLndpZHRoID09PSBcIm51bWJlclwiID8gc3Ryb2tlLndpZHRoIDogVE9PTF9QUkVTRVRTLnBlbi53aWR0aCxcbiAgICAgIG9wYWNpdHk6IHR5cGVvZiBzdHJva2Uub3BhY2l0eSA9PT0gXCJudW1iZXJcIiA/IHN0cm9rZS5vcGFjaXR5IDogVE9PTF9QUkVTRVRTLnBlbi5vcGFjaXR5LFxuICAgICAgcG9pbnRzOiBBcnJheS5pc0FycmF5KHN0cm9rZS5wb2ludHMpXG4gICAgICAgID8gc3Ryb2tlLnBvaW50c1xuICAgICAgICAgICAgLmZpbHRlcigocG9pbnQpOiBwb2ludCBpcyB7IHg6IG51bWJlcjsgeTogbnVtYmVyOyBwcmVzc3VyZT86IG51bWJlciB9ID0+IEJvb2xlYW4ocG9pbnQgJiYgdHlwZW9mIHBvaW50LnggPT09IFwibnVtYmVyXCIgJiYgdHlwZW9mIHBvaW50LnkgPT09IFwibnVtYmVyXCIpKVxuICAgICAgICAgICAgLm1hcCgocG9pbnQpID0+ICh7XG4gICAgICAgICAgICAgIHg6IHBvaW50LngsXG4gICAgICAgICAgICAgIHk6IHBvaW50LnksXG4gICAgICAgICAgICAgIHByZXNzdXJlOiB0eXBlb2YgcG9pbnQucHJlc3N1cmUgPT09IFwibnVtYmVyXCIgPyBwb2ludC5wcmVzc3VyZSA6IDAuNVxuICAgICAgICAgICAgfSkpXG4gICAgICAgIDogW11cbiAgICB9O1xuICB9XG5cbiAgaWYgKGl0ZW0udHlwZSA9PT0gXCJ0ZXh0XCIpIHtcbiAgICBjb25zdCB0ZXh0ID0gaXRlbSBhcyBQYXJ0aWFsPFRleHRJdGVtPjtcbiAgICByZXR1cm4ge1xuICAgICAgaWQ6IHRleHQuaWQgPz8gY3JlYXRlSWQoXCJ0ZXh0XCIpLFxuICAgICAgdHlwZTogXCJ0ZXh0XCIsXG4gICAgICBsYXllcklkOiB0eXBlb2YgdGV4dC5sYXllcklkID09PSBcInN0cmluZ1wiID8gdGV4dC5sYXllcklkIDogZmFsbGJhY2tMYXllcklkLFxuICAgICAgeDogdHlwZW9mIHRleHQueCA9PT0gXCJudW1iZXJcIiA/IHRleHQueCA6IDAsXG4gICAgICB5OiB0eXBlb2YgdGV4dC55ID09PSBcIm51bWJlclwiID8gdGV4dC55IDogMCxcbiAgICAgIHRleHQ6IHR5cGVvZiB0ZXh0LnRleHQgPT09IFwic3RyaW5nXCIgPyB0ZXh0LnRleHQgOiBcIlwiLFxuICAgICAgY29sb3I6IHR5cGVvZiB0ZXh0LmNvbG9yID09PSBcInN0cmluZ1wiID8gdGV4dC5jb2xvciA6IERFRkFVTFRfQ09MT1JTWzBdLFxuICAgICAgc2l6ZTogdHlwZW9mIHRleHQuc2l6ZSA9PT0gXCJudW1iZXJcIiA/IHRleHQuc2l6ZSA6IDIwXG4gICAgfTtcbiAgfVxuXG4gIHJldHVybiBudWxsO1xufVxuXG5mdW5jdGlvbiBtaWdyYXRlTm9kZUJvYXJkKFxuICBub2RlczogQXJyYXk8UmVjb3JkPHN0cmluZywgdW5rbm93bj4+LFxuICB2aWV3cG9ydDogUGFydGlhbDxFbWJlZGRlZFdoaXRlYm9hcmREYXRhW1widmlld3BvcnRcIl0+IHwgdW5kZWZpbmVkLFxuICBib2FyZElkOiBzdHJpbmcgfCB1bmRlZmluZWRcbik6IEVtYmVkZGVkV2hpdGVib2FyZERhdGEge1xuICBjb25zdCBsYXllciA9IGNyZWF0ZUxheWVyKCk7XG4gIGNvbnN0IGl0ZW1zOiBUZXh0SXRlbVtdID0gbm9kZXNcbiAgICAuZmlsdGVyKChub2RlKSA9PiB0eXBlb2Ygbm9kZS5pZCA9PT0gXCJzdHJpbmdcIilcbiAgICAubWFwKChub2RlKSA9PiAoe1xuICAgICAgaWQ6IFN0cmluZyhub2RlLmlkKSxcbiAgICAgIHR5cGU6IFwidGV4dFwiLFxuICAgICAgbGF5ZXJJZDogbGF5ZXIuaWQsXG4gICAgICB4OiB0eXBlb2Ygbm9kZS54ID09PSBcIm51bWJlclwiID8gbm9kZS54IDogMCxcbiAgICAgIHk6IHR5cGVvZiBub2RlLnkgPT09IFwibnVtYmVyXCIgPyBub2RlLnkgOiAwLFxuICAgICAgdGV4dDogdHlwZW9mIG5vZGUudGV4dCA9PT0gXCJzdHJpbmdcIiA/IG5vZGUudGV4dCA6IFwiXCIsXG4gICAgICBjb2xvcjogdHlwZW9mIG5vZGUuY29sb3IgPT09IFwic3RyaW5nXCIgPyBub2RlLmNvbG9yIDogREVGQVVMVF9DT0xPUlNbMF0sXG4gICAgICBzaXplOiAxOFxuICAgIH0pKTtcblxuICByZXR1cm4ge1xuICAgIGlkOiB0eXBlb2YgYm9hcmRJZCA9PT0gXCJzdHJpbmdcIiA/IGJvYXJkSWQgOiBjcmVhdGVJZChcImJvYXJkXCIpLFxuICAgIGxheWVyczogW2xheWVyXSxcbiAgICBpdGVtcyxcbiAgICB2aWV3cG9ydDoge1xuICAgICAgeDogdHlwZW9mIHZpZXdwb3J0Py54ID09PSBcIm51bWJlclwiID8gdmlld3BvcnQueCA6IDAsXG4gICAgICB5OiB0eXBlb2Ygdmlld3BvcnQ/LnkgPT09IFwibnVtYmVyXCIgPyB2aWV3cG9ydC55IDogMCxcbiAgICAgIHpvb206IHR5cGVvZiB2aWV3cG9ydD8uem9vbSA9PT0gXCJudW1iZXJcIiA/IHZpZXdwb3J0Lnpvb20gOiAxXG4gICAgfSxcbiAgICB1aTogY3JlYXRlRGVmYXVsdFVpU3RhdGUobGF5ZXIuaWQpXG4gIH07XG59XHJcblxyXG4iLCAiaW1wb3J0IHsgTm90aWNlIH0gZnJvbSBcIm9ic2lkaWFuXCI7XG5pbXBvcnQge1xuICBjcmVhdGVEZWZhdWx0Qm9hcmQsXG4gIGNyZWF0ZUlkLFxuICBERUZBVUxUX0JPQVJEX0hFSUdIVCxcbiAgREVGQVVMVF9DT0xPUlMsXG4gIFRPT0xfUFJFU0VUU1xufSBmcm9tIFwiLi9zdGF0ZVwiO1xuaW1wb3J0IHtcbiAgRHJhd2luZ1Rvb2wsXG4gIEVtYmVkZGVkV2hpdGVib2FyZERhdGEsXG4gIFN0cm9rZUl0ZW0sXG4gIFN0cm9rZVBvaW50LFxuICBUZXh0SXRlbSxcbiAgV2hpdGVib2FyZEl0ZW0sXG4gIFdoaXRlYm9hcmRMYXllcixcbiAgV2hpdGVib2FyZFRvb2xcbn0gZnJvbSBcIi4vdHlwZXNcIjtcblxuaW50ZXJmYWNlIFdoaXRlYm9hcmRIb3N0IHtcbiAgc291cmNlUGF0aDogc3RyaW5nO1xuICBzYXZlKGJvYXJkOiBFbWJlZGRlZFdoaXRlYm9hcmREYXRhKTogUHJvbWlzZTx2b2lkPjtcbn1cblxuaW50ZXJmYWNlIFdoaXRlYm9hcmRIYW5kbGUge1xuICBkZXN0cm95KCk6IHZvaWQ7XG59XG5cbnR5cGUgUG9pbnRlck1vZGUgPVxuICB8IHsgdHlwZTogXCJpZGxlXCIgfVxuICB8IHsgdHlwZTogXCJwYW5cIjsgc3RhcnRYOiBudW1iZXI7IHN0YXJ0WTogbnVtYmVyOyBvcmlnaW5YOiBudW1iZXI7IG9yaWdpblk6IG51bWJlciB9XG4gIHwgeyB0eXBlOiBcImRyYXdcIjsgcG9pbnRlcklkOiBudW1iZXIgfVxuICB8IHtcbiAgICAgIHR5cGU6IFwibW92ZVwiO1xuICAgICAgcG9pbnRlcklkOiBudW1iZXI7XG4gICAgICBpdGVtSWQ6IHN0cmluZztcbiAgICAgIHN0YXJ0WDogbnVtYmVyO1xuICAgICAgc3RhcnRZOiBudW1iZXI7XG4gICAgICBvcmlnaW5UZXh0PzogeyB4OiBudW1iZXI7IHk6IG51bWJlciB9O1xuICAgICAgb3JpZ2luUG9pbnRzPzogU3Ryb2tlUG9pbnRbXTtcbiAgICB9XG4gIHwgeyB0eXBlOiBcImVyYXNlXCI7IHBvaW50ZXJJZDogbnVtYmVyOyByZW1vdmVkOiBib29sZWFuIH07XG5cbmNvbnN0IFRPT0xfTEFCRUxTOiBSZWNvcmQ8V2hpdGVib2FyZFRvb2wsIHN0cmluZz4gPSB7XG4gIHBlbjogXCJQZW5cIixcbiAgcGVuY2lsOiBcIlBlbmNpbFwiLFxuICBtYXJrZXI6IFwiTWFya2VyXCIsXG4gIGVyYXNlcjogXCJFcmFzZXJcIixcbiAgdGV4dDogXCJUZXh0XCIsXG4gIHNlbGVjdDogXCJTZWxlY3RcIixcbiAgaGFuZDogXCJIYW5kXCJcbn07XG5cbmV4cG9ydCBmdW5jdGlvbiBtb3VudFdoaXRlYm9hcmQoXG4gIGNvbnRhaW5lcjogSFRNTEVsZW1lbnQsXG4gIGluaXRpYWxCb2FyZDogRW1iZWRkZWRXaGl0ZWJvYXJkRGF0YSxcbiAgaG9zdDogV2hpdGVib2FyZEhvc3Rcbik6IFdoaXRlYm9hcmRIYW5kbGUge1xuICBjb250YWluZXIuZW1wdHkoKTtcbiAgY29udGFpbmVyLmFkZENsYXNzKFwiZW1iZWRkZWQtd2hpdGVib2FyZFwiKTtcblxuICBjb25zdCByb290ID0gY29udGFpbmVyLmNyZWF0ZURpdih7IGNsczogXCJlbWJlZGRlZC13aGl0ZWJvYXJkX19zaGVsbFwiIH0pO1xuICBjb25zdCB0b29sYmFyID0gcm9vdC5jcmVhdGVEaXYoeyBjbHM6IFwiZW1iZWRkZWQtd2hpdGVib2FyZF9fdG9vbGJhclwiIH0pO1xuICBjb25zdCB3b3Jrc3BhY2UgPSByb290LmNyZWF0ZURpdih7IGNsczogXCJlbWJlZGRlZC13aGl0ZWJvYXJkX193b3Jrc3BhY2VcIiB9KTtcbiAgY29uc3Qgdmlld3BvcnQgPSB3b3Jrc3BhY2UuY3JlYXRlRGl2KHsgY2xzOiBcImVtYmVkZGVkLXdoaXRlYm9hcmRfX3ZpZXdwb3J0XCIgfSk7XG4gIGNvbnN0IGdyaWQgPSB2aWV3cG9ydC5jcmVhdGVEaXYoeyBjbHM6IFwiZW1iZWRkZWQtd2hpdGVib2FyZF9fZ3JpZFwiIH0pO1xuICBjb25zdCBzY2VuZSA9IHZpZXdwb3J0LmNyZWF0ZVN2ZyhcInN2Z1wiLCB7IGNsczogXCJlbWJlZGRlZC13aGl0ZWJvYXJkX19zY2VuZVwiIH0pO1xuICBzY2VuZS5zZXRBdHRyaWJ1dGUoXCJ3aWR0aFwiLCBcIjEwMCVcIik7XG4gIHNjZW5lLnNldEF0dHJpYnV0ZShcImhlaWdodFwiLCBcIjEwMCVcIik7XG4gIGNvbnN0IHN0cm9rZUxheWVyID0gc2NlbmUuY3JlYXRlU3ZnKFwiZ1wiLCB7IGNsczogXCJlbWJlZGRlZC13aGl0ZWJvYXJkX19zdHJva2UtbGF5ZXJcIiB9KTtcbiAgY29uc3QgZHJhZnRMYXllciA9IHNjZW5lLmNyZWF0ZVN2ZyhcImdcIiwgeyBjbHM6IFwiZW1iZWRkZWQtd2hpdGVib2FyZF9fZHJhZnQtbGF5ZXJcIiB9KTtcbiAgY29uc3QgZHJhZnRQYXRoID0gZHJhZnRMYXllci5jcmVhdGVTdmcoXCJwYXRoXCIsIHsgY2xzOiBcImVtYmVkZGVkLXdoaXRlYm9hcmRfX2RyYWZ0LXBhdGhcIiB9KTtcbiAgY29uc3QgdGV4dFdvcmxkID0gdmlld3BvcnQuY3JlYXRlRGl2KHsgY2xzOiBcImVtYmVkZGVkLXdoaXRlYm9hcmRfX3RleHQtd29ybGRcIiB9KTtcbiAgY29uc3Qgc2lkZWJhciA9IHdvcmtzcGFjZS5jcmVhdGVEaXYoeyBjbHM6IFwiZW1iZWRkZWQtd2hpdGVib2FyZF9fc2lkZWJhclwiIH0pO1xuICBjb25zdCBsYXllckhlYWRlciA9IHNpZGViYXIuY3JlYXRlRGl2KHsgY2xzOiBcImVtYmVkZGVkLXdoaXRlYm9hcmRfX3NpZGViYXItaGVhZGVyXCIgfSk7XG4gIGxheWVySGVhZGVyLmNyZWF0ZVNwYW4oeyB0ZXh0OiBcIkxheWVyc1wiIH0pO1xuICBjb25zdCBhZGRMYXllckJ1dHRvbiA9IGxheWVySGVhZGVyLmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHtcbiAgICBjbHM6IFwiZW1iZWRkZWQtd2hpdGVib2FyZF9fbWluaS1idXR0b25cIixcbiAgICB0ZXh0OiBcIisgTGF5ZXJcIlxuICB9KTtcbiAgYWRkTGF5ZXJCdXR0b24udHlwZSA9IFwiYnV0dG9uXCI7XG4gIGNvbnN0IGxheWVyc0xpc3QgPSBzaWRlYmFyLmNyZWF0ZURpdih7IGNsczogXCJlbWJlZGRlZC13aGl0ZWJvYXJkX19sYXllcnNcIiB9KTtcbiAgY29uc3Qgc3RhdHVzID0gdG9vbGJhci5jcmVhdGVEaXYoeyBjbHM6IFwiZW1iZWRkZWQtd2hpdGVib2FyZF9fc3RhdHVzXCIsIHRleHQ6IFwiUmVhZHlcIiB9KTtcblxuICBsZXQgYm9hcmQgPSBzdHJ1Y3R1cmVkQ2xvbmUoaW5pdGlhbEJvYXJkKTtcbiAgaWYgKGJvYXJkLmxheWVycy5sZW5ndGggPT09IDApIHtcbiAgICBib2FyZCA9IGNyZWF0ZURlZmF1bHRCb2FyZCgpO1xuICB9XG5cbiAgbGV0IGFjdGl2ZVRvb2w6IFdoaXRlYm9hcmRUb29sID0gYm9hcmQudWkuYWN0aXZlVG9vbDtcclxuICBsZXQgYWN0aXZlQ29sb3IgPSBib2FyZC51aS5hY3RpdmVDb2xvcjtcclxuICBsZXQgYnJ1c2hTaXplID0gYm9hcmQudWkuYnJ1c2hTaXplO1xyXG4gIGxldCBvcGFjaXR5ID0gYm9hcmQudWkub3BhY2l0eTtcclxuICBsZXQgYWN0aXZlTGF5ZXJJZCA9IGJvYXJkLnVpLmFjdGl2ZUxheWVySWQgPz8gYm9hcmQubGF5ZXJzWzBdLmlkO1xuICBsZXQgc2VsZWN0ZWRJdGVtSWQ6IHN0cmluZyB8IG51bGwgPSBudWxsO1xuICBsZXQgcG9pbnRlck1vZGU6IFBvaW50ZXJNb2RlID0geyB0eXBlOiBcImlkbGVcIiB9O1xuICBsZXQgZHJhZnRTdHJva2U6IFN0cm9rZUl0ZW0gfCBudWxsID0gbnVsbDtcbiAgbGV0IHNhdmVUaW1lcjogbnVtYmVyIHwgbnVsbCA9IG51bGw7XG4gIGxldCBkZXN0cm95ZWQgPSBmYWxzZTtcbiAgbGV0IGFjdGl2ZVRleHRFZGl0b3I6IEhUTUxUZXh0QXJlYUVsZW1lbnQgfCBudWxsID0gbnVsbDtcbiAgbGV0IGhpc3RvcnkgPSBbc3RydWN0dXJlZENsb25lKGJvYXJkKV07XG4gIGxldCBoaXN0b3J5SW5kZXggPSAwO1xuXG4gIGNvbnN0IHRvb2xCdXR0b25zID0gbmV3IE1hcDxXaGl0ZWJvYXJkVG9vbCwgSFRNTEJ1dHRvbkVsZW1lbnQ+KCk7XG4gIGNvbnN0IHVuZG9CdXR0b24gPSB0b29sYmFyLmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHsgY2xzOiBcImVtYmVkZGVkLXdoaXRlYm9hcmRfX2J1dHRvblwiLCB0ZXh0OiBcIlVuZG9cIiB9KTtcbiAgdW5kb0J1dHRvbi50eXBlID0gXCJidXR0b25cIjtcbiAgY29uc3QgcmVkb0J1dHRvbiA9IHRvb2xiYXIuY3JlYXRlRWwoXCJidXR0b25cIiwgeyBjbHM6IFwiZW1iZWRkZWQtd2hpdGVib2FyZF9fYnV0dG9uXCIsIHRleHQ6IFwiUmVkb1wiIH0pO1xuICByZWRvQnV0dG9uLnR5cGUgPSBcImJ1dHRvblwiO1xuXG4gIGNvbnN0IHRvb2xPcmRlcjogV2hpdGVib2FyZFRvb2xbXSA9IFtcInBlblwiLCBcInBlbmNpbFwiLCBcIm1hcmtlclwiLCBcImVyYXNlclwiLCBcInRleHRcIiwgXCJzZWxlY3RcIiwgXCJoYW5kXCJdO1xuICBmb3IgKGNvbnN0IHRvb2wgb2YgdG9vbE9yZGVyKSB7XG4gICAgY29uc3QgYnV0dG9uID0gdG9vbGJhci5jcmVhdGVFbChcImJ1dHRvblwiLCB7XG4gICAgICBjbHM6IFwiZW1iZWRkZWQtd2hpdGVib2FyZF9fYnV0dG9uIGVtYmVkZGVkLXdoaXRlYm9hcmRfX3Rvb2wtYnV0dG9uXCIsXG4gICAgICB0ZXh0OiBUT09MX0xBQkVMU1t0b29sXVxuICAgIH0pO1xuICAgIGJ1dHRvbi50eXBlID0gXCJidXR0b25cIjtcbiAgICBidXR0b24uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IHNldEFjdGl2ZVRvb2wodG9vbCkpO1xuICAgIHRvb2xCdXR0b25zLnNldCh0b29sLCBidXR0b24pO1xuICB9XG5cbiAgY29uc3QgY29sb3JJbnB1dCA9IHRvb2xiYXIuY3JlYXRlRWwoXCJpbnB1dFwiLCB7IGNsczogXCJlbWJlZGRlZC13aGl0ZWJvYXJkX19jb2xvci1pbnB1dFwiIH0pO1xuICBjb2xvcklucHV0LnR5cGUgPSBcImNvbG9yXCI7XG4gIGNvbG9ySW5wdXQudmFsdWUgPSBhY3RpdmVDb2xvcjtcblxuICBjb25zdCBzd2F0Y2hlcyA9IHRvb2xiYXIuY3JlYXRlRGl2KHsgY2xzOiBcImVtYmVkZGVkLXdoaXRlYm9hcmRfX3N3YXRjaGVzXCIgfSk7XG4gIGZvciAoY29uc3QgY29sb3Igb2YgREVGQVVMVF9DT0xPUlMpIHtcbiAgICBjb25zdCBzd2F0Y2ggPSBzd2F0Y2hlcy5jcmVhdGVFbChcImJ1dHRvblwiLCB7IGNsczogXCJlbWJlZGRlZC13aGl0ZWJvYXJkX19zd2F0Y2hcIiB9KTtcbiAgICBzd2F0Y2gudHlwZSA9IFwiYnV0dG9uXCI7XG4gICAgc3dhdGNoLnN0eWxlLmJhY2tncm91bmRDb2xvciA9IGNvbG9yO1xuICAgIHN3YXRjaC5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKCkgPT4ge1xuICAgICAgYWN0aXZlQ29sb3IgPSBjb2xvcjtcclxuICAgICAgY29sb3JJbnB1dC52YWx1ZSA9IGNvbG9yO1xyXG4gICAgICBzeW5jVWlTdGF0ZSgpO1xyXG4gICAgICB1cGRhdGVUb29sYmFyKCk7XG4gICAgfSk7XG4gIH1cblxuICBjb25zdCBzaXplSW5wdXQgPSB0b29sYmFyLmNyZWF0ZUVsKFwiaW5wdXRcIiwgeyBjbHM6IFwiZW1iZWRkZWQtd2hpdGVib2FyZF9fcmFuZ2VcIiB9KTtcbiAgc2l6ZUlucHV0LnR5cGUgPSBcInJhbmdlXCI7XG4gIHNpemVJbnB1dC5taW4gPSBcIjFcIjtcbiAgc2l6ZUlucHV0Lm1heCA9IFwiMzZcIjtcbiAgc2l6ZUlucHV0LnZhbHVlID0gU3RyaW5nKGJydXNoU2l6ZSk7XG5cbiAgY29uc3Qgb3BhY2l0eUlucHV0ID0gdG9vbGJhci5jcmVhdGVFbChcImlucHV0XCIsIHsgY2xzOiBcImVtYmVkZGVkLXdoaXRlYm9hcmRfX3JhbmdlXCIgfSk7XG4gIG9wYWNpdHlJbnB1dC50eXBlID0gXCJyYW5nZVwiO1xuICBvcGFjaXR5SW5wdXQubWluID0gXCIwLjFcIjtcbiAgb3BhY2l0eUlucHV0Lm1heCA9IFwiMVwiO1xuICBvcGFjaXR5SW5wdXQuc3RlcCA9IFwiMC4wNVwiO1xuICBvcGFjaXR5SW5wdXQudmFsdWUgPSBTdHJpbmcob3BhY2l0eSk7XG5cbiAgdG9vbGJhci5hcHBlbmRDaGlsZChzdGF0dXMpO1xuICB2aWV3cG9ydC5zdHlsZS5taW5IZWlnaHQgPSBgJHtERUZBVUxUX0JPQVJEX0hFSUdIVH1weGA7XG5cbiAgdW5kb0J1dHRvbi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKCkgPT4gdW5kbygpKTtcbiAgcmVkb0J1dHRvbi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKCkgPT4gcmVkbygpKTtcbiAgYWRkTGF5ZXJCdXR0b24uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IGFkZExheWVyKCkpO1xuICBjb2xvcklucHV0LmFkZEV2ZW50TGlzdGVuZXIoXCJpbnB1dFwiLCAoKSA9PiB7XHJcbiAgICBhY3RpdmVDb2xvciA9IGNvbG9ySW5wdXQudmFsdWU7XHJcbiAgICBzeW5jVWlTdGF0ZSgpO1xyXG4gIH0pO1xuICBzaXplSW5wdXQuYWRkRXZlbnRMaXN0ZW5lcihcImlucHV0XCIsICgpID0+IHtcclxuICAgIGJydXNoU2l6ZSA9IE51bWJlcihzaXplSW5wdXQudmFsdWUpO1xyXG4gICAgc3luY1VpU3RhdGUoKTtcclxuICB9KTtcbiAgb3BhY2l0eUlucHV0LmFkZEV2ZW50TGlzdGVuZXIoXCJpbnB1dFwiLCAoKSA9PiB7XHJcbiAgICBvcGFjaXR5ID0gTnVtYmVyKG9wYWNpdHlJbnB1dC52YWx1ZSk7XHJcbiAgICBzeW5jVWlTdGF0ZSgpO1xyXG4gIH0pO1xuXG4gIGZ1bmN0aW9uIHN5bmNVaVN0YXRlKCk6IHZvaWQge1xyXG4gICAgYm9hcmQudWkuYWN0aXZlVG9vbCA9IGFjdGl2ZVRvb2w7XHJcbiAgICBib2FyZC51aS5hY3RpdmVDb2xvciA9IGFjdGl2ZUNvbG9yO1xyXG4gICAgYm9hcmQudWkuYnJ1c2hTaXplID0gYnJ1c2hTaXplO1xyXG4gICAgYm9hcmQudWkub3BhY2l0eSA9IG9wYWNpdHk7XHJcbiAgICBib2FyZC51aS5hY3RpdmVMYXllcklkID0gYWN0aXZlTGF5ZXJJZDtcclxuICB9XHJcblxyXG4gIGZ1bmN0aW9uIHNldEFjdGl2ZVRvb2wodG9vbDogV2hpdGVib2FyZFRvb2wpOiB2b2lkIHtcbiAgICBhY3RpdmVUb29sID0gdG9vbDtcbiAgICBpZiAodG9vbCA9PT0gXCJwZW5cIiB8fCB0b29sID09PSBcInBlbmNpbFwiIHx8IHRvb2wgPT09IFwibWFya2VyXCIpIHtcbiAgICAgIGJydXNoU2l6ZSA9IFRPT0xfUFJFU0VUU1t0b29sXS53aWR0aDtcbiAgICAgIG9wYWNpdHkgPSBUT09MX1BSRVNFVFNbdG9vbF0ub3BhY2l0eTtcbiAgICAgIHNpemVJbnB1dC52YWx1ZSA9IFN0cmluZyhicnVzaFNpemUpO1xuICAgICAgb3BhY2l0eUlucHV0LnZhbHVlID0gU3RyaW5nKG9wYWNpdHkpO1xuICAgIH1cbiAgICBzeW5jVWlTdGF0ZSgpO1xyXG4gICAgdXBkYXRlVG9vbGJhcigpO1xyXG4gICAgdXBkYXRlU3RhdHVzKGAke1RPT0xfTEFCRUxTW3Rvb2xdfSByZWFkeWApO1xuICB9XG5cbiAgZnVuY3Rpb24gdXBkYXRlVG9vbGJhcigpOiB2b2lkIHtcbiAgICBmb3IgKGNvbnN0IFt0b29sLCBidXR0b25dIG9mIHRvb2xCdXR0b25zKSB7XG4gICAgICBidXR0b24udG9nZ2xlQ2xhc3MoXCJpcy1hY3RpdmVcIiwgdG9vbCA9PT0gYWN0aXZlVG9vbCk7XG4gICAgfVxuICAgIHVuZG9CdXR0b24uZGlzYWJsZWQgPSBoaXN0b3J5SW5kZXggPT09IDA7XG4gICAgcmVkb0J1dHRvbi5kaXNhYmxlZCA9IGhpc3RvcnlJbmRleCA9PT0gaGlzdG9yeS5sZW5ndGggLSAxO1xuICB9XG5cbiAgZnVuY3Rpb24gdXBkYXRlU3RhdHVzKG1lc3NhZ2UgPSBcIlJlYWR5XCIpOiB2b2lkIHtcbiAgICBzdGF0dXMuc2V0VGV4dChtZXNzYWdlKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHF1ZXVlU2F2ZSgpOiB2b2lkIHtcbiAgICBpZiAoZGVzdHJveWVkKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKHNhdmVUaW1lciAhPT0gbnVsbCkge1xuICAgICAgd2luZG93LmNsZWFyVGltZW91dChzYXZlVGltZXIpO1xuICAgIH1cblxuICAgIHNhdmVUaW1lciA9IHdpbmRvdy5zZXRUaW1lb3V0KGFzeW5jICgpID0+IHtcbiAgICAgIHNhdmVUaW1lciA9IG51bGw7XG4gICAgICB0cnkge1xuICAgICAgICBhd2FpdCBob3N0LnNhdmUoc3RydWN0dXJlZENsb25lKGJvYXJkKSk7XG4gICAgICAgIHVwZGF0ZVN0YXR1cyhcIlNhdmVkXCIpO1xuICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgY29uc29sZS5lcnJvcihlcnJvcik7XG4gICAgICAgIG5ldyBOb3RpY2UoXCJVbmFibGUgdG8gc2F2ZSBlbWJlZGRlZCB3aGl0ZWJvYXJkXCIpO1xuICAgICAgICB1cGRhdGVTdGF0dXMoXCJTYXZlIGZhaWxlZFwiKTtcbiAgICAgIH1cbiAgICB9LCAxNjApO1xuICB9XG5cbiAgZnVuY3Rpb24gcHVzaEhpc3RvcnkoKTogdm9pZCB7XG4gICAgY29uc3Qgc25hcHNob3QgPSBzdHJ1Y3R1cmVkQ2xvbmUoYm9hcmQpO1xuICAgIGhpc3RvcnkgPSBoaXN0b3J5LnNsaWNlKDAsIGhpc3RvcnlJbmRleCArIDEpO1xuICAgIGhpc3RvcnkucHVzaChzbmFwc2hvdCk7XG4gICAgaGlzdG9yeUluZGV4ID0gaGlzdG9yeS5sZW5ndGggLSAxO1xuICAgIHVwZGF0ZVRvb2xiYXIoKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHVuZG8oKTogdm9pZCB7XG4gICAgaWYgKGhpc3RvcnlJbmRleCA9PT0gMCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBoaXN0b3J5SW5kZXggLT0gMTtcbiAgICBib2FyZCA9IHN0cnVjdHVyZWRDbG9uZShoaXN0b3J5W2hpc3RvcnlJbmRleF0pO1xuICAgIGVuc3VyZUFjdGl2ZUxheWVyKCk7XG4gICAgc2VsZWN0ZWRJdGVtSWQgPSBudWxsO1xuICAgIHJlbmRlckJvYXJkKCk7XG4gICAgcXVldWVTYXZlKCk7XG4gIH1cblxuICBmdW5jdGlvbiByZWRvKCk6IHZvaWQge1xuICAgIGlmIChoaXN0b3J5SW5kZXggPj0gaGlzdG9yeS5sZW5ndGggLSAxKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGhpc3RvcnlJbmRleCArPSAxO1xuICAgIGJvYXJkID0gc3RydWN0dXJlZENsb25lKGhpc3RvcnlbaGlzdG9yeUluZGV4XSk7XG4gICAgZW5zdXJlQWN0aXZlTGF5ZXIoKTtcbiAgICBzZWxlY3RlZEl0ZW1JZCA9IG51bGw7XG4gICAgcmVuZGVyQm9hcmQoKTtcbiAgICBxdWV1ZVNhdmUoKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGVuc3VyZUFjdGl2ZUxheWVyKCk6IHZvaWQge1xuICAgIGlmICghYm9hcmQubGF5ZXJzLnNvbWUoKGxheWVyKSA9PiBsYXllci5pZCA9PT0gYWN0aXZlTGF5ZXJJZCkpIHtcbiAgICAgIGFjdGl2ZUxheWVySWQgPSBib2FyZC5sYXllcnNbMF0/LmlkID8/IGNyZWF0ZURlZmF1bHRCb2FyZCgpLmxheWVyc1swXS5pZDtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBnZXRMYXllcihsYXllcklkOiBzdHJpbmcpOiBXaGl0ZWJvYXJkTGF5ZXIgfCB1bmRlZmluZWQge1xuICAgIHJldHVybiBib2FyZC5sYXllcnMuZmluZCgobGF5ZXIpID0+IGxheWVyLmlkID09PSBsYXllcklkKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGdldEl0ZW0oaXRlbUlkOiBzdHJpbmcpOiBXaGl0ZWJvYXJkSXRlbSB8IHVuZGVmaW5lZCB7XG4gICAgcmV0dXJuIGJvYXJkLml0ZW1zLmZpbmQoKGl0ZW0pID0+IGl0ZW0uaWQgPT09IGl0ZW1JZCk7XG4gIH1cblxuICBmdW5jdGlvbiBpc0xheWVyVmlzaWJsZShsYXllcklkOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgICByZXR1cm4gZ2V0TGF5ZXIobGF5ZXJJZCk/LnZpc2libGUgIT09IGZhbHNlO1xuICB9XG5cbiAgZnVuY3Rpb24gaXNMYXllckxvY2tlZChsYXllcklkOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgICByZXR1cm4gZ2V0TGF5ZXIobGF5ZXJJZCk/LmxvY2tlZCA9PT0gdHJ1ZTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGFwcGx5Vmlld3BvcnQoKTogdm9pZCB7XG4gICAgc2NlbmUuc3R5bGUudHJhbnNmb3JtID0gYHRyYW5zbGF0ZSgke2JvYXJkLnZpZXdwb3J0Lnh9cHgsICR7Ym9hcmQudmlld3BvcnQueX1weCkgc2NhbGUoJHtib2FyZC52aWV3cG9ydC56b29tfSlgO1xuICAgIHRleHRXb3JsZC5zdHlsZS50cmFuc2Zvcm0gPSBgdHJhbnNsYXRlKCR7Ym9hcmQudmlld3BvcnQueH1weCwgJHtib2FyZC52aWV3cG9ydC55fXB4KSBzY2FsZSgke2JvYXJkLnZpZXdwb3J0Lnpvb219KWA7XG4gICAgY29uc3QgZ3JpZFNpemUgPSA0OCAqIGJvYXJkLnZpZXdwb3J0Lnpvb207XG4gICAgZ3JpZC5zdHlsZS5iYWNrZ3JvdW5kU2l6ZSA9IGAke2dyaWRTaXplfXB4ICR7Z3JpZFNpemV9cHhgO1xuICAgIGdyaWQuc3R5bGUuYmFja2dyb3VuZFBvc2l0aW9uID0gYCR7Ym9hcmQudmlld3BvcnQueH1weCAke2JvYXJkLnZpZXdwb3J0Lnl9cHhgO1xuICB9XG5cbiAgZnVuY3Rpb24gcmVuZGVyTGF5ZXJzKCk6IHZvaWQge1xuICAgIGxheWVyc0xpc3QuZW1wdHkoKTtcblxuICAgIGZvciAoY29uc3QgbGF5ZXIgb2YgWy4uLmJvYXJkLmxheWVyc10ucmV2ZXJzZSgpKSB7XG4gICAgICBjb25zdCByb3cgPSBsYXllcnNMaXN0LmNyZWF0ZURpdih7IGNsczogXCJlbWJlZGRlZC13aGl0ZWJvYXJkX19sYXllci1yb3dcIiB9KTtcbiAgICAgIHJvdy50b2dnbGVDbGFzcyhcImlzLWFjdGl2ZVwiLCBsYXllci5pZCA9PT0gYWN0aXZlTGF5ZXJJZCk7XG5cbiAgICAgIGNvbnN0IHZpc2liaWxpdHlCdXR0b24gPSByb3cuY3JlYXRlRWwoXCJidXR0b25cIiwge1xuICAgICAgICBjbHM6IFwiZW1iZWRkZWQtd2hpdGVib2FyZF9fbGF5ZXItdmlzaWJpbGl0eVwiLFxuICAgICAgICB0ZXh0OiBsYXllci52aXNpYmxlID8gXCJIaWRlXCIgOiBcIlNob3dcIlxuICAgICAgfSk7XG4gICAgICB2aXNpYmlsaXR5QnV0dG9uLnR5cGUgPSBcImJ1dHRvblwiO1xuICAgICAgdmlzaWJpbGl0eUJ1dHRvbi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKCkgPT4ge1xuICAgICAgICBsYXllci52aXNpYmxlID0gIWxheWVyLnZpc2libGU7XG4gICAgICAgIHJlbmRlckJvYXJkKCk7XG4gICAgICAgIHB1c2hIaXN0b3J5KCk7XG4gICAgICAgIHF1ZXVlU2F2ZSgpO1xuICAgICAgfSk7XG5cbiAgICAgIGNvbnN0IGxvY2tCdXR0b24gPSByb3cuY3JlYXRlRWwoXCJidXR0b25cIiwge1xuICAgICAgICBjbHM6IFwiZW1iZWRkZWQtd2hpdGVib2FyZF9fbGF5ZXItbG9ja1wiLFxuICAgICAgICB0ZXh0OiBsYXllci5sb2NrZWQgPyBcIlVubG9ja1wiIDogXCJMb2NrXCJcbiAgICAgIH0pO1xuICAgICAgbG9ja0J1dHRvbi50eXBlID0gXCJidXR0b25cIjtcbiAgICAgIGxvY2tCdXR0b24uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IHtcbiAgICAgICAgbGF5ZXIubG9ja2VkID0gIWxheWVyLmxvY2tlZDtcbiAgICAgICAgcmVuZGVyQm9hcmQoKTtcbiAgICAgICAgcHVzaEhpc3RvcnkoKTtcbiAgICAgICAgcXVldWVTYXZlKCk7XG4gICAgICB9KTtcblxuICAgICAgY29uc3QgbmFtZUJ1dHRvbiA9IHJvdy5jcmVhdGVFbChcImJ1dHRvblwiLCB7XG4gICAgICAgIGNsczogXCJlbWJlZGRlZC13aGl0ZWJvYXJkX19sYXllci1uYW1lXCIsXG4gICAgICAgIHRleHQ6IGxheWVyLm5hbWVcbiAgICAgIH0pO1xuICAgICAgbmFtZUJ1dHRvbi50eXBlID0gXCJidXR0b25cIjtcbiAgICAgIG5hbWVCdXR0b24uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IHtcbiAgICAgICAgYWN0aXZlTGF5ZXJJZCA9IGxheWVyLmlkO1xyXG4gICAgICAgIHN5bmNVaVN0YXRlKCk7XHJcbiAgICAgICAgcmVuZGVyTGF5ZXJzKCk7XG4gICAgICAgIHVwZGF0ZVN0YXR1cyhgQWN0aXZlIGxheWVyOiAke2xheWVyLm5hbWV9YCk7XG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiByZW5kZXJCb2FyZCgpOiB2b2lkIHtcbiAgICBjbGVhbnVwVGV4dEVkaXRvcigpO1xuICAgIGFwcGx5Vmlld3BvcnQoKTtcbiAgICByZW5kZXJJdGVtcygpO1xuICAgIHJlbmRlckxheWVycygpO1xuICAgIHVwZGF0ZVRvb2xiYXIoKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHJlbmRlckl0ZW1zKCk6IHZvaWQge1xuICAgIHN0cm9rZUxheWVyLmVtcHR5KCk7XG4gICAgdGV4dFdvcmxkLmVtcHR5KCk7XG5cbiAgICBmb3IgKGNvbnN0IGl0ZW0gb2YgYm9hcmQuaXRlbXMpIHtcbiAgICAgIGlmICghaXNMYXllclZpc2libGUoaXRlbS5sYXllcklkKSkge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgaWYgKGl0ZW0udHlwZSA9PT0gXCJzdHJva2VcIikge1xuICAgICAgICBjb25zdCBwYXRoID0gc3Ryb2tlTGF5ZXIuY3JlYXRlU3ZnKFwicGF0aFwiLCB7IGNsczogXCJlbWJlZGRlZC13aGl0ZWJvYXJkX19zdHJva2VcIiB9KTtcbiAgICAgICAgcGF0aC5zZXRBdHRyaWJ1dGUoXCJkXCIsIHBvaW50c1RvUGF0aChpdGVtLnBvaW50cykpO1xuICAgICAgICBwYXRoLnNldEF0dHJpYnV0ZShcInN0cm9rZVwiLCBpdGVtLmNvbG9yKTtcbiAgICAgICAgcGF0aC5zZXRBdHRyaWJ1dGUoXCJzdHJva2Utd2lkdGhcIiwgU3RyaW5nKGl0ZW0ud2lkdGgpKTtcbiAgICAgICAgcGF0aC5zZXRBdHRyaWJ1dGUoXCJzdHJva2UtbGluZWNhcFwiLCBcInJvdW5kXCIpO1xuICAgICAgICBwYXRoLnNldEF0dHJpYnV0ZShcInN0cm9rZS1saW5lam9pblwiLCBcInJvdW5kXCIpO1xuICAgICAgICBwYXRoLnNldEF0dHJpYnV0ZShcImZpbGxcIiwgXCJub25lXCIpO1xuICAgICAgICBwYXRoLnN0eWxlLm9wYWNpdHkgPSBTdHJpbmcoaXRlbS5vcGFjaXR5KTtcbiAgICAgICAgcGF0aC5kYXRhc2V0Lml0ZW1JZCA9IGl0ZW0uaWQ7XG4gICAgICAgIHBhdGguZGF0YXNldC50b29sID0gaXRlbS50b29sO1xuICAgICAgICBwYXRoLnRvZ2dsZUNsYXNzKFwiaXMtc2VsZWN0ZWRcIiwgaXRlbS5pZCA9PT0gc2VsZWN0ZWRJdGVtSWQpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc3QgdGV4dEVsID0gdGV4dFdvcmxkLmNyZWF0ZURpdih7IGNsczogXCJlbWJlZGRlZC13aGl0ZWJvYXJkX190ZXh0LWl0ZW1cIiB9KTtcbiAgICAgICAgdGV4dEVsLmRhdGFzZXQuaXRlbUlkID0gaXRlbS5pZDtcbiAgICAgICAgdGV4dEVsLnN0eWxlLmxlZnQgPSBgJHtpdGVtLnh9cHhgO1xuICAgICAgICB0ZXh0RWwuc3R5bGUudG9wID0gYCR7aXRlbS55fXB4YDtcbiAgICAgICAgdGV4dEVsLnN0eWxlLmNvbG9yID0gaXRlbS5jb2xvcjtcbiAgICAgICAgdGV4dEVsLnN0eWxlLmZvbnRTaXplID0gYCR7aXRlbS5zaXplfXB4YDtcbiAgICAgICAgdGV4dEVsLnN0eWxlLndoaXRlU3BhY2UgPSBcInByZS13cmFwXCI7XG4gICAgICAgIHRleHRFbC5zZXRUZXh0KGl0ZW0udGV4dCB8fCBcIlRleHRcIik7XG4gICAgICAgIHRleHRFbC50b2dnbGVDbGFzcyhcImlzLXNlbGVjdGVkXCIsIGl0ZW0uaWQgPT09IHNlbGVjdGVkSXRlbUlkKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiByZW5kZXJEcmFmdFN0cm9rZSgpOiB2b2lkIHtcbiAgICBpZiAoIWRyYWZ0U3Ryb2tlKSB7XG4gICAgICBkcmFmdFBhdGguc2V0QXR0cmlidXRlKFwiZFwiLCBcIlwiKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBkcmFmdFBhdGguc2V0QXR0cmlidXRlKFwiZFwiLCBwb2ludHNUb1BhdGgoZHJhZnRTdHJva2UucG9pbnRzKSk7XG4gICAgZHJhZnRQYXRoLnNldEF0dHJpYnV0ZShcInN0cm9rZVwiLCBkcmFmdFN0cm9rZS5jb2xvcik7XG4gICAgZHJhZnRQYXRoLnNldEF0dHJpYnV0ZShcInN0cm9rZS13aWR0aFwiLCBTdHJpbmcoZHJhZnRTdHJva2Uud2lkdGgpKTtcbiAgICBkcmFmdFBhdGguc2V0QXR0cmlidXRlKFwic3Ryb2tlLWxpbmVjYXBcIiwgXCJyb3VuZFwiKTtcbiAgICBkcmFmdFBhdGguc2V0QXR0cmlidXRlKFwic3Ryb2tlLWxpbmVqb2luXCIsIFwicm91bmRcIik7XG4gICAgZHJhZnRQYXRoLnNldEF0dHJpYnV0ZShcImZpbGxcIiwgXCJub25lXCIpO1xuICAgIGRyYWZ0UGF0aC5zdHlsZS5vcGFjaXR5ID0gU3RyaW5nKGRyYWZ0U3Ryb2tlLm9wYWNpdHkpO1xuICB9XG5cbiAgZnVuY3Rpb24gY2xlYW51cFRleHRFZGl0b3IoKTogdm9pZCB7XG4gICAgaWYgKGFjdGl2ZVRleHRFZGl0b3IpIHtcbiAgICAgIGlmIChhY3RpdmVUZXh0RWRpdG9yLmlzQ29ubmVjdGVkKSB7XG4gICAgICAgIGFjdGl2ZVRleHRFZGl0b3IucmVtb3ZlKCk7XG4gICAgICB9XG4gICAgICBhY3RpdmVUZXh0RWRpdG9yID0gbnVsbDtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBvcGVuVGV4dEVkaXRvcihwb2ludDogeyB4OiBudW1iZXI7IHk6IG51bWJlciB9LCBleGlzdGluZz86IFRleHRJdGVtKTogdm9pZCB7XG4gICAgY2xlYW51cFRleHRFZGl0b3IoKTtcblxuICAgIGNvbnN0IGVkaXRvciA9IHRleHRXb3JsZC5jcmVhdGVFbChcInRleHRhcmVhXCIsIHsgY2xzOiBcImVtYmVkZGVkLXdoaXRlYm9hcmRfX3RleHQtZWRpdG9yXCIgfSk7XG4gICAgZWRpdG9yLnZhbHVlID0gZXhpc3Rpbmc/LnRleHQgPz8gXCJcIjtcbiAgICBlZGl0b3Iuc3R5bGUubGVmdCA9IGAke2V4aXN0aW5nPy54ID8/IHBvaW50Lnh9cHhgO1xuICAgIGVkaXRvci5zdHlsZS50b3AgPSBgJHtleGlzdGluZz8ueSA/PyBwb2ludC55fXB4YDtcbiAgICBlZGl0b3Iuc3R5bGUuY29sb3IgPSBleGlzdGluZz8uY29sb3IgPz8gYWN0aXZlQ29sb3I7XG4gICAgZWRpdG9yLnN0eWxlLmZvbnRTaXplID0gYCR7ZXhpc3Rpbmc/LnNpemUgPz8gMjB9cHhgO1xuICAgIGFjdGl2ZVRleHRFZGl0b3IgPSBlZGl0b3I7XG4gICAgZWRpdG9yLmZvY3VzKCk7XG5cbiAgICBjb25zdCBjb21taXQgPSAoKTogdm9pZCA9PiB7XG4gICAgICBjb25zdCB0ZXh0ID0gZWRpdG9yLnZhbHVlLnRyaW1FbmQoKTtcbiAgICAgIGNvbnN0IHRhcmdldCA9IGV4aXN0aW5nID8/IHtcbiAgICAgICAgaWQ6IGNyZWF0ZUlkKFwidGV4dFwiKSxcbiAgICAgICAgdHlwZTogXCJ0ZXh0XCIgYXMgY29uc3QsXG4gICAgICAgIGxheWVySWQ6IGFjdGl2ZUxheWVySWQsXG4gICAgICAgIHg6IHBvaW50LngsXG4gICAgICAgIHk6IHBvaW50LnksXG4gICAgICAgIHRleHQ6IFwiXCIsXG4gICAgICAgIGNvbG9yOiBhY3RpdmVDb2xvcixcbiAgICAgICAgc2l6ZTogMjBcbiAgICAgIH07XG5cbiAgICAgIGlmICh0ZXh0LnRyaW0oKS5sZW5ndGggPT09IDApIHtcbiAgICAgICAgY2xlYW51cFRleHRFZGl0b3IoKTtcbiAgICAgICAgcmVuZGVyQm9hcmQoKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICB0YXJnZXQudGV4dCA9IHRleHQ7XG4gICAgICB0YXJnZXQuY29sb3IgPSBleGlzdGluZz8uY29sb3IgPz8gYWN0aXZlQ29sb3I7XG4gICAgICB0YXJnZXQuc2l6ZSA9IGV4aXN0aW5nPy5zaXplID8/IDIwO1xuXG4gICAgICBpZiAoIWV4aXN0aW5nKSB7XG4gICAgICAgIGJvYXJkLml0ZW1zLnB1c2godGFyZ2V0KTtcbiAgICAgIH1cblxuICAgICAgY2xlYW51cFRleHRFZGl0b3IoKTtcbiAgICAgIHNlbGVjdGVkSXRlbUlkID0gdGFyZ2V0LmlkO1xuICAgICAgcmVuZGVyQm9hcmQoKTtcbiAgICAgIHB1c2hIaXN0b3J5KCk7XG4gICAgICBxdWV1ZVNhdmUoKTtcbiAgICB9O1xuXG4gICAgZWRpdG9yLmFkZEV2ZW50TGlzdGVuZXIoXCJibHVyXCIsIGNvbW1pdCwgeyBvbmNlOiB0cnVlIH0pO1xuICAgIGVkaXRvci5hZGRFdmVudExpc3RlbmVyKFwia2V5ZG93blwiLCAoZXZlbnQpID0+IHtcbiAgICAgIGlmICgoZXZlbnQuY3RybEtleSB8fCBldmVudC5tZXRhS2V5KSAmJiBldmVudC5rZXkgPT09IFwiRW50ZXJcIikge1xuICAgICAgICBlZGl0b3IuYmx1cigpO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgZnVuY3Rpb24gYWRkTGF5ZXIoKTogdm9pZCB7XG4gICAgY29uc3QgbGF5ZXI6IFdoaXRlYm9hcmRMYXllciA9IHtcbiAgICAgIGlkOiBjcmVhdGVJZChcImxheWVyXCIpLFxuICAgICAgbmFtZTogYExheWVyICR7Ym9hcmQubGF5ZXJzLmxlbmd0aCArIDF9YCxcbiAgICAgIHZpc2libGU6IHRydWUsXG4gICAgICBsb2NrZWQ6IGZhbHNlXG4gICAgfTtcbiAgICBib2FyZC5sYXllcnMucHVzaChsYXllcik7XG4gICAgYWN0aXZlTGF5ZXJJZCA9IGxheWVyLmlkO1xyXG4gICAgc3luY1VpU3RhdGUoKTtcclxuICAgIHJlbmRlckxheWVycygpO1xuICAgIHB1c2hIaXN0b3J5KCk7XG4gICAgcXVldWVTYXZlKCk7XG4gIH1cblxuICBmdW5jdGlvbiBnZXRXb3JsZFBvaW50KGV2ZW50OiBQb2ludGVyRXZlbnQpOiB7IHg6IG51bWJlcjsgeTogbnVtYmVyIH0ge1xuICAgIGNvbnN0IGJvdW5kcyA9IHZpZXdwb3J0LmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuICAgIHJldHVybiB7XG4gICAgICB4OiAoZXZlbnQuY2xpZW50WCAtIGJvdW5kcy5sZWZ0IC0gYm9hcmQudmlld3BvcnQueCkgLyBib2FyZC52aWV3cG9ydC56b29tLFxuICAgICAgeTogKGV2ZW50LmNsaWVudFkgLSBib3VuZHMudG9wIC0gYm9hcmQudmlld3BvcnQueSkgLyBib2FyZC52aWV3cG9ydC56b29tXG4gICAgfTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGJlZ2luU3Ryb2tlKHBvaW50OiB7IHg6IG51bWJlcjsgeTogbnVtYmVyIH0sIGV2ZW50OiBQb2ludGVyRXZlbnQpOiB2b2lkIHtcbiAgICBpZiAoaXNMYXllckxvY2tlZChhY3RpdmVMYXllcklkKSkge1xuICAgICAgdXBkYXRlU3RhdHVzKFwiQWN0aXZlIGxheWVyIGlzIGxvY2tlZFwiKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCB0b29sID0gYWN0aXZlVG9vbCA9PT0gXCJwZW5cIiB8fCBhY3RpdmVUb29sID09PSBcInBlbmNpbFwiIHx8IGFjdGl2ZVRvb2wgPT09IFwibWFya2VyXCIgPyBhY3RpdmVUb29sIDogXCJwZW5cIjtcbiAgICBkcmFmdFN0cm9rZSA9IHtcbiAgICAgIGlkOiBjcmVhdGVJZChcInN0cm9rZVwiKSxcbiAgICAgIHR5cGU6IFwic3Ryb2tlXCIsXG4gICAgICBsYXllcklkOiBhY3RpdmVMYXllcklkLFxuICAgICAgdG9vbCxcbiAgICAgIGNvbG9yOiBhY3RpdmVDb2xvcixcbiAgICAgIHdpZHRoOiBicnVzaFNpemUsXG4gICAgICBvcGFjaXR5LFxuICAgICAgcG9pbnRzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICB4OiBwb2ludC54LFxuICAgICAgICAgIHk6IHBvaW50LnksXG4gICAgICAgICAgcHJlc3N1cmU6IG5vcm1hbGl6ZVByZXNzdXJlKGV2ZW50LnByZXNzdXJlKVxuICAgICAgICB9XG4gICAgICBdXG4gICAgfTtcbiAgICBwb2ludGVyTW9kZSA9IHsgdHlwZTogXCJkcmF3XCIsIHBvaW50ZXJJZDogZXZlbnQucG9pbnRlcklkIH07XG4gICAgcmVuZGVyRHJhZnRTdHJva2UoKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGNvbW1pdFN0cm9rZSgpOiB2b2lkIHtcbiAgICBpZiAoIWRyYWZ0U3Ryb2tlKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGlmIChkcmFmdFN0cm9rZS5wb2ludHMubGVuZ3RoID4gMSkge1xuICAgICAgYm9hcmQuaXRlbXMucHVzaChkcmFmdFN0cm9rZSk7XG4gICAgICBzZWxlY3RlZEl0ZW1JZCA9IGRyYWZ0U3Ryb2tlLmlkO1xuICAgICAgcHVzaEhpc3RvcnkoKTtcbiAgICAgIHF1ZXVlU2F2ZSgpO1xuICAgIH1cbiAgICBkcmFmdFN0cm9rZSA9IG51bGw7XG4gICAgcmVuZGVyRHJhZnRTdHJva2UoKTtcbiAgICByZW5kZXJCb2FyZCgpO1xuICB9XG5cbiAgZnVuY3Rpb24gZXJhc2VBdChwb2ludDogeyB4OiBudW1iZXI7IHk6IG51bWJlciB9KTogYm9vbGVhbiB7XG4gICAgY29uc3QgaXRlbSA9IGhpdFRlc3QocG9pbnQsIHRydWUpO1xuICAgIGlmICghaXRlbSkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIGJvYXJkLml0ZW1zID0gYm9hcmQuaXRlbXMuZmlsdGVyKChjYW5kaWRhdGUpID0+IGNhbmRpZGF0ZS5pZCAhPT0gaXRlbS5pZCk7XG4gICAgaWYgKHNlbGVjdGVkSXRlbUlkID09PSBpdGVtLmlkKSB7XG4gICAgICBzZWxlY3RlZEl0ZW1JZCA9IG51bGw7XG4gICAgfVxuICAgIHJlbmRlckJvYXJkKCk7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICBmdW5jdGlvbiBoaXRUZXN0KHBvaW50OiB7IHg6IG51bWJlcjsgeTogbnVtYmVyIH0sIGlnbm9yZUxvY2tlZCA9IGZhbHNlKTogV2hpdGVib2FyZEl0ZW0gfCBudWxsIHtcbiAgICBmb3IgKGNvbnN0IGl0ZW0gb2YgWy4uLmJvYXJkLml0ZW1zXS5yZXZlcnNlKCkpIHtcbiAgICAgIGlmICghaXNMYXllclZpc2libGUoaXRlbS5sYXllcklkKSkge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICAgIGlmICghaWdub3JlTG9ja2VkICYmIGlzTGF5ZXJMb2NrZWQoaXRlbS5sYXllcklkKSkge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgaWYgKGl0ZW0udHlwZSA9PT0gXCJ0ZXh0XCIpIHtcbiAgICAgICAgaWYgKFxuICAgICAgICAgIHBvaW50LnggPj0gaXRlbS54IC0gOCAmJlxuICAgICAgICAgIHBvaW50LnggPD0gaXRlbS54ICsgMzIwICYmXG4gICAgICAgICAgcG9pbnQueSA+PSBpdGVtLnkgLSA4ICYmXG4gICAgICAgICAgcG9pbnQueSA8PSBpdGVtLnkgKyA2NFxuICAgICAgICApIHtcbiAgICAgICAgICByZXR1cm4gaXRlbTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmIChpc1BvaW50TmVhclN0cm9rZShwb2ludCwgaXRlbSkpIHtcbiAgICAgICAgcmV0dXJuIGl0ZW07XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICBmdW5jdGlvbiBiZWdpbk1vdmUoaXRlbTogV2hpdGVib2FyZEl0ZW0sIHBvaW50OiB7IHg6IG51bWJlcjsgeTogbnVtYmVyIH0sIGV2ZW50OiBQb2ludGVyRXZlbnQpOiB2b2lkIHtcbiAgICBpZiAoaXRlbS50eXBlID09PSBcInRleHRcIikge1xuICAgICAgcG9pbnRlck1vZGUgPSB7XG4gICAgICAgIHR5cGU6IFwibW92ZVwiLFxuICAgICAgICBwb2ludGVySWQ6IGV2ZW50LnBvaW50ZXJJZCxcbiAgICAgICAgaXRlbUlkOiBpdGVtLmlkLFxuICAgICAgICBzdGFydFg6IHBvaW50LngsXG4gICAgICAgIHN0YXJ0WTogcG9pbnQueSxcbiAgICAgICAgb3JpZ2luVGV4dDogeyB4OiBpdGVtLngsIHk6IGl0ZW0ueSB9XG4gICAgICB9O1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHBvaW50ZXJNb2RlID0ge1xuICAgICAgdHlwZTogXCJtb3ZlXCIsXG4gICAgICBwb2ludGVySWQ6IGV2ZW50LnBvaW50ZXJJZCxcbiAgICAgIGl0ZW1JZDogaXRlbS5pZCxcbiAgICAgIHN0YXJ0WDogcG9pbnQueCxcbiAgICAgIHN0YXJ0WTogcG9pbnQueSxcbiAgICAgIG9yaWdpblBvaW50czogaXRlbS5wb2ludHMubWFwKChjdXJyZW50KSA9PiAoeyAuLi5jdXJyZW50IH0pKVxuICAgIH07XG4gIH1cblxuICBmdW5jdGlvbiB0cmFuc2xhdGVJdGVtKG1vZGU6IEV4dHJhY3Q8UG9pbnRlck1vZGUsIHsgdHlwZTogXCJtb3ZlXCIgfT4sIHBvaW50OiB7IHg6IG51bWJlcjsgeTogbnVtYmVyIH0pOiB2b2lkIHtcbiAgICBjb25zdCBpdGVtID0gZ2V0SXRlbShtb2RlLml0ZW1JZCk7XG4gICAgaWYgKCFpdGVtKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgZHggPSBwb2ludC54IC0gbW9kZS5zdGFydFg7XG4gICAgY29uc3QgZHkgPSBwb2ludC55IC0gbW9kZS5zdGFydFk7XG5cbiAgICBpZiAoaXRlbS50eXBlID09PSBcInRleHRcIiAmJiBtb2RlLm9yaWdpblRleHQpIHtcbiAgICAgIGl0ZW0ueCA9IG1vZGUub3JpZ2luVGV4dC54ICsgZHg7XG4gICAgICBpdGVtLnkgPSBtb2RlLm9yaWdpblRleHQueSArIGR5O1xuICAgIH1cblxuICAgIGlmIChpdGVtLnR5cGUgPT09IFwic3Ryb2tlXCIgJiYgbW9kZS5vcmlnaW5Qb2ludHMpIHtcbiAgICAgIGl0ZW0ucG9pbnRzID0gbW9kZS5vcmlnaW5Qb2ludHMubWFwKChvcmlnaW4pID0+ICh7XG4gICAgICAgIHg6IG9yaWdpbi54ICsgZHgsXG4gICAgICAgIHk6IG9yaWdpbi55ICsgZHksXG4gICAgICAgIHByZXNzdXJlOiBvcmlnaW4ucHJlc3N1cmVcbiAgICAgIH0pKTtcbiAgICB9XG5cbiAgICByZW5kZXJCb2FyZCgpO1xuICB9XG5cbiAgdmlld3BvcnQuYWRkRXZlbnRMaXN0ZW5lcihcInBvaW50ZXJkb3duXCIsIChldmVudCkgPT4ge1xuICAgIGNsZWFudXBUZXh0RWRpdG9yKCk7XG4gICAgdmlld3BvcnQuc2V0UG9pbnRlckNhcHR1cmUoZXZlbnQucG9pbnRlcklkKTtcbiAgICBjb25zdCBwb2ludCA9IGdldFdvcmxkUG9pbnQoZXZlbnQpO1xuICAgIGNvbnN0IHRleHRUYXJnZXQgPSAoZXZlbnQudGFyZ2V0IGFzIEhUTUxFbGVtZW50KS5jbG9zZXN0PEhUTUxFbGVtZW50PihcIi5lbWJlZGRlZC13aGl0ZWJvYXJkX190ZXh0LWl0ZW1cIik7XG4gICAgY29uc3QgdGFyZ2V0ZWRJdGVtID0gdGV4dFRhcmdldD8uZGF0YXNldC5pdGVtSWQgPyBnZXRJdGVtKHRleHRUYXJnZXQuZGF0YXNldC5pdGVtSWQpIDogaGl0VGVzdChwb2ludCk7XG5cbiAgICBpZiAoYWN0aXZlVG9vbCA9PT0gXCJoYW5kXCIgfHwgZXZlbnQuYnV0dG9uID09PSAxKSB7XG4gICAgICBwb2ludGVyTW9kZSA9IHtcbiAgICAgICAgdHlwZTogXCJwYW5cIixcbiAgICAgICAgc3RhcnRYOiBldmVudC5jbGllbnRYLFxuICAgICAgICBzdGFydFk6IGV2ZW50LmNsaWVudFksXG4gICAgICAgIG9yaWdpblg6IGJvYXJkLnZpZXdwb3J0LngsXG4gICAgICAgIG9yaWdpblk6IGJvYXJkLnZpZXdwb3J0LnlcbiAgICAgIH07XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKGFjdGl2ZVRvb2wgPT09IFwidGV4dFwiKSB7XG4gICAgICBwb2ludGVyTW9kZSA9IHsgdHlwZTogXCJpZGxlXCIgfTtcbiAgICAgIGlmICh0YXJnZXRlZEl0ZW0/LnR5cGUgPT09IFwidGV4dFwiKSB7XG4gICAgICAgIHNlbGVjdGVkSXRlbUlkID0gdGFyZ2V0ZWRJdGVtLmlkO1xuICAgICAgICByZW5kZXJCb2FyZCgpO1xuICAgICAgICBvcGVuVGV4dEVkaXRvcih7IHg6IHRhcmdldGVkSXRlbS54LCB5OiB0YXJnZXRlZEl0ZW0ueSB9LCB0YXJnZXRlZEl0ZW0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgc2VsZWN0ZWRJdGVtSWQgPSBudWxsO1xuICAgICAgICByZW5kZXJCb2FyZCgpO1xuICAgICAgICBvcGVuVGV4dEVkaXRvcihwb2ludCk7XG4gICAgICB9XG4gICAgICB1cGRhdGVTdGF0dXMoXCJFZGl0aW5nIHRleHRcIik7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKGFjdGl2ZVRvb2wgPT09IFwiZXJhc2VyXCIpIHtcbiAgICAgIGNvbnN0IHJlbW92ZWQgPSBlcmFzZUF0KHBvaW50KTtcbiAgICAgIHBvaW50ZXJNb2RlID0geyB0eXBlOiBcImVyYXNlXCIsIHBvaW50ZXJJZDogZXZlbnQucG9pbnRlcklkLCByZW1vdmVkIH07XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKGFjdGl2ZVRvb2wgPT09IFwic2VsZWN0XCIpIHtcbiAgICAgIGlmICh0YXJnZXRlZEl0ZW0pIHtcbiAgICAgICAgc2VsZWN0ZWRJdGVtSWQgPSB0YXJnZXRlZEl0ZW0uaWQ7XG4gICAgICAgIGlmICghaXNMYXllckxvY2tlZCh0YXJnZXRlZEl0ZW0ubGF5ZXJJZCkpIHtcbiAgICAgICAgICBiZWdpbk1vdmUodGFyZ2V0ZWRJdGVtLCBwb2ludCwgZXZlbnQpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzZWxlY3RlZEl0ZW1JZCA9IG51bGw7XG4gICAgICAgIHJlbmRlckJvYXJkKCk7XG4gICAgICB9XG4gICAgICByZW5kZXJCb2FyZCgpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGJlZ2luU3Ryb2tlKHBvaW50LCBldmVudCk7XG4gIH0pO1xuXG4gIHZpZXdwb3J0LmFkZEV2ZW50TGlzdGVuZXIoXCJwb2ludGVybW92ZVwiLCAoZXZlbnQpID0+IHtcbiAgICBjb25zdCBwb2ludCA9IGdldFdvcmxkUG9pbnQoZXZlbnQpO1xuXG4gICAgaWYgKHBvaW50ZXJNb2RlLnR5cGUgPT09IFwicGFuXCIpIHtcbiAgICAgIGJvYXJkLnZpZXdwb3J0LnggPSBwb2ludGVyTW9kZS5vcmlnaW5YICsgKGV2ZW50LmNsaWVudFggLSBwb2ludGVyTW9kZS5zdGFydFgpO1xuICAgICAgYm9hcmQudmlld3BvcnQueSA9IHBvaW50ZXJNb2RlLm9yaWdpblkgKyAoZXZlbnQuY2xpZW50WSAtIHBvaW50ZXJNb2RlLnN0YXJ0WSk7XG4gICAgICBhcHBseVZpZXdwb3J0KCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKHBvaW50ZXJNb2RlLnR5cGUgPT09IFwiZHJhd1wiICYmIGRyYWZ0U3Ryb2tlKSB7XG4gICAgICBkcmFmdFN0cm9rZS5wb2ludHMucHVzaCh7XG4gICAgICAgIHg6IHBvaW50LngsXG4gICAgICAgIHk6IHBvaW50LnksXG4gICAgICAgIHByZXNzdXJlOiBub3JtYWxpemVQcmVzc3VyZShldmVudC5wcmVzc3VyZSlcbiAgICAgIH0pO1xuICAgICAgcmVuZGVyRHJhZnRTdHJva2UoKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAocG9pbnRlck1vZGUudHlwZSA9PT0gXCJtb3ZlXCIpIHtcbiAgICAgIHRyYW5zbGF0ZUl0ZW0ocG9pbnRlck1vZGUsIHBvaW50KTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAocG9pbnRlck1vZGUudHlwZSA9PT0gXCJlcmFzZVwiKSB7XG4gICAgICBjb25zdCByZW1vdmVkID0gZXJhc2VBdChwb2ludCkgfHwgcG9pbnRlck1vZGUucmVtb3ZlZDtcbiAgICAgIHBvaW50ZXJNb2RlID0geyAuLi5wb2ludGVyTW9kZSwgcmVtb3ZlZCB9O1xuICAgIH1cbiAgfSk7XG5cbiAgY29uc3Qgc3RvcFBvaW50ZXIgPSAoKTogdm9pZCA9PiB7XG4gICAgaWYgKHBvaW50ZXJNb2RlLnR5cGUgPT09IFwiZHJhd1wiKSB7XG4gICAgICBjb21taXRTdHJva2UoKTtcbiAgICB9IGVsc2UgaWYgKHBvaW50ZXJNb2RlLnR5cGUgPT09IFwibW92ZVwiKSB7XG4gICAgICBwdXNoSGlzdG9yeSgpO1xuICAgICAgcXVldWVTYXZlKCk7XG4gICAgfSBlbHNlIGlmIChwb2ludGVyTW9kZS50eXBlID09PSBcImVyYXNlXCIgJiYgcG9pbnRlck1vZGUucmVtb3ZlZCkge1xuICAgICAgcHVzaEhpc3RvcnkoKTtcbiAgICAgIHF1ZXVlU2F2ZSgpO1xuICAgIH0gZWxzZSBpZiAocG9pbnRlck1vZGUudHlwZSA9PT0gXCJwYW5cIikge1xuICAgICAgcXVldWVTYXZlKCk7XG4gICAgfVxuXG4gICAgcG9pbnRlck1vZGUgPSB7IHR5cGU6IFwiaWRsZVwiIH07XG4gIH07XG5cbiAgdmlld3BvcnQuYWRkRXZlbnRMaXN0ZW5lcihcInBvaW50ZXJ1cFwiLCBzdG9wUG9pbnRlcik7XG4gIHZpZXdwb3J0LmFkZEV2ZW50TGlzdGVuZXIoXCJwb2ludGVybGVhdmVcIiwgc3RvcFBvaW50ZXIpO1xuXG4gIHZpZXdwb3J0LmFkZEV2ZW50TGlzdGVuZXIoXG4gICAgXCJ3aGVlbFwiLFxuICAgIChldmVudCkgPT4ge1xuICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcblxuICAgICAgY29uc3QgYm91bmRzID0gdmlld3BvcnQuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG4gICAgICBjb25zdCBjdXJzb3JYID0gZXZlbnQuY2xpZW50WCAtIGJvdW5kcy5sZWZ0O1xuICAgICAgY29uc3QgY3Vyc29yWSA9IGV2ZW50LmNsaWVudFkgLSBib3VuZHMudG9wO1xuICAgICAgY29uc3Qgd29ybGRYID0gKGN1cnNvclggLSBib2FyZC52aWV3cG9ydC54KSAvIGJvYXJkLnZpZXdwb3J0Lnpvb207XG4gICAgICBjb25zdCB3b3JsZFkgPSAoY3Vyc29yWSAtIGJvYXJkLnZpZXdwb3J0LnkpIC8gYm9hcmQudmlld3BvcnQuem9vbTtcbiAgICAgIGNvbnN0IG5leHRab29tID0gY2xhbXAoYm9hcmQudmlld3BvcnQuem9vbSAqIChldmVudC5kZWx0YVkgPCAwID8gMS4wOCA6IDAuOTIpLCAwLjIsIDQpO1xuXG4gICAgICBib2FyZC52aWV3cG9ydC56b29tID0gbmV4dFpvb207XG4gICAgICBib2FyZC52aWV3cG9ydC54ID0gY3Vyc29yWCAtIHdvcmxkWCAqIG5leHRab29tO1xuICAgICAgYm9hcmQudmlld3BvcnQueSA9IGN1cnNvclkgLSB3b3JsZFkgKiBuZXh0Wm9vbTtcbiAgICAgIGFwcGx5Vmlld3BvcnQoKTtcbiAgICAgIHF1ZXVlU2F2ZSgpO1xuICAgIH0sXG4gICAgeyBwYXNzaXZlOiBmYWxzZSB9XG4gICk7XG5cbiAgc3luY1VpU3RhdGUoKTtcclxuICB1cGRhdGVUb29sYmFyKCk7XHJcbiAgdXBkYXRlU3RhdHVzKGAke1RPT0xfTEFCRUxTW2FjdGl2ZVRvb2xdfSByZWFkeWApO1xyXG4gIHJlbmRlckJvYXJkKCk7XG5cbiAgcmV0dXJuIHtcbiAgICBkZXN0cm95KCkge1xuICAgICAgZGVzdHJveWVkID0gdHJ1ZTtcbiAgICAgIGlmIChzYXZlVGltZXIgIT09IG51bGwpIHtcbiAgICAgICAgd2luZG93LmNsZWFyVGltZW91dChzYXZlVGltZXIpO1xuICAgICAgfVxuICAgICAgY2xlYW51cFRleHRFZGl0b3IoKTtcbiAgICAgIGNvbnRhaW5lci5lbXB0eSgpO1xuICAgIH1cbiAgfTtcbn1cblxuZnVuY3Rpb24gbm9ybWFsaXplUHJlc3N1cmUocHJlc3N1cmU6IG51bWJlcik6IG51bWJlciB7XG4gIGlmIChwcmVzc3VyZSA+IDAgJiYgTnVtYmVyLmlzRmluaXRlKHByZXNzdXJlKSkge1xuICAgIHJldHVybiBwcmVzc3VyZTtcbiAgfVxuICByZXR1cm4gMC41O1xufVxuXG5mdW5jdGlvbiBwb2ludHNUb1BhdGgocG9pbnRzOiBTdHJva2VQb2ludFtdKTogc3RyaW5nIHtcbiAgaWYgKHBvaW50cy5sZW5ndGggPT09IDApIHtcbiAgICByZXR1cm4gXCJcIjtcbiAgfVxuXG4gIGlmIChwb2ludHMubGVuZ3RoID09PSAxKSB7XG4gICAgY29uc3QgcG9pbnQgPSBwb2ludHNbMF07XG4gICAgcmV0dXJuIGBNICR7cG9pbnQueH0gJHtwb2ludC55fSBMICR7cG9pbnQueCArIDAuMDF9ICR7cG9pbnQueSArIDAuMDF9YDtcbiAgfVxuXG4gIGxldCBwYXRoID0gYE0gJHtwb2ludHNbMF0ueH0gJHtwb2ludHNbMF0ueX1gO1xuICBmb3IgKGxldCBpbmRleCA9IDE7IGluZGV4IDwgcG9pbnRzLmxlbmd0aCAtIDE7IGluZGV4ICs9IDEpIHtcbiAgICBjb25zdCBjdXJyZW50ID0gcG9pbnRzW2luZGV4XTtcbiAgICBjb25zdCBuZXh0ID0gcG9pbnRzW2luZGV4ICsgMV07XG4gICAgY29uc3QgbWlkWCA9IChjdXJyZW50LnggKyBuZXh0LngpIC8gMjtcbiAgICBjb25zdCBtaWRZID0gKGN1cnJlbnQueSArIG5leHQueSkgLyAyO1xuICAgIHBhdGggKz0gYCBRICR7Y3VycmVudC54fSAke2N1cnJlbnQueX0gJHttaWRYfSAke21pZFl9YDtcbiAgfVxuXG4gIGNvbnN0IGxhc3QgPSBwb2ludHNbcG9pbnRzLmxlbmd0aCAtIDFdO1xuICBwYXRoICs9IGAgTCAke2xhc3QueH0gJHtsYXN0Lnl9YDtcbiAgcmV0dXJuIHBhdGg7XG59XG5cbmZ1bmN0aW9uIGlzUG9pbnROZWFyU3Ryb2tlKHBvaW50OiB7IHg6IG51bWJlcjsgeTogbnVtYmVyIH0sIHN0cm9rZTogU3Ryb2tlSXRlbSk6IGJvb2xlYW4ge1xuICBjb25zdCB0aHJlc2hvbGQgPSBNYXRoLm1heChzdHJva2Uud2lkdGggKiAxLjUsIDEwKTtcblxuICBmb3IgKGxldCBpbmRleCA9IDE7IGluZGV4IDwgc3Ryb2tlLnBvaW50cy5sZW5ndGg7IGluZGV4ICs9IDEpIHtcbiAgICBjb25zdCBwcmV2aW91cyA9IHN0cm9rZS5wb2ludHNbaW5kZXggLSAxXTtcbiAgICBjb25zdCBjdXJyZW50ID0gc3Ryb2tlLnBvaW50c1tpbmRleF07XG4gICAgaWYgKGRpc3RhbmNlVG9TZWdtZW50KHBvaW50LCBwcmV2aW91cywgY3VycmVudCkgPD0gdGhyZXNob2xkKSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gZmFsc2U7XG59XG5cbmZ1bmN0aW9uIGRpc3RhbmNlVG9TZWdtZW50KFxuICBwb2ludDogeyB4OiBudW1iZXI7IHk6IG51bWJlciB9LFxuICBzdGFydDogeyB4OiBudW1iZXI7IHk6IG51bWJlciB9LFxuICBlbmQ6IHsgeDogbnVtYmVyOyB5OiBudW1iZXIgfVxuKTogbnVtYmVyIHtcbiAgY29uc3QgZHggPSBlbmQueCAtIHN0YXJ0Lng7XG4gIGNvbnN0IGR5ID0gZW5kLnkgLSBzdGFydC55O1xuXG4gIGlmIChkeCA9PT0gMCAmJiBkeSA9PT0gMCkge1xuICAgIHJldHVybiBNYXRoLmh5cG90KHBvaW50LnggLSBzdGFydC54LCBwb2ludC55IC0gc3RhcnQueSk7XG4gIH1cblxuICBjb25zdCB0ID0gY2xhbXAoKChwb2ludC54IC0gc3RhcnQueCkgKiBkeCArIChwb2ludC55IC0gc3RhcnQueSkgKiBkeSkgLyAoZHggKiBkeCArIGR5ICogZHkpLCAwLCAxKTtcbiAgY29uc3QgcHJvamVjdGlvblggPSBzdGFydC54ICsgdCAqIGR4O1xuICBjb25zdCBwcm9qZWN0aW9uWSA9IHN0YXJ0LnkgKyB0ICogZHk7XG4gIHJldHVybiBNYXRoLmh5cG90KHBvaW50LnggLSBwcm9qZWN0aW9uWCwgcG9pbnQueSAtIHByb2plY3Rpb25ZKTtcbn1cblxuZnVuY3Rpb24gY2xhbXAodmFsdWU6IG51bWJlciwgbWluOiBudW1iZXIsIG1heDogbnVtYmVyKTogbnVtYmVyIHtcbiAgcmV0dXJuIE1hdGgubWluKG1heCwgTWF0aC5tYXgobWluLCB2YWx1ZSkpO1xufVxyXG5cclxuXHJcbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLElBQUFBLG1CQU1POzs7QUNLQSxJQUFNLG1CQUFtQjtBQUN6QixJQUFNLHVCQUF1QjtBQUM3QixJQUFNLGlCQUFpQjtBQUFBLEVBQzVCO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUNGO0FBRU8sSUFBTSxlQUF3RTtBQUFBLEVBQ25GLEtBQUssRUFBRSxPQUFPLEdBQUcsU0FBUyxFQUFFO0FBQUEsRUFDNUIsUUFBUSxFQUFFLE9BQU8sR0FBRyxTQUFTLEtBQUs7QUFBQSxFQUNsQyxRQUFRLEVBQUUsT0FBTyxJQUFJLFNBQVMsS0FBSztBQUNyQztBQUVPLFNBQVMsU0FBUyxRQUF3QjtBQUMvQyxTQUFPLEdBQUcsTUFBTSxJQUFJLEtBQUssT0FBTyxFQUFFLFNBQVMsRUFBRSxFQUFFLE1BQU0sR0FBRyxFQUFFLENBQUM7QUFDN0Q7QUFFTyxTQUFTLFlBQVksT0FBTyxXQUE0QjtBQUM3RCxTQUFPO0FBQUEsSUFDTCxJQUFJLFNBQVMsT0FBTztBQUFBLElBQ3BCO0FBQUEsSUFDQSxTQUFTO0FBQUEsSUFDVCxRQUFRO0FBQUEsRUFDVjtBQUNGO0FBRU8sU0FBUyxxQkFBcUIsU0FBcUM7QUFDeEUsU0FBTztBQUFBLElBQ0wsWUFBWTtBQUFBLElBQ1osYUFBYSxlQUFlLENBQUM7QUFBQSxJQUM3QixXQUFXLGFBQWEsSUFBSTtBQUFBLElBQzVCLFNBQVMsYUFBYSxJQUFJO0FBQUEsSUFDMUIsZUFBZTtBQUFBLEVBQ2pCO0FBQ0Y7QUFFTyxTQUFTLHFCQUE2QztBQUMzRCxRQUFNLFFBQVEsWUFBWTtBQUMxQixTQUFPO0FBQUEsSUFDTCxJQUFJLFNBQVMsT0FBTztBQUFBLElBQ3BCLFFBQVEsQ0FBQyxLQUFLO0FBQUEsSUFDZCxPQUFPLENBQUM7QUFBQSxJQUNSLFVBQVU7QUFBQSxNQUNSLEdBQUc7QUFBQSxNQUNILEdBQUc7QUFBQSxNQUNILE1BQU07QUFBQSxJQUNSO0FBQUEsSUFDQSxJQUFJLHFCQUFxQixNQUFNLEVBQUU7QUFBQSxFQUNuQztBQUNGO0FBRU8sU0FBUyxXQUFXLEtBQXFDO0FBQzlELFFBQU0sU0FBUyxLQUFLLE1BQU0sR0FBRztBQUk3QixNQUFJLE1BQU0sUUFBUSxPQUFPLEtBQUssR0FBRztBQUMvQixXQUFPLGlCQUFpQixPQUFPLE9BQU8sT0FBTyxVQUFVLE9BQU8sRUFBRTtBQUFBLEVBQ2xFO0FBRUEsUUFBTSxTQUFTLE1BQU0sUUFBUSxPQUFPLE1BQU0sSUFDdEMsT0FBTyxPQUNKLE9BQU8sQ0FBQyxVQUFvQyxRQUFRLFNBQVMsT0FBTyxNQUFNLE9BQU8sUUFBUSxDQUFDLEVBQzFGLElBQUksQ0FBQyxPQUFPLFdBQVc7QUFBQSxJQUN0QixJQUFJLE1BQU07QUFBQSxJQUNWLE1BQU0sT0FBTyxNQUFNLFNBQVMsV0FBVyxNQUFNLE9BQU8sU0FBUyxRQUFRLENBQUM7QUFBQSxJQUN0RSxTQUFTLE1BQU0sWUFBWTtBQUFBLElBQzNCLFFBQVEsTUFBTSxXQUFXO0FBQUEsRUFDM0IsRUFBRSxJQUNKLENBQUM7QUFFTCxRQUFNLGFBQWEsT0FBTyxTQUFTLElBQUksU0FBUyxDQUFDLFlBQVksQ0FBQztBQUM5RCxRQUFNLFdBQVcsSUFBSSxJQUFJLFdBQVcsSUFBSSxDQUFDLFVBQVUsTUFBTSxFQUFFLENBQUM7QUFFNUQsUUFBTSxRQUFRLE1BQU0sUUFBUSxPQUFPLEtBQUssSUFDcEMsT0FBTyxNQUNKLE9BQU8sQ0FBQyxTQUFpQyxRQUFRLFFBQVEsT0FBTyxLQUFLLE9BQU8sWUFBWSxPQUFPLEtBQUssU0FBUyxRQUFRLENBQUMsRUFDdEgsSUFBSSxDQUFDLFNBQVMsY0FBYyxNQUFNLFdBQVcsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxFQUNuRCxPQUFPLENBQUMsU0FBaUMsUUFBUSxRQUFRLFNBQVMsSUFBSSxLQUFLLE9BQU8sQ0FBQyxDQUFDLElBQ3ZGLENBQUM7QUFFTCxRQUFNLFlBQVkscUJBQXFCLFdBQVcsQ0FBQyxFQUFFLEVBQUU7QUFFdkQsU0FBTztBQUFBLElBQ0wsSUFBSSxPQUFPLE9BQU8sT0FBTyxXQUFXLE9BQU8sS0FBSyxTQUFTLE9BQU87QUFBQSxJQUNoRSxRQUFRO0FBQUEsSUFDUjtBQUFBLElBQ0EsVUFBVTtBQUFBLE1BQ1IsR0FBRyxPQUFPLE9BQU8sVUFBVSxNQUFNLFdBQVcsT0FBTyxTQUFTLElBQUk7QUFBQSxNQUNoRSxHQUFHLE9BQU8sT0FBTyxVQUFVLE1BQU0sV0FBVyxPQUFPLFNBQVMsSUFBSTtBQUFBLE1BQ2hFLE1BQU0sT0FBTyxPQUFPLFVBQVUsU0FBUyxXQUFXLE9BQU8sU0FBUyxPQUFPO0FBQUEsSUFDM0U7QUFBQSxJQUNBLElBQUk7QUFBQSxNQUNGLFlBQVksaUJBQWlCLE9BQU8sSUFBSSxVQUFVLElBQUksT0FBTyxHQUFHLGFBQWEsVUFBVTtBQUFBLE1BQ3ZGLGFBQWEsT0FBTyxPQUFPLElBQUksZ0JBQWdCLFdBQVcsT0FBTyxHQUFHLGNBQWMsVUFBVTtBQUFBLE1BQzVGLFdBQVcsT0FBTyxPQUFPLElBQUksY0FBYyxXQUFXLE9BQU8sR0FBRyxZQUFZLFVBQVU7QUFBQSxNQUN0RixTQUFTLE9BQU8sT0FBTyxJQUFJLFlBQVksV0FBVyxPQUFPLEdBQUcsVUFBVSxVQUFVO0FBQUEsTUFDaEYsZUFDRSxPQUFPLE9BQU8sSUFBSSxrQkFBa0IsWUFBWSxTQUFTLElBQUksT0FBTyxHQUFHLGFBQWEsSUFDaEYsT0FBTyxHQUFHLGdCQUNWLFVBQVU7QUFBQSxJQUNsQjtBQUFBLEVBQ0Y7QUFDRjtBQUVPLFNBQVMsZUFBZSxPQUF1QztBQUNwRSxTQUFPLEtBQUssVUFBVSxPQUFPLE1BQU0sQ0FBQztBQUN0QztBQUVPLFNBQVMsVUFBVSxPQUF1QztBQUMvRCxTQUFPLFNBQVMsZ0JBQWdCO0FBQUEsRUFBSyxlQUFlLEtBQUssQ0FBQztBQUFBO0FBQzVEO0FBRUEsU0FBUyxpQkFBaUIsT0FBeUM7QUFDakUsU0FBTyxVQUFVLFNBQVMsVUFBVSxZQUFZLFVBQVUsWUFBWSxVQUFVLFlBQVksVUFBVSxVQUFVLFVBQVUsWUFBWSxVQUFVO0FBQ2xKO0FBRUEsU0FBUyxjQUFjLE1BQXNCLGlCQUFnRDtBQUMzRixNQUFJLEtBQUssU0FBUyxVQUFVO0FBQzFCLFVBQU0sU0FBUztBQUNmLFdBQU87QUFBQSxNQUNMLElBQUksT0FBTyxNQUFNLFNBQVMsUUFBUTtBQUFBLE1BQ2xDLE1BQU07QUFBQSxNQUNOLFNBQVMsT0FBTyxPQUFPLFlBQVksV0FBVyxPQUFPLFVBQVU7QUFBQSxNQUMvRCxNQUFNLE9BQU8sU0FBUyxZQUFZLE9BQU8sU0FBUyxXQUFXLE9BQU8sT0FBTztBQUFBLE1BQzNFLE9BQU8sT0FBTyxPQUFPLFVBQVUsV0FBVyxPQUFPLFFBQVEsZUFBZSxDQUFDO0FBQUEsTUFDekUsT0FBTyxPQUFPLE9BQU8sVUFBVSxXQUFXLE9BQU8sUUFBUSxhQUFhLElBQUk7QUFBQSxNQUMxRSxTQUFTLE9BQU8sT0FBTyxZQUFZLFdBQVcsT0FBTyxVQUFVLGFBQWEsSUFBSTtBQUFBLE1BQ2hGLFFBQVEsTUFBTSxRQUFRLE9BQU8sTUFBTSxJQUMvQixPQUFPLE9BQ0osT0FBTyxDQUFDLFVBQWdFLFFBQVEsU0FBUyxPQUFPLE1BQU0sTUFBTSxZQUFZLE9BQU8sTUFBTSxNQUFNLFFBQVEsQ0FBQyxFQUNwSixJQUFJLENBQUMsV0FBVztBQUFBLFFBQ2YsR0FBRyxNQUFNO0FBQUEsUUFDVCxHQUFHLE1BQU07QUFBQSxRQUNULFVBQVUsT0FBTyxNQUFNLGFBQWEsV0FBVyxNQUFNLFdBQVc7QUFBQSxNQUNsRSxFQUFFLElBQ0osQ0FBQztBQUFBLElBQ1A7QUFBQSxFQUNGO0FBRUEsTUFBSSxLQUFLLFNBQVMsUUFBUTtBQUN4QixVQUFNLE9BQU87QUFDYixXQUFPO0FBQUEsTUFDTCxJQUFJLEtBQUssTUFBTSxTQUFTLE1BQU07QUFBQSxNQUM5QixNQUFNO0FBQUEsTUFDTixTQUFTLE9BQU8sS0FBSyxZQUFZLFdBQVcsS0FBSyxVQUFVO0FBQUEsTUFDM0QsR0FBRyxPQUFPLEtBQUssTUFBTSxXQUFXLEtBQUssSUFBSTtBQUFBLE1BQ3pDLEdBQUcsT0FBTyxLQUFLLE1BQU0sV0FBVyxLQUFLLElBQUk7QUFBQSxNQUN6QyxNQUFNLE9BQU8sS0FBSyxTQUFTLFdBQVcsS0FBSyxPQUFPO0FBQUEsTUFDbEQsT0FBTyxPQUFPLEtBQUssVUFBVSxXQUFXLEtBQUssUUFBUSxlQUFlLENBQUM7QUFBQSxNQUNyRSxNQUFNLE9BQU8sS0FBSyxTQUFTLFdBQVcsS0FBSyxPQUFPO0FBQUEsSUFDcEQ7QUFBQSxFQUNGO0FBRUEsU0FBTztBQUNUO0FBRUEsU0FBUyxpQkFDUCxPQUNBLFVBQ0EsU0FDd0I7QUFDeEIsUUFBTSxRQUFRLFlBQVk7QUFDMUIsUUFBTSxRQUFvQixNQUN2QixPQUFPLENBQUMsU0FBUyxPQUFPLEtBQUssT0FBTyxRQUFRLEVBQzVDLElBQUksQ0FBQyxVQUFVO0FBQUEsSUFDZCxJQUFJLE9BQU8sS0FBSyxFQUFFO0FBQUEsSUFDbEIsTUFBTTtBQUFBLElBQ04sU0FBUyxNQUFNO0FBQUEsSUFDZixHQUFHLE9BQU8sS0FBSyxNQUFNLFdBQVcsS0FBSyxJQUFJO0FBQUEsSUFDekMsR0FBRyxPQUFPLEtBQUssTUFBTSxXQUFXLEtBQUssSUFBSTtBQUFBLElBQ3pDLE1BQU0sT0FBTyxLQUFLLFNBQVMsV0FBVyxLQUFLLE9BQU87QUFBQSxJQUNsRCxPQUFPLE9BQU8sS0FBSyxVQUFVLFdBQVcsS0FBSyxRQUFRLGVBQWUsQ0FBQztBQUFBLElBQ3JFLE1BQU07QUFBQSxFQUNSLEVBQUU7QUFFSixTQUFPO0FBQUEsSUFDTCxJQUFJLE9BQU8sWUFBWSxXQUFXLFVBQVUsU0FBUyxPQUFPO0FBQUEsSUFDNUQsUUFBUSxDQUFDLEtBQUs7QUFBQSxJQUNkO0FBQUEsSUFDQSxVQUFVO0FBQUEsTUFDUixHQUFHLE9BQU8sVUFBVSxNQUFNLFdBQVcsU0FBUyxJQUFJO0FBQUEsTUFDbEQsR0FBRyxPQUFPLFVBQVUsTUFBTSxXQUFXLFNBQVMsSUFBSTtBQUFBLE1BQ2xELE1BQU0sT0FBTyxVQUFVLFNBQVMsV0FBVyxTQUFTLE9BQU87QUFBQSxJQUM3RDtBQUFBLElBQ0EsSUFBSSxxQkFBcUIsTUFBTSxFQUFFO0FBQUEsRUFDbkM7QUFDRjs7O0FDNU1BLHNCQUF1QjtBQTJDdkIsSUFBTSxjQUE4QztBQUFBLEVBQ2xELEtBQUs7QUFBQSxFQUNMLFFBQVE7QUFBQSxFQUNSLFFBQVE7QUFBQSxFQUNSLFFBQVE7QUFBQSxFQUNSLE1BQU07QUFBQSxFQUNOLFFBQVE7QUFBQSxFQUNSLE1BQU07QUFDUjtBQUVPLFNBQVMsZ0JBQ2QsV0FDQSxjQUNBLE1BQ2tCO0FBQ2xCLFlBQVUsTUFBTTtBQUNoQixZQUFVLFNBQVMscUJBQXFCO0FBRXhDLFFBQU0sT0FBTyxVQUFVLFVBQVUsRUFBRSxLQUFLLDZCQUE2QixDQUFDO0FBQ3RFLFFBQU0sVUFBVSxLQUFLLFVBQVUsRUFBRSxLQUFLLCtCQUErQixDQUFDO0FBQ3RFLFFBQU0sWUFBWSxLQUFLLFVBQVUsRUFBRSxLQUFLLGlDQUFpQyxDQUFDO0FBQzFFLFFBQU0sV0FBVyxVQUFVLFVBQVUsRUFBRSxLQUFLLGdDQUFnQyxDQUFDO0FBQzdFLFFBQU0sT0FBTyxTQUFTLFVBQVUsRUFBRSxLQUFLLDRCQUE0QixDQUFDO0FBQ3BFLFFBQU0sUUFBUSxTQUFTLFVBQVUsT0FBTyxFQUFFLEtBQUssNkJBQTZCLENBQUM7QUFDN0UsUUFBTSxhQUFhLFNBQVMsTUFBTTtBQUNsQyxRQUFNLGFBQWEsVUFBVSxNQUFNO0FBQ25DLFFBQU0sY0FBYyxNQUFNLFVBQVUsS0FBSyxFQUFFLEtBQUssb0NBQW9DLENBQUM7QUFDckYsUUFBTSxhQUFhLE1BQU0sVUFBVSxLQUFLLEVBQUUsS0FBSyxtQ0FBbUMsQ0FBQztBQUNuRixRQUFNLFlBQVksV0FBVyxVQUFVLFFBQVEsRUFBRSxLQUFLLGtDQUFrQyxDQUFDO0FBQ3pGLFFBQU0sWUFBWSxTQUFTLFVBQVUsRUFBRSxLQUFLLGtDQUFrQyxDQUFDO0FBQy9FLFFBQU0sVUFBVSxVQUFVLFVBQVUsRUFBRSxLQUFLLCtCQUErQixDQUFDO0FBQzNFLFFBQU0sY0FBYyxRQUFRLFVBQVUsRUFBRSxLQUFLLHNDQUFzQyxDQUFDO0FBQ3BGLGNBQVksV0FBVyxFQUFFLE1BQU0sU0FBUyxDQUFDO0FBQ3pDLFFBQU0saUJBQWlCLFlBQVksU0FBUyxVQUFVO0FBQUEsSUFDcEQsS0FBSztBQUFBLElBQ0wsTUFBTTtBQUFBLEVBQ1IsQ0FBQztBQUNELGlCQUFlLE9BQU87QUFDdEIsUUFBTSxhQUFhLFFBQVEsVUFBVSxFQUFFLEtBQUssOEJBQThCLENBQUM7QUFDM0UsUUFBTSxTQUFTLFFBQVEsVUFBVSxFQUFFLEtBQUssK0JBQStCLE1BQU0sUUFBUSxDQUFDO0FBRXRGLE1BQUksUUFBUSxnQkFBZ0IsWUFBWTtBQUN4QyxNQUFJLE1BQU0sT0FBTyxXQUFXLEdBQUc7QUFDN0IsWUFBUSxtQkFBbUI7QUFBQSxFQUM3QjtBQUVBLE1BQUksYUFBNkIsTUFBTSxHQUFHO0FBQzFDLE1BQUksY0FBYyxNQUFNLEdBQUc7QUFDM0IsTUFBSSxZQUFZLE1BQU0sR0FBRztBQUN6QixNQUFJLFVBQVUsTUFBTSxHQUFHO0FBQ3ZCLE1BQUksZ0JBQWdCLE1BQU0sR0FBRyxpQkFBaUIsTUFBTSxPQUFPLENBQUMsRUFBRTtBQUM5RCxNQUFJLGlCQUFnQztBQUNwQyxNQUFJLGNBQTJCLEVBQUUsTUFBTSxPQUFPO0FBQzlDLE1BQUksY0FBaUM7QUFDckMsTUFBSSxZQUEyQjtBQUMvQixNQUFJLFlBQVk7QUFDaEIsTUFBSSxtQkFBK0M7QUFDbkQsTUFBSSxVQUFVLENBQUMsZ0JBQWdCLEtBQUssQ0FBQztBQUNyQyxNQUFJLGVBQWU7QUFFbkIsUUFBTSxjQUFjLG9CQUFJLElBQXVDO0FBQy9ELFFBQU0sYUFBYSxRQUFRLFNBQVMsVUFBVSxFQUFFLEtBQUssK0JBQStCLE1BQU0sT0FBTyxDQUFDO0FBQ2xHLGFBQVcsT0FBTztBQUNsQixRQUFNLGFBQWEsUUFBUSxTQUFTLFVBQVUsRUFBRSxLQUFLLCtCQUErQixNQUFNLE9BQU8sQ0FBQztBQUNsRyxhQUFXLE9BQU87QUFFbEIsUUFBTSxZQUE4QixDQUFDLE9BQU8sVUFBVSxVQUFVLFVBQVUsUUFBUSxVQUFVLE1BQU07QUFDbEcsYUFBVyxRQUFRLFdBQVc7QUFDNUIsVUFBTSxTQUFTLFFBQVEsU0FBUyxVQUFVO0FBQUEsTUFDeEMsS0FBSztBQUFBLE1BQ0wsTUFBTSxZQUFZLElBQUk7QUFBQSxJQUN4QixDQUFDO0FBQ0QsV0FBTyxPQUFPO0FBQ2QsV0FBTyxpQkFBaUIsU0FBUyxNQUFNLGNBQWMsSUFBSSxDQUFDO0FBQzFELGdCQUFZLElBQUksTUFBTSxNQUFNO0FBQUEsRUFDOUI7QUFFQSxRQUFNLGFBQWEsUUFBUSxTQUFTLFNBQVMsRUFBRSxLQUFLLG1DQUFtQyxDQUFDO0FBQ3hGLGFBQVcsT0FBTztBQUNsQixhQUFXLFFBQVE7QUFFbkIsUUFBTSxXQUFXLFFBQVEsVUFBVSxFQUFFLEtBQUssZ0NBQWdDLENBQUM7QUFDM0UsYUFBVyxTQUFTLGdCQUFnQjtBQUNsQyxVQUFNLFNBQVMsU0FBUyxTQUFTLFVBQVUsRUFBRSxLQUFLLDhCQUE4QixDQUFDO0FBQ2pGLFdBQU8sT0FBTztBQUNkLFdBQU8sTUFBTSxrQkFBa0I7QUFDL0IsV0FBTyxpQkFBaUIsU0FBUyxNQUFNO0FBQ3JDLG9CQUFjO0FBQ2QsaUJBQVcsUUFBUTtBQUNuQixrQkFBWTtBQUNaLG9CQUFjO0FBQUEsSUFDaEIsQ0FBQztBQUFBLEVBQ0g7QUFFQSxRQUFNLFlBQVksUUFBUSxTQUFTLFNBQVMsRUFBRSxLQUFLLDZCQUE2QixDQUFDO0FBQ2pGLFlBQVUsT0FBTztBQUNqQixZQUFVLE1BQU07QUFDaEIsWUFBVSxNQUFNO0FBQ2hCLFlBQVUsUUFBUSxPQUFPLFNBQVM7QUFFbEMsUUFBTSxlQUFlLFFBQVEsU0FBUyxTQUFTLEVBQUUsS0FBSyw2QkFBNkIsQ0FBQztBQUNwRixlQUFhLE9BQU87QUFDcEIsZUFBYSxNQUFNO0FBQ25CLGVBQWEsTUFBTTtBQUNuQixlQUFhLE9BQU87QUFDcEIsZUFBYSxRQUFRLE9BQU8sT0FBTztBQUVuQyxVQUFRLFlBQVksTUFBTTtBQUMxQixXQUFTLE1BQU0sWUFBWSxHQUFHLG9CQUFvQjtBQUVsRCxhQUFXLGlCQUFpQixTQUFTLE1BQU0sS0FBSyxDQUFDO0FBQ2pELGFBQVcsaUJBQWlCLFNBQVMsTUFBTSxLQUFLLENBQUM7QUFDakQsaUJBQWUsaUJBQWlCLFNBQVMsTUFBTSxTQUFTLENBQUM7QUFDekQsYUFBVyxpQkFBaUIsU0FBUyxNQUFNO0FBQ3pDLGtCQUFjLFdBQVc7QUFDekIsZ0JBQVk7QUFBQSxFQUNkLENBQUM7QUFDRCxZQUFVLGlCQUFpQixTQUFTLE1BQU07QUFDeEMsZ0JBQVksT0FBTyxVQUFVLEtBQUs7QUFDbEMsZ0JBQVk7QUFBQSxFQUNkLENBQUM7QUFDRCxlQUFhLGlCQUFpQixTQUFTLE1BQU07QUFDM0MsY0FBVSxPQUFPLGFBQWEsS0FBSztBQUNuQyxnQkFBWTtBQUFBLEVBQ2QsQ0FBQztBQUVELFdBQVMsY0FBb0I7QUFDM0IsVUFBTSxHQUFHLGFBQWE7QUFDdEIsVUFBTSxHQUFHLGNBQWM7QUFDdkIsVUFBTSxHQUFHLFlBQVk7QUFDckIsVUFBTSxHQUFHLFVBQVU7QUFDbkIsVUFBTSxHQUFHLGdCQUFnQjtBQUFBLEVBQzNCO0FBRUEsV0FBUyxjQUFjLE1BQTRCO0FBQ2pELGlCQUFhO0FBQ2IsUUFBSSxTQUFTLFNBQVMsU0FBUyxZQUFZLFNBQVMsVUFBVTtBQUM1RCxrQkFBWSxhQUFhLElBQUksRUFBRTtBQUMvQixnQkFBVSxhQUFhLElBQUksRUFBRTtBQUM3QixnQkFBVSxRQUFRLE9BQU8sU0FBUztBQUNsQyxtQkFBYSxRQUFRLE9BQU8sT0FBTztBQUFBLElBQ3JDO0FBQ0EsZ0JBQVk7QUFDWixrQkFBYztBQUNkLGlCQUFhLEdBQUcsWUFBWSxJQUFJLENBQUMsUUFBUTtBQUFBLEVBQzNDO0FBRUEsV0FBUyxnQkFBc0I7QUFDN0IsZUFBVyxDQUFDLE1BQU0sTUFBTSxLQUFLLGFBQWE7QUFDeEMsYUFBTyxZQUFZLGFBQWEsU0FBUyxVQUFVO0FBQUEsSUFDckQ7QUFDQSxlQUFXLFdBQVcsaUJBQWlCO0FBQ3ZDLGVBQVcsV0FBVyxpQkFBaUIsUUFBUSxTQUFTO0FBQUEsRUFDMUQ7QUFFQSxXQUFTLGFBQWEsVUFBVSxTQUFlO0FBQzdDLFdBQU8sUUFBUSxPQUFPO0FBQUEsRUFDeEI7QUFFQSxXQUFTLFlBQWtCO0FBQ3pCLFFBQUksV0FBVztBQUNiO0FBQUEsSUFDRjtBQUVBLFFBQUksY0FBYyxNQUFNO0FBQ3RCLGFBQU8sYUFBYSxTQUFTO0FBQUEsSUFDL0I7QUFFQSxnQkFBWSxPQUFPLFdBQVcsWUFBWTtBQUN4QyxrQkFBWTtBQUNaLFVBQUk7QUFDRixjQUFNLEtBQUssS0FBSyxnQkFBZ0IsS0FBSyxDQUFDO0FBQ3RDLHFCQUFhLE9BQU87QUFBQSxNQUN0QixTQUFTLE9BQU87QUFDZCxnQkFBUSxNQUFNLEtBQUs7QUFDbkIsWUFBSSx1QkFBTyxvQ0FBb0M7QUFDL0MscUJBQWEsYUFBYTtBQUFBLE1BQzVCO0FBQUEsSUFDRixHQUFHLEdBQUc7QUFBQSxFQUNSO0FBRUEsV0FBUyxjQUFvQjtBQUMzQixVQUFNLFdBQVcsZ0JBQWdCLEtBQUs7QUFDdEMsY0FBVSxRQUFRLE1BQU0sR0FBRyxlQUFlLENBQUM7QUFDM0MsWUFBUSxLQUFLLFFBQVE7QUFDckIsbUJBQWUsUUFBUSxTQUFTO0FBQ2hDLGtCQUFjO0FBQUEsRUFDaEI7QUFFQSxXQUFTLE9BQWE7QUFDcEIsUUFBSSxpQkFBaUIsR0FBRztBQUN0QjtBQUFBLElBQ0Y7QUFDQSxvQkFBZ0I7QUFDaEIsWUFBUSxnQkFBZ0IsUUFBUSxZQUFZLENBQUM7QUFDN0Msc0JBQWtCO0FBQ2xCLHFCQUFpQjtBQUNqQixnQkFBWTtBQUNaLGNBQVU7QUFBQSxFQUNaO0FBRUEsV0FBUyxPQUFhO0FBQ3BCLFFBQUksZ0JBQWdCLFFBQVEsU0FBUyxHQUFHO0FBQ3RDO0FBQUEsSUFDRjtBQUNBLG9CQUFnQjtBQUNoQixZQUFRLGdCQUFnQixRQUFRLFlBQVksQ0FBQztBQUM3QyxzQkFBa0I7QUFDbEIscUJBQWlCO0FBQ2pCLGdCQUFZO0FBQ1osY0FBVTtBQUFBLEVBQ1o7QUFFQSxXQUFTLG9CQUEwQjtBQUNqQyxRQUFJLENBQUMsTUFBTSxPQUFPLEtBQUssQ0FBQyxVQUFVLE1BQU0sT0FBTyxhQUFhLEdBQUc7QUFDN0Qsc0JBQWdCLE1BQU0sT0FBTyxDQUFDLEdBQUcsTUFBTSxtQkFBbUIsRUFBRSxPQUFPLENBQUMsRUFBRTtBQUFBLElBQ3hFO0FBQUEsRUFDRjtBQUVBLFdBQVMsU0FBUyxTQUE4QztBQUM5RCxXQUFPLE1BQU0sT0FBTyxLQUFLLENBQUMsVUFBVSxNQUFNLE9BQU8sT0FBTztBQUFBLEVBQzFEO0FBRUEsV0FBUyxRQUFRLFFBQTRDO0FBQzNELFdBQU8sTUFBTSxNQUFNLEtBQUssQ0FBQyxTQUFTLEtBQUssT0FBTyxNQUFNO0FBQUEsRUFDdEQ7QUFFQSxXQUFTLGVBQWUsU0FBMEI7QUFDaEQsV0FBTyxTQUFTLE9BQU8sR0FBRyxZQUFZO0FBQUEsRUFDeEM7QUFFQSxXQUFTLGNBQWMsU0FBMEI7QUFDL0MsV0FBTyxTQUFTLE9BQU8sR0FBRyxXQUFXO0FBQUEsRUFDdkM7QUFFQSxXQUFTLGdCQUFzQjtBQUM3QixVQUFNLE1BQU0sWUFBWSxhQUFhLE1BQU0sU0FBUyxDQUFDLE9BQU8sTUFBTSxTQUFTLENBQUMsYUFBYSxNQUFNLFNBQVMsSUFBSTtBQUM1RyxjQUFVLE1BQU0sWUFBWSxhQUFhLE1BQU0sU0FBUyxDQUFDLE9BQU8sTUFBTSxTQUFTLENBQUMsYUFBYSxNQUFNLFNBQVMsSUFBSTtBQUNoSCxVQUFNLFdBQVcsS0FBSyxNQUFNLFNBQVM7QUFDckMsU0FBSyxNQUFNLGlCQUFpQixHQUFHLFFBQVEsTUFBTSxRQUFRO0FBQ3JELFNBQUssTUFBTSxxQkFBcUIsR0FBRyxNQUFNLFNBQVMsQ0FBQyxNQUFNLE1BQU0sU0FBUyxDQUFDO0FBQUEsRUFDM0U7QUFFQSxXQUFTLGVBQXFCO0FBQzVCLGVBQVcsTUFBTTtBQUVqQixlQUFXLFNBQVMsQ0FBQyxHQUFHLE1BQU0sTUFBTSxFQUFFLFFBQVEsR0FBRztBQUMvQyxZQUFNLE1BQU0sV0FBVyxVQUFVLEVBQUUsS0FBSyxpQ0FBaUMsQ0FBQztBQUMxRSxVQUFJLFlBQVksYUFBYSxNQUFNLE9BQU8sYUFBYTtBQUV2RCxZQUFNLG1CQUFtQixJQUFJLFNBQVMsVUFBVTtBQUFBLFFBQzlDLEtBQUs7QUFBQSxRQUNMLE1BQU0sTUFBTSxVQUFVLFNBQVM7QUFBQSxNQUNqQyxDQUFDO0FBQ0QsdUJBQWlCLE9BQU87QUFDeEIsdUJBQWlCLGlCQUFpQixTQUFTLE1BQU07QUFDL0MsY0FBTSxVQUFVLENBQUMsTUFBTTtBQUN2QixvQkFBWTtBQUNaLG9CQUFZO0FBQ1osa0JBQVU7QUFBQSxNQUNaLENBQUM7QUFFRCxZQUFNLGFBQWEsSUFBSSxTQUFTLFVBQVU7QUFBQSxRQUN4QyxLQUFLO0FBQUEsUUFDTCxNQUFNLE1BQU0sU0FBUyxXQUFXO0FBQUEsTUFDbEMsQ0FBQztBQUNELGlCQUFXLE9BQU87QUFDbEIsaUJBQVcsaUJBQWlCLFNBQVMsTUFBTTtBQUN6QyxjQUFNLFNBQVMsQ0FBQyxNQUFNO0FBQ3RCLG9CQUFZO0FBQ1osb0JBQVk7QUFDWixrQkFBVTtBQUFBLE1BQ1osQ0FBQztBQUVELFlBQU0sYUFBYSxJQUFJLFNBQVMsVUFBVTtBQUFBLFFBQ3hDLEtBQUs7QUFBQSxRQUNMLE1BQU0sTUFBTTtBQUFBLE1BQ2QsQ0FBQztBQUNELGlCQUFXLE9BQU87QUFDbEIsaUJBQVcsaUJBQWlCLFNBQVMsTUFBTTtBQUN6Qyx3QkFBZ0IsTUFBTTtBQUN0QixvQkFBWTtBQUNaLHFCQUFhO0FBQ2IscUJBQWEsaUJBQWlCLE1BQU0sSUFBSSxFQUFFO0FBQUEsTUFDNUMsQ0FBQztBQUFBLElBQ0g7QUFBQSxFQUNGO0FBRUEsV0FBUyxjQUFvQjtBQUMzQixzQkFBa0I7QUFDbEIsa0JBQWM7QUFDZCxnQkFBWTtBQUNaLGlCQUFhO0FBQ2Isa0JBQWM7QUFBQSxFQUNoQjtBQUVBLFdBQVMsY0FBb0I7QUFDM0IsZ0JBQVksTUFBTTtBQUNsQixjQUFVLE1BQU07QUFFaEIsZUFBVyxRQUFRLE1BQU0sT0FBTztBQUM5QixVQUFJLENBQUMsZUFBZSxLQUFLLE9BQU8sR0FBRztBQUNqQztBQUFBLE1BQ0Y7QUFFQSxVQUFJLEtBQUssU0FBUyxVQUFVO0FBQzFCLGNBQU0sT0FBTyxZQUFZLFVBQVUsUUFBUSxFQUFFLEtBQUssOEJBQThCLENBQUM7QUFDakYsYUFBSyxhQUFhLEtBQUssYUFBYSxLQUFLLE1BQU0sQ0FBQztBQUNoRCxhQUFLLGFBQWEsVUFBVSxLQUFLLEtBQUs7QUFDdEMsYUFBSyxhQUFhLGdCQUFnQixPQUFPLEtBQUssS0FBSyxDQUFDO0FBQ3BELGFBQUssYUFBYSxrQkFBa0IsT0FBTztBQUMzQyxhQUFLLGFBQWEsbUJBQW1CLE9BQU87QUFDNUMsYUFBSyxhQUFhLFFBQVEsTUFBTTtBQUNoQyxhQUFLLE1BQU0sVUFBVSxPQUFPLEtBQUssT0FBTztBQUN4QyxhQUFLLFFBQVEsU0FBUyxLQUFLO0FBQzNCLGFBQUssUUFBUSxPQUFPLEtBQUs7QUFDekIsYUFBSyxZQUFZLGVBQWUsS0FBSyxPQUFPLGNBQWM7QUFBQSxNQUM1RCxPQUFPO0FBQ0wsY0FBTSxTQUFTLFVBQVUsVUFBVSxFQUFFLEtBQUssaUNBQWlDLENBQUM7QUFDNUUsZUFBTyxRQUFRLFNBQVMsS0FBSztBQUM3QixlQUFPLE1BQU0sT0FBTyxHQUFHLEtBQUssQ0FBQztBQUM3QixlQUFPLE1BQU0sTUFBTSxHQUFHLEtBQUssQ0FBQztBQUM1QixlQUFPLE1BQU0sUUFBUSxLQUFLO0FBQzFCLGVBQU8sTUFBTSxXQUFXLEdBQUcsS0FBSyxJQUFJO0FBQ3BDLGVBQU8sTUFBTSxhQUFhO0FBQzFCLGVBQU8sUUFBUSxLQUFLLFFBQVEsTUFBTTtBQUNsQyxlQUFPLFlBQVksZUFBZSxLQUFLLE9BQU8sY0FBYztBQUFBLE1BQzlEO0FBQUEsSUFDRjtBQUFBLEVBQ0Y7QUFFQSxXQUFTLG9CQUEwQjtBQUNqQyxRQUFJLENBQUMsYUFBYTtBQUNoQixnQkFBVSxhQUFhLEtBQUssRUFBRTtBQUM5QjtBQUFBLElBQ0Y7QUFFQSxjQUFVLGFBQWEsS0FBSyxhQUFhLFlBQVksTUFBTSxDQUFDO0FBQzVELGNBQVUsYUFBYSxVQUFVLFlBQVksS0FBSztBQUNsRCxjQUFVLGFBQWEsZ0JBQWdCLE9BQU8sWUFBWSxLQUFLLENBQUM7QUFDaEUsY0FBVSxhQUFhLGtCQUFrQixPQUFPO0FBQ2hELGNBQVUsYUFBYSxtQkFBbUIsT0FBTztBQUNqRCxjQUFVLGFBQWEsUUFBUSxNQUFNO0FBQ3JDLGNBQVUsTUFBTSxVQUFVLE9BQU8sWUFBWSxPQUFPO0FBQUEsRUFDdEQ7QUFFQSxXQUFTLG9CQUEwQjtBQUNqQyxRQUFJLGtCQUFrQjtBQUNwQixVQUFJLGlCQUFpQixhQUFhO0FBQ2hDLHlCQUFpQixPQUFPO0FBQUEsTUFDMUI7QUFDQSx5QkFBbUI7QUFBQSxJQUNyQjtBQUFBLEVBQ0Y7QUFFQSxXQUFTLGVBQWUsT0FBaUMsVUFBMkI7QUFDbEYsc0JBQWtCO0FBRWxCLFVBQU0sU0FBUyxVQUFVLFNBQVMsWUFBWSxFQUFFLEtBQUssbUNBQW1DLENBQUM7QUFDekYsV0FBTyxRQUFRLFVBQVUsUUFBUTtBQUNqQyxXQUFPLE1BQU0sT0FBTyxHQUFHLFVBQVUsS0FBSyxNQUFNLENBQUM7QUFDN0MsV0FBTyxNQUFNLE1BQU0sR0FBRyxVQUFVLEtBQUssTUFBTSxDQUFDO0FBQzVDLFdBQU8sTUFBTSxRQUFRLFVBQVUsU0FBUztBQUN4QyxXQUFPLE1BQU0sV0FBVyxHQUFHLFVBQVUsUUFBUSxFQUFFO0FBQy9DLHVCQUFtQjtBQUNuQixXQUFPLE1BQU07QUFFYixVQUFNLFNBQVMsTUFBWTtBQUN6QixZQUFNLE9BQU8sT0FBTyxNQUFNLFFBQVE7QUFDbEMsWUFBTSxTQUFTLFlBQVk7QUFBQSxRQUN6QixJQUFJLFNBQVMsTUFBTTtBQUFBLFFBQ25CLE1BQU07QUFBQSxRQUNOLFNBQVM7QUFBQSxRQUNULEdBQUcsTUFBTTtBQUFBLFFBQ1QsR0FBRyxNQUFNO0FBQUEsUUFDVCxNQUFNO0FBQUEsUUFDTixPQUFPO0FBQUEsUUFDUCxNQUFNO0FBQUEsTUFDUjtBQUVBLFVBQUksS0FBSyxLQUFLLEVBQUUsV0FBVyxHQUFHO0FBQzVCLDBCQUFrQjtBQUNsQixvQkFBWTtBQUNaO0FBQUEsTUFDRjtBQUVBLGFBQU8sT0FBTztBQUNkLGFBQU8sUUFBUSxVQUFVLFNBQVM7QUFDbEMsYUFBTyxPQUFPLFVBQVUsUUFBUTtBQUVoQyxVQUFJLENBQUMsVUFBVTtBQUNiLGNBQU0sTUFBTSxLQUFLLE1BQU07QUFBQSxNQUN6QjtBQUVBLHdCQUFrQjtBQUNsQix1QkFBaUIsT0FBTztBQUN4QixrQkFBWTtBQUNaLGtCQUFZO0FBQ1osZ0JBQVU7QUFBQSxJQUNaO0FBRUEsV0FBTyxpQkFBaUIsUUFBUSxRQUFRLEVBQUUsTUFBTSxLQUFLLENBQUM7QUFDdEQsV0FBTyxpQkFBaUIsV0FBVyxDQUFDLFVBQVU7QUFDNUMsV0FBSyxNQUFNLFdBQVcsTUFBTSxZQUFZLE1BQU0sUUFBUSxTQUFTO0FBQzdELGVBQU8sS0FBSztBQUFBLE1BQ2Q7QUFBQSxJQUNGLENBQUM7QUFBQSxFQUNIO0FBRUEsV0FBUyxXQUFpQjtBQUN4QixVQUFNLFFBQXlCO0FBQUEsTUFDN0IsSUFBSSxTQUFTLE9BQU87QUFBQSxNQUNwQixNQUFNLFNBQVMsTUFBTSxPQUFPLFNBQVMsQ0FBQztBQUFBLE1BQ3RDLFNBQVM7QUFBQSxNQUNULFFBQVE7QUFBQSxJQUNWO0FBQ0EsVUFBTSxPQUFPLEtBQUssS0FBSztBQUN2QixvQkFBZ0IsTUFBTTtBQUN0QixnQkFBWTtBQUNaLGlCQUFhO0FBQ2IsZ0JBQVk7QUFDWixjQUFVO0FBQUEsRUFDWjtBQUVBLFdBQVMsY0FBYyxPQUErQztBQUNwRSxVQUFNLFNBQVMsU0FBUyxzQkFBc0I7QUFDOUMsV0FBTztBQUFBLE1BQ0wsSUFBSSxNQUFNLFVBQVUsT0FBTyxPQUFPLE1BQU0sU0FBUyxLQUFLLE1BQU0sU0FBUztBQUFBLE1BQ3JFLElBQUksTUFBTSxVQUFVLE9BQU8sTUFBTSxNQUFNLFNBQVMsS0FBSyxNQUFNLFNBQVM7QUFBQSxJQUN0RTtBQUFBLEVBQ0Y7QUFFQSxXQUFTLFlBQVksT0FBaUMsT0FBMkI7QUFDL0UsUUFBSSxjQUFjLGFBQWEsR0FBRztBQUNoQyxtQkFBYSx3QkFBd0I7QUFDckM7QUFBQSxJQUNGO0FBRUEsVUFBTSxPQUFPLGVBQWUsU0FBUyxlQUFlLFlBQVksZUFBZSxXQUFXLGFBQWE7QUFDdkcsa0JBQWM7QUFBQSxNQUNaLElBQUksU0FBUyxRQUFRO0FBQUEsTUFDckIsTUFBTTtBQUFBLE1BQ04sU0FBUztBQUFBLE1BQ1Q7QUFBQSxNQUNBLE9BQU87QUFBQSxNQUNQLE9BQU87QUFBQSxNQUNQO0FBQUEsTUFDQSxRQUFRO0FBQUEsUUFDTjtBQUFBLFVBQ0UsR0FBRyxNQUFNO0FBQUEsVUFDVCxHQUFHLE1BQU07QUFBQSxVQUNULFVBQVUsa0JBQWtCLE1BQU0sUUFBUTtBQUFBLFFBQzVDO0FBQUEsTUFDRjtBQUFBLElBQ0Y7QUFDQSxrQkFBYyxFQUFFLE1BQU0sUUFBUSxXQUFXLE1BQU0sVUFBVTtBQUN6RCxzQkFBa0I7QUFBQSxFQUNwQjtBQUVBLFdBQVMsZUFBcUI7QUFDNUIsUUFBSSxDQUFDLGFBQWE7QUFDaEI7QUFBQSxJQUNGO0FBQ0EsUUFBSSxZQUFZLE9BQU8sU0FBUyxHQUFHO0FBQ2pDLFlBQU0sTUFBTSxLQUFLLFdBQVc7QUFDNUIsdUJBQWlCLFlBQVk7QUFDN0Isa0JBQVk7QUFDWixnQkFBVTtBQUFBLElBQ1o7QUFDQSxrQkFBYztBQUNkLHNCQUFrQjtBQUNsQixnQkFBWTtBQUFBLEVBQ2Q7QUFFQSxXQUFTLFFBQVEsT0FBMEM7QUFDekQsVUFBTSxPQUFPLFFBQVEsT0FBTyxJQUFJO0FBQ2hDLFFBQUksQ0FBQyxNQUFNO0FBQ1QsYUFBTztBQUFBLElBQ1Q7QUFFQSxVQUFNLFFBQVEsTUFBTSxNQUFNLE9BQU8sQ0FBQyxjQUFjLFVBQVUsT0FBTyxLQUFLLEVBQUU7QUFDeEUsUUFBSSxtQkFBbUIsS0FBSyxJQUFJO0FBQzlCLHVCQUFpQjtBQUFBLElBQ25CO0FBQ0EsZ0JBQVk7QUFDWixXQUFPO0FBQUEsRUFDVDtBQUVBLFdBQVMsUUFBUSxPQUFpQyxlQUFlLE9BQThCO0FBQzdGLGVBQVcsUUFBUSxDQUFDLEdBQUcsTUFBTSxLQUFLLEVBQUUsUUFBUSxHQUFHO0FBQzdDLFVBQUksQ0FBQyxlQUFlLEtBQUssT0FBTyxHQUFHO0FBQ2pDO0FBQUEsTUFDRjtBQUNBLFVBQUksQ0FBQyxnQkFBZ0IsY0FBYyxLQUFLLE9BQU8sR0FBRztBQUNoRDtBQUFBLE1BQ0Y7QUFFQSxVQUFJLEtBQUssU0FBUyxRQUFRO0FBQ3hCLFlBQ0UsTUFBTSxLQUFLLEtBQUssSUFBSSxLQUNwQixNQUFNLEtBQUssS0FBSyxJQUFJLE9BQ3BCLE1BQU0sS0FBSyxLQUFLLElBQUksS0FDcEIsTUFBTSxLQUFLLEtBQUssSUFBSSxJQUNwQjtBQUNBLGlCQUFPO0FBQUEsUUFDVDtBQUFBLE1BQ0YsV0FBVyxrQkFBa0IsT0FBTyxJQUFJLEdBQUc7QUFDekMsZUFBTztBQUFBLE1BQ1Q7QUFBQSxJQUNGO0FBRUEsV0FBTztBQUFBLEVBQ1Q7QUFFQSxXQUFTLFVBQVUsTUFBc0IsT0FBaUMsT0FBMkI7QUFDbkcsUUFBSSxLQUFLLFNBQVMsUUFBUTtBQUN4QixvQkFBYztBQUFBLFFBQ1osTUFBTTtBQUFBLFFBQ04sV0FBVyxNQUFNO0FBQUEsUUFDakIsUUFBUSxLQUFLO0FBQUEsUUFDYixRQUFRLE1BQU07QUFBQSxRQUNkLFFBQVEsTUFBTTtBQUFBLFFBQ2QsWUFBWSxFQUFFLEdBQUcsS0FBSyxHQUFHLEdBQUcsS0FBSyxFQUFFO0FBQUEsTUFDckM7QUFDQTtBQUFBLElBQ0Y7QUFFQSxrQkFBYztBQUFBLE1BQ1osTUFBTTtBQUFBLE1BQ04sV0FBVyxNQUFNO0FBQUEsTUFDakIsUUFBUSxLQUFLO0FBQUEsTUFDYixRQUFRLE1BQU07QUFBQSxNQUNkLFFBQVEsTUFBTTtBQUFBLE1BQ2QsY0FBYyxLQUFLLE9BQU8sSUFBSSxDQUFDLGFBQWEsRUFBRSxHQUFHLFFBQVEsRUFBRTtBQUFBLElBQzdEO0FBQUEsRUFDRjtBQUVBLFdBQVMsY0FBYyxNQUE4QyxPQUF1QztBQUMxRyxVQUFNLE9BQU8sUUFBUSxLQUFLLE1BQU07QUFDaEMsUUFBSSxDQUFDLE1BQU07QUFDVDtBQUFBLElBQ0Y7QUFFQSxVQUFNLEtBQUssTUFBTSxJQUFJLEtBQUs7QUFDMUIsVUFBTSxLQUFLLE1BQU0sSUFBSSxLQUFLO0FBRTFCLFFBQUksS0FBSyxTQUFTLFVBQVUsS0FBSyxZQUFZO0FBQzNDLFdBQUssSUFBSSxLQUFLLFdBQVcsSUFBSTtBQUM3QixXQUFLLElBQUksS0FBSyxXQUFXLElBQUk7QUFBQSxJQUMvQjtBQUVBLFFBQUksS0FBSyxTQUFTLFlBQVksS0FBSyxjQUFjO0FBQy9DLFdBQUssU0FBUyxLQUFLLGFBQWEsSUFBSSxDQUFDLFlBQVk7QUFBQSxRQUMvQyxHQUFHLE9BQU8sSUFBSTtBQUFBLFFBQ2QsR0FBRyxPQUFPLElBQUk7QUFBQSxRQUNkLFVBQVUsT0FBTztBQUFBLE1BQ25CLEVBQUU7QUFBQSxJQUNKO0FBRUEsZ0JBQVk7QUFBQSxFQUNkO0FBRUEsV0FBUyxpQkFBaUIsZUFBZSxDQUFDLFVBQVU7QUFDbEQsc0JBQWtCO0FBQ2xCLGFBQVMsa0JBQWtCLE1BQU0sU0FBUztBQUMxQyxVQUFNLFFBQVEsY0FBYyxLQUFLO0FBQ2pDLFVBQU0sYUFBYyxNQUFNLE9BQXVCLFFBQXFCLGlDQUFpQztBQUN2RyxVQUFNLGVBQWUsWUFBWSxRQUFRLFNBQVMsUUFBUSxXQUFXLFFBQVEsTUFBTSxJQUFJLFFBQVEsS0FBSztBQUVwRyxRQUFJLGVBQWUsVUFBVSxNQUFNLFdBQVcsR0FBRztBQUMvQyxvQkFBYztBQUFBLFFBQ1osTUFBTTtBQUFBLFFBQ04sUUFBUSxNQUFNO0FBQUEsUUFDZCxRQUFRLE1BQU07QUFBQSxRQUNkLFNBQVMsTUFBTSxTQUFTO0FBQUEsUUFDeEIsU0FBUyxNQUFNLFNBQVM7QUFBQSxNQUMxQjtBQUNBO0FBQUEsSUFDRjtBQUVBLFFBQUksZUFBZSxRQUFRO0FBQ3pCLG9CQUFjLEVBQUUsTUFBTSxPQUFPO0FBQzdCLFVBQUksY0FBYyxTQUFTLFFBQVE7QUFDakMseUJBQWlCLGFBQWE7QUFDOUIsb0JBQVk7QUFDWix1QkFBZSxFQUFFLEdBQUcsYUFBYSxHQUFHLEdBQUcsYUFBYSxFQUFFLEdBQUcsWUFBWTtBQUFBLE1BQ3ZFLE9BQU87QUFDTCx5QkFBaUI7QUFDakIsb0JBQVk7QUFDWix1QkFBZSxLQUFLO0FBQUEsTUFDdEI7QUFDQSxtQkFBYSxjQUFjO0FBQzNCO0FBQUEsSUFDRjtBQUVBLFFBQUksZUFBZSxVQUFVO0FBQzNCLFlBQU0sVUFBVSxRQUFRLEtBQUs7QUFDN0Isb0JBQWMsRUFBRSxNQUFNLFNBQVMsV0FBVyxNQUFNLFdBQVcsUUFBUTtBQUNuRTtBQUFBLElBQ0Y7QUFFQSxRQUFJLGVBQWUsVUFBVTtBQUMzQixVQUFJLGNBQWM7QUFDaEIseUJBQWlCLGFBQWE7QUFDOUIsWUFBSSxDQUFDLGNBQWMsYUFBYSxPQUFPLEdBQUc7QUFDeEMsb0JBQVUsY0FBYyxPQUFPLEtBQUs7QUFBQSxRQUN0QztBQUFBLE1BQ0YsT0FBTztBQUNMLHlCQUFpQjtBQUNqQixvQkFBWTtBQUFBLE1BQ2Q7QUFDQSxrQkFBWTtBQUNaO0FBQUEsSUFDRjtBQUVBLGdCQUFZLE9BQU8sS0FBSztBQUFBLEVBQzFCLENBQUM7QUFFRCxXQUFTLGlCQUFpQixlQUFlLENBQUMsVUFBVTtBQUNsRCxVQUFNLFFBQVEsY0FBYyxLQUFLO0FBRWpDLFFBQUksWUFBWSxTQUFTLE9BQU87QUFDOUIsWUFBTSxTQUFTLElBQUksWUFBWSxXQUFXLE1BQU0sVUFBVSxZQUFZO0FBQ3RFLFlBQU0sU0FBUyxJQUFJLFlBQVksV0FBVyxNQUFNLFVBQVUsWUFBWTtBQUN0RSxvQkFBYztBQUNkO0FBQUEsSUFDRjtBQUVBLFFBQUksWUFBWSxTQUFTLFVBQVUsYUFBYTtBQUM5QyxrQkFBWSxPQUFPLEtBQUs7QUFBQSxRQUN0QixHQUFHLE1BQU07QUFBQSxRQUNULEdBQUcsTUFBTTtBQUFBLFFBQ1QsVUFBVSxrQkFBa0IsTUFBTSxRQUFRO0FBQUEsTUFDNUMsQ0FBQztBQUNELHdCQUFrQjtBQUNsQjtBQUFBLElBQ0Y7QUFFQSxRQUFJLFlBQVksU0FBUyxRQUFRO0FBQy9CLG9CQUFjLGFBQWEsS0FBSztBQUNoQztBQUFBLElBQ0Y7QUFFQSxRQUFJLFlBQVksU0FBUyxTQUFTO0FBQ2hDLFlBQU0sVUFBVSxRQUFRLEtBQUssS0FBSyxZQUFZO0FBQzlDLG9CQUFjLEVBQUUsR0FBRyxhQUFhLFFBQVE7QUFBQSxJQUMxQztBQUFBLEVBQ0YsQ0FBQztBQUVELFFBQU0sY0FBYyxNQUFZO0FBQzlCLFFBQUksWUFBWSxTQUFTLFFBQVE7QUFDL0IsbUJBQWE7QUFBQSxJQUNmLFdBQVcsWUFBWSxTQUFTLFFBQVE7QUFDdEMsa0JBQVk7QUFDWixnQkFBVTtBQUFBLElBQ1osV0FBVyxZQUFZLFNBQVMsV0FBVyxZQUFZLFNBQVM7QUFDOUQsa0JBQVk7QUFDWixnQkFBVTtBQUFBLElBQ1osV0FBVyxZQUFZLFNBQVMsT0FBTztBQUNyQyxnQkFBVTtBQUFBLElBQ1o7QUFFQSxrQkFBYyxFQUFFLE1BQU0sT0FBTztBQUFBLEVBQy9CO0FBRUEsV0FBUyxpQkFBaUIsYUFBYSxXQUFXO0FBQ2xELFdBQVMsaUJBQWlCLGdCQUFnQixXQUFXO0FBRXJELFdBQVM7QUFBQSxJQUNQO0FBQUEsSUFDQSxDQUFDLFVBQVU7QUFDVCxZQUFNLGVBQWU7QUFFckIsWUFBTSxTQUFTLFNBQVMsc0JBQXNCO0FBQzlDLFlBQU0sVUFBVSxNQUFNLFVBQVUsT0FBTztBQUN2QyxZQUFNLFVBQVUsTUFBTSxVQUFVLE9BQU87QUFDdkMsWUFBTSxVQUFVLFVBQVUsTUFBTSxTQUFTLEtBQUssTUFBTSxTQUFTO0FBQzdELFlBQU0sVUFBVSxVQUFVLE1BQU0sU0FBUyxLQUFLLE1BQU0sU0FBUztBQUM3RCxZQUFNLFdBQVcsTUFBTSxNQUFNLFNBQVMsUUFBUSxNQUFNLFNBQVMsSUFBSSxPQUFPLE9BQU8sS0FBSyxDQUFDO0FBRXJGLFlBQU0sU0FBUyxPQUFPO0FBQ3RCLFlBQU0sU0FBUyxJQUFJLFVBQVUsU0FBUztBQUN0QyxZQUFNLFNBQVMsSUFBSSxVQUFVLFNBQVM7QUFDdEMsb0JBQWM7QUFDZCxnQkFBVTtBQUFBLElBQ1o7QUFBQSxJQUNBLEVBQUUsU0FBUyxNQUFNO0FBQUEsRUFDbkI7QUFFQSxjQUFZO0FBQ1osZ0JBQWM7QUFDZCxlQUFhLEdBQUcsWUFBWSxVQUFVLENBQUMsUUFBUTtBQUMvQyxjQUFZO0FBRVosU0FBTztBQUFBLElBQ0wsVUFBVTtBQUNSLGtCQUFZO0FBQ1osVUFBSSxjQUFjLE1BQU07QUFDdEIsZUFBTyxhQUFhLFNBQVM7QUFBQSxNQUMvQjtBQUNBLHdCQUFrQjtBQUNsQixnQkFBVSxNQUFNO0FBQUEsSUFDbEI7QUFBQSxFQUNGO0FBQ0Y7QUFFQSxTQUFTLGtCQUFrQixVQUEwQjtBQUNuRCxNQUFJLFdBQVcsS0FBSyxPQUFPLFNBQVMsUUFBUSxHQUFHO0FBQzdDLFdBQU87QUFBQSxFQUNUO0FBQ0EsU0FBTztBQUNUO0FBRUEsU0FBUyxhQUFhLFFBQStCO0FBQ25ELE1BQUksT0FBTyxXQUFXLEdBQUc7QUFDdkIsV0FBTztBQUFBLEVBQ1Q7QUFFQSxNQUFJLE9BQU8sV0FBVyxHQUFHO0FBQ3ZCLFVBQU0sUUFBUSxPQUFPLENBQUM7QUFDdEIsV0FBTyxLQUFLLE1BQU0sQ0FBQyxJQUFJLE1BQU0sQ0FBQyxNQUFNLE1BQU0sSUFBSSxJQUFJLElBQUksTUFBTSxJQUFJLElBQUk7QUFBQSxFQUN0RTtBQUVBLE1BQUksT0FBTyxLQUFLLE9BQU8sQ0FBQyxFQUFFLENBQUMsSUFBSSxPQUFPLENBQUMsRUFBRSxDQUFDO0FBQzFDLFdBQVMsUUFBUSxHQUFHLFFBQVEsT0FBTyxTQUFTLEdBQUcsU0FBUyxHQUFHO0FBQ3pELFVBQU0sVUFBVSxPQUFPLEtBQUs7QUFDNUIsVUFBTSxPQUFPLE9BQU8sUUFBUSxDQUFDO0FBQzdCLFVBQU0sUUFBUSxRQUFRLElBQUksS0FBSyxLQUFLO0FBQ3BDLFVBQU0sUUFBUSxRQUFRLElBQUksS0FBSyxLQUFLO0FBQ3BDLFlBQVEsTUFBTSxRQUFRLENBQUMsSUFBSSxRQUFRLENBQUMsSUFBSSxJQUFJLElBQUksSUFBSTtBQUFBLEVBQ3REO0FBRUEsUUFBTSxPQUFPLE9BQU8sT0FBTyxTQUFTLENBQUM7QUFDckMsVUFBUSxNQUFNLEtBQUssQ0FBQyxJQUFJLEtBQUssQ0FBQztBQUM5QixTQUFPO0FBQ1Q7QUFFQSxTQUFTLGtCQUFrQixPQUFpQyxRQUE2QjtBQUN2RixRQUFNLFlBQVksS0FBSyxJQUFJLE9BQU8sUUFBUSxLQUFLLEVBQUU7QUFFakQsV0FBUyxRQUFRLEdBQUcsUUFBUSxPQUFPLE9BQU8sUUFBUSxTQUFTLEdBQUc7QUFDNUQsVUFBTSxXQUFXLE9BQU8sT0FBTyxRQUFRLENBQUM7QUFDeEMsVUFBTSxVQUFVLE9BQU8sT0FBTyxLQUFLO0FBQ25DLFFBQUksa0JBQWtCLE9BQU8sVUFBVSxPQUFPLEtBQUssV0FBVztBQUM1RCxhQUFPO0FBQUEsSUFDVDtBQUFBLEVBQ0Y7QUFFQSxTQUFPO0FBQ1Q7QUFFQSxTQUFTLGtCQUNQLE9BQ0EsT0FDQSxLQUNRO0FBQ1IsUUFBTSxLQUFLLElBQUksSUFBSSxNQUFNO0FBQ3pCLFFBQU0sS0FBSyxJQUFJLElBQUksTUFBTTtBQUV6QixNQUFJLE9BQU8sS0FBSyxPQUFPLEdBQUc7QUFDeEIsV0FBTyxLQUFLLE1BQU0sTUFBTSxJQUFJLE1BQU0sR0FBRyxNQUFNLElBQUksTUFBTSxDQUFDO0FBQUEsRUFDeEQ7QUFFQSxRQUFNLElBQUksUUFBUSxNQUFNLElBQUksTUFBTSxLQUFLLE1BQU0sTUFBTSxJQUFJLE1BQU0sS0FBSyxPQUFPLEtBQUssS0FBSyxLQUFLLEtBQUssR0FBRyxDQUFDO0FBQ2pHLFFBQU0sY0FBYyxNQUFNLElBQUksSUFBSTtBQUNsQyxRQUFNLGNBQWMsTUFBTSxJQUFJLElBQUk7QUFDbEMsU0FBTyxLQUFLLE1BQU0sTUFBTSxJQUFJLGFBQWEsTUFBTSxJQUFJLFdBQVc7QUFDaEU7QUFFQSxTQUFTLE1BQU0sT0FBZSxLQUFhLEtBQXFCO0FBQzlELFNBQU8sS0FBSyxJQUFJLEtBQUssS0FBSyxJQUFJLEtBQUssS0FBSyxDQUFDO0FBQzNDOzs7QUZ4eEJBLElBQXFCLDJCQUFyQixjQUFzRCx3QkFBTztBQUFBLEVBQzNELE1BQU0sU0FBd0I7QUFDNUIsU0FBSztBQUFBLE1BQ0g7QUFBQSxNQUNBLE9BQU8sUUFBUSxJQUFJLFFBQVE7QUFDekIsY0FBTSxRQUFRLEtBQUssbUJBQW1CLE1BQU07QUFFNUMsY0FBTSxTQUFTLGdCQUFnQixJQUFJLE9BQU87QUFBQSxVQUN4QyxZQUFZLElBQUk7QUFBQSxVQUNoQixNQUFNLE9BQU8sY0FBYztBQUN6QixrQkFBTSxLQUFLLGFBQWEsSUFBSSxZQUFZLFNBQVM7QUFBQSxVQUNuRDtBQUFBLFFBQ0YsQ0FBQztBQUVELGFBQUssU0FBUyxNQUFNLE9BQU8sUUFBUSxDQUFDO0FBQUEsTUFDdEM7QUFBQSxJQUNGO0FBRUEsU0FBSyxXQUFXO0FBQUEsTUFDZCxJQUFJO0FBQUEsTUFDSixNQUFNO0FBQUEsTUFDTixnQkFBZ0IsQ0FBQyxXQUFXO0FBQzFCLGFBQUsseUJBQXlCLE1BQU07QUFBQSxNQUN0QztBQUFBLElBQ0YsQ0FBQztBQUVELFNBQUssV0FBVztBQUFBLE1BQ2QsSUFBSTtBQUFBLE1BQ0osTUFBTTtBQUFBLE1BQ04sZUFBZSxDQUFDLGFBQWE7QUFDM0IsY0FBTSxPQUFPLEtBQUssSUFBSSxVQUFVLG9CQUFvQiw2QkFBWTtBQUNoRSxZQUFJLENBQUMsTUFBTSxNQUFNO0FBQ2YsaUJBQU87QUFBQSxRQUNUO0FBRUEsWUFBSSxDQUFDLFVBQVU7QUFDYixlQUFLLEtBQUssa0JBQWtCLEtBQUssSUFBSTtBQUFBLFFBQ3ZDO0FBRUEsZUFBTztBQUFBLE1BQ1Q7QUFBQSxJQUNGLENBQUM7QUFFRCxTQUFLO0FBQUEsTUFDSCxLQUFLLElBQUksVUFBVSxHQUFHLGVBQWUsQ0FBQyxNQUFNLFdBQVc7QUFDckQsYUFBSyxRQUFRLENBQUMsU0FBUztBQUNyQixlQUNHLFNBQVMsNEJBQTRCLEVBQ3JDLFFBQVEsa0JBQWtCLEVBQzFCLFFBQVEsTUFBTTtBQUNiLGlCQUFLLHlCQUF5QixNQUFNO0FBQUEsVUFDdEMsQ0FBQztBQUFBLFFBQ0wsQ0FBQztBQUFBLE1BQ0gsQ0FBQztBQUFBLElBQ0g7QUFBQSxFQUNGO0FBQUEsRUFFUSxtQkFBbUIsUUFBd0M7QUFDakUsUUFBSTtBQUNGLGFBQU8sV0FBVyxNQUFNO0FBQUEsSUFDMUIsU0FBUyxPQUFPO0FBQ2QsY0FBUSxNQUFNLEtBQUs7QUFDbkIsYUFBTyxtQkFBbUI7QUFBQSxJQUM1QjtBQUFBLEVBQ0Y7QUFBQSxFQUVBLE1BQWMsa0JBQWtCLE1BQTRCO0FBQzFELFVBQU0sVUFBVSxNQUFNLEtBQUssSUFBSSxNQUFNLEtBQUssSUFBSTtBQUM5QyxVQUFNLFNBQVMsUUFBUSxTQUFTLElBQUksSUFBSSxLQUFLO0FBQzdDLFVBQU0sS0FBSyxJQUFJLE1BQU0sT0FBTyxNQUFNLEdBQUcsT0FBTyxHQUFHLE1BQU07QUFBQSxFQUFLLFVBQVUsbUJBQW1CLENBQUMsQ0FBQztBQUFBLENBQUk7QUFDN0YsUUFBSSx3QkFBTywwQ0FBMEM7QUFBQSxFQUN2RDtBQUFBLEVBRVEseUJBQXlCLFFBQXNCO0FBQ3JELFVBQU0sUUFBUSxVQUFVLG1CQUFtQixDQUFDO0FBQzVDLFVBQU0sU0FBUyxPQUFPLFVBQVU7QUFDaEMsVUFBTSxvQkFBb0IsT0FBTyxPQUFPLElBQUksT0FBTztBQUNuRCxXQUFPLGFBQWEsR0FBRyxpQkFBaUIsR0FBRyxLQUFLO0FBQUEsR0FBTSxNQUFNO0FBQUEsRUFDOUQ7QUFBQSxFQUVBLE1BQWMsYUFBYSxZQUFvQixPQUE4QztBQUMzRixVQUFNLE9BQU8sS0FBSyxJQUFJLE1BQU0sc0JBQXNCLFVBQVU7QUFDNUQsUUFBSSxFQUFFLGdCQUFnQix5QkFBUTtBQUM1QixZQUFNLElBQUksTUFBTSwrQkFBK0IsVUFBVSxFQUFFO0FBQUEsSUFDN0Q7QUFFQSxVQUFNLFVBQVUsTUFBTSxLQUFLLElBQUksTUFBTSxLQUFLLElBQUk7QUFDOUMsVUFBTSxRQUFRLEtBQUssbUJBQW1CLFNBQVMsTUFBTSxFQUFFLEtBQUssS0FBSywwQkFBMEIsT0FBTztBQUNsRyxRQUFJLENBQUMsT0FBTztBQUNWLFlBQU0sSUFBSSxNQUFNLGlFQUFpRTtBQUFBLElBQ25GO0FBRUEsVUFBTSxZQUFZLFVBQVUsS0FBSztBQUNqQyxVQUFNLFVBQVUsR0FBRyxRQUFRLE1BQU0sR0FBRyxNQUFNLElBQUksQ0FBQyxHQUFHLFNBQVMsR0FBRyxRQUFRLE1BQU0sTUFBTSxFQUFFLENBQUM7QUFDckYsVUFBTSxLQUFLLElBQUksTUFBTSxPQUFPLE1BQU0sT0FBTztBQUFBLEVBQzNDO0FBQUEsRUFFUSxtQkFBbUIsU0FBaUIsU0FBc0M7QUFDaEYsZUFBVyxTQUFTLEtBQUssd0JBQXdCLE9BQU8sR0FBRztBQUN6RCxVQUFJO0FBQ0YsY0FBTSxTQUFTLFdBQVcsTUFBTSxPQUFPO0FBQ3ZDLFlBQUksT0FBTyxPQUFPLFNBQVM7QUFDekIsaUJBQU87QUFBQSxRQUNUO0FBQUEsTUFDRixRQUFRO0FBQ047QUFBQSxNQUNGO0FBQUEsSUFDRjtBQUVBLFdBQU87QUFBQSxFQUNUO0FBQUEsRUFFUSwwQkFBMEIsU0FBc0M7QUFDdEUsVUFBTSxTQUFTLENBQUMsR0FBRyxLQUFLLHdCQUF3QixPQUFPLENBQUM7QUFDeEQsV0FBTyxPQUFPLFdBQVcsSUFBSSxPQUFPLENBQUMsSUFBSTtBQUFBLEVBQzNDO0FBQUEsRUFFQSxDQUFTLHdCQUF3QixTQUEwQztBQUN6RSxVQUFNLFVBQVUsU0FBUyxnQkFBZ0I7QUFDekMsUUFBSSxhQUFhO0FBRWpCLFdBQU8sYUFBYSxRQUFRLFFBQVE7QUFDbEMsWUFBTSxRQUFRLFFBQVEsUUFBUSxTQUFTLFVBQVU7QUFDakQsVUFBSSxVQUFVLElBQUk7QUFDaEI7QUFBQSxNQUNGO0FBRUEsWUFBTSxlQUFlLFFBQVEsUUFBUSxNQUFNLEtBQUs7QUFDaEQsVUFBSSxpQkFBaUIsSUFBSTtBQUN2QjtBQUFBLE1BQ0Y7QUFFQSxZQUFNLFFBQVEsUUFBUSxRQUFRLFNBQVMsWUFBWTtBQUNuRCxVQUFJLFVBQVUsSUFBSTtBQUNoQjtBQUFBLE1BQ0Y7QUFFQSxZQUFNLE1BQU0sUUFBUTtBQUNwQixZQUFNO0FBQUEsUUFDSixNQUFNO0FBQUEsUUFDTixJQUFJO0FBQUEsUUFDSixTQUFTLFFBQVEsTUFBTSxlQUFlLEdBQUcsS0FBSztBQUFBLE1BQ2hEO0FBRUEsbUJBQWE7QUFBQSxJQUNmO0FBQUEsRUFDRjtBQUNGOyIsCiAgIm5hbWVzIjogWyJpbXBvcnRfb2JzaWRpYW4iXQp9Cg==
