import { initLineClient, verifySignature } from '../../utils/lineClient';
import { initGoogleDrive, streamToBuffer, modernUpload, listFiles } from '../../utils/googleDriveModern';

// ตัดฟังก์ชันที่ไม่ได้ใช้แล้วออก

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

  // Verify LINE signature (but don't return error status)
  try {
    const signature = req.headers['x-line-signature'];
    const body = JSON.stringify(req.body);

    if (!signature) {
      console.log('[DEBUG] Missing LINE signature, but continuing anyway');
      // Continue processing even without signature
    } else {
      try {
        const isValid = verifySignature(signature, body);
        console.log('[DEBUG] Signature verification result:', isValid);
        // Continue processing even if signature is invalid
      } catch (signatureError) {
        console.error('[ERROR] Error during signature verification:', signatureError);
        // Continue processing even if signature verification fails
      }
    }
  } catch (error) {
    console.error('[ERROR] Error in signature verification block:', error);
    // Continue processing even if there's an error
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
    const events = req.body.events || [];

    // If no events, return 200 OK
    if (events.length === 0) {
      console.log('[DEBUG] No events received');
      return res.status(200).end();
    }

    console.log(`[DEBUG] Processing ${events.length} events`);

    // Count file messages first
    const fileEvents = events.filter(event =>
      event.type === 'message' &&
      ['image', 'video', 'audio', 'file'].includes(event.message.type)
    );

    const textEvents = events.filter(event =>
      event.type === 'message' &&
      event.message.type === 'text'
    );

    console.log(`[DEBUG] Processing ${events.length} events: ${fileEvents.length} files, ${textEvents.length} text messages`);

    // Handle text messages first
    for (let i = 0; i < textEvents.length; i++) {
      const event = textEvents[i];
      console.log(`[DEBUG] Text Event ${i + 1}: Processing text message`);

    // Handle text message (commands)
    if (event.message.type === 'text') {
      const text = event.message.text.trim().toLowerCase();
      console.log('[DEBUG] Received text message:', text);

      // Handle commands
      if (text === 'help' || text === 'ช่วยเหลือ') {
        console.log('[DEBUG] Processing help command');
        const webAppUrl = 'https://line-bot-rho-ashy.vercel.app/';
        const helpMessage = `คำสั่งที่ใช้ได้:
- help หรือ ช่วยเหลือ: แสดงคำสั่งที่ใช้ได้
- status หรือ สถานะ: แสดงสถานะของบอท
- list หรือ รายการ: แสดงรายการไฟล์ล่าสุด
- queue หรือ คิว หรือ สถานะคิว: แสดงสถานะคิวอัพโหลด
- performance หรือ ประสิทธิภาพ หรือ stats: แสดงสถิติประสิทธิภาพ
- ส่งไฟล์มาเพื่ออัปโหลดไปยัง Google Drive (รองรับหลายไฟล์พร้อมกัน)

🚀 ฟีเจอร์ใหม่:
- อัพโหลดทันทีเมื่อรับไฟล์ (ไม่ต้องรอ)
- รองรับไฟล์ขนาดใหญ่ถึง 50MB
- ระบบ chunked upload สำหรับไฟล์ขนาดใหญ่
- การตรวจสอบไฟล์ก่อนอัพโหลด
- ติดตามประสิทธิภาพแบบ real-time

เว็บไซต์: ${webAppUrl}`;

        // Only reply to first event, push to others
        if (i === 0) {
          await lineClient.replyMessage(event.replyToken, {
            type: 'text',
            text: helpMessage,
          });
        } else {
          await lineClient.pushMessage(event.source.userId, {
            type: 'text',
            text: helpMessage,
          });
        }
        continue;
      }

      if (text === 'status' || text === 'สถานะ') {
        console.log('[DEBUG] Processing status command');
        try {
          const botInfo = await lineClient.getBotInfo();

          const webAppUrl = 'https://line-bot-rho-ashy.vercel.app/';
          const statusMessage = `สถานะของบอท:
- ชื่อ: ${botInfo.displayName}
- รูปภาพ: ${botInfo.pictureUrl || 'ไม่มี'}
- สถานะ: พร้อมใช้งาน
- โฟลเดอร์: ${process.env.GOOGLE_DRIVE_FOLDER_ID ? 'กำหนดแล้ว' : 'ยังไม่ได้กำหนด'}

เว็บไซต์: ${webAppUrl}`;

          // Only reply to first event, push to others
          if (i === 0) {
            await lineClient.replyMessage(event.replyToken, {
              type: 'text',
              text: statusMessage,
            });
          } else {
            await lineClient.pushMessage(event.source.userId, {
              type: 'text',
              text: statusMessage,
            });
          }
        } catch (error) {
          console.error('[ERROR] Error getting bot info:', error);
          const webAppUrl = 'https://line-bot-rho-ashy.vercel.app/';
          const botErrorMessage = `เกิดข้อผิดพลาดในการดึงข้อมูลสถานะ กรุณาลองใหม่อีกครั้ง

เว็บไซต์: ${webAppUrl}`;

          // Only reply to first event, push to others
          if (i === 0) {
            await lineClient.replyMessage(event.replyToken, {
              type: 'text',
              text: botErrorMessage,
            });
          } else {
            await lineClient.pushMessage(event.source.userId, {
              type: 'text',
              text: botErrorMessage,
            });
          }
        }
        continue;
      }

      if (text === 'list' || text === 'รายการ') {
        console.log('[DEBUG] Processing list command');
        try {
          const drive = initGoogleDrive();
          const files = await listFiles(drive, process.env.GOOGLE_DRIVE_FOLDER_ID || 'root');

          if (files.length === 0) {
            const webAppUrl = 'https://line-bot-rho-ashy.vercel.app/';
            const noFilesMessage = `ไม่พบไฟล์ในโฟลเดอร์

เว็บไซต์: ${webAppUrl}`;

            // Only reply to first event, push to others
            if (i === 0) {
              await lineClient.replyMessage(event.replyToken, {
                type: 'text',
                text: noFilesMessage,
              });
            } else {
              await lineClient.pushMessage(event.source.userId, {
                type: 'text',
                text: noFilesMessage,
              });
            }
            continue;
          }

          const fileList = files
            .slice(0, 10) // Limit to 10 files
            .map((file, index) => {
              const size = file.size ? `(${(parseInt(file.size) / (1024 * 1024)).toFixed(2)} MB)` : '';
              return `${index + 1}. ${file.name} ${size}`;
            })
            .join('\n');

          const webAppUrl = 'https://line-bot-rho-ashy.vercel.app/';
          const listMessage = `ไฟล์ล่าสุด (${Math.min(files.length, 10)} จาก ${files.length}):\n${fileList}\n\nเว็บไซต์: ${webAppUrl}`;

          // Only reply to first event, push to others
          if (i === 0) {
            await lineClient.replyMessage(event.replyToken, {
              type: 'text',
              text: listMessage,
            });
          } else {
            await lineClient.pushMessage(event.source.userId, {
              type: 'text',
              text: listMessage,
            });
          }
        } catch (error) {
          console.error('[ERROR] Error listing files:', error);
          const webAppUrl = 'https://line-bot-rho-ashy.vercel.app/';
          const errorMessage = `เกิดข้อผิดพลาดในการดึงรายการไฟล์ กรุณาลองใหม่อีกครั้ง

เว็บไซต์: ${webAppUrl}`;

          // Only reply to first event, push to others
          if (i === 0) {
            await lineClient.replyMessage(event.replyToken, {
              type: 'text',
              text: errorMessage,
            });
          } else {
            await lineClient.pushMessage(event.source.userId, {
              type: 'text',
              text: errorMessage,
            });
          }
        }
        continue;
      }

      if (text === 'queue' || text === 'คิว' || text === 'สถานะคิว') {
        console.log('[DEBUG] Processing queue status command');
        const webAppUrl = 'https://line-bot-rho-ashy.vercel.app/';

        const queueMessage = `📊 สถานะระบบ:

🚀 ระบบอัพโหลดใหม่:
- อัพโหลดทันทีเมื่อรับไฟล์
- ไม่มีระบบคิวแล้ว
- ประมวลผลแบบ real-time

💡 ส่งไฟล์มาเพื่อทดสอบการอัพโหลดทันที!

🌐 เว็บไซต์: ${webAppUrl}`;

        // Only reply to first event, push to others
        if (i === 0) {
          await lineClient.replyMessage(event.replyToken, {
            type: 'text',
            text: queueMessage,
          });
        } else {
          await lineClient.pushMessage(event.source.userId, {
            type: 'text',
            text: queueMessage,
          });
        }
        continue;
      }

      if (text === 'performance' || text === 'ประสิทธิภาพ' || text === 'stats') {
        console.log('[DEBUG] Processing performance command');
        try {
          const performanceMonitor = require('../../utils/performanceMonitor');
          const summary = performanceMonitor.getPerformanceSummary();

          const webAppUrl = 'https://line-bot-rho-ashy.vercel.app/';

          const performanceMessage = `📈 สถิติประสิทธิภาพ:

📊 การอัพโหลด:
- ทั้งหมด: ${summary.summary.totalUploads} ไฟล์
- สำเร็จ: ${summary.summary.successfulUploads} ไฟล์
- อัตราสำเร็จ: ${summary.summary.successRate}
- ข้อมูลรวม: ${summary.summary.totalDataTransferred}

⚡ ประสิทธิภาพ:
- ความเร็วเฉลี่ย: ${summary.summary.averageSpeed}
- เวลาเฉลี่ย: ${summary.summary.averageTime}

💾 หน่วยความจำ: ${summary.systemHealth.currentMemory ? summary.systemHealth.currentMemory.heapUsed : 'N/A'}MB

🌐 เว็บไซต์: ${webAppUrl}`;

          // Only reply to first event, push to others
          if (i === 0) {
            await lineClient.replyMessage(event.replyToken, {
              type: 'text',
              text: performanceMessage,
            });
          } else {
            await lineClient.pushMessage(event.source.userId, {
              type: 'text',
              text: performanceMessage,
            });
          }
        } catch (error) {
          console.error('[ERROR] Error getting performance stats:', error);
          const webAppUrl = 'https://line-bot-rho-ashy.vercel.app/';
          const errorMessage = `เกิดข้อผิดพลาดในการดึงสถิติประสิทธิภาพ กรุณาลองใหม่อีกครั้ง

เว็บไซต์: ${webAppUrl}`;

          // Only reply to first event, push to others
          if (i === 0) {
            await lineClient.replyMessage(event.replyToken, {
              type: 'text',
              text: errorMessage,
            });
          } else {
            await lineClient.pushMessage(event.source.userId, {
              type: 'text',
              text: errorMessage,
            });
          }
        }
        continue;
      }
    }

    } // End of text events loop

    // Handle file messages with immediate upload
    if (fileEvents.length > 0) {
      console.log(`[UPLOAD] Received ${fileEvents.length} file events - uploading immediately`);

      const userId = fileEvents[0].source.userId;
      const webAppUrl = 'https://line-bot-rho-ashy.vercel.app/';

      // Send immediate response
      const uploadMessage = `📁 รับไฟล์ ${fileEvents.length} ไฟล์แล้ว

🚀 กำลังอัพโหลดไปยัง Google Drive...
⏳ กรุณารอสักครู่

🌐 เว็บไซต์: ${webAppUrl}`;

      await lineClient.replyMessage(fileEvents[0].replyToken, {
        type: 'text',
        text: uploadMessage,
      });

      // Process files immediately
      let successCount = 0;
      let failCount = 0;
      const uploadResults = [];

      for (let i = 0; i < fileEvents.length; i++) {
        const event = fileEvents[i];
        const messageId = event.message.id;

        try {
          console.log(`[UPLOAD] Processing file ${i + 1}/${fileEvents.length}: ${messageId}`);

          // Generate filename
          let fileName;
          switch (event.message.type) {
            case 'file':
              fileName = event.message.fileName || `file_${messageId}`;
              break;
            case 'image':
              fileName = `image_${messageId}.jpg`;
              break;
            case 'video':
              fileName = `video_${messageId}.mp4`;
              break;
            case 'audio':
              fileName = `audio_${messageId}.m4a`;
              break;
            default:
              fileName = `file_${messageId}`;
          }

          // Download file from LINE
          console.log(`[UPLOAD] Downloading file: ${fileName}`);
          const fileBuffer = await lineClient.getMessageContent(messageId);
          const buffer = await streamToBuffer(fileBuffer);

          // Upload to Google Drive
          console.log(`[UPLOAD] Uploading to Google Drive: ${fileName} (${buffer.length} bytes)`);
          const drive = initGoogleDrive();
          const uploadResult = await modernUpload(drive, buffer, fileName, process.env.GOOGLE_DRIVE_FOLDER_ID);

          console.log(`[UPLOAD] Upload successful: ${fileName} -> ${uploadResult.id}`);
          successCount++;
          uploadResults.push({
            fileName: fileName,
            status: 'success',
            fileId: uploadResult.id,
            size: buffer.length
          });

        } catch (error) {
          console.error(`[UPLOAD] Upload failed for file ${i + 1}:`, error);
          failCount++;
          uploadResults.push({
            fileName: fileName || `file_${messageId}`,
            status: 'failed',
            error: error.message
          });
        }
      }

      // Send completion message
      const completionMessage = `✅ การอัพโหลดเสร็จสิ้น!

📊 ผลลัพธ์:
• สำเร็จ: ${successCount} ไฟล์
• ล้มเหลว: ${failCount} ไฟล์
• รวม: ${fileEvents.length} ไฟล์

${successCount > 0 ? '🎉 ไฟล์ถูกอัพโหลดไปยัง Google Drive แล้ว' : ''}
${failCount > 0 ? '⚠️ บางไฟล์อัพโหลดไม่สำเร็จ กรุณาลองใหม่' : ''}

🌐 เว็บไซต์: ${webAppUrl}`;

      await lineClient.pushMessage(userId, {
        type: 'text',
        text: completionMessage,
      });

      console.log(`[UPLOAD] Completed processing ${fileEvents.length} files: ${successCount} success, ${failCount} failed`);
    } // End of file events handling

    return res.status(200).end();
  } catch (error) {
    console.error('[ERROR] Error processing webhook:', error);

    // Always return 200 OK for LINE webhook
    return res.status(200).end();
  }
}
