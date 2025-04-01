// Script to pre-warm Next.js API routes
const fetch = require('node-fetch');
const { setTimeout } = require('timers/promises');

// Base URL (adjust based on your dev/prod environment)
const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

// List of API routes to pre-warm, in the order they should be warmed
const routesToWarm = [
  // Start with simpler endpoints
  '/api/check-api-key',
  // Then warm the RAG endpoint with a GET request
  { path: '/api/rag/build-index', params: '?userId=test-user' },
  // Finally warm the most complex endpoint - the question API
  { 
    path: '/api/question',
    method: 'POST',
    body: {
      question: 'This is a pre-warming test query',
      userId: 'test-user',
      isGuest: true,
      previousResponseId: null
    }
  }
];

async function warmRoute(route) {
  const isObjectRoute = typeof route === 'object';
  const path = isObjectRoute ? route.path : route;
  const method = isObjectRoute ? (route.method || 'GET') : 'GET';
  const params = isObjectRoute && route.params ? route.params : '';
  const body = isObjectRoute ? route.body : null;

  try {
    console.log(`Pre-warming route: ${path} (${method})...`);
    console.log(`This will trigger compilation of all modules imported by this endpoint`);
    const start = Date.now();
    
    let response;
    
    if (method === 'GET') {
      response = await fetch(`${baseUrl}${path}${params}`);
    } else {
      response = await fetch(`${baseUrl}${path}`, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
      });
    }
    
    const duration = (Date.now() - start) / 1000;
    console.log(`✅ Route ${path} pre-warmed in ${duration.toFixed(2)}s (Status: ${response.status})`);
    
    if (!response.ok) {
      console.log(`Note: Got status ${response.status}, but this is expected for pre-warming`);
    }
    
    // Try to get response text for additional info
    try {
      const text = await response.text();
      console.log(`Response preview: ${text.substring(0, 100)}...`);
    } catch (e) {
      // Ignore errors reading response
    }
  } catch (error) {
    console.error(`❌ Failed to pre-warm ${path}:`, error.message);
  }
}

async function preWarmRoutes() {
  console.log('🔥 Starting API routes pre-warming...');
  console.log('This will trigger compilation of each endpoint to avoid cold starts for users');
  
  // Add a delay to ensure server is fully started
  console.log('Waiting for server to start...');
  await setTimeout(5000);
  
  // Warm routes in sequence
  for (const route of routesToWarm) {
    await warmRoute(route);
    // Small delay between requests
    await setTimeout(1000);
  }
  
  console.log('🎉 Pre-warming complete! All routes should now be compiled.');
  console.log('Subsequent requests should be much faster.');
}

preWarmRoutes().catch(console.error); 