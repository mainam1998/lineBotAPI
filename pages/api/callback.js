// Simple version for debugging
export default async function handler(req, res) {
  try {
    console.log('Received webhook request');

    // Return basic information about the request
    return res.status(200).json({
      status: 'ok',
      message: 'Webhook received',
      method: req.method,
      body: req.body,
      headers: req.headers,
      env: {
        LINE_CHANNEL_SECRET_EXISTS: !!process.env.LINE_CHANNEL_SECRET,
        LINE_CHANNEL_ACCESS_TOKEN_EXISTS: !!process.env.LINE_CHANNEL_ACCESS_TOKEN,
        GOOGLE_CLIENT_EMAIL_EXISTS: !!process.env.GOOGLE_CLIENT_EMAIL,
        GOOGLE_PRIVATE_KEY_EXISTS: !!process.env.GOOGLE_PRIVATE_KEY,
        GOOGLE_DRIVE_FOLDER_ID_EXISTS: !!process.env.GOOGLE_DRIVE_FOLDER_ID
      }
    });
  } catch (error) {
    console.error('Error in webhook handler:', error);
    return res.status(200).json({ error: 'Internal server error' });
  }
}
