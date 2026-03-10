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

// src/editor-extension.ts
var import_state2 = require("@codemirror/state");
var import_view = require("@codemirror/view");

// src/state.ts
var WHITEBOARD_FENCE = "inline-whiteboard";
var DEFAULT_BOARD_HEIGHT = 620;
var DEFAULT_COLORS = [
  "#111827",
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
function createDefaultBoard() {
  return {
    layers: [createLayer()],
    items: [],
    viewport: {
      x: 0,
      y: 0,
      zoom: 1
    }
  };
}
function parseBoard(raw) {
  const parsed = JSON.parse(raw);
  if (Array.isArray(parsed.nodes)) {
    return migrateNodeBoard(parsed.nodes, parsed.viewport);
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
  return {
    layers: safeLayers,
    items,
    viewport: {
      x: typeof parsed.viewport?.x === "number" ? parsed.viewport.x : 0,
      y: typeof parsed.viewport?.y === "number" ? parsed.viewport.y : 0,
      zoom: typeof parsed.viewport?.zoom === "number" ? parsed.viewport.zoom : 1
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
function migrateNodeBoard(nodes, viewport) {
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
    layers: [layer],
    items,
    viewport: {
      x: typeof viewport?.x === "number" ? viewport.x : 0,
      y: typeof viewport?.y === "number" ? viewport.y : 0,
      zoom: typeof viewport?.zoom === "number" ? viewport.zoom : 1
    }
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
  const scene = viewport.createEl("svg", { cls: "embedded-whiteboard__scene" });
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
  let activeTool = "pen";
  let activeColor = DEFAULT_COLORS[0];
  let brushSize = TOOL_PRESETS.pen.width;
  let opacity = TOOL_PRESETS.pen.opacity;
  let activeLayerId = board.layers[0].id;
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
  function setActiveTool(tool) {
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
      activeTextEditor.remove();
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

// src/editor-extension.ts
function buildEditorExtension(plugin) {
  const widgetPlugin = import_view.ViewPlugin.fromClass(
    class {
      constructor(view) {
        this.view = view;
        this.decorations = this.buildDecorations();
      }
      update(update) {
        if (update.docChanged || update.viewportChanged || update.selectionSet) {
          this.decorations = this.buildDecorations();
        }
      }
      buildDecorations() {
        const builder = new import_state2.RangeSetBuilder();
        const blocks = findWhiteboardBlocks(this.view);
        for (const block of blocks) {
          if (selectionTouches(this.view, block.from, block.to)) {
            continue;
          }
          builder.add(
            block.from,
            block.to,
            import_view.Decoration.replace({
              block: true,
              widget: new InlineWhiteboardWidget(plugin, this.view, block)
            })
          );
        }
        return builder.finish();
      }
    },
    {
      decorations: (value) => value.decorations
    }
  );
  return [widgetPlugin];
}
var InlineWhiteboardWidget = class extends import_view.WidgetType {
  constructor(plugin, view, block) {
    super();
    this.plugin = plugin;
    this.view = view;
    this.block = block;
  }
  eq(other) {
    return other.block.raw === this.block.raw;
  }
  toDOM() {
    const container = document.createElement("div");
    container.className = "embedded-whiteboard__editor-host";
    const board = parseBoardSafely(this.block.raw);
    this.handle = mountWhiteboard(container, board, {
      sourcePath: this.plugin.app.workspace.getActiveFile()?.path ?? "",
      save: async (nextBoard) => {
        this.view.dispatch({
          changes: {
            from: this.block.from,
            to: this.block.to,
            insert: wrapBoard(nextBoard)
          }
        });
      }
    });
    return container;
  }
  destroy() {
    this.handle?.destroy();
  }
  ignoreEvent() {
    return false;
  }
};
function findWhiteboardBlocks(view) {
  const blocks = [];
  const doc = view.state.doc;
  const lines = doc.lines;
  let index = 1;
  while (index <= lines) {
    const line = doc.line(index);
    if (line.text.trim() === `\`\`\`${WHITEBOARD_FENCE}`) {
      const startLine = line;
      let endIndex = index + 1;
      while (endIndex <= lines) {
        const candidate = doc.line(endIndex);
        if (candidate.text.trim() === "```") {
          const from = startLine.from;
          const to = candidate.to;
          const raw = doc.sliceString(startLine.to + 1, candidate.from);
          blocks.push({ from, to, raw: raw.trim() });
          index = endIndex;
          break;
        }
        endIndex += 1;
      }
    }
    index += 1;
  }
  return blocks;
}
function selectionTouches(view, from, to) {
  return view.state.selection.ranges.some((range) => range.from <= to && range.to >= from);
}
function parseBoardSafely(raw) {
  try {
    return parseBoard(raw);
  } catch {
    return createDefaultBoard();
  }
}

// main.ts
var EmbeddedWhiteboardPlugin = class extends import_obsidian2.Plugin {
  async onload() {
    this.registerMarkdownCodeBlockProcessor(
      WHITEBOARD_FENCE,
      async (source, el, ctx) => {
        const board = this.parseOrCreateBoard(source);
        let currentBlock = `\`\`\`${WHITEBOARD_FENCE}
${source}
\`\`\``;
        const handle = mountWhiteboard(el, board, {
          sourcePath: ctx.sourcePath,
          save: async (nextBoard) => {
            currentBlock = await this.persistBlock(ctx.sourcePath, currentBlock, nextBoard);
          }
        });
        this.register(() => handle.destroy());
      }
    );
    this.registerEditorExtension(buildEditorExtension(this));
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
  async persistBlock(sourcePath, previousBlock, board) {
    const file = this.app.vault.getAbstractFileByPath(sourcePath);
    if (!(file instanceof import_obsidian2.TFile)) {
      throw new Error(`Unable to find source note: ${sourcePath}`);
    }
    const nextBlock = wrapBoard(board);
    const current = await this.app.vault.read(file);
    const index = current.indexOf(previousBlock);
    if (index === -1) {
      throw new Error("Unable to find the embedded whiteboard block in the source note");
    }
    const updated = `${current.slice(0, index)}${nextBlock}${current.slice(index + previousBlock.length)}`;
    await this.app.vault.modify(file, updated);
    return nextBlock;
  }
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsibWFpbi50cyIsICJzcmMvZWRpdG9yLWV4dGVuc2lvbi50cyIsICJzcmMvc3RhdGUudHMiLCAic3JjL3doaXRlYm9hcmQudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImltcG9ydCB7XG4gIEVkaXRvcixcbiAgTWFya2Rvd25WaWV3LFxuICBOb3RpY2UsXG4gIFBsdWdpbixcbiAgVEZpbGVcbn0gZnJvbSBcIm9ic2lkaWFuXCI7XG5pbXBvcnQgeyBidWlsZEVkaXRvckV4dGVuc2lvbiB9IGZyb20gXCIuL3NyYy9lZGl0b3ItZXh0ZW5zaW9uXCI7XG5pbXBvcnQge1xuICBjcmVhdGVEZWZhdWx0Qm9hcmQsXG4gIHBhcnNlQm9hcmQsXG4gIFdISVRFQk9BUkRfRkVOQ0UsXG4gIHdyYXBCb2FyZFxufSBmcm9tIFwiLi9zcmMvc3RhdGVcIjtcbmltcG9ydCB7IEVtYmVkZGVkV2hpdGVib2FyZERhdGEgfSBmcm9tIFwiLi9zcmMvdHlwZXNcIjtcbmltcG9ydCB7IG1vdW50V2hpdGVib2FyZCB9IGZyb20gXCIuL3NyYy93aGl0ZWJvYXJkXCI7XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIEVtYmVkZGVkV2hpdGVib2FyZFBsdWdpbiBleHRlbmRzIFBsdWdpbiB7XG4gIGFzeW5jIG9ubG9hZCgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICB0aGlzLnJlZ2lzdGVyTWFya2Rvd25Db2RlQmxvY2tQcm9jZXNzb3IoXG4gICAgICBXSElURUJPQVJEX0ZFTkNFLFxuICAgICAgYXN5bmMgKHNvdXJjZSwgZWwsIGN0eCkgPT4ge1xuICAgICAgICBjb25zdCBib2FyZCA9IHRoaXMucGFyc2VPckNyZWF0ZUJvYXJkKHNvdXJjZSk7XG4gICAgICAgIGxldCBjdXJyZW50QmxvY2sgPSBgXFxgXFxgXFxgJHtXSElURUJPQVJEX0ZFTkNFfVxcbiR7c291cmNlfVxcblxcYFxcYFxcYGA7XG5cbiAgICAgICAgY29uc3QgaGFuZGxlID0gbW91bnRXaGl0ZWJvYXJkKGVsLCBib2FyZCwge1xuICAgICAgICAgIHNvdXJjZVBhdGg6IGN0eC5zb3VyY2VQYXRoLFxuICAgICAgICAgIHNhdmU6IGFzeW5jIChuZXh0Qm9hcmQpID0+IHtcbiAgICAgICAgICAgIGN1cnJlbnRCbG9jayA9IGF3YWl0IHRoaXMucGVyc2lzdEJsb2NrKGN0eC5zb3VyY2VQYXRoLCBjdXJyZW50QmxvY2ssIG5leHRCb2FyZCk7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgICAgICB0aGlzLnJlZ2lzdGVyKCgpID0+IGhhbmRsZS5kZXN0cm95KCkpO1xuICAgICAgfVxuICAgICk7XG5cbiAgICB0aGlzLnJlZ2lzdGVyRWRpdG9yRXh0ZW5zaW9uKGJ1aWxkRWRpdG9yRXh0ZW5zaW9uKHRoaXMpKTtcblxuICAgIHRoaXMuYWRkQ29tbWFuZCh7XG4gICAgICBpZDogXCJpbnNlcnQtZW1iZWRkZWQtd2hpdGVib2FyZFwiLFxuICAgICAgbmFtZTogXCJJbnNlcnQgZW1iZWRkZWQgd2hpdGVib2FyZFwiLFxuICAgICAgZWRpdG9yQ2FsbGJhY2s6IChlZGl0b3IpID0+IHtcbiAgICAgICAgdGhpcy5pbnNlcnRFbWJlZGRlZFdoaXRlYm9hcmQoZWRpdG9yKTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIHRoaXMuYWRkQ29tbWFuZCh7XG4gICAgICBpZDogXCJhcHBlbmQtZW1iZWRkZWQtd2hpdGVib2FyZFwiLFxuICAgICAgbmFtZTogXCJBcHBlbmQgZW1iZWRkZWQgd2hpdGVib2FyZCB0byBjdXJyZW50IG5vdGVcIixcbiAgICAgIGNoZWNrQ2FsbGJhY2s6IChjaGVja2luZykgPT4ge1xuICAgICAgICBjb25zdCB2aWV3ID0gdGhpcy5hcHAud29ya3NwYWNlLmdldEFjdGl2ZVZpZXdPZlR5cGUoTWFya2Rvd25WaWV3KTtcbiAgICAgICAgaWYgKCF2aWV3Py5maWxlKSB7XG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFjaGVja2luZykge1xuICAgICAgICAgIHZvaWQgdGhpcy5hcHBlbmRCb2FyZFRvRmlsZSh2aWV3LmZpbGUpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICB0aGlzLnJlZ2lzdGVyRXZlbnQoXG4gICAgICB0aGlzLmFwcC53b3Jrc3BhY2Uub24oXCJlZGl0b3ItbWVudVwiLCAobWVudSwgZWRpdG9yKSA9PiB7XG4gICAgICAgIG1lbnUuYWRkSXRlbSgoaXRlbSkgPT4ge1xuICAgICAgICAgIGl0ZW1cbiAgICAgICAgICAgIC5zZXRUaXRsZShcIkluc2VydCBlbWJlZGRlZCB3aGl0ZWJvYXJkXCIpXG4gICAgICAgICAgICAuc2V0SWNvbihcImxheW91dC1kYXNoYm9hcmRcIilcbiAgICAgICAgICAgIC5vbkNsaWNrKCgpID0+IHtcbiAgICAgICAgICAgICAgdGhpcy5pbnNlcnRFbWJlZGRlZFdoaXRlYm9hcmQoZWRpdG9yKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICAgIH0pXG4gICAgKTtcbiAgfVxuXG4gIHByaXZhdGUgcGFyc2VPckNyZWF0ZUJvYXJkKHNvdXJjZTogc3RyaW5nKTogRW1iZWRkZWRXaGl0ZWJvYXJkRGF0YSB7XG4gICAgdHJ5IHtcbiAgICAgIHJldHVybiBwYXJzZUJvYXJkKHNvdXJjZSk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoZXJyb3IpO1xuICAgICAgcmV0dXJuIGNyZWF0ZURlZmF1bHRCb2FyZCgpO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgYXBwZW5kQm9hcmRUb0ZpbGUoZmlsZTogVEZpbGUpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCBjb250ZW50ID0gYXdhaXQgdGhpcy5hcHAudmF1bHQucmVhZChmaWxlKTtcbiAgICBjb25zdCBzdWZmaXggPSBjb250ZW50LmVuZHNXaXRoKFwiXFxuXCIpID8gXCJcIiA6IFwiXFxuXCI7XG4gICAgYXdhaXQgdGhpcy5hcHAudmF1bHQubW9kaWZ5KGZpbGUsIGAke2NvbnRlbnR9JHtzdWZmaXh9XFxuJHt3cmFwQm9hcmQoY3JlYXRlRGVmYXVsdEJvYXJkKCkpfVxcbmApO1xuICAgIG5ldyBOb3RpY2UoXCJFbWJlZGRlZCB3aGl0ZWJvYXJkIGFwcGVuZGVkIHRvIHRoZSBub3RlXCIpO1xuICB9XG5cbiAgcHJpdmF0ZSBpbnNlcnRFbWJlZGRlZFdoaXRlYm9hcmQoZWRpdG9yOiBFZGl0b3IpOiB2b2lkIHtcbiAgICBjb25zdCBib2FyZCA9IHdyYXBCb2FyZChjcmVhdGVEZWZhdWx0Qm9hcmQoKSk7XG4gICAgY29uc3QgY3Vyc29yID0gZWRpdG9yLmdldEN1cnNvcigpO1xuICAgIGNvbnN0IG5lZWRzTGVhZGluZ0JyZWFrID0gY3Vyc29yLmxpbmUgPiAwID8gXCJcXG5cIiA6IFwiXCI7XG4gICAgZWRpdG9yLnJlcGxhY2VSYW5nZShgJHtuZWVkc0xlYWRpbmdCcmVha30ke2JvYXJkfVxcbmAsIGN1cnNvcik7XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIHBlcnNpc3RCbG9jayhcbiAgICBzb3VyY2VQYXRoOiBzdHJpbmcsXG4gICAgcHJldmlvdXNCbG9jazogc3RyaW5nLFxuICAgIGJvYXJkOiBFbWJlZGRlZFdoaXRlYm9hcmREYXRhXG4gICk6IFByb21pc2U8c3RyaW5nPiB7XG4gICAgY29uc3QgZmlsZSA9IHRoaXMuYXBwLnZhdWx0LmdldEFic3RyYWN0RmlsZUJ5UGF0aChzb3VyY2VQYXRoKTtcbiAgICBpZiAoIShmaWxlIGluc3RhbmNlb2YgVEZpbGUpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFVuYWJsZSB0byBmaW5kIHNvdXJjZSBub3RlOiAke3NvdXJjZVBhdGh9YCk7XG4gICAgfVxuXG4gICAgY29uc3QgbmV4dEJsb2NrID0gd3JhcEJvYXJkKGJvYXJkKTtcbiAgICBjb25zdCBjdXJyZW50ID0gYXdhaXQgdGhpcy5hcHAudmF1bHQucmVhZChmaWxlKTtcbiAgICBjb25zdCBpbmRleCA9IGN1cnJlbnQuaW5kZXhPZihwcmV2aW91c0Jsb2NrKTtcbiAgICBpZiAoaW5kZXggPT09IC0xKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJVbmFibGUgdG8gZmluZCB0aGUgZW1iZWRkZWQgd2hpdGVib2FyZCBibG9jayBpbiB0aGUgc291cmNlIG5vdGVcIik7XG4gICAgfVxuXG4gICAgY29uc3QgdXBkYXRlZCA9IGAke2N1cnJlbnQuc2xpY2UoMCwgaW5kZXgpfSR7bmV4dEJsb2NrfSR7Y3VycmVudC5zbGljZShpbmRleCArIHByZXZpb3VzQmxvY2subGVuZ3RoKX1gO1xuICAgIGF3YWl0IHRoaXMuYXBwLnZhdWx0Lm1vZGlmeShmaWxlLCB1cGRhdGVkKTtcbiAgICByZXR1cm4gbmV4dEJsb2NrO1xuICB9XG59XHJcbiIsICJpbXBvcnQgeyBSYW5nZVNldEJ1aWxkZXIgfSBmcm9tIFwiQGNvZGVtaXJyb3Ivc3RhdGVcIjtcbmltcG9ydCB7IERlY29yYXRpb24sIEVkaXRvclZpZXcsIFZpZXdQbHVnaW4sIFZpZXdVcGRhdGUsIFdpZGdldFR5cGUgfSBmcm9tIFwiQGNvZGVtaXJyb3Ivdmlld1wiO1xuaW1wb3J0IHsgUGx1Z2luIH0gZnJvbSBcIm9ic2lkaWFuXCI7XG5pbXBvcnQgeyBjcmVhdGVEZWZhdWx0Qm9hcmQsIHBhcnNlQm9hcmQsIFdISVRFQk9BUkRfRkVOQ0UsIHdyYXBCb2FyZCB9IGZyb20gXCIuL3N0YXRlXCI7XG5pbXBvcnQgeyBtb3VudFdoaXRlYm9hcmQgfSBmcm9tIFwiLi93aGl0ZWJvYXJkXCI7XG5cbmludGVyZmFjZSBXaGl0ZWJvYXJkQmxvY2sge1xuICBmcm9tOiBudW1iZXI7XG4gIHRvOiBudW1iZXI7XG4gIHJhdzogc3RyaW5nO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gYnVpbGRFZGl0b3JFeHRlbnNpb24ocGx1Z2luOiBQbHVnaW4pIHtcbiAgY29uc3Qgd2lkZ2V0UGx1Z2luID0gVmlld1BsdWdpbi5mcm9tQ2xhc3MoXG4gICAgY2xhc3Mge1xuICAgICAgZGVjb3JhdGlvbnM7XG5cbiAgICAgIGNvbnN0cnVjdG9yKHByaXZhdGUgcmVhZG9ubHkgdmlldzogRWRpdG9yVmlldykge1xuICAgICAgICB0aGlzLmRlY29yYXRpb25zID0gdGhpcy5idWlsZERlY29yYXRpb25zKCk7XG4gICAgICB9XG5cbiAgICAgIHVwZGF0ZSh1cGRhdGU6IFZpZXdVcGRhdGUpOiB2b2lkIHtcbiAgICAgICAgaWYgKHVwZGF0ZS5kb2NDaGFuZ2VkIHx8IHVwZGF0ZS52aWV3cG9ydENoYW5nZWQgfHwgdXBkYXRlLnNlbGVjdGlvblNldCkge1xuICAgICAgICAgIHRoaXMuZGVjb3JhdGlvbnMgPSB0aGlzLmJ1aWxkRGVjb3JhdGlvbnMoKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBidWlsZERlY29yYXRpb25zKCkge1xuICAgICAgICBjb25zdCBidWlsZGVyID0gbmV3IFJhbmdlU2V0QnVpbGRlcjxEZWNvcmF0aW9uPigpO1xuICAgICAgICBjb25zdCBibG9ja3MgPSBmaW5kV2hpdGVib2FyZEJsb2Nrcyh0aGlzLnZpZXcpO1xuXG4gICAgICAgIGZvciAoY29uc3QgYmxvY2sgb2YgYmxvY2tzKSB7XG4gICAgICAgICAgaWYgKHNlbGVjdGlvblRvdWNoZXModGhpcy52aWV3LCBibG9jay5mcm9tLCBibG9jay50bykpIHtcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGJ1aWxkZXIuYWRkKFxuICAgICAgICAgICAgYmxvY2suZnJvbSxcbiAgICAgICAgICAgIGJsb2NrLnRvLFxuICAgICAgICAgICAgRGVjb3JhdGlvbi5yZXBsYWNlKHtcbiAgICAgICAgICAgICAgYmxvY2s6IHRydWUsXG4gICAgICAgICAgICAgIHdpZGdldDogbmV3IElubGluZVdoaXRlYm9hcmRXaWRnZXQocGx1Z2luLCB0aGlzLnZpZXcsIGJsb2NrKVxuICAgICAgICAgICAgfSlcbiAgICAgICAgICApO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGJ1aWxkZXIuZmluaXNoKCk7XG4gICAgICB9XG4gICAgfSxcbiAgICB7XG4gICAgICBkZWNvcmF0aW9uczogKHZhbHVlKSA9PiB2YWx1ZS5kZWNvcmF0aW9uc1xuICAgIH1cbiAgKTtcblxuICByZXR1cm4gW3dpZGdldFBsdWdpbl07XG59XG5cbmNsYXNzIElubGluZVdoaXRlYm9hcmRXaWRnZXQgZXh0ZW5kcyBXaWRnZXRUeXBlIHtcbiAgcHJpdmF0ZSBoYW5kbGU/OiB7IGRlc3Ryb3koKTogdm9pZCB9O1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgIHByaXZhdGUgcmVhZG9ubHkgcGx1Z2luOiBQbHVnaW4sXG4gICAgcHJpdmF0ZSByZWFkb25seSB2aWV3OiBFZGl0b3JWaWV3LFxuICAgIHByaXZhdGUgcmVhZG9ubHkgYmxvY2s6IFdoaXRlYm9hcmRCbG9ja1xuICApIHtcbiAgICBzdXBlcigpO1xuICB9XG5cbiAgZXEob3RoZXI6IElubGluZVdoaXRlYm9hcmRXaWRnZXQpOiBib29sZWFuIHtcbiAgICByZXR1cm4gb3RoZXIuYmxvY2sucmF3ID09PSB0aGlzLmJsb2NrLnJhdztcbiAgfVxuXG4gIHRvRE9NKCk6IEhUTUxFbGVtZW50IHtcbiAgICBjb25zdCBjb250YWluZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuICAgIGNvbnRhaW5lci5jbGFzc05hbWUgPSBcImVtYmVkZGVkLXdoaXRlYm9hcmRfX2VkaXRvci1ob3N0XCI7XG4gICAgY29uc3QgYm9hcmQgPSBwYXJzZUJvYXJkU2FmZWx5KHRoaXMuYmxvY2sucmF3KTtcblxuICAgIHRoaXMuaGFuZGxlID0gbW91bnRXaGl0ZWJvYXJkKGNvbnRhaW5lciwgYm9hcmQsIHtcbiAgICAgIHNvdXJjZVBhdGg6IHRoaXMucGx1Z2luLmFwcC53b3Jrc3BhY2UuZ2V0QWN0aXZlRmlsZSgpPy5wYXRoID8/IFwiXCIsXG4gICAgICBzYXZlOiBhc3luYyAobmV4dEJvYXJkKSA9PiB7XG4gICAgICAgIHRoaXMudmlldy5kaXNwYXRjaCh7XG4gICAgICAgICAgY2hhbmdlczoge1xuICAgICAgICAgICAgZnJvbTogdGhpcy5ibG9jay5mcm9tLFxuICAgICAgICAgICAgdG86IHRoaXMuYmxvY2sudG8sXG4gICAgICAgICAgICBpbnNlcnQ6IHdyYXBCb2FyZChuZXh0Qm9hcmQpXG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIHJldHVybiBjb250YWluZXI7XG4gIH1cblxuICBkZXN0cm95KCk6IHZvaWQge1xuICAgIHRoaXMuaGFuZGxlPy5kZXN0cm95KCk7XG4gIH1cblxuICBpZ25vcmVFdmVudCgpOiBib29sZWFuIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbn1cblxuZnVuY3Rpb24gZmluZFdoaXRlYm9hcmRCbG9ja3ModmlldzogRWRpdG9yVmlldyk6IFdoaXRlYm9hcmRCbG9ja1tdIHtcbiAgY29uc3QgYmxvY2tzOiBXaGl0ZWJvYXJkQmxvY2tbXSA9IFtdO1xuICBjb25zdCBkb2MgPSB2aWV3LnN0YXRlLmRvYztcbiAgY29uc3QgbGluZXMgPSBkb2MubGluZXM7XG4gIGxldCBpbmRleCA9IDE7XG5cbiAgd2hpbGUgKGluZGV4IDw9IGxpbmVzKSB7XG4gICAgY29uc3QgbGluZSA9IGRvYy5saW5lKGluZGV4KTtcbiAgICBpZiAobGluZS50ZXh0LnRyaW0oKSA9PT0gYFxcYFxcYFxcYCR7V0hJVEVCT0FSRF9GRU5DRX1gKSB7XG4gICAgICBjb25zdCBzdGFydExpbmUgPSBsaW5lO1xuICAgICAgbGV0IGVuZEluZGV4ID0gaW5kZXggKyAxO1xuXG4gICAgICB3aGlsZSAoZW5kSW5kZXggPD0gbGluZXMpIHtcbiAgICAgICAgY29uc3QgY2FuZGlkYXRlID0gZG9jLmxpbmUoZW5kSW5kZXgpO1xuICAgICAgICBpZiAoY2FuZGlkYXRlLnRleHQudHJpbSgpID09PSBcImBgYFwiKSB7XG4gICAgICAgICAgY29uc3QgZnJvbSA9IHN0YXJ0TGluZS5mcm9tO1xuICAgICAgICAgIGNvbnN0IHRvID0gY2FuZGlkYXRlLnRvO1xuICAgICAgICAgIGNvbnN0IHJhdyA9IGRvYy5zbGljZVN0cmluZyhzdGFydExpbmUudG8gKyAxLCBjYW5kaWRhdGUuZnJvbSk7XG4gICAgICAgICAgYmxvY2tzLnB1c2goeyBmcm9tLCB0bywgcmF3OiByYXcudHJpbSgpIH0pO1xuICAgICAgICAgIGluZGV4ID0gZW5kSW5kZXg7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgICAgZW5kSW5kZXggKz0gMTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpbmRleCArPSAxO1xuICB9XG5cbiAgcmV0dXJuIGJsb2Nrcztcbn1cblxuZnVuY3Rpb24gc2VsZWN0aW9uVG91Y2hlcyh2aWV3OiBFZGl0b3JWaWV3LCBmcm9tOiBudW1iZXIsIHRvOiBudW1iZXIpOiBib29sZWFuIHtcbiAgcmV0dXJuIHZpZXcuc3RhdGUuc2VsZWN0aW9uLnJhbmdlcy5zb21lKChyYW5nZSkgPT4gcmFuZ2UuZnJvbSA8PSB0byAmJiByYW5nZS50byA+PSBmcm9tKTtcbn1cblxuZnVuY3Rpb24gcGFyc2VCb2FyZFNhZmVseShyYXc6IHN0cmluZykge1xuICB0cnkge1xuICAgIHJldHVybiBwYXJzZUJvYXJkKHJhdyk7XG4gIH0gY2F0Y2gge1xuICAgIHJldHVybiBjcmVhdGVEZWZhdWx0Qm9hcmQoKTtcbiAgfVxufVxyXG4iLCAiaW1wb3J0IHtcbiAgRHJhd2luZ1Rvb2wsXG4gIEVtYmVkZGVkV2hpdGVib2FyZERhdGEsXG4gIFN0cm9rZUl0ZW0sXG4gIFRleHRJdGVtLFxuICBXaGl0ZWJvYXJkSXRlbSxcbiAgV2hpdGVib2FyZExheWVyXG59IGZyb20gXCIuL3R5cGVzXCI7XG5cbmV4cG9ydCBjb25zdCBXSElURUJPQVJEX0ZFTkNFID0gXCJpbmxpbmUtd2hpdGVib2FyZFwiO1xuZXhwb3J0IGNvbnN0IERFRkFVTFRfQk9BUkRfSEVJR0hUID0gNjIwO1xuZXhwb3J0IGNvbnN0IERFRkFVTFRfQ09MT1JTID0gW1xuICBcIiMxMTE4MjdcIixcbiAgXCIjMjU2M2ViXCIsXG4gIFwiIzE0YjhhNlwiLFxuICBcIiMyMmM1NWVcIixcbiAgXCIjZjU5ZTBiXCIsXG4gIFwiI2VmNDQ0NFwiLFxuICBcIiNlMTFkNDhcIixcbiAgXCIjN2MzYWVkXCJcbl0gYXMgY29uc3Q7XG5cbmV4cG9ydCBjb25zdCBUT09MX1BSRVNFVFM6IFJlY29yZDxEcmF3aW5nVG9vbCwgeyB3aWR0aDogbnVtYmVyOyBvcGFjaXR5OiBudW1iZXIgfT4gPSB7XG4gIHBlbjogeyB3aWR0aDogNCwgb3BhY2l0eTogMSB9LFxuICBwZW5jaWw6IHsgd2lkdGg6IDIsIG9wYWNpdHk6IDAuNzIgfSxcbiAgbWFya2VyOiB7IHdpZHRoOiAxMiwgb3BhY2l0eTogMC4yOCB9XG59O1xuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlSWQocHJlZml4OiBzdHJpbmcpOiBzdHJpbmcge1xuICByZXR1cm4gYCR7cHJlZml4fS0ke01hdGgucmFuZG9tKCkudG9TdHJpbmcoMzYpLnNsaWNlKDIsIDEwKX1gO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlTGF5ZXIobmFtZSA9IFwiTGF5ZXIgMVwiKTogV2hpdGVib2FyZExheWVyIHtcbiAgcmV0dXJuIHtcbiAgICBpZDogY3JlYXRlSWQoXCJsYXllclwiKSxcbiAgICBuYW1lLFxuICAgIHZpc2libGU6IHRydWUsXG4gICAgbG9ja2VkOiBmYWxzZVxuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlRGVmYXVsdEJvYXJkKCk6IEVtYmVkZGVkV2hpdGVib2FyZERhdGEge1xuICByZXR1cm4ge1xuICAgIGxheWVyczogW2NyZWF0ZUxheWVyKCldLFxuICAgIGl0ZW1zOiBbXSxcbiAgICB2aWV3cG9ydDoge1xuICAgICAgeDogMCxcbiAgICAgIHk6IDAsXG4gICAgICB6b29tOiAxXG4gICAgfVxuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcGFyc2VCb2FyZChyYXc6IHN0cmluZyk6IEVtYmVkZGVkV2hpdGVib2FyZERhdGEge1xuICBjb25zdCBwYXJzZWQgPSBKU09OLnBhcnNlKHJhdykgYXMgUGFydGlhbDxFbWJlZGRlZFdoaXRlYm9hcmREYXRhPiAmIHtcbiAgICBub2Rlcz86IEFycmF5PFJlY29yZDxzdHJpbmcsIHVua25vd24+PjtcbiAgfTtcblxuICBpZiAoQXJyYXkuaXNBcnJheShwYXJzZWQubm9kZXMpKSB7XG4gICAgcmV0dXJuIG1pZ3JhdGVOb2RlQm9hcmQocGFyc2VkLm5vZGVzLCBwYXJzZWQudmlld3BvcnQpO1xuICB9XG5cbiAgY29uc3QgbGF5ZXJzID0gQXJyYXkuaXNBcnJheShwYXJzZWQubGF5ZXJzKVxuICAgID8gcGFyc2VkLmxheWVyc1xuICAgICAgICAuZmlsdGVyKChsYXllcik6IGxheWVyIGlzIFdoaXRlYm9hcmRMYXllciA9PiBCb29sZWFuKGxheWVyICYmIHR5cGVvZiBsYXllci5pZCA9PT0gXCJzdHJpbmdcIikpXG4gICAgICAgIC5tYXAoKGxheWVyLCBpbmRleCkgPT4gKHtcbiAgICAgICAgICBpZDogbGF5ZXIuaWQsXG4gICAgICAgICAgbmFtZTogdHlwZW9mIGxheWVyLm5hbWUgPT09IFwic3RyaW5nXCIgPyBsYXllci5uYW1lIDogYExheWVyICR7aW5kZXggKyAxfWAsXG4gICAgICAgICAgdmlzaWJsZTogbGF5ZXIudmlzaWJsZSAhPT0gZmFsc2UsXG4gICAgICAgICAgbG9ja2VkOiBsYXllci5sb2NrZWQgPT09IHRydWVcbiAgICAgICAgfSkpXG4gICAgOiBbXTtcblxuICBjb25zdCBzYWZlTGF5ZXJzID0gbGF5ZXJzLmxlbmd0aCA+IDAgPyBsYXllcnMgOiBbY3JlYXRlTGF5ZXIoKV07XG4gIGNvbnN0IGxheWVySWRzID0gbmV3IFNldChzYWZlTGF5ZXJzLm1hcCgobGF5ZXIpID0+IGxheWVyLmlkKSk7XG5cbiAgY29uc3QgaXRlbXMgPSBBcnJheS5pc0FycmF5KHBhcnNlZC5pdGVtcylcbiAgICA/IHBhcnNlZC5pdGVtc1xuICAgICAgICAuZmlsdGVyKChpdGVtKTogaXRlbSBpcyBXaGl0ZWJvYXJkSXRlbSA9PiBCb29sZWFuKGl0ZW0gJiYgdHlwZW9mIGl0ZW0uaWQgPT09IFwic3RyaW5nXCIgJiYgdHlwZW9mIGl0ZW0udHlwZSA9PT0gXCJzdHJpbmdcIikpXG4gICAgICAgIC5tYXAoKGl0ZW0pID0+IG5vcm1hbGl6ZUl0ZW0oaXRlbSwgc2FmZUxheWVyc1swXS5pZCkpXG4gICAgICAgIC5maWx0ZXIoKGl0ZW0pOiBpdGVtIGlzIFdoaXRlYm9hcmRJdGVtID0+IEJvb2xlYW4oaXRlbSAmJiBsYXllcklkcy5oYXMoaXRlbS5sYXllcklkKSkpXG4gICAgOiBbXTtcblxuICByZXR1cm4ge1xuICAgIGxheWVyczogc2FmZUxheWVycyxcbiAgICBpdGVtcyxcbiAgICB2aWV3cG9ydDoge1xuICAgICAgeDogdHlwZW9mIHBhcnNlZC52aWV3cG9ydD8ueCA9PT0gXCJudW1iZXJcIiA/IHBhcnNlZC52aWV3cG9ydC54IDogMCxcbiAgICAgIHk6IHR5cGVvZiBwYXJzZWQudmlld3BvcnQ/LnkgPT09IFwibnVtYmVyXCIgPyBwYXJzZWQudmlld3BvcnQueSA6IDAsXG4gICAgICB6b29tOiB0eXBlb2YgcGFyc2VkLnZpZXdwb3J0Py56b29tID09PSBcIm51bWJlclwiID8gcGFyc2VkLnZpZXdwb3J0Lnpvb20gOiAxXG4gICAgfVxuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc2VyaWFsaXplQm9hcmQoYm9hcmQ6IEVtYmVkZGVkV2hpdGVib2FyZERhdGEpOiBzdHJpbmcge1xuICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoYm9hcmQsIG51bGwsIDIpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gd3JhcEJvYXJkKGJvYXJkOiBFbWJlZGRlZFdoaXRlYm9hcmREYXRhKTogc3RyaW5nIHtcbiAgcmV0dXJuIGBcXGBcXGBcXGAke1dISVRFQk9BUkRfRkVOQ0V9XFxuJHtzZXJpYWxpemVCb2FyZChib2FyZCl9XFxuXFxgXFxgXFxgYDtcbn1cblxuZnVuY3Rpb24gbm9ybWFsaXplSXRlbShpdGVtOiBXaGl0ZWJvYXJkSXRlbSwgZmFsbGJhY2tMYXllcklkOiBzdHJpbmcpOiBXaGl0ZWJvYXJkSXRlbSB8IG51bGwge1xuICBpZiAoaXRlbS50eXBlID09PSBcInN0cm9rZVwiKSB7XG4gICAgY29uc3Qgc3Ryb2tlID0gaXRlbSBhcyBQYXJ0aWFsPFN0cm9rZUl0ZW0+O1xuICAgIHJldHVybiB7XG4gICAgICBpZDogc3Ryb2tlLmlkID8/IGNyZWF0ZUlkKFwic3Ryb2tlXCIpLFxuICAgICAgdHlwZTogXCJzdHJva2VcIixcbiAgICAgIGxheWVySWQ6IHR5cGVvZiBzdHJva2UubGF5ZXJJZCA9PT0gXCJzdHJpbmdcIiA/IHN0cm9rZS5sYXllcklkIDogZmFsbGJhY2tMYXllcklkLFxuICAgICAgdG9vbDogc3Ryb2tlLnRvb2wgPT09IFwicGVuY2lsXCIgfHwgc3Ryb2tlLnRvb2wgPT09IFwibWFya2VyXCIgPyBzdHJva2UudG9vbCA6IFwicGVuXCIsXG4gICAgICBjb2xvcjogdHlwZW9mIHN0cm9rZS5jb2xvciA9PT0gXCJzdHJpbmdcIiA/IHN0cm9rZS5jb2xvciA6IERFRkFVTFRfQ09MT1JTWzBdLFxuICAgICAgd2lkdGg6IHR5cGVvZiBzdHJva2Uud2lkdGggPT09IFwibnVtYmVyXCIgPyBzdHJva2Uud2lkdGggOiBUT09MX1BSRVNFVFMucGVuLndpZHRoLFxuICAgICAgb3BhY2l0eTogdHlwZW9mIHN0cm9rZS5vcGFjaXR5ID09PSBcIm51bWJlclwiID8gc3Ryb2tlLm9wYWNpdHkgOiBUT09MX1BSRVNFVFMucGVuLm9wYWNpdHksXG4gICAgICBwb2ludHM6IEFycmF5LmlzQXJyYXkoc3Ryb2tlLnBvaW50cylcbiAgICAgICAgPyBzdHJva2UucG9pbnRzXG4gICAgICAgICAgICAuZmlsdGVyKChwb2ludCk6IHBvaW50IGlzIHsgeDogbnVtYmVyOyB5OiBudW1iZXI7IHByZXNzdXJlPzogbnVtYmVyIH0gPT4gQm9vbGVhbihwb2ludCAmJiB0eXBlb2YgcG9pbnQueCA9PT0gXCJudW1iZXJcIiAmJiB0eXBlb2YgcG9pbnQueSA9PT0gXCJudW1iZXJcIikpXG4gICAgICAgICAgICAubWFwKChwb2ludCkgPT4gKHtcbiAgICAgICAgICAgICAgeDogcG9pbnQueCxcbiAgICAgICAgICAgICAgeTogcG9pbnQueSxcbiAgICAgICAgICAgICAgcHJlc3N1cmU6IHR5cGVvZiBwb2ludC5wcmVzc3VyZSA9PT0gXCJudW1iZXJcIiA/IHBvaW50LnByZXNzdXJlIDogMC41XG4gICAgICAgICAgICB9KSlcbiAgICAgICAgOiBbXVxuICAgIH07XG4gIH1cblxuICBpZiAoaXRlbS50eXBlID09PSBcInRleHRcIikge1xuICAgIGNvbnN0IHRleHQgPSBpdGVtIGFzIFBhcnRpYWw8VGV4dEl0ZW0+O1xuICAgIHJldHVybiB7XG4gICAgICBpZDogdGV4dC5pZCA/PyBjcmVhdGVJZChcInRleHRcIiksXG4gICAgICB0eXBlOiBcInRleHRcIixcbiAgICAgIGxheWVySWQ6IHR5cGVvZiB0ZXh0LmxheWVySWQgPT09IFwic3RyaW5nXCIgPyB0ZXh0LmxheWVySWQgOiBmYWxsYmFja0xheWVySWQsXG4gICAgICB4OiB0eXBlb2YgdGV4dC54ID09PSBcIm51bWJlclwiID8gdGV4dC54IDogMCxcbiAgICAgIHk6IHR5cGVvZiB0ZXh0LnkgPT09IFwibnVtYmVyXCIgPyB0ZXh0LnkgOiAwLFxuICAgICAgdGV4dDogdHlwZW9mIHRleHQudGV4dCA9PT0gXCJzdHJpbmdcIiA/IHRleHQudGV4dCA6IFwiXCIsXG4gICAgICBjb2xvcjogdHlwZW9mIHRleHQuY29sb3IgPT09IFwic3RyaW5nXCIgPyB0ZXh0LmNvbG9yIDogREVGQVVMVF9DT0xPUlNbMF0sXG4gICAgICBzaXplOiB0eXBlb2YgdGV4dC5zaXplID09PSBcIm51bWJlclwiID8gdGV4dC5zaXplIDogMjBcbiAgICB9O1xuICB9XG5cbiAgcmV0dXJuIG51bGw7XG59XG5cbmZ1bmN0aW9uIG1pZ3JhdGVOb2RlQm9hcmQoXG4gIG5vZGVzOiBBcnJheTxSZWNvcmQ8c3RyaW5nLCB1bmtub3duPj4sXG4gIHZpZXdwb3J0OiBQYXJ0aWFsPEVtYmVkZGVkV2hpdGVib2FyZERhdGFbXCJ2aWV3cG9ydFwiXT4gfCB1bmRlZmluZWRcbik6IEVtYmVkZGVkV2hpdGVib2FyZERhdGEge1xuICBjb25zdCBsYXllciA9IGNyZWF0ZUxheWVyKCk7XG4gIGNvbnN0IGl0ZW1zOiBUZXh0SXRlbVtdID0gbm9kZXNcbiAgICAuZmlsdGVyKChub2RlKSA9PiB0eXBlb2Ygbm9kZS5pZCA9PT0gXCJzdHJpbmdcIilcbiAgICAubWFwKChub2RlKSA9PiAoe1xuICAgICAgaWQ6IFN0cmluZyhub2RlLmlkKSxcbiAgICAgIHR5cGU6IFwidGV4dFwiLFxuICAgICAgbGF5ZXJJZDogbGF5ZXIuaWQsXG4gICAgICB4OiB0eXBlb2Ygbm9kZS54ID09PSBcIm51bWJlclwiID8gbm9kZS54IDogMCxcbiAgICAgIHk6IHR5cGVvZiBub2RlLnkgPT09IFwibnVtYmVyXCIgPyBub2RlLnkgOiAwLFxuICAgICAgdGV4dDogdHlwZW9mIG5vZGUudGV4dCA9PT0gXCJzdHJpbmdcIiA/IG5vZGUudGV4dCA6IFwiXCIsXG4gICAgICBjb2xvcjogdHlwZW9mIG5vZGUuY29sb3IgPT09IFwic3RyaW5nXCIgPyBub2RlLmNvbG9yIDogREVGQVVMVF9DT0xPUlNbMF0sXG4gICAgICBzaXplOiAxOFxuICAgIH0pKTtcblxuICByZXR1cm4ge1xuICAgIGxheWVyczogW2xheWVyXSxcbiAgICBpdGVtcyxcbiAgICB2aWV3cG9ydDoge1xuICAgICAgeDogdHlwZW9mIHZpZXdwb3J0Py54ID09PSBcIm51bWJlclwiID8gdmlld3BvcnQueCA6IDAsXG4gICAgICB5OiB0eXBlb2Ygdmlld3BvcnQ/LnkgPT09IFwibnVtYmVyXCIgPyB2aWV3cG9ydC55IDogMCxcbiAgICAgIHpvb206IHR5cGVvZiB2aWV3cG9ydD8uem9vbSA9PT0gXCJudW1iZXJcIiA/IHZpZXdwb3J0Lnpvb20gOiAxXG4gICAgfVxuICB9O1xufVxyXG4iLCAiaW1wb3J0IHsgTm90aWNlIH0gZnJvbSBcIm9ic2lkaWFuXCI7XG5pbXBvcnQge1xuICBjcmVhdGVEZWZhdWx0Qm9hcmQsXG4gIGNyZWF0ZUlkLFxuICBERUZBVUxUX0JPQVJEX0hFSUdIVCxcbiAgREVGQVVMVF9DT0xPUlMsXG4gIFRPT0xfUFJFU0VUU1xufSBmcm9tIFwiLi9zdGF0ZVwiO1xuaW1wb3J0IHtcbiAgRHJhd2luZ1Rvb2wsXG4gIEVtYmVkZGVkV2hpdGVib2FyZERhdGEsXG4gIFN0cm9rZUl0ZW0sXG4gIFN0cm9rZVBvaW50LFxuICBUZXh0SXRlbSxcbiAgV2hpdGVib2FyZEl0ZW0sXG4gIFdoaXRlYm9hcmRMYXllcixcbiAgV2hpdGVib2FyZFRvb2xcbn0gZnJvbSBcIi4vdHlwZXNcIjtcblxuaW50ZXJmYWNlIFdoaXRlYm9hcmRIb3N0IHtcbiAgc291cmNlUGF0aDogc3RyaW5nO1xuICBzYXZlKGJvYXJkOiBFbWJlZGRlZFdoaXRlYm9hcmREYXRhKTogUHJvbWlzZTx2b2lkPjtcbn1cblxuaW50ZXJmYWNlIFdoaXRlYm9hcmRIYW5kbGUge1xuICBkZXN0cm95KCk6IHZvaWQ7XG59XG5cbnR5cGUgUG9pbnRlck1vZGUgPVxuICB8IHsgdHlwZTogXCJpZGxlXCIgfVxuICB8IHsgdHlwZTogXCJwYW5cIjsgc3RhcnRYOiBudW1iZXI7IHN0YXJ0WTogbnVtYmVyOyBvcmlnaW5YOiBudW1iZXI7IG9yaWdpblk6IG51bWJlciB9XG4gIHwgeyB0eXBlOiBcImRyYXdcIjsgcG9pbnRlcklkOiBudW1iZXIgfVxuICB8IHtcbiAgICAgIHR5cGU6IFwibW92ZVwiO1xuICAgICAgcG9pbnRlcklkOiBudW1iZXI7XG4gICAgICBpdGVtSWQ6IHN0cmluZztcbiAgICAgIHN0YXJ0WDogbnVtYmVyO1xuICAgICAgc3RhcnRZOiBudW1iZXI7XG4gICAgICBvcmlnaW5UZXh0PzogeyB4OiBudW1iZXI7IHk6IG51bWJlciB9O1xuICAgICAgb3JpZ2luUG9pbnRzPzogU3Ryb2tlUG9pbnRbXTtcbiAgICB9XG4gIHwgeyB0eXBlOiBcImVyYXNlXCI7IHBvaW50ZXJJZDogbnVtYmVyOyByZW1vdmVkOiBib29sZWFuIH07XG5cbmNvbnN0IFRPT0xfTEFCRUxTOiBSZWNvcmQ8V2hpdGVib2FyZFRvb2wsIHN0cmluZz4gPSB7XG4gIHBlbjogXCJQZW5cIixcbiAgcGVuY2lsOiBcIlBlbmNpbFwiLFxuICBtYXJrZXI6IFwiTWFya2VyXCIsXG4gIGVyYXNlcjogXCJFcmFzZXJcIixcbiAgdGV4dDogXCJUZXh0XCIsXG4gIHNlbGVjdDogXCJTZWxlY3RcIixcbiAgaGFuZDogXCJIYW5kXCJcbn07XG5cbmV4cG9ydCBmdW5jdGlvbiBtb3VudFdoaXRlYm9hcmQoXG4gIGNvbnRhaW5lcjogSFRNTEVsZW1lbnQsXG4gIGluaXRpYWxCb2FyZDogRW1iZWRkZWRXaGl0ZWJvYXJkRGF0YSxcbiAgaG9zdDogV2hpdGVib2FyZEhvc3Rcbik6IFdoaXRlYm9hcmRIYW5kbGUge1xuICBjb250YWluZXIuZW1wdHkoKTtcbiAgY29udGFpbmVyLmFkZENsYXNzKFwiZW1iZWRkZWQtd2hpdGVib2FyZFwiKTtcblxuICBjb25zdCByb290ID0gY29udGFpbmVyLmNyZWF0ZURpdih7IGNsczogXCJlbWJlZGRlZC13aGl0ZWJvYXJkX19zaGVsbFwiIH0pO1xuICBjb25zdCB0b29sYmFyID0gcm9vdC5jcmVhdGVEaXYoeyBjbHM6IFwiZW1iZWRkZWQtd2hpdGVib2FyZF9fdG9vbGJhclwiIH0pO1xuICBjb25zdCB3b3Jrc3BhY2UgPSByb290LmNyZWF0ZURpdih7IGNsczogXCJlbWJlZGRlZC13aGl0ZWJvYXJkX193b3Jrc3BhY2VcIiB9KTtcbiAgY29uc3Qgdmlld3BvcnQgPSB3b3Jrc3BhY2UuY3JlYXRlRGl2KHsgY2xzOiBcImVtYmVkZGVkLXdoaXRlYm9hcmRfX3ZpZXdwb3J0XCIgfSk7XG4gIGNvbnN0IGdyaWQgPSB2aWV3cG9ydC5jcmVhdGVEaXYoeyBjbHM6IFwiZW1iZWRkZWQtd2hpdGVib2FyZF9fZ3JpZFwiIH0pO1xuICBjb25zdCBzY2VuZSA9IHZpZXdwb3J0LmNyZWF0ZUVsKFwic3ZnXCIsIHsgY2xzOiBcImVtYmVkZGVkLXdoaXRlYm9hcmRfX3NjZW5lXCIgfSk7XG4gIGNvbnN0IHN0cm9rZUxheWVyID0gc2NlbmUuY3JlYXRlRWwoXCJnXCIsIHsgY2xzOiBcImVtYmVkZGVkLXdoaXRlYm9hcmRfX3N0cm9rZS1sYXllclwiIH0pO1xuICBjb25zdCBkcmFmdExheWVyID0gc2NlbmUuY3JlYXRlRWwoXCJnXCIsIHsgY2xzOiBcImVtYmVkZGVkLXdoaXRlYm9hcmRfX2RyYWZ0LWxheWVyXCIgfSk7XG4gIGNvbnN0IGRyYWZ0UGF0aCA9IGRyYWZ0TGF5ZXIuY3JlYXRlRWwoXCJwYXRoXCIsIHsgY2xzOiBcImVtYmVkZGVkLXdoaXRlYm9hcmRfX2RyYWZ0LXBhdGhcIiB9KTtcbiAgY29uc3QgdGV4dFdvcmxkID0gdmlld3BvcnQuY3JlYXRlRGl2KHsgY2xzOiBcImVtYmVkZGVkLXdoaXRlYm9hcmRfX3RleHQtd29ybGRcIiB9KTtcbiAgY29uc3Qgc2lkZWJhciA9IHdvcmtzcGFjZS5jcmVhdGVEaXYoeyBjbHM6IFwiZW1iZWRkZWQtd2hpdGVib2FyZF9fc2lkZWJhclwiIH0pO1xuICBjb25zdCBsYXllckhlYWRlciA9IHNpZGViYXIuY3JlYXRlRGl2KHsgY2xzOiBcImVtYmVkZGVkLXdoaXRlYm9hcmRfX3NpZGViYXItaGVhZGVyXCIgfSk7XG4gIGxheWVySGVhZGVyLmNyZWF0ZVNwYW4oeyB0ZXh0OiBcIkxheWVyc1wiIH0pO1xuICBjb25zdCBhZGRMYXllckJ1dHRvbiA9IGxheWVySGVhZGVyLmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHtcbiAgICBjbHM6IFwiZW1iZWRkZWQtd2hpdGVib2FyZF9fbWluaS1idXR0b25cIixcbiAgICB0ZXh0OiBcIisgTGF5ZXJcIlxuICB9KTtcbiAgYWRkTGF5ZXJCdXR0b24udHlwZSA9IFwiYnV0dG9uXCI7XG4gIGNvbnN0IGxheWVyc0xpc3QgPSBzaWRlYmFyLmNyZWF0ZURpdih7IGNsczogXCJlbWJlZGRlZC13aGl0ZWJvYXJkX19sYXllcnNcIiB9KTtcbiAgY29uc3Qgc3RhdHVzID0gdG9vbGJhci5jcmVhdGVEaXYoeyBjbHM6IFwiZW1iZWRkZWQtd2hpdGVib2FyZF9fc3RhdHVzXCIsIHRleHQ6IFwiUmVhZHlcIiB9KTtcblxuICBsZXQgYm9hcmQgPSBzdHJ1Y3R1cmVkQ2xvbmUoaW5pdGlhbEJvYXJkKTtcbiAgaWYgKGJvYXJkLmxheWVycy5sZW5ndGggPT09IDApIHtcbiAgICBib2FyZCA9IGNyZWF0ZURlZmF1bHRCb2FyZCgpO1xuICB9XG5cbiAgbGV0IGFjdGl2ZVRvb2w6IFdoaXRlYm9hcmRUb29sID0gXCJwZW5cIjtcbiAgbGV0IGFjdGl2ZUNvbG9yID0gREVGQVVMVF9DT0xPUlNbMF07XG4gIGxldCBicnVzaFNpemUgPSBUT09MX1BSRVNFVFMucGVuLndpZHRoO1xuICBsZXQgb3BhY2l0eSA9IFRPT0xfUFJFU0VUUy5wZW4ub3BhY2l0eTtcbiAgbGV0IGFjdGl2ZUxheWVySWQgPSBib2FyZC5sYXllcnNbMF0uaWQ7XG4gIGxldCBzZWxlY3RlZEl0ZW1JZDogc3RyaW5nIHwgbnVsbCA9IG51bGw7XG4gIGxldCBwb2ludGVyTW9kZTogUG9pbnRlck1vZGUgPSB7IHR5cGU6IFwiaWRsZVwiIH07XG4gIGxldCBkcmFmdFN0cm9rZTogU3Ryb2tlSXRlbSB8IG51bGwgPSBudWxsO1xuICBsZXQgc2F2ZVRpbWVyOiBudW1iZXIgfCBudWxsID0gbnVsbDtcbiAgbGV0IGRlc3Ryb3llZCA9IGZhbHNlO1xuICBsZXQgYWN0aXZlVGV4dEVkaXRvcjogSFRNTFRleHRBcmVhRWxlbWVudCB8IG51bGwgPSBudWxsO1xuICBsZXQgaGlzdG9yeSA9IFtzdHJ1Y3R1cmVkQ2xvbmUoYm9hcmQpXTtcbiAgbGV0IGhpc3RvcnlJbmRleCA9IDA7XG5cbiAgY29uc3QgdG9vbEJ1dHRvbnMgPSBuZXcgTWFwPFdoaXRlYm9hcmRUb29sLCBIVE1MQnV0dG9uRWxlbWVudD4oKTtcbiAgY29uc3QgdW5kb0J1dHRvbiA9IHRvb2xiYXIuY3JlYXRlRWwoXCJidXR0b25cIiwgeyBjbHM6IFwiZW1iZWRkZWQtd2hpdGVib2FyZF9fYnV0dG9uXCIsIHRleHQ6IFwiVW5kb1wiIH0pO1xuICB1bmRvQnV0dG9uLnR5cGUgPSBcImJ1dHRvblwiO1xuICBjb25zdCByZWRvQnV0dG9uID0gdG9vbGJhci5jcmVhdGVFbChcImJ1dHRvblwiLCB7IGNsczogXCJlbWJlZGRlZC13aGl0ZWJvYXJkX19idXR0b25cIiwgdGV4dDogXCJSZWRvXCIgfSk7XG4gIHJlZG9CdXR0b24udHlwZSA9IFwiYnV0dG9uXCI7XG5cbiAgY29uc3QgdG9vbE9yZGVyOiBXaGl0ZWJvYXJkVG9vbFtdID0gW1wicGVuXCIsIFwicGVuY2lsXCIsIFwibWFya2VyXCIsIFwiZXJhc2VyXCIsIFwidGV4dFwiLCBcInNlbGVjdFwiLCBcImhhbmRcIl07XG4gIGZvciAoY29uc3QgdG9vbCBvZiB0b29sT3JkZXIpIHtcbiAgICBjb25zdCBidXR0b24gPSB0b29sYmFyLmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHtcbiAgICAgIGNsczogXCJlbWJlZGRlZC13aGl0ZWJvYXJkX19idXR0b24gZW1iZWRkZWQtd2hpdGVib2FyZF9fdG9vbC1idXR0b25cIixcbiAgICAgIHRleHQ6IFRPT0xfTEFCRUxTW3Rvb2xdXG4gICAgfSk7XG4gICAgYnV0dG9uLnR5cGUgPSBcImJ1dHRvblwiO1xuICAgIGJ1dHRvbi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKCkgPT4gc2V0QWN0aXZlVG9vbCh0b29sKSk7XG4gICAgdG9vbEJ1dHRvbnMuc2V0KHRvb2wsIGJ1dHRvbik7XG4gIH1cblxuICBjb25zdCBjb2xvcklucHV0ID0gdG9vbGJhci5jcmVhdGVFbChcImlucHV0XCIsIHsgY2xzOiBcImVtYmVkZGVkLXdoaXRlYm9hcmRfX2NvbG9yLWlucHV0XCIgfSk7XG4gIGNvbG9ySW5wdXQudHlwZSA9IFwiY29sb3JcIjtcbiAgY29sb3JJbnB1dC52YWx1ZSA9IGFjdGl2ZUNvbG9yO1xuXG4gIGNvbnN0IHN3YXRjaGVzID0gdG9vbGJhci5jcmVhdGVEaXYoeyBjbHM6IFwiZW1iZWRkZWQtd2hpdGVib2FyZF9fc3dhdGNoZXNcIiB9KTtcbiAgZm9yIChjb25zdCBjb2xvciBvZiBERUZBVUxUX0NPTE9SUykge1xuICAgIGNvbnN0IHN3YXRjaCA9IHN3YXRjaGVzLmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHsgY2xzOiBcImVtYmVkZGVkLXdoaXRlYm9hcmRfX3N3YXRjaFwiIH0pO1xuICAgIHN3YXRjaC50eXBlID0gXCJidXR0b25cIjtcbiAgICBzd2F0Y2guc3R5bGUuYmFja2dyb3VuZENvbG9yID0gY29sb3I7XG4gICAgc3dhdGNoLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoKSA9PiB7XG4gICAgICBhY3RpdmVDb2xvciA9IGNvbG9yO1xuICAgICAgY29sb3JJbnB1dC52YWx1ZSA9IGNvbG9yO1xuICAgICAgdXBkYXRlVG9vbGJhcigpO1xuICAgIH0pO1xuICB9XG5cbiAgY29uc3Qgc2l6ZUlucHV0ID0gdG9vbGJhci5jcmVhdGVFbChcImlucHV0XCIsIHsgY2xzOiBcImVtYmVkZGVkLXdoaXRlYm9hcmRfX3JhbmdlXCIgfSk7XG4gIHNpemVJbnB1dC50eXBlID0gXCJyYW5nZVwiO1xuICBzaXplSW5wdXQubWluID0gXCIxXCI7XG4gIHNpemVJbnB1dC5tYXggPSBcIjM2XCI7XG4gIHNpemVJbnB1dC52YWx1ZSA9IFN0cmluZyhicnVzaFNpemUpO1xuXG4gIGNvbnN0IG9wYWNpdHlJbnB1dCA9IHRvb2xiYXIuY3JlYXRlRWwoXCJpbnB1dFwiLCB7IGNsczogXCJlbWJlZGRlZC13aGl0ZWJvYXJkX19yYW5nZVwiIH0pO1xuICBvcGFjaXR5SW5wdXQudHlwZSA9IFwicmFuZ2VcIjtcbiAgb3BhY2l0eUlucHV0Lm1pbiA9IFwiMC4xXCI7XG4gIG9wYWNpdHlJbnB1dC5tYXggPSBcIjFcIjtcbiAgb3BhY2l0eUlucHV0LnN0ZXAgPSBcIjAuMDVcIjtcbiAgb3BhY2l0eUlucHV0LnZhbHVlID0gU3RyaW5nKG9wYWNpdHkpO1xuXG4gIHRvb2xiYXIuYXBwZW5kQ2hpbGQoc3RhdHVzKTtcbiAgdmlld3BvcnQuc3R5bGUubWluSGVpZ2h0ID0gYCR7REVGQVVMVF9CT0FSRF9IRUlHSFR9cHhgO1xuXG4gIHVuZG9CdXR0b24uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IHVuZG8oKSk7XG4gIHJlZG9CdXR0b24uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IHJlZG8oKSk7XG4gIGFkZExheWVyQnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoKSA9PiBhZGRMYXllcigpKTtcbiAgY29sb3JJbnB1dC5hZGRFdmVudExpc3RlbmVyKFwiaW5wdXRcIiwgKCkgPT4ge1xuICAgIGFjdGl2ZUNvbG9yID0gY29sb3JJbnB1dC52YWx1ZTtcbiAgfSk7XG4gIHNpemVJbnB1dC5hZGRFdmVudExpc3RlbmVyKFwiaW5wdXRcIiwgKCkgPT4ge1xuICAgIGJydXNoU2l6ZSA9IE51bWJlcihzaXplSW5wdXQudmFsdWUpO1xuICB9KTtcbiAgb3BhY2l0eUlucHV0LmFkZEV2ZW50TGlzdGVuZXIoXCJpbnB1dFwiLCAoKSA9PiB7XG4gICAgb3BhY2l0eSA9IE51bWJlcihvcGFjaXR5SW5wdXQudmFsdWUpO1xuICB9KTtcblxuICBmdW5jdGlvbiBzZXRBY3RpdmVUb29sKHRvb2w6IFdoaXRlYm9hcmRUb29sKTogdm9pZCB7XG4gICAgYWN0aXZlVG9vbCA9IHRvb2w7XG4gICAgaWYgKHRvb2wgPT09IFwicGVuXCIgfHwgdG9vbCA9PT0gXCJwZW5jaWxcIiB8fCB0b29sID09PSBcIm1hcmtlclwiKSB7XG4gICAgICBicnVzaFNpemUgPSBUT09MX1BSRVNFVFNbdG9vbF0ud2lkdGg7XG4gICAgICBvcGFjaXR5ID0gVE9PTF9QUkVTRVRTW3Rvb2xdLm9wYWNpdHk7XG4gICAgICBzaXplSW5wdXQudmFsdWUgPSBTdHJpbmcoYnJ1c2hTaXplKTtcbiAgICAgIG9wYWNpdHlJbnB1dC52YWx1ZSA9IFN0cmluZyhvcGFjaXR5KTtcbiAgICB9XG4gICAgdXBkYXRlVG9vbGJhcigpO1xuICAgIHVwZGF0ZVN0YXR1cyhgJHtUT09MX0xBQkVMU1t0b29sXX0gcmVhZHlgKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHVwZGF0ZVRvb2xiYXIoKTogdm9pZCB7XG4gICAgZm9yIChjb25zdCBbdG9vbCwgYnV0dG9uXSBvZiB0b29sQnV0dG9ucykge1xuICAgICAgYnV0dG9uLnRvZ2dsZUNsYXNzKFwiaXMtYWN0aXZlXCIsIHRvb2wgPT09IGFjdGl2ZVRvb2wpO1xuICAgIH1cbiAgICB1bmRvQnV0dG9uLmRpc2FibGVkID0gaGlzdG9yeUluZGV4ID09PSAwO1xuICAgIHJlZG9CdXR0b24uZGlzYWJsZWQgPSBoaXN0b3J5SW5kZXggPT09IGhpc3RvcnkubGVuZ3RoIC0gMTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHVwZGF0ZVN0YXR1cyhtZXNzYWdlID0gXCJSZWFkeVwiKTogdm9pZCB7XG4gICAgc3RhdHVzLnNldFRleHQobWVzc2FnZSk7XG4gIH1cblxuICBmdW5jdGlvbiBxdWV1ZVNhdmUoKTogdm9pZCB7XG4gICAgaWYgKGRlc3Ryb3llZCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmIChzYXZlVGltZXIgIT09IG51bGwpIHtcbiAgICAgIHdpbmRvdy5jbGVhclRpbWVvdXQoc2F2ZVRpbWVyKTtcbiAgICB9XG5cbiAgICBzYXZlVGltZXIgPSB3aW5kb3cuc2V0VGltZW91dChhc3luYyAoKSA9PiB7XG4gICAgICBzYXZlVGltZXIgPSBudWxsO1xuICAgICAgdHJ5IHtcbiAgICAgICAgYXdhaXQgaG9zdC5zYXZlKHN0cnVjdHVyZWRDbG9uZShib2FyZCkpO1xuICAgICAgICB1cGRhdGVTdGF0dXMoXCJTYXZlZFwiKTtcbiAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoZXJyb3IpO1xuICAgICAgICBuZXcgTm90aWNlKFwiVW5hYmxlIHRvIHNhdmUgZW1iZWRkZWQgd2hpdGVib2FyZFwiKTtcbiAgICAgICAgdXBkYXRlU3RhdHVzKFwiU2F2ZSBmYWlsZWRcIik7XG4gICAgICB9XG4gICAgfSwgMTYwKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHB1c2hIaXN0b3J5KCk6IHZvaWQge1xuICAgIGNvbnN0IHNuYXBzaG90ID0gc3RydWN0dXJlZENsb25lKGJvYXJkKTtcbiAgICBoaXN0b3J5ID0gaGlzdG9yeS5zbGljZSgwLCBoaXN0b3J5SW5kZXggKyAxKTtcbiAgICBoaXN0b3J5LnB1c2goc25hcHNob3QpO1xuICAgIGhpc3RvcnlJbmRleCA9IGhpc3RvcnkubGVuZ3RoIC0gMTtcbiAgICB1cGRhdGVUb29sYmFyKCk7XG4gIH1cblxuICBmdW5jdGlvbiB1bmRvKCk6IHZvaWQge1xuICAgIGlmIChoaXN0b3J5SW5kZXggPT09IDApIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgaGlzdG9yeUluZGV4IC09IDE7XG4gICAgYm9hcmQgPSBzdHJ1Y3R1cmVkQ2xvbmUoaGlzdG9yeVtoaXN0b3J5SW5kZXhdKTtcbiAgICBlbnN1cmVBY3RpdmVMYXllcigpO1xuICAgIHNlbGVjdGVkSXRlbUlkID0gbnVsbDtcbiAgICByZW5kZXJCb2FyZCgpO1xuICAgIHF1ZXVlU2F2ZSgpO1xuICB9XG5cbiAgZnVuY3Rpb24gcmVkbygpOiB2b2lkIHtcbiAgICBpZiAoaGlzdG9yeUluZGV4ID49IGhpc3RvcnkubGVuZ3RoIC0gMSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBoaXN0b3J5SW5kZXggKz0gMTtcbiAgICBib2FyZCA9IHN0cnVjdHVyZWRDbG9uZShoaXN0b3J5W2hpc3RvcnlJbmRleF0pO1xuICAgIGVuc3VyZUFjdGl2ZUxheWVyKCk7XG4gICAgc2VsZWN0ZWRJdGVtSWQgPSBudWxsO1xuICAgIHJlbmRlckJvYXJkKCk7XG4gICAgcXVldWVTYXZlKCk7XG4gIH1cblxuICBmdW5jdGlvbiBlbnN1cmVBY3RpdmVMYXllcigpOiB2b2lkIHtcbiAgICBpZiAoIWJvYXJkLmxheWVycy5zb21lKChsYXllcikgPT4gbGF5ZXIuaWQgPT09IGFjdGl2ZUxheWVySWQpKSB7XG4gICAgICBhY3RpdmVMYXllcklkID0gYm9hcmQubGF5ZXJzWzBdPy5pZCA/PyBjcmVhdGVEZWZhdWx0Qm9hcmQoKS5sYXllcnNbMF0uaWQ7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gZ2V0TGF5ZXIobGF5ZXJJZDogc3RyaW5nKTogV2hpdGVib2FyZExheWVyIHwgdW5kZWZpbmVkIHtcbiAgICByZXR1cm4gYm9hcmQubGF5ZXJzLmZpbmQoKGxheWVyKSA9PiBsYXllci5pZCA9PT0gbGF5ZXJJZCk7XG4gIH1cblxuICBmdW5jdGlvbiBnZXRJdGVtKGl0ZW1JZDogc3RyaW5nKTogV2hpdGVib2FyZEl0ZW0gfCB1bmRlZmluZWQge1xuICAgIHJldHVybiBib2FyZC5pdGVtcy5maW5kKChpdGVtKSA9PiBpdGVtLmlkID09PSBpdGVtSWQpO1xuICB9XG5cbiAgZnVuY3Rpb24gaXNMYXllclZpc2libGUobGF5ZXJJZDogc3RyaW5nKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIGdldExheWVyKGxheWVySWQpPy52aXNpYmxlICE9PSBmYWxzZTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGlzTGF5ZXJMb2NrZWQobGF5ZXJJZDogc3RyaW5nKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIGdldExheWVyKGxheWVySWQpPy5sb2NrZWQgPT09IHRydWU7XG4gIH1cblxuICBmdW5jdGlvbiBhcHBseVZpZXdwb3J0KCk6IHZvaWQge1xuICAgIHNjZW5lLnN0eWxlLnRyYW5zZm9ybSA9IGB0cmFuc2xhdGUoJHtib2FyZC52aWV3cG9ydC54fXB4LCAke2JvYXJkLnZpZXdwb3J0Lnl9cHgpIHNjYWxlKCR7Ym9hcmQudmlld3BvcnQuem9vbX0pYDtcbiAgICB0ZXh0V29ybGQuc3R5bGUudHJhbnNmb3JtID0gYHRyYW5zbGF0ZSgke2JvYXJkLnZpZXdwb3J0Lnh9cHgsICR7Ym9hcmQudmlld3BvcnQueX1weCkgc2NhbGUoJHtib2FyZC52aWV3cG9ydC56b29tfSlgO1xuICAgIGNvbnN0IGdyaWRTaXplID0gNDggKiBib2FyZC52aWV3cG9ydC56b29tO1xuICAgIGdyaWQuc3R5bGUuYmFja2dyb3VuZFNpemUgPSBgJHtncmlkU2l6ZX1weCAke2dyaWRTaXplfXB4YDtcbiAgICBncmlkLnN0eWxlLmJhY2tncm91bmRQb3NpdGlvbiA9IGAke2JvYXJkLnZpZXdwb3J0Lnh9cHggJHtib2FyZC52aWV3cG9ydC55fXB4YDtcbiAgfVxuXG4gIGZ1bmN0aW9uIHJlbmRlckxheWVycygpOiB2b2lkIHtcbiAgICBsYXllcnNMaXN0LmVtcHR5KCk7XG5cbiAgICBmb3IgKGNvbnN0IGxheWVyIG9mIFsuLi5ib2FyZC5sYXllcnNdLnJldmVyc2UoKSkge1xuICAgICAgY29uc3Qgcm93ID0gbGF5ZXJzTGlzdC5jcmVhdGVEaXYoeyBjbHM6IFwiZW1iZWRkZWQtd2hpdGVib2FyZF9fbGF5ZXItcm93XCIgfSk7XG4gICAgICByb3cudG9nZ2xlQ2xhc3MoXCJpcy1hY3RpdmVcIiwgbGF5ZXIuaWQgPT09IGFjdGl2ZUxheWVySWQpO1xuXG4gICAgICBjb25zdCB2aXNpYmlsaXR5QnV0dG9uID0gcm93LmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHtcbiAgICAgICAgY2xzOiBcImVtYmVkZGVkLXdoaXRlYm9hcmRfX2xheWVyLXZpc2liaWxpdHlcIixcbiAgICAgICAgdGV4dDogbGF5ZXIudmlzaWJsZSA/IFwiSGlkZVwiIDogXCJTaG93XCJcbiAgICAgIH0pO1xuICAgICAgdmlzaWJpbGl0eUJ1dHRvbi50eXBlID0gXCJidXR0b25cIjtcbiAgICAgIHZpc2liaWxpdHlCdXR0b24uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IHtcbiAgICAgICAgbGF5ZXIudmlzaWJsZSA9ICFsYXllci52aXNpYmxlO1xuICAgICAgICByZW5kZXJCb2FyZCgpO1xuICAgICAgICBwdXNoSGlzdG9yeSgpO1xuICAgICAgICBxdWV1ZVNhdmUoKTtcbiAgICAgIH0pO1xuXG4gICAgICBjb25zdCBsb2NrQnV0dG9uID0gcm93LmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHtcbiAgICAgICAgY2xzOiBcImVtYmVkZGVkLXdoaXRlYm9hcmRfX2xheWVyLWxvY2tcIixcbiAgICAgICAgdGV4dDogbGF5ZXIubG9ja2VkID8gXCJVbmxvY2tcIiA6IFwiTG9ja1wiXG4gICAgICB9KTtcbiAgICAgIGxvY2tCdXR0b24udHlwZSA9IFwiYnV0dG9uXCI7XG4gICAgICBsb2NrQnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoKSA9PiB7XG4gICAgICAgIGxheWVyLmxvY2tlZCA9ICFsYXllci5sb2NrZWQ7XG4gICAgICAgIHJlbmRlckJvYXJkKCk7XG4gICAgICAgIHB1c2hIaXN0b3J5KCk7XG4gICAgICAgIHF1ZXVlU2F2ZSgpO1xuICAgICAgfSk7XG5cbiAgICAgIGNvbnN0IG5hbWVCdXR0b24gPSByb3cuY3JlYXRlRWwoXCJidXR0b25cIiwge1xuICAgICAgICBjbHM6IFwiZW1iZWRkZWQtd2hpdGVib2FyZF9fbGF5ZXItbmFtZVwiLFxuICAgICAgICB0ZXh0OiBsYXllci5uYW1lXG4gICAgICB9KTtcbiAgICAgIG5hbWVCdXR0b24udHlwZSA9IFwiYnV0dG9uXCI7XG4gICAgICBuYW1lQnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoKSA9PiB7XG4gICAgICAgIGFjdGl2ZUxheWVySWQgPSBsYXllci5pZDtcbiAgICAgICAgcmVuZGVyTGF5ZXJzKCk7XG4gICAgICAgIHVwZGF0ZVN0YXR1cyhgQWN0aXZlIGxheWVyOiAke2xheWVyLm5hbWV9YCk7XG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiByZW5kZXJCb2FyZCgpOiB2b2lkIHtcbiAgICBjbGVhbnVwVGV4dEVkaXRvcigpO1xuICAgIGFwcGx5Vmlld3BvcnQoKTtcbiAgICByZW5kZXJJdGVtcygpO1xuICAgIHJlbmRlckxheWVycygpO1xuICAgIHVwZGF0ZVRvb2xiYXIoKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHJlbmRlckl0ZW1zKCk6IHZvaWQge1xuICAgIHN0cm9rZUxheWVyLmVtcHR5KCk7XG4gICAgdGV4dFdvcmxkLmVtcHR5KCk7XG5cbiAgICBmb3IgKGNvbnN0IGl0ZW0gb2YgYm9hcmQuaXRlbXMpIHtcbiAgICAgIGlmICghaXNMYXllclZpc2libGUoaXRlbS5sYXllcklkKSkge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgaWYgKGl0ZW0udHlwZSA9PT0gXCJzdHJva2VcIikge1xuICAgICAgICBjb25zdCBwYXRoID0gc3Ryb2tlTGF5ZXIuY3JlYXRlRWwoXCJwYXRoXCIsIHsgY2xzOiBcImVtYmVkZGVkLXdoaXRlYm9hcmRfX3N0cm9rZVwiIH0pO1xuICAgICAgICBwYXRoLnNldEF0dHJpYnV0ZShcImRcIiwgcG9pbnRzVG9QYXRoKGl0ZW0ucG9pbnRzKSk7XG4gICAgICAgIHBhdGguc2V0QXR0cmlidXRlKFwic3Ryb2tlXCIsIGl0ZW0uY29sb3IpO1xuICAgICAgICBwYXRoLnNldEF0dHJpYnV0ZShcInN0cm9rZS13aWR0aFwiLCBTdHJpbmcoaXRlbS53aWR0aCkpO1xuICAgICAgICBwYXRoLnNldEF0dHJpYnV0ZShcInN0cm9rZS1saW5lY2FwXCIsIFwicm91bmRcIik7XG4gICAgICAgIHBhdGguc2V0QXR0cmlidXRlKFwic3Ryb2tlLWxpbmVqb2luXCIsIFwicm91bmRcIik7XG4gICAgICAgIHBhdGguc2V0QXR0cmlidXRlKFwiZmlsbFwiLCBcIm5vbmVcIik7XG4gICAgICAgIHBhdGguc3R5bGUub3BhY2l0eSA9IFN0cmluZyhpdGVtLm9wYWNpdHkpO1xuICAgICAgICBwYXRoLmRhdGFzZXQuaXRlbUlkID0gaXRlbS5pZDtcbiAgICAgICAgcGF0aC5kYXRhc2V0LnRvb2wgPSBpdGVtLnRvb2w7XG4gICAgICAgIHBhdGgudG9nZ2xlQ2xhc3MoXCJpcy1zZWxlY3RlZFwiLCBpdGVtLmlkID09PSBzZWxlY3RlZEl0ZW1JZCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25zdCB0ZXh0RWwgPSB0ZXh0V29ybGQuY3JlYXRlRGl2KHsgY2xzOiBcImVtYmVkZGVkLXdoaXRlYm9hcmRfX3RleHQtaXRlbVwiIH0pO1xuICAgICAgICB0ZXh0RWwuZGF0YXNldC5pdGVtSWQgPSBpdGVtLmlkO1xuICAgICAgICB0ZXh0RWwuc3R5bGUubGVmdCA9IGAke2l0ZW0ueH1weGA7XG4gICAgICAgIHRleHRFbC5zdHlsZS50b3AgPSBgJHtpdGVtLnl9cHhgO1xuICAgICAgICB0ZXh0RWwuc3R5bGUuY29sb3IgPSBpdGVtLmNvbG9yO1xuICAgICAgICB0ZXh0RWwuc3R5bGUuZm9udFNpemUgPSBgJHtpdGVtLnNpemV9cHhgO1xuICAgICAgICB0ZXh0RWwuc3R5bGUud2hpdGVTcGFjZSA9IFwicHJlLXdyYXBcIjtcbiAgICAgICAgdGV4dEVsLnNldFRleHQoaXRlbS50ZXh0IHx8IFwiVGV4dFwiKTtcbiAgICAgICAgdGV4dEVsLnRvZ2dsZUNsYXNzKFwiaXMtc2VsZWN0ZWRcIiwgaXRlbS5pZCA9PT0gc2VsZWN0ZWRJdGVtSWQpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIHJlbmRlckRyYWZ0U3Ryb2tlKCk6IHZvaWQge1xuICAgIGlmICghZHJhZnRTdHJva2UpIHtcbiAgICAgIGRyYWZ0UGF0aC5zZXRBdHRyaWJ1dGUoXCJkXCIsIFwiXCIpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGRyYWZ0UGF0aC5zZXRBdHRyaWJ1dGUoXCJkXCIsIHBvaW50c1RvUGF0aChkcmFmdFN0cm9rZS5wb2ludHMpKTtcbiAgICBkcmFmdFBhdGguc2V0QXR0cmlidXRlKFwic3Ryb2tlXCIsIGRyYWZ0U3Ryb2tlLmNvbG9yKTtcbiAgICBkcmFmdFBhdGguc2V0QXR0cmlidXRlKFwic3Ryb2tlLXdpZHRoXCIsIFN0cmluZyhkcmFmdFN0cm9rZS53aWR0aCkpO1xuICAgIGRyYWZ0UGF0aC5zZXRBdHRyaWJ1dGUoXCJzdHJva2UtbGluZWNhcFwiLCBcInJvdW5kXCIpO1xuICAgIGRyYWZ0UGF0aC5zZXRBdHRyaWJ1dGUoXCJzdHJva2UtbGluZWpvaW5cIiwgXCJyb3VuZFwiKTtcbiAgICBkcmFmdFBhdGguc2V0QXR0cmlidXRlKFwiZmlsbFwiLCBcIm5vbmVcIik7XG4gICAgZHJhZnRQYXRoLnN0eWxlLm9wYWNpdHkgPSBTdHJpbmcoZHJhZnRTdHJva2Uub3BhY2l0eSk7XG4gIH1cblxuICBmdW5jdGlvbiBjbGVhbnVwVGV4dEVkaXRvcigpOiB2b2lkIHtcbiAgICBpZiAoYWN0aXZlVGV4dEVkaXRvcikge1xuICAgICAgYWN0aXZlVGV4dEVkaXRvci5yZW1vdmUoKTtcbiAgICAgIGFjdGl2ZVRleHRFZGl0b3IgPSBudWxsO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIG9wZW5UZXh0RWRpdG9yKHBvaW50OiB7IHg6IG51bWJlcjsgeTogbnVtYmVyIH0sIGV4aXN0aW5nPzogVGV4dEl0ZW0pOiB2b2lkIHtcbiAgICBjbGVhbnVwVGV4dEVkaXRvcigpO1xuXG4gICAgY29uc3QgZWRpdG9yID0gdGV4dFdvcmxkLmNyZWF0ZUVsKFwidGV4dGFyZWFcIiwgeyBjbHM6IFwiZW1iZWRkZWQtd2hpdGVib2FyZF9fdGV4dC1lZGl0b3JcIiB9KTtcbiAgICBlZGl0b3IudmFsdWUgPSBleGlzdGluZz8udGV4dCA/PyBcIlwiO1xuICAgIGVkaXRvci5zdHlsZS5sZWZ0ID0gYCR7ZXhpc3Rpbmc/LnggPz8gcG9pbnQueH1weGA7XG4gICAgZWRpdG9yLnN0eWxlLnRvcCA9IGAke2V4aXN0aW5nPy55ID8/IHBvaW50Lnl9cHhgO1xuICAgIGVkaXRvci5zdHlsZS5jb2xvciA9IGV4aXN0aW5nPy5jb2xvciA/PyBhY3RpdmVDb2xvcjtcbiAgICBlZGl0b3Iuc3R5bGUuZm9udFNpemUgPSBgJHtleGlzdGluZz8uc2l6ZSA/PyAyMH1weGA7XG4gICAgYWN0aXZlVGV4dEVkaXRvciA9IGVkaXRvcjtcbiAgICBlZGl0b3IuZm9jdXMoKTtcblxuICAgIGNvbnN0IGNvbW1pdCA9ICgpOiB2b2lkID0+IHtcbiAgICAgIGNvbnN0IHRleHQgPSBlZGl0b3IudmFsdWUudHJpbUVuZCgpO1xuICAgICAgY29uc3QgdGFyZ2V0ID0gZXhpc3RpbmcgPz8ge1xuICAgICAgICBpZDogY3JlYXRlSWQoXCJ0ZXh0XCIpLFxuICAgICAgICB0eXBlOiBcInRleHRcIiBhcyBjb25zdCxcbiAgICAgICAgbGF5ZXJJZDogYWN0aXZlTGF5ZXJJZCxcbiAgICAgICAgeDogcG9pbnQueCxcbiAgICAgICAgeTogcG9pbnQueSxcbiAgICAgICAgdGV4dDogXCJcIixcbiAgICAgICAgY29sb3I6IGFjdGl2ZUNvbG9yLFxuICAgICAgICBzaXplOiAyMFxuICAgICAgfTtcblxuICAgICAgaWYgKHRleHQudHJpbSgpLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICBjbGVhbnVwVGV4dEVkaXRvcigpO1xuICAgICAgICByZW5kZXJCb2FyZCgpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIHRhcmdldC50ZXh0ID0gdGV4dDtcbiAgICAgIHRhcmdldC5jb2xvciA9IGV4aXN0aW5nPy5jb2xvciA/PyBhY3RpdmVDb2xvcjtcbiAgICAgIHRhcmdldC5zaXplID0gZXhpc3Rpbmc/LnNpemUgPz8gMjA7XG5cbiAgICAgIGlmICghZXhpc3RpbmcpIHtcbiAgICAgICAgYm9hcmQuaXRlbXMucHVzaCh0YXJnZXQpO1xuICAgICAgfVxuXG4gICAgICBjbGVhbnVwVGV4dEVkaXRvcigpO1xuICAgICAgc2VsZWN0ZWRJdGVtSWQgPSB0YXJnZXQuaWQ7XG4gICAgICByZW5kZXJCb2FyZCgpO1xuICAgICAgcHVzaEhpc3RvcnkoKTtcbiAgICAgIHF1ZXVlU2F2ZSgpO1xuICAgIH07XG5cbiAgICBlZGl0b3IuYWRkRXZlbnRMaXN0ZW5lcihcImJsdXJcIiwgY29tbWl0LCB7IG9uY2U6IHRydWUgfSk7XG4gICAgZWRpdG9yLmFkZEV2ZW50TGlzdGVuZXIoXCJrZXlkb3duXCIsIChldmVudCkgPT4ge1xuICAgICAgaWYgKChldmVudC5jdHJsS2V5IHx8IGV2ZW50Lm1ldGFLZXkpICYmIGV2ZW50LmtleSA9PT0gXCJFbnRlclwiKSB7XG4gICAgICAgIGVkaXRvci5ibHVyKCk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICBmdW5jdGlvbiBhZGRMYXllcigpOiB2b2lkIHtcbiAgICBjb25zdCBsYXllcjogV2hpdGVib2FyZExheWVyID0ge1xuICAgICAgaWQ6IGNyZWF0ZUlkKFwibGF5ZXJcIiksXG4gICAgICBuYW1lOiBgTGF5ZXIgJHtib2FyZC5sYXllcnMubGVuZ3RoICsgMX1gLFxuICAgICAgdmlzaWJsZTogdHJ1ZSxcbiAgICAgIGxvY2tlZDogZmFsc2VcbiAgICB9O1xuICAgIGJvYXJkLmxheWVycy5wdXNoKGxheWVyKTtcbiAgICBhY3RpdmVMYXllcklkID0gbGF5ZXIuaWQ7XG4gICAgcmVuZGVyTGF5ZXJzKCk7XG4gICAgcHVzaEhpc3RvcnkoKTtcbiAgICBxdWV1ZVNhdmUoKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGdldFdvcmxkUG9pbnQoZXZlbnQ6IFBvaW50ZXJFdmVudCk6IHsgeDogbnVtYmVyOyB5OiBudW1iZXIgfSB7XG4gICAgY29uc3QgYm91bmRzID0gdmlld3BvcnQuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG4gICAgcmV0dXJuIHtcbiAgICAgIHg6IChldmVudC5jbGllbnRYIC0gYm91bmRzLmxlZnQgLSBib2FyZC52aWV3cG9ydC54KSAvIGJvYXJkLnZpZXdwb3J0Lnpvb20sXG4gICAgICB5OiAoZXZlbnQuY2xpZW50WSAtIGJvdW5kcy50b3AgLSBib2FyZC52aWV3cG9ydC55KSAvIGJvYXJkLnZpZXdwb3J0Lnpvb21cbiAgICB9O1xuICB9XG5cbiAgZnVuY3Rpb24gYmVnaW5TdHJva2UocG9pbnQ6IHsgeDogbnVtYmVyOyB5OiBudW1iZXIgfSwgZXZlbnQ6IFBvaW50ZXJFdmVudCk6IHZvaWQge1xuICAgIGlmIChpc0xheWVyTG9ja2VkKGFjdGl2ZUxheWVySWQpKSB7XG4gICAgICB1cGRhdGVTdGF0dXMoXCJBY3RpdmUgbGF5ZXIgaXMgbG9ja2VkXCIpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IHRvb2wgPSBhY3RpdmVUb29sID09PSBcInBlblwiIHx8IGFjdGl2ZVRvb2wgPT09IFwicGVuY2lsXCIgfHwgYWN0aXZlVG9vbCA9PT0gXCJtYXJrZXJcIiA/IGFjdGl2ZVRvb2wgOiBcInBlblwiO1xuICAgIGRyYWZ0U3Ryb2tlID0ge1xuICAgICAgaWQ6IGNyZWF0ZUlkKFwic3Ryb2tlXCIpLFxuICAgICAgdHlwZTogXCJzdHJva2VcIixcbiAgICAgIGxheWVySWQ6IGFjdGl2ZUxheWVySWQsXG4gICAgICB0b29sLFxuICAgICAgY29sb3I6IGFjdGl2ZUNvbG9yLFxuICAgICAgd2lkdGg6IGJydXNoU2l6ZSxcbiAgICAgIG9wYWNpdHksXG4gICAgICBwb2ludHM6IFtcbiAgICAgICAge1xuICAgICAgICAgIHg6IHBvaW50LngsXG4gICAgICAgICAgeTogcG9pbnQueSxcbiAgICAgICAgICBwcmVzc3VyZTogbm9ybWFsaXplUHJlc3N1cmUoZXZlbnQucHJlc3N1cmUpXG4gICAgICAgIH1cbiAgICAgIF1cbiAgICB9O1xuICAgIHBvaW50ZXJNb2RlID0geyB0eXBlOiBcImRyYXdcIiwgcG9pbnRlcklkOiBldmVudC5wb2ludGVySWQgfTtcbiAgICByZW5kZXJEcmFmdFN0cm9rZSgpO1xuICB9XG5cbiAgZnVuY3Rpb24gY29tbWl0U3Ryb2tlKCk6IHZvaWQge1xuICAgIGlmICghZHJhZnRTdHJva2UpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgaWYgKGRyYWZ0U3Ryb2tlLnBvaW50cy5sZW5ndGggPiAxKSB7XG4gICAgICBib2FyZC5pdGVtcy5wdXNoKGRyYWZ0U3Ryb2tlKTtcbiAgICAgIHNlbGVjdGVkSXRlbUlkID0gZHJhZnRTdHJva2UuaWQ7XG4gICAgICBwdXNoSGlzdG9yeSgpO1xuICAgICAgcXVldWVTYXZlKCk7XG4gICAgfVxuICAgIGRyYWZ0U3Ryb2tlID0gbnVsbDtcbiAgICByZW5kZXJEcmFmdFN0cm9rZSgpO1xuICAgIHJlbmRlckJvYXJkKCk7XG4gIH1cblxuICBmdW5jdGlvbiBlcmFzZUF0KHBvaW50OiB7IHg6IG51bWJlcjsgeTogbnVtYmVyIH0pOiBib29sZWFuIHtcbiAgICBjb25zdCBpdGVtID0gaGl0VGVzdChwb2ludCwgdHJ1ZSk7XG4gICAgaWYgKCFpdGVtKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgYm9hcmQuaXRlbXMgPSBib2FyZC5pdGVtcy5maWx0ZXIoKGNhbmRpZGF0ZSkgPT4gY2FuZGlkYXRlLmlkICE9PSBpdGVtLmlkKTtcbiAgICBpZiAoc2VsZWN0ZWRJdGVtSWQgPT09IGl0ZW0uaWQpIHtcbiAgICAgIHNlbGVjdGVkSXRlbUlkID0gbnVsbDtcbiAgICB9XG4gICAgcmVuZGVyQm9hcmQoKTtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGhpdFRlc3QocG9pbnQ6IHsgeDogbnVtYmVyOyB5OiBudW1iZXIgfSwgaWdub3JlTG9ja2VkID0gZmFsc2UpOiBXaGl0ZWJvYXJkSXRlbSB8IG51bGwge1xuICAgIGZvciAoY29uc3QgaXRlbSBvZiBbLi4uYm9hcmQuaXRlbXNdLnJldmVyc2UoKSkge1xuICAgICAgaWYgKCFpc0xheWVyVmlzaWJsZShpdGVtLmxheWVySWQpKSB7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuICAgICAgaWYgKCFpZ25vcmVMb2NrZWQgJiYgaXNMYXllckxvY2tlZChpdGVtLmxheWVySWQpKSB7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICBpZiAoaXRlbS50eXBlID09PSBcInRleHRcIikge1xuICAgICAgICBpZiAoXG4gICAgICAgICAgcG9pbnQueCA+PSBpdGVtLnggLSA4ICYmXG4gICAgICAgICAgcG9pbnQueCA8PSBpdGVtLnggKyAzMjAgJiZcbiAgICAgICAgICBwb2ludC55ID49IGl0ZW0ueSAtIDggJiZcbiAgICAgICAgICBwb2ludC55IDw9IGl0ZW0ueSArIDY0XG4gICAgICAgICkge1xuICAgICAgICAgIHJldHVybiBpdGVtO1xuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYgKGlzUG9pbnROZWFyU3Ryb2tlKHBvaW50LCBpdGVtKSkge1xuICAgICAgICByZXR1cm4gaXRlbTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIGZ1bmN0aW9uIGJlZ2luTW92ZShpdGVtOiBXaGl0ZWJvYXJkSXRlbSwgcG9pbnQ6IHsgeDogbnVtYmVyOyB5OiBudW1iZXIgfSwgZXZlbnQ6IFBvaW50ZXJFdmVudCk6IHZvaWQge1xuICAgIGlmIChpdGVtLnR5cGUgPT09IFwidGV4dFwiKSB7XG4gICAgICBwb2ludGVyTW9kZSA9IHtcbiAgICAgICAgdHlwZTogXCJtb3ZlXCIsXG4gICAgICAgIHBvaW50ZXJJZDogZXZlbnQucG9pbnRlcklkLFxuICAgICAgICBpdGVtSWQ6IGl0ZW0uaWQsXG4gICAgICAgIHN0YXJ0WDogcG9pbnQueCxcbiAgICAgICAgc3RhcnRZOiBwb2ludC55LFxuICAgICAgICBvcmlnaW5UZXh0OiB7IHg6IGl0ZW0ueCwgeTogaXRlbS55IH1cbiAgICAgIH07XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgcG9pbnRlck1vZGUgPSB7XG4gICAgICB0eXBlOiBcIm1vdmVcIixcbiAgICAgIHBvaW50ZXJJZDogZXZlbnQucG9pbnRlcklkLFxuICAgICAgaXRlbUlkOiBpdGVtLmlkLFxuICAgICAgc3RhcnRYOiBwb2ludC54LFxuICAgICAgc3RhcnRZOiBwb2ludC55LFxuICAgICAgb3JpZ2luUG9pbnRzOiBpdGVtLnBvaW50cy5tYXAoKGN1cnJlbnQpID0+ICh7IC4uLmN1cnJlbnQgfSkpXG4gICAgfTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHRyYW5zbGF0ZUl0ZW0obW9kZTogRXh0cmFjdDxQb2ludGVyTW9kZSwgeyB0eXBlOiBcIm1vdmVcIiB9PiwgcG9pbnQ6IHsgeDogbnVtYmVyOyB5OiBudW1iZXIgfSk6IHZvaWQge1xuICAgIGNvbnN0IGl0ZW0gPSBnZXRJdGVtKG1vZGUuaXRlbUlkKTtcbiAgICBpZiAoIWl0ZW0pIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBkeCA9IHBvaW50LnggLSBtb2RlLnN0YXJ0WDtcbiAgICBjb25zdCBkeSA9IHBvaW50LnkgLSBtb2RlLnN0YXJ0WTtcblxuICAgIGlmIChpdGVtLnR5cGUgPT09IFwidGV4dFwiICYmIG1vZGUub3JpZ2luVGV4dCkge1xuICAgICAgaXRlbS54ID0gbW9kZS5vcmlnaW5UZXh0LnggKyBkeDtcbiAgICAgIGl0ZW0ueSA9IG1vZGUub3JpZ2luVGV4dC55ICsgZHk7XG4gICAgfVxuXG4gICAgaWYgKGl0ZW0udHlwZSA9PT0gXCJzdHJva2VcIiAmJiBtb2RlLm9yaWdpblBvaW50cykge1xuICAgICAgaXRlbS5wb2ludHMgPSBtb2RlLm9yaWdpblBvaW50cy5tYXAoKG9yaWdpbikgPT4gKHtcbiAgICAgICAgeDogb3JpZ2luLnggKyBkeCxcbiAgICAgICAgeTogb3JpZ2luLnkgKyBkeSxcbiAgICAgICAgcHJlc3N1cmU6IG9yaWdpbi5wcmVzc3VyZVxuICAgICAgfSkpO1xuICAgIH1cblxuICAgIHJlbmRlckJvYXJkKCk7XG4gIH1cblxuICB2aWV3cG9ydC5hZGRFdmVudExpc3RlbmVyKFwicG9pbnRlcmRvd25cIiwgKGV2ZW50KSA9PiB7XG4gICAgY2xlYW51cFRleHRFZGl0b3IoKTtcbiAgICB2aWV3cG9ydC5zZXRQb2ludGVyQ2FwdHVyZShldmVudC5wb2ludGVySWQpO1xuICAgIGNvbnN0IHBvaW50ID0gZ2V0V29ybGRQb2ludChldmVudCk7XG4gICAgY29uc3QgdGV4dFRhcmdldCA9IChldmVudC50YXJnZXQgYXMgSFRNTEVsZW1lbnQpLmNsb3Nlc3Q8SFRNTEVsZW1lbnQ+KFwiLmVtYmVkZGVkLXdoaXRlYm9hcmRfX3RleHQtaXRlbVwiKTtcbiAgICBjb25zdCB0YXJnZXRlZEl0ZW0gPSB0ZXh0VGFyZ2V0Py5kYXRhc2V0Lml0ZW1JZCA/IGdldEl0ZW0odGV4dFRhcmdldC5kYXRhc2V0Lml0ZW1JZCkgOiBoaXRUZXN0KHBvaW50KTtcblxuICAgIGlmIChhY3RpdmVUb29sID09PSBcImhhbmRcIiB8fCBldmVudC5idXR0b24gPT09IDEpIHtcbiAgICAgIHBvaW50ZXJNb2RlID0ge1xuICAgICAgICB0eXBlOiBcInBhblwiLFxuICAgICAgICBzdGFydFg6IGV2ZW50LmNsaWVudFgsXG4gICAgICAgIHN0YXJ0WTogZXZlbnQuY2xpZW50WSxcbiAgICAgICAgb3JpZ2luWDogYm9hcmQudmlld3BvcnQueCxcbiAgICAgICAgb3JpZ2luWTogYm9hcmQudmlld3BvcnQueVxuICAgICAgfTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAoYWN0aXZlVG9vbCA9PT0gXCJ0ZXh0XCIpIHtcbiAgICAgIGlmICh0YXJnZXRlZEl0ZW0/LnR5cGUgPT09IFwidGV4dFwiKSB7XG4gICAgICAgIHNlbGVjdGVkSXRlbUlkID0gdGFyZ2V0ZWRJdGVtLmlkO1xuICAgICAgICBvcGVuVGV4dEVkaXRvcih7IHg6IHRhcmdldGVkSXRlbS54LCB5OiB0YXJnZXRlZEl0ZW0ueSB9LCB0YXJnZXRlZEl0ZW0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgc2VsZWN0ZWRJdGVtSWQgPSBudWxsO1xuICAgICAgICBvcGVuVGV4dEVkaXRvcihwb2ludCk7XG4gICAgICB9XG4gICAgICByZW5kZXJCb2FyZCgpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmIChhY3RpdmVUb29sID09PSBcImVyYXNlclwiKSB7XG4gICAgICBjb25zdCByZW1vdmVkID0gZXJhc2VBdChwb2ludCk7XG4gICAgICBwb2ludGVyTW9kZSA9IHsgdHlwZTogXCJlcmFzZVwiLCBwb2ludGVySWQ6IGV2ZW50LnBvaW50ZXJJZCwgcmVtb3ZlZCB9O1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmIChhY3RpdmVUb29sID09PSBcInNlbGVjdFwiKSB7XG4gICAgICBpZiAodGFyZ2V0ZWRJdGVtKSB7XG4gICAgICAgIHNlbGVjdGVkSXRlbUlkID0gdGFyZ2V0ZWRJdGVtLmlkO1xuICAgICAgICBpZiAoIWlzTGF5ZXJMb2NrZWQodGFyZ2V0ZWRJdGVtLmxheWVySWQpKSB7XG4gICAgICAgICAgYmVnaW5Nb3ZlKHRhcmdldGVkSXRlbSwgcG9pbnQsIGV2ZW50KTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgc2VsZWN0ZWRJdGVtSWQgPSBudWxsO1xuICAgICAgICByZW5kZXJCb2FyZCgpO1xuICAgICAgfVxuICAgICAgcmVuZGVyQm9hcmQoKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBiZWdpblN0cm9rZShwb2ludCwgZXZlbnQpO1xuICB9KTtcblxuICB2aWV3cG9ydC5hZGRFdmVudExpc3RlbmVyKFwicG9pbnRlcm1vdmVcIiwgKGV2ZW50KSA9PiB7XG4gICAgY29uc3QgcG9pbnQgPSBnZXRXb3JsZFBvaW50KGV2ZW50KTtcblxuICAgIGlmIChwb2ludGVyTW9kZS50eXBlID09PSBcInBhblwiKSB7XG4gICAgICBib2FyZC52aWV3cG9ydC54ID0gcG9pbnRlck1vZGUub3JpZ2luWCArIChldmVudC5jbGllbnRYIC0gcG9pbnRlck1vZGUuc3RhcnRYKTtcbiAgICAgIGJvYXJkLnZpZXdwb3J0LnkgPSBwb2ludGVyTW9kZS5vcmlnaW5ZICsgKGV2ZW50LmNsaWVudFkgLSBwb2ludGVyTW9kZS5zdGFydFkpO1xuICAgICAgYXBwbHlWaWV3cG9ydCgpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmIChwb2ludGVyTW9kZS50eXBlID09PSBcImRyYXdcIiAmJiBkcmFmdFN0cm9rZSkge1xuICAgICAgZHJhZnRTdHJva2UucG9pbnRzLnB1c2goe1xuICAgICAgICB4OiBwb2ludC54LFxuICAgICAgICB5OiBwb2ludC55LFxuICAgICAgICBwcmVzc3VyZTogbm9ybWFsaXplUHJlc3N1cmUoZXZlbnQucHJlc3N1cmUpXG4gICAgICB9KTtcbiAgICAgIHJlbmRlckRyYWZ0U3Ryb2tlKCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKHBvaW50ZXJNb2RlLnR5cGUgPT09IFwibW92ZVwiKSB7XG4gICAgICB0cmFuc2xhdGVJdGVtKHBvaW50ZXJNb2RlLCBwb2ludCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKHBvaW50ZXJNb2RlLnR5cGUgPT09IFwiZXJhc2VcIikge1xuICAgICAgY29uc3QgcmVtb3ZlZCA9IGVyYXNlQXQocG9pbnQpIHx8IHBvaW50ZXJNb2RlLnJlbW92ZWQ7XG4gICAgICBwb2ludGVyTW9kZSA9IHsgLi4ucG9pbnRlck1vZGUsIHJlbW92ZWQgfTtcbiAgICB9XG4gIH0pO1xuXG4gIGNvbnN0IHN0b3BQb2ludGVyID0gKCk6IHZvaWQgPT4ge1xuICAgIGlmIChwb2ludGVyTW9kZS50eXBlID09PSBcImRyYXdcIikge1xuICAgICAgY29tbWl0U3Ryb2tlKCk7XG4gICAgfSBlbHNlIGlmIChwb2ludGVyTW9kZS50eXBlID09PSBcIm1vdmVcIikge1xuICAgICAgcHVzaEhpc3RvcnkoKTtcbiAgICAgIHF1ZXVlU2F2ZSgpO1xuICAgIH0gZWxzZSBpZiAocG9pbnRlck1vZGUudHlwZSA9PT0gXCJlcmFzZVwiICYmIHBvaW50ZXJNb2RlLnJlbW92ZWQpIHtcbiAgICAgIHB1c2hIaXN0b3J5KCk7XG4gICAgICBxdWV1ZVNhdmUoKTtcbiAgICB9IGVsc2UgaWYgKHBvaW50ZXJNb2RlLnR5cGUgPT09IFwicGFuXCIpIHtcbiAgICAgIHF1ZXVlU2F2ZSgpO1xuICAgIH1cblxuICAgIHBvaW50ZXJNb2RlID0geyB0eXBlOiBcImlkbGVcIiB9O1xuICB9O1xuXG4gIHZpZXdwb3J0LmFkZEV2ZW50TGlzdGVuZXIoXCJwb2ludGVydXBcIiwgc3RvcFBvaW50ZXIpO1xuICB2aWV3cG9ydC5hZGRFdmVudExpc3RlbmVyKFwicG9pbnRlcmxlYXZlXCIsIHN0b3BQb2ludGVyKTtcblxuICB2aWV3cG9ydC5hZGRFdmVudExpc3RlbmVyKFxuICAgIFwid2hlZWxcIixcbiAgICAoZXZlbnQpID0+IHtcbiAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cbiAgICAgIGNvbnN0IGJvdW5kcyA9IHZpZXdwb3J0LmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuICAgICAgY29uc3QgY3Vyc29yWCA9IGV2ZW50LmNsaWVudFggLSBib3VuZHMubGVmdDtcbiAgICAgIGNvbnN0IGN1cnNvclkgPSBldmVudC5jbGllbnRZIC0gYm91bmRzLnRvcDtcbiAgICAgIGNvbnN0IHdvcmxkWCA9IChjdXJzb3JYIC0gYm9hcmQudmlld3BvcnQueCkgLyBib2FyZC52aWV3cG9ydC56b29tO1xuICAgICAgY29uc3Qgd29ybGRZID0gKGN1cnNvclkgLSBib2FyZC52aWV3cG9ydC55KSAvIGJvYXJkLnZpZXdwb3J0Lnpvb207XG4gICAgICBjb25zdCBuZXh0Wm9vbSA9IGNsYW1wKGJvYXJkLnZpZXdwb3J0Lnpvb20gKiAoZXZlbnQuZGVsdGFZIDwgMCA/IDEuMDggOiAwLjkyKSwgMC4yLCA0KTtcblxuICAgICAgYm9hcmQudmlld3BvcnQuem9vbSA9IG5leHRab29tO1xuICAgICAgYm9hcmQudmlld3BvcnQueCA9IGN1cnNvclggLSB3b3JsZFggKiBuZXh0Wm9vbTtcbiAgICAgIGJvYXJkLnZpZXdwb3J0LnkgPSBjdXJzb3JZIC0gd29ybGRZICogbmV4dFpvb207XG4gICAgICBhcHBseVZpZXdwb3J0KCk7XG4gICAgICBxdWV1ZVNhdmUoKTtcbiAgICB9LFxuICAgIHsgcGFzc2l2ZTogZmFsc2UgfVxuICApO1xuXG4gIHNldEFjdGl2ZVRvb2woXCJwZW5cIik7XG4gIHJlbmRlckJvYXJkKCk7XG5cbiAgcmV0dXJuIHtcbiAgICBkZXN0cm95KCkge1xuICAgICAgZGVzdHJveWVkID0gdHJ1ZTtcbiAgICAgIGlmIChzYXZlVGltZXIgIT09IG51bGwpIHtcbiAgICAgICAgd2luZG93LmNsZWFyVGltZW91dChzYXZlVGltZXIpO1xuICAgICAgfVxuICAgICAgY2xlYW51cFRleHRFZGl0b3IoKTtcbiAgICAgIGNvbnRhaW5lci5lbXB0eSgpO1xuICAgIH1cbiAgfTtcbn1cblxuZnVuY3Rpb24gbm9ybWFsaXplUHJlc3N1cmUocHJlc3N1cmU6IG51bWJlcik6IG51bWJlciB7XG4gIGlmIChwcmVzc3VyZSA+IDAgJiYgTnVtYmVyLmlzRmluaXRlKHByZXNzdXJlKSkge1xuICAgIHJldHVybiBwcmVzc3VyZTtcbiAgfVxuICByZXR1cm4gMC41O1xufVxuXG5mdW5jdGlvbiBwb2ludHNUb1BhdGgocG9pbnRzOiBTdHJva2VQb2ludFtdKTogc3RyaW5nIHtcbiAgaWYgKHBvaW50cy5sZW5ndGggPT09IDApIHtcbiAgICByZXR1cm4gXCJcIjtcbiAgfVxuXG4gIGlmIChwb2ludHMubGVuZ3RoID09PSAxKSB7XG4gICAgY29uc3QgcG9pbnQgPSBwb2ludHNbMF07XG4gICAgcmV0dXJuIGBNICR7cG9pbnQueH0gJHtwb2ludC55fSBMICR7cG9pbnQueCArIDAuMDF9ICR7cG9pbnQueSArIDAuMDF9YDtcbiAgfVxuXG4gIGxldCBwYXRoID0gYE0gJHtwb2ludHNbMF0ueH0gJHtwb2ludHNbMF0ueX1gO1xuICBmb3IgKGxldCBpbmRleCA9IDE7IGluZGV4IDwgcG9pbnRzLmxlbmd0aCAtIDE7IGluZGV4ICs9IDEpIHtcbiAgICBjb25zdCBjdXJyZW50ID0gcG9pbnRzW2luZGV4XTtcbiAgICBjb25zdCBuZXh0ID0gcG9pbnRzW2luZGV4ICsgMV07XG4gICAgY29uc3QgbWlkWCA9IChjdXJyZW50LnggKyBuZXh0LngpIC8gMjtcbiAgICBjb25zdCBtaWRZID0gKGN1cnJlbnQueSArIG5leHQueSkgLyAyO1xuICAgIHBhdGggKz0gYCBRICR7Y3VycmVudC54fSAke2N1cnJlbnQueX0gJHttaWRYfSAke21pZFl9YDtcbiAgfVxuXG4gIGNvbnN0IGxhc3QgPSBwb2ludHNbcG9pbnRzLmxlbmd0aCAtIDFdO1xuICBwYXRoICs9IGAgTCAke2xhc3QueH0gJHtsYXN0Lnl9YDtcbiAgcmV0dXJuIHBhdGg7XG59XG5cbmZ1bmN0aW9uIGlzUG9pbnROZWFyU3Ryb2tlKHBvaW50OiB7IHg6IG51bWJlcjsgeTogbnVtYmVyIH0sIHN0cm9rZTogU3Ryb2tlSXRlbSk6IGJvb2xlYW4ge1xuICBjb25zdCB0aHJlc2hvbGQgPSBNYXRoLm1heChzdHJva2Uud2lkdGggKiAxLjUsIDEwKTtcblxuICBmb3IgKGxldCBpbmRleCA9IDE7IGluZGV4IDwgc3Ryb2tlLnBvaW50cy5sZW5ndGg7IGluZGV4ICs9IDEpIHtcbiAgICBjb25zdCBwcmV2aW91cyA9IHN0cm9rZS5wb2ludHNbaW5kZXggLSAxXTtcbiAgICBjb25zdCBjdXJyZW50ID0gc3Ryb2tlLnBvaW50c1tpbmRleF07XG4gICAgaWYgKGRpc3RhbmNlVG9TZWdtZW50KHBvaW50LCBwcmV2aW91cywgY3VycmVudCkgPD0gdGhyZXNob2xkKSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gZmFsc2U7XG59XG5cbmZ1bmN0aW9uIGRpc3RhbmNlVG9TZWdtZW50KFxuICBwb2ludDogeyB4OiBudW1iZXI7IHk6IG51bWJlciB9LFxuICBzdGFydDogeyB4OiBudW1iZXI7IHk6IG51bWJlciB9LFxuICBlbmQ6IHsgeDogbnVtYmVyOyB5OiBudW1iZXIgfVxuKTogbnVtYmVyIHtcbiAgY29uc3QgZHggPSBlbmQueCAtIHN0YXJ0Lng7XG4gIGNvbnN0IGR5ID0gZW5kLnkgLSBzdGFydC55O1xuXG4gIGlmIChkeCA9PT0gMCAmJiBkeSA9PT0gMCkge1xuICAgIHJldHVybiBNYXRoLmh5cG90KHBvaW50LnggLSBzdGFydC54LCBwb2ludC55IC0gc3RhcnQueSk7XG4gIH1cblxuICBjb25zdCB0ID0gY2xhbXAoKChwb2ludC54IC0gc3RhcnQueCkgKiBkeCArIChwb2ludC55IC0gc3RhcnQueSkgKiBkeSkgLyAoZHggKiBkeCArIGR5ICogZHkpLCAwLCAxKTtcbiAgY29uc3QgcHJvamVjdGlvblggPSBzdGFydC54ICsgdCAqIGR4O1xuICBjb25zdCBwcm9qZWN0aW9uWSA9IHN0YXJ0LnkgKyB0ICogZHk7XG4gIHJldHVybiBNYXRoLmh5cG90KHBvaW50LnggLSBwcm9qZWN0aW9uWCwgcG9pbnQueSAtIHByb2plY3Rpb25ZKTtcbn1cblxuZnVuY3Rpb24gY2xhbXAodmFsdWU6IG51bWJlciwgbWluOiBudW1iZXIsIG1heDogbnVtYmVyKTogbnVtYmVyIHtcbiAgcmV0dXJuIE1hdGgubWluKG1heCwgTWF0aC5tYXgobWluLCB2YWx1ZSkpO1xufVxyXG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxJQUFBQSxtQkFNTzs7O0FDTlAsSUFBQUMsZ0JBQWdDO0FBQ2hDLGtCQUEyRTs7O0FDUXBFLElBQU0sbUJBQW1CO0FBQ3pCLElBQU0sdUJBQXVCO0FBQzdCLElBQU0saUJBQWlCO0FBQUEsRUFDNUI7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQ0Y7QUFFTyxJQUFNLGVBQXdFO0FBQUEsRUFDbkYsS0FBSyxFQUFFLE9BQU8sR0FBRyxTQUFTLEVBQUU7QUFBQSxFQUM1QixRQUFRLEVBQUUsT0FBTyxHQUFHLFNBQVMsS0FBSztBQUFBLEVBQ2xDLFFBQVEsRUFBRSxPQUFPLElBQUksU0FBUyxLQUFLO0FBQ3JDO0FBRU8sU0FBUyxTQUFTLFFBQXdCO0FBQy9DLFNBQU8sR0FBRyxNQUFNLElBQUksS0FBSyxPQUFPLEVBQUUsU0FBUyxFQUFFLEVBQUUsTUFBTSxHQUFHLEVBQUUsQ0FBQztBQUM3RDtBQUVPLFNBQVMsWUFBWSxPQUFPLFdBQTRCO0FBQzdELFNBQU87QUFBQSxJQUNMLElBQUksU0FBUyxPQUFPO0FBQUEsSUFDcEI7QUFBQSxJQUNBLFNBQVM7QUFBQSxJQUNULFFBQVE7QUFBQSxFQUNWO0FBQ0Y7QUFFTyxTQUFTLHFCQUE2QztBQUMzRCxTQUFPO0FBQUEsSUFDTCxRQUFRLENBQUMsWUFBWSxDQUFDO0FBQUEsSUFD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V0FBVztBQUNyRCxhQUFLLFFBQVEsQ0FBQyxTQUFTO0FBQ3JCLGVBQ0csU0FBUyw0QkFBNEIsRUFDckMsUUFBUSxrQkFBa0IsRUFDMUIsUUFBUSxNQUFNO0FBQ2IsaUJBQUsseUJBQXlCLE1BQU07QUFBQSxVQUN0QyxDQUFDO0FBQUEsUUFDTCxDQUFDO0FBQUEsTUFDSCxDQUFDO0FBQUEsSUFDSDtBQUFBLEVBQ0Y7QUFBQSxFQUVRLG1CQUFtQixRQUF3QztBQUNqRSxRQUFJO0FBQ0YsYUFBTyxXQUFXLE1BQU07QUFBQSxJQUMxQixTQUFTLE9BQU87QUFDZCxjQUFRLE1BQU0sS0FBSztBQUNuQixhQUFPLG1CQUFtQjtBQUFBLElBQzVCO0FBQUEsRUFDRjtBQUFBLEVBRUEsTUFBYyxrQkFBa0IsTUFBNEI7QUFDMUQsVUFBTSxVQUFVLE1BQU0sS0FBSyxJQUFJLE1BQU0sS0FBSyxJQUFJO0FBQzlDLFVBQU0sU0FBUyxRQUFRLFNBQVMsSUFBSSxJQUFJLEtBQUs7QUFDN0MsVUFBTSxLQUFLLElBQUksTUFBTSxPQUFPLE1BQU0sR0FBRyxPQUFPLEdBQUcsTUFBTTtBQUFBLEVBQUssVUFBVSxtQkFBbUIsQ0FBQyxDQUFDO0FBQUEsQ0FBSTtBQUM3RixRQUFJLHdCQUFPLDBDQUEwQztBQUFBLEVBQ3ZEO0FBQUEsRUFFUSx5QkFBeUIsUUFBc0I7QUFDckQsVUFBTSxRQUFRLFVBQVUsbUJBQW1CLENBQUM7QUFDNUMsVUFBTSxTQUFTLE9BQU8sVUFBVTtBQUNoQyxVQUFNLG9CQUFvQixPQUFPLE9BQU8sSUFBSSxPQUFPO0FBQ25ELFdBQU8sYUFBYSxHQUFHLGlCQUFpQixHQUFHLEtBQUs7QUFBQSxHQUFNLE1BQU07QUFBQSxFQUM5RDtBQUFBLEVBRUEsTUFBYyxhQUNaLFlBQ0EsZUFDQSxPQUNpQjtBQUNqQixVQUFNLE9BQU8sS0FBSyxJQUFJLE1BQU0sc0JBQXNCLFVBQVU7QUFDNUQsUUFBSSxFQUFFLGdCQUFnQix5QkFBUTtBQUM1QixZQUFNLElBQUksTUFBTSwrQkFBK0IsVUFBVSxFQUFFO0FBQUEsSUFDN0Q7QUFFQSxVQUFNLFlBQVksVUFBVSxLQUFLO0FBQ2pDLFVBQU0sVUFBVSxNQUFNLEtBQUssSUFBSSxNQUFNLEtBQUssSUFBSTtBQUM5QyxVQUFNLFFBQVEsUUFBUSxRQUFRLGFBQWE7QUFDM0MsUUFBSSxVQUFVLElBQUk7QUFDaEIsWUFBTSxJQUFJLE1BQU0saUVBQWlFO0FBQUEsSUFDbkY7QUFFQSxVQUFNLFVBQVUsR0FBRyxRQUFRLE1BQU0sR0FBRyxLQUFLLENBQUMsR0FBRyxTQUFTLEdBQUcsUUFBUSxNQUFNLFFBQVEsY0FBYyxNQUFNLENBQUM7QUFDcEcsVUFBTSxLQUFLLElBQUksTUFBTSxPQUFPLE1BQU0sT0FBTztBQUN6QyxXQUFPO0FBQUEsRUFDVDtBQUNGOyIsCiAgIm5hbWVzIjogWyJpbXBvcnRfb2JzaWRpYW4iLCAiaW1wb3J0X3N0YXRlIl0KfQo=
