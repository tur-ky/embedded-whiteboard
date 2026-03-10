# Embedded Whiteboard

An Obsidian plugin that embeds a canvas-style whiteboard directly inside a Markdown note.

## How it works

- Whiteboards live in fenced code blocks named `inline-whiteboard`.
- In reading mode and the editor, those blocks are replaced with an interactive canvas.
- The canvas stores cards, links, positions, sizes, and viewport state back into the note as JSON.

## Features

- Drag, resize, recolor, duplicate, and delete cards
- Double-click cards to edit Markdown content
- Link cards together with a dedicated toolbar action
- Pan and zoom inside the embedded board
- Insert a new board from the command palette with `Insert embedded whiteboard`

## Example block

````markdown
```inline-whiteboard
{
  "nodes": [],
  "edges": [],
  "viewport": {
    "x": 0,
    "y": 0,
    "zoom": 1
  }
}
```
````

## Build

```bash
npm install
npm run build
```
