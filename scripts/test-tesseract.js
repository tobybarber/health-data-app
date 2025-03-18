const { createWorker } = require('tesseract.js');
const fs = require('fs');
const path = require('path');

// Set tessdata path environment variable
process.env.TESSDATA_PREFIX = 'C:\\Program Files\\Tesseract-OCR\\tessdata';

async function testTesseract() {
  try {
    console.log('Starting Tesseract.js test...');
    
    // Log the environment
    console.log('Tesseract environment:');
    console.log('- Platform:', process.platform);
    console.log('- TESSDATA_PREFIX:', process.env.TESSDATA_PREFIX);
    
    // Check if tessdata directory exists
    if (process.env.TESSDATA_PREFIX) {
      const exists = fs.existsSync(process.env.TESSDATA_PREFIX);
      console.log('- Tessdata directory exists:', exists);
      
      if (exists) {
        // Check if eng.traineddata exists
        const engTrainedData = path.join(process.env.TESSDATA_PREFIX, 'eng.traineddata');
        console.log('- eng.traineddata exists:', fs.existsSync(engTrainedData));
      }
    }
    
    // Initialize worker with bare minimum options
    const worker = await createWorker();
    
    // Recognize text from a test image
    const testImageUrl = 'https://tesseract.projectnaptha.com/img/eng_bw.png';
    console.log('Recognizing text from:', testImageUrl);
    
    const { data } = await worker.recognize(testImageUrl);
    
    console.log('Extracted text:');
    console.log(data.text);
    
    // Terminate worker
    await worker.terminate();
    
    console.log('Tesseract.js test completed successfully!');
  } catch (error) {
    console.error('Error in Tesseract.js test:', error);
  }
}

// Run the test
testTesseract(); 