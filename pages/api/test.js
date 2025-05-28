export default function handler(req, res) {
  res.status(200).json({ 
    status: 'ok',
    message: 'Test API is working',
    method: req.method,
    query: req.query,
    env: {
      LINE_CHANNEL_SECRET_EXISTS: !!process.env.LINE_CHANNEL_SECRET,
      LINE_CHANNEL_ACCESS_TOKEN_EXISTS: !!process.env.LINE_CHANNEL_ACCESS_TOKEN,
      GOOGLE_CLIENT_EMAIL_EXISTS: !!process.env.GOOGLE_CLIENT_EMAIL,
      GOOGLE_PRIVATE_KEY_EXISTS: !!process.env.GOOGLE_PRIVATE_KEY,
      GOOGLE_DRIVE_FOLDER_ID_EXISTS: !!process.env.GOOGLE_DRIVE_FOLDER_ID
    }
  });
}
