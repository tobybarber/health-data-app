import { createWorker } from 'tesseract.js';
import sharp from 'sharp';

/**
 * Recognize text from an image or PDF using Tesseract OCR
 * @param imageBuffer The buffer containing the image data
 * @param language Optional language parameter (default: 'eng')
 * @returns The recognized text
 */
export async function recognizeText(
  imageBuffer: Buffer | Blob,
  language: string = 'eng'
): Promise<string> {
  try {
    console.log('🔍 Starting Tesseract OCR text recognition');
    
    // Set path to Tesseract installation on Windows
    console.log('Platform:', process.platform);
    console.log('Using language:', language);
    
    // Create the worker without specific config - let tesseract.js handle defaults
    // This matches our successful test script approach
    const worker = await createWorker();
    
    // Convert imageBuffer to base64 string if it's a Buffer
    let imageSource;
    if (Buffer.isBuffer(imageBuffer)) {
      console.log('Processing Buffer of size:', imageBuffer.length);
      imageSource = Buffer.from(imageBuffer).toString('base64');
      // Add the data URL prefix if it's not already there
      if (!imageSource.startsWith('data:')) {
        const mimeType = 'image/jpeg'; // Default to JPEG, adjust if needed
        imageSource = `data:${mimeType};base64,${imageSource}`;
      }
    } else {
      console.log('Processing Blob');
      // If it's already a blob, pass it directly
      imageSource = imageBuffer;
    }
    
    // Recognize text from the image
    console.log('Recognizing text...');
    const { data } = await worker.recognize(imageSource);
    
    // Terminate the worker to free up resources
    console.log('Terminating Tesseract worker...');
    await worker.terminate();
    
    console.log('✅ Tesseract OCR text recognition completed');
    
    // If no text was recognized, return a helpful message
    if (!data.text || data.text.trim() === '') {
      return 'No text was recognized in the image. The image might be low quality, have unclear text, or contain no text at all.';
    }
    
    return data.text;
  } catch (error: any) {
    console.error('Error in Tesseract OCR text recognition:', error);
    
    // Add environment variables to error message for debugging
    const tessEnvVars = {
      TESSDATA_PREFIX: process.env.TESSDATA_PREFIX,
      PATH: process.env.PATH?.split(';').filter(p => p.toLowerCase().includes('tesseract')),
    };
    console.error('Tesseract environment variables:', tessEnvVars);
    
    // Check for specific error types to give more helpful messages
    if (error.message?.includes('Could not get memory')) {
      throw new Error(`Tesseract ran out of memory. Try with a smaller image or reduce the image resolution.`);
    } else if (error.message?.includes('Cannot find module')) {
      throw new Error(`Tesseract missing dependencies. Please ensure Tesseract is properly installed and configured.`);
    } else {
      throw new Error(`Tesseract OCR error: ${error.message}`);
    }
  }
}

/**
 * Preprocess an image for better OCR results using Sharp
 * @param imageBuffer The buffer containing the image data
 * @returns The preprocessed image as a Buffer
 */
export async function preprocessImage(imageBuffer: Buffer): Promise<Buffer> {
  try {
    console.log('🔧 Preprocessing image for OCR');
    
    // Get image metadata
    const metadata = await sharp(imageBuffer).metadata();
    console.log('Image metadata:', metadata);
    
    // Apply preprocessing steps:
    // 1. Convert to grayscale
    // 2. Increase contrast
    // 3. Apply thresholding (using threshold operation)
    // 4. Normalize image size if too large
    const processed = sharp(imageBuffer)
      .grayscale()
      .normalise()
      .threshold(128);
    
    // Resize if the image is very large
    if (metadata.width && metadata.width > 2000) {
      processed.resize(2000, null, { 
        fit: 'inside',
        withoutEnlargement: true
      });
    }
    
    // Get the processed image as a buffer
    const outputBuffer = await processed.toBuffer();
    
    console.log('✅ Image preprocessing completed, buffer size:', outputBuffer.length);
    
    return outputBuffer;
  } catch (error: any) {
    console.error('Error preprocessing image:', error);
    // If preprocessing fails, return the original image
    return imageBuffer;
  }
}

/**
 * Extract text from a PDF using Tesseract OCR
 * This function would need to:
 * 1. Convert PDF pages to images
 * 2. Process each image with Tesseract
 * 3. Combine the results
 * 
 * Note: This is a more complex operation and would require additional libraries.
 * For a complete implementation, pdf-poppler or pdf2image would be needed.
 * 
 * @param pdfBuffer The buffer containing the PDF data
 * @param language Optional language parameter (default: 'eng')
 * @returns The extracted text
 */
export async function extractTextFromPDF(
  pdfBuffer: Buffer,
  language: string = 'eng'
): Promise<string> {
  // This is a placeholder for PDF text extraction
  // In a real implementation, you would:
  // 1. Convert PDF pages to images
  // 2. Run OCR on each image
  // 3. Combine the results
  return "PDF text extraction with Tesseract not implemented in this test version";
} 