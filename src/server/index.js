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
const PORT = parseInt(process.env.PORT) || 8080;
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      'https://math-ai-ued.vercel.app',
      'http://localhost:3000'
    ];
    // Cho phép các domain trong list hoặc request không có origin (như Postman)
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('CORS Policy: Origin not allowed'));
    }
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
// Xử lý riêng cho các yêu cầu OPTIONS từ trình duyệt
app.options(/(.*)/, cors(corsOptions));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Debug middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`, 'Body:', req.body);
  next();
});

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
 * Google Cloud Text-to-Speech API endpoint
 * Converts text to natural Vietnamese speech using WaveNet voices
 */
app.post('/api/tts', async (req, res) => {
  try {
    const { text, voiceGender = 'FEMALE' } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'text is required and must be a string'
      });
    }

    // Giới hạn tối đa 5000 ký tự mỗi lần gọi
    const trimmedText = text.slice(0, 5000);

    const credentials = loadServiceAccountCredentials();
    if (!credentials) {
      return res.status(500).json({
        success: false,
        error: 'Service account credentials not configured'
      });
    }

    const client = await getGoogleAuthClient();

    // Chọn voice theo giới tính
    const voiceName = voiceGender === 'MALE' ? 'vi-VN-Wavenet-B' : 'vi-VN-Wavenet-A';

    const ttsEndpoint = 'https://texttospeech.googleapis.com/v1/text:synthesize';

    console.log(`🔊 TTS Request - Voice: ${voiceName}, Text: "${trimmedText.substring(0, 50)}..."`);

    const response = await client.request({
      url: ttsEndpoint,
      method: 'POST',
      data: {
        input: { text: trimmedText },
        voice: {
          languageCode: 'vi-VN',
          name: voiceName,
          ssmlGender: voiceGender
        },
        audioConfig: {
          audioEncoding: 'MP3',
          speakingRate: 1.0,
          pitch: 0
        }
      }
    });

    const audioContent = response.data?.audioContent;

    if (!audioContent) {
      console.error('❌ TTS Error: No audioContent in response', response.data);
      throw new Error('Google Cloud TTS không trả về nội dung âm thanh.');
    }

    console.log(`✅ TTS Success - Audio size: ${audioContent.length} bytes`);

    res.json({
      success: true,
      audioContent: audioContent
    });

  } catch (error) {
    console.error('❌ TTS API Error Details:', error.response?.data || error.message);
    
    let errorMessage = error.message;
    if (error.response?.status === 403) {
      errorMessage = 'Text-to-Speech API chưa được bật hoặc không có quyền truy cập. Hãy bật API trong Google Cloud Console.';
    } else if (error.response?.status === 429) {
      errorMessage = 'Đã hết hạn mức (Quota) cho dịch vụ Text-to-Speech.';
    }

    res.status(error.response?.status || 500).json({
      success: false,
      error: errorMessage
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
  console.log(`Server is listening on 0.0.0.0:${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});
