import { initGoogleDrive, listFiles } from '../../utils/googleDrive';

export default async function handler(req, res) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Check if Google Drive credentials are set
    if (!process.env.GOOGLE_CLIENT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
      // ถ้าไม่มีการตั้งค่า credentials ให้ส่งข้อมูลตัวอย่างกลับไปเพื่อการทดสอบ UI
      const mockFiles = [
        {
          id: 'mock1',
          name: 'ตัวอย่างรูปภาพ.jpg',
          mimeType: 'image/jpeg',
          size: '2.50 MB',
          createdTime: new Date().toLocaleString('th-TH'),
          webViewLink: 'https://example.com/view1'
        },
        {
          id: 'mock2',
          name: 'ตัวอย่างเอกสาร.pdf',
          mimeType: 'application/pdf',
          size: '1.25 MB',
          createdTime: new Date(Date.now() - 86400000).toLocaleString('th-TH'), // เมื่อวาน
          webViewLink: 'https://example.com/view2'
        },
        {
          id: 'mock3',
          name: 'ตัวอย่างวิดีโอ.mp4',
          mimeType: 'video/mp4',
          size: '15.75 MB',
          createdTime: new Date(Date.now() - 172800000).toLocaleString('th-TH'), // 2 วันก่อน
          webViewLink: 'https://example.com/view3'
        }
      ];

      return res.status(200).json({
        status: 'warning',
        message: 'กำลังใช้ข้อมูลตัวอย่าง เนื่องจากไม่ได้ตั้งค่า Google Drive credentials',
        files: mockFiles
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
        message: 'Failed to retrieve files from Google Drive',
        error: driveError.message,
        files: []
      });
    }
  } catch (error) {
    console.error('Error in dashboard handler:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Internal server error',
      error: error.message,
      files: []
    });
  }
}
