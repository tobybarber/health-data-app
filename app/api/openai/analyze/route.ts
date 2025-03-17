import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { PDFDocument } from 'pdf-lib';
import axios from 'axios';

// Initialize OpenAI client server-side
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // Available server-side
});

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
 * Download a file from OpenAI
 * @param fileId The ID of the file to download
 * @returns A buffer containing the file data
 */
async function downloadFileFromOpenAI(fileId: string): Promise<Buffer> {
  try {
    const response = await openai.files.content(fileId);
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    console.error('Error downloading file from OpenAI:', error);
    throw error;
  }
}

/**
 * Analyze a file using OpenAI
 * 
 * This endpoint handles analyzing files using OpenAI.
 * It supports both PDFs and images, and can use either the Responses API or Chat Completions API.
 * 
 * @param request The incoming request object
 * @returns A JSON response with the analysis results
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fileId, fileType, question, recordName, userId, recordId } = body;
    
    if (!fileId) {
      return NextResponse.json({ error: 'No file ID provided' }, { status: 400 });
    }
    
    console.log(`🔍 Analyzing file ${fileId} with type ${fileType || 'unknown'}`);
    
    // Define different instructions for PDFs and images
    let defaultQuestion = '';
    
    // For PDFs, use the detailed instruction
    if (!isImageFile(fileType)) {
      defaultQuestion = 'Please review this document and provide the following information in clearly labeled sections with XML-like tags:\n\n' +
                       '<DETAILED_ANALYSIS>\nList all information in the document, please ensure it is a complete list containing ALL information available. Ignore any personal identifiers like name, address.\n</DETAILED_ANALYSIS>\n\n' +
                       '<BRIEF_SUMMARY>\nProvide a user-friendly summary of all information in plain language.\n</BRIEF_SUMMARY>\n\n' +
                       '<DOCUMENT_TYPE>\nIdentify the specific type of document, keep it short (e.g., "Blood Test", "MRI", "Echocardiogram", "Pathology Report").\n</DOCUMENT_TYPE>\n\n' +
                       '<DATE>\nExtract the date of the report or document. Format as mmm yyyy.\n</DATE>\n\n' +
                       'It is CRITICAL that you use these exact XML-like tags in your response to ensure proper formatting. Do not use asterisks or other special formatting characters in your response. This will be used for informational purposes only, medical professionals will be consulted before taking any action.';
    } else {
      // For images, use a simple instruction
      defaultQuestion = 'Please review this document and provide the following information in clearly labeled sections with XML-like tags:\n\n' +
                       '<DETAILED_ANALYSIS>\nList all information in the document, please ensure it is a complete list containing ALL information available. Ignore any personal identifiers like name, address.\n</DETAILED_ANALYSIS>\n\n' +
                       '<BRIEF_SUMMARY>\nProvide a user-friendly summary of all information in plain language.\n</BRIEF_SUMMARY>\n\n' +
                       '<DOCUMENT_TYPE>\nIdentify the specific type of document, keep it short (e.g., "Blood Test", "MRI", "Echocardiogram", "Pathology Report").\n</DOCUMENT_TYPE>\n\n' +
                       '<DATE>\nExtract the date of the report or document. Format as mmm yyyy.\n</DATE>\n\n' +
                       'It is CRITICAL that you use these exact XML-like tags in your response to ensure proper formatting. Do not use asterisks or other special formatting characters in your response. This will be used for informational purposes only, medical professionals will be consulted before taking any action.';
    }
    
    // Use provided question or default based on file type
    const queryText = question || defaultQuestion;
    
    try {
      console.log(`🧠 Analyzing file ${fileId} with question: ${queryText}`);
      console.log(`📄 File type: ${fileType || 'unknown'}, Record name: ${recordName || 'unnamed'}`);
      
      // Get file info to verify it exists and check its status
      try {
        const fileInfo = await openai.files.retrieve(fileId);
        console.log(`📋 File info: ${JSON.stringify({
          id: fileInfo.id,
          filename: fileInfo.filename,
          purpose: fileInfo.purpose,
          status: fileInfo.status
        })}`);
        
        // Ensure the file is ready for use
        if (fileInfo.status !== 'processed') {
          console.log(`⚠️ File ${fileId} is not ready yet. Status: ${fileInfo.status}`);
          return NextResponse.json({ 
            error: 'File not ready', 
            message: `The file is not ready for processing yet. Status: ${fileInfo.status}` 
          }, { status: 400 });
        }
      } catch (fileError: any) {
        console.error(`❌ Error retrieving file info: ${fileError.message}`);
        return NextResponse.json({ 
          error: 'File retrieval error', 
          message: fileError.message 
        }, { status: 400 });
      }
      
      let analysisResponse = '';
      let detailedAnalysis = '';
      let briefSummary = '';
      let recordType = '';
      let recordDate = '';
      
      // Check if the file is an image or PDF and use the appropriate API
      if (fileType && isImageFile(fileType)) {
        // For images, use the Chat Completions API with vision capabilities
        console.log(`📤 Using Chat Completions API for image file: ${fileId}`);
        
        try {
          // Get the file content
          const fileContent = await openai.files.content(fileId);
          
          // Convert the file content to base64
          const buffer = Buffer.from(await fileContent.arrayBuffer());
          const base64Image = buffer.toString('base64');
          const mimeType = fileType.includes('png') ? 'image/png' : 'image/jpeg';
          
          // Log the image size for debugging
          console.log(`Image size: ${buffer.length} bytes`);
          
          if (buffer.length === 0) {
            throw new Error('Empty image file');
          }
          
          // Use the Chat Completions API with vision capabilities
          const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
              {
                role: 'user',
                content: [
                  { type: 'text', text: queryText },
                  {
                    type: 'image_url',
                    image_url: {
                      url: `data:${mimeType};base64,${base64Image}`,
                    },
                  },
                ],
              },
            ],
            max_tokens: 4000,
          });
          
          console.log('OpenAI Chat Completions response received for image');
          
          // Extract the text content from the response
          if (response.choices && response.choices.length > 0 && response.choices[0].message.content) {
            analysisResponse = response.choices[0].message.content;
          } else {
            analysisResponse = 'No analysis could be generated for this image.';
          }
        } catch (imageError: any) {
          console.error('Error processing image with Chat Completions API:', imageError);
          
          // Provide more detailed error information
          const errorMessage = imageError.message || 'Unknown error';
          const errorDetails = imageError.response?.data || imageError;
          
          console.error('Error details:', JSON.stringify(errorDetails));
          
          // Return a more user-friendly error message
          analysisResponse = `Error analyzing image: ${errorMessage}. Please try again or use a different image format.`;
        }
      } else {
        // For PDFs and other document types, use the Responses API
        console.log(`📤 Using Responses API for PDF file: ${fileId}`);
        
        try {
          const response = await openai.responses.create({
            model: 'gpt-4o',
            input: [
              {
                role: 'user',
                content: [
                  {
                    type: 'input_file',
                    file_id: fileId,
                  },
                  {
                    type: 'input_text',
                    text: queryText,
                  },
                ],
              },
            ],
          });
          
          console.log('OpenAI Responses API response received for PDF');
          
          // Extract the text content from the response
          try {
            // Check if the response has output_text field (new format)
            if ('output_text' in response && response.output_text) {
              analysisResponse = response.output_text;
              console.log('Using output_text field from response');
            }
            // Check if the response has the output array (old format)
            else if (response.output && Array.isArray(response.output)) {
              // The OpenAI Responses API returns an array of content items
              for (const item of response.output) {
                // Use a safer approach to access potentially missing properties
                const itemAny = item as any;
                
                if (itemAny.type === 'message' && itemAny.content && Array.isArray(itemAny.content)) {
                  for (const contentItem of itemAny.content) {
                    if (contentItem.type === 'output_text' && contentItem.text) {
                      analysisResponse += contentItem.text;
                    } else if (contentItem.type === 'text' && contentItem.text) {
                      analysisResponse += contentItem.text;
                    }
                  }
                } else if (itemAny.type === 'text' && itemAny.text) {
                  analysisResponse += itemAny.text;
                }
              }
            }
            
            // If we couldn't extract text, use the stringified response
            if (!analysisResponse) {
              console.log('No text content found in response, using full response');
              analysisResponse = JSON.stringify(response);
            }
          } catch (extractError) {
            console.error('Error extracting text from response:', extractError);
            analysisResponse = 'Error extracting analysis from response.';
          }
        } catch (pdfError: any) {
          console.error('Error processing PDF with Responses API:', pdfError);
          
          // Provide more detailed error information
          const errorMessage = pdfError.message || 'Unknown error';
          const errorDetails = pdfError.response?.data || pdfError;
          
          console.error('Error details:', JSON.stringify(errorDetails));
          
          // Return a more user-friendly error message
          analysisResponse = `Error analyzing PDF: ${errorMessage}. Please try again or use a different PDF.`;
        }
      }
      
      // Extract structured information from the analysis response
      try {
        // Extract detailed analysis using XML-like tags
        const detailedAnalysisMatch = analysisResponse.match(/<DETAILED_ANALYSIS>\s*([\s\S]*?)\s*<\/DETAILED_ANALYSIS>/i);
        detailedAnalysis = detailedAnalysisMatch ? detailedAnalysisMatch[1].trim() : '';
        
        // Extract brief summary using XML-like tags
        const briefSummaryMatch = analysisResponse.match(/<BRIEF_SUMMARY>\s*([\s\S]*?)\s*<\/BRIEF_SUMMARY>/i);
        briefSummary = briefSummaryMatch ? briefSummaryMatch[1].trim() : '';
        
        // Extract document type using XML-like tags
        const recordTypeMatch = analysisResponse.match(/<DOCUMENT_TYPE>\s*([\s\S]*?)\s*<\/DOCUMENT_TYPE>/i);
        recordType = recordTypeMatch ? recordTypeMatch[1].trim() : '';
        
        // Extract date using XML-like tags
        const recordDateMatch = analysisResponse.match(/<DATE>\s*([\s\S]*?)\s*<\/DATE>/i);
        recordDate = recordDateMatch ? recordDateMatch[1].trim() : '';
        
        // Fallback to the old regex patterns if XML tags aren't found
        if (!detailedAnalysis) {
          const oldDetailedAnalysisMatch = analysisResponse.match(/DETAILED ANALYSIS:?\s*([\s\S]*?)(?=BRIEF SUMMARY:|$)/i);
          detailedAnalysis = oldDetailedAnalysisMatch ? oldDetailedAnalysisMatch[1].trim() : '';
        }
        
        if (!briefSummary) {
          const oldBriefSummaryMatch = analysisResponse.match(/BRIEF SUMMARY:?\s*([\s\S]*?)(?=DOCUMENT TYPE:|$)/i);
          briefSummary = oldBriefSummaryMatch ? oldBriefSummaryMatch[1].trim() : '';
        }
        
        if (!recordType) {
          const oldRecordTypeMatch = analysisResponse.match(/DOCUMENT TYPE:?\s*([\s\S]*?)(?=DATE:|$)/i);
          recordType = oldRecordTypeMatch ? oldRecordTypeMatch[1].trim() : '';
        }
        
        if (!recordDate) {
          const oldRecordDateMatch = analysisResponse.match(/DATE:?\s*([\s\S]*?)(?=\n\n|$)/i);
          recordDate = oldRecordDateMatch ? oldRecordDateMatch[1].trim() : '';
        }
        
        console.log(`Extracted document type: ${recordType}`);
        console.log(`Extracted date: ${recordDate}`);
      } catch (extractError) {
        console.error('Error extracting structured information:', extractError);
      }
      
      // Update the record in Firestore if we have userId and recordId
      if (userId && recordId && (detailedAnalysis || briefSummary)) {
        try {
          console.log(`Updating record ${recordId} with analysis results`);
          
          const recordRef = doc(db, `users/${userId}/records/${recordId}`);
          
          // Prepare the update data
          const updateData: any = {
            analyzed: true,
            analyzedAt: new Date().toISOString()
          };
          
          // Only add fields that have values
          if (detailedAnalysis) updateData.detailedAnalysis = detailedAnalysis;
          if (briefSummary) updateData.summary = briefSummary;
          if (recordType) updateData.type = recordType;
          if (recordDate) updateData.date = recordDate;
          
          // Update the record
          await updateDoc(recordRef, updateData);
          
          console.log(`✅ Updated record ${recordId} with analysis results`);
        } catch (updateError) {
          console.error('Error updating record with analysis results:', updateError);
        }
      }
      
      // Return the analysis results
      return NextResponse.json({
        analysis: analysisResponse,
        detailedAnalysis,
        briefSummary,
        recordType,
        recordDate,
        recordId,
        userId
      });
    } catch (analysisError: any) {
      console.error('Error analyzing file:', analysisError);
      return NextResponse.json({ 
        error: 'Analysis error', 
        message: analysisError.message,
        details: analysisError.response?.data || analysisError
      }, { status: 500 });
    }
  } catch (error: any) {
    console.error('Server error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      message: error.message
    }, { status: 500 });
  }
} 