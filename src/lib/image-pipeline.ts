/**
 * Browser-native image processing pipeline with a builder pattern API.
 *
 * @example
 * const result = new ImagePipeline(canvas)
 *   .scale(3)
 *   .greyscale()
 *   .contrast(0.5)
 *   .toCanvas();
 */
export class ImagePipeline {
  private data: Uint8ClampedArray;
  private width: number;
  private height: number;

  constructor(source: HTMLCanvasElement | ImageData) {
    if (source instanceof ImageData) {
      this.width = source.width;
      this.height = source.height;
      this.data = new Uint8ClampedArray(source.data);
    } else {
      this.width = source.width;
      this.height = source.height;
      const ctx = source.getContext("2d")!;
      const imageData = ctx.getImageData(0, 0, this.width, this.height);
      this.data = new Uint8ClampedArray(imageData.data);
    }
  }

  /** Upscale the image by an integer factor using canvas drawImage interpolation. */
  scale(factor: number): this {
    const newW = Math.round(this.width * factor);
    const newH = Math.round(this.height * factor);

    const src = this.toCanvas();
    const dst = document.createElement("canvas");
    dst.width = newW;
    dst.height = newH;
    const ctx = dst.getContext("2d")!;
    ctx.drawImage(src, 0, 0, newW, newH);

    const imageData = ctx.getImageData(0, 0, newW, newH);
    this.width = newW;
    this.height = newH;
    this.data = new Uint8ClampedArray(imageData.data);
    return this;
  }

  /**
   * Convert to greyscale using luminance weighting (ITU-R BT.601).
   * Alpha channel is preserved.
   */
  greyscale(): this {
    const d = this.data;
    for (let i = 0; i < d.length; i += 4) {
      const gray = Math.round(
        0.299 * (d[i] ?? 0) +
          0.587 * (d[i + 1] ?? 0) +
          0.114 * (d[i + 2] ?? 0),
      );
      d[i] = gray;
      d[i + 1] = gray;
      d[i + 2] = gray;
    }
    return this;
  }

  /**
   * Adjust contrast.
   * @param factor - Value in [-1, 1] matching Jimp's convention.
   *   Positive values increase contrast, negative values decrease it.
   */
  contrast(factor: number): this {
    // Jimp-compatible formula:
    //   f = (259 * (factor*255 + 255)) / (255 * (259 - factor*255))
    //   newVal = clamp(f * (val - 128) + 128)
    const f =
      (259 * (factor * 255 + 255)) / (255 * (259 - factor * 255));
    const d = this.data;
    for (let i = 0; i < d.length; i += 4) {
      d[i] = Math.min(255, Math.max(0, Math.round(f * ((d[i] ?? 0) - 128) + 128)));
      d[i + 1] = Math.min(255, Math.max(0, Math.round(f * ((d[i + 1] ?? 0) - 128) + 128)));
      d[i + 2] = Math.min(255, Math.max(0, Math.round(f * ((d[i + 2] ?? 0) - 128) + 128)));
      // alpha unchanged
    }
    return this;
  }

  /** Materialise the current pipeline state into an ImageData object. */
  toImageData(): ImageData {
    return new ImageData(new Uint8ClampedArray(this.data), this.width, this.height);
  }

  /** Materialise the current pipeline state into an HTMLCanvasElement. */
  toCanvas(): HTMLCanvasElement {
    const canvas = document.createElement("canvas");
    canvas.width = this.width;
    canvas.height = this.height;
    canvas.getContext("2d")!.putImageData(this.toImageData(), 0, 0);
    return canvas;
  }
}
