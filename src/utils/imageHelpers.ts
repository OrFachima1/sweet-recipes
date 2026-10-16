export async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function compressToWebP(
  dataUrl: string,
  maxW: number,
  maxH: number,
  quality: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxW / img.naturalWidth, maxH / img.naturalHeight);
      const w = Math.round(img.naturalWidth * scale);
      const h = Math.round(img.naturalHeight * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/webp', quality));
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}

export async function compressForRecipe(dataUrl: string): Promise<string> {
  return compressToWebP(dataUrl, 800, 600, 0.78);
}

export async function compressForCategory(dataUrl: string): Promise<string> {
  return compressToWebP(dataUrl, 500, 500, 0.78);
}

export async function compressImage(
  dataUrl: string,
  maxWidth = 1280,
  quality = 0.8
): Promise<string> {
  return compressToWebP(dataUrl, maxWidth, maxWidth, quality);
}

export function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
