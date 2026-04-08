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
        0.299 * (d[i] ?? 0) + 0.587 * (d[i + 1] ?? 0) + 0.114 * (d[i + 2] ?? 0),
      );
      d[i] = gray;
      d[i + 1] = gray;
      d[i + 2] = gray;
    }
    return this;
  }

  /**
   * Adjust contrast with an automatically derived midpoint.
   *
   * The brightness histogram of the current image is analysed and lightly
   * smoothed to find two dominant spikes — the most common dark tone and the
   * most common bright tone. The contrast pivot is then placed exactly halfway
   * between those two peaks, so the threshold adapts to the actual lighting
   * conditions of the image rather than assuming a fixed mid-grey.
   *
   * @param factor - Value in [-1, 1] matching Jimp's convention.
   *   Positive values increase contrast, negative values decrease it.
   */
  contrast(factor: number): this {
    const d = this.data;

    // ── 1. Build a brightness histogram ──────────────────────────────────────
    const histogram = new Uint32Array(256);
    for (let i = 0; i < d.length; i += 4) {
      const luma = Math.round(
        0.299 * (d[i] ?? 0) + 0.587 * (d[i + 1] ?? 0) + 0.114 * (d[i + 2] ?? 0),
      );
      histogram[luma] = (histogram[luma] ?? 0) + 1;
    }

    // ── 2. Smooth with a small box kernel to suppress noise spikes ───────────
    const smoothed = new Float32Array(256);
    const radius = 4;
    for (let b = 0; b < 256; b++) {
      let sum = 0;
      let count = 0;
      for (let k = -radius; k <= radius; k++) {
        const idx = b + k;
        if (idx >= 0 && idx < 256) {
          sum += histogram[idx] ?? 0;
          count++;
        }
      }
      smoothed[b] = sum / count;
    }

    // ── 3. Find the dominant peak in each half of the brightness range ────────
    // Use the mean brightness as the split point so the boundary adapts to the
    // actual tonality of the image (a dark scene splits at ~70, a bright scene
    // at ~180) rather than always assuming a neutral mid-grey at 128.
    let totalWeight = 0;
    let weightedSum = 0;
    for (let b = 0; b < 256; b++) {
      const w = smoothed[b] ?? 0;
      weightedSum += b * w;
      totalWeight += w;
    }
    const meanBrightness = totalWeight > 0 ? weightedSum / totalWeight : 128;

    let darkPeak = 0;
    let darkPeakVal = 0;
    for (let b = 0; b < meanBrightness; b++) {
      if ((smoothed[b] ?? 0) > darkPeakVal) {
        darkPeakVal = smoothed[b] ?? 0;
        darkPeak = b;
      }
    }

    let brightPeak = 255;
    let brightPeakVal = 0;
    for (let b = Math.ceil(meanBrightness); b < 256; b++) {
      if ((smoothed[b] ?? 0) > brightPeakVal) {
        brightPeakVal = smoothed[b] ?? 0;
        brightPeak = b;
      }
    }

    // ── 4. Midpoint = midway between the two dominant peaks ──────────────────
    const midpoint = Math.round(
      darkPeak +
        (brightPeak - darkPeak) *
          /**
           * slightly shift towards the dark side to avoid blowing out highlights, since
           * cards tend to have more important details in the dark areas (text, shadows)
           * 0.0 -> use dark peak as midpoint
           * 0.5 -> use exact midpoint between peaks
           * 1.0 -> use bright peak as midpoint
           */
          0.5,
    );

    // ── 5. Apply contrast stretched around the derived midpoint ─────────────
    //   f = (259 * (factor*255 + 255)) / (255 * (259 - factor*255))
    //   newVal = clamp(f * (val - midpoint) + midpoint)
    const f = (259 * (factor * 255 + 255)) / (255 * (259 - factor * 255));
    for (let i = 0; i < d.length; i += 4) {
      d[i] = Math.min(
        255,
        Math.max(0, Math.round(f * ((d[i] ?? 0) - midpoint) + midpoint)),
      );
      d[i + 1] = Math.min(
        255,
        Math.max(0, Math.round(f * ((d[i + 1] ?? 0) - midpoint) + midpoint)),
      );
      d[i + 2] = Math.min(
        255,
        Math.max(0, Math.round(f * ((d[i + 2] ?? 0) - midpoint) + midpoint)),
      );
      // alpha unchanged
    }
    return this;
  }

  /** Materialise the current pipeline state into an ImageData object. */
  toImageData(): ImageData {
    return new ImageData(
      new Uint8ClampedArray(this.data),
      this.width,
      this.height,
    );
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
