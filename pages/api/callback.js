import { initLineClient, verifySignature, replyMessage } from '../../utils/lineClient';
import { initGoogleDrive, streamToBuffer, resumableUpload, listFiles } from '../../utils/googleDrive';

export default async function handler(req, res) {
  // Log request method and path
  console.log(`[DEBUG] Request: ${req.method} ${req.url}`);

  // Only allow POST requests
  if (req.method !== 'POST') {
    console.log('[DEBUG] Not a POST request, returning 405');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Always return 200 OK for LINE webhook
  console.log('[DEBUG] Received webhook body:', JSON.stringify(req.body, null, 2));
  console.log('[DEBUG] Headers:', JSON.stringify(req.headers, null, 2));

  // Check environment variables
  console.log('[DEBUG] Environment check:');
  console.log('LINE_CHANNEL_SECRET exists:', !!process.env.LINE_CHANNEL_SECRET);
  console.log('LINE_CHANNEL_ACCESS_TOKEN exists:', !!process.env.LINE_CHANNEL_ACCESS_TOKEN);
  console.log('GOOGLE_CLIENT_EMAIL exists:', !!process.env.GOOGLE_CLIENT_EMAIL);
  console.log('GOOGLE_PRIVATE_KEY exists:', !!process.env.GOOGLE_PRIVATE_KEY);
  console.log('GOOGLE_DRIVE_FOLDER_ID exists:', !!process.env.GOOGLE_DRIVE_FOLDER_ID);

  // Verify LINE signature (but don't return error status)
  try {
    const signature = req.headers['x-line-signature'];
    const body = JSON.stringify(req.body);

    if (!signature) {
      console.error('Missing LINE signature');
      return res.status(200).end();
    }

    // Skip signature verification for now
    // if (!verifySignature(signature, body)) {
    //   console.error('Invalid signature');
    //   return res.status(200).end();
    // }
  } catch (error) {
    console.error('Error verifying signature:', error);
    return res.status(200).end();
  }

  // Initialize LINE client
  let lineClient;
  try {
    console.log('[DEBUG] Initializing LINE client');
    lineClient = initLineClient();
    console.log('[DEBUG] LINE client initialized successfully');
  } catch (error) {
    console.error('[ERROR] Failed to initialize LINE client:', error);
    return res.status(200).end();
  }

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
      console.log('[DEBUG] Handling file message:', event.message.fileName);

      try {
        // Initialize Google Drive client
        console.log('[DEBUG] Initializing Google Drive client');
        const drive = initGoogleDrive();
        console.log('[DEBUG] Google Drive client initialized');

        // Get file content from LINE
        console.log('[DEBUG] Getting file content from LINE, message ID:', event.message.id);
        const stream = await lineClient.getMessageContent(event.message.id);
        console.log('[DEBUG] File content stream received');

        // Convert stream to buffer for better handling
        console.log('[DEBUG] Converting stream to buffer');
        const buffer = await streamToBuffer(stream);
        console.log('[DEBUG] Stream converted to buffer, size:', (buffer.length / (1024 * 1024)).toFixed(2), 'MB');

        // Send initial response to user
        console.log('[DEBUG] Sending initial response to user');
        await replyMessage(lineClient, event.replyToken, {
          type: 'text',
          text: `กำลังอัปโหลดไฟล์ "${event.message.fileName}" (${(buffer.length / (1024 * 1024)).toFixed(2)} MB)...`,
        });
        console.log('[DEBUG] Initial response sent');

        // Upload file to Google Drive using resumable upload for better handling of large files
        console.log('[DEBUG] Starting file upload to Google Drive');
        const uploadResult = await resumableUpload(
          drive,
          event.message.fileName,
          buffer,
          process.env.GOOGLE_DRIVE_FOLDER_ID || 'root'
        );
        console.log('[DEBUG] File uploaded successfully, result:', uploadResult);
      } catch (error) {
        console.error('[ERROR] Error handling file message:', error);

        // Try to notify user about error
        try {
          await lineClient.pushMessage(event.source.userId, {
            type: 'text',
            text: 'เกิดข้อผิดพลาดในการอัปโหลดไฟล์ กรุณาลองใหม่อีกครั้ง',
          });
        } catch (notifyError) {
          console.error('[ERROR] Failed to notify user about error:', notifyError);
        }

        return res.status(200).end();
      }

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

    // Always return 200 OK for LINE webhook
    return res.status(200).end();
  }
}
