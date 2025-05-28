import { google } from 'googleapis';

export default async function handler(req, res) {
  try {
    console.log('Testing Google Drive API connection');
    
    // Check if Google Drive credentials are set
    if (!process.env.GOOGLE_CLIENT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
      return res.status(200).json({ 
        status: 'error',
        message: 'Google Drive credentials are not set',
        env: {
          GOOGLE_CLIENT_EMAIL_EXISTS: !!process.env.GOOGLE_CLIENT_EMAIL,
          GOOGLE_PRIVATE_KEY_EXISTS: !!process.env.GOOGLE_PRIVATE_KEY,
          GOOGLE_DRIVE_FOLDER_ID_EXISTS: !!process.env.GOOGLE_DRIVE_FOLDER_ID
        }
      });
    }
    
    // Initialize Google Drive client
    try {
      const auth = new google.auth.JWT(
        process.env.GOOGLE_CLIENT_EMAIL,
        null,
        process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        ['https://www.googleapis.com/auth/drive.file']
      );
      
      const drive = google.drive({ version: 'v3', auth });
      
      // Test connection by listing files
      const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID || 'root';
      const response = await drive.files.list({
        q: `'${folderId}' in parents and trashed = false`,
        fields: 'files(id, name)',
        pageSize: 5
      });
      
      return res.status(200).json({ 
        status: 'ok',
        message: 'Google Drive API connection successful',
        files: response.data.files,
        folderId
      });
    } catch (driveError) {
      console.error('Error connecting to Google Drive API:', driveError);
      
      // Check if the error is related to the private key format
      const errorMessage = driveError.message || '';
      const isProbablyPrivateKeyError = 
        errorMessage.includes('private_key') || 
        errorMessage.includes('PRIVATE KEY');
      
      return res.status(200).json({ 
        status: 'error',
        message: 'Failed to connect to Google Drive API',
        error: driveError.message,
        privateKeyHint: isProbablyPrivateKeyError ? 
          'The error might be related to the private key format. Make sure newlines are properly escaped.' : 
          undefined
      });
    }
  } catch (error) {
    console.error('Error in Google Drive test handler:', error);
    return res.status(200).json({ 
      status: 'error',
      message: 'Internal server error',
      error: error.message
    });
  }
}
