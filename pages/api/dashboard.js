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
      // สร้างข้อมูลตัวอย่าง 20 รายการ
      const mockFiles = [];
      const fileTypes = [
        { name: 'รูปภาพ', ext: '.jpg', mime: 'image/jpeg', sizeRange: [1, 5] },
        { name: 'เอกสาร', ext: '.pdf', mime: 'application/pdf', sizeRange: [0.5, 3] },
        { name: 'วิดีโอ', ext: '.mp4', mime: 'video/mp4', sizeRange: [10, 30] },
        { name: 'ไฟล์เสียง', ext: '.mp3', mime: 'audio/mpeg', sizeRange: [3, 8] },
        { name: 'สเปรดชีต', ext: '.xlsx', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', sizeRange: [0.2, 2] },
        { name: 'นำเสนอ', ext: '.pptx', mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', sizeRange: [1, 6] },
        { name: 'ข้อความ', ext: '.txt', mime: 'text/plain', sizeRange: [0.01, 0.5] },
      ];

      for (let i = 1; i <= 20; i++) {
        const fileType = fileTypes[Math.floor(Math.random() * fileTypes.length)];
        const size = (fileType.sizeRange[0] + Math.random() * (fileType.sizeRange[1] - fileType.sizeRange[0])).toFixed(2);
        const daysAgo = Math.floor(Math.random() * 30); // สุ่มวันที่ในช่วง 30 วันที่ผ่านมา

        mockFiles.push({
          id: `mock${i}`,
          name: `ตัวอย่าง${fileType.name}_${i}${fileType.ext}`,
          mimeType: fileType.mime,
          size: `${size} MB`,
          createdTime: new Date(Date.now() - (daysAgo * 86400000)).toLocaleString('th-TH'),
          webViewLink: `https://example.com/view${i}`
        });
      }

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
