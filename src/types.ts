export type EdgeSide = "top" | "right" | "bottom" | "left";

export interface WhiteboardViewport {
  x: number;
  y: number;
  zoom: number;
}

export interface WhiteboardNode {
  id: string;
  type: "text";
  text: string;
  color: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WhiteboardEdge {
  id: string;
  fromNode: string;
  toNode: string;
  fromSide: EdgeSide;
  toSide: EdgeSide;
  label?: string;
}

export interface EmbeddedWhiteboardData {
  nodes: WhiteboardNode[];
  edges: WhiteboardEdge[];
  viewport: WhiteboardViewport;
}
