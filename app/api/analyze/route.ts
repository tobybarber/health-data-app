import { NextRequest, NextResponse } from 'next/server';
import { doc, setDoc, collection, addDoc, serverTimestamp, getDocs, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase-admin';
import openai, { isApiKeyValid } from '../../lib/openai-server';

// Helper function to get detailed diet description
function getDietDescription(dietValue: string): string {
  switch (dietValue) {
    case 'whole-foods':
      return 'Mostly whole foods (fruits, vegetables, lean meats, whole grains) - nutrient-rich, balanced diet';
    case 'mixed':
      return 'Balanced mix of whole foods and some processed foods - moderate diet with room for improvement';
    case 'processed':
      return 'Mostly processed foods (fast food, sugary drinks, packaged snacks) - high in empty calories, sodium, and fats';
    case 'irregular':
      return 'Irregular eating (skipping meals, heavy snacking, little variety) - inconsistent nutrition with poor diversity';
    default:
      return dietValue || 'Not specified';
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check for API key
    const keyStatus = await isApiKeyValid();
    if (!keyStatus.valid) {
      console.error('Invalid or missing OpenAI API key:', keyStatus.message);
      return NextResponse.json(
        { 
          success: false, 
          message: `OpenAI API key is invalid or has insufficient permissions: ${keyStatus.message}. Please check your API key configuration.`,
          error: 'OPENAI_API_KEY_INVALID'
        },
        { status: 500 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { fileName, fileUrl, fileUrls, isMultiFile, question, userId } = body;
    const urls = fileUrls || (fileUrl ? [fileUrl] : []);

    console.log('Request body:', { fileName, urlCount: urls.length, userId });

    if (!userId) {
      console.error('No userId provided in request');
      return NextResponse.json(
        { 
          success: false, 
          message: 'User ID is required',
          error: 'USER_ID_MISSING'
        },
        { status: 400 }
      );
    }

    if (fileName && urls.length) {
      // Process files
      const fileIds: string[] = [];
      const errors: string[] = [];

      // Process each file (limit to 5 to avoid token limits)
      const filesToProcess = urls.slice(0, 5);
      if (urls.length > 5) {
        console.log(`Limiting analysis to first 5 files out of ${urls.length}`);
      }

      for (const url of filesToProcess) {
        try {
          console.log(`Fetching file from: ${url}`);
          const response = await fetch(url);
          console.log(`Fetch status: ${response.status}, OK: ${response.ok}`);
          
          if (!response.ok) {
            throw new Error(`Fetch failed with status: ${response.status}`);
          }

          const blob = await response.blob();
          console.log(`Blob size: ${blob.size} bytes, type: ${blob.type || 'unknown'}`);

          if (blob.size === 0) {
            throw new Error('Downloaded file is empty');
          }

          const buffer = Buffer.from(await blob.arrayBuffer());
          console.log(`Buffer size: ${buffer.length} bytes`);

          // Create file with proper extension based on MIME type
          const fileType = blob.type || 'application/octet-stream';
          const fileExt = fileType.includes('jpeg') || fileType.includes('jpg') ? 'jpg' : 
                         fileType.includes('png') ? 'png' : 
                         fileType.includes('pdf') ? 'pdf' : 'bin';
          
          const safeFileName = `${fileName.replace(/[^a-zA-Z0-9.-]/g, '_')}.${fileExt}`;
          console.log(`Creating file: ${safeFileName}, type: ${fileType}`);
          
          // Skip file upload to OpenAI and use base64 encoding approach directly
          console.log(`Skipping direct file upload to OpenAI, will use base64 encoding instead`);
          
          // Add the URL to fileUrls for later processing
          fileIds.push(url); // Store the URL instead of an OpenAI file ID
        } catch (error: any) {
          console.error(`Error processing ${url}:`, error);
          errors.push(`Error with ${url}: ${error.message || String(error)}`);
        }
      }

      // Analyze files
      let analysis = '';
      
      if (fileIds.length === 0) {
        console.log('No files uploaded to OpenAI, falling back to URL-based analysis');
        
        // Fallback analysis when file upload fails
        const response = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            { 
              role: 'system', 
              content: 'You are a medical AI assistant. Provide a brief response.' 
            },
            { 
              role: 'user', 
              content: `I tried to upload these medical records for analysis but the upload failed. The files are: ${urls.map((url: string) => url.split('/').pop()).join(', ')}. Please provide a brief message about what to do next.` 
            },
          ],
        });
        
        analysis = response.choices[0]?.message?.content || 'Limited analysis due to upload failure';
      } else {
        console.log(`Analyzing ${fileIds.length} files with OpenAI`);
        
        try {
          // Use base64 encoding for images
          console.log('Using base64 encoding for images with GPT-4o');
          
          // Re-download the files to get their content for direct inclusion
          const encodedImages = [];
          
          for (const url of urls.slice(0, 5)) { // Limit to 5 files
            try {
              console.log(`Re-downloading file from: ${url} for base64 encoding`);
              const response = await fetch(url);
              
              if (response.ok) {
                const blob = await response.blob();
                const buffer = await blob.arrayBuffer();
                const base64 = Buffer.from(buffer).toString('base64');
                const mimeType = blob.type || 'image/jpeg';
                
                // For PDF files, we'll just mention them rather than trying to encode them
                if (mimeType.includes('pdf')) {
                  console.log(`Processing PDF file: ${url} with base64 encoding`);
                  encodedImages.push({
                    type: 'image_url',
                    image_url: {
                      url: `data:${mimeType};base64,${base64}`,
                      detail: 'high'
                    }
                  });
                  console.log(`Successfully encoded PDF file from ${url}`);
                } else {
                  encodedImages.push({
                    type: 'image_url',
                    image_url: {
                      url: `data:${mimeType};base64,${base64}`,
                      detail: 'high'
                    }
                  });
                  console.log(`Successfully encoded file from ${url}`);
                }
              }
            } catch (downloadError) {
              console.error(`Error re-downloading file from ${url}:`, downloadError);
            }
          }
          
          if (encodedImages.length > 0) {
            // Use GPT-4o with base64-encoded images
            console.log(`Analyzing ${encodedImages.length} base64-encoded images with GPT-4o`);
            
            // Direct API call to OpenAI's chat completions endpoint
            const chatResponse = await fetch('https://api.openai.com/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
              },
              body: JSON.stringify({
                model: 'gpt-4o',
                messages: [
                  {
                    role: 'system',
                    content: 'You are a medical AI assistant specializing in analyzing medical records. Your task is to provide a detailed and accurate summary of the medical record shown in the image or PDF document. Focus on extracting key medical information such as diagnoses, test results, medications, vital signs, and any other clinically relevant details. Present the information in a clear, organized manner without adding interpretations beyond what is explicitly stated in the record. For PDF documents, carefully analyze all visible text and data in the document.'
                  },
                  {
                    role: 'user',
                    content: [
                      {
                        type: 'text',
                        text: 'Please provide a detailed summary of this health record. Extract all relevant medical information visible in the document. If this is a PDF, please analyze all the text and information contained within it.'
                      },
                      ...encodedImages
                    ]
                  }
                ]
              })
            });
            
            if (chatResponse.ok) {
              const chatData = await chatResponse.json();
              analysis = chatData.choices[0]?.message?.content || 'No analysis available';
              console.log('Analysis completed successfully using base64-encoded images');
            } else {
              const errorText = await chatResponse.text();
              console.error('OpenAI API error:', errorText);
              throw new Error(`OpenAI API error: ${chatResponse.status} - ${errorText}`);
            }
          } else {
            console.log('No images could be encoded, falling back to traditional approach');
            throw new Error('No images could be encoded');
          }
        } catch (visionError: any) {
          console.error('Error using Vision API:', visionError);
          
          // Fallback to traditional approach with file references
          try {
            console.log('Falling back to traditional file reference approach');
            
            // Since we're now storing URLs in fileIds, we need to use them directly
            const fallbackResponse = await openai.chat.completions.create({
              model: 'gpt-4o',
              messages: [
                {
                  role: 'system',
                  content: 'You are a medical AI assistant specializing in analyzing medical records. Extract and summarize key medical information from the provided descriptions. If the files include PDFs, you have the capability to analyze their content - do not respond that you cannot access PDFs.'
                },
                {
                  role: 'user',
                  content: `Analyze these medical records. The files are located at: ${fileIds.join(', ')}. If any of these are PDF files, please analyze their content directly.`
                }
              ]
            });
            
            analysis = fallbackResponse.choices[0]?.message?.content || 'No analysis available';
            console.log('Analysis completed using traditional approach');
          } catch (fallbackError: any) {
            console.error('Error using traditional approach:', fallbackError);
            analysis = 'Error analyzing files. The files were uploaded successfully, but analysis failed.';
          }
        }
      }

      // Save record to Firestore
      console.log(`Saving record to Firestore for user ${userId}`);
      const docRef = await addDoc(collection(db, `users/${userId}/records`), {
        name: fileName,
        url: urls[0],
        urls: urls,
        isMultiFile: urls.length > 1,
        fileCount: urls.length,
        analysis,
        createdAt: serverTimestamp(),
      });
      
      console.log(`Record saved with ID: ${docRef.id}`);

      // Perform holistic analysis
      console.log(`Fetching all records for user ${userId} for holistic analysis`);
      const recordsCollection = collection(db, `users/${userId}/records`);
      const recordsSnapshot = await getDocs(recordsCollection);
      
      // Get summaries from all records
      const summaries = recordsSnapshot.docs.map(doc => {
        const data = doc.data();
        const recordType = data.isManual ? 'Manual Record' : 'Uploaded Record';
        const photoInfo = data.hasPhoto && data.url ? ' (Includes photo)' : '';
        return `Record: ${data.name || 'Unnamed Record'} (${recordType}${photoInfo})
Analysis: ${data.analysis || 'No analysis available'}`;
      });
      
      // Limit the number of summaries to avoid token limits
      const limitedSummaries = summaries.slice(0, 10);
      
      // Get user profile information
      let profileInfo = 'User Profile: Not available';
      try {
        // Try the correct path first - this is where the profile is actually stored
        const userProfileDoc = await getDoc(doc(db, 'profile', 'user'));
        if (userProfileDoc.exists()) {
          const profile = userProfileDoc.data();
          
          // Create a detailed profile string with all available information
          profileInfo = `User Profile:
Name: ${profile?.name || 'Not specified'}
Age: ${profile?.age || 'Not specified'}
Gender: ${profile?.gender || 'Not specified'}
Height: ${profile?.height || 'Not specified'} cm
Weight: ${profile?.weight || 'Not specified'} kg
Lifestyle Factors:
- Smoking: ${profile?.smoking || 'Not specified'}
- Alcohol: ${profile?.alcohol || 'Not specified'}
- Diet: ${getDietDescription(profile?.diet)}
- Exercise: ${profile?.exercise || 'Not specified'}
Family Medical History:
${profile?.familyHistory ? profile.familyHistory : 'Not specified'}`;
        } else {
          // Try alternative paths if the main path doesn't work
          const profileDoc = await getDoc(doc(db, 'users', userId, 'profile', 'data'));
          if (profileDoc.exists()) {
            const profile = profileDoc.data();
            
            // Create a detailed profile string with all available information
            profileInfo = `User Profile:
Name: ${profile?.name || 'Not specified'}
Age: ${profile?.age || 'Not specified'}
Gender: ${profile?.gender || 'Not specified'}
Height: ${profile?.height || 'Not specified'} cm
Weight: ${profile?.weight || 'Not specified'} kg
Lifestyle Factors:
- Smoking: ${profile?.smoking || 'Not specified'}
- Alcohol: ${profile?.alcohol || 'Not specified'}
- Diet: ${getDietDescription(profile?.diet)}
- Exercise: ${profile?.exercise || 'Not specified'}
Family Medical History:
${profile?.familyHistory ? profile.familyHistory : 'Not specified'}`;
          } else {
            // Try one more path
            const altProfileDoc = await getDoc(doc(db, 'profile', userId));
            if (altProfileDoc.exists()) {
              const profile = altProfileDoc.data();
              
              // Create a detailed profile string with all available information
              profileInfo = `User Profile:
Name: ${profile?.name || 'Not specified'}
Age: ${profile?.age || 'Not specified'}
Gender: ${profile?.gender || 'Not specified'}
Height: ${profile?.height || 'Not specified'} cm
Weight: ${profile?.weight || 'Not specified'} kg
Lifestyle Factors:
- Smoking: ${profile?.smoking || 'Not specified'}
- Alcohol: ${profile?.alcohol || 'Not specified'}
- Diet: ${getDietDescription(profile?.diet)}
- Exercise: ${profile?.exercise || 'Not specified'}
Family Medical History:
${profile?.familyHistory ? profile.familyHistory : 'Not specified'}`;
            }
          }
        }
      } catch (profileError) {
        console.error('Error fetching user profile:', profileError);
      }
      
      const holistic = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { 
            role: 'system', 
            content: 'You are a medical AI assistant that provides holistic analysis of medical records. All records belong to the same individual whose profile information is provided. Consider how the patient\'s demographic information, lifestyle factors, and medical history might interact. Look for patterns across records, potential health risks based on the combined data, and provide personalized insights that take into account all available information about this specific patient.'
          },
          { 
            role: 'user', 
            content: `${profileInfo}\n\nI have the following health record summaries for this user:\n\n${limitedSummaries.join('\n\n---\n\n')}\n\nProvide a comprehensive holistic analysis of these medical records, highlighting any patterns, concerns, or important observations across all records. Consider how the patient's lifestyle factors (smoking, alcohol, diet, exercise) might impact their health conditions. Suggest potential areas for health improvement based on both the medical records and lifestyle information.` 
          },
        ],
      });
      
      const holisticText = holistic.choices[0]?.message?.content || 'No holistic analysis available';
      
      await setDoc(doc(db, `users/${userId}/analysis`, 'holistic'), { 
        text: holisticText, 
        updatedAt: serverTimestamp() 
      });
      
      console.log('Holistic analysis saved');
      
      return NextResponse.json({ 
        success: true, 
        message: 'Files processed and analyzed', 
        analysis,
        holisticAnalysis: holisticText,
        recordId: docRef.id
      });
    }

    return NextResponse.json(
      { success: false, message: 'Invalid request parameters' }, 
      { status: 400 }
    );
  } catch (error: any) {
    console.error('API error:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to process request', 
        error: error instanceof Error ? error.message : String(error) 
      }, 
      { status: 500 }
    );
  }
}

