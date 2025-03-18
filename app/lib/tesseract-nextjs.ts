import { createWorker } from 'tesseract.js';
import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * Next.js-compatible wrapper for Tesseract OCR
 * This function handles the worker path issues in Next.js environment
 * 
 * @param imageBuffer The buffer containing the image data
 * @param language Optional language parameter (default: 'eng')
 * @returns The recognized text
 */
export async function recognizeTextNextjs(
  imageBuffer: Buffer | Blob,
  language: string = 'eng'
): Promise<string> {
  try {
    console.log('🔍 Starting Tesseract OCR with Next.js compatibility wrapper');
    console.log('Platform:', process.platform);
    console.log('Using language:', language);
    
    // Ensure TESSDATA_PREFIX is set
    if (!process.env.TESSDATA_PREFIX) {
      console.log('Setting default TESSDATA_PREFIX');
      process.env.TESSDATA_PREFIX = 'C:\\Program Files\\Tesseract-OCR\\tessdata';
    }
    
    console.log('TESSDATA_PREFIX:', process.env.TESSDATA_PREFIX);
    
    // Create a worker with absolute minimal config to avoid DataCloneError
    try {
      // Create a simple worker with just the language parameter
      console.log('Creating simple worker with language:', language);
      const worker = await createWorker(language);
      
      // Process the image data
      let imageSource;
      if (Buffer.isBuffer(imageBuffer)) {
        console.log('Processing Buffer of size:', imageBuffer.length);
        
        // Convert to base64 data URL for the worker
        const base64 = imageBuffer.toString('base64');
        imageSource = `data:image/jpeg;base64,${base64}`;
      } else {
        console.log('Processing Blob');
        imageSource = imageBuffer;
      }
      
      // Recognize text
      console.log('Recognizing text...');
      const { data } = await worker.recognize(imageSource);
      
      // Clean up
      console.log('Terminating worker...');
      await worker.terminate();
      
      // Return the extracted text
      console.log('✅ Text extraction completed');
      return data.text || 'No text was recognized in the image.';
    } catch (workerError: any) {
      console.error('Failed to create worker or process image:', workerError);
      throw new Error(`Tesseract worker error: ${workerError.message}`);
    }
  } catch (error: any) {
    console.error('Error in Tesseract OCR:', error);
    throw new Error(`Tesseract OCR error: ${error.message}`);
  }
}

/**
 * Preprocess an image for better OCR results
 * @param imageBuffer The image buffer to preprocess
 * @returns A processed image buffer
 */
export async function preprocessImageForOcr(imageBuffer: Buffer): Promise<Buffer> {
  try {
    console.log('Preprocessing image for better OCR results');
    
    // Apply standard image preprocessing techniques
    const processedImage = await sharp(imageBuffer)
      .grayscale() // Convert to grayscale
      .normalize() // Normalize brightness and contrast
      .sharpen() // Sharpen edges
      .threshold(128) // Apply binary threshold
      .toBuffer();
    
    console.log('Image preprocessing completed');
    return processedImage;
  } catch (error) {
    console.error('Error preprocessing image:', error);
    // Return original image if preprocessing fails
    return imageBuffer;
  }
} 