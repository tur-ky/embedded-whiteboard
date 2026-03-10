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
var DEFAULT_BOARD_HEIGHT = 520;
var DEFAULT_NODE_WIDTH = 260;
var DEFAULT_NODE_HEIGHT = 180;
function createId(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}
function createDefaultNode(overrides = {}) {
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
function createDefaultBoard() {
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
function parseBoard(raw) {
  const parsed = JSON.parse(raw);
  const nodes = Array.isArray(parsed.nodes) ? parsed.nodes : [];
  const edges = Array.isArray(parsed.edges) ? parsed.edges : [];
  return {
    nodes: nodes.filter((node) => Boolean(node && typeof node.id === "string")).map((node) => ({
      id: node.id,
      type: "text",
      text: typeof node.text === "string" ? node.text : "",
      color: typeof node.color === "string" ? node.color : "default",
      x: typeof node.x === "number" ? node.x : 0,
      y: typeof node.y === "number" ? node.y : 0,
      width: typeof node.width === "number" ? node.width : DEFAULT_NODE_WIDTH,
      height: typeof node.height === "number" ? node.height : DEFAULT_NODE_HEIGHT
    })),
    edges: edges.filter((edge) => Boolean(edge && typeof edge.id === "string")).map((edge) => ({
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
function serializeBoard(board) {
  return JSON.stringify(board, null, 2);
}
function wrapBoard(board) {
  return `\`\`\`${WHITEBOARD_FENCE}
${serializeBoard(board)}
\`\`\``;
}

// src/whiteboard.ts
var import_obsidian = require("obsidian");
var COLOR_CLASS_MAP = {
  default: "embedded-whiteboard__node--default",
  yellow: "embedded-whiteboard__node--yellow",
  red: "embedded-whiteboard__node--red",
  green: "embedded-whiteboard__node--green",
  blue: "embedded-whiteboard__node--blue",
  purple: "embedded-whiteboard__node--purple"
};
function mountWhiteboard(container, initialBoard, host) {
  container.empty();
  container.addClass("embedded-whiteboard");
  const root = container.createDiv({ cls: "embedded-whiteboard__shell" });
  const toolbar = root.createDiv({ cls: "embedded-whiteboard__toolbar" });
  const viewport = root.createDiv({ cls: "embedded-whiteboard__viewport" });
  const grid = viewport.createDiv({ cls: "embedded-whiteboard__grid" });
  const svg = viewport.createEl("svg", { cls: "embedded-whiteboard__edges" });
  const edgeLayer = svg.createEl("g");
  const world = viewport.createDiv({ cls: "embedded-whiteboard__world" });
  const status = toolbar.createDiv({ cls: "embedded-whiteboard__status", text: "Ready" });
  let board = structuredClone(initialBoard);
  let selectedNodeId = board.nodes[0]?.id ?? null;
  let connectSourceId = null;
  let pointerMode = { type: "idle" };
  let saveTimer = null;
  let destroyed = false;
  let markdownChildren = [];
  const nodeElements = /* @__PURE__ */ new Map();
  const toolbarButtons = [
    { label: "Add note", onClick: () => addNode() },
    { label: "Duplicate", onClick: () => duplicateSelectedNode() },
    { label: "Link", onClick: () => toggleConnectMode() },
    { label: "Delete", onClick: () => deleteSelectedNode() },
    { label: "Fit", onClick: () => fitToNodes() },
    { label: "Reset", onClick: () => resetViewport() }
  ];
  for (const item of toolbarButtons) {
    const button = toolbar.createEl("button", {
      cls: "embedded-whiteboard__button",
      text: item.label
    });
    button.type = "button";
    button.addEventListener("click", item.onClick);
  }
  toolbar.appendChild(status);
  viewport.style.minHeight = `${DEFAULT_BOARD_HEIGHT}px`;
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
        status.setText(connectSourceId ? "Select a second card to link" : "Saved");
      } catch (error) {
        console.error(error);
        new import_obsidian.Notice("Unable to save embedded whiteboard");
        status.setText("Save failed");
      }
    }, 120);
  }
  function updateStatus(message = "Ready") {
    status.setText(connectSourceId ? "Select a second card to link" : message);
  }
  function updateGrid() {
    const size = 40 * board.viewport.zoom;
    grid.style.backgroundSize = `${size}px ${size}px`;
    grid.style.backgroundPosition = `${board.viewport.x}px ${board.viewport.y}px`;
  }
  function applyViewport() {
    world.style.transform = `translate(${board.viewport.x}px, ${board.viewport.y}px) scale(${board.viewport.zoom})`;
    svg.style.transform = `translate(${board.viewport.x}px, ${board.viewport.y}px) scale(${board.viewport.zoom})`;
    updateGrid();
  }
  function getNode(nodeId) {
    return board.nodes.find((node) => node.id === nodeId);
  }
  function chooseSides(fromNode, toNode) {
    const dx = toNode.x + toNode.width / 2 - (fromNode.x + fromNode.width / 2);
    const dy = toNode.y + toNode.height / 2 - (fromNode.y + fromNode.height / 2);
    if (Math.abs(dx) >= Math.abs(dy)) {
      return dx >= 0 ? { fromSide: "right", toSide: "left" } : { fromSide: "left", toSide: "right" };
    }
    return dy >= 0 ? { fromSide: "bottom", toSide: "top" } : { fromSide: "top", toSide: "bottom" };
  }
  function getNodeAnchor(node, side) {
    if (side === "top") {
      return { x: node.x + node.width / 2, y: node.y };
    }
    if (side === "right") {
      return { x: node.x + node.width, y: node.y + node.height / 2 };
    }
    if (side === "bottom") {
      return { x: node.x + node.width / 2, y: node.y + node.height };
    }
    return { x: node.x, y: node.y + node.height / 2 };
  }
  function applyNodeFrame(nodeId) {
    const node = getNode(nodeId);
    const nodeEl = nodeElements.get(nodeId);
    if (!node || !nodeEl) {
      return;
    }
    nodeEl.style.left = `${node.x}px`;
    nodeEl.style.top = `${node.y}px`;
    nodeEl.style.width = `${node.width}px`;
    nodeEl.style.height = `${node.height}px`;
    nodeEl.toggleClass("is-selected", node.id === selectedNodeId);
  }
  function renderEdges() {
    edgeLayer.empty();
    for (const edge of board.edges) {
      const fromNode = getNode(edge.fromNode);
      const toNode = getNode(edge.toNode);
      if (!fromNode || !toNode) {
        continue;
      }
      const from = getNodeAnchor(fromNode, edge.fromSide);
      const to = getNodeAnchor(toNode, edge.toSide);
      const midX = (from.x + to.x) / 2;
      const path = `M ${from.x} ${from.y} C ${midX} ${from.y}, ${midX} ${to.y}, ${to.x} ${to.y}`;
      const edgePath = edgeLayer.createEl("path", { cls: "embedded-whiteboard__edge" });
      edgePath.setAttribute("d", path);
    }
  }
  function cleanupRenderedMarkdown() {
    for (const child of markdownChildren) {
      child.unload();
    }
    markdownChildren = [];
  }
  function openEditor(node, body, titleEl) {
    body.empty();
    const textarea = body.createEl("textarea", { cls: "embedded-whiteboard__editor" });
    textarea.value = node.text;
    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    const commit = () => {
      node.text = textarea.value;
      titleEl.setText(previewTitle(node.text));
      renderBoard();
      queueSave();
    };
    textarea.addEventListener("blur", commit, { once: true });
    textarea.addEventListener("keydown", (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        textarea.blur();
      }
    });
  }
  function renderNode(node) {
    const nodeEl = world.createDiv({ cls: "embedded-whiteboard__node" });
    nodeEl.dataset.nodeId = node.id;
    nodeElements.set(node.id, nodeEl);
    applyNodeFrame(node.id);
    nodeEl.addClass(COLOR_CLASS_MAP[node.color] ?? COLOR_CLASS_MAP.default);
    const chrome = nodeEl.createDiv({ cls: "embedded-whiteboard__node-chrome" });
    const title = chrome.createDiv({
      cls: "embedded-whiteboard__node-title",
      text: previewTitle(node.text)
    });
    const colorSelect = chrome.createEl("select", { cls: "embedded-whiteboard__node-color" });
    const colors = ["default", "yellow", "red", "green", "blue", "purple"];
    for (const color of colors) {
      const option = colorSelect.createEl("option", { text: color });
      option.value = color;
      option.selected = node.color === color;
    }
    const body = nodeEl.createDiv({ cls: "embedded-whiteboard__node-body" });
    const bodyComponent = new import_obsidian.Component();
    markdownChildren.push(bodyComponent);
    void import_obsidian.MarkdownRenderer.renderMarkdown(node.text, body, host.sourcePath, bodyComponent);
    const resizeHandle = nodeEl.createDiv({ cls: "embedded-whiteboard__resize-handle" });
    nodeEl.addEventListener("pointerdown", (event) => {
      const target = event.target;
      if (target.closest(".embedded-whiteboard__node-color")) {
        return;
      }
      if (connectSourceId && connectSourceId !== node.id) {
        const source = getNode(connectSourceId);
        const destination = getNode(node.id);
        if (source && destination) {
          const sides = chooseSides(source, destination);
          board.edges.push({
            id: createId("edge"),
            fromNode: source.id,
            toNode: destination.id,
            fromSide: sides.fromSide,
            toSide: sides.toSide
          });
          connectSourceId = null;
          renderBoard();
          queueSave();
        }
        return;
      }
      selectedNodeId = node.id;
      refreshSelection();
      if (target === resizeHandle) {
        pointerMode = {
          type: "resize",
          nodeId: node.id,
          startX: event.clientX,
          startY: event.clientY,
          originWidth: node.width,
          originHeight: node.height
        };
      } else {
        pointerMode = {
          type: "drag",
          nodeId: node.id,
          startX: event.clientX,
          startY: event.clientY,
          originX: node.x,
          originY: node.y
        };
      }
      nodeEl.setPointerCapture(event.pointerId);
      event.preventDefault();
    });
    colorSelect.addEventListener("change", () => {
      node.color = colorSelect.value;
      renderBoard();
      queueSave();
    });
    nodeEl.addEventListener("dblclick", () => {
      openEditor(node, body, title);
    });
  }
  function refreshSelection() {
    for (const node of board.nodes) {
      applyNodeFrame(node.id);
    }
    updateStatus();
  }
  function renderBoard() {
    cleanupRenderedMarkdown();
    world.empty();
    nodeElements.clear();
    for (const node of board.nodes) {
      renderNode(node);
    }
    applyViewport();
    renderEdges();
    refreshSelection();
  }
  function addNode() {
    const centerX = (-board.viewport.x + viewport.clientWidth / 2) / board.viewport.zoom;
    const centerY = (-board.viewport.y + viewport.clientHeight / 2) / board.viewport.zoom;
    const node = createDefaultNode({
      x: centerX - 130,
      y: centerY - 90
    });
    board.nodes.push(node);
    selectedNodeId = node.id;
    renderBoard();
    queueSave();
  }
  function duplicateSelectedNode() {
    if (!selectedNodeId) {
      return;
    }
    const node = getNode(selectedNodeId);
    if (!node) {
      return;
    }
    const copy = {
      ...node,
      id: createId("node"),
      x: node.x + 32,
      y: node.y + 32
    };
    board.nodes.push(copy);
    selectedNodeId = copy.id;
    renderBoard();
    queueSave();
  }
  function deleteSelectedNode() {
    if (!selectedNodeId) {
      return;
    }
    board.nodes = board.nodes.filter((node) => node.id !== selectedNodeId);
    board.edges = board.edges.filter(
      (edge) => edge.fromNode !== selectedNodeId && edge.toNode !== selectedNodeId
    );
    connectSourceId = connectSourceId === selectedNodeId ? null : connectSourceId;
    selectedNodeId = board.nodes[0]?.id ?? null;
    renderBoard();
    queueSave();
  }
  function toggleConnectMode() {
    if (!selectedNodeId) {
      status.setText("Pick a card first");
      return;
    }
    connectSourceId = connectSourceId ? null : selectedNodeId;
    updateStatus();
  }
  function fitToNodes() {
    if (board.nodes.length === 0) {
      resetViewport();
      return;
    }
    const left = Math.min(...board.nodes.map((node) => node.x));
    const top = Math.min(...board.nodes.map((node) => node.y));
    const right = Math.max(...board.nodes.map((node) => node.x + node.width));
    const bottom = Math.max(...board.nodes.map((node) => node.y + node.height));
    const width = right - left;
    const height = bottom - top;
    const margin = 96;
    const zoomX = (viewport.clientWidth - margin) / Math.max(width, 1);
    const zoomY = (viewport.clientHeight - margin) / Math.max(height, 1);
    board.viewport.zoom = Math.min(1.2, Math.max(0.35, Math.min(zoomX, zoomY)));
    board.viewport.x = viewport.clientWidth / 2 - (left + width / 2) * board.viewport.zoom;
    board.viewport.y = viewport.clientHeight / 2 - (top + height / 2) * board.viewport.zoom;
    applyViewport();
    renderEdges();
    queueSave();
  }
  function resetViewport() {
    board.viewport.x = 0;
    board.viewport.y = 0;
    board.viewport.zoom = 1;
    applyViewport();
    renderEdges();
    queueSave();
  }
  viewport.addEventListener("pointerdown", (event) => {
    if (event.target.closest(".embedded-whiteboard__node")) {
      return;
    }
    pointerMode = {
      type: "pan",
      startX: event.clientX,
      startY: event.clientY,
      originX: board.viewport.x,
      originY: board.viewport.y
    };
    selectedNodeId = null;
    refreshSelection();
  });
  viewport.addEventListener("pointermove", (event) => {
    if (pointerMode.type === "pan") {
      board.viewport.x = pointerMode.originX + (event.clientX - pointerMode.startX);
      board.viewport.y = pointerMode.originY + (event.clientY - pointerMode.startY);
      applyViewport();
      return;
    }
    if (pointerMode.type === "drag") {
      const node = getNode(pointerMode.nodeId);
      if (!node) {
        return;
      }
      node.x = pointerMode.originX + (event.clientX - pointerMode.startX) / board.viewport.zoom;
      node.y = pointerMode.originY + (event.clientY - pointerMode.startY) / board.viewport.zoom;
      applyNodeFrame(node.id);
      renderEdges();
      return;
    }
    if (pointerMode.type === "resize") {
      const node = getNode(pointerMode.nodeId);
      if (!node) {
        return;
      }
      node.width = Math.max(180, pointerMode.originWidth + (event.clientX - pointerMode.startX) / board.viewport.zoom);
      node.height = Math.max(120, pointerMode.originHeight + (event.clientY - pointerMode.startY) / board.viewport.zoom);
      applyNodeFrame(node.id);
      renderEdges();
    }
  });
  const stopPointer = () => {
    if (pointerMode.type === "drag" || pointerMode.type === "resize" || pointerMode.type === "pan") {
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
      const nextZoom = clamp(board.viewport.zoom * (event.deltaY < 0 ? 1.08 : 0.92), 0.3, 2);
      board.viewport.zoom = nextZoom;
      board.viewport.x = cursorX - worldX * nextZoom;
      board.viewport.y = cursorY - worldY * nextZoom;
      applyViewport();
      queueSave();
    },
    { passive: false }
  );
  renderBoard();
  return {
    destroy() {
      destroyed = true;
      if (saveTimer !== null) {
        window.clearTimeout(saveTimer);
      }
      cleanupRenderedMarkdown();
      container.empty();
    }
  };
}
function previewTitle(text) {
  const compact = text.replace(/^#+\s*/gm, "").replace(/\s+/g, " ").trim();
  return compact.slice(0, 32) || "Untitled";
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsibWFpbi50cyIsICJzcmMvZWRpdG9yLWV4dGVuc2lvbi50cyIsICJzcmMvc3RhdGUudHMiLCAic3JjL3doaXRlYm9hcmQudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImltcG9ydCB7XG4gIEVkaXRvcixcbiAgTWFya2Rvd25WaWV3LFxuICBOb3RpY2UsXG4gIFBsdWdpbixcbiAgVEZpbGVcbn0gZnJvbSBcIm9ic2lkaWFuXCI7XG5pbXBvcnQgeyBidWlsZEVkaXRvckV4dGVuc2lvbiB9IGZyb20gXCIuL3NyYy9lZGl0b3ItZXh0ZW5zaW9uXCI7XG5pbXBvcnQge1xuICBjcmVhdGVEZWZhdWx0Qm9hcmQsXG4gIHBhcnNlQm9hcmQsXG4gIFdISVRFQk9BUkRfRkVOQ0UsXG4gIHdyYXBCb2FyZFxufSBmcm9tIFwiLi9zcmMvc3RhdGVcIjtcbmltcG9ydCB7IEVtYmVkZGVkV2hpdGVib2FyZERhdGEgfSBmcm9tIFwiLi9zcmMvdHlwZXNcIjtcbmltcG9ydCB7IG1vdW50V2hpdGVib2FyZCB9IGZyb20gXCIuL3NyYy93aGl0ZWJvYXJkXCI7XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIEVtYmVkZGVkV2hpdGVib2FyZFBsdWdpbiBleHRlbmRzIFBsdWdpbiB7XG4gIGFzeW5jIG9ubG9hZCgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICB0aGlzLnJlZ2lzdGVyTWFya2Rvd25Db2RlQmxvY2tQcm9jZXNzb3IoXG4gICAgICBXSElURUJPQVJEX0ZFTkNFLFxuICAgICAgYXN5bmMgKHNvdXJjZSwgZWwsIGN0eCkgPT4ge1xuICAgICAgICBjb25zdCBib2FyZCA9IHRoaXMucGFyc2VPckNyZWF0ZUJvYXJkKHNvdXJjZSk7XG4gICAgICAgIGxldCBjdXJyZW50QmxvY2sgPSBgXFxgXFxgXFxgJHtXSElURUJPQVJEX0ZFTkNFfVxcbiR7c291cmNlfVxcblxcYFxcYFxcYGA7XG5cbiAgICAgICAgY29uc3QgaGFuZGxlID0gbW91bnRXaGl0ZWJvYXJkKGVsLCBib2FyZCwge1xuICAgICAgICAgIHNvdXJjZVBhdGg6IGN0eC5zb3VyY2VQYXRoLFxuICAgICAgICAgIHNhdmU6IGFzeW5jIChuZXh0Qm9hcmQpID0+IHtcbiAgICAgICAgICAgIGN1cnJlbnRCbG9jayA9IGF3YWl0IHRoaXMucGVyc2lzdEJsb2NrKGN0eC5zb3VyY2VQYXRoLCBjdXJyZW50QmxvY2ssIG5leHRCb2FyZCk7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgICAgICB0aGlzLnJlZ2lzdGVyKCgpID0+IGhhbmRsZS5kZXN0cm95KCkpO1xuICAgICAgfVxuICAgICk7XG5cbiAgICB0aGlzLnJlZ2lzdGVyRWRpdG9yRXh0ZW5zaW9uKGJ1aWxkRWRpdG9yRXh0ZW5zaW9uKHRoaXMpKTtcblxuICAgIHRoaXMuYWRkQ29tbWFuZCh7XG4gICAgICBpZDogXCJpbnNlcnQtZW1iZWRkZWQtd2hpdGVib2FyZFwiLFxuICAgICAgbmFtZTogXCJJbnNlcnQgZW1iZWRkZWQgd2hpdGVib2FyZFwiLFxuICAgICAgZWRpdG9yQ2FsbGJhY2s6IChlZGl0b3IpID0+IHtcbiAgICAgICAgdGhpcy5pbnNlcnRFbWJlZGRlZFdoaXRlYm9hcmQoZWRpdG9yKTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIHRoaXMuYWRkQ29tbWFuZCh7XG4gICAgICBpZDogXCJhcHBlbmQtZW1iZWRkZWQtd2hpdGVib2FyZFwiLFxuICAgICAgbmFtZTogXCJBcHBlbmQgZW1iZWRkZWQgd2hpdGVib2FyZCB0byBjdXJyZW50IG5vdGVcIixcbiAgICAgIGNoZWNrQ2FsbGJhY2s6IChjaGVja2luZykgPT4ge1xuICAgICAgICBjb25zdCB2aWV3ID0gdGhpcy5hcHAud29ya3NwYWNlLmdldEFjdGl2ZVZpZXdPZlR5cGUoTWFya2Rvd25WaWV3KTtcbiAgICAgICAgaWYgKCF2aWV3Py5maWxlKSB7XG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFjaGVja2luZykge1xuICAgICAgICAgIHZvaWQgdGhpcy5hcHBlbmRCb2FyZFRvRmlsZSh2aWV3LmZpbGUpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICB0aGlzLnJlZ2lzdGVyRXZlbnQoXG4gICAgICB0aGlzLmFwcC53b3Jrc3BhY2Uub24oXCJlZGl0b3ItbWVudVwiLCAobWVudSwgZWRpdG9yKSA9PiB7XG4gICAgICAgIG1lbnUuYWRkSXRlbSgoaXRlbSkgPT4ge1xuICAgICAgICAgIGl0ZW1cbiAgICAgICAgICAgIC5zZXRUaXRsZShcIkluc2VydCBlbWJlZGRlZCB3aGl0ZWJvYXJkXCIpXG4gICAgICAgICAgICAuc2V0SWNvbihcImxheW91dC1kYXNoYm9hcmRcIilcbiAgICAgICAgICAgIC5vbkNsaWNrKCgpID0+IHtcbiAgICAgICAgICAgICAgdGhpcy5pbnNlcnRFbWJlZGRlZFdoaXRlYm9hcmQoZWRpdG9yKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICAgIH0pXG4gICAgKTtcbiAgfVxuXG4gIHByaXZhdGUgcGFyc2VPckNyZWF0ZUJvYXJkKHNvdXJjZTogc3RyaW5nKTogRW1iZWRkZWRXaGl0ZWJvYXJkRGF0YSB7XG4gICAgdHJ5IHtcbiAgICAgIHJldHVybiBwYXJzZUJvYXJkKHNvdXJjZSk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoZXJyb3IpO1xuICAgICAgcmV0dXJuIGNyZWF0ZURlZmF1bHRCb2FyZCgpO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgYXBwZW5kQm9hcmRUb0ZpbGUoZmlsZTogVEZpbGUpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCBjb250ZW50ID0gYXdhaXQgdGhpcy5hcHAudmF1bHQucmVhZChmaWxlKTtcbiAgICBjb25zdCBzdWZmaXggPSBjb250ZW50LmVuZHNXaXRoKFwiXFxuXCIpID8gXCJcIiA6IFwiXFxuXCI7XG4gICAgYXdhaXQgdGhpcy5hcHAudmF1bHQubW9kaWZ5KGZpbGUsIGAke2NvbnRlbnR9JHtzdWZmaXh9XFxuJHt3cmFwQm9hcmQoY3JlYXRlRGVmYXVsdEJvYXJkKCkpfVxcbmApO1xuICAgIG5ldyBOb3RpY2UoXCJFbWJlZGRlZCB3aGl0ZWJvYXJkIGFwcGVuZGVkIHRvIHRoZSBub3RlXCIpO1xuICB9XG5cbiAgcHJpdmF0ZSBpbnNlcnRFbWJlZGRlZFdoaXRlYm9hcmQoZWRpdG9yOiBFZGl0b3IpOiB2b2lkIHtcbiAgICBjb25zdCBib2FyZCA9IHdyYXBCb2FyZChjcmVhdGVEZWZhdWx0Qm9hcmQoKSk7XG4gICAgY29uc3QgY3Vyc29yID0gZWRpdG9yLmdldEN1cnNvcigpO1xuICAgIGNvbnN0IG5lZWRzTGVhZGluZ0JyZWFrID0gY3Vyc29yLmxpbmUgPiAwID8gXCJcXG5cIiA6IFwiXCI7XG4gICAgZWRpdG9yLnJlcGxhY2VSYW5nZShgJHtuZWVkc0xlYWRpbmdCcmVha30ke2JvYXJkfVxcbmAsIGN1cnNvcik7XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIHBlcnNpc3RCbG9jayhcbiAgICBzb3VyY2VQYXRoOiBzdHJpbmcsXG4gICAgcHJldmlvdXNCbG9jazogc3RyaW5nLFxuICAgIGJvYXJkOiBFbWJlZGRlZFdoaXRlYm9hcmREYXRhXG4gICk6IFByb21pc2U8c3RyaW5nPiB7XG4gICAgY29uc3QgZmlsZSA9IHRoaXMuYXBwLnZhdWx0LmdldEFic3RyYWN0RmlsZUJ5UGF0aChzb3VyY2VQYXRoKTtcbiAgICBpZiAoIShmaWxlIGluc3RhbmNlb2YgVEZpbGUpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFVuYWJsZSB0byBmaW5kIHNvdXJjZSBub3RlOiAke3NvdXJjZVBhdGh9YCk7XG4gICAgfVxuXG4gICAgY29uc3QgbmV4dEJsb2NrID0gd3JhcEJvYXJkKGJvYXJkKTtcbiAgICBjb25zdCBjdXJyZW50ID0gYXdhaXQgdGhpcy5hcHAudmF1bHQucmVhZChmaWxlKTtcbiAgICBjb25zdCBpbmRleCA9IGN1cnJlbnQuaW5kZXhPZihwcmV2aW91c0Jsb2NrKTtcbiAgICBpZiAoaW5kZXggPT09IC0xKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJVbmFibGUgdG8gZmluZCB0aGUgZW1iZWRkZWQgd2hpdGVib2FyZCBibG9jayBpbiB0aGUgc291cmNlIG5vdGVcIik7XG4gICAgfVxuXG4gICAgY29uc3QgdXBkYXRlZCA9IGAke2N1cnJlbnQuc2xpY2UoMCwgaW5kZXgpfSR7bmV4dEJsb2NrfSR7Y3VycmVudC5zbGljZShpbmRleCArIHByZXZpb3VzQmxvY2subGVuZ3RoKX1gO1xuICAgIGF3YWl0IHRoaXMuYXBwLnZhdWx0Lm1vZGlmeShmaWxlLCB1cGRhdGVkKTtcbiAgICByZXR1cm4gbmV4dEJsb2NrO1xuICB9XG59XHJcbiIsICJpbXBvcnQgeyBSYW5nZVNldEJ1aWxkZXIgfSBmcm9tIFwiQGNvZGVtaXJyb3Ivc3RhdGVcIjtcbmltcG9ydCB7IERlY29yYXRpb24sIEVkaXRvclZpZXcsIFZpZXdQbHVnaW4sIFZpZXdVcGRhdGUsIFdpZGdldFR5cGUgfSBmcm9tIFwiQGNvZGVtaXJyb3Ivdmlld1wiO1xuaW1wb3J0IHsgUGx1Z2luIH0gZnJvbSBcIm9ic2lkaWFuXCI7XG5pbXBvcnQgeyBjcmVhdGVEZWZhdWx0Qm9hcmQsIHBhcnNlQm9hcmQsIFdISVRFQk9BUkRfRkVOQ0UsIHdyYXBCb2FyZCB9IGZyb20gXCIuL3N0YXRlXCI7XG5pbXBvcnQgeyBtb3VudFdoaXRlYm9hcmQgfSBmcm9tIFwiLi93aGl0ZWJvYXJkXCI7XG5cbmludGVyZmFjZSBXaGl0ZWJvYXJkQmxvY2sge1xuICBmcm9tOiBudW1iZXI7XG4gIHRvOiBudW1iZXI7XG4gIHJhdzogc3RyaW5nO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gYnVpbGRFZGl0b3JFeHRlbnNpb24ocGx1Z2luOiBQbHVnaW4pIHtcbiAgY29uc3Qgd2lkZ2V0UGx1Z2luID0gVmlld1BsdWdpbi5mcm9tQ2xhc3MoXG4gICAgY2xhc3Mge1xuICAgICAgZGVjb3JhdGlvbnM7XG5cbiAgICAgIGNvbnN0cnVjdG9yKHByaXZhdGUgcmVhZG9ubHkgdmlldzogRWRpdG9yVmlldykge1xuICAgICAgICB0aGlzLmRlY29yYXRpb25zID0gdGhpcy5idWlsZERlY29yYXRpb25zKCk7XG4gICAgICB9XG5cbiAgICAgIHVwZGF0ZSh1cGRhdGU6IFZpZXdVcGRhdGUpOiB2b2lkIHtcbiAgICAgICAgaWYgKHVwZGF0ZS5kb2NDaGFuZ2VkIHx8IHVwZGF0ZS52aWV3cG9ydENoYW5nZWQgfHwgdXBkYXRlLnNlbGVjdGlvblNldCkge1xuICAgICAgICAgIHRoaXMuZGVjb3JhdGlvbnMgPSB0aGlzLmJ1aWxkRGVjb3JhdGlvbnMoKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBidWlsZERlY29yYXRpb25zKCkge1xuICAgICAgICBjb25zdCBidWlsZGVyID0gbmV3IFJhbmdlU2V0QnVpbGRlcjxEZWNvcmF0aW9uPigpO1xuICAgICAgICBjb25zdCBibG9ja3MgPSBmaW5kV2hpdGVib2FyZEJsb2Nrcyh0aGlzLnZpZXcpO1xuXG4gICAgICAgIGZvciAoY29uc3QgYmxvY2sgb2YgYmxvY2tzKSB7XG4gICAgICAgICAgaWYgKHNlbGVjdGlvblRvdWNoZXModGhpcy52aWV3LCBibG9jay5mcm9tLCBibG9jay50bykpIHtcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGJ1aWxkZXIuYWRkKFxuICAgICAgICAgICAgYmxvY2suZnJvbSxcbiAgICAgICAgICAgIGJsb2NrLnRvLFxuICAgICAgICAgICAgRGVjb3JhdGlvbi5yZXBsYWNlKHtcbiAgICAgICAgICAgICAgYmxvY2s6IHRydWUsXG4gICAgICAgICAgICAgIHdpZGdldDogbmV3IElubGluZVdoaXRlYm9hcmRXaWRnZXQocGx1Z2luLCB0aGlzLnZpZXcsIGJsb2NrKVxuICAgICAgICAgICAgfSlcbiAgICAgICAgICApO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGJ1aWxkZXIuZmluaXNoKCk7XG4gICAgICB9XG4gICAgfSxcbiAgICB7XG4gICAgICBkZWNvcmF0aW9uczogKHZhbHVlKSA9PiB2YWx1ZS5kZWNvcmF0aW9uc1xuICAgIH1cbiAgKTtcblxuICByZXR1cm4gW3dpZGdldFBsdWdpbl07XG59XG5cbmNsYXNzIElubGluZVdoaXRlYm9hcmRXaWRnZXQgZXh0ZW5kcyBXaWRnZXRUeXBlIHtcbiAgcHJpdmF0ZSBoYW5kbGU/OiB7IGRlc3Ryb3koKTogdm9pZCB9O1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgIHByaXZhdGUgcmVhZG9ubHkgcGx1Z2luOiBQbHVnaW4sXG4gICAgcHJpdmF0ZSByZWFkb25seSB2aWV3OiBFZGl0b3JWaWV3LFxuICAgIHByaXZhdGUgcmVhZG9ubHkgYmxvY2s6IFdoaXRlYm9hcmRCbG9ja1xuICApIHtcbiAgICBzdXBlcigpO1xuICB9XG5cbiAgZXEob3RoZXI6IElubGluZVdoaXRlYm9hcmRXaWRnZXQpOiBib29sZWFuIHtcbiAgICByZXR1cm4gb3RoZXIuYmxvY2sucmF3ID09PSB0aGlzLmJsb2NrLnJhdztcbiAgfVxuXG4gIHRvRE9NKCk6IEhUTUxFbGVtZW50IHtcbiAgICBjb25zdCBjb250YWluZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuICAgIGNvbnRhaW5lci5jbGFzc05hbWUgPSBcImVtYmVkZGVkLXdoaXRlYm9hcmRfX2VkaXRvci1ob3N0XCI7XG4gICAgY29uc3QgYm9hcmQgPSBwYXJzZUJvYXJkU2FmZWx5KHRoaXMuYmxvY2sucmF3KTtcblxuICAgIHRoaXMuaGFuZGxlID0gbW91bnRXaGl0ZWJvYXJkKGNvbnRhaW5lciwgYm9hcmQsIHtcbiAgICAgIHNvdXJjZVBhdGg6IHRoaXMucGx1Z2luLmFwcC53b3Jrc3BhY2UuZ2V0QWN0aXZlRmlsZSgpPy5wYXRoID8/IFwiXCIsXG4gICAgICBzYXZlOiBhc3luYyAobmV4dEJvYXJkKSA9PiB7XG4gICAgICAgIHRoaXMudmlldy5kaXNwYXRjaCh7XG4gICAgICAgICAgY2hhbmdlczoge1xuICAgICAgICAgICAgZnJvbTogdGhpcy5ibG9jay5mcm9tLFxuICAgICAgICAgICAgdG86IHRoaXMuYmxvY2sudG8sXG4gICAgICAgICAgICBpbnNlcnQ6IHdyYXBCb2FyZChuZXh0Qm9hcmQpXG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIHJldHVybiBjb250YWluZXI7XG4gIH1cblxuICBkZXN0cm95KCk6IHZvaWQge1xuICAgIHRoaXMuaGFuZGxlPy5kZXN0cm95KCk7XG4gIH1cblxuICBpZ25vcmVFdmVudCgpOiBib29sZWFuIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbn1cblxuZnVuY3Rpb24gZmluZFdoaXRlYm9hcmRCbG9ja3ModmlldzogRWRpdG9yVmlldyk6IFdoaXRlYm9hcmRCbG9ja1tdIHtcbiAgY29uc3QgYmxvY2tzOiBXaGl0ZWJvYXJkQmxvY2tbXSA9IFtdO1xuICBjb25zdCBkb2MgPSB2aWV3LnN0YXRlLmRvYztcbiAgY29uc3QgbGluZXMgPSBkb2MubGluZXM7XG4gIGxldCBpbmRleCA9IDE7XG5cbiAgd2hpbGUgKGluZGV4IDw9IGxpbmVzKSB7XG4gICAgY29uc3QgbGluZSA9IGRvYy5saW5lKGluZGV4KTtcbiAgICBpZiAobGluZS50ZXh0LnRyaW0oKSA9PT0gYFxcYFxcYFxcYCR7V0hJVEVCT0FSRF9GRU5DRX1gKSB7XG4gICAgICBjb25zdCBzdGFydExpbmUgPSBsaW5lO1xuICAgICAgbGV0IGVuZEluZGV4ID0gaW5kZXggKyAxO1xuXG4gICAgICB3aGlsZSAoZW5kSW5kZXggPD0gbGluZXMpIHtcbiAgICAgICAgY29uc3QgY2FuZGlkYXRlID0gZG9jLmxpbmUoZW5kSW5kZXgpO1xuICAgICAgICBpZiAoY2FuZGlkYXRlLnRleHQudHJpbSgpID09PSBcImBgYFwiKSB7XG4gICAgICAgICAgY29uc3QgZnJvbSA9IHN0YXJ0TGluZS5mcm9tO1xuICAgICAgICAgIGNvbnN0IHRvID0gY2FuZGlkYXRlLnRvO1xuICAgICAgICAgIGNvbnN0IHJhdyA9IGRvYy5zbGljZVN0cmluZyhzdGFydExpbmUudG8gKyAxLCBjYW5kaWRhdGUuZnJvbSk7XG4gICAgICAgICAgYmxvY2tzLnB1c2goeyBmcm9tLCB0bywgcmF3OiByYXcudHJpbSgpIH0pO1xuICAgICAgICAgIGluZGV4ID0gZW5kSW5kZXg7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgICAgZW5kSW5kZXggKz0gMTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpbmRleCArPSAxO1xuICB9XG5cbiAgcmV0dXJuIGJsb2Nrcztcbn1cblxuZnVuY3Rpb24gc2VsZWN0aW9uVG91Y2hlcyh2aWV3OiBFZGl0b3JWaWV3LCBmcm9tOiBudW1iZXIsIHRvOiBudW1iZXIpOiBib29sZWFuIHtcbiAgcmV0dXJuIHZpZXcuc3RhdGUuc2VsZWN0aW9uLnJhbmdlcy5zb21lKChyYW5nZSkgPT4gcmFuZ2UuZnJvbSA8PSB0byAmJiByYW5nZS50byA+PSBmcm9tKTtcbn1cblxuZnVuY3Rpb24gcGFyc2VCb2FyZFNhZmVseShyYXc6IHN0cmluZykge1xuICB0cnkge1xuICAgIHJldHVybiBwYXJzZUJvYXJkKHJhdyk7XG4gIH0gY2F0Y2gge1xuICAgIHJldHVybiBjcmVhdGVEZWZhdWx0Qm9hcmQoKTtcbiAgfVxufVxyXG4iLCAiaW1wb3J0IHsgRW1iZWRkZWRXaGl0ZWJvYXJkRGF0YSwgV2hpdGVib2FyZEVkZ2UsIFdoaXRlYm9hcmROb2RlIH0gZnJvbSBcIi4vdHlwZXNcIjtcblxuZXhwb3J0IGNvbnN0IFdISVRFQk9BUkRfRkVOQ0UgPSBcImlubGluZS13aGl0ZWJvYXJkXCI7XG5leHBvcnQgY29uc3QgREVGQVVMVF9CT0FSRF9IRUlHSFQgPSA1MjA7XG5cbmNvbnN0IERFRkFVTFRfTk9ERV9XSURUSCA9IDI2MDtcbmNvbnN0IERFRkFVTFRfTk9ERV9IRUlHSFQgPSAxODA7XG5cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVJZChwcmVmaXg6IHN0cmluZyk6IHN0cmluZyB7XG4gIHJldHVybiBgJHtwcmVmaXh9LSR7TWF0aC5yYW5kb20oKS50b1N0cmluZygzNikuc2xpY2UoMiwgMTApfWA7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVEZWZhdWx0Tm9kZShvdmVycmlkZXM6IFBhcnRpYWw8V2hpdGVib2FyZE5vZGU+ID0ge30pOiBXaGl0ZWJvYXJkTm9kZSB7XG4gIHJldHVybiB7XG4gICAgaWQ6IGNyZWF0ZUlkKFwibm9kZVwiKSxcbiAgICB0eXBlOiBcInRleHRcIixcbiAgICB0ZXh0OiBcIkRvdWJsZS1jbGljayB0byBlZGl0XCIsXG4gICAgY29sb3I6IFwieWVsbG93XCIsXG4gICAgeDogLURFRkFVTFRfTk9ERV9XSURUSCAvIDIsXG4gICAgeTogLURFRkFVTFRfTk9ERV9IRUlHSFQgLyAyLFxuICAgIHdpZHRoOiBERUZBVUxUX05PREVfV0lEVEgsXG4gICAgaGVpZ2h0OiBERUZBVUxUX05PREVfSEVJR0hULFxuICAgIC4uLm92ZXJyaWRlc1xuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlRGVmYXVsdEJvYXJkKCk6IEVtYmVkZGVkV2hpdGVib2FyZERhdGEge1xuICByZXR1cm4ge1xuICAgIG5vZGVzOiBbXG4gICAgICBjcmVhdGVEZWZhdWx0Tm9kZSh7XG4gICAgICAgIHRleHQ6IFwiIyBFbWJlZGRlZCB3aGl0ZWJvYXJkXFxuXFxuRHJhZyBjYXJkcywgcmVzaXplIHRoZW0sIGFuZCBsaW5rIHRoZW0gdG9nZXRoZXIuXCIsXG4gICAgICAgIHg6IC0xNDAsXG4gICAgICAgIHk6IC04MCxcbiAgICAgICAgd2lkdGg6IDMyMCxcbiAgICAgICAgaGVpZ2h0OiAyMjAsXG4gICAgICAgIGNvbG9yOiBcImJsdWVcIlxuICAgICAgfSlcbiAgICBdLFxuICAgIGVkZ2VzOiBbXSxcbiAgICB2aWV3cG9ydDoge1xuICAgICAgeDogMCxcbiAgICAgIHk6IDAsXG4gICAgICB6b29tOiAxXG4gICAgfVxuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcGFyc2VCb2FyZChyYXc6IHN0cmluZyk6IEVtYmVkZGVkV2hpdGVib2FyZERhdGEge1xuICBjb25zdCBwYXJzZWQgPSBKU09OLnBhcnNlKHJhdykgYXMgUGFydGlhbDxFbWJlZGRlZFdoaXRlYm9hcmREYXRhPjtcbiAgY29uc3Qgbm9kZXMgPSBBcnJheS5pc0FycmF5KHBhcnNlZC5ub2RlcykgPyBwYXJzZWQubm9kZXMgOiBbXTtcbiAgY29uc3QgZWRnZXMgPSBBcnJheS5pc0FycmF5KHBhcnNlZC5lZGdlcykgPyBwYXJzZWQuZWRnZXMgOiBbXTtcblxuICByZXR1cm4ge1xuICAgIG5vZGVzOiBub2Rlc1xuICAgICAgLmZpbHRlcigobm9kZSk6IG5vZGUgaXMgV2hpdGVib2FyZE5vZGUgPT4gQm9vbGVhbihub2RlICYmIHR5cGVvZiBub2RlLmlkID09PSBcInN0cmluZ1wiKSlcbiAgICAgIC5tYXAoKG5vZGUpID0+ICh7XG4gICAgICAgIGlkOiBub2RlLmlkLFxuICAgICAgICB0eXBlOiBcInRleHRcIixcbiAgICAgICAgdGV4dDogdHlwZW9mIG5vZGUudGV4dCA9PT0gXCJzdHJpbmdcIiA/IG5vZGUudGV4dCA6IFwiXCIsXG4gICAgICAgIGNvbG9yOiB0eXBlb2Ygbm9kZS5jb2xvciA9PT0gXCJzdHJpbmdcIiA/IG5vZGUuY29sb3IgOiBcImRlZmF1bHRcIixcbiAgICAgICAgeDogdHlwZW9mIG5vZGUueCA9PT0gXCJudW1iZXJcIiA/IG5vZGUueCA6IDAsXG4gICAgICAgIHk6IHR5cGVvZiBub2RlLnkgPT09IFwibnVtYmVyXCIgPyBub2RlLnkgOiAwLFxuICAgICAgICB3aWR0aDogdHlwZW9mIG5vZGUud2lkdGggPT09IFwibnVtYmVyXCIgPyBub2RlLndpZHRoIDogREVGQVVMVF9OT0RFX1dJRFRILFxuICAgICAgICBoZWlnaHQ6IHR5cGVvZiBub2RlLmhlaWdodCA9PT0gXCJudW1iZXJcIiA/IG5vZGUuaGVpZ2h0IDogREVGQVVMVF9OT0RFX0hFSUdIVFxuICAgICAgfSkpLFxuICAgIGVkZ2VzOiBlZGdlc1xuICAgICAgLmZpbHRlcigoZWRnZSk6IGVkZ2UgaXMgV2hpdGVib2FyZEVkZ2UgPT4gQm9vbGVhbihlZGdlICYmIHR5cGVvZiBlZGdlLmlkID09PSBcInN0cmluZ1wiKSlcbiAgICAgIC5tYXAoKGVkZ2UpID0+ICh7XG4gICAgICAgIGlkOiBlZGdlLmlkLFxuICAgICAgICBmcm9tTm9kZTogZWRnZS5mcm9tTm9kZSxcbiAgICAgICAgdG9Ob2RlOiBlZGdlLnRvTm9kZSxcbiAgICAgICAgZnJvbVNpZGU6IGVkZ2UuZnJvbVNpZGUgPz8gXCJyaWdodFwiLFxuICAgICAgICB0b1NpZGU6IGVkZ2UudG9TaWRlID8/IFwibGVmdFwiLFxuICAgICAgICBsYWJlbDogZWRnZS5sYWJlbFxuICAgICAgfSkpLFxuICAgIHZpZXdwb3J0OiB7XG4gICAgICB4OiB0eXBlb2YgcGFyc2VkLnZpZXdwb3J0Py54ID09PSBcIm51bWJlclwiID8gcGFyc2VkLnZpZXdwb3J0LnggOiAwLFxuICAgICAgeTogdHlwZW9mIHBhcnNlZC52aWV3cG9ydD8ueSA9PT0gXCJudW1iZXJcIiA/IHBhcnNlZC52aWV3cG9ydC55IDogMCxcbiAgICAgIHpvb206IHR5cGVvZiBwYXJzZWQudmlld3BvcnQ/Lnpvb20gPT09IFwibnVtYmVyXCIgPyBwYXJzZWQudmlld3BvcnQuem9vbSA6IDFcbiAgICB9XG4gIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzZXJpYWxpemVCb2FyZChib2FyZDogRW1iZWRkZWRXaGl0ZWJvYXJkRGF0YSk6IHN0cmluZyB7XG4gIHJldHVybiBKU09OLnN0cmluZ2lmeShib2FyZCwgbnVsbCwgMik7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB3cmFwQm9hcmQoYm9hcmQ6IEVtYmVkZGVkV2hpdGVib2FyZERhdGEpOiBzdHJpbmcge1xuICByZXR1cm4gYFxcYFxcYFxcYCR7V0hJVEVCT0FSRF9GRU5DRX1cXG4ke3NlcmlhbGl6ZUJvYXJkKGJvYXJkKX1cXG5cXGBcXGBcXGBgO1xufVxyXG4iLCAiaW1wb3J0IHsgQ29tcG9uZW50LCBNYXJrZG93blJlbmRlcmVyLCBOb3RpY2UgfSBmcm9tIFwib2JzaWRpYW5cIjtcbmltcG9ydCB7XG4gIGNyZWF0ZURlZmF1bHROb2RlLFxuICBjcmVhdGVJZCxcbiAgREVGQVVMVF9CT0FSRF9IRUlHSFRcbn0gZnJvbSBcIi4vc3RhdGVcIjtcbmltcG9ydCB7XG4gIEVkZ2VTaWRlLFxuICBFbWJlZGRlZFdoaXRlYm9hcmREYXRhLFxuICBXaGl0ZWJvYXJkRWRnZSxcbiAgV2hpdGVib2FyZE5vZGVcbn0gZnJvbSBcIi4vdHlwZXNcIjtcblxuaW50ZXJmYWNlIFdoaXRlYm9hcmRIb3N0IHtcbiAgc291cmNlUGF0aDogc3RyaW5nO1xuICBzYXZlKGJvYXJkOiBFbWJlZGRlZFdoaXRlYm9hcmREYXRhKTogUHJvbWlzZTx2b2lkPjtcbn1cblxuaW50ZXJmYWNlIFdoaXRlYm9hcmRIYW5kbGUge1xuICBkZXN0cm95KCk6IHZvaWQ7XG59XG5cbnR5cGUgUG9pbnRlck1vZGUgPVxuICB8IHsgdHlwZTogXCJpZGxlXCIgfVxuICB8IHsgdHlwZTogXCJwYW5cIjsgc3RhcnRYOiBudW1iZXI7IHN0YXJ0WTogbnVtYmVyOyBvcmlnaW5YOiBudW1iZXI7IG9yaWdpblk6IG51bWJlciB9XG4gIHwge1xuICAgICAgdHlwZTogXCJkcmFnXCI7XG4gICAgICBub2RlSWQ6IHN0cmluZztcbiAgICAgIHN0YXJ0WDogbnVtYmVyO1xuICAgICAgc3RhcnRZOiBudW1iZXI7XG4gICAgICBvcmlnaW5YOiBudW1iZXI7XG4gICAgICBvcmlnaW5ZOiBudW1iZXI7XG4gICAgfVxuICB8IHtcbiAgICAgIHR5cGU6IFwicmVzaXplXCI7XG4gICAgICBub2RlSWQ6IHN0cmluZztcbiAgICAgIHN0YXJ0WDogbnVtYmVyO1xuICAgICAgc3RhcnRZOiBudW1iZXI7XG4gICAgICBvcmlnaW5XaWR0aDogbnVtYmVyO1xuICAgICAgb3JpZ2luSGVpZ2h0OiBudW1iZXI7XG4gICAgfTtcblxuY29uc3QgQ09MT1JfQ0xBU1NfTUFQOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge1xuICBkZWZhdWx0OiBcImVtYmVkZGVkLXdoaXRlYm9hcmRfX25vZGUtLWRlZmF1bHRcIixcbiAgeWVsbG93OiBcImVtYmVkZGVkLXdoaXRlYm9hcmRfX25vZGUtLXllbGxvd1wiLFxuICByZWQ6IFwiZW1iZWRkZWQtd2hpdGVib2FyZF9fbm9kZS0tcmVkXCIsXG4gIGdyZWVuOiBcImVtYmVkZGVkLXdoaXRlYm9hcmRfX25vZGUtLWdyZWVuXCIsXG4gIGJsdWU6IFwiZW1iZWRkZWQtd2hpdGVib2FyZF9fbm9kZS0tYmx1ZVwiLFxuICBwdXJwbGU6IFwiZW1iZWRkZWQtd2hpdGVib2FyZF9fbm9kZS0tcHVycGxlXCJcbn07XG5cbmV4cG9ydCBmdW5jdGlvbiBtb3VudFdoaXRlYm9hcmQoXG4gIGNvbnRhaW5lcjogSFRNTEVsZW1lbnQsXG4gIGluaXRpYWxCb2FyZDogRW1iZWRkZWRXaGl0ZWJvYXJkRGF0YSxcbiAgaG9zdDogV2hpdGVib2FyZEhvc3Rcbik6IFdoaXRlYm9hcmRIYW5kbGUge1xuICBjb250YWluZXIuZW1wdHkoKTtcbiAgY29udGFpbmVyLmFkZENsYXNzKFwiZW1iZWRkZWQtd2hpdGVib2FyZFwiKTtcblxuICBjb25zdCByb290ID0gY29udGFpbmVyLmNyZWF0ZURpdih7IGNsczogXCJlbWJlZGRlZC13aGl0ZWJvYXJkX19zaGVsbFwiIH0pO1xuICBjb25zdCB0b29sYmFyID0gcm9vdC5jcmVhdGVEaXYoeyBjbHM6IFwiZW1iZWRkZWQtd2hpdGVib2FyZF9fdG9vbGJhclwiIH0pO1xuICBjb25zdCB2aWV3cG9ydCA9IHJvb3QuY3JlYXRlRGl2KHsgY2xzOiBcImVtYmVkZGVkLXdoaXRlYm9hcmRfX3ZpZXdwb3J0XCIgfSk7XG4gIGNvbnN0IGdyaWQgPSB2aWV3cG9ydC5jcmVhdGVEaXYoeyBjbHM6IFwiZW1iZWRkZWQtd2hpdGVib2FyZF9fZ3JpZFwiIH0pO1xuICBjb25zdCBzdmcgPSB2aWV3cG9ydC5jcmVhdGVFbChcInN2Z1wiLCB7IGNsczogXCJlbWJlZGRlZC13aGl0ZWJvYXJkX19lZGdlc1wiIH0pO1xuICBjb25zdCBlZGdlTGF5ZXIgPSBzdmcuY3JlYXRlRWwoXCJnXCIpO1xuICBjb25zdCB3b3JsZCA9IHZpZXdwb3J0LmNyZWF0ZURpdih7IGNsczogXCJlbWJlZGRlZC13aGl0ZWJvYXJkX193b3JsZFwiIH0pO1xuICBjb25zdCBzdGF0dXMgPSB0b29sYmFyLmNyZWF0ZURpdih7IGNsczogXCJlbWJlZGRlZC13aGl0ZWJvYXJkX19zdGF0dXNcIiwgdGV4dDogXCJSZWFkeVwiIH0pO1xuXG4gIGxldCBib2FyZCA9IHN0cnVjdHVyZWRDbG9uZShpbml0aWFsQm9hcmQpO1xuICBsZXQgc2VsZWN0ZWROb2RlSWQ6IHN0cmluZyB8IG51bGwgPSBib2FyZC5ub2Rlc1swXT8uaWQgPz8gbnVsbDtcbiAgbGV0IGNvbm5lY3RTb3VyY2VJZDogc3RyaW5nIHwgbnVsbCA9IG51bGw7XG4gIGxldCBwb2ludGVyTW9kZTogUG9pbnRlck1vZGUgPSB7IHR5cGU6IFwiaWRsZVwiIH07XG4gIGxldCBzYXZlVGltZXI6IG51bWJlciB8IG51bGwgPSBudWxsO1xuICBsZXQgZGVzdHJveWVkID0gZmFsc2U7XG4gIGxldCBtYXJrZG93bkNoaWxkcmVuOiBDb21wb25lbnRbXSA9IFtdO1xuICBjb25zdCBub2RlRWxlbWVudHMgPSBuZXcgTWFwPHN0cmluZywgSFRNTEVsZW1lbnQ+KCk7XG5cbiAgY29uc3QgdG9vbGJhckJ1dHRvbnMgPSBbXG4gICAgeyBsYWJlbDogXCJBZGQgbm90ZVwiLCBvbkNsaWNrOiAoKSA9PiBhZGROb2RlKCkgfSxcbiAgICB7IGxhYmVsOiBcIkR1cGxpY2F0ZVwiLCBvbkNsaWNrOiAoKSA9PiBkdXBsaWNhdGVTZWxlY3RlZE5vZGUoKSB9LFxuICAgIHsgbGFiZWw6IFwiTGlua1wiLCBvbkNsaWNrOiAoKSA9PiB0b2dnbGVDb25uZWN0TW9kZSgpIH0sXG4gICAgeyBsYWJlbDogXCJEZWxldGVcIiwgb25DbGljazogKCkgPT4gZGVsZXRlU2VsZWN0ZWROb2RlKCkgfSxcbiAgICB7IGxhYmVsOiBcIkZpdFwiLCBvbkNsaWNrOiAoKSA9PiBmaXRUb05vZGVzKCkgfSxcbiAgICB7IGxhYmVsOiBcIlJlc2V0XCIsIG9uQ2xpY2s6ICgpID0+IHJlc2V0Vmlld3BvcnQoKSB9XG4gIF07XG5cbiAgZm9yIChjb25zdCBpdGVtIG9mIHRvb2xiYXJCdXR0b25zKSB7XG4gICAgY29uc3QgYnV0dG9uID0gdG9vbGJhci5jcmVhdGVFbChcImJ1dHRvblwiLCB7XG4gICAgICBjbHM6IFwiZW1iZWRkZWQtd2hpdGVib2FyZF9fYnV0dG9uXCIsXG4gICAgICB0ZXh0OiBpdGVtLmxhYmVsXG4gICAgfSk7XG4gICAgYnV0dG9uLnR5cGUgPSBcImJ1dHRvblwiO1xuICAgIGJ1dHRvbi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgaXRlbS5vbkNsaWNrKTtcbiAgfVxuXG4gIHRvb2xiYXIuYXBwZW5kQ2hpbGQoc3RhdHVzKTtcbiAgdmlld3BvcnQuc3R5bGUubWluSGVpZ2h0ID0gYCR7REVGQVVMVF9CT0FSRF9IRUlHSFR9cHhgO1xuXG4gIGZ1bmN0aW9uIHF1ZXVlU2F2ZSgpOiB2b2lkIHtcbiAgICBpZiAoZGVzdHJveWVkKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKHNhdmVUaW1lciAhPT0gbnVsbCkge1xuICAgICAgd2luZG93LmNsZWFyVGltZW91dChzYXZlVGltZXIpO1xuICAgIH1cblxuICAgIHNhdmVUaW1lciA9IHdpbmRvdy5zZXRUaW1lb3V0KGFzeW5jICgpID0+IHtcbiAgICAgIHNhdmVUaW1lciA9IG51bGw7XG4gICAgICB0cnkge1xuICAgICAgICBhd2FpdCBob3N0LnNhdmUoc3RydWN0dXJlZENsb25lKGJvYXJkKSk7XG4gICAgICAgIHN0YXR1cy5zZXRUZXh0KGNvbm5lY3RTb3VyY2VJZCA/IFwiU2VsZWN0IGEgc2Vjb25kIGNhcmQgdG8gbGlua1wiIDogXCJTYXZlZFwiKTtcbiAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoZXJyb3IpO1xuICAgICAgICBuZXcgTm90aWNlKFwiVW5hYmxlIHRvIHNhdmUgZW1iZWRkZWQgd2hpdGVib2FyZFwiKTtcbiAgICAgICAgc3RhdHVzLnNldFRleHQoXCJTYXZlIGZhaWxlZFwiKTtcbiAgICAgIH1cbiAgICB9LCAxMjApO1xuICB9XG5cbiAgZnVuY3Rpb24gdXBkYXRlU3RhdHVzKG1lc3NhZ2UgPSBcIlJlYWR5XCIpOiB2b2lkIHtcbiAgICBzdGF0dXMuc2V0VGV4dChjb25uZWN0U291cmNlSWQgPyBcIlNlbGVjdCBhIHNlY29uZCBjYXJkIHRvIGxpbmtcIiA6IG1lc3NhZ2UpO1xuICB9XG5cbiAgZnVuY3Rpb24gdXBkYXRlR3JpZCgpOiB2b2lkIHtcbiAgICBjb25zdCBzaXplID0gNDAgKiBib2FyZC52aWV3cG9ydC56b29tO1xuICAgIGdyaWQuc3R5bGUuYmFja2dyb3VuZFNpemUgPSBgJHtzaXplfXB4ICR7c2l6ZX1weGA7XG4gICAgZ3JpZC5zdHlsZS5iYWNrZ3JvdW5kUG9zaXRpb24gPSBgJHtib2FyZC52aWV3cG9ydC54fXB4ICR7Ym9hcmQudmlld3BvcnQueX1weGA7XG4gIH1cblxuICBmdW5jdGlvbiBhcHBseVZpZXdwb3J0KCk6IHZvaWQge1xuICAgIHdvcmxkLnN0eWxlLnRyYW5zZm9ybSA9IGB0cmFuc2xhdGUoJHtib2FyZC52aWV3cG9ydC54fXB4LCAke2JvYXJkLnZpZXdwb3J0Lnl9cHgpIHNjYWxlKCR7Ym9hcmQudmlld3BvcnQuem9vbX0pYDtcbiAgICBzdmcuc3R5bGUudHJhbnNmb3JtID0gYHRyYW5zbGF0ZSgke2JvYXJkLnZpZXdwb3J0Lnh9cHgsICR7Ym9hcmQudmlld3BvcnQueX1weCkgc2NhbGUoJHtib2FyZC52aWV3cG9ydC56b29tfSlgO1xuICAgIHVwZGF0ZUdyaWQoKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGdldE5vZGUobm9kZUlkOiBzdHJpbmcpOiBXaGl0ZWJvYXJkTm9kZSB8IHVuZGVmaW5lZCB7XG4gICAgcmV0dXJuIGJvYXJkLm5vZGVzLmZpbmQoKG5vZGUpID0+IG5vZGUuaWQgPT09IG5vZGVJZCk7XG4gIH1cblxuICBmdW5jdGlvbiBjaG9vc2VTaWRlcyhmcm9tTm9kZTogV2hpdGVib2FyZE5vZGUsIHRvTm9kZTogV2hpdGVib2FyZE5vZGUpOiBQaWNrPFdoaXRlYm9hcmRFZGdlLCBcImZyb21TaWRlXCIgfCBcInRvU2lkZVwiPiB7XG4gICAgY29uc3QgZHggPSB0b05vZGUueCArIHRvTm9kZS53aWR0aCAvIDIgLSAoZnJvbU5vZGUueCArIGZyb21Ob2RlLndpZHRoIC8gMik7XG4gICAgY29uc3QgZHkgPSB0b05vZGUueSArIHRvTm9kZS5oZWlnaHQgLyAyIC0gKGZyb21Ob2RlLnkgKyBmcm9tTm9kZS5oZWlnaHQgLyAyKTtcblxuICAgIGlmIChNYXRoLmFicyhkeCkgPj0gTWF0aC5hYnMoZHkpKSB7XG4gICAgICByZXR1cm4gZHggPj0gMFxuICAgICAgICA/IHsgZnJvbVNpZGU6IFwicmlnaHRcIiwgdG9TaWRlOiBcImxlZnRcIiB9XG4gICAgICAgIDogeyBmcm9tU2lkZTogXCJsZWZ0XCIsIHRvU2lkZTogXCJyaWdodFwiIH07XG4gICAgfVxuXG4gICAgcmV0dXJuIGR5ID49IDBcbiAgICAgID8geyBmcm9tU2lkZTogXCJib3R0b21cIiwgdG9TaWRlOiBcInRvcFwiIH1cbiAgICAgIDogeyBmcm9tU2lkZTogXCJ0b3BcIiwgdG9TaWRlOiBcImJvdHRvbVwiIH07XG4gIH1cblxuICBmdW5jdGlvbiBnZXROb2RlQW5jaG9yKG5vZGU6IFdoaXRlYm9hcmROb2RlLCBzaWRlOiBFZGdlU2lkZSk6IHsgeDogbnVtYmVyOyB5OiBudW1iZXIgfSB7XG4gICAgaWYgKHNpZGUgPT09IFwidG9wXCIpIHtcbiAgICAgIHJldHVybiB7IHg6IG5vZGUueCArIG5vZGUud2lkdGggLyAyLCB5OiBub2RlLnkgfTtcbiAgICB9XG4gICAgaWYgKHNpZGUgPT09IFwicmlnaHRcIikge1xuICAgICAgcmV0dXJuIHsgeDogbm9kZS54ICsgbm9kZS53aWR0aCwgeTogbm9kZS55ICsgbm9kZS5oZWlnaHQgLyAyIH07XG4gICAgfVxuICAgIGlmIChzaWRlID09PSBcImJvdHRvbVwiKSB7XG4gICAgICByZXR1cm4geyB4OiBub2RlLnggKyBub2RlLndpZHRoIC8gMiwgeTogbm9kZS55ICsgbm9kZS5oZWlnaHQgfTtcbiAgICB9XG5cbiAgICByZXR1cm4geyB4OiBub2RlLngsIHk6IG5vZGUueSArIG5vZGUuaGVpZ2h0IC8gMiB9O1xuICB9XG5cbiAgZnVuY3Rpb24gYXBwbHlOb2RlRnJhbWUobm9kZUlkOiBzdHJpbmcpOiB2b2lkIHtcbiAgICBjb25zdCBub2RlID0gZ2V0Tm9kZShub2RlSWQpO1xuICAgIGNvbnN0IG5vZGVFbCA9IG5vZGVFbGVtZW50cy5nZXQobm9kZUlkKTtcbiAgICBpZiAoIW5vZGUgfHwgIW5vZGVFbCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIG5vZGVFbC5zdHlsZS5sZWZ0ID0gYCR7bm9kZS54fXB4YDtcbiAgICBub2RlRWwuc3R5bGUudG9wID0gYCR7bm9kZS55fXB4YDtcbiAgICBub2RlRWwuc3R5bGUud2lkdGggPSBgJHtub2RlLndpZHRofXB4YDtcbiAgICBub2RlRWwuc3R5bGUuaGVpZ2h0ID0gYCR7bm9kZS5oZWlnaHR9cHhgO1xuICAgIG5vZGVFbC50b2dnbGVDbGFzcyhcImlzLXNlbGVjdGVkXCIsIG5vZGUuaWQgPT09IHNlbGVjdGVkTm9kZUlkKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHJlbmRlckVkZ2VzKCk6IHZvaWQge1xuICAgIGVkZ2VMYXllci5lbXB0eSgpO1xuXG4gICAgZm9yIChjb25zdCBlZGdlIG9mIGJvYXJkLmVkZ2VzKSB7XG4gICAgICBjb25zdCBmcm9tTm9kZSA9IGdldE5vZGUoZWRnZS5mcm9tTm9kZSk7XG4gICAgICBjb25zdCB0b05vZGUgPSBnZXROb2RlKGVkZ2UudG9Ob2RlKTtcbiAgICAgIGlmICghZnJvbU5vZGUgfHwgIXRvTm9kZSkge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgY29uc3QgZnJvbSA9IGdldE5vZGVBbmNob3IoZnJvbU5vZGUsIGVkZ2UuZnJvbVNpZGUpO1xuICAgICAgY29uc3QgdG8gPSBnZXROb2RlQW5jaG9yKHRvTm9kZSwgZWRnZS50b1NpZGUpO1xuICAgICAgY29uc3QgbWlkWCA9IChmcm9tLnggKyB0by54KSAvIDI7XG4gICAgICBjb25zdCBwYXRoID0gYE0gJHtmcm9tLnh9ICR7ZnJvbS55fSBDICR7bWlkWH0gJHtmcm9tLnl9LCAke21pZFh9ICR7dG8ueX0sICR7dG8ueH0gJHt0by55fWA7XG4gICAgICBjb25zdCBlZGdlUGF0aCA9IGVkZ2VMYXllci5jcmVhdGVFbChcInBhdGhcIiwgeyBjbHM6IFwiZW1iZWRkZWQtd2hpdGVib2FyZF9fZWRnZVwiIH0pO1xuICAgICAgZWRnZVBhdGguc2V0QXR0cmlidXRlKFwiZFwiLCBwYXRoKTtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBjbGVhbnVwUmVuZGVyZWRNYXJrZG93bigpOiB2b2lkIHtcbiAgICBmb3IgKGNvbnN0IGNoaWxkIG9mIG1hcmtkb3duQ2hpbGRyZW4pIHtcbiAgICAgIGNoaWxkLnVubG9hZCgpO1xuICAgIH1cbiAgICBtYXJrZG93bkNoaWxkcmVuID0gW107XG4gIH1cblxuICBmdW5jdGlvbiBvcGVuRWRpdG9yKG5vZGU6IFdoaXRlYm9hcmROb2RlLCBib2R5OiBIVE1MRWxlbWVudCwgdGl0bGVFbDogSFRNTEVsZW1lbnQpOiB2b2lkIHtcbiAgICBib2R5LmVtcHR5KCk7XG4gICAgY29uc3QgdGV4dGFyZWEgPSBib2R5LmNyZWF0ZUVsKFwidGV4dGFyZWFcIiwgeyBjbHM6IFwiZW1iZWRkZWQtd2hpdGVib2FyZF9fZWRpdG9yXCIgfSk7XG4gICAgdGV4dGFyZWEudmFsdWUgPSBub2RlLnRleHQ7XG4gICAgdGV4dGFyZWEuZm9jdXMoKTtcbiAgICB0ZXh0YXJlYS5zZXRTZWxlY3Rpb25SYW5nZSh0ZXh0YXJlYS52YWx1ZS5sZW5ndGgsIHRleHRhcmVhLnZhbHVlLmxlbmd0aCk7XG5cbiAgICBjb25zdCBjb21taXQgPSAoKTogdm9pZCA9PiB7XG4gICAgICBub2RlLnRleHQgPSB0ZXh0YXJlYS52YWx1ZTtcbiAgICAgIHRpdGxlRWwuc2V0VGV4dChwcmV2aWV3VGl0bGUobm9kZS50ZXh0KSk7XG4gICAgICByZW5kZXJCb2FyZCgpO1xuICAgICAgcXVldWVTYXZlKCk7XG4gICAgfTtcblxuICAgIHRleHRhcmVhLmFkZEV2ZW50TGlzdGVuZXIoXCJibHVyXCIsIGNvbW1pdCwgeyBvbmNlOiB0cnVlIH0pO1xuICAgIHRleHRhcmVhLmFkZEV2ZW50TGlzdGVuZXIoXCJrZXlkb3duXCIsIChldmVudCkgPT4ge1xuICAgICAgaWYgKChldmVudC5jdHJsS2V5IHx8IGV2ZW50Lm1ldGFLZXkpICYmIGV2ZW50LmtleSA9PT0gXCJFbnRlclwiKSB7XG4gICAgICAgIHRleHRhcmVhLmJsdXIoKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHJlbmRlck5vZGUobm9kZTogV2hpdGVib2FyZE5vZGUpOiB2b2lkIHtcbiAgICBjb25zdCBub2RlRWwgPSB3b3JsZC5jcmVhdGVEaXYoeyBjbHM6IFwiZW1iZWRkZWQtd2hpdGVib2FyZF9fbm9kZVwiIH0pO1xuICAgIG5vZGVFbC5kYXRhc2V0Lm5vZGVJZCA9IG5vZGUuaWQ7XG4gICAgbm9kZUVsZW1lbnRzLnNldChub2RlLmlkLCBub2RlRWwpO1xuICAgIGFwcGx5Tm9kZUZyYW1lKG5vZGUuaWQpO1xuICAgIG5vZGVFbC5hZGRDbGFzcyhDT0xPUl9DTEFTU19NQVBbbm9kZS5jb2xvcl0gPz8gQ09MT1JfQ0xBU1NfTUFQLmRlZmF1bHQpO1xuXG4gICAgY29uc3QgY2hyb21lID0gbm9kZUVsLmNyZWF0ZURpdih7IGNsczogXCJlbWJlZGRlZC13aGl0ZWJvYXJkX19ub2RlLWNocm9tZVwiIH0pO1xuICAgIGNvbnN0IHRpdGxlID0gY2hyb21lLmNyZWF0ZURpdih7XG4gICAgICBjbHM6IFwiZW1iZWRkZWQtd2hpdGVib2FyZF9fbm9kZS10aXRsZVwiLFxuICAgICAgdGV4dDogcHJldmlld1RpdGxlKG5vZGUudGV4dClcbiAgICB9KTtcbiAgICBjb25zdCBjb2xvclNlbGVjdCA9IGNocm9tZS5jcmVhdGVFbChcInNlbGVjdFwiLCB7IGNsczogXCJlbWJlZGRlZC13aGl0ZWJvYXJkX19ub2RlLWNvbG9yXCIgfSk7XG4gICAgY29uc3QgY29sb3JzID0gW1wiZGVmYXVsdFwiLCBcInllbGxvd1wiLCBcInJlZFwiLCBcImdyZWVuXCIsIFwiYmx1ZVwiLCBcInB1cnBsZVwiXTtcbiAgICBmb3IgKGNvbnN0IGNvbG9yIG9mIGNvbG9ycykge1xuICAgICAgY29uc3Qgb3B0aW9uID0gY29sb3JTZWxlY3QuY3JlYXRlRWwoXCJvcHRpb25cIiwgeyB0ZXh0OiBjb2xvciB9KTtcbiAgICAgIG9wdGlvbi52YWx1ZSA9IGNvbG9yO1xuICAgICAgb3B0aW9uLnNlbGVjdGVkID0gbm9kZS5jb2xvciA9PT0gY29sb3I7XG4gICAgfVxuXG4gICAgY29uc3QgYm9keSA9IG5vZGVFbC5jcmVhdGVEaXYoeyBjbHM6IFwiZW1iZWRkZWQtd2hpdGVib2FyZF9fbm9kZS1ib2R5XCIgfSk7XG4gICAgY29uc3QgYm9keUNvbXBvbmVudCA9IG5ldyBDb21wb25lbnQoKTtcbiAgICBtYXJrZG93bkNoaWxkcmVuLnB1c2goYm9keUNvbXBvbmVudCk7XG4gICAgdm9pZCBNYXJrZG93blJlbmRlcmVyLnJlbmRlck1hcmtkb3duKG5vZGUudGV4dCwgYm9keSwgaG9zdC5zb3VyY2VQYXRoLCBib2R5Q29tcG9uZW50KTtcblxuICAgIGNvbnN0IHJlc2l6ZUhhbmRsZSA9IG5vZGVFbC5jcmVhdGVEaXYoeyBjbHM6IFwiZW1iZWRkZWQtd2hpdGVib2FyZF9fcmVzaXplLWhhbmRsZVwiIH0pO1xuXG4gICAgbm9kZUVsLmFkZEV2ZW50TGlzdGVuZXIoXCJwb2ludGVyZG93blwiLCAoZXZlbnQpID0+IHtcbiAgICAgIGNvbnN0IHRhcmdldCA9IGV2ZW50LnRhcmdldCBhcyBIVE1MRWxlbWVudDtcbiAgICAgIGlmICh0YXJnZXQuY2xvc2VzdChcIi5lbWJlZGRlZC13aGl0ZWJvYXJkX19ub2RlLWNvbG9yXCIpKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgaWYgKGNvbm5lY3RTb3VyY2VJZCAmJiBjb25uZWN0U291cmNlSWQgIT09IG5vZGUuaWQpIHtcbiAgICAgICAgY29uc3Qgc291cmNlID0gZ2V0Tm9kZShjb25uZWN0U291cmNlSWQpO1xuICAgICAgICBjb25zdCBkZXN0aW5hdGlvbiA9IGdldE5vZGUobm9kZS5pZCk7XG4gICAgICAgIGlmIChzb3VyY2UgJiYgZGVzdGluYXRpb24pIHtcbiAgICAgICAgICBjb25zdCBzaWRlcyA9IGNob29zZVNpZGVzKHNvdXJjZSwgZGVzdGluYXRpb24pO1xuICAgICAgICAgIGJvYXJkLmVkZ2VzLnB1c2goe1xuICAgICAgICAgICAgaWQ6IGNyZWF0ZUlkKFwiZWRnZVwiKSxcbiAgICAgICAgICAgIGZyb21Ob2RlOiBzb3VyY2UuaWQsXG4gICAgICAgICAgICB0b05vZGU6IGRlc3RpbmF0aW9uLmlkLFxuICAgICAgICAgICAgZnJvbVNpZGU6IHNpZGVzLmZyb21TaWRlLFxuICAgICAgICAgICAgdG9TaWRlOiBzaWRlcy50b1NpZGVcbiAgICAgICAgICB9KTtcbiAgICAgICAgICBjb25uZWN0U291cmNlSWQgPSBudWxsO1xuICAgICAgICAgIHJlbmRlckJvYXJkKCk7XG4gICAgICAgICAgcXVldWVTYXZlKCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICBzZWxlY3RlZE5vZGVJZCA9IG5vZGUuaWQ7XG4gICAgICByZWZyZXNoU2VsZWN0aW9uKCk7XG5cbiAgICAgIGlmICh0YXJnZXQgPT09IHJlc2l6ZUhhbmRsZSkge1xuICAgICAgICBwb2ludGVyTW9kZSA9IHtcbiAgICAgICAgICB0eXBlOiBcInJlc2l6ZVwiLFxuICAgICAgICAgIG5vZGVJZDogbm9kZS5pZCxcbiAgICAgICAgICBzdGFydFg6IGV2ZW50LmNsaWVudFgsXG4gICAgICAgICAgc3RhcnRZOiBldmVudC5jbGllbnRZLFxuICAgICAgICAgIG9yaWdpbldpZHRoOiBub2RlLndpZHRoLFxuICAgICAgICAgIG9yaWdpbkhlaWdodDogbm9kZS5oZWlnaHRcbiAgICAgICAgfTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHBvaW50ZXJNb2RlID0ge1xuICAgICAgICAgIHR5cGU6IFwiZHJhZ1wiLFxuICAgICAgICAgIG5vZGVJZDogbm9kZS5pZCxcbiAgICAgICAgICBzdGFydFg6IGV2ZW50LmNsaWVudFgsXG4gICAgICAgICAgc3RhcnRZOiBldmVudC5jbGllbnRZLFxuICAgICAgICAgIG9yaWdpblg6IG5vZGUueCxcbiAgICAgICAgICBvcmlnaW5ZOiBub2RlLnlcbiAgICAgICAgfTtcbiAgICAgIH1cblxuICAgICAgbm9kZUVsLnNldFBvaW50ZXJDYXB0dXJlKGV2ZW50LnBvaW50ZXJJZCk7XG4gICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuICAgIH0pO1xuXG4gICAgY29sb3JTZWxlY3QuYWRkRXZlbnRMaXN0ZW5lcihcImNoYW5nZVwiLCAoKSA9PiB7XG4gICAgICBub2RlLmNvbG9yID0gY29sb3JTZWxlY3QudmFsdWU7XG4gICAgICByZW5kZXJCb2FyZCgpO1xuICAgICAgcXVldWVTYXZlKCk7XG4gICAgfSk7XG5cbiAgICBub2RlRWwuYWRkRXZlbnRMaXN0ZW5lcihcImRibGNsaWNrXCIsICgpID0+IHtcbiAgICAgIG9wZW5FZGl0b3Iobm9kZSwgYm9keSwgdGl0bGUpO1xuICAgIH0pO1xuICB9XG5cbiAgZnVuY3Rpb24gcmVmcmVzaFNlbGVjdGlvbigpOiB2b2lkIHtcbiAgICBmb3IgKGNvbnN0IG5vZGUgb2YgYm9hcmQubm9kZXMpIHtcbiAgICAgIGFwcGx5Tm9kZUZyYW1lKG5vZGUuaWQpO1xuICAgIH1cbiAgICB1cGRhdGVTdGF0dXMoKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHJlbmRlckJvYXJkKCk6IHZvaWQge1xuICAgIGNsZWFudXBSZW5kZXJlZE1hcmtkb3duKCk7XG4gICAgd29ybGQuZW1wdHkoKTtcbiAgICBub2RlRWxlbWVudHMuY2xlYXIoKTtcblxuICAgIGZvciAoY29uc3Qgbm9kZSBvZiBib2FyZC5ub2Rlcykge1xuICAgICAgcmVuZGVyTm9kZShub2RlKTtcbiAgICB9XG5cbiAgICBhcHBseVZpZXdwb3J0KCk7XG4gICAgcmVuZGVyRWRnZXMoKTtcbiAgICByZWZyZXNoU2VsZWN0aW9uKCk7XG4gIH1cblxuICBmdW5jdGlvbiBhZGROb2RlKCk6IHZvaWQge1xuICAgIGNvbnN0IGNlbnRlclggPSAoLWJvYXJkLnZpZXdwb3J0LnggKyB2aWV3cG9ydC5jbGllbnRXaWR0aCAvIDIpIC8gYm9hcmQudmlld3BvcnQuem9vbTtcbiAgICBjb25zdCBjZW50ZXJZID0gKC1ib2FyZC52aWV3cG9ydC55ICsgdmlld3BvcnQuY2xpZW50SGVpZ2h0IC8gMikgLyBib2FyZC52aWV3cG9ydC56b29tO1xuXG4gICAgY29uc3Qgbm9kZSA9IGNyZWF0ZURlZmF1bHROb2RlKHtcbiAgICAgIHg6IGNlbnRlclggLSAxMzAsXG4gICAgICB5OiBjZW50ZXJZIC0gOTBcbiAgICB9KTtcblxuICAgIGJvYXJkLm5vZGVzLnB1c2gobm9kZSk7XG4gICAgc2VsZWN0ZWROb2RlSWQgPSBub2RlLmlkO1xuICAgIHJlbmRlckJvYXJkKCk7XG4gICAgcXVldWVTYXZlKCk7XG4gIH1cblxuICBmdW5jdGlvbiBkdXBsaWNhdGVTZWxlY3RlZE5vZGUoKTogdm9pZCB7XG4gICAgaWYgKCFzZWxlY3RlZE5vZGVJZCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IG5vZGUgPSBnZXROb2RlKHNlbGVjdGVkTm9kZUlkKTtcbiAgICBpZiAoIW5vZGUpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBjb3B5OiBXaGl0ZWJvYXJkTm9kZSA9IHtcbiAgICAgIC4uLm5vZGUsXG4gICAgICBpZDogY3JlYXRlSWQoXCJub2RlXCIpLFxuICAgICAgeDogbm9kZS54ICsgMzIsXG4gICAgICB5OiBub2RlLnkgKyAzMlxuICAgIH07XG5cbiAgICBib2FyZC5ub2Rlcy5wdXNoKGNvcHkpO1xuICAgIHNlbGVjdGVkTm9kZUlkID0gY29weS5pZDtcbiAgICByZW5kZXJCb2FyZCgpO1xuICAgIHF1ZXVlU2F2ZSgpO1xuICB9XG5cbiAgZnVuY3Rpb24gZGVsZXRlU2VsZWN0ZWROb2RlKCk6IHZvaWQge1xuICAgIGlmICghc2VsZWN0ZWROb2RlSWQpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBib2FyZC5ub2RlcyA9IGJvYXJkLm5vZGVzLmZpbHRlcigobm9kZSkgPT4gbm9kZS5pZCAhPT0gc2VsZWN0ZWROb2RlSWQpO1xuICAgIGJvYXJkLmVkZ2VzID0gYm9hcmQuZWRnZXMuZmlsdGVyKFxuICAgICAgKGVkZ2UpID0+IGVkZ2UuZnJvbU5vZGUgIT09IHNlbGVjdGVkTm9kZUlkICYmIGVkZ2UudG9Ob2RlICE9PSBzZWxlY3RlZE5vZGVJZFxuICAgICk7XG4gICAgY29ubmVjdFNvdXJjZUlkID0gY29ubmVjdFNvdXJjZUlkID09PSBzZWxlY3RlZE5vZGVJZCA/IG51bGwgOiBjb25uZWN0U291cmNlSWQ7XG4gICAgc2VsZWN0ZWROb2RlSWQgPSBib2FyZC5ub2Rlc1swXT8uaWQgPz8gbnVsbDtcbiAgICByZW5kZXJCb2FyZCgpO1xuICAgIHF1ZXVlU2F2ZSgpO1xuICB9XG5cbiAgZnVuY3Rpb24gdG9nZ2xlQ29ubmVjdE1vZGUoKTogdm9pZCB7XG4gICAgaWYgKCFzZWxlY3RlZE5vZGVJZCkge1xuICAgICAgc3RhdHVzLnNldFRleHQoXCJQaWNrIGEgY2FyZCBmaXJzdFwiKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25uZWN0U291cmNlSWQgPSBjb25uZWN0U291cmNlSWQgPyBudWxsIDogc2VsZWN0ZWROb2RlSWQ7XG4gICAgdXBkYXRlU3RhdHVzKCk7XG4gIH1cblxuICBmdW5jdGlvbiBmaXRUb05vZGVzKCk6IHZvaWQge1xuICAgIGlmIChib2FyZC5ub2Rlcy5sZW5ndGggPT09IDApIHtcbiAgICAgIHJlc2V0Vmlld3BvcnQoKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBsZWZ0ID0gTWF0aC5taW4oLi4uYm9hcmQubm9kZXMubWFwKChub2RlKSA9PiBub2RlLngpKTtcbiAgICBjb25zdCB0b3AgPSBNYXRoLm1pbiguLi5ib2FyZC5ub2Rlcy5tYXAoKG5vZGUpID0+IG5vZGUueSkpO1xuICAgIGNvbnN0IHJpZ2h0ID0gTWF0aC5tYXgoLi4uYm9hcmQubm9kZXMubWFwKChub2RlKSA9PiBub2RlLnggKyBub2RlLndpZHRoKSk7XG4gICAgY29uc3QgYm90dG9tID0gTWF0aC5tYXgoLi4uYm9hcmQubm9kZXMubWFwKChub2RlKSA9PiBub2RlLnkgKyBub2RlLmhlaWdodCkpO1xuICAgIGNvbnN0IHdpZHRoID0gcmlnaHQgLSBsZWZ0O1xuICAgIGNvbnN0IGhlaWdodCA9IGJvdHRvbSAtIHRvcDtcbiAgICBjb25zdCBtYXJnaW4gPSA5NjtcbiAgICBjb25zdCB6b29tWCA9ICh2aWV3cG9ydC5jbGllbnRXaWR0aCAtIG1hcmdpbikgLyBNYXRoLm1heCh3aWR0aCwgMSk7XG4gICAgY29uc3Qgem9vbVkgPSAodmlld3BvcnQuY2xpZW50SGVpZ2h0IC0gbWFyZ2luKSAvIE1hdGgubWF4KGhlaWdodCwgMSk7XG4gICAgYm9hcmQudmlld3BvcnQuem9vbSA9IE1hdGgubWluKDEuMiwgTWF0aC5tYXgoMC4zNSwgTWF0aC5taW4oem9vbVgsIHpvb21ZKSkpO1xuICAgIGJvYXJkLnZpZXdwb3J0LnggPSB2aWV3cG9ydC5jbGllbnRXaWR0aCAvIDIgLSAobGVmdCArIHdpZHRoIC8gMikgKiBib2FyZC52aWV3cG9ydC56b29tO1xuICAgIGJvYXJkLnZpZXdwb3J0LnkgPSB2aWV3cG9ydC5jbGllbnRIZWlnaHQgLyAyIC0gKHRvcCArIGhlaWdodCAvIDIpICogYm9hcmQudmlld3BvcnQuem9vbTtcbiAgICBhcHBseVZpZXdwb3J0KCk7XG4gICAgcmVuZGVyRWRnZXMoKTtcbiAgICBxdWV1ZVNhdmUoKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHJlc2V0Vmlld3BvcnQoKTogdm9pZCB7XG4gICAgYm9hcmQudmlld3BvcnQueCA9IDA7XG4gICAgYm9hcmQudmlld3BvcnQueSA9IDA7XG4gICAgYm9hcmQudmlld3BvcnQuem9vbSA9IDE7XG4gICAgYXBwbHlWaWV3cG9ydCgpO1xuICAgIHJlbmRlckVkZ2VzKCk7XG4gICAgcXVldWVTYXZlKCk7XG4gIH1cblxuICB2aWV3cG9ydC5hZGRFdmVudExpc3RlbmVyKFwicG9pbnRlcmRvd25cIiwgKGV2ZW50KSA9PiB7XG4gICAgaWYgKChldmVudC50YXJnZXQgYXMgSFRNTEVsZW1lbnQpLmNsb3Nlc3QoXCIuZW1iZWRkZWQtd2hpdGVib2FyZF9fbm9kZVwiKSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHBvaW50ZXJNb2RlID0ge1xuICAgICAgdHlwZTogXCJwYW5cIixcbiAgICAgIHN0YXJ0WDogZXZlbnQuY2xpZW50WCxcbiAgICAgIHN0YXJ0WTogZXZlbnQuY2xpZW50WSxcbiAgICAgIG9yaWdpblg6IGJvYXJkLnZpZXdwb3J0LngsXG4gICAgICBvcmlnaW5ZOiBib2FyZC52aWV3cG9ydC55XG4gICAgfTtcbiAgICBzZWxlY3RlZE5vZGVJZCA9IG51bGw7XG4gICAgcmVmcmVzaFNlbGVjdGlvbigpO1xuICB9KTtcblxuICB2aWV3cG9ydC5hZGRFdmVudExpc3RlbmVyKFwicG9pbnRlcm1vdmVcIiwgKGV2ZW50KSA9PiB7XG4gICAgaWYgKHBvaW50ZXJNb2RlLnR5cGUgPT09IFwicGFuXCIpIHtcbiAgICAgIGJvYXJkLnZpZXdwb3J0LnggPSBwb2ludGVyTW9kZS5vcmlnaW5YICsgKGV2ZW50LmNsaWVudFggLSBwb2ludGVyTW9kZS5zdGFydFgpO1xuICAgICAgYm9hcmQudmlld3BvcnQueSA9IHBvaW50ZXJNb2RlLm9yaWdpblkgKyAoZXZlbnQuY2xpZW50WSAtIHBvaW50ZXJNb2RlLnN0YXJ0WSk7XG4gICAgICBhcHBseVZpZXdwb3J0KCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKHBvaW50ZXJNb2RlLnR5cGUgPT09IFwiZHJhZ1wiKSB7XG4gICAgICBjb25zdCBub2RlID0gZ2V0Tm9kZShwb2ludGVyTW9kZS5ub2RlSWQpO1xuICAgICAgaWYgKCFub2RlKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgbm9kZS54ID0gcG9pbnRlck1vZGUub3JpZ2luWCArIChldmVudC5jbGllbnRYIC0gcG9pbnRlck1vZGUuc3RhcnRYKSAvIGJvYXJkLnZpZXdwb3J0Lnpvb207XG4gICAgICBub2RlLnkgPSBwb2ludGVyTW9kZS5vcmlnaW5ZICsgKGV2ZW50LmNsaWVudFkgLSBwb2ludGVyTW9kZS5zdGFydFkpIC8gYm9hcmQudmlld3BvcnQuem9vbTtcbiAgICAgIGFwcGx5Tm9kZUZyYW1lKG5vZGUuaWQpO1xuICAgICAgcmVuZGVyRWRnZXMoKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAocG9pbnRlck1vZGUudHlwZSA9PT0gXCJyZXNpemVcIikge1xuICAgICAgY29uc3Qgbm9kZSA9IGdldE5vZGUocG9pbnRlck1vZGUubm9kZUlkKTtcbiAgICAgIGlmICghbm9kZSkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIG5vZGUud2lkdGggPSBNYXRoLm1heCgxODAsIHBvaW50ZXJNb2RlLm9yaWdpbldpZHRoICsgKGV2ZW50LmNsaWVudFggLSBwb2ludGVyTW9kZS5zdGFydFgpIC8gYm9hcmQudmlld3BvcnQuem9vbSk7XG4gICAgICBub2RlLmhlaWdodCA9IE1hdGgubWF4KDEyMCwgcG9pbnRlck1vZGUub3JpZ2luSGVpZ2h0ICsgKGV2ZW50LmNsaWVudFkgLSBwb2ludGVyTW9kZS5zdGFydFkpIC8gYm9hcmQudmlld3BvcnQuem9vbSk7XG4gICAgICBhcHBseU5vZGVGcmFtZShub2RlLmlkKTtcbiAgICAgIHJlbmRlckVkZ2VzKCk7XG4gICAgfVxuICB9KTtcblxuICBjb25zdCBzdG9wUG9pbnRlciA9ICgpOiB2b2lkID0+IHtcbiAgICBpZiAocG9pbnRlck1vZGUudHlwZSA9PT0gXCJkcmFnXCIgfHwgcG9pbnRlck1vZGUudHlwZSA9PT0gXCJyZXNpemVcIiB8fCBwb2ludGVyTW9kZS50eXBlID09PSBcInBhblwiKSB7XG4gICAgICBxdWV1ZVNhdmUoKTtcbiAgICB9XG4gICAgcG9pbnRlck1vZGUgPSB7IHR5cGU6IFwiaWRsZVwiIH07XG4gIH07XG5cbiAgdmlld3BvcnQuYWRkRXZlbnRMaXN0ZW5lcihcInBvaW50ZXJ1cFwiLCBzdG9wUG9pbnRlcik7XG4gIHZpZXdwb3J0LmFkZEV2ZW50TGlzdGVuZXIoXCJwb2ludGVybGVhdmVcIiwgc3RvcFBvaW50ZXIpO1xuXG4gIHZpZXdwb3J0LmFkZEV2ZW50TGlzdGVuZXIoXG4gICAgXCJ3aGVlbFwiLFxuICAgIChldmVudCkgPT4ge1xuICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcblxuICAgICAgY29uc3QgYm91bmRzID0gdmlld3BvcnQuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG4gICAgICBjb25zdCBjdXJzb3JYID0gZXZlbnQuY2xpZW50WCAtIGJvdW5kcy5sZWZ0O1xuICAgICAgY29uc3QgY3Vyc29yWSA9IGV2ZW50LmNsaWVudFkgLSBib3VuZHMudG9wO1xuICAgICAgY29uc3Qgd29ybGRYID0gKGN1cnNvclggLSBib2FyZC52aWV3cG9ydC54KSAvIGJvYXJkLnZpZXdwb3J0Lnpvb207XG4gICAgICBjb25zdCB3b3JsZFkgPSAoY3Vyc29yWSAtIGJvYXJkLnZpZXdwb3J0LnkpIC8gYm9hcmQudmlld3BvcnQuem9vbTtcbiAgICAgIGNvbnN0IG5leHRab29tID0gY2xhbXAoYm9hcmQudmlld3BvcnQuem9vbSAqIChldmVudC5kZWx0YVkgPCAwID8gMS4wOCA6IDAuOTIpLCAwLjMsIDIpO1xuXG4gICAgICBib2FyZC52aWV3cG9ydC56b29tID0gbmV4dFpvb207XG4gICAgICBib2FyZC52aWV3cG9ydC54ID0gY3Vyc29yWCAtIHdvcmxkWCAqIG5leHRab29tO1xuICAgICAgYm9hcmQudmlld3BvcnQueSA9IGN1cnNvclkgLSB3b3JsZFkgKiBuZXh0Wm9vbTtcbiAgICAgIGFwcGx5Vmlld3BvcnQoKTtcbiAgICAgIHF1ZXVlU2F2ZSgpO1xuICAgIH0sXG4gICAgeyBwYXNzaXZlOiBmYWxzZSB9XG4gICk7XG5cbiAgcmVuZGVyQm9hcmQoKTtcblxuICByZXR1cm4ge1xuICAgIGRlc3Ryb3koKSB7XG4gICAgICBkZXN0cm95ZWQgPSB0cnVlO1xuICAgICAgaWYgKHNhdmVUaW1lciAhPT0gbnVsbCkge1xuICAgICAgICB3aW5kb3cuY2xlYXJUaW1lb3V0KHNhdmVUaW1lcik7XG4gICAgICB9XG4gICAgICBjbGVhbnVwUmVuZGVyZWRNYXJrZG93bigpO1xuICAgICAgY29udGFpbmVyLmVtcHR5KCk7XG4gICAgfVxuICB9O1xufVxuXG5mdW5jdGlvbiBwcmV2aWV3VGl0bGUodGV4dDogc3RyaW5nKTogc3RyaW5nIHtcbiAgY29uc3QgY29tcGFjdCA9IHRleHQucmVwbGFjZSgvXiMrXFxzKi9nbSwgXCJcIikucmVwbGFjZSgvXFxzKy9nLCBcIiBcIikudHJpbSgpO1xuICByZXR1cm4gY29tcGFjdC5zbGljZSgwLCAzMikgfHwgXCJVbnRpdGxlZFwiO1xufVxuXG5mdW5jdGlvbiBjbGFtcCh2YWx1ZTogbnVtYmVyLCBtaW46IG51bWJlciwgbWF4OiBudW1iZXIpOiBudW1iZXIge1xuICByZXR1cm4gTWF0aC5taW4obWF4LCBNYXRoLm1heChtaW4sIHZhbHVlKSk7XG59XHJcbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLElBQUFBLG1CQU1POzs7QUNOUCxJQUFBQyxnQkFBZ0M7QUFDaEMsa0JBQTJFOzs7QUNDcEUsSUFB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Syx5QkFBeUIsTUFBTTtBQUFBLFVBQ3RDLENBQUM7QUFBQSxRQUNMLENBQUM7QUFBQSxNQUNILENBQUM7QUFBQSxJQUNIO0FBQUEsRUFDRjtBQUFBLEVBRVEsbUJBQW1CLFFBQXdDO0FBQ2pFLFFBQUk7QUFDRixhQUFPLFdBQVcsTUFBTTtBQUFBLElBQzFCLFNBQVMsT0FBTztBQUNkLGNBQVEsTUFBTSxLQUFLO0FBQ25CLGFBQU8sbUJBQW1CO0FBQUEsSUFDNUI7QUFBQSxFQUNGO0FBQUEsRUFFQSxNQUFjLGtCQUFrQixNQUE0QjtBQUMxRCxVQUFNLFVBQVUsTUFBTSxLQUFLLElBQUksTUFBTSxLQUFLLElBQUk7QUFDOUMsVUFBTSxTQUFTLFFBQVEsU0FBUyxJQUFJLElBQUksS0FBSztBQUM3QyxVQUFNLEtBQUssSUFBSSxNQUFNLE9BQU8sTUFBTSxHQUFHLE9BQU8sR0FBRyxNQUFNO0FBQUEsRUFBSyxVQUFVLG1CQUFtQixDQUFDLENBQUM7QUFBQSxDQUFJO0FBQzdGLFFBQUksd0JBQU8sMENBQTBDO0FBQUEsRUFDdkQ7QUFBQSxFQUVRLHlCQUF5QixRQUFzQjtBQUNyRCxVQUFNLFFBQVEsVUFBVSxtQkFBbUIsQ0FBQztBQUM1QyxVQUFNLFNBQVMsT0FBTyxVQUFVO0FBQ2hDLFVBQU0sb0JBQW9CLE9BQU8sT0FBTyxJQUFJLE9BQU87QUFDbkQsV0FBTyxhQUFhLEdBQUcsaUJBQWlCLEdBQUcsS0FBSztBQUFBLEdBQU0sTUFBTTtBQUFBLEVBQzlEO0FBQUEsRUFFQSxNQUFjLGFBQ1osWUFDQSxlQUNBLE9BQ2lCO0FBQ2pCLFVBQU0sT0FBTyxLQUFLLElBQUksTUFBTSxzQkFBc0IsVUFBVTtBQUM1RCxRQUFJLEVBQUUsZ0JBQWdCLHlCQUFRO0FBQzVCLFlBQU0sSUFBSSxNQUFNLCtCQUErQixVQUFVLEVBQUU7QUFBQSxJQUM3RDtBQUVBLFVBQU0sWUFBWSxVQUFVLEtBQUs7QUFDakMsVUFBTSxVQUFVLE1BQU0sS0FBSyxJQUFJLE1BQU0sS0FBSyxJQUFJO0FBQzlDLFVBQU0sUUFBUSxRQUFRLFFBQVEsYUFBYTtBQUMzQyxRQUFJLFVBQVUsSUFBSTtBQUNoQixZQUFNLElBQUksTUFBTSxpRUFBaUU7QUFBQSxJQUNuRjtBQUVBLFVBQU0sVUFBVSxHQUFHLFFBQVEsTUFBTSxHQUFHLEtBQUssQ0FBQyxHQUFHLFNBQVMsR0FBRyxRQUFRLE1BQU0sUUFBUSxjQUFjLE1BQU0sQ0FBQztBQUNwRyxVQUFNLEtBQUssSUFBSSxNQUFNLE9BQU8sTUFBTSxPQUFPO0FBQ3pDLFdBQU87QUFBQSxFQUNUO0FBQ0Y7IiwKICAibmFtZXMiOiBbImltcG9ydF9vYnNpZGlhbiIsICJpbXBvcnRfc3RhdGUiXQp9Cg==
