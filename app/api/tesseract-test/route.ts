import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { db } from '../../lib/firebase-admin';
import { recognizeText, preprocessImage } from '../../lib/tesseract-utils';
import { recognizeTextNextjs, preprocessImageForOcr } from '../../lib/tesseract-nextjs';
import { PDFDocument } from 'pdf-lib';
import axios from 'axios';
import { promises as fs } from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import { promisify } from 'util';

const execPromise = promisify(exec);

// Initialize OpenAI client server-side
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // Available server-side
});

/**
 * Recognize text using the system-installed Tesseract executable
 * This is a fallback method that bypasses Tesseract.js entirely
 */
async function recognizeWithSystemTesseract(imageBuffer: Buffer): Promise<string> {
  try {
    console.log('🔧 Using system Tesseract as fallback');
    const tempDir = path.join(process.cwd(), 'tmp');
    
    // Ensure temp directory exists
    try {
      await fs.mkdir(tempDir, { recursive: true });
    } catch (err) {
      console.log('Temp directory already exists or could not be created');
    }
    
    // Generate unique filenames
    const tempImagePath = path.join(tempDir, `temp-${uuidv4()}.png`);
    const tempOutputPath = path.join(tempDir, `temp-${uuidv4()}.txt`);
    
    // Write image to temp file
    console.log(`Writing temporary image to ${tempImagePath}`);
    await fs.writeFile(tempImagePath, imageBuffer);
    
    // Execute Tesseract command
    const tesseractCmd = `"C:\\Program Files\\Tesseract-OCR\\tesseract.exe" "${tempImagePath}" "${tempOutputPath.replace('.txt', '')}" -l eng`;
    console.log(`Executing: ${tesseractCmd}`);
    
    await execPromise(tesseractCmd);
    
    // Read output file
    const outputText = await fs.readFile(`${tempOutputPath}`, 'utf8');
    console.log('Text extracted successfully with system Tesseract');
    
    // Clean up temp files
    try {
      await fs.unlink(tempImagePath);
      await fs.unlink(`${tempOutputPath}`);
    } catch (cleanupErr) {
      console.error('Error cleaning up temp files:', cleanupErr);
    }
    
    return outputText;
  } catch (error: any) {
    console.error('Error using system Tesseract:', error);
    throw new Error(`System Tesseract error: ${error.message}`);
  }
}

