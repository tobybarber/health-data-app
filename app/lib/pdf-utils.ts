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