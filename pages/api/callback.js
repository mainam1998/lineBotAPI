import { initLineClient, verifySignature, replyMessage } from '../../utils/lineClient';
import { initGoogleDrive, streamToBuffer, resumableUpload, listFiles } from '../../utils/googleDrive';

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify LINE signature
  try {
    const signature = req.headers['x-line-signature'];
    const body = JSON.stringify(req.body);

    if (!signature) {
      return res.status(400).json({ error: 'Missing LINE signature' });
    }

    if (!verifySignature(signature, body)) {
      return res.status(401).json({ error: 'Invalid signature' });
    }
  } catch (error) {
    console.error('Error verifying signature:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }

  // Initialize LINE client
  const lineClient = initLineClient();

  // Process LINE webhook event
  try {
    const event = req.body.events?.[0];

    // If no events or not a message event, return 200 OK
    if (!event || event.type !== 'message') {
      return res.status(200).end();
    }

    // Handle text message (commands)
    if (event.message.type === 'text') {
      const text = event.message.text.trim().toLowerCase();

      // Handle commands
      if (text === 'help' || text === 'ช่วยเหลือ') {
        await lineClient.replyMessage(event.replyToken, {
          type: 'text',
          text: `คำสั่งที่ใช้ได้:
- help หรือ ช่วยเหลือ: แสดงคำสั่งที่ใช้ได้
- status หรือ สถานะ: แสดงสถานะของบอท
- list หรือ รายการ: แสดงรายการไฟล์ล่าสุด
- ส่งไฟล์มาเพื่ออัปโหลดไปยัง Google Drive`,
        });
        return res.status(200).end();
      }

      if (text === 'status' || text === 'สถานะ') {
        const botInfo = await lineClient.getBotInfo();

        await lineClient.replyMessage(event.replyToken, {
          type: 'text',
          text: `สถานะของบอท:
- ชื่อ: ${botInfo.displayName}
- รูปภาพ: ${botInfo.pictureUrl || 'ไม่มี'}
- สถานะ: พร้อมใช้งาน
- โฟลเดอร์: ${process.env.GOOGLE_DRIVE_FOLDER_ID ? 'กำหนดแล้ว' : 'ยังไม่ได้กำหนด'}`,
        });
        return res.status(200).end();
      }

      if (text === 'list' || text === 'รายการ') {
        const drive = initGoogleDrive();
        const files = await listFiles(drive, process.env.GOOGLE_DRIVE_FOLDER_ID || 'root');

        if (files.length === 0) {
          await lineClient.replyMessage(event.replyToken, {
            type: 'text',
            text: 'ไม่พบไฟล์ในโฟลเดอร์',
          });
          return res.status(200).end();
        }

        const fileList = files
          .slice(0, 10) // Limit to 10 files
          .map((file, index) => {
            const size = file.size ? `(${(parseInt(file.size) / (1024 * 1024)).toFixed(2)} MB)` : '';
            return `${index + 1}. ${file.name} ${size}`;
          })
          .join('\n');

        await lineClient.replyMessage(event.replyToken, {
          type: 'text',
          text: `ไฟล์ล่าสุด (${Math.min(files.length, 10)} จาก ${files.length}):\n${fileList}`,
        });
        return res.status(200).end();
      }
    }

    // Handle file message
    if (event.message.type === 'file') {
      // Initialize Google Drive client
      const drive = initGoogleDrive();

      // Get file content from LINE
      const stream = await lineClient.getMessageContent(event.message.id);

      // Convert stream to buffer for better handling
      const buffer = await streamToBuffer(stream);

      // Send initial response to user
      await replyMessage(lineClient, event.replyToken, {
        type: 'text',
        text: `กำลังอัปโหลดไฟล์ "${event.message.fileName}" (${(buffer.length / (1024 * 1024)).toFixed(2)} MB)...`,
      });

      // Upload file to Google Drive using resumable upload for better handling of large files
      const uploadResult = await resumableUpload(
        drive,
        event.message.fileName,
        buffer,
        process.env.GOOGLE_DRIVE_FOLDER_ID || 'root'
      );

      // Send success message to user
      await lineClient.pushMessage(event.source.userId, {
        type: 'text',
        text: `ไฟล์ "${uploadResult.name}" ถูกอัปโหลดเรียบร้อยแล้ว${uploadResult.webViewLink ? `\nลิงก์: ${uploadResult.webViewLink}` : ''}`,
      });

      console.log('File uploaded successfully:', uploadResult);
    }

    return res.status(200).end();
  } catch (error) {
    console.error('Error processing webhook:', error);

    // Try to notify user about error
    try {
      const event = req.body.events?.[0];
      if (event && event.source && event.source.userId) {
        await lineClient.pushMessage(event.source.userId, {
          type: 'text',
          text: 'เกิดข้อผิดพลาดในการอัปโหลดไฟล์ กรุณาลองใหม่อีกครั้ง',
        });
      }
    } catch (notifyError) {
      console.error('Error notifying user:', notifyError);
    }

    return res.status(500).json({ error: 'Internal server error' });
  }
}