/**
 * Test route for processing files with Tesseract OCR
 * 
 * This route receives a file from OpenAI Files API, processes it with Tesseract OCR,
 * and then sends the extracted text to OpenAI Responses API for analysis.
 * 
 * @param request The incoming request object
 * @returns A JSON response with the analysis results
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🔍 Tesseract test route received a request');
    
    const body = await request.json();
    console.log('🔍 Request body:', body);
    
    const { fileId, fileType, userId, recordId } = body;
    
    console.log(`🧪 Testing Tesseract OCR on file ${fileId} (${fileType || 'unknown type'})`);
    
    if (!fileId) {
      console.log('No fileId provided in request');
      return NextResponse.json({ error: 'No file ID provided' }, { status: 400 });
    }
    
    // Verify that the file exists and is processed
    try {
      console.log(`🔍 Retrieving file info for ${fileId}`);
      const fileInfo = await openai.files.retrieve(fileId);
      console.log(`🔍 File status: ${fileInfo.status}`);
      
      if (fileInfo.status !== 'processed') {
        console.log(`File ${fileId} status: ${fileInfo.status} - not ready for processing`);
        return NextResponse.json({ 
          error: 'File not ready', 
          message: `The file is not ready for processing yet. Status: ${fileInfo.status}` 
        }, { status: 400 });
      }
    } catch (fileError: any) {
      console.error(`Error retrieving file info: ${fileError.message}`);
      return NextResponse.json({ 
        error: 'File retrieval error', 
        message: fileError.message
      }, { status: 400 });
    }
    
    // Download the file from OpenAI
    let fileBuffer: Buffer;
    try {
      console.log(`🔍 Downloading file content for ${fileId}`);
      const response = await openai.files.content(fileId);
      console.log('🔍 Response received from OpenAI Files API');
      
      const arrayBuffer = await response.arrayBuffer();
      console.log(`🔍 File size: ${arrayBuffer.byteLength} bytes`);
      
      fileBuffer = Buffer.from(arrayBuffer);
      console.log('✅ File successfully downloaded from OpenAI');
    } catch (downloadError: any) {
      console.error(`Error downloading file from OpenAI: ${downloadError.message}`);
      console.error(downloadError.stack || 'No stack trace available');
      return NextResponse.json({ 
        error: 'File download error', 
        message: downloadError.message
      }, { status: 500 });
    }
    
    // Process the file based on its type
    let extractedText = '';
    
    try {
      // For images, use Tesseract OCR directly
      if (fileType && fileType.toLowerCase().includes('image')) {
        console.log('Processing image file with Tesseract OCR');
        
        try {
          // Set TESSDATA_PREFIX for the Tesseract OCR process
          if (!process.env.TESSDATA_PREFIX) {
            console.log('Setting TESSDATA_PREFIX environment variable');
            process.env.TESSDATA_PREFIX = 'C:\\Program Files\\Tesseract-OCR\\tessdata';
          }
          
          console.log('TESSDATA_PREFIX:', process.env.TESSDATA_PREFIX);
          console.log('Platform:', process.platform);
          
          // Preprocess the image for better OCR results
          console.log('🔍 Preprocessing image');
          const processedImage = await preprocessImageForOcr(fileBuffer);
          console.log('✅ Image preprocessing completed');
          
          try {
            // Extract text from the image using our Next.js compatible Tesseract wrapper
            console.log('🔍 Starting Tesseract OCR text recognition with Next.js compatibility');
            extractedText = await recognizeTextNextjs(processedImage);
            console.log('✅ Tesseract OCR text recognition completed');
          } catch (nextjsError) {
            console.error('Error with Next.js compatible wrapper:', nextjsError);
            
            // Try original recognizeText as fallback
            console.log('Trying original recognizeText as fallback...');
            try {
              extractedText = await recognizeText(processedImage);
            } catch (originalError) {
              console.error('Error with original recognizeText:', originalError);
              
              // Last resort: use system-installed Tesseract directly
              console.log('Falling back to system Tesseract executable...');
              extractedText = await recognizeWithSystemTesseract(processedImage);
            }
          }
          
          console.log('Extracted text length:', extractedText.length);
        } catch (tesseractError: any) {
          console.error('Tesseract specific error:', tesseractError);
          console.error(tesseractError.stack || 'No stack trace available');
          
          // Provide more detailed error diagnostics
          if (tesseractError.message?.includes('Cannot find module')) {
            console.error('Worker module not found. This is likely a module resolution issue with tesseract.js in Next.js');
            console.error('Module path from error:', tesseractError.message.match(/'([^']+)'/)?.[1] || 'unknown');
            
            // Use system Tesseract as final fallback
            console.log('Attempting fallback to system Tesseract executable...');
            extractedText = await recognizeWithSystemTesseract(fileBuffer);
          } else {
            throw tesseractError;
          }
        }
      } 
      // For PDFs, we'd need to convert pages to images first (not implemented in this test)
      else if (fileType && fileType.toLowerCase().includes('pdf')) {
        console.log('PDF processing with Tesseract OCR not fully implemented in this test');
        extractedText = 'PDF processing with Tesseract OCR not fully implemented in this test. For a complete implementation, each page would need to be converted to an image first.';
      }
      else {
        console.log(`Unsupported file type: ${fileType}`);
        return NextResponse.json({ 
          error: 'Unsupported file type', 
          message: `File type ${fileType} is not supported for Tesseract OCR in this test` 
        }, { status: 400 });
      }
    } catch (ocrError: any) {
      console.error(`Error processing file with Tesseract OCR: ${ocrError.message}`);
      console.error(ocrError.stack || 'No stack trace available');
      return NextResponse.json({ 
        error: 'OCR processing error', 
        message: ocrError.message
      }, { status: 500 });
    }
    
    // If we didn't extract any text, return an error
    if (!extractedText.trim()) {
      console.log('No text extracted from the image');
      return NextResponse.json({ 
        error: 'No text extracted', 
        message: 'Tesseract OCR could not extract any text from the file' 
      }, { status: 400 });
    }
    
    console.log('✅ Text successfully extracted with Tesseract OCR');
    
    // Now send the extracted text to OpenAI Responses API for analysis
    try {
      console.log('Sending extracted text to OpenAI Responses API');
      
      // Define the analysis prompt
      const prompt = 'Please review this medical document and provide the following information in clearly labeled sections with XML-like tags:\n\n' +
                     '<DETAILED_ANALYSIS>\nList all information in the document, please ensure it is a complete list containing ALL information available. Ignore any personal identifiers like name, address.\n</DETAILED_ANALYSIS>\n\n' +
                     '<BRIEF_SUMMARY>\nProvide a user-friendly summary of all information in plain language.\n</BRIEF_SUMMARY>\n\n' +
                     '<DOCUMENT_TYPE>\nIdentify the specific type of document, keep it short (e.g., "Blood Test", "MRI", "Echocardiogram", "Pathology Report").\n</DOCUMENT_TYPE>\n\n' +
                     '<DATE>\nExtract the date of the report or document. Format as mmm yyyy.\n</DATE>\n\n' +
                     'It is CRITICAL that you use these exact XML-like tags in your response to ensure proper formatting.';
      
      // Call the OpenAI Responses API with the extracted text
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: 'You are a helpful assistant analyzing medical documents.' },
          { role: 'user', content: `${prompt}\n\nHere is the text extracted from the document using OCR:\n\n${extractedText}` }
        ],
        temperature: 0.1,
      });
      
      // Get the analysis result
      const analysisResult = response.choices[0].message.content || '';
      
      // Update the record in Firestore if userId and recordId are provided
      if (userId && recordId) {
        console.log(`Updating record ${recordId} with Tesseract OCR analysis`);
        
        try {
          await db.collection('users').doc(userId).collection('records').doc(recordId).update({
            tesseractOcrAnalysis: analysisResult,
            tesseractOcrExtractedText: extractedText,
            tesseractAnalyzedAt: new Date()
          });
        } catch (updateError: any) {
          console.error(`Error updating record: ${updateError.message}`);
          // Continue anyway, as this is just for storing the results
        }
      }
      
      // Return the results
      console.log('✅ Analysis completed successfully');
      return NextResponse.json({
        success: true,
        extractedText: extractedText,
        analysis: analysisResult
      });
      
    } catch (openaiError: any) {
      console.error(`Error calling OpenAI API: ${openaiError.message}`);
      console.error(openaiError.stack || 'No stack trace available');
      return NextResponse.json({ 
        error: 'OpenAI API error', 
        message: openaiError.message
      }, { status: 500 });
    }
    
  } catch (error: any) {
    console.error(`Unexpected error in tesseract-test route: ${error.message}`);
    console.error(error.stack || 'No stack trace available');
    return NextResponse.json({ 
      error: 'Unexpected error', 
      message: error.message 
    }, { status: 500 });
  }
} 