// Update the answerQuestion function to use the correct profile path
async function answerQuestion(question: string, fileIds: string[], summaries: string[], userId?: string) {
  try {
    console.log(`Answering question with ${summaries.length} health record summaries`);
    
    // Get user profile information
    let profileInfo = "No profile information available.";
    try {
      // Try the correct path first - this is where the profile is actually stored
      const userProfileDoc = await getDoc(doc(db, 'profile', 'user'));
      if (userProfileDoc.exists()) {
        const profile = userProfileDoc.data();
        
        // Create a detailed profile string with all available information
        profileInfo = `User Profile:
Name: ${profile?.name || 'Not specified'}
Age: ${profile?.age || 'Not specified'}
Gender: ${profile?.gender || 'Not specified'}
Height: ${profile?.height || 'Not specified'} cm
Weight: ${profile?.weight || 'Not specified'} kg
Lifestyle Factors:
- Smoking: ${profile?.smoking || 'Not specified'}
- Alcohol: ${profile?.alcohol || 'Not specified'}
- Diet: ${getDietDescription(profile?.diet)}
- Exercise: ${profile?.exercise || 'Not specified'}
Family Medical History:
${profile?.familyHistory ? profile.familyHistory : 'Not specified'}`;
      } else if (userId) {
        // Try alternative paths if the main path doesn't work
        const profileDoc = await getDoc(doc(db, 'profile', userId));
        if (profileDoc.exists()) {
          const profile = profileDoc.data();
          
          // Create a detailed profile string with all available information
          profileInfo = `User Profile:
Name: ${profile?.name || 'Not specified'}
Age: ${profile?.age || 'Not specified'}
Gender: ${profile?.gender || 'Not specified'}
Height: ${profile?.height || 'Not specified'} cm
Weight: ${profile?.weight || 'Not specified'} kg
Lifestyle Factors:
- Smoking: ${profile?.smoking || 'Not specified'}
- Alcohol: ${profile?.alcohol || 'Not specified'}
- Diet: ${getDietDescription(profile?.diet)}
- Exercise: ${profile?.exercise || 'Not specified'}
Family Medical History:
${profile?.familyHistory ? profile.familyHistory : 'Not specified'}`;
        }
      }
    } catch (profileError) {
      console.error('Error fetching user profile:', profileError);
    }
    
    // Use the summaries for holistic analysis instead of the original files
    const chatResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are a medical AI assistant. Analyze the provided health record summaries and answer the user\'s question based on the information in these summaries. All records belong to the same individual whose profile information is provided. Consider how the patient\'s demographic information, lifestyle factors, and medical history might interact when formulating your response.'
          },
          {
            role: 'user',
            content: `${profileInfo}\n\nI have the following health record summaries for this user:\n\n${summaries.join('\n\n---\n\n')}\n\nBased on these summaries and the user's profile information, please answer this question: ${question}`
          }
        ]
      })
    });
    
    if (chatResponse.ok) {
      const chatData = await chatResponse.json();
      return chatData.choices[0]?.message?.content || 'No answer available';
    } else {
      const errorText = await chatResponse.text();
      console.error('OpenAI API error:', errorText);
      throw new Error(`OpenAI API error: ${chatResponse.status} - ${errorText}`);
    }
  } catch (error) {
    console.error('Error answering question:', error);
    throw error;
  }
} 