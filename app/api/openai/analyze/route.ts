import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { db } from '../../../lib/firebase-admin';
import { PDFDocument } from 'pdf-lib';
import axios from 'axios';
import { 
  extractBriefSummary, 
  extractDetailedAnalysis, 
  extractRecordType, 
  extractRecordDate,
  extractStructuredData,
  extractFHIRResources
} from '../../../lib/analysis-utils';

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
 * Ensure a patient record exists for the user
 * @param userId The user ID
 * @returns The patient ID
 */
async function ensurePatientRecord(userId: string): Promise<string> {
  try {
    // Check if user already has a Patient resource
    const patientQuery = await db.collection('users').doc(userId)
      .collection('fhir_resources')
      .where('resourceType', '==', 'Patient')
      .limit(1)
      .get();
    
    if (!patientQuery.empty) {
      const patientId = patientQuery.docs[0].id.split('_')[1];
      return patientId;
    } else {
      // Create a new Patient resource if none exists
      const admin = await import('firebase-admin');
      if (!admin.apps.length) {
        admin.initializeApp();
      }
      
      const userDoc = await db.collection('users').doc(userId).get();
      const userData = userDoc.data() || {};
      
      const patientId = admin.firestore().collection('_').doc().id;
      
      const patientResource = {
        resourceType: 'Patient',
        id: patientId,
        active: true,
        name: [
          {
            use: 'official',
            family: userData.lastName || '',
            given: [userData.firstName || ''],
            text: `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || 'Unknown'
          }
        ],
        gender: userData.gender || undefined,
        birthDate: userData.birthDate || undefined,
        meta: {
          lastUpdated: new Date().toISOString()
        }
      };
      
      // Save the Patient resource
      await db.collection('users').doc(userId)
        .collection('fhir_resources')
        .doc(`Patient_${patientId}`)
        .set(patientResource);
      
      return patientId;
    }
  } catch (error) {
    console.error('Error ensuring patient record:', error);
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
      // For PDFs and images, use the detailed instruction with enhanced structure for different record types
      defaultQuestion = 'You are a medical data extraction specialist. Your task is to analyze this medical document and:\n\n' +
                       '1. Extract structured FHIR R4 resources based on the content\n' +
                       '2. Provide an analysis summary of the document\n\n' +
                       'INSTRUCTIONS FOR FHIR EXTRACTION:\n' +
                       '- Extract Patient, Observation, DiagnosticReport, Medication, MedicationStatement, Condition, AllergyIntolerance, Immunization, or any other relevant FHIR resources\n' +
                       '- Follow standard FHIR R4 resource structures with all required fields\n' +
                       '- Use appropriate coding systems (LOINC for labs, RxNorm for medications, ICD-10 for conditions)\n' +
                       '- Include proper units, reference ranges, and dates where available\n' +
                       '- Link related resources using proper references\n' +
                       '- For laboratory reports:\n' +
                       '  * Extract ALL test results as individual Observations\n' +
                       '  * Include the exact test name, value, unit, and reference range\n' +
                       '  * Use appropriate LOINC codes for each test\n' +
                       '  * Group related tests under a DiagnosticReport resource\n' +
                       '  * Preserve the original test names and units exactly as shown\n' +
                       '  * Include any flags or abnormal indicators\n' +
                       '- CRITICAL: Validate all JSON syntax before including it in the response\n' +
                       '- CRITICAL: Ensure all JSON objects are properly closed with matching braces\n' +
                       '- CRITICAL: Check for missing commas between array elements\n' +
                       '- CRITICAL: Verify all property names are properly quoted\n' +
                       '- CRITICAL: Remove any trailing commas in arrays or objects\n' +
                       '\n' +
                       'INSTRUCTIONS FOR DOCUMENT ANALYSIS:\n' +
                       '- Provide a detailed analysis of the medical information. This should include ALL the medical data or information from the record and associated dates, but does not need to include any personal identifiers, meta data or information about the medical practice, practitioners or location.\n' +
                       '- Include a brief summary of key findings\n' +
                       '- Identify the document type\n' +
                       '- Note the date of the document\n' +
                       '\n' +
                       'FORMAT YOUR RESPONSE AS FOLLOWS:\n' +
                       '\n' +
                       '<FHIR_RESOURCES>\n' +
                       '[\n' +
                       '  {\n' +
                       '    "resourceType": "TYPE",\n' +
                       '    ... valid FHIR JSON resource ...\n' +
                       '  },\n' +
                       '  // Add more resources as needed\n' +
                       ']\n' +
                       '</FHIR_RESOURCES>\n' +
                       '\n' +
                       '<DETAILED_ANALYSIS>\n' +
                       'This should include ALL the medical data or information from the record and associated dates, but should NOT include any personal identifiers, meta data or information about the medical practice, practitioners or location.\n' +
                       '</DETAILED_ANALYSIS>\n' +
                       '\n' +
                       '<BRIEF_SUMMARY>\n' +
                       'Provide a patient-friendly summary of the medical information with a brief interpretation of any unusual results. Do NOT include any patient identifiers, meta data, or information about the medical practice, practitioners, or location.\n' +
                       '</BRIEF_SUMMARY>\n' +
                       '\n' +
                       '<DOCUMENT_TYPE>\n' +
                       'The type of document\n' +
                       '</DOCUMENT_TYPE>\n' +
                       '\n' +
                       '<DATE>\n' +
                       'The date of the document\n' +
                       '</DATE>\n' +
                       '\n' +
                       '<SUGGESTED_RECORD_NAME>\n' +
                       'A descriptive name for this record\n' +
                       '</SUGGESTED_RECORD_NAME>';
      
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
                       '<DETAILED_ANALYSIS>\nList all medical information visible in this image, ensuring it is complete and detailed. Do NOT include any patient identifiers, meta data, or information about the medical practice, practitioners, or location.\n</DETAILED_ANALYSIS>\n\n' +
                       '<DOCUMENT_TYPE>\nReturn the FHIR resource type that best matches this document. The main types are "Laboratory Report" (including pathology reports, biopsies, and all test results), "Medication List", "Immunization Record", "Allergy List", "Problem List", or "Radiology Report".\n</DOCUMENT_TYPE>\n\n' +
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
            Comprehensive findings from ALL images, organized clearly. Make sure to include EVERY medical detail from each individual image analysis. Do not omit any information, even if it appears redundant. Do NOT include any patient identifiers, meta data, or information about the medical practice, practitioners, or location.
            </DETAILED_ANALYSIS>
            
            <BRIEF_SUMMARY>
            Provide a patient-friendly summary of the medical information with a brief interpretation of any unusual results. Do NOT include any patient identifiers, meta data, or information about the medical practice, practitioners, or location.
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
            
            // Add all additional files to the messageContent array
            additionalFileObjects.forEach(fileObj => {
              // Insert file objects before the text prompt to ensure all files are processed together
              messageContent.splice(messageContent.length - 1, 0, fileObj);
            });
            
            // Update the prompt to emphasize that multiple files should be analyzed together
            const multiFileNote = "\n\nIMPORTANT: You have been provided with multiple documents (multiple PDFs) that belong together. Please analyze ALL documents as a complete set and provide a comprehensive analysis of all the files together.";
            messageContent[messageContent.length - 1] = { 
              type: 'input_text' as const, 
              text: messageContent[messageContent.length - 1].text + multiFileNote 
            };
            
            console.log(`Debug: Updated message content with ${additionalFileObjects.length} additional files and multi-file note`);
          }
          
          // Create the API request
          console.log('Debug: Sending content to OpenAI with structure:', JSON.stringify(messageContent.map(m => m.type)));
          
          // Add a timeout mechanism
          const timeoutMs = 180000; // 3 minutes
          const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('OpenAI API request timed out after 3 minutes')), timeoutMs);
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
            
            // Implement a simpler fallback for timeout cases
            try {
              console.log('Attempting simplified analysis as fallback...');
              
              // Create a simpler prompt that focuses on essential information
              const fallbackPrompt = `Please analyze this medical document and extract the following information:

1. Document type (e.g., lab report, radiology, etc.)
2. Document date
3. Key test results and their values
4. Any abnormal findings
5. Brief summary

Format your response using these tags:
<DOCUMENT_TYPE>Type goes here</DOCUMENT_TYPE>
<DATE>Date goes here</DATE>
<DETAILED_ANALYSIS>Detailed findings go here. Do NOT include any patient identifiers, meta data, or information about the medical practice, practitioners, or location.</DETAILED_ANALYSIS>
<BRIEF_SUMMARY>Provide a patient-friendly summary of the medical information with a brief interpretation of any unusual results. Do NOT include any patient identifiers, meta data, or information about the medical practice, practitioners, or location.</BRIEF_SUMMARY>

For lab reports, please include:
- Test name
- Value
- Unit
- Reference range
- Any flags or abnormal indicators

Keep the analysis concise but informative.`;
              
              // Use a smaller model with stricter token limits for faster processing
              const fallbackAPICall = openai.responses.create({
                model: 'gpt-4o',
                input: [
                  {
                    role: 'user',
                    content: [
                      { type: 'input_file' as const, file_id: fileId },
                      { type: 'input_text' as const, text: fallbackPrompt }
                    ],
                  },
                ],
              });
              
              // Give the fallback a shorter timeout
              const fallbackTimeout = new Promise<never>((_, reject) => {
                setTimeout(() => reject(new Error('Fallback analysis timed out')), 30000); // 30 seconds
              });
              
              // Execute the fallback
              const fallbackResponse = await Promise.race([fallbackAPICall, fallbackTimeout]);
              
              if (fallbackResponse && 'output_text' in fallbackResponse && fallbackResponse.output_text) {
                analysisResponse = fallbackResponse.output_text;
                console.log('Fallback analysis successful');
                
                // Extract sections from the fallback response
                const detailedAnalysisMatch = analysisResponse.match(/<DETAILED_ANALYSIS>\s*([\s\S]*?)\s*<\/DETAILED_ANALYSIS>/i);
                detailedAnalysis = detailedAnalysisMatch ? detailedAnalysisMatch[1].trim() : '';
                
                const briefSummaryMatch = analysisResponse.match(/<BRIEF_SUMMARY>\s*([\s\S]*?)\s*<\/BRIEF_SUMMARY>/i);
                briefSummary = briefSummaryMatch ? briefSummaryMatch[1].trim() : '';
                
                const recordTypeMatch = analysisResponse.match(/<DOCUMENT_TYPE>\s*([\s\S]*?)\s*<\/DOCUMENT_TYPE>/i);
                recordType = recordTypeMatch ? recordTypeMatch[1].trim() : '';
                
                const recordDateMatch = analysisResponse.match(/<DATE>\s*([\s\S]*?)\s*<\/DATE>/i);
                recordDate = recordDateMatch ? recordDateMatch[1].trim() : '';
                
                // Add a note that this is a simplified analysis
                if (detailedAnalysis) {
                  detailedAnalysis += "\n\nNote: This is a simplified analysis due to processing limitations. Please view the original document for complete details.";
                }
              } else {
                throw new Error('Fallback analysis failed to extract information');
              }
            } catch (fallbackError) {
              console.error('Fallback analysis also failed:', fallbackError);
              // Set some default values to ensure we don't return empty results
              analysisResponse = "The document analysis could not be completed due to processing limitations. Please try again later.";
              detailedAnalysis = "Unable to complete full analysis. Please try again or view the original document.";
              briefSummary = "Analysis incomplete. Please try again.";
              recordType = "Medical Document";
              recordDate = new Date().toISOString().split('T')[0];
            }
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
            if (!response) {
              console.error('Response is undefined');
              throw new Error('Empty response from OpenAI');
            }
            
            console.log('Response format:', typeof response);
            console.log('Response preview:', JSON.stringify(response).substring(0, 500) + '...');
            
            // Check if the response has output_text field (new format)
            if ('output_text' in response && response.output_text) {
              analysisResponse = response.output_text;
              console.log('Using output_text field from response:', analysisResponse.substring(0, 100) + '...');
            }
            // Check if the response has the output array (old format)
            else if ('output' in response && Array.isArray((response as any).output)) {
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
      
      // Update the record in Firestore with the new fields
      try {
        const recordRef = db.collection('users').doc(userId).collection('records').doc(recordId);
        
        // Check if the analysis field contains a JSON string (new OpenAI response format)
        let analysis = analysisResponse;
        let extractedRecordType = "";
        let extractedRecordDate = "";
        let briefSummary = '';
        let detailedAnalysis = '';
        let structuredData = {};
        
        // Check if the analysis is a JSON string, try to parse it and extract the output_text
        if (typeof analysis === 'string' && analysis.startsWith('{') && analysis.includes('output_text')) {
          try {
            const parsedAnalysis = JSON.parse(analysis);
            
            // Extract the output_text if it exists
            if (parsedAnalysis.output_text) {
              analysis = parsedAnalysis.output_text;
            }
          } catch (parseError) {
            console.error('Error parsing JSON from analysis field:', parseError);
            // Continue with the original values
          }
        }
        
        // Extract sections from the analysis text only if we have a string
        if (typeof analysis === 'string') {
          // Extract all sections at once to avoid redundant regex operations
          detailedAnalysis = extractDetailedAnalysis(analysis);
          briefSummary = extractBriefSummary(analysis);
          
          // Extract additional fields
          extractedRecordType = extractRecordType(analysis);
          extractedRecordDate = extractRecordDate(analysis);
          
          // Extract structured data based on document type
          structuredData = extractStructuredData(analysis);
        }
        
        const updateData: {
          analysis: string;
          analyzedAt: Date;
          recordType: string;
          recordDate: string;
          briefSummary: string;
          detailedAnalysis: string;
          structuredData: any;
          name?: string;
        } = {
          analysis: analysis || "Analysis could not be completed.",
          analyzedAt: new Date(),
          recordType: extractedRecordType || "Medical Record",
          recordDate: extractedRecordDate || "",
          briefSummary: briefSummary || "",
          detailedAnalysis: detailedAnalysis || "",
          structuredData: structuredData || {}
        };
        
        // Make sure we don't store the FHIR resources in the name field
        if (recordRef) {
          try {
            // Get the current record data
            const recordData = await recordRef.get();
            if (recordData.exists) {
              const currentData = recordData.data() || {};
              
              // Check if the name looks like it might be FHIR data
              if (currentData.name && (
                String(currentData.name).includes('<FHIR_RESOURCES>') || 
                String(currentData.name).includes('resourceType') || 
                String(currentData.name).includes('Patient') ||
                String(currentData.name).includes('Observation') ||
                String(currentData.name).length > 100
              )) {
                // Reset to a sensible name
                updateData.name = extractedRecordType || "Medical Record";
              }
            }
          } catch (nameCheckError) {
            console.error('Error checking record name:', nameCheckError);
            // Continue with update anyway
          }
        }
        
        await recordRef.update(updateData);
        console.log(`✅ Record ${recordId} updated with analysis`);
        
        // Extract FHIR resources
        let fhirResources = null;
        try {
          // First clean up the analysis text to remove any ```json markers
          // This handles the case where OpenAI adds markdown code block syntax
          const cleanedAnalysis = analysis
            .replace(/```json\s*/g, '')
            .replace(/```\s*$/g, '');
            
          fhirResources = extractFHIRResources(cleanedAnalysis);
        } catch (fhirError) {
          console.error('Error extracting FHIR resources:', fhirError);
          fhirResources = null;
        }
        
        // Log the extracted FHIR resources
        if (fhirResources && fhirResources.length > 0) {
          console.log(`✅ Extracted ${fhirResources.length} FHIR resources from analysis`);
          
          // Process and store FHIR resources if user ID provided
          if (userId) {
            // We need to ensure a patient resource exists
            const patientId = await ensurePatientRecord(userId);
            
            // Store the FHIR resources in Firestore
            await storeFHIRResourcesDirectly(userId, patientId, fhirResources, recordId);
          }
        } else {
          console.log(`⚠️ No FHIR resources extracted from analysis`);
        }
      } catch (updateError) {
        console.error('❌ Error updating record with analysis:', updateError);
        // Continue even if update fails, so we still return the analysis
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

/**
 * Store FHIR resources directly extracted from OpenAI
 * @param userId The user ID
 * @param patientId The patient ID
 * @param resources Array of FHIR resources
 * @param recordId Optional record ID to link with
 */
async function storeFHIRResourcesDirectly(
  userId: string,
  patientId: string,
  resources: any[],
  recordId?: string
) {
  try {
    if (!resources || resources.length === 0) {
      console.log('No FHIR resources to store');
      return;
    }
    
    console.log(`Storing ${resources.length} FHIR resources for user ${userId}`);
    
    // Prepare output to track created resources
    const createdResources: Record<string, string[]> = {};
    
    // Process each resource
    for (const resource of resources) {
      try {
        // Skip invalid resources
        if (!resource || !resource.resourceType) {
          console.warn('Skipping invalid FHIR resource (missing resourceType)');
          continue;
        }
        
        const resourceType = resource.resourceType;
        
        // Skip Patient resources as we already have one
        if (resourceType === 'Patient') {
          console.log('Skipping Patient resource as we already have one');
          continue;
        }
        
        // Add patient reference if not already present
        if (resourceType !== 'Patient' && !resource.subject && !resource.patient) {
          // Different FHIR resources use different fields for patient reference
          if (['Observation', 'DiagnosticReport', 'Procedure', 'Condition', 'Immunization'].includes(resourceType)) {
            resource.subject = { reference: `Patient/${patientId}` };
          } else if (['MedicationStatement', 'AllergyIntolerance'].includes(resourceType)) {
            resource.patient = { reference: `Patient/${patientId}` };
          }
        }
        
        // Make sure the resource has an ID
        if (!resource.id) {
          resource.id = crypto.randomUUID().replace(/-/g, '');
        }
        
        // Add metadata
        resource.meta = {
          ...(resource.meta || {}),
          lastUpdated: new Date().toISOString(),
          source: recordId ? `Record/${recordId}` : 'AI Analysis'
        };
        
        // Store the resource
        const userDocRef = db.collection('users').doc(userId);
        const fhirCollectionRef = userDocRef.collection('fhir_resources');
        const resourceDocRef = fhirCollectionRef.doc(`${resourceType}_${resource.id}`);
        await resourceDocRef.set(resource);
        
        // Track created resources by type
        if (!createdResources[resourceType]) {
          createdResources[resourceType] = [];
        }
        createdResources[resourceType].push(resource.id);
        
        console.log(`Created ${resourceType} resource with ID ${resource.id}`);
      } catch (resourceError) {
        console.error(`Error storing FHIR resource of type ${resource?.resourceType || 'unknown'}:`, resourceError);
      }
    }
    
    // Log summary of created resources
    const summary = Object.entries(createdResources)
      .map(([type, ids]) => `${type}: ${ids.length}`)
      .join(', ');
    
    console.log(`FHIR resources created: ${summary}`);
    
    // Return the created resources
    return createdResources;
  } catch (error) {
    console.error('Error storing FHIR resources:', error);
    throw error;
  }
}