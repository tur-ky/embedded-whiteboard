export type DrawingTool = "pen" | "pencil" | "marker";
export type WhiteboardTool = DrawingTool | "eraser" | "text" | "select" | "hand";

export interface WhiteboardViewport {
  x: number;
  y: number;
  zoom: number;
}

export interface WhiteboardLayer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
}

export interface StrokePoint {
  x: number;
  y: number;
  pressure: number;
}

export interface StrokeItem {
  id: string;
  type: "stroke";
  layerId: string;
  tool: DrawingTool;
  color: string;
  width: number;
  opacity: number;
  points: StrokePoint[];
}

export interface TextItem {
  id: string;
  type: "text";
  layerId: string;
  x: number;
  y: number;
  text: string;
  color: string;
  size: number;
}

export type WhiteboardItem = StrokeItem | TextItem;

export interface EmbeddedWhiteboardData {
  id: string;
  layers: WhiteboardLayer[];
  items: WhiteboardItem[];
  viewport: WhiteboardViewport;
}
