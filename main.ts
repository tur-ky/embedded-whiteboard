import {
  Editor,
  MarkdownView,
  Notice,
  Plugin,
  TFile
} from "obsidian";
import {
  createDefaultBoard,
  parseBoard,
  WHITEBOARD_FENCE,
  wrapBoard
} from "./src/state";
import { EmbeddedWhiteboardData } from "./src/types";
import { mountWhiteboard } from "./src/whiteboard";

interface LocatedBlock {
  from: number;
  to: number;
  content: string;
}

export default class EmbeddedWhiteboardPlugin extends Plugin {
  async onload(): Promise<void> {
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
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
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
          item
            .setTitle("Insert embedded whiteboard")
            .setIcon("layout-dashboard")
            .onClick(() => {
              this.insertEmbeddedWhiteboard(editor);
            });
        });
      })
    );
  }

  private parseOrCreateBoard(source: string): EmbeddedWhiteboardData {
    try {
      return parseBoard(source);
    } catch (error) {
      console.error(error);
      return createDefaultBoard();
    }
  }

  private async appendBoardToFile(file: TFile): Promise<void> {
    const content = await this.app.vault.read(file);
    const suffix = content.endsWith("\n") ? "" : "\n";
    await this.app.vault.modify(file, `${content}${suffix}\n${wrapBoard(createDefaultBoard())}\n`);
    new Notice("Embedded whiteboard appended to the note");
  }

  private insertEmbeddedWhiteboard(editor: Editor): void {
    const board = wrapBoard(createDefaultBoard());
    const cursor = editor.getCursor();
    const needsLeadingBreak = cursor.line > 0 ? "\n" : "";
    editor.replaceRange(`${needsLeadingBreak}${board}\n`, cursor);
  }

  private async persistBlock(sourcePath: string, board: EmbeddedWhiteboardData): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(sourcePath);
    if (!(file instanceof TFile)) {
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

  private findBlockByBoardId(content: string, boardId: string): LocatedBlock | null {
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

  private findSingleWhiteboardBlock(content: string): LocatedBlock | null {
    const blocks = [...this.iterateWhiteboardBlocks(content)];
    return blocks.length === 1 ? blocks[0] : null;
  }

  private *iterateWhiteboardBlocks(content: string): Generator<LocatedBlock> {
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
}
