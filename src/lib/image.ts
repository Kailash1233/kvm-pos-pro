/**
 * Resizes a user-picked image to a small square JPEG and returns it as a
 * data: URL, so product photos stay compact inside the single SQLite file
 * (a few tens of KB each) instead of ballooning the database.
 */
export function readImageAsDataUrl(file: Blob, maxSize = 320, quality = 0.75): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("That image could not be read."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("That file doesn't look like an image."));
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Image processing is not available."));
          return;
        }
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Best-effort: downloads an image from a URL (e.g. a product-sheet column)
 * and resizes it the same way as a manual upload. Many image hosts don't
 * allow cross-origin reads, so this is expected to fail for some URLs -
 * callers should treat a rejection as "add the photo manually" rather than
 * a hard error.
 */
export async function fetchImageAsDataUrl(
  url: string,
  maxSize = 320,
  quality = 0.75,
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`Could not download the image (HTTP ${res.status}).`);
    const blob = await res.blob();
    return readImageAsDataUrl(blob, maxSize, quality);
  } finally {
    clearTimeout(timer);
  }
}
