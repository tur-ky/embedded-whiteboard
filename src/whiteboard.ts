import { Component, MarkdownRenderer, Notice } from "obsidian";
import {
  createDefaultNode,
  createId,
  DEFAULT_BOARD_HEIGHT
} from "./state";
import {
  EdgeSide,
  EmbeddedWhiteboardData,
  WhiteboardEdge,
  WhiteboardNode
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
  | {
      type: "drag";
      nodeId: string;
      startX: number;
      startY: number;
      originX: number;
      originY: number;
    }
  | {
      type: "resize";
      nodeId: string;
      startX: number;
      startY: number;
      originWidth: number;
      originHeight: number;
    };

const COLOR_CLASS_MAP: Record<string, string> = {
  default: "embedded-whiteboard__node--default",
  yellow: "embedded-whiteboard__node--yellow",
  red: "embedded-whiteboard__node--red",
  green: "embedded-whiteboard__node--green",
  blue: "embedded-whiteboard__node--blue",
  purple: "embedded-whiteboard__node--purple"
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
  const viewport = root.createDiv({ cls: "embedded-whiteboard__viewport" });
  const grid = viewport.createDiv({ cls: "embedded-whiteboard__grid" });
  const svg = viewport.createEl("svg", { cls: "embedded-whiteboard__edges" });
  const edgeLayer = svg.createEl("g");
  const world = viewport.createDiv({ cls: "embedded-whiteboard__world" });
  const status = toolbar.createDiv({ cls: "embedded-whiteboard__status", text: "Ready" });

  let board = structuredClone(initialBoard);
  let selectedNodeId: string | null = board.nodes[0]?.id ?? null;
  let connectSourceId: string | null = null;
  let pointerMode: PointerMode = { type: "idle" };
  let saveTimer: number | null = null;
  let destroyed = false;
  let markdownChildren: Component[] = [];
  const nodeElements = new Map<string, HTMLElement>();

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
        status.setText(connectSourceId ? "Select a second card to link" : "Saved");
      } catch (error) {
        console.error(error);
        new Notice("Unable to save embedded whiteboard");
        status.setText("Save failed");
      }
    }, 120);
  }

  function updateStatus(message = "Ready"): void {
    status.setText(connectSourceId ? "Select a second card to link" : message);
  }

  function updateGrid(): void {
    const size = 40 * board.viewport.zoom;
    grid.style.backgroundSize = `${size}px ${size}px`;
    grid.style.backgroundPosition = `${board.viewport.x}px ${board.viewport.y}px`;
  }

  function applyViewport(): void {
    world.style.transform = `translate(${board.viewport.x}px, ${board.viewport.y}px) scale(${board.viewport.zoom})`;
    svg.style.transform = `translate(${board.viewport.x}px, ${board.viewport.y}px) scale(${board.viewport.zoom})`;
    updateGrid();
  }

  function getNode(nodeId: string): WhiteboardNode | undefined {
    return board.nodes.find((node) => node.id === nodeId);
  }

  function chooseSides(fromNode: WhiteboardNode, toNode: WhiteboardNode): Pick<WhiteboardEdge, "fromSide" | "toSide"> {
    const dx = toNode.x + toNode.width / 2 - (fromNode.x + fromNode.width / 2);
    const dy = toNode.y + toNode.height / 2 - (fromNode.y + fromNode.height / 2);

    if (Math.abs(dx) >= Math.abs(dy)) {
      return dx >= 0
        ? { fromSide: "right", toSide: "left" }
        : { fromSide: "left", toSide: "right" };
    }

    return dy >= 0
      ? { fromSide: "bottom", toSide: "top" }
      : { fromSide: "top", toSide: "bottom" };
  }

  function getNodeAnchor(node: WhiteboardNode, side: EdgeSide): { x: number; y: number } {
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

  function applyNodeFrame(nodeId: string): void {
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

  function renderEdges(): void {
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

  function cleanupRenderedMarkdown(): void {
    for (const child of markdownChildren) {
      child.unload();
    }
    markdownChildren = [];
  }

  function openEditor(node: WhiteboardNode, body: HTMLElement, titleEl: HTMLElement): void {
    body.empty();
    const textarea = body.createEl("textarea", { cls: "embedded-whiteboard__editor" });
    textarea.value = node.text;
    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);

    const commit = (): void => {
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

  function renderNode(node: WhiteboardNode): void {
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
    const bodyComponent = new Component();
    markdownChildren.push(bodyComponent);
    void MarkdownRenderer.renderMarkdown(node.text, body, host.sourcePath, bodyComponent);

    const resizeHandle = nodeEl.createDiv({ cls: "embedded-whiteboard__resize-handle" });

    nodeEl.addEventListener("pointerdown", (event) => {
      const target = event.target as HTMLElement;
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

  function refreshSelection(): void {
    for (const node of board.nodes) {
      applyNodeFrame(node.id);
    }
    updateStatus();
  }

  function renderBoard(): void {
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

  function addNode(): void {
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

  function duplicateSelectedNode(): void {
    if (!selectedNodeId) {
      return;
    }

    const node = getNode(selectedNodeId);
    if (!node) {
      return;
    }

    const copy: WhiteboardNode = {
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

  function deleteSelectedNode(): void {
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

  function toggleConnectMode(): void {
    if (!selectedNodeId) {
      status.setText("Pick a card first");
      return;
    }

    connectSourceId = connectSourceId ? null : selectedNodeId;
    updateStatus();
  }

  function fitToNodes(): void {
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

  function resetViewport(): void {
    board.viewport.x = 0;
    board.viewport.y = 0;
    board.viewport.zoom = 1;
    applyViewport();
    renderEdges();
    queueSave();
  }

  viewport.addEventListener("pointerdown", (event) => {
    if ((event.target as HTMLElement).closest(".embedded-whiteboard__node")) {
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

  const stopPointer = (): void => {
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

function previewTitle(text: string): string {
  const compact = text.replace(/^#+\s*/gm, "").replace(/\s+/g, " ").trim();
  return compact.slice(0, 32) || "Untitled";
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
