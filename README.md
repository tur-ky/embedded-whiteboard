# Embedded Whiteboard

An Obsidian plugin that embeds a drawing-first whiteboard directly inside a Markdown note.

## Current direction

This build is aimed at a Concepts-style workflow: an infinite canvas with tool-driven drawing instead of node cards.

## Included tools

- Pen
- Pencil
- Marker
- Eraser
- Text
- Select / move
- Hand / pan
- Zoom with the mouse wheel
- Layers with visibility and lock toggles
- Undo / redo

## How it works

- Whiteboards live in fenced code blocks named `inline-whiteboard`.
- In reading mode and the editor, those blocks are replaced with an interactive drawing canvas.
- The canvas stores layers, strokes, text items, and viewport state back into the note as JSON.

## Commands

- `Insert embedded whiteboard`
- `Append embedded whiteboard to current note`

## Build

```bash
npm install
npm run build
npm run package-release
```
