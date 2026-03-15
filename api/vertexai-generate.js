/**
 * Vercel Serverless Function - Vertex AI API Handler
 * Handles calls từ frontend, sử dụng service account credentials để gọi Vertex AI
 */

const { GoogleAuth } = require('google-auth-library');

// Initialize GoogleAuth với service account credentials
function getGoogleAuth() {
  const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const serviceAccountPrivateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const projectId = process.env.GCP_PROJECT_ID;

  if (!serviceAccountEmail || !serviceAccountPrivateKey || !projectId) {
    throw new Error('Missing GCP credentials in environment variables');
  }

  return new GoogleAuth({
    credentials: {
      type: 'service_account',
      project_id: projectId,
      private_key_id: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY_ID,
      private_key: serviceAccountPrivateKey,
      client_email: serviceAccountEmail,
      client_id: process.env.GOOGLE_CLIENT_ID,
      auth_uri: 'https://accounts.google.com/o/oauth2/auth',
      token_uri: 'https://oauth2.googleapis.com/token',
      auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
    },
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  });
}

/**
 * Call Vertex AI API using service account
 */
async function callVertexAI(modelName, prompt, maxOutputTokens = 8192) {
  try {
    const projectId = process.env.GCP_PROJECT_ID;
    const location = process.env.GCP_LOCATION || 'us-central1';

    if (!projectId) {
      throw new Error('GCP_PROJECT_ID not configured');
    }

    const auth = getGoogleAuth();
    const client = await auth.getClient();

    // Vertex AI endpoint
    const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${modelName}:generateContent`;

    const requestBody = {
      contents: [{
        role: "user",
        parts: [{
          text: prompt
        }]
      }],
      generationConfig: {
        temperature: 0.7,
        topP: 0.95,
        topK: 40,
        maxOutputTokens: maxOutputTokens,
      }
    };

    console.log(`📤 Calling Vertex AI - Model: ${modelName}, Endpoint: ${endpoint}`);

    const response = await client.request({
      url: endpoint,
      method: 'POST',
      data: requestBody,
    });

    const candidate = response.data?.candidates?.[0];
    const content = candidate?.content?.parts?.[0]?.text || '';
    const finishReason = candidate?.finishReason;
    const usage = response.data?.usageMetadata;

    console.log(`✅ Response - Length: ${content.length}, finishReason: ${finishReason}, tokens: ${usage?.totalTokenCount}/${usage?.promptTokenCount}+${usage?.candidatesTokenCount}`);

    if (finishReason !== 'STOP') {
      console.warn(`⚠️ Response may be incomplete. Finish reason: ${finishReason}`);
    }

    return {
      success: true,
      content: content,
      finishReason: finishReason,
      usage: usage
    };

  } catch (error) {
    console.error('❌ Vertex AI Error:', error.message);
    return {
      success: false,
      error: error.message,
      content: ''
    };
  }
}

/**
 * Main handler
 */
module.exports = async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { modelName, prompt, maxOutputTokens } = req.body;

    if (!modelName || !prompt) {
      return res.status(400).json({ error: 'modelName and prompt are required' });
    }

    const result = await callVertexAI(modelName, prompt, maxOutputTokens || 8192);
    res.status(result.success ? 200 : 500).json(result);

  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
