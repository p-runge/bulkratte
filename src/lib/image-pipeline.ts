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
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
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
   * Smooth the image with a fast separable Gaussian blur (binomial kernel).
   * Applied after greyscale and before contrast so sensor noise is averaged
   * out before the contrast step amplifies it.
   *
   * Uses the [1/4, 1/2, 1/4] binomial kernel in two 1-D passes (horizontal
   * then vertical) per repetition — O(n) cost regardless of radius.
   *
   * @param radius - Number of blur passes. 1 = mild smoothing (recommended).
   */
  blur(radius = 1): this {
    const w = this.width;
    const h = this.height;
    const d = this.data;
    const tmp = new Uint8ClampedArray(d.length);

    for (let pass = 0; pass < radius; pass++) {
      // Horizontal pass: d → tmp
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4;
          for (let c = 0; c < 3; c++) {
            const l =
              x > 0 ? (d[(y * w + x - 1) * 4 + c] ?? 0) : (d[i + c] ?? 0);
            const m = d[i + c] ?? 0;
            const r =
              x < w - 1 ? (d[(y * w + x + 1) * 4 + c] ?? 0) : (d[i + c] ?? 0);
            tmp[i + c] = Math.round(0.25 * l + 0.5 * m + 0.25 * r);
          }
          tmp[i + 3] = d[i + 3] ?? 255; // alpha unchanged
        }
      }
      // Vertical pass: tmp → d
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4;
          for (let c = 0; c < 3; c++) {
            const u =
              y > 0 ? (tmp[((y - 1) * w + x) * 4 + c] ?? 0) : (tmp[i + c] ?? 0);
            const m = tmp[i + c] ?? 0;
            const dv =
              y < h - 1
                ? (tmp[((y + 1) * w + x) * 4 + c] ?? 0)
                : (tmp[i + c] ?? 0);
            d[i + c] = Math.round(0.25 * u + 0.5 * m + 0.25 * dv);
          }
          d[i + 3] = tmp[i + 3] ?? 255; // alpha unchanged
        }
      }
    }
    return this;
  }

  /**
   * Sharpen the image using an unsharp mask.
   *
   * A Gaussian-blurred copy is subtracted from the original and the
   * difference is added back scaled by `amount`:
   *   result = clamp(pixel + amount × (pixel − blurred))
   *
   * Best applied *after* `.blur()` so the denoising pass removes sensor
   * noise first and the sharpening step only enhances genuine ink edges.
   *
   * @param amount - Sharpening strength. 1.0 = moderate, 1.5 = strong.
   *   Values above 2.5 risk introducing visible halos around strokes.
   */
  sharpen(amount = 1.0): this {
    const w = this.width;
    const h = this.height;
    const d = this.data;

    // Build a blurred copy using one separable Gaussian pass
    const tmp = new Uint8ClampedArray(d.length);
    const blurred = new Uint8ClampedArray(d.length);

    // Horizontal pass: d → tmp
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        for (let c = 0; c < 3; c++) {
          const l = x > 0 ? (d[(y * w + x - 1) * 4 + c] ?? 0) : (d[i + c] ?? 0);
          const m = d[i + c] ?? 0;
          const r =
            x < w - 1 ? (d[(y * w + x + 1) * 4 + c] ?? 0) : (d[i + c] ?? 0);
          tmp[i + c] = Math.round(0.25 * l + 0.5 * m + 0.25 * r);
        }
        tmp[i + 3] = d[i + 3] ?? 255;
      }
    }
    // Vertical pass: tmp → blurred
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        for (let c = 0; c < 3; c++) {
          const u =
            y > 0 ? (tmp[((y - 1) * w + x) * 4 + c] ?? 0) : (tmp[i + c] ?? 0);
          const m = tmp[i + c] ?? 0;
          const dv =
            y < h - 1
              ? (tmp[((y + 1) * w + x) * 4 + c] ?? 0)
              : (tmp[i + c] ?? 0);
          blurred[i + c] = Math.round(0.25 * u + 0.5 * m + 0.25 * dv);
        }
        blurred[i + 3] = tmp[i + 3] ?? 255;
      }
    }

    // Apply unsharp mask: result = clamp(pixel + amount × (pixel − blurred))
    for (let i = 0; i < d.length; i += 4) {
      for (let c = 0; c < 3; c++) {
        const orig = d[i + c] ?? 0;
        const blur = blurred[i + c] ?? 0;
        d[i + c] = Math.min(
          255,
          Math.max(0, Math.round(orig + amount * (orig - blur))),
        );
      }
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
           * Shifts the contrast pivot between the two dominant tone peaks.
           * 0.0 -> use dark peak as midpoint (everything above ink goes white)
           * 0.5 -> exact midpoint between peaks (neutral)
           * 1.0 -> use bright peak as midpoint (only near-white stays white)
           *
           * For card number strips (black ink on cream/white card stock):
           * 0.35 pushes the pivot toward the ink peak so the cream background
           * is reliably above threshold and gets pushed fully white — sharper OCR.
           */
          0.35,
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
