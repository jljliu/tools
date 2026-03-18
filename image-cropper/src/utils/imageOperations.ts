import { type PixelCrop } from 'react-image-crop';

/**
 * Perform crop and resize using a hidden HTML Canvas
 *
 * @param image The loaded HTMLImageElement
 * @param crop The pixel crop dimension from react-image-crop
 * @param targetWidth The desired output width
 * @param targetHeight The desired output height
 */
export async function getCroppedResizedImage(
  image: HTMLImageElement,
  crop: PixelCrop,
  targetWidth: number,
  targetHeight: number
): Promise<Blob | null> {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('No 2d context');
  }

  // Set standard HTML canvas scaling to match target dimensions
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  // The coordinates and dimensions of the crop to take from the original image
  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;
  
  const sourceX = crop.x * scaleX;
  const sourceY = crop.y * scaleY;
  const sourceWidth = crop.width * scaleX;
  const sourceHeight = crop.height * scaleY;

  // Ensure high quality image scaling
  ctx.imageSmoothingQuality = 'high';

  // Draw the image onto the target canvas
  ctx.drawImage(
    image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    targetWidth,
    targetHeight
  );

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      resolve(blob);
    }, 'image/png');
  });
}

/**
 * Downloads a Blob as a file
 */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
