import { NextRequest, NextResponse } from 'next/server';
import { doc, setDoc, collection, addDoc, serverTimestamp, getDocs, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import OpenAI from 'openai';

// Initialize OpenAI client
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Helper function to check if OpenAI API key is valid
async function isOpenAIKeyValid() {
  if (!process.env.OPENAI_API_KEY) {
    console.error('No OpenAI API key found in environment');
    return false;
  }
  
  try {
    // Make a simple API call to test the key
    await openai.models.list();
    return true;
  } catch (error) {
    console.error('OpenAI API key validation failed:', error);
    return false;
  }
}

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
    const isKeyValid = await isOpenAIKeyValid();
    if (!isKeyValid) {
      console.error('Invalid or missing OpenAI API key');
      return NextResponse.json(
        { 
          success: false, 
          message: 'OpenAI API key is missing or invalid. Please add a valid API key to your .env.local file and restart the server.',
          error: 'OPENAI_API_KEY_INVALID'
        },
        { status: 500 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { fileName, fileUrl, fileUrls, isMultiFile, question } = body;
    const urls = fileUrls || (fileUrl ? [fileUrl] : []);

    console.log('Request body:', { fileName, urlCount: urls.length });

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
          
          const file = new File([buffer], safeFileName, { type: fileType });
          console.log(`File created: ${file.size} bytes`);

          // Upload to OpenAI
          console.log(`Uploading to OpenAI...`);
          const openaiFile = await openai.files.create({ 
            file, 
            purpose: 'assistants' 
          });
          
          console.log(`Successfully uploaded to OpenAI: ${openaiFile.id}`);
          fileIds.push(openaiFile.id);
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
                
                encodedImages.push({
                  type: 'image_url',
                  image_url: {
                    url: `data:${mimeType};base64,${base64}`,
                    detail: 'high'
                  }
                });
                console.log(`Successfully encoded file from ${url}`);
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
                    content: 'You are a medical AI assistant specializing in analyzing medical records. Your task is to provide a detailed and accurate summary of the medical record shown in the image. Focus on extracting key medical information such as diagnoses, test results, medications, vital signs, and any other clinically relevant details. Present the information in a clear, organized manner without adding interpretations beyond what is explicitly stated in the record.'
                  },
                  {
                    role: 'user',
                    content: [
                      {
                        type: 'text',
                        text: 'Please provide a detailed summary of this health record. Extract all relevant medical information visible in the document.'
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
            const fileReferences = fileIds.map(id => `file-${id}`).join(', ');
            
            const fallbackResponse = await openai.chat.completions.create({
              model: 'gpt-4o',
              messages: [
                {
                  role: 'system',
                  content: 'You are a medical AI assistant specializing in analyzing medical records. Extract and summarize key medical information from the provided images or documents.'
                },
                {
                  role: 'user',
                  content: `Analyze these medical records: ${fileReferences}`
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
      console.log('Saving record to Firestore');
      const docRef = await addDoc(collection(db, 'records'), {
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
      console.log('Fetching all records for holistic analysis');
      const recordsCollection = collection(db, 'records');
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
        const profileDoc = await getDoc(doc(db, 'profile', 'user'));
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
      
      await setDoc(doc(db, 'analysis', 'holistic'), { 
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

// Update the answerQuestion function to use summaries instead of original files
async function answerQuestion(question: string, fileIds: string[], summaries: string[]) {
  try {
    console.log(`Answering question with ${summaries.length} health record summaries`);
    
    // Get user profile information
    let profileInfo = "No profile information available.";
    try {
      const profileDoc = await getDoc(doc(db, 'profile', 'user'));
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