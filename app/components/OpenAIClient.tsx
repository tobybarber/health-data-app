'use client';

// Function to call the server-side API
export async function getOpenAIResponse(prompt: string): Promise<string> {
  try {
    const response = await fetch('/api/openai', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'API request failed');
    return data.result;
  } catch (error) {
    console.error('Error fetching OpenAI response:', error);
    throw error;
  }
}

// Example usage
async function testOpenAI() {
  try {
    const result = await getOpenAIResponse('Hello, how are you?');
    console.log('OpenAI response:', result);
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testOpenAI(); 