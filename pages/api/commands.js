import { initLineClient } from '../../utils/lineClient';
import { initGoogleDrive, listFiles } from '../../utils/googleDrive';

/**
 * Handle text commands from LINE
 * @param {Object} event - LINE webhook event
 * @returns {Promise<Object|null>} Response message or null
 */
const handleCommand = async (event) => {
  const text = event.message.text.trim().toLowerCase();
  
  // Initialize clients
  const lineClient = initLineClient();
  const drive = initGoogleDrive();
  
  // Handle commands
  if (text === 'help' || text === 'ช่วยเหลือ') {
    return {
      type: 'text',
      text: `คำสั่งที่ใช้ได้:
- help หรือ ช่วยเหลือ: แสดงคำสั่งที่ใช้ได้
- status หรือ สถานะ: แสดงสถานะของบอท
- list หรือ รายการ: แสดงรายการไฟล์ล่าสุด
- ส่งไฟล์มาเพื่ออัปโหลดไปยัง Google Drive`,
    };
  }
  
  if (text === 'status' || text === 'สถานะ') {
    const botInfo = await lineClient.getBotInfo();
    
    return {
      type: 'text',
      text: `สถานะของบอท:
- ชื่อ: ${botInfo.displayName}
- รูปภาพ: ${botInfo.pictureUrl || 'ไม่มี'}
- สถานะ: พร้อมใช้งาน
- โฟลเดอร์: ${process.env.GOOGLE_DRIVE_FOLDER_ID ? 'กำหนดแล้ว' : 'ยังไม่ได้กำหนด'}`,
    };
  }
  
  if (text === 'list' || text === 'รายการ') {
    const files = await listFiles(drive, process.env.GOOGLE_DRIVE_FOLDER_ID || 'root');
    
    if (files.length === 0) {
      return {
        type: 'text',
        text: 'ไม่พบไฟล์ในโฟลเดอร์',
      };
    }
    
    const fileList = files
      .slice(0, 10) // Limit to 10 files
      .map((file, index) => {
        const size = file.size ? `(${(parseInt(file.size) / (1024 * 1024)).toFixed(2)} MB)` : '';
        return `${index + 1}. ${file.name} ${size}`;
      })
      .join('\n');
    
    return {
      type: 'text',
      text: `ไฟล์ล่าสุด (${Math.min(files.length, 10)} จาก ${files.length}):\n${fileList}`,
    };
  }
  
  // No command matched
  return null;
};

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const event = req.body.event;
    
    if (!event || event.type !== 'message' || event.message.type !== 'text') {
      return res.status(400).json({ error: 'Invalid event' });
    }
    
    const response = await handleCommand(event);
    
    if (response) {
      return res.status(200).json({ response });
    }
    
    return res.status(200).json({ message: 'No command matched' });
  } catch (error) {
    console.error('Error handling command:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
