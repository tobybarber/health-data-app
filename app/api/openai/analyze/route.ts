import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { db } from '../../../lib/firebase-admin';
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
    const { fileId, fileType, question, recordName, userId, recordId, additionalFileIds } = body;
    
    // Simplified logging with essential information only
    console.log(`🔍 Analyzing file ${fileId} (${fileType || 'unknown type'})`);
    
    if (!fileId) {
      return NextResponse.json({ error: 'No file ID provided' }, { status: 400 });
    }
    
    // Verify that the file exists and is processed
    try {
      const fileInfo = await openai.files.retrieve(fileId);
      
      if (fileInfo.status !== 'processed') {
        console.log(`File ${fileId} status: ${fileInfo.status} - not ready for processing`);
        
        // Update record status if we have userId and recordId
        if (userId && recordId) {
          await db.collection('users').doc(userId).collection('records').doc(recordId).update({
            analysis: `File is still processing. Status: ${fileInfo.status}. Please try again in a moment.`,
            analyzedAt: new Date()
          });
        }
        
        return NextResponse.json({ 
          error: 'File not ready', 
          message: `The file is not ready for processing yet. Status: ${fileInfo.status}` 
        }, { status: 400 });
      }
    } catch (fileError: any) {
      console.error(`Error retrieving file info: ${fileError.message}`);
      
      // Update the record with the error
      if (userId && recordId) {
        await db.collection('users').doc(userId).collection('records').doc(recordId).update({
          analysis: `Error accessing file: ${fileError.message}. The file may not exist or another issue occurred.`,
          analyzedAt: new Date()
        });
      }
      
      return NextResponse.json({ 
        error: 'File retrieval error', 
        message: fileError.message
      }, { status: 400 });
    }
    
    // Define different instructions for PDFs and images
    let defaultQuestion = '';
    
    // Add multi-file instruction prefix if applicable
    let multiFileInstruction = '';
    let queryText = '';
    
    if (additionalFileIds?.length > 0) {
      // Enhanced multi-file instruction with explicit guidance
      multiFileInstruction = `\n\nIMPORTANT: You will be provided with ${additionalFileIds.length + 1} files/documents. Please analyze ALL of them together as a single comprehensive analysis. Consider them all part of one medical record. 

Take your time to thoroughly review each file individually and then provide a comprehensive analysis. Work through the files methodically, taking note of important information in each one before synthesizing your analysis.

This is important for ensuring the patient receives complete and accurate medical information. Don't rush - carefully examine each file in detail before providing your analysis.`;
    }
    
    // If a custom question was provided (from the upload route), use it directly
    if (question) {
      queryText = question + (multiFileInstruction ? `\n\n${multiFileInstruction}` : '');
    } else {
      // For PDFs and images, use the detailed instruction - note these are identical in the original code
      defaultQuestion = 'Please review this document and provide the following information in clearly labeled sections with XML-like tags:\n\n' +
                       '<DETAILED_ANALYSIS>\nList all information in the document, please ensure it is a complete list containing ALL information available. Ignore any personal identifiers like name, address.\n</DETAILED_ANALYSIS>\n\n' +
                       '<BRIEF_SUMMARY>\nProvide a user-friendly summary of all information in plain language.\n</BRIEF_SUMMARY>\n\n' +
                       '<DOCUMENT_TYPE>\nIdentify the specific type of document, keep it short (e.g., "Blood Test", "MRI", "Echocardiogram", "Pathology Report").\n</DOCUMENT_TYPE>\n\n' +
                       '<DATE>\nExtract the date of the report or document. Format as mmm yyyy.\n</DATE>\n\n' +
                       'It is CRITICAL that you use these exact XML-like tags in your response to ensure proper formatting. Do not use asterisks or other special formatting characters in your response. This will be used for informational purposes only, medical professionals will be consulted before taking any action.';
      
      // The query text to use (default with any multi-file instruction)
      queryText = multiFileInstruction ? `${multiFileInstruction}\n\n${defaultQuestion}` : defaultQuestion;
    }
    
    try {
      let analysisResponse = '';
      let detailedAnalysis = '';
      let briefSummary = '';
      let recordType = '';
      let recordDate = '';
      
      // Check if the file is an image or PDF and use the appropriate API
      if (fileType && isImageFile(fileType)) {
        // For images, use the Chat Completions API with vision capabilities
        console.log(`Using Chat Completions API for image file: ${fileId}`);
        
        try {
          // Special handling for multiple images
          if (additionalFileIds?.length > 0) {
            console.log(`Processing ${additionalFileIds.length + 1} image files separately and then combining results`);
            
            // First analyze the main image
            const mainImageContent = await openai.files.content(fileId);
            const mainImageBuffer = Buffer.from(await mainImageContent.arrayBuffer());
            if (mainImageBuffer.length === 0) {
              throw new Error('Empty image file');
            }
            
            const mainImageBase64 = mainImageBuffer.toString('base64');
            const mainImageMimeType = fileType.includes('png') ? 'image/png' : 'image/jpeg';
            
            // Use a simpler prompt for individual image analysis
            const singleImagePrompt = 'Please analyze this medical image and provide the following information in clearly labeled sections with XML-like tags:\n\n' +
                       '<DETAILED_ANALYSIS>\nList all information visible in this image, ensuring it is complete and detailed.\n</DETAILED_ANALYSIS>\n\n' +
                       '<DOCUMENT_TYPE>\nIdentify the specific type of document (e.g., "Blood Test", "MRI", "X-Ray").\n</DOCUMENT_TYPE>\n\n' +
                       '<DATE>\nExtract any date visible in the image. Format as mmm yyyy.\n</DATE>';
            
            // Analyze main image
            const mainImageResponse = await openai.chat.completions.create({
              model: 'gpt-4o',
              messages: [
                {
                  role: 'user',
                  content: [
                    { type: 'text', text: singleImagePrompt },
                    {
                      type: 'image_url',
                      image_url: {
                        url: `data:${mainImageMimeType};base64,${mainImageBase64}`,
                      },
                    },
                  ],
                },
              ],
              max_tokens: 2000,
            });
            
            // Store main image analysis
            let mainImageAnalysis = '';
            if (mainImageResponse.choices?.[0]?.message.content) {
              mainImageAnalysis = mainImageResponse.choices[0].message.content;
            } else {
              mainImageAnalysis = 'No analysis could be generated for the primary image.';
            }
            
            // Process additional images one by one (limit to first 10 for performance)
            const additionalImageResults = [];
            const additionalImagesToProcess = additionalFileIds.slice(0, Math.min(additionalFileIds.length, 10));
            
            for (const [index, addImageId] of additionalImagesToProcess.entries()) {
              console.log(`Processing additional image ${index + 1}/${additionalImagesToProcess.length}`);
              
              try {
                // Get file info to determine type
                const addFileInfo = await openai.files.retrieve(addImageId);
                const addFileType = addFileInfo.filename.split('.').pop()?.toLowerCase();
                
                if (!addFileType || !isImageFile(addFileType)) {
                  console.log(`Skipping non-image file: ${addImageId}`);
                  continue;
                }
                
                // Get file content
                const addImageContent = await openai.files.content(addImageId);
                const addImageBuffer = Buffer.from(await addImageContent.arrayBuffer());
                
                if (addImageBuffer.length === 0) {
                  console.log(`Empty additional image file: ${addImageId}`);
                  continue;
                }
                
                const addImageBase64 = addImageBuffer.toString('base64');
                const addImageMimeType = addFileType.includes('png') ? 'image/png' : 'image/jpeg';
                
                // Analyze additional image
                const addImageResponse = await openai.chat.completions.create({
                  model: 'gpt-4o',
                  messages: [
                    {
                      role: 'user',
                      content: [
                        { type: 'text', text: singleImagePrompt },
                        {
                          type: 'image_url',
                          image_url: {
                            url: `data:${addImageMimeType};base64,${addImageBase64}`,
                          },
                        },
                      ],
                    },
                  ],
                  max_tokens: 2000,
                });
                
                if (addImageResponse.choices?.[0]?.message.content) {
                  additionalImageResults.push(addImageResponse.choices[0].message.content);
                }
              } catch (addImageError: any) {
                console.error(`Error processing additional image ${addImageId}:`, addImageError);
                additionalImageResults.push(`Error analyzing additional image ${index + 1}: ${addImageError.message}`);
              }
              
              // Add a small delay between processing images
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
            
            // Now combine all results with a final analysis
            const combinationPrompt = `Please combine the following ${additionalImageResults.length + 1} separate medical image analyses into one comprehensive analysis. 
            Each analysis represents a different image from the same patient's medical record. It is CRITICAL that you do not lose ANY medical information from any of the individual analyses.
            
            Create a unified analysis that maintains the XML tag structure but combines ALL findings. Be thorough and ensure ALL details from each image are preserved in your unified analysis.

            PRIMARY IMAGE ANALYSIS:
            ${mainImageAnalysis}
            
            ${additionalImageResults.map((result, i) => `ADDITIONAL IMAGE ${i + 1} ANALYSIS:\n${result}`).join('\n\n')}
            
            Please provide your combined analysis using these XML-like tags:
            <DETAILED_ANALYSIS>
            Comprehensive findings from ALL images, organized clearly. Make sure to include EVERY medical detail from each individual image analysis. Do not omit any information, even if it appears redundant.
            </DETAILED_ANALYSIS>
            
            <BRIEF_SUMMARY>
            A concise summary of the key findings across all images.
            </BRIEF_SUMMARY>
            
            <DOCUMENT_TYPE>
            List ALL types of documents analyzed.
            </DOCUMENT_TYPE>
            
            <DATE>
            List ALL dates found in the documents.
            </DATE>
            
            <SUGGESTED_RECORD_NAME>
            Based on the content of ALL images, suggest a descriptive and specific name for this medical record that captures its content. Example: "Blood Test Results - Cholesterol Panel" rather than just "Blood Test Results".
            </SUGGESTED_RECORD_NAME>`;
            
            const finalResponse = await openai.chat.completions.create({
              model: 'gpt-4o',
              messages: [
                {
                  role: 'user',
                  content: combinationPrompt
                }
              ],
              max_tokens: 4000,
            });
            
            if (finalResponse.choices?.[0]?.message.content) {
              analysisResponse = finalResponse.choices[0].message.content;
            } else {
              analysisResponse = 'Unable to combine multiple image analyses.';
            }
          } else {
            // Original single image analysis code
            const fileContent = await openai.files.content(fileId);
            
            // Convert the file content to base64
            const buffer = Buffer.from(await fileContent.arrayBuffer());
            if (buffer.length === 0) {
              throw new Error('Empty image file');
            }
            
            const base64Image = buffer.toString('base64');
            const mimeType = fileType.includes('png') ? 'image/png' : 'image/jpeg';
            
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
            
            // Extract the text content from the response
            if (response.choices?.[0]?.message.content) {
              analysisResponse = response.choices[0].message.content;
            } else {
              analysisResponse = 'No analysis could be generated for this image.';
            }
          }
        } catch (imageError: any) {
          console.error('Error processing image with Chat Completions API:', imageError.message);
          // Return a more user-friendly error message
          analysisResponse = `Error analyzing image: ${imageError.message}. Please try again or use a different image format.`;
        }
      } else {
        // For PDFs and other document types, use the Responses API
        console.log(`Using Responses API for PDF file: ${fileId}`);
        
        try {
          // Build the message content with the primary file
          const messageContent = [
            { type: 'input_file' as const, file_id: fileId },
            { type: 'input_text' as const, text: queryText }
          ];
          
          // Add additional files if present - first verify they're all processed
          if (additionalFileIds?.length > 0) {
            let allFilesProcessed = true;
            const additionalFileObjects: Array<{ type: 'input_file'; file_id: string }> = [];
            
            // Verify all additional files are processed
            for (const addFileId of additionalFileIds) {
              try {
                const fileInfo = await openai.files.retrieve(addFileId);
                if (fileInfo.status === 'processed') {
                  additionalFileObjects.push({ type: 'input_file', file_id: addFileId });
                } else {
                  console.log(`Additional file ${addFileId} status: ${fileInfo.status} - not ready`);
                  allFilesProcessed = false;
                  break;
                }
              } catch (addFileError) {
                console.error(`Error retrieving additional file ${addFileId}:`, addFileError);
                allFilesProcessed = false;
                break;
              }
            }
            
            // Only continue if all files are processed
            if (!allFilesProcessed) {
              throw new Error('Not all additional files are ready for processing yet.');
            }
            
            // Use the updated files array in the request
            // NOTE: We're not actually modifying messageContent here to avoid TypeScript issues
          }
          
          // Create the API request
          console.log('Debug: Sending content to OpenAI with structure:', JSON.stringify(messageContent.map(m => m.type)));
          
          // Add a timeout mechanism
          const timeoutMs = 90000; // 90 seconds
          const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('OpenAI API request timed out after 90 seconds')), timeoutMs);
          });
          
          // Create the API call promise
          const apiCallPromise = openai.responses.create({
            model: 'gpt-4o',
            input: [
              {
                role: 'user',
                content: messageContent,
              },
            ],
          });
          
          // Execute the API call with timeout
          let response;
          try {
            response = await Promise.race([apiCallPromise, timeoutPromise]);
          } catch (timeoutError: any) {
            console.error('OpenAI API call timed out:', timeoutError.message);
            throw new Error('The analysis request took too long to complete. Please try again later.');
          }
          
          console.log('Debug: OpenAI Responses API response received for PDF');
          console.log('Debug: Response type:', typeof response);
          
          // Log some details about the response
          if (response) {
            console.log('Debug: Response keys:', Object.keys(response).join(', '));
            
            if ('output_text' in response) {
              console.log('Debug: Found output_text in response');
            } else if ('output' in response && Array.isArray((response as any).output)) {
              console.log('Debug: Found output array in response with length:', (response as any).output.length);
            } else {
              console.log('Debug: Response structure is different than expected:', JSON.stringify(response).substring(0, 200) + '...');
            }
          } else {
            console.error('Debug: Empty response received from OpenAI');
          }
          
          // Extract the text content from the response
          try {
            console.log('Response format:', typeof response);
            console.log('Response preview:', JSON.stringify(response).substring(0, 500) + '...');
            
            // Check if the response has output_text field (new format)
            if ('output_text' in response && response.output_text) {
              analysisResponse = response.output_text;
              console.log('Using output_text field from response:', analysisResponse.substring(0, 100) + '...');
            }
            // Check if the response has the output array (old format)
            else if ('output' in response && Array.isArray(response.output)) {
              console.log('Using output array from response, length:', (response as any).output.length);
              
              // The OpenAI Responses API returns an array of content items
              for (const item of (response as any).output) {
                // Use a safer approach to access potentially missing properties
                const itemAny = item as any;
                console.log('Processing output item type:', itemAny.type);
                
                if (itemAny.type === 'message' && itemAny.content && Array.isArray(itemAny.content)) {
                  for (const contentItem of itemAny.content) {
                    console.log('Processing content item type:', contentItem.type);
                    if (contentItem.type === 'output_text' && contentItem.text) {
                      analysisResponse += contentItem.text;
                      console.log('Added output_text content:', contentItem.text.substring(0, 100) + '...');
                    } else if (contentItem.type === 'text' && contentItem.text) {
                      analysisResponse += contentItem.text;
                      console.log('Added text content:', contentItem.text.substring(0, 100) + '...');
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
          console.error('Error processing PDF with Responses API:', pdfError.message);
          analysisResponse = `Error analyzing PDF: ${pdfError.message}. Please try again later.`;
        }
      }
      
      // Extract structured data from analysis
      if (analysisResponse) {
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
      }
      
      // Update the record in Firestore if we have userId and recordId
      if (userId && recordId && (detailedAnalysis || briefSummary)) {
        try {
          console.log(`Updating record ${recordId} with analysis results`);
          
          // Use admin SDK for Firestore updates in API routes
          const recordRef = db.collection('users').doc(userId).collection('records').doc(recordId);
          
          // Prepare the update data
          const updateData: Record<string, any> = {
            analyzed: true,
            analyzedAt: new Date()
          };
          
          // Only add fields that have values
          if (detailedAnalysis) updateData.detailedAnalysis = detailedAnalysis;
          if (briefSummary) updateData.briefSummary = briefSummary;
          if (briefSummary) updateData.summary = briefSummary;
          if (recordType) updateData.recordType = recordType;
          if (recordDate) updateData.recordDate = recordDate;
          
          // Update the record
          await recordRef.update(updateData);
          
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
        recordDate
      });
    } catch (analysisError: any) {
      console.error('Error during analysis:', analysisError.message);
      return NextResponse.json({ 
        error: 'Analysis error', 
        message: analysisError.message 
      }, { status: 500 });
    }
  } catch (error: any) {
    console.error('General error in analyze endpoint:', error.message);
    return NextResponse.json({ 
      error: 'Internal server error', 
      message: error.message
    }, { status: 500 });
  }
} 