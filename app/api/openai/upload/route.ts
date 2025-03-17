import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { existsSync, mkdirSync, createReadStream, unlinkSync, statSync } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import { PDFDocument } from 'pdf-lib';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';

// Initialize OpenAI client server-side
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // Available server-side
});

// Set up temporary file storage
const tempDir = join(process.cwd(), 'tmp');
if (!existsSync(tempDir)) {
  mkdirSync(tempDir, { recursive: true });
}

/**
 * Get the number of pages in a PDF file
 * @param buffer The PDF file buffer
 * @returns The number of pages in the PDF
 */
async function getPdfPageCount(buffer: Buffer): Promise<number> {
  try {
    const pdfDoc = await PDFDocument.load(buffer);
    return pdfDoc.getPageCount();
  } catch (error) {
    console.error('Error getting PDF page count:', error);
    return 1; // Default to 1 page if we can't determine the count
  }
}

/**
 * Determine if a file is an image based on its MIME type
 * @param fileType The MIME type of the file
 * @returns True if the file is an image, false otherwise
 */
function isImageFile(fileType: string | undefined): boolean {
  if (!fileType) return false;
  return fileType.toLowerCase().includes('image') || 
         fileType.toLowerCase().includes('jpg') || 
         fileType.toLowerCase().includes('jpeg') || 
         fileType.toLowerCase().includes('png') || 
         fileType.toLowerCase().includes('webp') ||
         fileType.toLowerCase().includes('gif');
}

/**
 * Determine if a file is a PDF based on its MIME type
 * @param fileType The MIME type of the file
 * @returns True if the file is a PDF, false otherwise
 */
function isPdfFile(fileType: string | undefined): boolean {
  if (!fileType) return false;
  return fileType.toLowerCase().includes('pdf') || 
         fileType.toLowerCase().includes('application/pdf');
}

/**
 * Upload a file to OpenAI
 * 
 * This endpoint handles uploading files to OpenAI.
 * It supports both direct file uploads and uploads from URLs.
 * 
 * @param request The incoming request object
 * @returns A JSON response with the uploaded file ID and metadata
 */
