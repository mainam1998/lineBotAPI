import { google } from 'googleapis';

export default async function handler(req, res) {
  try {
    console.log('Testing Google Drive API connection');

    // Check if Google Drive credentials are set (support both old and new variable names)
    const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || process.env.GOOGLE_CLIENT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY;
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

    console.log('Service Account Email:', serviceAccountEmail);
    console.log('Private Key exists:', !!privateKey);
    console.log('Folder ID:', folderId);

    if (!serviceAccountEmail || !privateKey) {
      return res.status(200).json({
        status: 'error',
        message: 'ไม่สามารถเชื่อมต่อ Google Drive ได้ - ไม่ได้ตั้งค่า credentials',
        details: {
          serviceAccountEmail: serviceAccountEmail || 'ไม่ได้ตั้งค่า',
          privateKeyExists: !!privateKey,
          folderIdExists: !!folderId,
          env: {
            GOOGLE_SERVICE_ACCOUNT_EMAIL_EXISTS: !!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
            GOOGLE_CLIENT_EMAIL_EXISTS: !!process.env.GOOGLE_CLIENT_EMAIL,
            GOOGLE_PRIVATE_KEY_EXISTS: !!process.env.GOOGLE_PRIVATE_KEY,
            GOOGLE_DRIVE_FOLDER_ID_EXISTS: !!process.env.GOOGLE_DRIVE_FOLDER_ID
          }
        }
      });
    }

    // Initialize Google Drive client
    try {
      const auth = new google.auth.JWT(
        serviceAccountEmail,
        null,
        privateKey?.replace(/\\n/g, '\n'),
        ['https://www.googleapis.com/auth/drive.file']
      );

      const drive = google.drive({ version: 'v3', auth });

      // Test folder access
      console.log('Testing folder access...');
      const folderResponse = await drive.files.get({
        fileId: folderId,
        fields: 'id, name'
      });

      console.log('Folder access successful:', folderResponse.data);

      // Test connection by listing files
      console.log('Listing files...');
      const response = await drive.files.list({
        q: `'${folderId}' in parents and trashed = false`,
        fields: 'files(id, name, mimeType, size, createdTime)',
        pageSize: 10
      });

      console.log('Files found:', response.data.files.length);

      return res.status(200).json({
        status: 'ok',
        message: `เชื่อมต่อ Google Drive สำเร็จ! พบ ${response.data.files.length} ไฟล์ในโฟลเดอร์ "${folderResponse.data.name}"`,
        details: {
          folder: {
            id: folderResponse.data.id,
            name: folderResponse.data.name
          },
          fileCount: response.data.files.length,
          files: response.data.files.map(file => ({
            name: file.name,
            size: file.size ? `${(parseInt(file.size) / (1024 * 1024)).toFixed(2)} MB` : 'ไม่ระบุ',
            type: file.mimeType,
            created: file.createdTime ? new Date(file.createdTime).toLocaleString('th-TH') : 'ไม่ระบุ'
          })),
          serviceAccount: serviceAccountEmail,
          folderId: folderId
        }
      });

    } catch (driveError) {
      console.error('Drive API Error:', driveError);

      let errorMessage = 'ไม่สามารถเชื่อมต่อ Google Drive ได้';
      let suggestions = [];

      if (driveError.message.includes('invalid_grant')) {
        errorMessage = 'ข้อมูล Service Account ไม่ถูกต้อง';
        suggestions = [
          'ตรวจสอบ Private Key format',
          'ตรวจสอบ Service Account Email',
          'ตรวจสอบว่า Service Account ยังใช้งานได้'
        ];
      } else if (driveError.message.includes('File not found') || driveError.code === 404) {
        errorMessage = 'ไม่พบโฟลเดอร์ Google Drive หรือไม่มีสิทธิ์เข้าถึง';
        suggestions = [
          'ตรวจสอบ Folder ID ให้ถูกต้อง',
          'แชร์โฟลเดอร์ให้ Service Account Email',
          'ให้สิทธิ์ Editor หรือ Owner'
        ];
      } else if (driveError.message.includes('insufficient permissions') || driveError.code === 403) {
        errorMessage = 'ไม่มีสิทธิ์เข้าถึงโฟลเดอร์ Google Drive';
        suggestions = [
          'แชร์โฟลเดอร์ให้ Service Account Email',
          'ให้สิทธิ์ Editor หรือ Owner',
          'ตรวจสอบว่า Google Drive API เปิดใช้งานแล้ว'
        ];
      } else if (driveError.message.includes('API key not valid')) {
        errorMessage = 'Google Drive API ไม่ได้เปิดใช้งาน';
        suggestions = [
          'เปิดใช้งาน Google Drive API ใน Google Cloud Console',
          'ตรวจสอบ Project ID ให้ถูกต้อง'
        ];
      }

      return res.status(200).json({
        status: 'error',
        message: errorMessage,
        details: {
          originalError: driveError.message,
          code: driveError.code,
          suggestions: suggestions,
          serviceAccount: serviceAccountEmail,
          folderId: folderId,
          folderUrl: `https://drive.google.com/drive/folders/${folderId}`
        }
      });
    }

  } catch (error) {
    console.error('Handler Error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Internal server error',
      error: error.message
    });
  }
}
