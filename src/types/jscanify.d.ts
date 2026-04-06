declare module "jscanify/client" {
  export type CornerPoints = {
    topLeftCorner?: { x: number; y: number };
    topRightCorner?: { x: number; y: number };
    bottomLeftCorner?: { x: number; y: number };
    bottomRightCorner?: { x: number; y: number };
  };

  export default class jscanify {
    highlightPaper(
      image: HTMLImageElement | HTMLCanvasElement,
      options?: { color?: string; thickness?: number },
    ): HTMLCanvasElement;

    extractPaper(
      image: HTMLImageElement | HTMLCanvasElement,
      resultWidth: number,
      resultHeight: number,
      cornerPoints?: {
        topLeftCorner: { x: number; y: number };
        topRightCorner: { x: number; y: number };
        bottomLeftCorner: { x: number; y: number };
        bottomRightCorner: { x: number; y: number };
      },
    ): HTMLCanvasElement | null;

    /** Finds the largest quadrilateral contour in the image (requires OpenCV.js). */
    findPaperContour(img: unknown): unknown | null;

    /** Extracts the 4 corner points from a contour returned by findPaperContour. */
    getCornerPoints(contour: unknown): CornerPoints;
  }
}