export async function POST(request: NextRequest) {
  try {
    // Handle both multipart form data and JSON requests
    let fileUrl, fileName, fileType, userId, recordId, fileBuffer;
    
    // Check if the request is multipart form data
    if (request.headers.get('content-type')?.includes('multipart/form-data')) {
      // Handle direct file upload
      const formData = await request.formData();
      const file = formData.get('file') as File;
      
      if (!file) {
        return NextResponse.json({ error: 'No file provided' }, { status: 400 });
      }
      
      // Get file metadata from form data
      fileName = file.name;
      fileType = file.type;
      userId = formData.get('userId') as string;
      recordId = formData.get('recordId') as string;
      
      // Convert file to buffer
      fileBuffer = Buffer.from(await file.arrayBuffer());
      
      console.log(`Processing direct file upload: ${fileName} (${fileType})`);
    } else {
      // Handle JSON request with file URL
      const body = await request.json();
      fileUrl = body.fileUrl;
      fileName = body.fileName;
      fileType = body.fileType;
      userId = body.userId;
      recordId = body.recordId;
      
      if (!fileUrl) {
        return NextResponse.json({ error: 'No file URL provided' }, { status: 400 });
      }
      
      console.log(`Processing file from URL: ${fileName || 'unnamed'} (${fileType || 'unknown type'})`);
      
      // Download the file from URL
      console.log(`Downloading file from ${fileUrl}`);
      
      try {
        // Add headers to the request to ensure we get the correct content type
        const response = await axios.get(fileUrl, { 
          responseType: 'arraybuffer',
          headers: {
            'Accept': fileType || '*/*'
          },
          timeout: 30000 // 30 second timeout
        });
        
        // Log the content type to verify we're getting the right file type
        console.log(`Downloaded file content type: ${response.headers['content-type']}`);
        console.log(`Downloaded file size: ${response.data.length} bytes`);
        
        fileBuffer = Buffer.from(response.data);
        
        // Use content type from response if not provided
        if (!fileType) {
          fileType = response.headers['content-type'];
        }
      } catch (downloadError: any) {
        console.error('Error downloading file:', downloadError);
        
        // Return detailed error information
        return NextResponse.json({ 
          error: 'File download error', 
          message: downloadError.message,
          details: downloadError.response?.data || downloadError
        }, { status: 500 });
      }
    }
    
    // Validate file buffer
    if (!fileBuffer || fileBuffer.length === 0) {
      return NextResponse.json({ 
        error: 'Empty file', 
        message: 'The file is empty' 
      }, { status: 400 });
    }
    
    console.log(`User ID: ${userId || 'not provided'}, Record ID: ${recordId || 'not provided'}`);
    
    // Generate a unique filename with appropriate extension
    const fileExtension = fileName ? fileName.split('.').pop() || '' : '';
    const safeFileName = fileName || 'document';
    const fileNameWithExt = safeFileName.endsWith(`.${fileExtension}`) ? safeFileName : `${safeFileName}.${fileExtension || 'bin'}`;
    const tempFilePath = join(tempDir, `${uuidv4()}-${fileNameWithExt}`);
    
    await writeFile(tempFilePath, fileBuffer);
    console.log(`Saved temporary file to ${tempFilePath}`);
    
    // If this is a PDF file and we have userId and recordId, get the page count and update the record
    let pageCount = 1;
    if (isPdfFile(fileType) && userId && recordId) {
      try {
        console.log(`📄 PDF file detected: ${fileNameWithExt}`);
        console.log(`📄 File type: ${fileType}`);
        console.log(`📄 Buffer size: ${fileBuffer.length} bytes`);
        
        // Try to load the PDF and get page count
        console.log(`📄 Attempting to load PDF with pdf-lib...`);
        const pdfDoc = await PDFDocument.load(fileBuffer);
        pageCount = pdfDoc.getPageCount();
        console.log(`📄 PDF page count calculated: ${pageCount}`);
        
        // Update the record with the page count
        if (pageCount > 0) {
          console.log(`📄 Updating Firestore record ${recordId} with page count: ${pageCount}`);
          const recordRef = doc(db, `users/${userId}/records/${recordId}`);
          await updateDoc(recordRef, {
            fileCount: pageCount
          });
          console.log(`✅ Updated record ${recordId} with page count: ${pageCount}`);
        } else {
          console.log(`⚠️ Invalid page count: ${pageCount}, not updating Firestore`);
        }
      } catch (pageCountError) {
        console.error('❌ Error getting PDF page count:', pageCountError);
        
        // Try alternative method using regex
        try {
          console.log(`📄 Attempting alternative page count method using regex...`);
          const pdfText = fileBuffer.toString('binary');
          const pageMatches = pdfText.match(/\/Type[\s]*\/Page[^s]/g);
          if (pageMatches && pageMatches.length > 0) {
            pageCount = pageMatches.length;
            console.log(`📄 Alternative PDF page count: ${pageCount}`);
            
            // Update the record with the page count
            if (pageCount > 0) {
              console.log(`📄 Updating Firestore record ${recordId} with alternative page count: ${pageCount}`);
              const recordRef = doc(db, `users/${userId}/records/${recordId}`);
              await updateDoc(recordRef, {
                fileCount: pageCount
              });
              console.log(`✅ Updated record ${recordId} with alternative page count: ${pageCount}`);
            }
          } else {
            console.log(`⚠️ Alternative method failed to find page markers`);
          }
        } catch (alternativeError) {
          console.error('❌ Alternative page count method failed:', alternativeError);
        }
      }
    } else {
      console.log(`📄 Not a PDF file or missing userId/recordId. File type: ${fileType}, userId: ${userId ? 'provided' : 'missing'}, recordId: ${recordId ? 'provided' : 'missing'}`);
    }
    
    try {
      // Verify the file exists and has content
      const stats = statSync(tempFilePath);
      console.log(`Temporary file size: ${stats.size} bytes`);
      
      if (stats.size === 0) {
        return NextResponse.json({ 
          error: 'Empty file', 
          message: 'The saved temporary file is empty' 
        }, { status: 400 });
      }
      
      // Upload to OpenAI
      const uploadResponse = await openai.files.create({
        file: createReadStream(tempFilePath),
        purpose: isImageFile(fileType) ? 'vision' : 'assistants',
      });
      
      console.log('OpenAI upload response:', uploadResponse);
      console.log(`File uploaded with purpose: ${isImageFile(fileType) ? 'vision' : 'assistants'}`);
      
      // Return the file ID and metadata
      return NextResponse.json({ 
        id: uploadResponse.id,
        filename: fileName || 'document',
        fileType: fileType,
        purpose: isImageFile(fileType) ? 'vision' : 'assistants',
        status: uploadResponse.status,
        userId: userId,
        recordId: recordId,
        pageCount: pageCount
      });
    } catch (openaiError: any) {
      console.error('OpenAI API error:', openaiError);
      
      // Return detailed error information
      return NextResponse.json({ 
        error: 'OpenAI API error', 
        message: openaiError.message,
        details: openaiError.response?.data || openaiError
      }, { status: 500 });
    } finally {
      // Clean up the temporary file
      try {
        unlinkSync(tempFilePath);
        console.log(`Deleted temporary file: ${tempFilePath}`);
      } catch (cleanupError) {
        console.error('Error cleaning up temporary file:', cleanupError);
      }
    }
  } catch (error: any) {
    console.error('Server error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      message: error.message
    }, { status: 500 });
  }
} 