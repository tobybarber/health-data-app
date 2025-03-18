/**
 * Utility functions for preprocessing images before OCR
 * These functions are browser-compatible implementations of common image preprocessing techniques
 * based on the techniques mentioned in the Tesseract documentation.
 */

/**
 * Convert image data to grayscale using Canvas API
 * @param imageData The image data to convert
 * @returns Grayscale image data
 */
export function toGrayscale(imageData: ImageData): ImageData {
  const data = imageData.data;
  
  for (let i = 0; i < data.length; i += 4) {
    const grayscale = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    data[i] = grayscale;     // r
    data[i + 1] = grayscale; // g
    data[i + 2] = grayscale; // b
  }
  
  return imageData;
}

/**
 * Apply thresholding to image data using Canvas API
 * @param imageData The image data to threshold
 * @param threshold The threshold value (0-255)
 * @returns Thresholded image data
 */
export function threshold(imageData: ImageData, threshold: number = 128): ImageData {
  const data = imageData.data;
  
  for (let i = 0; i < data.length; i += 4) {
    const value = data[i] > threshold ? 255 : 0;
    data[i] = value;     // r
    data[i + 1] = value; // g
    data[i + 2] = value; // b
  }
  
  return imageData;
}

/**
 * Invert image colors
 * @param imageData The image data to invert
 * @returns Inverted image data
 */
export function invert(imageData: ImageData): ImageData {
  const data = imageData.data;
  
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 255 - data[i];         // r
    data[i + 1] = 255 - data[i + 1]; // g
    data[i + 2] = 255 - data[i + 2]; // b
  }
  
  return imageData;
}

/**
 * Preprocess an image for better OCR results (browser-compatible)
 * @param imageUrl The URL of the image to preprocess
 * @returns A promise that resolves to a preprocessed image as a Blob
 */
export async function preprocessImageInBrowser(imageUrl: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      // Create a canvas element
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }
      
      // Set canvas dimensions to match image
      canvas.width = img.width;
      canvas.height = img.height;
      
      // Draw the image on the canvas
      ctx.drawImage(img, 0, 0);
      
      // Get the image data
      let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      
      // Apply preprocessing steps
      imageData = toGrayscale(imageData);
      imageData = threshold(imageData, 128);
      
      // Put the processed image data back on the canvas
      ctx.putImageData(imageData, 0, 0);
      
      // Convert the canvas to a Blob
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Could not convert canvas to Blob'));
        }
      }, 'image/png');
    };
    
    img.onerror = () => {
      reject(new Error('Error loading image'));
    };
    
    img.src = imageUrl;
  });
}

/**
 * Determine if we should invert the image colors based on a heuristic
 * @param imageData The image data to check
 * @returns True if the image should be inverted
 */
export function shouldInvertImage(imageData: ImageData): boolean {
  const data = imageData.data;
  let darkPixels = 0;
  let totalPixels = data.length / 4;
  
  for (let i = 0; i < data.length; i += 4) {
    const grayscale = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    if (grayscale < 128) {
      darkPixels++;
    }
  }
  
  // If more than 60% of pixels are dark, invert the image
  return (darkPixels / totalPixels) > 0.6;
} 