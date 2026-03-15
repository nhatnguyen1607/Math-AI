/**
 * Local Backend Server for Vertex AI API
 * Run: node src/server/index.js
 * Or add to package.json scripts: "server": "node src/server/index.js"
 */

const express = require('express');
const cors = require('cors');
const { GoogleAuth } = require('google-auth-library');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;
const corsOptions = {
  origin: [
    'http://localhost:3000',
    'https://math-ai-vert.vercel.app',
    process.env.FRONTEND_URL || 'https://math-ai-vert.vercel.app'
  ],
  methods: ['GET', 'POST', 'OPTIONS'],
  credentials: true
};

app.use(cors(corsOptions));
app.use(express.json());

// Handle preflight requests
app.options(/(.*)/, cors(corsOptions));
/**
 * Load service account credentials từ file JSON
 */
function loadServiceAccountCredentials() {
  try {
    // Try to load from env variable first (for Vercel/production)
    if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
      return JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
    }

    // Try to load from file (for local development)
    const credPath = path.join(__dirname, '../../google-service-account.json');
    if (fs.existsSync(credPath)) {
      const credentials = JSON.parse(fs.readFileSync(credPath, 'utf8'));
      console.log('✅ Loaded service account from file:', credPath);
      return credentials;
    }

    throw new Error('Service account credentials not found');
  } catch (error) {
    console.error('❌ Failed to load service account credentials:', error.message);
    return null;
  }
}

/**
 * Get Google Auth client
 */
async function getGoogleAuthClient() {
  const credentials = loadServiceAccountCredentials();
  
  if (!credentials) {
    throw new Error('Service account credentials not configured. Place google-service-account.json in project root or set GOOGLE_SERVICE_ACCOUNT_JSON env variable');
  }

  const auth = new GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  });

  return auth.getClient();
}

/**
 * Vertex AI API endpoint
 */
app.post('/api/vertexai-generate', async (req, res) => {
  try {
    const { modelName, prompt, maxOutputTokens = 16384 } = req.body;

    if (!modelName || !prompt) {
      return res.status(400).json({
        success: false,
        error: 'modelName and prompt are required'
      });
    }

    const credentials = loadServiceAccountCredentials();
    if (!credentials) {
      return res.status(500).json({
        success: false,
        error: 'Service account credentials not configured'
      });
    }

    const projectId = credentials.project_id;
    const location = process.env.GCP_LOCATION || 'us-central1';

    const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${modelName}:generateContent`;

    console.log(`📤 Calling Vertex AI - Model: ${modelName}`);

    const client = await getGoogleAuthClient();
    
    const response = await client.request({
      url: endpoint,
      method: 'POST',
      data: {
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
      }
    });

    const candidate = response.data?.candidates?.[0];
    const content = candidate?.content?.parts?.[0]?.text || '';
    const finishReason = candidate?.finishReason;
    const usage = response.data?.usageMetadata;

    console.log(`✅ Response - Length: ${content.length}, finishReason: ${finishReason}, tokens: ${usage?.totalTokenCount}/${usage?.promptTokenCount}+${usage?.candidatesTokenCount}`);

    if (finishReason !== 'STOP') {
      console.warn(`⚠️ Response may be incomplete. Finish reason: ${finishReason}`);
    }

    res.json({
      success: true,
      content: content,
      finishReason: finishReason,
      usage: usage
    });

  } catch (error) {
    console.error('❌ API Error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/**
 * Start server
 */
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n╔════════════════════════════════════════╗`);
  console.log(`║  Vertex AI Backend Server              ║`);
  console.log(`║  Running on port: ${PORT}                   ║`);
  console.log(`╚════════════════════════════════════════╝\n`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});
