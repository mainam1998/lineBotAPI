import { initGoogleDrive, listFiles } from '../../utils/googleDriveModern';

export default async function handler(req, res) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Check if Google Drive credentials are set (support both old and new variable names)
    const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || process.env.GOOGLE_CLIENT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY;

    if (!serviceAccountEmail || !privateKey) {
      return res.status(200).json({
        status: 'error',
        message: 'ไม่สามารถเชื่อมต่อ Google Drive ได้ - ไม่ได้ตั้งค่า credentials',
        files: []
      });
    }

    // Initialize Google Drive client
    try {
      const drive = initGoogleDrive();

      // Get folder ID from environment or use root
      const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID || 'root';

      // List files in the folder
      const files = await listFiles(drive, folderId);

      // Format the files data
      const formattedFiles = files.map(file => {
        // Format the created time
        const createdTime = file.createdTime ? new Date(file.createdTime) : null;
        const formattedDate = createdTime ?
          `${createdTime.toLocaleDateString('th-TH')} ${createdTime.toLocaleTimeString('th-TH')}` :
          'ไม่ระบุ';

        // Format the file size
        const fileSize = file.size ?
          `${(parseInt(file.size) / (1024 * 1024)).toFixed(2)} MB` :
          'ไม่ระบุ';

        return {
          id: file.id,
          name: file.name,
          mimeType: file.mimeType,
          size: fileSize,
          createdTime: formattedDate,
          webViewLink: file.webViewLink || null
        };
      });

      return res.status(200).json({
        status: 'ok',
        message: 'Files retrieved successfully',
        files: formattedFiles,
        folderId
      });
    } catch (driveError) {
      console.error('Error retrieving files from Google Drive:', driveError);
      return res.status(200).json({
        status: 'error',
        message: 'ไม่สามารถเชื่อมต่อ Google Drive ได้',
        error: driveError.message,
        files: []
      });
    }
  } catch (error) {
    console.error('Error in dashboard handler:', error);
    return res.status(500).json({
      status: 'error',
      message: 'ไม่สามารถเชื่อมต่อ Google Drive ได้',
      error: error.message,
      files: []
    });
  }
}
