import { RangeSetBuilder } from "@codemirror/state";
import { Decoration, EditorView, ViewPlugin, ViewUpdate, WidgetType } from "@codemirror/view";
import { Plugin } from "obsidian";
import { createDefaultBoard, parseBoard, WHITEBOARD_FENCE, wrapBoard } from "./state";
import { mountWhiteboard } from "./whiteboard";

interface WhiteboardBlock {
  from: number;
  to: number;
  raw: string;
}

export function buildEditorExtension(plugin: Plugin) {
  const widgetPlugin = ViewPlugin.fromClass(
    class {
      decorations;

      constructor(private readonly view: EditorView) {
        this.decorations = this.buildDecorations();
      }

      update(update: ViewUpdate): void {
        if (update.docChanged || update.viewportChanged || update.selectionSet) {
          this.decorations = this.buildDecorations();
        }
      }

      buildDecorations() {
        const builder = new RangeSetBuilder<Decoration>();
        const blocks = findWhiteboardBlocks(this.view);

        for (const block of blocks) {
          if (selectionTouches(this.view, block.from, block.to)) {
            continue;
          }

          builder.add(
            block.from,
            block.to,
            Decoration.replace({
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

class InlineWhiteboardWidget extends WidgetType {
  private handle?: { destroy(): void };

  constructor(
    private readonly plugin: Plugin,
    private readonly view: EditorView,
    private readonly block: WhiteboardBlock
  ) {
    super();
  }

  eq(other: InlineWhiteboardWidget): boolean {
    return other.block.raw === this.block.raw;
  }

  toDOM(): HTMLElement {
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

  destroy(): void {
    this.handle?.destroy();
  }

  ignoreEvent(): boolean {
    return false;
  }
}

function findWhiteboardBlocks(view: EditorView): WhiteboardBlock[] {
  const blocks: WhiteboardBlock[] = [];
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

function selectionTouches(view: EditorView, from: number, to: number): boolean {
  return view.state.selection.ranges.some((range) => range.from <= to && range.to >= from);
}

function parseBoardSafely(raw: string) {
  try {
    return parseBoard(raw);
  } catch {
    return createDefaultBoard();
  }
}
