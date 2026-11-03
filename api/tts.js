const { GoogleAuth } = require('google-auth-library');

function getGoogleAuth() {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey =
    process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const projectId = process.env.GCP_PROJECT_ID;

  if (!clientEmail || !privateKey || !projectId) {
    throw new Error('Missing Google Cloud credentials');
  }

  return new GoogleAuth({
    credentials: {
      type: 'service_account',
      project_id: projectId,
      private_key_id:
        process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY_ID,
      private_key: privateKey,
      client_email: clientEmail,
      client_id: process.env.GOOGLE_CLIENT_ID,
      auth_uri: 'https://accounts.google.com/o/oauth2/auth',
      token_uri: 'https://oauth2.googleapis.com/token',
      auth_provider_x509_cert_url:
        'https://www.googleapis.com/oauth2/v1/certs',
    },
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  });
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed',
    });
  }

  try {
    const { text, voiceGender = 'FEMALE' } = req.body || {};

    if (!text || typeof text !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'text is required and must be a string',
      });
    }

    // Giữ response đủ nhỏ so với giới hạn 4.5 MB của Vercel
    const trimmedText = text.slice(0, 5000);

    const auth = getGoogleAuth();
    const client = await auth.getClient();

    const voiceName =
      voiceGender === 'MALE'
        ? 'vi-VN-Wavenet-B'
        : 'vi-VN-Wavenet-A';

    const response = await client.request({
      url: 'https://texttospeech.googleapis.com/v1/text:synthesize',
      method: 'POST',
      data: {
        input: {
          text: trimmedText,
        },
        voice: {
          languageCode: 'vi-VN',
          name: voiceName,
          ssmlGender: voiceGender,
        },
        audioConfig: {
          audioEncoding: 'MP3',
          speakingRate: 1.0,
          pitch: 0,
        },
      },
    });

    const audioContent = response.data?.audioContent;

    if (!audioContent) {
      throw new Error(
        'Google Cloud Text-to-Speech không trả về audioContent'
      );
    }

    const responseSize = Buffer.byteLength(
      JSON.stringify({ success: true, audioContent }),
      'utf8'
    );

    console.log(
      `TTS Success - Response size: ${(responseSize / 1024).toFixed(2)} KB`
    );

    return res.status(200).json({
      success: true,
      audioContent,
    });
  } catch (error) {
    console.error(
      'TTS API Error:',
      error.response?.data || error.message
    );

    let errorMessage = error.message;
    const status = error.response?.status || 500;

    if (status === 403) {
      errorMessage =
        'Text-to-Speech API chưa được bật hoặc Service Account không có quyền.';
    } else if (status === 429) {
      errorMessage =
        'Đã vượt quota Google Cloud Text-to-Speech.';
    }

    return res.status(status).json({
      success: false,
      error: errorMessage,
    });
  }
};