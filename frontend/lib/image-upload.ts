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

export function validateImageFile(file: File, maxBytes = MAX_IMAGE_UPLOAD_BYTES): string | undefined {
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
  if (file.size > maxBytes) return `Image is too large. Maximum allowed size is ${maxBytes / (1024 * 1024)} MB.`;
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

/** Upload original bytes: alpha, animation, colour and quality must remain intact. */
export async function prepareProductImageForUpload(file: File): Promise<File> {
  return file;
}

export const MAX_IMAGE_DIMENSION = 16384;
export const MAX_IMAGE_PIXELS = 40_000_000;
export const TRANSPARENCY_PREVIEW_STYLE = {
  backgroundColor: "#e2e8f0",
  backgroundImage: "conic-gradient(#94a3b8 25%, transparent 0 50%, #94a3b8 0 75%, transparent 0)",
  backgroundSize: "16px 16px",
};
