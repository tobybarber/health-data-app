/**
 * Determines if a file is an image based on its type
 * @param fileType The file type to check
 * @returns True if the file is an image, false otherwise
 */
export function isImageFile(fileType: string | undefined): boolean {
  if (!fileType) return false;
  return fileType.toLowerCase().includes('image') || 
         fileType.toLowerCase().includes('jpg') || 
         fileType.toLowerCase().includes('jpeg') || 
         fileType.toLowerCase().includes('png') || 
         fileType.toLowerCase().includes('webp') ||
         fileType.toLowerCase().includes('gif');
} 

/**
 * Extracts text from a PDF file using the file URL
 * This is a wrapper that will pass the PDF to OpenAI for processing
 * 
 * @param fileUrl The URL of the PDF file
 * @returns The extracted text
 */
export async function extractTextFromPdf(fileUrl: string): Promise<string> {
  console.log('📄 PDF file detected for text extraction:', fileUrl);
  
  try {
    // In this implementation, we'll return an empty string as the actual
    // text extraction is handled by the OpenAI processing pipeline
    return ""; 
  } catch (error) {
    console.error('Error extracting text from PDF:', error);
    return "";
  }
}

/**
 * Performs OCR on an image file using the file URL
 * This is a wrapper that will pass the image to OpenAI for processing
 * 
 * @param fileUrl The URL of the image file
 * @returns The extracted text
 */
export async function performOCR(fileUrl: string): Promise<string> {
  console.log('🖼️ Image file detected for OCR:', fileUrl);
  
  try {
    // In this implementation, we'll return an empty string as the actual
    // OCR is handled by the OpenAI processing pipeline
    return "";
  } catch (error) {
    console.error('Error performing OCR:', error);
    return "";
  }
} 