import { initGoogleDrive, modernUpload } from '../../utils/googleDriveModern';

export default async function handler(req, res) {
  try {
    console.log('Testing Google Drive upload with dummy file');
    
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
      const drive = initGoogleDrive();
      
      // Create a test file buffer
      const testContent = `Test file created at ${new Date().toISOString()}`;
      const buffer = Buffer.from(testContent, 'utf8');
      const fileName = `test_${Date.now()}.txt`;
      
      console.log('Attempting to upload test file:', fileName);
      
      // Test upload
      const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID || 'root';
      const uploadResult = await modernUpload(
        drive,
        fileName,
        buffer,
        folderId
      );
      
      return res.status(200).json({ 
        status: 'success',
        message: 'Google Drive upload test successful',
        uploadResult,
        folderId,
        fileName,
        fileSize: buffer.length
      });
      
    } catch (uploadError) {
      console.error('Upload test failed:', uploadError);
      return res.status(200).json({ 
        status: 'error',
        message: 'Google Drive upload test failed',
        error: uploadError.message,
        stack: uploadError.stack
      });
    }
    
  } catch (error) {
    console.error('Test endpoint error:', error);
    return res.status(500).json({ 
      status: 'error',
      message: 'Test endpoint error',
      error: error.message
    });
  }
}
