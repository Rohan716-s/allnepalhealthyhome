export const MAX_IMAGE_UPLOAD_BYTES = 8 * 1024 * 1024;

export const IMAGE_ACCEPT = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/bmp",
  "image/avif",
  "image/svg+xml",
].join(",");

const mimeByExtension: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  bmp: "image/bmp",
  avif: "image/avif",
  svg: "image/svg+xml",
};

const unsupportedExtensions = new Set(["tif", "tiff", "heic", "heif"]);

export function validateImageFile(file: File): string | undefined {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (unsupportedExtensions.has(extension)) {
    return "TIF/TIFF and HEIC/HEIF images are not supported by this uploader yet. Please use SVG, JPG, PNG, WebP, GIF, BMP, or AVIF.";
  }
  const expectedMime = mimeByExtension[extension];
  if (!expectedMime) {
    return "This image format is not supported. Use SVG, JPG, PNG, WebP, GIF, BMP, or AVIF.";
  }
  if (file.type && file.type !== expectedMime) {
    return "The file extension and image type do not match.";
  }
  if (file.size === 0) return "Please select an image.";
  if (file.size > MAX_IMAGE_UPLOAD_BYTES) return "Image is too large. Maximum allowed size is 8 MB.";
  return undefined;
}

export function formatImageSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function readImageDimensions(file: File): Promise<{ width: number; height: number } | undefined> {
  return new Promise(resolve => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(undefined);
    };
    image.src = url;
  });
}

/**
 * Product catalogue images are commonly supplied on a plain white background.
 * Remove only edge-connected background pixels when the four corners indicate
 * a reasonably uniform backdrop. Complex/lifestyle images are returned as-is
 * so the uploader never destroys a product photo by guessing its silhouette.
 */
export async function prepareProductImageForUpload(file: File): Promise<File> {
  if (typeof window === "undefined" || !file.type.startsWith("image/")) return file;

  const sourceUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("Image could not be decoded."));
      element.src = sourceUrl;
    });
    const width = image.naturalWidth;
    const height = image.naturalHeight;
    if (!width || !height) return file;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return file;
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, width, height);
    const { data } = pixels;
    const point = (x: number, y: number) => {
      const offset = (y * width + x) * 4;
      return [data[offset], data[offset + 1], data[offset + 2]] as const;
    };
    const corners = [point(0, 0), point(width - 1, 0), point(0, height - 1), point(width - 1, height - 1)];
    if (corners.some((_, index) => data[index * 4 + 3] < 250)) return file;
    const background = corners.reduce((sum, color) => sum.map((value, index) => value + color[index]) as [number, number, number], [0, 0, 0]).map(value => value / corners.length) as [number, number, number];
    const cornerSpread = Math.max(...corners.map(color => Math.hypot(color[0] - background[0], color[1] - background[1], color[2] - background[2])));
    if (cornerSpread > 58) return file;

    const pixelCount = width * height;
    const visited = new Uint8Array(pixelCount);
    const queue = new Int32Array(pixelCount);
    let head = 0;
    let tail = 0;
    const threshold = 62;
    const matchesBackground = (index: number) => {
      const offset = index * 4;
      return data[offset + 3] > 0 && Math.hypot(data[offset] - background[0], data[offset + 1] - background[1], data[offset + 2] - background[2]) <= threshold;
    };
    const add = (index: number) => {
      if (index < 0 || index >= pixelCount || visited[index] || !matchesBackground(index)) return;
      visited[index] = 1;
      queue[tail++] = index;
    };
    for (let x = 0; x < width; x += 1) { add(x); add((height - 1) * width + x); }
    for (let y = 1; y < height - 1; y += 1) { add(y * width); add(y * width + width - 1); }
    while (head < tail) {
      const index = queue[head++];
      const x = index % width;
      const y = Math.floor(index / width);
      if (x > 0) add(index - 1);
      if (x + 1 < width) add(index + 1);
      if (y > 0) add(index - width);
      if (y + 1 < height) add(index + width);
    }
    if (tail < Math.max(100, pixelCount * 0.02)) return file;
    for (let index = 0; index < pixelCount; index += 1) {
      if (visited[index]) data[index * 4 + 3] = 0;
    }
    context.putImageData(pixels, 0, 0);
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/png"));
    if (!blob) return file;
    const baseName = file.name.replace(/\.[^.]+$/, "") || "product-image";
    return new File([blob], `${baseName}.png`, { type: "image/png", lastModified: Date.now() });
  } catch {
    return file;
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}
