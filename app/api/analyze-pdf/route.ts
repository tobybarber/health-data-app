import { NextRequest, NextResponse } from 'next/server';
import { doc, setDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase-admin';
import openai, { isApiKeyValid } from '../../lib/openai-server';

// Use Node.js runtime for this API route
export const runtime = "nodejs";

// Simple GET handler to check if the API is accessible
export async function GET() {
  return NextResponse.json({ 
    status: 'ok', 
    message: 'PDF Analysis API is running' 
  });
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
    const { fileName, fileUrl, userId } = body;

    console.log('Request body:', { fileName, fileUrl, userId });

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

    if (!fileUrl) {
      console.error('No fileUrl provided in request');
      return NextResponse.json(
        { 
          success: false, 
          message: 'File URL is required',
          error: 'FILE_URL_MISSING'
        },
        { status: 400 }
      );
    }

    // Process the PDF file
    try {
      console.log(`Fetching PDF file from: ${fileUrl}`);
      const fileResponse = await fetch(fileUrl);
      console.log(`Fetch status: ${fileResponse.status}, OK: ${fileResponse.ok}`);
      
      if (!fileResponse.ok) {
        throw new Error(`Fetch failed with status: ${fileResponse.status}`);
      }

      const blob = await fileResponse.blob();
      console.log(`Blob size: ${blob.size} bytes, type: ${blob.type || 'unknown'}`);

      if (blob.size === 0) {
        throw new Error('Downloaded file is empty');
      }

      // Convert blob to base64
      const buffer = Buffer.from(await blob.arrayBuffer());
      const base64Data = buffer.toString('base64');
      const dataUri = `data:${blob.type || 'application/pdf'};base64,${base64Data}`;
      
      // Use the OpenAI Responses API to analyze the PDF
      console.log('Using OpenAI Responses API to analyze the PDF');
      
      const responseData = await openai.responses.create({
        model: "gpt-4o",
        instructions: "You are a medical AI assistant specializing in analyzing medical records. Your task is to provide a detailed and accurate summary of the medical record. Focus on extracting key medical information such as diagnoses, test results, medications, vital signs, and any other clinically relevant details. Present the information in a clear, organized manner.",
        input: [
          {
            type: "message",
            role: "user",
            content: [
              {
                type: "input_text",
                text: "Please analyze this medical record PDF and provide a detailed summary. Extract key information such as diagnoses, medications, test results, vital signs, and any other important medical details."
              },
              {
                type: "input_image",
                image_url: dataUri
              }
            ]
          }
        ],
        max_output_tokens: 4000
      });
      
      // Extract the analysis from the response
      const analysis = responseData.output_text || 'No analysis available';
      console.log(`Successfully generated analysis with ${analysis.length} characters`);
      
      // Store the analysis in Firestore
      const recordData = {
        fileName,
        fileUrl,
        analysis,
        createdAt: serverTimestamp(),
        userId
      };
      
      // Add to Firestore
      const recordRef = await addDoc(collection(db, 'records'), recordData);
      console.log(`Record saved to Firestore with ID: ${recordRef.id}`);
      
      // Return the analysis and record ID
      return NextResponse.json({
        success: true,
        recordId: recordRef.id,
        analysis
      });
      
    } catch (error: any) {
      console.error('Error analyzing PDF:', error);
      return NextResponse.json(
        { 
          success: false, 
          message: `Error analyzing PDF: ${error.message || String(error)}`,
          error: 'PDF_ANALYSIS_ERROR'
        },
        { status: 500 }
      );
    }
    
  } catch (error: any) {
    console.error('Error in PDF analysis API:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: `Server error: ${error.message || String(error)}`,
        error: 'SERVER_ERROR'
      },
      { status: 500 }
    );
  }
} 