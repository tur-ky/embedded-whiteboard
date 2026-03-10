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
function createDefaultBoard() {
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsibWFpbi50cyIsICJzcmMvc3RhdGUudHMiLCAic3JjL3doaXRlYm9hcmQudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImltcG9ydCB7XG4gIEVkaXRvcixcbiAgTWFya2Rvd25WaWV3LFxuICBOb3RpY2UsXG4gIFBsdWdpbixcbiAgVEZpbGVcbn0gZnJvbSBcIm9ic2lkaWFuXCI7XG5pbXBvcnQge1xuICBjcmVhdGVEZWZhdWx0Qm9hcmQsXG4gIHBhcnNlQm9hcmQsXG4gIFdISVRFQk9BUkRfRkVOQ0UsXG4gIHdyYXBCb2FyZFxufSBmcm9tIFwiLi9zcmMvc3RhdGVcIjtcbmltcG9ydCB7IEVtYmVkZGVkV2hpdGVib2FyZERhdGEgfSBmcm9tIFwiLi9zcmMvdHlwZXNcIjtcbmltcG9ydCB7IG1vdW50V2hpdGVib2FyZCB9IGZyb20gXCIuL3NyYy93aGl0ZWJvYXJkXCI7XG5cbmludGVyZmFjZSBMb2NhdGVkQmxvY2sge1xuICBmcm9tOiBudW1iZXI7XG4gIHRvOiBudW1iZXI7XG4gIGNvbnRlbnQ6IHN0cmluZztcbn1cblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgRW1iZWRkZWRXaGl0ZWJvYXJkUGx1Z2luIGV4dGVuZHMgUGx1Z2luIHtcbiAgYXN5bmMgb25sb2FkKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIHRoaXMucmVnaXN0ZXJNYXJrZG93bkNvZGVCbG9ja1Byb2Nlc3NvcihcbiAgICAgIFdISVRFQk9BUkRfRkVOQ0UsXG4gICAgICBhc3luYyAoc291cmNlLCBlbCwgY3R4KSA9PiB7XG4gICAgICAgIGNvbnN0IGJvYXJkID0gdGhpcy5wYXJzZU9yQ3JlYXRlQm9hcmQoc291cmNlKTtcblxuICAgICAgICBjb25zdCBoYW5kbGUgPSBtb3VudFdoaXRlYm9hcmQoZWwsIGJvYXJkLCB7XG4gICAgICAgICAgc291cmNlUGF0aDogY3R4LnNvdXJjZVBhdGgsXG4gICAgICAgICAgc2F2ZTogYXN5bmMgKG5leHRCb2FyZCkgPT4ge1xuICAgICAgICAgICAgYXdhaXQgdGhpcy5wZXJzaXN0QmxvY2soY3R4LnNvdXJjZVBhdGgsIG5leHRCb2FyZCk7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgICAgICB0aGlzLnJlZ2lzdGVyKCgpID0+IGhhbmRsZS5kZXN0cm95KCkpO1xuICAgICAgfVxuICAgICk7XG5cbiAgICB0aGlzLmFkZENvbW1hbmQoe1xuICAgICAgaWQ6IFwiaW5zZXJ0LWVtYmVkZGVkLXdoaXRlYm9hcmRcIixcbiAgICAgIG5hbWU6IFwiSW5zZXJ0IGVtYmVkZGVkIHdoaXRlYm9hcmRcIixcbiAgICAgIGVkaXRvckNhbGxiYWNrOiAoZWRpdG9yKSA9PiB7XG4gICAgICAgIHRoaXMuaW5zZXJ0RW1iZWRkZWRXaGl0ZWJvYXJkKGVkaXRvcik7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICB0aGlzLmFkZENvbW1hbmQoe1xuICAgICAgaWQ6IFwiYXBwZW5kLWVtYmVkZGVkLXdoaXRlYm9hcmRcIixcbiAgICAgIG5hbWU6IFwiQXBwZW5kIGVtYmVkZGVkIHdoaXRlYm9hcmQgdG8gY3VycmVudCBub3RlXCIsXG4gICAgICBjaGVja0NhbGxiYWNrOiAoY2hlY2tpbmcpID0+IHtcbiAgICAgICAgY29uc3QgdmlldyA9IHRoaXMuYXBwLndvcmtzcGFjZS5nZXRBY3RpdmVWaWV3T2ZUeXBlKE1hcmtkb3duVmlldyk7XG4gICAgICAgIGlmICghdmlldz8uZmlsZSkge1xuICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghY2hlY2tpbmcpIHtcbiAgICAgICAgICB2b2lkIHRoaXMuYXBwZW5kQm9hcmRUb0ZpbGUodmlldy5maWxlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgdGhpcy5yZWdpc3RlckV2ZW50KFxuICAgICAgdGhpcy5hcHAud29ya3NwYWNlLm9uKFwiZWRpdG9yLW1lbnVcIiwgKG1lbnUsIGVkaXRvcikgPT4ge1xuICAgICAgICBtZW51LmFkZEl0ZW0oKGl0ZW0pID0+IHtcbiAgICAgICAgICBpdGVtXG4gICAgICAgICAgICAuc2V0VGl0bGUoXCJJbnNlcnQgZW1iZWRkZWQgd2hpdGVib2FyZFwiKVxuICAgICAgICAgICAgLnNldEljb24oXCJsYXlvdXQtZGFzaGJvYXJkXCIpXG4gICAgICAgICAgICAub25DbGljaygoKSA9PiB7XG4gICAgICAgICAgICAgIHRoaXMuaW5zZXJ0RW1iZWRkZWRXaGl0ZWJvYXJkKGVkaXRvcik7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgICB9KVxuICAgICk7XG4gIH1cblxuICBwcml2YXRlIHBhcnNlT3JDcmVhdGVCb2FyZChzb3VyY2U6IHN0cmluZyk6IEVtYmVkZGVkV2hpdGVib2FyZERhdGEge1xuICAgIHRyeSB7XG4gICAgICByZXR1cm4gcGFyc2VCb2FyZChzb3VyY2UpO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKGVycm9yKTtcbiAgICAgIHJldHVybiBjcmVhdGVEZWZhdWx0Qm9hcmQoKTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIGFwcGVuZEJvYXJkVG9GaWxlKGZpbGU6IFRGaWxlKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgY29udGVudCA9IGF3YWl0IHRoaXMuYXBwLnZhdWx0LnJlYWQoZmlsZSk7XG4gICAgY29uc3Qgc3VmZml4ID0gY29udGVudC5lbmRzV2l0aChcIlxcblwiKSA/IFwiXCIgOiBcIlxcblwiO1xuICAgIGF3YWl0IHRoaXMuYXBwLnZhdWx0Lm1vZGlmeShmaWxlLCBgJHtjb250ZW50fSR7c3VmZml4fVxcbiR7d3JhcEJvYXJkKGNyZWF0ZURlZmF1bHRCb2FyZCgpKX1cXG5gKTtcbiAgICBuZXcgTm90aWNlKFwiRW1iZWRkZWQgd2hpdGVib2FyZCBhcHBlbmRlZCB0byB0aGUgbm90ZVwiKTtcbiAgfVxuXG4gIHByaXZhdGUgaW5zZXJ0RW1iZWRkZWRXaGl0ZWJvYXJkKGVkaXRvcjogRWRpdG9yKTogdm9pZCB7XG4gICAgY29uc3QgYm9hcmQgPSB3cmFwQm9hcmQoY3JlYXRlRGVmYXVsdEJvYXJkKCkpO1xuICAgIGNvbnN0IGN1cnNvciA9IGVkaXRvci5nZXRDdXJzb3IoKTtcbiAgICBjb25zdCBuZWVkc0xlYWRpbmdCcmVhayA9IGN1cnNvci5saW5lID4gMCA/IFwiXFxuXCIgOiBcIlwiO1xuICAgIGVkaXRvci5yZXBsYWNlUmFuZ2UoYCR7bmVlZHNMZWFkaW5nQnJlYWt9JHtib2FyZH1cXG5gLCBjdXJzb3IpO1xuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyBwZXJzaXN0QmxvY2soc291cmNlUGF0aDogc3RyaW5nLCBib2FyZDogRW1iZWRkZWRXaGl0ZWJvYXJkRGF0YSk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IGZpbGUgPSB0aGlzLmFwcC52YXVsdC5nZXRBYnN0cmFjdEZpbGVCeVBhdGgoc291cmNlUGF0aCk7XG4gICAgaWYgKCEoZmlsZSBpbnN0YW5jZW9mIFRGaWxlKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbmFibGUgdG8gZmluZCBzb3VyY2Ugbm90ZTogJHtzb3VyY2VQYXRofWApO1xuICAgIH1cblxuICAgIGNvbnN0IGN1cnJlbnQgPSBhd2FpdCB0aGlzLmFwcC52YXVsdC5yZWFkKGZpbGUpO1xuICAgIGNvbnN0IGJsb2NrID0gdGhpcy5maW5kQmxvY2tCeUJvYXJkSWQoY3VycmVudCwgYm9hcmQuaWQpID8/IHRoaXMuZmluZFNpbmdsZVdoaXRlYm9hcmRCbG9jayhjdXJyZW50KTtcbiAgICBpZiAoIWJsb2NrKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJVbmFibGUgdG8gZmluZCB0aGUgZW1iZWRkZWQgd2hpdGVib2FyZCBibG9jayBpbiB0aGUgc291cmNlIG5vdGVcIik7XG4gICAgfVxuXG4gICAgY29uc3QgbmV4dEJsb2NrID0gd3JhcEJvYXJkKGJvYXJkKTtcbiAgICBjb25zdCB1cGRhdGVkID0gYCR7Y3VycmVudC5zbGljZSgwLCBibG9jay5mcm9tKX0ke25leHRCbG9ja30ke2N1cnJlbnQuc2xpY2UoYmxvY2sudG8pfWA7XG4gICAgYXdhaXQgdGhpcy5hcHAudmF1bHQubW9kaWZ5KGZpbGUsIHVwZGF0ZWQpO1xuICB9XG5cbiAgcHJpdmF0ZSBmaW5kQmxvY2tCeUJvYXJkSWQoY29udGVudDogc3RyaW5nLCBib2FyZElkOiBzdHJpbmcpOiBMb2NhdGVkQmxvY2sgfCBudWxsIHtcbiAgICBmb3IgKGNvbnN0IGJsb2NrIG9mIHRoaXMuaXRlcmF0ZVdoaXRlYm9hcmRCbG9ja3MoY29udGVudCkpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IHBhcnNlZCA9IHBhcnNlQm9hcmQoYmxvY2suY29udGVudCk7XG4gICAgICAgIGlmIChwYXJzZWQuaWQgPT09IGJvYXJkSWQpIHtcbiAgICAgICAgICByZXR1cm4gYmxvY2s7XG4gICAgICAgIH1cbiAgICAgIH0gY2F0Y2gge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIHByaXZhdGUgZmluZFNpbmdsZVdoaXRlYm9hcmRCbG9jayhjb250ZW50OiBzdHJpbmcpOiBMb2NhdGVkQmxvY2sgfCBudWxsIHtcbiAgICBjb25zdCBibG9ja3MgPSBbLi4udGhpcy5pdGVyYXRlV2hpdGVib2FyZEJsb2Nrcyhjb250ZW50KV07XG4gICAgcmV0dXJuIGJsb2Nrcy5sZW5ndGggPT09IDEgPyBibG9ja3NbMF0gOiBudWxsO1xuICB9XG5cbiAgcHJpdmF0ZSAqaXRlcmF0ZVdoaXRlYm9hcmRCbG9ja3MoY29udGVudDogc3RyaW5nKTogR2VuZXJhdG9yPExvY2F0ZWRCbG9jaz4ge1xuICAgIGNvbnN0IG9wZW5pbmcgPSBgXFxgXFxgXFxgJHtXSElURUJPQVJEX0ZFTkNFfWA7XG4gICAgbGV0IHNlYXJjaEZyb20gPSAwO1xuXG4gICAgd2hpbGUgKHNlYXJjaEZyb20gPCBjb250ZW50Lmxlbmd0aCkge1xuICAgICAgY29uc3Qgc3RhcnQgPSBjb250ZW50LmluZGV4T2Yob3BlbmluZywgc2VhcmNoRnJvbSk7XG4gICAgICBpZiAoc3RhcnQgPT09IC0xKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgY29uc3QgYWZ0ZXJPcGVuaW5nID0gY29udGVudC5pbmRleE9mKFwiXFxuXCIsIHN0YXJ0KTtcbiAgICAgIGlmIChhZnRlck9wZW5pbmcgPT09IC0xKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgY29uc3QgY2xvc2UgPSBjb250ZW50LmluZGV4T2YoXCJcXG5gYGBcIiwgYWZ0ZXJPcGVuaW5nKTtcbiAgICAgIGlmIChjbG9zZSA9PT0gLTEpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBlbmQgPSBjbG9zZSArIDQ7XG4gICAgICB5aWVsZCB7XG4gICAgICAgIGZyb206IHN0YXJ0LFxuICAgICAgICB0bzogZW5kLFxuICAgICAgICBjb250ZW50OiBjb250ZW50LnNsaWNlKGFmdGVyT3BlbmluZyArIDEsIGNsb3NlKVxuICAgICAgfTtcblxuICAgICAgc2VhcmNoRnJvbSA9IGVuZDtcbiAgICB9XG4gIH1cbn1cclxuIiwgImltcG9ydCB7XG4gIERyYXdpbmdUb29sLFxuICBFbWJlZGRlZFdoaXRlYm9hcmREYXRhLFxuICBTdHJva2VJdGVtLFxuICBUZXh0SXRlbSxcbiAgV2hpdGVib2FyZEl0ZW0sXG4gIFdoaXRlYm9hcmRMYXllclxufSBmcm9tIFwiLi90eXBlc1wiO1xuXG5leHBvcnQgY29uc3QgV0hJVEVCT0FSRF9GRU5DRSA9IFwiaW5saW5lLXdoaXRlYm9hcmRcIjtcbmV4cG9ydCBjb25zdCBERUZBVUxUX0JPQVJEX0hFSUdIVCA9IDYyMDtcbmV4cG9ydCBjb25zdCBERUZBVUxUX0NPTE9SUyA9IFtcbiAgXCIjMTExMTExXCIsXG4gIFwiIzI1NjNlYlwiLFxuICBcIiMxNGI4YTZcIixcbiAgXCIjMjJjNTVlXCIsXG4gIFwiI2Y1OWUwYlwiLFxuICBcIiNlZjQ0NDRcIixcbiAgXCIjZTExZDQ4XCIsXG4gIFwiIzdjM2FlZFwiXG5dIGFzIGNvbnN0O1xuXG5leHBvcnQgY29uc3QgVE9PTF9QUkVTRVRTOiBSZWNvcmQ8RHJhd2luZ1Rvb2wsIHsgd2lkdGg6IG51bWJlcjsgb3BhY2l0eTogbnVtYmVyIH0+ID0ge1xuICBwZW46IHsgd2lkdGg6IDQsIG9wYWNpdHk6IDEgfSxcbiAgcGVuY2lsOiB7IHdpZHRoOiAyLCBvcGFjaXR5OiAwLjcyIH0sXG4gIG1hcmtlcjogeyB3aWR0aDogMTIsIG9wYWNpdHk6IDAuMjggfVxufTtcblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUlkKHByZWZpeDogc3RyaW5nKTogc3RyaW5nIHtcbiAgcmV0dXJuIGAke3ByZWZpeH0tJHtNYXRoLnJhbmRvbSgpLnRvU3RyaW5nKDM2KS5zbGljZSgyLCAxMCl9YDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUxheWVyKG5hbWUgPSBcIkxheWVyIDFcIik6IFdoaXRlYm9hcmRMYXllciB7XG4gIHJldHVybiB7XG4gICAgaWQ6IGNyZWF0ZUlkKFwibGF5ZXJcIiksXG4gICAgbmFtZSxcbiAgICB2aXNpYmxlOiB0cnVlLFxuICAgIGxvY2tlZDogZmFsc2VcbiAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZURlZmF1bHRCb2FyZCgpOiBFbWJlZGRlZFdoaXRlYm9hcmREYXRhIHtcbiAgcmV0dXJuIHtcbiAgICBpZDogY3JlYXRlSWQoXCJib2FyZFwiKSxcbiAgICBsYXllcnM6IFtjcmVhdGVMYXllcigpXSxcbiAgICBpdGVtczogW10sXG4gICAgdmlld3BvcnQ6IHtcbiAgICAgIHg6IDAsXG4gICAgICB5OiAwLFxuICAgICAgem9vbTogMVxuICAgIH1cbiAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlQm9hcmQocmF3OiBzdHJpbmcpOiBFbWJlZGRlZFdoaXRlYm9hcmREYXRhIHtcbiAgY29uc3QgcGFyc2VkID0gSlNPTi5wYXJzZShyYXcpIGFzIFBhcnRpYWw8RW1iZWRkZWRXaGl0ZWJvYXJkRGF0YT4gJiB7XG4gICAgbm9kZXM/OiBBcnJheTxSZWNvcmQ8c3RyaW5nLCB1bmtub3duPj47XG4gIH07XG5cbiAgaWYgKEFycmF5LmlzQXJyYXkocGFyc2VkLm5vZGVzKSkge1xuICAgIHJldHVybiBtaWdyYXRlTm9kZUJvYXJkKHBhcnNlZC5ub2RlcywgcGFyc2VkLnZpZXdwb3J0LCBwYXJzZWQuaWQpO1xuICB9XG5cbiAgY29uc3QgbGF5ZXJzID0gQXJyYXkuaXNBcnJheShwYXJzZWQubGF5ZXJzKVxuICAgID8gcGFyc2VkLmxheWVyc1xuICAgICAgICAuZmlsdGVyKChsYXllcik6IGxheWVyIGlzIFdoaXRlYm9hcmRMYXllciA9PiBCb29sZWFuKGxheWVyICYmIHR5cGVvZiBsYXllci5pZCA9PT0gXCJzdHJpbmdcIikpXG4gICAgICAgIC5tYXAoKGxheWVyLCBpbmRleCkgPT4gKHtcbiAgICAgICAgICBpZDogbGF5ZXIuaWQsXG4gICAgICAgICAgbmFtZTogdHlwZW9mIGxheWVyLm5hbWUgPT09IFwic3RyaW5nXCIgPyBsYXllci5uYW1lIDogYExheWVyICR7aW5kZXggKyAxfWAsXG4gICAgICAgICAgdmlzaWJsZTogbGF5ZXIudmlzaWJsZSAhPT0gZmFsc2UsXG4gICAgICAgICAgbG9ja2VkOiBsYXllci5sb2NrZWQgPT09IHRydWVcbiAgICAgICAgfSkpXG4gICAgOiBbXTtcblxuICBjb25zdCBzYWZlTGF5ZXJzID0gbGF5ZXJzLmxlbmd0aCA+IDAgPyBsYXllcnMgOiBbY3JlYXRlTGF5ZXIoKV07XG4gIGNvbnN0IGxheWVySWRzID0gbmV3IFNldChzYWZlTGF5ZXJzLm1hcCgobGF5ZXIpID0+IGxheWVyLmlkKSk7XG5cbiAgY29uc3QgaXRlbXMgPSBBcnJheS5pc0FycmF5KHBhcnNlZC5pdGVtcylcbiAgICA/IHBhcnNlZC5pdGVtc1xuICAgICAgICAuZmlsdGVyKChpdGVtKTogaXRlbSBpcyBXaGl0ZWJvYXJkSXRlbSA9PiBCb29sZWFuKGl0ZW0gJiYgdHlwZW9mIGl0ZW0uaWQgPT09IFwic3RyaW5nXCIgJiYgdHlwZW9mIGl0ZW0udHlwZSA9PT0gXCJzdHJpbmdcIikpXG4gICAgICAgIC5tYXAoKGl0ZW0pID0+IG5vcm1hbGl6ZUl0ZW0oaXRlbSwgc2FmZUxheWVyc1swXS5pZCkpXG4gICAgICAgIC5maWx0ZXIoKGl0ZW0pOiBpdGVtIGlzIFdoaXRlYm9hcmRJdGVtID0+IEJvb2xlYW4oaXRlbSAmJiBsYXllcklkcy5oYXMoaXRlbS5sYXllcklkKSkpXG4gICAgOiBbXTtcblxuICByZXR1cm4ge1xuICAgIGlkOiB0eXBlb2YgcGFyc2VkLmlkID09PSBcInN0cmluZ1wiID8gcGFyc2VkLmlkIDogY3JlYXRlSWQoXCJib2FyZFwiKSxcbiAgICBsYXllcnM6IHNhZmVMYXllcnMsXG4gICAgaXRlbXMsXG4gICAgdmlld3BvcnQ6IHtcbiAgICAgIHg6IHR5cGVvZiBwYXJzZWQudmlld3BvcnQ/LnggPT09IFwibnVtYmVyXCIgPyBwYXJzZWQudmlld3BvcnQueCA6IDAsXG4gICAgICB5OiB0eXBlb2YgcGFyc2VkLnZpZXdwb3J0Py55ID09PSBcIm51bWJlclwiID8gcGFyc2VkLnZpZXdwb3J0LnkgOiAwLFxuICAgICAgem9vbTogdHlwZW9mIHBhcnNlZC52aWV3cG9ydD8uem9vbSA9PT0gXCJudW1iZXJcIiA/IHBhcnNlZC52aWV3cG9ydC56b29tIDogMVxuICAgIH1cbiAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNlcmlhbGl6ZUJvYXJkKGJvYXJkOiBFbWJlZGRlZFdoaXRlYm9hcmREYXRhKTogc3RyaW5nIHtcbiAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KGJvYXJkLCBudWxsLCAyKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHdyYXBCb2FyZChib2FyZDogRW1iZWRkZWRXaGl0ZWJvYXJkRGF0YSk6IHN0cmluZyB7XG4gIHJldHVybiBgXFxgXFxgXFxgJHtXSElURUJPQVJEX0ZFTkNFfVxcbiR7c2VyaWFsaXplQm9hcmQoYm9hcmQpfVxcblxcYFxcYFxcYGA7XG59XG5cbmZ1bmN0aW9uIG5vcm1hbGl6ZUl0ZW0oaXRlbTogV2hpdGVib2FyZEl0ZW0sIGZhbGxiYWNrTGF5ZXJJZDogc3RyaW5nKTogV2hpdGVib2FyZEl0ZW0gfCBudWxsIHtcbiAgaWYgKGl0ZW0udHlwZSA9PT0gXCJzdHJva2VcIikge1xuICAgIGNvbnN0IHN0cm9rZSA9IGl0ZW0gYXMgUGFydGlhbDxTdHJva2VJdGVtPjtcbiAgICByZXR1cm4ge1xuICAgICAgaWQ6IHN0cm9rZS5pZCA/PyBjcmVhdGVJZChcInN0cm9rZVwiKSxcbiAgICAgIHR5cGU6IFwic3Ryb2tlXCIsXG4gICAgICBsYXllcklkOiB0eXBlb2Ygc3Ryb2tlLmxheWVySWQgPT09IFwic3RyaW5nXCIgPyBzdHJva2UubGF5ZXJJZCA6IGZhbGxiYWNrTGF5ZXJJZCxcbiAgICAgIHRvb2w6IHN0cm9rZS50b29sID09PSBcInBlbmNpbFwiIHx8IHN0cm9rZS50b29sID09PSBcIm1hcmtlclwiID8gc3Ryb2tlLnRvb2wgOiBcInBlblwiLFxuICAgICAgY29sb3I6IHR5cGVvZiBzdHJva2UuY29sb3IgPT09IFwic3RyaW5nXCIgPyBzdHJva2UuY29sb3IgOiBERUZBVUxUX0NPTE9SU1swXSxcbiAgICAgIHdpZHRoOiB0eXBlb2Ygc3Ryb2tlLndpZHRoID09PSBcIm51bWJlclwiID8gc3Ryb2tlLndpZHRoIDogVE9PTF9QUkVTRVRTLnBlbi53aWR0aCxcbiAgICAgIG9wYWNpdHk6IHR5cGVvZiBzdHJva2Uub3BhY2l0eSA9PT0gXCJudW1iZXJcIiA/IHN0cm9rZS5vcGFjaXR5IDogVE9PTF9QUkVTRVRTLnBlbi5vcGFjaXR5LFxuICAgICAgcG9pbnRzOiBBcnJheS5pc0FycmF5KHN0cm9rZS5wb2ludHMpXG4gICAgICAgID8gc3Ryb2tlLnBvaW50c1xuICAgICAgICAgICAgLmZpbHRlcigocG9pbnQpOiBwb2ludCBpcyB7IHg6IG51bWJlcjsgeTogbnVtYmVyOyBwcmVzc3VyZT86IG51bWJlciB9ID0+IEJvb2xlYW4ocG9pbnQgJiYgdHlwZW9mIHBvaW50LnggPT09IFwibnVtYmVyXCIgJiYgdHlwZW9mIHBvaW50LnkgPT09IFwibnVtYmVyXCIpKVxuICAgICAgICAgICAgLm1hcCgocG9pbnQpID0+ICh7XG4gICAgICAgICAgICAgIHg6IHBvaW50LngsXG4gICAgICAgICAgICAgIHk6IHBvaW50LnksXG4gICAgICAgICAgICAgIHByZXNzdXJlOiB0eXBlb2YgcG9pbnQucHJlc3N1cmUgPT09IFwibnVtYmVyXCIgPyBwb2ludC5wcmVzc3VyZSA6IDAuNVxuICAgICAgICAgICAgfSkpXG4gICAgICAgIDogW11cbiAgICB9O1xuICB9XG5cbiAgaWYgKGl0ZW0udHlwZSA9PT0gXCJ0ZXh0XCIpIHtcbiAgICBjb25zdCB0ZXh0ID0gaXRlbSBhcyBQYXJ0aWFsPFRleHRJdGVtPjtcbiAgICByZXR1cm4ge1xuICAgICAgaWQ6IHRleHQuaWQgPz8gY3JlYXRlSWQoXCJ0ZXh0XCIpLFxuICAgICAgdHlwZTogXCJ0ZXh0XCIsXG4gICAgICBsYXllcklkOiB0eXBlb2YgdGV4dC5sYXllcklkID09PSBcInN0cmluZ1wiID8gdGV4dC5sYXllcklkIDogZmFsbGJhY2tMYXllcklkLFxuICAgICAgeDogdHlwZW9mIHRleHQueCA9PT0gXCJudW1iZXJcIiA/IHRleHQueCA6IDAsXG4gICAgICB5OiB0eXBlb2YgdGV4dC55ID09PSBcIm51bWJlclwiID8gdGV4dC55IDogMCxcbiAgICAgIHRleHQ6IHR5cGVvZiB0ZXh0LnRleHQgPT09IFwic3RyaW5nXCIgPyB0ZXh0LnRleHQgOiBcIlwiLFxuICAgICAgY29sb3I6IHR5cGVvZiB0ZXh0LmNvbG9yID09PSBcInN0cmluZ1wiID8gdGV4dC5jb2xvciA6IERFRkFVTFRfQ09MT1JTWzBdLFxuICAgICAgc2l6ZTogdHlwZW9mIHRleHQuc2l6ZSA9PT0gXCJudW1iZXJcIiA/IHRleHQuc2l6ZSA6IDIwXG4gICAgfTtcbiAgfVxuXG4gIHJldHVybiBudWxsO1xufVxuXG5mdW5jdGlvbiBtaWdyYXRlTm9kZUJvYXJkKFxuICBub2RlczogQXJyYXk8UmVjb3JkPHN0cmluZywgdW5rbm93bj4+LFxuICB2aWV3cG9ydDogUGFydGlhbDxFbWJlZGRlZFdoaXRlYm9hcmREYXRhW1widmlld3BvcnRcIl0+IHwgdW5kZWZpbmVkLFxuICBib2FyZElkOiBzdHJpbmcgfCB1bmRlZmluZWRcbik6IEVtYmVkZGVkV2hpdGVib2FyZERhdGEge1xuICBjb25zdCBsYXllciA9IGNyZWF0ZUxheWVyKCk7XG4gIGNvbnN0IGl0ZW1zOiBUZXh0SXRlbVtdID0gbm9kZXNcbiAgICAuZmlsdGVyKChub2RlKSA9PiB0eXBlb2Ygbm9kZS5pZCA9PT0gXCJzdHJpbmdcIilcbiAgICAubWFwKChub2RlKSA9PiAoe1xuICAgICAgaWQ6IFN0cmluZyhub2RlLmlkKSxcbiAgICAgIHR5cGU6IFwidGV4dFwiLFxuICAgICAgbGF5ZXJJZDogbGF5ZXIuaWQsXG4gICAgICB4OiB0eXBlb2Ygbm9kZS54ID09PSBcIm51bWJlclwiID8gbm9kZS54IDogMCxcbiAgICAgIHk6IHR5cGVvZiBub2RlLnkgPT09IFwibnVtYmVyXCIgPyBub2RlLnkgOiAwLFxuICAgICAgdGV4dDogdHlwZW9mIG5vZGUudGV4dCA9PT0gXCJzdHJpbmdcIiA/IG5vZGUudGV4dCA6IFwiXCIsXG4gICAgICBjb2xvcjogdHlwZW9mIG5vZGUuY29sb3IgPT09IFwic3RyaW5nXCIgPyBub2RlLmNvbG9yIDogREVGQVVMVF9DT0xPUlNbMF0sXG4gICAgICBzaXplOiAxOFxuICAgIH0pKTtcblxuICByZXR1cm4ge1xuICAgIGlkOiB0eXBlb2YgYm9hcmRJZCA9PT0gXCJzdHJpbmdcIiA/IGJvYXJkSWQgOiBjcmVhdGVJZChcImJvYXJkXCIpLFxuICAgIGxheWVyczogW2xheWVyXSxcbiAgICBpdGVtcyxcbiAgICB2aWV3cG9ydDoge1xuICAgICAgeDogdHlwZW9mIHZpZXdwb3J0Py54ID09PSBcIm51bWJlclwiID8gdmlld3BvcnQueCA6IDAsXG4gICAgICB5OiB0eXBlb2Ygdmlld3BvcnQ/LnkgPT09IFwibnVtYmVyXCIgPyB2aWV3cG9ydC55IDogMCxcbiAgICAgIHpvb206IHR5cGVvZiB2aWV3cG9ydD8uem9vbSA9PT0gXCJudW1iZXJcIiA/IHZpZXdwb3J0Lnpvb20gOiAxXG4gICAgfVxuICB9O1xufVxyXG4iLCAiaW1wb3J0IHsgTm90aWNlIH0gZnJvbSBcIm9ic2lkaWFuXCI7XG5pbXBvcnQge1xuICBjcmVhdGVEZWZhdWx0Qm9hcmQsXG4gIGNyZWF0ZUlkLFxuICBERUZBVUxUX0JPQVJEX0hFSUdIVCxcbiAgREVGQVVMVF9DT0xPUlMsXG4gIFRPT0xfUFJFU0VUU1xufSBmcm9tIFwiLi9zdGF0ZVwiO1xuaW1wb3J0IHtcbiAgRHJhd2luZ1Rvb2wsXG4gIEVtYmVkZGVkV2hpdGVib2FyZERhdGEsXG4gIFN0cm9rZUl0ZW0sXG4gIFN0cm9rZVBvaW50LFxuICBUZXh0SXRlbSxcbiAgV2hpdGVib2FyZEl0ZW0sXG4gIFdoaXRlYm9hcmRMYXllcixcbiAgV2hpdGVib2FyZFRvb2xcbn0gZnJvbSBcIi4vdHlwZXNcIjtcblxuaW50ZXJmYWNlIFdoaXRlYm9hcmRIb3N0IHtcbiAgc291cmNlUGF0aDogc3RyaW5nO1xuICBzYXZlKGJvYXJkOiBFbWJlZGRlZFdoaXRlYm9hcmREYXRhKTogUHJvbWlzZTx2b2lkPjtcbn1cblxuaW50ZXJmYWNlIFdoaXRlYm9hcmRIYW5kbGUge1xuICBkZXN0cm95KCk6IHZvaWQ7XG59XG5cbnR5cGUgUG9pbnRlck1vZGUgPVxuICB8IHsgdHlwZTogXCJpZGxlXCIgfVxuICB8IHsgdHlwZTogXCJwYW5cIjsgc3RhcnRYOiBudW1iZXI7IHN0YXJ0WTogbnVtYmVyOyBvcmlnaW5YOiBudW1iZXI7IG9yaWdpblk6IG51bWJlciB9XG4gIHwgeyB0eXBlOiBcImRyYXdcIjsgcG9pbnRlcklkOiBudW1iZXIgfVxuICB8IHtcbiAgICAgIHR5cGU6IFwibW92ZVwiO1xuICAgICAgcG9pbnRlcklkOiBudW1iZXI7XG4gICAgICBpdGVtSWQ6IHN0cmluZztcbiAgICAgIHN0YXJ0WDogbnVtYmVyO1xuICAgICAgc3RhcnRZOiBudW1iZXI7XG4gICAgICBvcmlnaW5UZXh0PzogeyB4OiBudW1iZXI7IHk6IG51bWJlciB9O1xuICAgICAgb3JpZ2luUG9pbnRzPzogU3Ryb2tlUG9pbnRbXTtcbiAgICB9XG4gIHwgeyB0eXBlOiBcImVyYXNlXCI7IHBvaW50ZXJJZDogbnVtYmVyOyByZW1vdmVkOiBib29sZWFuIH07XG5cbmNvbnN0IFRPT0xfTEFCRUxTOiBSZWNvcmQ8V2hpdGVib2FyZFRvb2wsIHN0cmluZz4gPSB7XG4gIHBlbjogXCJQZW5cIixcbiAgcGVuY2lsOiBcIlBlbmNpbFwiLFxuICBtYXJrZXI6IFwiTWFya2VyXCIsXG4gIGVyYXNlcjogXCJFcmFzZXJcIixcbiAgdGV4dDogXCJUZXh0XCIsXG4gIHNlbGVjdDogXCJTZWxlY3RcIixcbiAgaGFuZDogXCJIYW5kXCJcbn07XG5cbmV4cG9ydCBmdW5jdGlvbiBtb3VudFdoaXRlYm9hcmQoXG4gIGNvbnRhaW5lcjogSFRNTEVsZW1lbnQsXG4gIGluaXRpYWxCb2FyZDogRW1iZWRkZWRXaGl0ZWJvYXJkRGF0YSxcbiAgaG9zdDogV2hpdGVib2FyZEhvc3Rcbik6IFdoaXRlYm9hcmRIYW5kbGUge1xuICBjb250YWluZXIuZW1wdHkoKTtcbiAgY29udGFpbmVyLmFkZENsYXNzKFwiZW1iZWRkZWQtd2hpdGVib2FyZFwiKTtcblxuICBjb25zdCByb290ID0gY29udGFpbmVyLmNyZWF0ZURpdih7IGNsczogXCJlbWJlZGRlZC13aGl0ZWJvYXJkX19zaGVsbFwiIH0pO1xuICBjb25zdCB0b29sYmFyID0gcm9vdC5jcmVhdGVEaXYoeyBjbHM6IFwiZW1iZWRkZWQtd2hpdGVib2FyZF9fdG9vbGJhclwiIH0pO1xuICBjb25zdCB3b3Jrc3BhY2UgPSByb290LmNyZWF0ZURpdih7IGNsczogXCJlbWJlZGRlZC13aGl0ZWJvYXJkX193b3Jrc3BhY2VcIiB9KTtcbiAgY29uc3Qgdmlld3BvcnQgPSB3b3Jrc3BhY2UuY3JlYXRlRGl2KHsgY2xzOiBcImVtYmVkZGVkLXdoaXRlYm9hcmRfX3ZpZXdwb3J0XCIgfSk7XG4gIGNvbnN0IGdyaWQgPSB2aWV3cG9ydC5jcmVhdGVEaXYoeyBjbHM6IFwiZW1iZWRkZWQtd2hpdGVib2FyZF9fZ3JpZFwiIH0pO1xuICBjb25zdCBzY2VuZSA9IHZpZXdwb3J0LmNyZWF0ZUVsKFwic3ZnXCIsIHsgY2xzOiBcImVtYmVkZGVkLXdoaXRlYm9hcmRfX3NjZW5lXCIgfSk7XG4gIHNjZW5lLnNldEF0dHJpYnV0ZShcIndpZHRoXCIsIFwiMTAwJVwiKTtcbiAgc2NlbmUuc2V0QXR0cmlidXRlKFwiaGVpZ2h0XCIsIFwiMTAwJVwiKTtcbiAgY29uc3Qgc3Ryb2tlTGF5ZXIgPSBzY2VuZS5jcmVhdGVFbChcImdcIiwgeyBjbHM6IFwiZW1iZWRkZWQtd2hpdGVib2FyZF9fc3Ryb2tlLWxheWVyXCIgfSk7XG4gIGNvbnN0IGRyYWZ0TGF5ZXIgPSBzY2VuZS5jcmVhdGVFbChcImdcIiwgeyBjbHM6IFwiZW1iZWRkZWQtd2hpdGVib2FyZF9fZHJhZnQtbGF5ZXJcIiB9KTtcbiAgY29uc3QgZHJhZnRQYXRoID0gZHJhZnRMYXllci5jcmVhdGVFbChcInBhdGhcIiwgeyBjbHM6IFwiZW1iZWRkZWQtd2hpdGVib2FyZF9fZHJhZnQtcGF0aFwiIH0pO1xuICBjb25zdCB0ZXh0V29ybGQgPSB2aWV3cG9ydC5jcmVhdGVEaXYoeyBjbHM6IFwiZW1iZWRkZWQtd2hpdGVib2FyZF9fdGV4dC13b3JsZFwiIH0pO1xuICBjb25zdCBzaWRlYmFyID0gd29ya3NwYWNlLmNyZWF0ZURpdih7IGNsczogXCJlbWJlZGRlZC13aGl0ZWJvYXJkX19zaWRlYmFyXCIgfSk7XG4gIGNvbnN0IGxheWVySGVhZGVyID0gc2lkZWJhci5jcmVhdGVEaXYoeyBjbHM6IFwiZW1iZWRkZWQtd2hpdGVib2FyZF9fc2lkZWJhci1oZWFkZXJcIiB9KTtcbiAgbGF5ZXJIZWFkZXIuY3JlYXRlU3Bhbih7IHRleHQ6IFwiTGF5ZXJzXCIgfSk7XG4gIGNvbnN0IGFkZExheWVyQnV0dG9uID0gbGF5ZXJIZWFkZXIuY3JlYXRlRWwoXCJidXR0b25cIiwge1xuICAgIGNsczogXCJlbWJlZGRlZC13aGl0ZWJvYXJkX19taW5pLWJ1dHRvblwiLFxuICAgIHRleHQ6IFwiKyBMYXllclwiXG4gIH0pO1xuICBhZGRMYXllckJ1dHRvbi50eXBlID0gXCJidXR0b25cIjtcbiAgY29uc3QgbGF5ZXJzTGlzdCA9IHNpZGViYXIuY3JlYXRlRGl2KHsgY2xzOiBcImVtYmVkZGVkLXdoaXRlYm9hcmRfX2xheWVyc1wiIH0pO1xuICBjb25zdCBzdGF0dXMgPSB0b29sYmFyLmNyZWF0ZURpdih7IGNsczogXCJlbWJlZGRlZC13aGl0ZWJvYXJkX19zdGF0dXNcIiwgdGV4dDogXCJSZWFkeVwiIH0pO1xuXG4gIGxldCBib2FyZCA9IHN0cnVjdHVyZWRDbG9uZShpbml0aWFsQm9hcmQpO1xuICBpZiAoYm9hcmQubGF5ZXJzLmxlbmd0aCA9PT0gMCkge1xuICAgIGJvYXJkID0gY3JlYXRlRGVmYXVsdEJvYXJkKCk7XG4gIH1cblxuICBsZXQgYWN0aXZlVG9vbDogV2hpdGVib2FyZFRvb2wgPSBcInBlblwiO1xuICBsZXQgYWN0aXZlQ29sb3IgPSBERUZBVUxUX0NPTE9SU1swXTtcbiAgbGV0IGJydXNoU2l6ZSA9IFRPT0xfUFJFU0VUUy5wZW4ud2lkdGg7XG4gIGxldCBvcGFjaXR5ID0gVE9PTF9QUkVTRVRTLnBlbi5vcGFjaXR5O1xuICBsZXQgYWN0aXZlTGF5ZXJJZCA9IGJvYXJkLmxheWVyc1swXS5pZDtcbiAgbGV0IHNlbGVjdGVkSXRlbUlkOiBzdHJpbmcgfCBudWxsID0gbnVsbDtcbiAgbGV0IHBvaW50ZXJNb2RlOiBQb2ludGVyTW9kZSA9IHsgdHlwZTogXCJpZGxlXCIgfTtcbiAgbGV0IGRyYWZ0U3Ryb2tlOiBTdHJva2VJdGVtIHwgbnVsbCA9IG51bGw7XG4gIGxldCBzYXZlVGltZXI6IG51bWJlciB8IG51bGwgPSBudWxsO1xuICBsZXQgZGVzdHJveWVkID0gZmFsc2U7XG4gIGxldCBhY3RpdmVUZXh0RWRpdG9yOiBIVE1MVGV4dEFyZWFFbGVtZW50IHwgbnVsbCA9IG51bGw7XG4gIGxldCBoaXN0b3J5ID0gW3N0cnVjdHVyZWRDbG9uZShib2FyZCldO1xuICBsZXQgaGlzdG9yeUluZGV4ID0gMDtcblxuICBjb25zdCB0b29sQnV0dG9ucyA9IG5ldyBNYXA8V2hpdGVib2FyZFRvb2wsIEhUTUxCdXR0b25FbGVtZW50PigpO1xuICBjb25zdCB1bmRvQnV0dG9uID0gdG9vbGJhci5jcmVhdGVFbChcImJ1dHRvblwiLCB7IGNsczogXCJlbWJlZGRlZC13aGl0ZWJvYXJkX19idXR0b25cIiwgdGV4dDogXCJVbmRvXCIgfSk7XG4gIHVuZG9CdXR0b24udHlwZSA9IFwiYnV0dG9uXCI7XG4gIGNvbnN0IHJlZG9CdXR0b24gPSB0b29sYmFyLmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHsgY2xzOiBcImVtYmVkZGVkLXdoaXRlYm9hcmRfX2J1dHRvblwiLCB0ZXh0OiBcIlJlZG9cIiB9KTtcbiAgcmVkb0J1dHRvbi50eXBlID0gXCJidXR0b25cIjtcblxuICBjb25zdCB0b29sT3JkZXI6IFdoaXRlYm9hcmRUb29sW10gPSBbXCJwZW5cIiwgXCJwZW5jaWxcIiwgXCJtYXJrZXJcIiwgXCJlcmFzZXJcIiwgXCJ0ZXh0XCIsIFwic2VsZWN0XCIsIFwiaGFuZFwiXTtcbiAgZm9yIChjb25zdCB0b29sIG9mIHRvb2xPcmRlcikge1xuICAgIGNvbnN0IGJ1dHRvbiA9IHRvb2xiYXIuY3JlYXRlRWwoXCJidXR0b25cIiwge1xuICAgICAgY2xzOiBcImVtYmVkZGVkLXdoaXRlYm9hcmRfX2J1dHRvbiBlbWJlZGRlZC13aGl0ZWJvYXJkX190b29sLWJ1dHRvblwiLFxuICAgICAgdGV4dDogVE9PTF9MQUJFTFNbdG9vbF1cbiAgICB9KTtcbiAgICBidXR0b24udHlwZSA9IFwiYnV0dG9uXCI7XG4gICAgYnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoKSA9PiBzZXRBY3RpdmVUb29sKHRvb2wpKTtcbiAgICB0b29sQnV0dG9ucy5zZXQodG9vbCwgYnV0dG9uKTtcbiAgfVxuXG4gIGNvbnN0IGNvbG9ySW5wdXQgPSB0b29sYmFyLmNyZWF0ZUVsKFwiaW5wdXRcIiwgeyBjbHM6IFwiZW1iZWRkZWQtd2hpdGVib2FyZF9fY29sb3ItaW5wdXRcIiB9KTtcbiAgY29sb3JJbnB1dC50eXBlID0gXCJjb2xvclwiO1xuICBjb2xvcklucHV0LnZhbHVlID0gYWN0aXZlQ29sb3I7XG5cbiAgY29uc3Qgc3dhdGNoZXMgPSB0b29sYmFyLmNyZWF0ZURpdih7IGNsczogXCJlbWJlZGRlZC13aGl0ZWJvYXJkX19zd2F0Y2hlc1wiIH0pO1xuICBmb3IgKGNvbnN0IGNvbG9yIG9mIERFRkFVTFRfQ09MT1JTKSB7XG4gICAgY29uc3Qgc3dhdGNoID0gc3dhdGNoZXMuY3JlYXRlRWwoXCJidXR0b25cIiwgeyBjbHM6IFwiZW1iZWRkZWQtd2hpdGVib2FyZF9fc3dhdGNoXCIgfSk7XG4gICAgc3dhdGNoLnR5cGUgPSBcImJ1dHRvblwiO1xuICAgIHN3YXRjaC5zdHlsZS5iYWNrZ3JvdW5kQ29sb3IgPSBjb2xvcjtcbiAgICBzd2F0Y2guYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IHtcbiAgICAgIGFjdGl2ZUNvbG9yID0gY29sb3I7XG4gICAgICBjb2xvcklucHV0LnZhbHVlID0gY29sb3I7XG4gICAgICB1cGRhdGVUb29sYmFyKCk7XG4gICAgfSk7XG4gIH1cblxuICBjb25zdCBzaXplSW5wdXQgPSB0b29sYmFyLmNyZWF0ZUVsKFwiaW5wdXRcIiwgeyBjbHM6IFwiZW1iZWRkZWQtd2hpdGVib2FyZF9fcmFuZ2VcIiB9KTtcbiAgc2l6ZUlucHV0LnR5cGUgPSBcInJhbmdlXCI7XG4gIHNpemVJbnB1dC5taW4gPSBcIjFcIjtcbiAgc2l6ZUlucHV0Lm1heCA9IFwiMzZcIjtcbiAgc2l6ZUlucHV0LnZhbHVlID0gU3RyaW5nKGJydXNoU2l6ZSk7XG5cbiAgY29uc3Qgb3BhY2l0eUlucHV0ID0gdG9vbGJhci5jcmVhdGVFbChcImlucHV0XCIsIHsgY2xzOiBcImVtYmVkZGVkLXdoaXRlYm9hcmRfX3JhbmdlXCIgfSk7XG4gIG9wYWNpdHlJbnB1dC50eXBlID0gXCJyYW5nZVwiO1xuICBvcGFjaXR5SW5wdXQubWluID0gXCIwLjFcIjtcbiAgb3BhY2l0eUlucHV0Lm1heCA9IFwiMVwiO1xuICBvcGFjaXR5SW5wdXQuc3RlcCA9IFwiMC4wNVwiO1xuICBvcGFjaXR5SW5wdXQudmFsdWUgPSBTdHJpbmcob3BhY2l0eSk7XG5cbiAgdG9vbGJhci5hcHBlbmRDaGlsZChzdGF0dXMpO1xuICB2aWV3cG9ydC5zdHlsZS5taW5IZWlnaHQgPSBgJHtERUZBVUxUX0JPQVJEX0hFSUdIVH1weGA7XG5cbiAgdW5kb0J1dHRvbi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKCkgPT4gdW5kbygpKTtcbiAgcmVkb0J1dHRvbi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKCkgPT4gcmVkbygpKTtcbiAgYWRkTGF5ZXJCdXR0b24uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IGFkZExheWVyKCkpO1xuICBjb2xvcklucHV0LmFkZEV2ZW50TGlzdGVuZXIoXCJpbnB1dFwiLCAoKSA9PiB7XG4gICAgYWN0aXZlQ29sb3IgPSBjb2xvcklucHV0LnZhbHVlO1xuICB9KTtcbiAgc2l6ZUlucHV0LmFkZEV2ZW50TGlzdGVuZXIoXCJpbnB1dFwiLCAoKSA9PiB7XG4gICAgYnJ1c2hTaXplID0gTnVtYmVyKHNpemVJbnB1dC52YWx1ZSk7XG4gIH0pO1xuICBvcGFjaXR5SW5wdXQuYWRkRXZlbnRMaXN0ZW5lcihcImlucHV0XCIsICgpID0+IHtcbiAgICBvcGFjaXR5ID0gTnVtYmVyKG9wYWNpdHlJbnB1dC52YWx1ZSk7XG4gIH0pO1xuXG4gIGZ1bmN0aW9uIHNldEFjdGl2ZVRvb2wodG9vbDogV2hpdGVib2FyZFRvb2wpOiB2b2lkIHtcbiAgICBhY3RpdmVUb29sID0gdG9vbDtcbiAgICBpZiAodG9vbCA9PT0gXCJwZW5cIiB8fCB0b29sID09PSBcInBlbmNpbFwiIHx8IHRvb2wgPT09IFwibWFya2VyXCIpIHtcbiAgICAgIGJydXNoU2l6ZSA9IFRPT0xfUFJFU0VUU1t0b29sXS53aWR0aDtcbiAgICAgIG9wYWNpdHkgPSBUT09MX1BSRVNFVFNbdG9vbF0ub3BhY2l0eTtcbiAgICAgIHNpemVJbnB1dC52YWx1ZSA9IFN0cmluZyhicnVzaFNpemUpO1xuICAgICAgb3BhY2l0eUlucHV0LnZhbHVlID0gU3RyaW5nKG9wYWNpdHkpO1xuICAgIH1cbiAgICB1cGRhdGVUb29sYmFyKCk7XG4gICAgdXBkYXRlU3RhdHVzKGAke1RPT0xfTEFCRUxTW3Rvb2xdfSByZWFkeWApO1xuICB9XG5cbiAgZnVuY3Rpb24gdXBkYXRlVG9vbGJhcigpOiB2b2lkIHtcbiAgICBmb3IgKGNvbnN0IFt0b29sLCBidXR0b25dIG9mIHRvb2xCdXR0b25zKSB7XG4gICAgICBidXR0b24udG9nZ2xlQ2xhc3MoXCJpcy1hY3RpdmVcIiwgdG9vbCA9PT0gYWN0aXZlVG9vbCk7XG4gICAgfVxuICAgIHVuZG9CdXR0b24uZGlzYWJsZWQgPSBoaXN0b3J5SW5kZXggPT09IDA7XG4gICAgcmVkb0J1dHRvbi5kaXNhYmxlZCA9IGhpc3RvcnlJbmRleCA9PT0gaGlzdG9yeS5sZW5ndGggLSAxO1xuICB9XG5cbiAgZnVuY3Rpb24gdXBkYXRlU3RhdHVzKG1lc3NhZ2UgPSBcIlJlYWR5XCIpOiB2b2lkIHtcbiAgICBzdGF0dXMuc2V0VGV4dChtZXNzYWdlKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHF1ZXVlU2F2ZSgpOiB2b2lkIHtcbiAgICBpZiAoZGVzdHJveWVkKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKHNhdmVUaW1lciAhPT0gbnVsbCkge1xuICAgICAgd2luZG93LmNsZWFyVGltZW91dChzYXZlVGltZXIpO1xuICAgIH1cblxuICAgIHNhdmVUaW1lciA9IHdpbmRvdy5zZXRUaW1lb3V0KGFzeW5jICgpID0+IHtcbiAgICAgIHNhdmVUaW1lciA9IG51bGw7XG4gICAgICB0cnkge1xuICAgICAgICBhd2FpdCBob3N0LnNhdmUoc3RydWN0dXJlZENsb25lKGJvYXJkKSk7XG4gICAgICAgIHVwZGF0ZVN0YXR1cyhcIlNhdmVkXCIpO1xuICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgY29uc29sZS5lcnJvcihlcnJvcik7XG4gICAgICAgIG5ldyBOb3RpY2UoXCJVbmFibGUgdG8gc2F2ZSBlbWJlZGRlZCB3aGl0ZWJvYXJkXCIpO1xuICAgICAgICB1cGRhdGVTdGF0dXMoXCJTYXZlIGZhaWxlZFwiKTtcbiAgICAgIH1cbiAgICB9LCAxNjApO1xuICB9XG5cbiAgZnVuY3Rpb24gcHVzaEhpc3RvcnkoKTogdm9pZCB7XG4gICAgY29uc3Qgc25hcHNob3QgPSBzdHJ1Y3R1cmVkQ2xvbmUoYm9hcmQpO1xuICAgIGhpc3RvcnkgPSBoaXN0b3J5LnNsaWNlKDAsIGhpc3RvcnlJbmRleCArIDEpO1xuICAgIGhpc3RvcnkucHVzaChzbmFwc2hvdCk7XG4gICAgaGlzdG9yeUluZGV4ID0gaGlzdG9yeS5sZW5ndGggLSAxO1xuICAgIHVwZGF0ZVRvb2xiYXIoKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHVuZG8oKTogdm9pZCB7XG4gICAgaWYgKGhpc3RvcnlJbmRleCA9PT0gMCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBoaXN0b3J5SW5kZXggLT0gMTtcbiAgICBib2FyZCA9IHN0cnVjdHVyZWRDbG9uZShoaXN0b3J5W2hpc3RvcnlJbmRleF0pO1xuICAgIGVuc3VyZUFjdGl2ZUxheWVyKCk7XG4gICAgc2VsZWN0ZWRJdGVtSWQgPSBudWxsO1xuICAgIHJlbmRlckJvYXJkKCk7XG4gICAgcXVldWVTYXZlKCk7XG4gIH1cblxuICBmdW5jdGlvbiByZWRvKCk6IHZvaWQge1xuICAgIGlmIChoaXN0b3J5SW5kZXggPj0gaGlzdG9yeS5sZW5ndGggLSAxKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGhpc3RvcnlJbmRleCArPSAxO1xuICAgIGJvYXJkID0gc3RydWN0dXJlZENsb25lKGhpc3RvcnlbaGlzdG9yeUluZGV4XSk7XG4gICAgZW5zdXJlQWN0aXZlTGF5ZXIoKTtcbiAgICBzZWxlY3RlZEl0ZW1JZCA9IG51bGw7XG4gICAgcmVuZGVyQm9hcmQoKTtcbiAgICBxdWV1ZVNhdmUoKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGVuc3VyZUFjdGl2ZUxheWVyKCk6IHZvaWQge1xuICAgIGlmICghYm9hcmQubGF5ZXJzLnNvbWUoKGxheWVyKSA9PiBsYXllci5pZCA9PT0gYWN0aXZlTGF5ZXJJZCkpIHtcbiAgICAgIGFjdGl2ZUxheWVySWQgPSBib2FyZC5sYXllcnNbMF0/LmlkID8/IGNyZWF0ZURlZmF1bHRCb2FyZCgpLmxheWVyc1swXS5pZDtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBnZXRMYXllcihsYXllcklkOiBzdHJpbmcpOiBXaGl0ZWJvYXJkTGF5ZXIgfCB1bmRlZmluZWQge1xuICAgIHJldHVybiBib2FyZC5sYXllcnMuZmluZCgobGF5ZXIpID0+IGxheWVyLmlkID09PSBsYXllcklkKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGdldEl0ZW0oaXRlbUlkOiBzdHJpbmcpOiBXaGl0ZWJvYXJkSXRlbSB8IHVuZGVmaW5lZCB7XG4gICAgcmV0dXJuIGJvYXJkLml0ZW1zLmZpbmQoKGl0ZW0pID0+IGl0ZW0uaWQgPT09IGl0ZW1JZCk7XG4gIH1cblxuICBmdW5jdGlvbiBpc0xheWVyVmlzaWJsZShsYXllcklkOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgICByZXR1cm4gZ2V0TGF5ZXIobGF5ZXJJZCk/LnZpc2libGUgIT09IGZhbHNlO1xuICB9XG5cbiAgZnVuY3Rpb24gaXNMYXllckxvY2tlZChsYXllcklkOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgICByZXR1cm4gZ2V0TGF5ZXIobGF5ZXJJZCk/LmxvY2tlZCA9PT0gdHJ1ZTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGFwcGx5Vmlld3BvcnQoKTogdm9pZCB7XG4gICAgc2NlbmUuc3R5bGUudHJhbnNmb3JtID0gYHRyYW5zbGF0ZSgke2JvYXJkLnZpZXdwb3J0Lnh9cHgsICR7Ym9hcmQudmlld3BvcnQueX1weCkgc2NhbGUoJHtib2FyZC52aWV3cG9ydC56b29tfSlgO1xuICAgIHRleHRXb3JsZC5zdHlsZS50cmFuc2Zvcm0gPSBgdHJhbnNsYXRlKCR7Ym9hcmQudmlld3BvcnQueH1weCwgJHtib2FyZC52aWV3cG9ydC55fXB4KSBzY2FsZSgke2JvYXJkLnZpZXdwb3J0Lnpvb219KWA7XG4gICAgY29uc3QgZ3JpZFNpemUgPSA0OCAqIGJvYXJkLnZpZXdwb3J0Lnpvb207XG4gICAgZ3JpZC5zdHlsZS5iYWNrZ3JvdW5kU2l6ZSA9IGAke2dyaWRTaXplfXB4ICR7Z3JpZFNpemV9cHhgO1xuICAgIGdyaWQuc3R5bGUuYmFja2dyb3VuZFBvc2l0aW9uID0gYCR7Ym9hcmQudmlld3BvcnQueH1weCAke2JvYXJkLnZpZXdwb3J0Lnl9cHhgO1xuICB9XG5cbiAgZnVuY3Rpb24gcmVuZGVyTGF5ZXJzKCk6IHZvaWQge1xuICAgIGxheWVyc0xpc3QuZW1wdHkoKTtcblxuICAgIGZvciAoY29uc3QgbGF5ZXIgb2YgWy4uLmJvYXJkLmxheWVyc10ucmV2ZXJzZSgpKSB7XG4gICAgICBjb25zdCByb3cgPSBsYXllcnNMaXN0LmNyZWF0ZURpdih7IGNsczogXCJlbWJlZGRlZC13aGl0ZWJvYXJkX19sYXllci1yb3dcIiB9KTtcbiAgICAgIHJvdy50b2dnbGVDbGFzcyhcImlzLWFjdGl2ZVwiLCBsYXllci5pZCA9PT0gYWN0aXZlTGF5ZXJJZCk7XG5cbiAgICAgIGNvbnN0IHZpc2liaWxpdHlCdXR0b24gPSByb3cuY3JlYXRlRWwoXCJidXR0b25cIiwge1xuICAgICAgICBjbHM6IFwiZW1iZWRkZWQtd2hpdGVib2FyZF9fbGF5ZXItdmlzaWJpbGl0eVwiLFxuICAgICAgICB0ZXh0OiBsYXllci52aXNpYmxlID8gXCJIaWRlXCIgOiBcIlNob3dcIlxuICAgICAgfSk7XG4gICAgICB2aXNpYmlsaXR5QnV0dG9uLnR5cGUgPSBcImJ1dHRvblwiO1xuICAgICAgdmlzaWJpbGl0eUJ1dHRvbi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKCkgPT4ge1xuICAgICAgICBsYXllci52aXNpYmxlID0gIWxheWVyLnZpc2libGU7XG4gICAgICAgIHJlbmRlckJvYXJkKCk7XG4gICAgICAgIHB1c2hIaXN0b3J5KCk7XG4gICAgICAgIHF1ZXVlU2F2ZSgpO1xuICAgICAgfSk7XG5cbiAgICAgIGNvbnN0IGxvY2tCdXR0b24gPSByb3cuY3JlYXRlRWwoXCJidXR0b25cIiwge1xuICAgICAgICBjbHM6IFwiZW1iZWRkZWQtd2hpdGVib2FyZF9fbGF5ZXItbG9ja1wiLFxuICAgICAgICB0ZXh0OiBsYXllci5sb2NrZWQgPyBcIlVubG9ja1wiIDogXCJMb2NrXCJcbiAgICAgIH0pO1xuICAgICAgbG9ja0J1dHRvbi50eXBlID0gXCJidXR0b25cIjtcbiAgICAgIGxvY2tCdXR0b24uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IHtcbiAgICAgICAgbGF5ZXIubG9ja2VkID0gIWxheWVyLmxvY2tlZDtcbiAgICAgICAgcmVuZGVyQm9hcmQoKTtcbiAgICAgICAgcHVzaEhpc3RvcnkoKTtcbiAgICAgICAgcXVldWVTYXZlKCk7XG4gICAgICB9KTtcblxuICAgICAgY29uc3QgbmFtZUJ1dHRvbiA9IHJvdy5jcmVhdGVFbChcImJ1dHRvblwiLCB7XG4gICAgICAgIGNsczogXCJlbWJlZGRlZC13aGl0ZWJvYXJkX19sYXllci1uYW1lXCIsXG4gICAgICAgIHRleHQ6IGxheWVyLm5hbWVcbiAgICAgIH0pO1xuICAgICAgbmFtZUJ1dHRvbi50eXBlID0gXCJidXR0b25cIjtcbiAgICAgIG5hbWVCdXR0b24uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IHtcbiAgICAgICAgYWN0aXZlTGF5ZXJJZCA9IGxheWVyLmlkO1xuICAgICAgICByZW5kZXJMYXllcnMoKTtcbiAgICAgICAgdXBkYXRlU3RhdHVzKGBBY3RpdmUgbGF5ZXI6ICR7bGF5ZXIubmFtZX1gKTtcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIHJlbmRlckJvYXJkKCk6IHZvaWQge1xuICAgIGNsZWFudXBUZXh0RWRpdG9yKCk7XG4gICAgYXBwbHlWaWV3cG9ydCgpO1xuICAgIHJlbmRlckl0ZW1zKCk7XG4gICAgcmVuZGVyTGF5ZXJzKCk7XG4gICAgdXBkYXRlVG9vbGJhcigpO1xuICB9XG5cbiAgZnVuY3Rpb24gcmVuZGVySXRlbXMoKTogdm9pZCB7XG4gICAgc3Ryb2tlTGF5ZXIuZW1wdHkoKTtcbiAgICB0ZXh0V29ybGQuZW1wdHkoKTtcblxuICAgIGZvciAoY29uc3QgaXRlbSBvZiBib2FyZC5pdGVtcykge1xuICAgICAgaWYgKCFpc0xheWVyVmlzaWJsZShpdGVtLmxheWVySWQpKSB7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICBpZiAoaXRlbS50eXBlID09PSBcInN0cm9rZVwiKSB7XG4gICAgICAgIGNvbnN0IHBhdGggPSBzdHJva2VMYXllci5jcmVhdGVFbChcInBhdGhcIiwgeyBjbHM6IFwiZW1iZWRkZWQtd2hpdGVib2FyZF9fc3Ryb2tlXCIgfSk7XG4gICAgICAgIHBhdGguc2V0QXR0cmlidXRlKFwiZFwiLCBwb2ludHNUb1BhdGgoaXRlbS5wb2ludHMpKTtcbiAgICAgICAgcGF0aC5zZXRBdHRyaWJ1dGUoXCJzdHJva2VcIiwgaXRlbS5jb2xvcik7XG4gICAgICAgIHBhdGguc2V0QXR0cmlidXRlKFwic3Ryb2tlLXdpZHRoXCIsIFN0cmluZyhpdGVtLndpZHRoKSk7XG4gICAgICAgIHBhdGguc2V0QXR0cmlidXRlKFwic3Ryb2tlLWxpbmVjYXBcIiwgXCJyb3VuZFwiKTtcbiAgICAgICAgcGF0aC5zZXRBdHRyaWJ1dGUoXCJzdHJva2UtbGluZWpvaW5cIiwgXCJyb3VuZFwiKTtcbiAgICAgICAgcGF0aC5zZXRBdHRyaWJ1dGUoXCJmaWxsXCIsIFwibm9uZVwiKTtcbiAgICAgICAgcGF0aC5zdHlsZS5vcGFjaXR5ID0gU3RyaW5nKGl0ZW0ub3BhY2l0eSk7XG4gICAgICAgIHBhdGguZGF0YXNldC5pdGVtSWQgPSBpdGVtLmlkO1xuICAgICAgICBwYXRoLmRhdGFzZXQudG9vbCA9IGl0ZW0udG9vbDtcbiAgICAgICAgcGF0aC50b2dnbGVDbGFzcyhcImlzLXNlbGVjdGVkXCIsIGl0ZW0uaWQgPT09IHNlbGVjdGVkSXRlbUlkKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnN0IHRleHRFbCA9IHRleHRXb3JsZC5jcmVhdGVEaXYoeyBjbHM6IFwiZW1iZWRkZWQtd2hpdGVib2FyZF9fdGV4dC1pdGVtXCIgfSk7XG4gICAgICAgIHRleHRFbC5kYXRhc2V0Lml0ZW1JZCA9IGl0ZW0uaWQ7XG4gICAgICAgIHRleHRFbC5zdHlsZS5sZWZ0ID0gYCR7aXRlbS54fXB4YDtcbiAgICAgICAgdGV4dEVsLnN0eWxlLnRvcCA9IGAke2l0ZW0ueX1weGA7XG4gICAgICAgIHRleHRFbC5zdHlsZS5jb2xvciA9IGl0ZW0uY29sb3I7XG4gICAgICAgIHRleHRFbC5zdHlsZS5mb250U2l6ZSA9IGAke2l0ZW0uc2l6ZX1weGA7XG4gICAgICAgIHRleHRFbC5zdHlsZS53aGl0ZVNwYWNlID0gXCJwcmUtd3JhcFwiO1xuICAgICAgICB0ZXh0RWwuc2V0VGV4dChpdGVtLnRleHQgfHwgXCJUZXh0XCIpO1xuICAgICAgICB0ZXh0RWwudG9nZ2xlQ2xhc3MoXCJpcy1zZWxlY3RlZFwiLCBpdGVtLmlkID09PSBzZWxlY3RlZEl0ZW1JZCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gcmVuZGVyRHJhZnRTdHJva2UoKTogdm9pZCB7XG4gICAgaWYgKCFkcmFmdFN0cm9rZSkge1xuICAgICAgZHJhZnRQYXRoLnNldEF0dHJpYnV0ZShcImRcIiwgXCJcIik7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgZHJhZnRQYXRoLnNldEF0dHJpYnV0ZShcImRcIiwgcG9pbnRzVG9QYXRoKGRyYWZ0U3Ryb2tlLnBvaW50cykpO1xuICAgIGRyYWZ0UGF0aC5zZXRBdHRyaWJ1dGUoXCJzdHJva2VcIiwgZHJhZnRTdHJva2UuY29sb3IpO1xuICAgIGRyYWZ0UGF0aC5zZXRBdHRyaWJ1dGUoXCJzdHJva2Utd2lkdGhcIiwgU3RyaW5nKGRyYWZ0U3Ryb2tlLndpZHRoKSk7XG4gICAgZHJhZnRQYXRoLnNldEF0dHJpYnV0ZShcInN0cm9rZS1saW5lY2FwXCIsIFwicm91bmRcIik7XG4gICAgZHJhZnRQYXRoLnNldEF0dHJpYnV0ZShcInN0cm9rZS1saW5lam9pblwiLCBcInJvdW5kXCIpO1xuICAgIGRyYWZ0UGF0aC5zZXRBdHRyaWJ1dGUoXCJmaWxsXCIsIFwibm9uZVwiKTtcbiAgICBkcmFmdFBhdGguc3R5bGUub3BhY2l0eSA9IFN0cmluZyhkcmFmdFN0cm9rZS5vcGFjaXR5KTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGNsZWFudXBUZXh0RWRpdG9yKCk6IHZvaWQge1xuICAgIGlmIChhY3RpdmVUZXh0RWRpdG9yKSB7XG4gICAgICBpZiAoYWN0aXZlVGV4dEVkaXRvci5pc0Nvbm5lY3RlZCkge1xuICAgICAgICBhY3RpdmVUZXh0RWRpdG9yLnJlbW92ZSgpO1xuICAgICAgfVxuICAgICAgYWN0aXZlVGV4dEVkaXRvciA9IG51bGw7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gb3BlblRleHRFZGl0b3IocG9pbnQ6IHsgeDogbnVtYmVyOyB5OiBudW1iZXIgfSwgZXhpc3Rpbmc/OiBUZXh0SXRlbSk6IHZvaWQge1xuICAgIGNsZWFudXBUZXh0RWRpdG9yKCk7XG5cbiAgICBjb25zdCBlZGl0b3IgPSB0ZXh0V29ybGQuY3JlYXRlRWwoXCJ0ZXh0YXJlYVwiLCB7IGNsczogXCJlbWJlZGRlZC13aGl0ZWJvYXJkX190ZXh0LWVkaXRvclwiIH0pO1xuICAgIGVkaXRvci52YWx1ZSA9IGV4aXN0aW5nPy50ZXh0ID8/IFwiXCI7XG4gICAgZWRpdG9yLnN0eWxlLmxlZnQgPSBgJHtleGlzdGluZz8ueCA/PyBwb2ludC54fXB4YDtcbiAgICBlZGl0b3Iuc3R5bGUudG9wID0gYCR7ZXhpc3Rpbmc/LnkgPz8gcG9pbnQueX1weGA7XG4gICAgZWRpdG9yLnN0eWxlLmNvbG9yID0gZXhpc3Rpbmc/LmNvbG9yID8/IGFjdGl2ZUNvbG9yO1xuICAgIGVkaXRvci5zdHlsZS5mb250U2l6ZSA9IGAke2V4aXN0aW5nPy5zaXplID8/IDIwfXB4YDtcbiAgICBhY3RpdmVUZXh0RWRpdG9yID0gZWRpdG9yO1xuICAgIGVkaXRvci5mb2N1cygpO1xuXG4gICAgY29uc3QgY29tbWl0ID0gKCk6IHZvaWQgPT4ge1xuICAgICAgY29uc3QgdGV4dCA9IGVkaXRvci52YWx1ZS50cmltRW5kKCk7XG4gICAgICBjb25zdCB0YXJnZXQgPSBleGlzdGluZyA/PyB7XG4gICAgICAgIGlkOiBjcmVhdGVJZChcInRleHRcIiksXG4gICAgICAgIHR5cGU6IFwidGV4dFwiIGFzIGNvbnN0LFxuICAgICAgICBsYXllcklkOiBhY3RpdmVMYXllcklkLFxuICAgICAgICB4OiBwb2ludC54LFxuICAgICAgICB5OiBwb2ludC55LFxuICAgICAgICB0ZXh0OiBcIlwiLFxuICAgICAgICBjb2xvcjogYWN0aXZlQ29sb3IsXG4gICAgICAgIHNpemU6IDIwXG4gICAgICB9O1xuXG4gICAgICBpZiAodGV4dC50cmltKCkubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIGNsZWFudXBUZXh0RWRpdG9yKCk7XG4gICAgICAgIHJlbmRlckJvYXJkKCk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgdGFyZ2V0LnRleHQgPSB0ZXh0O1xuICAgICAgdGFyZ2V0LmNvbG9yID0gZXhpc3Rpbmc/LmNvbG9yID8/IGFjdGl2ZUNvbG9yO1xuICAgICAgdGFyZ2V0LnNpemUgPSBleGlzdGluZz8uc2l6ZSA/PyAyMDtcblxuICAgICAgaWYgKCFleGlzdGluZykge1xuICAgICAgICBib2FyZC5pdGVtcy5wdXNoKHRhcmdldCk7XG4gICAgICB9XG5cbiAgICAgIGNsZWFudXBUZXh0RWRpdG9yKCk7XG4gICAgICBzZWxlY3RlZEl0ZW1JZCA9IHRhcmdldC5pZDtcbiAgICAgIHJlbmRlckJvYXJkKCk7XG4gICAgICBwdXNoSGlzdG9yeSgpO1xuICAgICAgcXVldWVTYXZlKCk7XG4gICAgfTtcblxuICAgIGVkaXRvci5hZGRFdmVudExpc3RlbmVyKFwiYmx1clwiLCBjb21taXQsIHsgb25jZTogdHJ1ZSB9KTtcbiAgICBlZGl0b3IuYWRkRXZlbnRMaXN0ZW5lcihcImtleWRvd25cIiwgKGV2ZW50KSA9PiB7XG4gICAgICBpZiAoKGV2ZW50LmN0cmxLZXkgfHwgZXZlbnQubWV0YUtleSkgJiYgZXZlbnQua2V5ID09PSBcIkVudGVyXCIpIHtcbiAgICAgICAgZWRpdG9yLmJsdXIoKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGFkZExheWVyKCk6IHZvaWQge1xuICAgIGNvbnN0IGxheWVyOiBXaGl0ZWJvYXJkTGF5ZXIgPSB7XG4gICAgICBpZDogY3JlYXRlSWQoXCJsYXllclwiKSxcbiAgICAgIG5hbWU6IGBMYXllciAke2JvYXJkLmxheWVycy5sZW5ndGggKyAxfWAsXG4gICAgICB2aXNpYmxlOiB0cnVlLFxuICAgICAgbG9ja2VkOiBmYWxzZVxuICAgIH07XG4gICAgYm9hcmQubGF5ZXJzLnB1c2gobGF5ZXIpO1xuICAgIGFjdGl2ZUxheWVySWQgPSBsYXllci5pZDtcbiAgICByZW5kZXJMYXllcnMoKTtcbiAgICBwdXNoSGlzdG9yeSgpO1xuICAgIHF1ZXVlU2F2ZSgpO1xuICB9XG5cbiAgZnVuY3Rpb24gZ2V0V29ybGRQb2ludChldmVudDogUG9pbnRlckV2ZW50KTogeyB4OiBudW1iZXI7IHk6IG51bWJlciB9IHtcbiAgICBjb25zdCBib3VuZHMgPSB2aWV3cG9ydC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcbiAgICByZXR1cm4ge1xuICAgICAgeDogKGV2ZW50LmNsaWVudFggLSBib3VuZHMubGVmdCAtIGJvYXJkLnZpZXdwb3J0LngpIC8gYm9hcmQudmlld3BvcnQuem9vbSxcbiAgICAgIHk6IChldmVudC5jbGllbnRZIC0gYm91bmRzLnRvcCAtIGJvYXJkLnZpZXdwb3J0LnkpIC8gYm9hcmQudmlld3BvcnQuem9vbVxuICAgIH07XG4gIH1cblxuICBmdW5jdGlvbiBiZWdpblN0cm9rZShwb2ludDogeyB4OiBudW1iZXI7IHk6IG51bWJlciB9LCBldmVudDogUG9pbnRlckV2ZW50KTogdm9pZCB7XG4gICAgaWYgKGlzTGF5ZXJMb2NrZWQoYWN0aXZlTGF5ZXJJZCkpIHtcbiAgICAgIHVwZGF0ZVN0YXR1cyhcIkFjdGl2ZSBsYXllciBpcyBsb2NrZWRcIik7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgdG9vbCA9IGFjdGl2ZVRvb2wgPT09IFwicGVuXCIgfHwgYWN0aXZlVG9vbCA9PT0gXCJwZW5jaWxcIiB8fCBhY3RpdmVUb29sID09PSBcIm1hcmtlclwiID8gYWN0aXZlVG9vbCA6IFwicGVuXCI7XG4gICAgZHJhZnRTdHJva2UgPSB7XG4gICAgICBpZDogY3JlYXRlSWQoXCJzdHJva2VcIiksXG4gICAgICB0eXBlOiBcInN0cm9rZVwiLFxuICAgICAgbGF5ZXJJZDogYWN0aXZlTGF5ZXJJZCxcbiAgICAgIHRvb2wsXG4gICAgICBjb2xvcjogYWN0aXZlQ29sb3IsXG4gICAgICB3aWR0aDogYnJ1c2hTaXplLFxuICAgICAgb3BhY2l0eSxcbiAgICAgIHBvaW50czogW1xuICAgICAgICB7XG4gICAgICAgICAgeDogcG9pbnQueCxcbiAgICAgICAgICB5OiBwb2ludC55LFxuICAgICAgICAgIHByZXNzdXJlOiBub3JtYWxpemVQcmVzc3VyZShldmVudC5wcmVzc3VyZSlcbiAgICAgICAgfVxuICAgICAgXVxuICAgIH07XG4gICAgcG9pbnRlck1vZGUgPSB7IHR5cGU6IFwiZHJhd1wiLCBwb2ludGVySWQ6IGV2ZW50LnBvaW50ZXJJZCB9O1xuICAgIHJlbmRlckRyYWZ0U3Ryb2tlKCk7XG4gIH1cblxuICBmdW5jdGlvbiBjb21taXRTdHJva2UoKTogdm9pZCB7XG4gICAgaWYgKCFkcmFmdFN0cm9rZSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBpZiAoZHJhZnRTdHJva2UucG9pbnRzLmxlbmd0aCA+IDEpIHtcbiAgICAgIGJvYXJkLml0ZW1zLnB1c2goZHJhZnRTdHJva2UpO1xuICAgICAgc2VsZWN0ZWRJdGVtSWQgPSBkcmFmdFN0cm9rZS5pZDtcbiAgICAgIHB1c2hIaXN0b3J5KCk7XG4gICAgICBxdWV1ZVNhdmUoKTtcbiAgICB9XG4gICAgZHJhZnRTdHJva2UgPSBudWxsO1xuICAgIHJlbmRlckRyYWZ0U3Ryb2tlKCk7XG4gICAgcmVuZGVyQm9hcmQoKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGVyYXNlQXQocG9pbnQ6IHsgeDogbnVtYmVyOyB5OiBudW1iZXIgfSk6IGJvb2xlYW4ge1xuICAgIGNvbnN0IGl0ZW0gPSBoaXRUZXN0KHBvaW50LCB0cnVlKTtcbiAgICBpZiAoIWl0ZW0pIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICBib2FyZC5pdGVtcyA9IGJvYXJkLml0ZW1zLmZpbHRlcigoY2FuZGlkYXRlKSA9PiBjYW5kaWRhdGUuaWQgIT09IGl0ZW0uaWQpO1xuICAgIGlmIChzZWxlY3RlZEl0ZW1JZCA9PT0gaXRlbS5pZCkge1xuICAgICAgc2VsZWN0ZWRJdGVtSWQgPSBudWxsO1xuICAgIH1cbiAgICByZW5kZXJCb2FyZCgpO1xuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgZnVuY3Rpb24gaGl0VGVzdChwb2ludDogeyB4OiBudW1iZXI7IHk6IG51bWJlciB9LCBpZ25vcmVMb2NrZWQgPSBmYWxzZSk6IFdoaXRlYm9hcmRJdGVtIHwgbnVsbCB7XG4gICAgZm9yIChjb25zdCBpdGVtIG9mIFsuLi5ib2FyZC5pdGVtc10ucmV2ZXJzZSgpKSB7XG4gICAgICBpZiAoIWlzTGF5ZXJWaXNpYmxlKGl0ZW0ubGF5ZXJJZCkpIHtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gICAgICBpZiAoIWlnbm9yZUxvY2tlZCAmJiBpc0xheWVyTG9ja2VkKGl0ZW0ubGF5ZXJJZCkpIHtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIGlmIChpdGVtLnR5cGUgPT09IFwidGV4dFwiKSB7XG4gICAgICAgIGlmIChcbiAgICAgICAgICBwb2ludC54ID49IGl0ZW0ueCAtIDggJiZcbiAgICAgICAgICBwb2ludC54IDw9IGl0ZW0ueCArIDMyMCAmJlxuICAgICAgICAgIHBvaW50LnkgPj0gaXRlbS55IC0gOCAmJlxuICAgICAgICAgIHBvaW50LnkgPD0gaXRlbS55ICsgNjRcbiAgICAgICAgKSB7XG4gICAgICAgICAgcmV0dXJuIGl0ZW07XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSBpZiAoaXNQb2ludE5lYXJTdHJva2UocG9pbnQsIGl0ZW0pKSB7XG4gICAgICAgIHJldHVybiBpdGVtO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgZnVuY3Rpb24gYmVnaW5Nb3ZlKGl0ZW06IFdoaXRlYm9hcmRJdGVtLCBwb2ludDogeyB4OiBudW1iZXI7IHk6IG51bWJlciB9LCBldmVudDogUG9pbnRlckV2ZW50KTogdm9pZCB7XG4gICAgaWYgKGl0ZW0udHlwZSA9PT0gXCJ0ZXh0XCIpIHtcbiAgICAgIHBvaW50ZXJNb2RlID0ge1xuICAgICAgICB0eXBlOiBcIm1vdmVcIixcbiAgICAgICAgcG9pbnRlcklkOiBldmVudC5wb2ludGVySWQsXG4gICAgICAgIGl0ZW1JZDogaXRlbS5pZCxcbiAgICAgICAgc3RhcnRYOiBwb2ludC54LFxuICAgICAgICBzdGFydFk6IHBvaW50LnksXG4gICAgICAgIG9yaWdpblRleHQ6IHsgeDogaXRlbS54LCB5OiBpdGVtLnkgfVxuICAgICAgfTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBwb2ludGVyTW9kZSA9IHtcbiAgICAgIHR5cGU6IFwibW92ZVwiLFxuICAgICAgcG9pbnRlcklkOiBldmVudC5wb2ludGVySWQsXG4gICAgICBpdGVtSWQ6IGl0ZW0uaWQsXG4gICAgICBzdGFydFg6IHBvaW50LngsXG4gICAgICBzdGFydFk6IHBvaW50LnksXG4gICAgICBvcmlnaW5Qb2ludHM6IGl0ZW0ucG9pbnRzLm1hcCgoY3VycmVudCkgPT4gKHsgLi4uY3VycmVudCB9KSlcbiAgICB9O1xuICB9XG5cbiAgZnVuY3Rpb24gdHJhbnNsYXRlSXRlbShtb2RlOiBFeHRyYWN0PFBvaW50ZXJNb2RlLCB7IHR5cGU6IFwibW92ZVwiIH0+LCBwb2ludDogeyB4OiBudW1iZXI7IHk6IG51bWJlciB9KTogdm9pZCB7XG4gICAgY29uc3QgaXRlbSA9IGdldEl0ZW0obW9kZS5pdGVtSWQpO1xuICAgIGlmICghaXRlbSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IGR4ID0gcG9pbnQueCAtIG1vZGUuc3RhcnRYO1xuICAgIGNvbnN0IGR5ID0gcG9pbnQueSAtIG1vZGUuc3RhcnRZO1xuXG4gICAgaWYgKGl0ZW0udHlwZSA9PT0gXCJ0ZXh0XCIgJiYgbW9kZS5vcmlnaW5UZXh0KSB7XG4gICAgICBpdGVtLnggPSBtb2RlLm9yaWdpblRleHQueCArIGR4O1xuICAgICAgaXRlbS55ID0gbW9kZS5vcmlnaW5UZXh0LnkgKyBkeTtcbiAgICB9XG5cbiAgICBpZiAoaXRlbS50eXBlID09PSBcInN0cm9rZVwiICYmIG1vZGUub3JpZ2luUG9pbnRzKSB7XG4gICAgICBpdGVtLnBvaW50cyA9IG1vZGUub3JpZ2luUG9pbnRzLm1hcCgob3JpZ2luKSA9PiAoe1xuICAgICAgICB4OiBvcmlnaW4ueCArIGR4LFxuICAgICAgICB5OiBvcmlnaW4ueSArIGR5LFxuICAgICAgICBwcmVzc3VyZTogb3JpZ2luLnByZXNzdXJlXG4gICAgICB9KSk7XG4gICAgfVxuXG4gICAgcmVuZGVyQm9hcmQoKTtcbiAgfVxuXG4gIHZpZXdwb3J0LmFkZEV2ZW50TGlzdGVuZXIoXCJwb2ludGVyZG93blwiLCAoZXZlbnQpID0+IHtcbiAgICBjbGVhbnVwVGV4dEVkaXRvcigpO1xuICAgIHZpZXdwb3J0LnNldFBvaW50ZXJDYXB0dXJlKGV2ZW50LnBvaW50ZXJJZCk7XG4gICAgY29uc3QgcG9pbnQgPSBnZXRXb3JsZFBvaW50KGV2ZW50KTtcbiAgICBjb25zdCB0ZXh0VGFyZ2V0ID0gKGV2ZW50LnRhcmdldCBhcyBIVE1MRWxlbWVudCkuY2xvc2VzdDxIVE1MRWxlbWVudD4oXCIuZW1iZWRkZWQtd2hpdGVib2FyZF9fdGV4dC1pdGVtXCIpO1xuICAgIGNvbnN0IHRhcmdldGVkSXRlbSA9IHRleHRUYXJnZXQ/LmRhdGFzZXQuaXRlbUlkID8gZ2V0SXRlbSh0ZXh0VGFyZ2V0LmRhdGFzZXQuaXRlbUlkKSA6IGhpdFRlc3QocG9pbnQpO1xuXG4gICAgaWYgKGFjdGl2ZVRvb2wgPT09IFwiaGFuZFwiIHx8IGV2ZW50LmJ1dHRvbiA9PT0gMSkge1xuICAgICAgcG9pbnRlck1vZGUgPSB7XG4gICAgICAgIHR5cGU6IFwicGFuXCIsXG4gICAgICAgIHN0YXJ0WDogZXZlbnQuY2xpZW50WCxcbiAgICAgICAgc3RhcnRZOiBldmVudC5jbGllbnRZLFxuICAgICAgICBvcmlnaW5YOiBib2FyZC52aWV3cG9ydC54LFxuICAgICAgICBvcmlnaW5ZOiBib2FyZC52aWV3cG9ydC55XG4gICAgICB9O1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmIChhY3RpdmVUb29sID09PSBcInRleHRcIikge1xuICAgICAgaWYgKHRhcmdldGVkSXRlbT8udHlwZSA9PT0gXCJ0ZXh0XCIpIHtcbiAgICAgICAgc2VsZWN0ZWRJdGVtSWQgPSB0YXJnZXRlZEl0ZW0uaWQ7XG4gICAgICAgIG9wZW5UZXh0RWRpdG9yKHsgeDogdGFyZ2V0ZWRJdGVtLngsIHk6IHRhcmdldGVkSXRlbS55IH0sIHRhcmdldGVkSXRlbSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzZWxlY3RlZEl0ZW1JZCA9IG51bGw7XG4gICAgICAgIG9wZW5UZXh0RWRpdG9yKHBvaW50KTtcbiAgICAgIH1cbiAgICAgIHJlbmRlckJvYXJkKCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKGFjdGl2ZVRvb2wgPT09IFwiZXJhc2VyXCIpIHtcbiAgICAgIGNvbnN0IHJlbW92ZWQgPSBlcmFzZUF0KHBvaW50KTtcbiAgICAgIHBvaW50ZXJNb2RlID0geyB0eXBlOiBcImVyYXNlXCIsIHBvaW50ZXJJZDogZXZlbnQucG9pbnRlcklkLCByZW1vdmVkIH07XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKGFjdGl2ZVRvb2wgPT09IFwic2VsZWN0XCIpIHtcbiAgICAgIGlmICh0YXJnZXRlZEl0ZW0pIHtcbiAgICAgICAgc2VsZWN0ZWRJdGVtSWQgPSB0YXJnZXRlZEl0ZW0uaWQ7XG4gICAgICAgIGlmICghaXNMYXllckxvY2tlZCh0YXJnZXRlZEl0ZW0ubGF5ZXJJZCkpIHtcbiAgICAgICAgICBiZWdpbk1vdmUodGFyZ2V0ZWRJdGVtLCBwb2ludCwgZXZlbnQpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzZWxlY3RlZEl0ZW1JZCA9IG51bGw7XG4gICAgICAgIHJlbmRlckJvYXJkKCk7XG4gICAgICB9XG4gICAgICByZW5kZXJCb2FyZCgpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGJlZ2luU3Ryb2tlKHBvaW50LCBldmVudCk7XG4gIH0pO1xuXG4gIHZpZXdwb3J0LmFkZEV2ZW50TGlzdGVuZXIoXCJwb2ludGVybW92ZVwiLCAoZXZlbnQpID0+IHtcbiAgICBjb25zdCBwb2ludCA9IGdldFdvcmxkUG9pbnQoZXZlbnQpO1xuXG4gICAgaWYgKHBvaW50ZXJNb2RlLnR5cGUgPT09IFwicGFuXCIpIHtcbiAgICAgIGJvYXJkLnZpZXdwb3J0LnggPSBwb2ludGVyTW9kZS5vcmlnaW5YICsgKGV2ZW50LmNsaWVudFggLSBwb2ludGVyTW9kZS5zdGFydFgpO1xuICAgICAgYm9hcmQudmlld3BvcnQueSA9IHBvaW50ZXJNb2RlLm9yaWdpblkgKyAoZXZlbnQuY2xpZW50WSAtIHBvaW50ZXJNb2RlLnN0YXJ0WSk7XG4gICAgICBhcHBseVZpZXdwb3J0KCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKHBvaW50ZXJNb2RlLnR5cGUgPT09IFwiZHJhd1wiICYmIGRyYWZ0U3Ryb2tlKSB7XG4gICAgICBkcmFmdFN0cm9rZS5wb2ludHMucHVzaCh7XG4gICAgICAgIHg6IHBvaW50LngsXG4gICAgICAgIHk6IHBvaW50LnksXG4gICAgICAgIHByZXNzdXJlOiBub3JtYWxpemVQcmVzc3VyZShldmVudC5wcmVzc3VyZSlcbiAgICAgIH0pO1xuICAgICAgcmVuZGVyRHJhZnRTdHJva2UoKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAocG9pbnRlck1vZGUudHlwZSA9PT0gXCJtb3ZlXCIpIHtcbiAgICAgIHRyYW5zbGF0ZUl0ZW0ocG9pbnRlck1vZGUsIHBvaW50KTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAocG9pbnRlck1vZGUudHlwZSA9PT0gXCJlcmFzZVwiKSB7XG4gICAgICBjb25zdCByZW1vdmVkID0gZXJhc2VBdChwb2ludCkgfHwgcG9pbnRlck1vZGUucmVtb3ZlZDtcbiAgICAgIHBvaW50ZXJNb2RlID0geyAuLi5wb2ludGVyTW9kZSwgcmVtb3ZlZCB9O1xuICAgIH1cbiAgfSk7XG5cbiAgY29uc3Qgc3RvcFBvaW50ZXIgPSAoKTogdm9pZCA9PiB7XG4gICAgaWYgKHBvaW50ZXJNb2RlLnR5cGUgPT09IFwiZHJhd1wiKSB7XG4gICAgICBjb21taXRTdHJva2UoKTtcbiAgICB9IGVsc2UgaWYgKHBvaW50ZXJNb2RlLnR5cGUgPT09IFwibW92ZVwiKSB7XG4gICAgICBwdXNoSGlzdG9yeSgpO1xuICAgICAgcXVldWVTYXZlKCk7XG4gICAgfSBlbHNlIGlmIChwb2ludGVyTW9kZS50eXBlID09PSBcImVyYXNlXCIgJiYgcG9pbnRlck1vZGUucmVtb3ZlZCkge1xuICAgICAgcHVzaEhpc3RvcnkoKTtcbiAgICAgIHF1ZXVlU2F2ZSgpO1xuICAgIH0gZWxzZSBpZiAocG9pbnRlck1vZGUudHlwZSA9PT0gXCJwYW5cIikge1xuICAgICAgcXVldWVTYXZlKCk7XG4gICAgfVxuXG4gICAgcG9pbnRlck1vZGUgPSB7IHR5cGU6IFwiaWRsZVwiIH07XG4gIH07XG5cbiAgdmlld3BvcnQuYWRkRXZlbnRMaXN0ZW5lcihcInBvaW50ZXJ1cFwiLCBzdG9wUG9pbnRlcik7XG4gIHZpZXdwb3J0LmFkZEV2ZW50TGlzdGVuZXIoXCJwb2ludGVybGVhdmVcIiwgc3RvcFBvaW50ZXIpO1xuXG4gIHZpZXdwb3J0LmFkZEV2ZW50TGlzdGVuZXIoXG4gICAgXCJ3aGVlbFwiLFxuICAgIChldmVudCkgPT4ge1xuICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcblxuICAgICAgY29uc3QgYm91bmRzID0gdmlld3BvcnQuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG4gICAgICBjb25zdCBjdXJzb3JYID0gZXZlbnQuY2xpZW50WCAtIGJvdW5kcy5sZWZ0O1xuICAgICAgY29uc3QgY3Vyc29yWSA9IGV2ZW50LmNsaWVudFkgLSBib3VuZHMudG9wO1xuICAgICAgY29uc3Qgd29ybGRYID0gKGN1cnNvclggLSBib2FyZC52aWV3cG9ydC54KSAvIGJvYXJkLnZpZXdwb3J0Lnpvb207XG4gICAgICBjb25zdCB3b3JsZFkgPSAoY3Vyc29yWSAtIGJvYXJkLnZpZXdwb3J0LnkpIC8gYm9hcmQudmlld3BvcnQuem9vbTtcbiAgICAgIGNvbnN0IG5leHRab29tID0gY2xhbXAoYm9hcmQudmlld3BvcnQuem9vbSAqIChldmVudC5kZWx0YVkgPCAwID8gMS4wOCA6IDAuOTIpLCAwLjIsIDQpO1xuXG4gICAgICBib2FyZC52aWV3cG9ydC56b29tID0gbmV4dFpvb207XG4gICAgICBib2FyZC52aWV3cG9ydC54ID0gY3Vyc29yWCAtIHdvcmxkWCAqIG5leHRab29tO1xuICAgICAgYm9hcmQudmlld3BvcnQueSA9IGN1cnNvclkgLSB3b3JsZFkgKiBuZXh0Wm9vbTtcbiAgICAgIGFwcGx5Vmlld3BvcnQoKTtcbiAgICAgIHF1ZXVlU2F2ZSgpO1xuICAgIH0sXG4gICAgeyBwYXNzaXZlOiBmYWxzZSB9XG4gICk7XG5cbiAgc2V0QWN0aXZlVG9vbChcInBlblwiKTtcbiAgcmVuZGVyQm9hcmQoKTtcblxuICByZXR1cm4ge1xuICAgIGRlc3Ryb3koKSB7XG4gICAgICBkZXN0cm95ZWQgPSB0cnVlO1xuICAgICAgaWYgKHNhdmVUaW1lciAhPT0gbnVsbCkge1xuICAgICAgICB3aW5kb3cuY2xlYXJUaW1lb3V0KHNhdmVUaW1lcik7XG4gICAgICB9XG4gICAgICBjbGVhbnVwVGV4dEVkaXRvcigpO1xuICAgICAgY29udGFpbmVyLmVtcHR5KCk7XG4gICAgfVxuICB9O1xufVxuXG5mdW5jdGlvbiBub3JtYWxpemVQcmVzc3VyZShwcmVzc3VyZTogbnVtYmVyKTogbnVtYmVyIHtcbiAgaWYgKHByZXNzdXJlID4gMCAmJiBOdW1iZXIuaXNGaW5pdGUocHJlc3N1cmUpKSB7XG4gICAgcmV0dXJuIHByZXNzdXJlO1xuICB9XG4gIHJldHVybiAwLjU7XG59XG5cbmZ1bmN0aW9uIHBvaW50c1RvUGF0aChwb2ludHM6IFN0cm9rZVBvaW50W10pOiBzdHJpbmcge1xuICBpZiAocG9pbnRzLmxlbmd0aCA9PT0gMCkge1xuICAgIHJldHVybiBcIlwiO1xuICB9XG5cbiAgaWYgKHBvaW50cy5sZW5ndGggPT09IDEpIHtcbiAgICBjb25zdCBwb2ludCA9IHBvaW50c1swXTtcbiAgICByZXR1cm4gYE0gJHtwb2ludC54fSAke3BvaW50Lnl9IEwgJHtwb2ludC54ICsgMC4wMX0gJHtwb2ludC55ICsgMC4wMX1gO1xuICB9XG5cbiAgbGV0IHBhdGggPSBgTSAke3BvaW50c1swXS54fSAke3BvaW50c1swXS55fWA7XG4gIGZvciAobGV0IGluZGV4ID0gMTsgaW5kZXggPCBwb2ludHMubGVuZ3RoIC0gMTsgaW5kZXggKz0gMSkge1xuICAgIGNvbnN0IGN1cnJlbnQgPSBwb2ludHNbaW5kZXhdO1xuICAgIGNvbnN0IG5leHQgPSBwb2ludHNbaW5kZXggKyAxXTtcbiAgICBjb25zdCBtaWRYID0gKGN1cnJlbnQueCArIG5leHQueCkgLyAyO1xuICAgIGNvbnN0IG1pZFkgPSAoY3VycmVudC55ICsgbmV4dC55KSAvIDI7XG4gICAgcGF0aCArPSBgIFEgJHtjdXJyZW50Lnh9ICR7Y3VycmVudC55fSAke21pZFh9ICR7bWlkWX1gO1xuICB9XG5cbiAgY29uc3QgbGFzdCA9IHBvaW50c1twb2ludHMubGVuZ3RoIC0gMV07XG4gIHBhdGggKz0gYCBMICR7bGFzdC54fSAke2xhc3QueX1gO1xuICByZXR1cm4gcGF0aDtcbn1cblxuZnVuY3Rpb24gaXNQb2ludE5lYXJTdHJva2UocG9pbnQ6IHsgeDogbnVtYmVyOyB5OiBudW1iZXIgfSwgc3Ryb2tlOiBTdHJva2VJdGVtKTogYm9vbGVhbiB7XG4gIGNvbnN0IHRocmVzaG9sZCA9IE1hdGgubWF4KHN0cm9rZS53aWR0aCAqIDEuNSwgMTApO1xuXG4gIGZvciAobGV0IGluZGV4ID0gMTsgaW5kZXggPCBzdHJva2UucG9pbnRzLmxlbmd0aDsgaW5kZXggKz0gMSkge1xuICAgIGNvbnN0IHByZXZpb3VzID0gc3Ryb2tlLnBvaW50c1tpbmRleCAtIDFdO1xuICAgIGNvbnN0IGN1cnJlbnQgPSBzdHJva2UucG9pbnRzW2luZGV4XTtcbiAgICBpZiAoZGlzdGFuY2VUb1NlZ21lbnQocG9pbnQsIHByZXZpb3VzLCBjdXJyZW50KSA8PSB0aHJlc2hvbGQpIHtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBmYWxzZTtcbn1cblxuZnVuY3Rpb24gZGlzdGFuY2VUb1NlZ21lbnQoXG4gIHBvaW50OiB7IHg6IG51bWJlcjsgeTogbnVtYmVyIH0sXG4gIHN0YXJ0OiB7IHg6IG51bWJlcjsgeTogbnVtYmVyIH0sXG4gIGVuZDogeyB4OiBudW1iZXI7IHk6IG51bWJlciB9XG4pOiBudW1iZXIge1xuICBjb25zdCBkeCA9IGVuZC54IC0gc3RhcnQueDtcbiAgY29uc3QgZHkgPSBlbmQueSAtIHN0YXJ0Lnk7XG5cbiAgaWYgKGR4ID09PSAwICYmIGR5ID09PSAwKSB7XG4gICAgcmV0dXJuIE1hdGguaHlwb3QocG9pbnQueCAtIHN0YXJ0LngsIHBvaW50LnkgLSBzdGFydC55KTtcbiAgfVxuXG4gIGNvbnN0IHQgPSBjbGFtcCgoKHBvaW50LnggLSBzdGFydC54KSAqIGR4ICsgKHBvaW50LnkgLSBzdGFydC55KSAqIGR5KSAvIChkeCAqIGR4ICsgZHkgKiBkeSksIDAsIDEpO1xuICBjb25zdCBwcm9qZWN0aW9uWCA9IHN0YXJ0LnggKyB0ICogZHg7XG4gIGNvbnN0IHByb2plY3Rpb25ZID0gc3RhcnQueSArIHQgKiBkeTtcbiAgcmV0dXJuIE1hdGguaHlwb3QocG9pbnQueCAtIHByb2plY3Rpb25YLCBwb2ludC55IC0gcHJvamVjdGlvblkpO1xufVxuXG5mdW5jdGlvbiBjbGFtcCh2YWx1ZTogbnVtYmVyLCBtaW46IG51bWJlciwgbWF4OiBudW1iZXIpOiBudW1iZXIge1xuICByZXR1cm4gTWF0aC5taW4obWF4LCBNYXRoLm1heChtaW4sIHZhbHVlKSk7XG59XHJcblxyXG5cclxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsSUFBQUEsbUJBTU87OztBQ0dBLElBQU0sbUJBQW1CO0FBQ3pCLElBQU0sdUJBQXVCO0FBQzdCLElBQU0saUJBQWlCO0FBQUEsRUFDNUI7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQ0Y7QUFFTyxJQUFNLGVBQXdFO0FBQUEsRUFDbkYsS0FBSyxFQUFFLE9BQU8sR0FBRyxTQUFTLEVBQUU7QUFBQSxFQUM1QixRQUFRLEVBQUUsT0FBTyxHQUFHLFNBQVMsS0FBSztBQUFBLEVBQ2xDLFFBQVEsRUFBRSxPQUFPLElBQUksU0FBUyxLQUFLO0FB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NUQsUUFBSSxFQUFFLGdCQUFnQix5QkFBUTtBQUM1QixZQUFNLElBQUksTUFBTSwrQkFBK0IsVUFBVSxFQUFFO0FBQUEsSUFDN0Q7QUFFQSxVQUFNLFVBQVUsTUFBTSxLQUFLLElBQUksTUFBTSxLQUFLLElBQUk7QUFDOUMsVUFBTSxRQUFRLEtBQUssbUJBQW1CLFNBQVMsTUFBTSxFQUFFLEtBQUssS0FBSywwQkFBMEIsT0FBTztBQUNsRyxRQUFJLENBQUMsT0FBTztBQUNWLFlBQU0sSUFBSSxNQUFNLGlFQUFpRTtBQUFBLElBQ25GO0FBRUEsVUFBTSxZQUFZLFVBQVUsS0FBSztBQUNqQyxVQUFNLFVBQVUsR0FBRyxRQUFRLE1BQU0sR0FBRyxNQUFNLElBQUksQ0FBQyxHQUFHLFNBQVMsR0FBRyxRQUFRLE1BQU0sTUFBTSxFQUFFLENBQUM7QUFDckYsVUFBTSxLQUFLLElBQUksTUFBTSxPQUFPLE1BQU0sT0FBTztBQUFBLEVBQzNDO0FBQUEsRUFFUSxtQkFBbUIsU0FBaUIsU0FBc0M7QUFDaEYsZUFBVyxTQUFTLEtBQUssd0JBQXdCLE9BQU8sR0FBRztBQUN6RCxVQUFJO0FBQ0YsY0FBTSxTQUFTLFdBQVcsTUFBTSxPQUFPO0FBQ3ZDLFlBQUksT0FBTyxPQUFPLFNBQVM7QUFDekIsaUJBQU87QUFBQSxRQUNUO0FBQUEsTUFDRixRQUFRO0FBQ047QUFBQSxNQUNGO0FBQUEsSUFDRjtBQUVBLFdBQU87QUFBQSxFQUNUO0FBQUEsRUFFUSwwQkFBMEIsU0FBc0M7QUFDdEUsVUFBTSxTQUFTLENBQUMsR0FBRyxLQUFLLHdCQUF3QixPQUFPLENBQUM7QUFDeEQsV0FBTyxPQUFPLFdBQVcsSUFBSSxPQUFPLENBQUMsSUFBSTtBQUFBLEVBQzNDO0FBQUEsRUFFQSxDQUFTLHdCQUF3QixTQUEwQztBQUN6RSxVQUFNLFVBQVUsU0FBUyxnQkFBZ0I7QUFDekMsUUFBSSxhQUFhO0FBRWpCLFdBQU8sYUFBYSxRQUFRLFFBQVE7QUFDbEMsWUFBTSxRQUFRLFFBQVEsUUFBUSxTQUFTLFVBQVU7QUFDakQsVUFBSSxVQUFVLElBQUk7QUFDaEI7QUFBQSxNQUNGO0FBRUEsWUFBTSxlQUFlLFFBQVEsUUFBUSxNQUFNLEtBQUs7QUFDaEQsVUFBSSxpQkFBaUIsSUFBSTtBQUN2QjtBQUFBLE1BQ0Y7QUFFQSxZQUFNLFFBQVEsUUFBUSxRQUFRLFNBQVMsWUFBWTtBQUNuRCxVQUFJLFVBQVUsSUFBSTtBQUNoQjtBQUFBLE1BQ0Y7QUFFQSxZQUFNLE1BQU0sUUFBUTtBQUNwQixZQUFNO0FBQUEsUUFDSixNQUFNO0FBQUEsUUFDTixJQUFJO0FBQUEsUUFDSixTQUFTLFFBQVEsTUFBTSxlQUFlLEdBQUcsS0FBSztBQUFBLE1BQ2hEO0FBRUEsbUJBQWE7QUFBQSxJQUNmO0FBQUEsRUFDRjtBQUNGOyIsCiAgIm5hbWVzIjogWyJpbXBvcnRfb2JzaWRpYW4iXQp9Cg==
