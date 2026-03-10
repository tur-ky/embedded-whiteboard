import {
  Editor,
  MarkdownView,
  Notice,
  Plugin,
  TFile
} from "obsidian";
import { buildEditorExtension } from "./src/editor-extension";
import {
  createDefaultBoard,
  parseBoard,
  WHITEBOARD_FENCE,
  wrapBoard
} from "./src/state";
import { EmbeddedWhiteboardData } from "./src/types";
import { mountWhiteboard } from "./src/whiteboard";

export default class EmbeddedWhiteboardPlugin extends Plugin {
  async onload(): Promise<void> {
    this.registerMarkdownCodeBlockProcessor(
      WHITEBOARD_FENCE,
      async (source, el, ctx) => {
        const board = this.parseOrCreateBoard(source);
        let currentBlock = `\`\`\`${WHITEBOARD_FENCE}\n${source}\n\`\`\``;

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

  private async persistBlock(
    sourcePath: string,
    previousBlock: string,
    board: EmbeddedWhiteboardData
  ): Promise<string> {
    const file = this.app.vault.getAbstractFileByPath(sourcePath);
    if (!(file instanceof TFile)) {
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
}
