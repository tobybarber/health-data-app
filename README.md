# My Health Data App

A personal health data prototype that allows you to upload medical records (PDFs, images, etc.) and analyze them using AI. The app provides a holistic analysis of your health records and allows you to ask follow-up questions.


## Features

- Upload medical records (PDF, JPG, PNG)
- AI analysis of individual records
- Holistic analysis of all your health records
- Ask follow-up questions about your health data
- Clean, professional UI designed for iPhone

## Technologies Used

- Next.js with TypeScript
- Firebase (Storage and Firestore)
- OpenAI API (GPT-4 Vision)
- Tailwind CSS

## Setup Instructions

1. Clone this repository
2. Install dependencies:
   ```
   npm install
   ```
3. **IMPORTANT**: Create a `.env.local` file in the root directory with the following variables:
   ```
   # Firebase Configuration
   NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_firebase_auth_domain
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_firebase_project_id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_firebase_storage_bucket
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_firebase_messaging_sender_id
   NEXT_PUBLIC_FIREBASE_APP_ID=your_firebase_app_id

   # OpenAI API Key - REQUIRED for analysis features
   OPENAI_API_KEY=your_openai_api_key
   ```
   
   > **Note**: The OpenAI API key is required for the AI analysis features. Without it, you can still upload files, but the analysis will be skipped.

4. Run the development server:
   ```
   npm run dev
   ```
5. Open [http://localhost:3000](http://localhost:3000) in your browser

## Firebase Setup

1. Create a new Firebase project at [https://console.firebase.google.com/](https://console.firebase.google.com/)
2. Enable Firestore Database and Storage
3. Set up Storage rules to allow read/write access
4. Get your Firebase configuration from Project Settings > General > Your apps > SDK setup and configuration

## OpenAI Setup

1. Create an account at [https://platform.openai.com/](https://platform.openai.com/)
2. Generate an API key from the API Keys section: [https://platform.openai.com/api-keys](https://platform.openai.com/api-keys)
3. Make sure you have access to GPT-4 Vision API
4. Add your API key to the `.env.local` file as shown above

## Troubleshooting

### "OpenAI API Key Issue" Error

If you see an error about the OpenAI API key:

1. Make sure you've created a `.env.local` file in the project root
2. Add your OpenAI API key: `OPENAI_API_KEY=your_api_key_here`
3. Restart the development server

### Analysis Features Not Working

The app requires a valid OpenAI API key for the analysis features to work. Without it:
- You can still upload files
- Files will be stored in Firebase
- Analysis features will be skipped

## Notes

- This app is designed for personal use and does not include authentication or security features
- The app uses GPT-4 Vision to analyze medical records directly in their native format
- For optimal performance, ensure your OpenAI account has sufficient API credits 