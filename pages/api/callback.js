import { initLineClient, verifySignature } from '../../utils/lineClient';
import { initGoogleDrive, streamToBuffer, modernUpload, listFiles } from '../../utils/googleDriveModern';
import uploadQueue from '../../utils/uploadQueue';

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
- ส่งไฟล์มาเพื่ออัปโหลดไปยัง Google Drive (รองรับหลายไฟล์พร้อมกัน)

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
        try {
          const userId = event.source.userId;
          const userQueueStatus = uploadQueue.getUserQueueStatus(userId);
          const globalStats = uploadQueue.getQueueStats();

          const webAppUrl = 'https://line-bot-rho-ashy.vercel.app/';
          let queueMessage = `สถานะคิวอัพโหลด:

ของคุณ:
- รอดำเนินการ: ${userQueueStatus.pending} ไฟล์
- กำลังอัพโหลด: ${userQueueStatus.processing} ไฟล์
- สำเร็จแล้ว: ${userQueueStatus.completed} ไฟล์
- ล้มเหลว: ${userQueueStatus.failed} ไฟล์

ระบบทั้งหมด:
- คิวทั้งหมด: ${globalStats.total} ไฟล์
- กำลังประมวลผล: ${globalStats.isProcessing ? 'ใช่' : 'ไม่'}

เว็บไซต์: ${webAppUrl}`;

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
        } catch (error) {
          console.error('[ERROR] Error getting queue status:', error);
          const webAppUrl = 'https://line-bot-rho-ashy.vercel.app/';
          const errorMessage = `เกิดข้อผิดพลาดในการดึงสถานะคิว กรุณาลองใหม่อีกครั้ง

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

    // Handle file messages with summary response
    if (fileEvents.length > 0) {
      console.log(`[DEBUG] Processing ${fileEvents.length} file events`);

      const userId = fileEvents[0].source.userId;
      const webAppUrl = 'https://line-bot-rho-ashy.vercel.app/';

      // Create file checklist for tracking
      const fileChecklist = fileEvents.map((event, index) => {
        let fileName;
        switch (event.message.type) {
          case 'file':
            fileName = event.message.fileName;
            break;
          case 'image':
            fileName = `image_${event.message.id}.jpg`;
            break;
          case 'video':
            fileName = `video_${event.message.id}.mp4`;
            break;
          case 'audio':
            fileName = `audio_${event.message.id}.m4a`;
            break;
          default:
            fileName = `file_${event.message.id}`;
        }

        return {
          index: index + 1,
          messageId: event.message.id,
          fileName: fileName,
          fileType: event.message.type,
          status: 'pending', // pending, downloading, uploading, completed, failed
          startTime: null,
          completedTime: null,
          error: null
        };
      });

      console.log(`[CHECKLIST] Created checklist for ${fileChecklist.length} files:`,
        fileChecklist.map(f => `${f.index}. ${f.fileName} (${f.status})`));

      // Send single summary response for all files
      const checklistText = fileChecklist.map(f => `${f.index}. ${f.fileName} ⏳`).join('\n');

      const summaryMessage = `📁 รับไฟล์ ${fileEvents.length} ไฟล์แล้ว

📋 รายการไฟล์:
${checklistText}

📊 สถานะ:
• รับไฟล์แล้ว: ${fileEvents.length} ไฟล์
• รอดำเนินการ: ${fileEvents.length} ไฟล์
• กำลังประมวลผล: 0 ไฟล์
• เสร็จแล้ว: 0 ไฟล์

⏳ ระบบจะประมวลผลทีละไฟล์ตามลำดับ

🌐 เว็บไซต์: ${webAppUrl}`;

      await lineClient.replyMessage(fileEvents[0].replyToken, {
        type: 'text',
        text: summaryMessage,
      });

      // Process files sequentially (one by one) instead of parallel processing
      const processFileSequentially = async (fileIndex = 0) => {
        if (fileIndex >= fileEvents.length) {
          console.log(`[CHECKLIST] All ${fileEvents.length} files processed`);

          // Send final summary
          const finalSummary = `✅ ประมวลผลไฟล์เสร็จสิ้น

📊 สรุปผลลัพธ์:
• ไฟล์ทั้งหมด: ${fileEvents.length} ไฟล์
• ดูรายละเอียดได้ที่เว็บไซต์

🌐 เว็บไซต์: ${webAppUrl}`;

          try {
            await lineClient.pushMessage(userId, {
              type: 'text',
              text: finalSummary,
            });
          } catch (lineError) {
            console.error(`[CHECKLIST] Failed to send final summary: ${lineError.message}`);
          }
          return;
        }

        const event = fileEvents[fileIndex];
        const currentFile = fileChecklist[fileIndex];
        const messageId = event.message.id;

        console.log(`[CHECKLIST] Processing file ${currentFile.index}/${fileEvents.length}: ${currentFile.fileName}`);

        // Update checklist status
        currentFile.status = 'downloading';
        currentFile.startTime = new Date();

        // Send progress update
        const progressMessage = `🔄 กำลังประมวลผลไฟล์ ${currentFile.index}/${fileEvents.length}

📁 ไฟล์: ${currentFile.fileName}
📊 สถานะ: กำลังดาวน์โหลด...

⏳ กรุณารอสักครู่`;

        try {
          await lineClient.pushMessage(userId, {
            type: 'text',
            text: progressMessage,
          });
        } catch (lineError) {
          console.error(`[CHECKLIST] Failed to send progress message: ${lineError.message}`);
          // Continue processing even if message sending fails
        }

        try {
          console.log(`[BACKGROUND] Starting file processing for: ${currentFile.fileName}`);

          // Download file with smart timeout based on file type
            let stream = null;
            let retryCount = 0;
            const maxRetries = 2; // Reduce retries for faster processing

          // Smart timeout based on file type - increased for better reliability
          const getSmartTimeout = (messageType) => {
            switch (messageType) {
              case 'image': return 25000; // 25s for images (increased from 15s)
              case 'video': return 45000; // 45s for videos (increased from 30s)
              case 'audio': return 35000; // 35s for audio (increased from 25s)
              default: return 30000; // 30s for other files (increased from 20s)
            }
          };

          const smartTimeout = getSmartTimeout(event.message.type);

            while (retryCount < maxRetries && !stream) {
              try {
                console.log(`[BACKGROUND] Getting file content from LINE, message ID: ${messageId} (attempt ${retryCount + 1}/${maxRetries}, timeout: ${smartTimeout}ms)`);

                // Create new LINE client instance for each retry
                const { initLineClient } = require('../../utils/lineClient');
                const freshLineClient = initLineClient();

                // Smart timeout based on file type
                const downloadPromise = freshLineClient.getMessageContent(messageId);
                const timeoutPromise = new Promise((_, reject) => {
                  setTimeout(() => reject(new Error(`Download timeout after ${smartTimeout/1000} seconds`)), smartTimeout);
                });

                stream = await Promise.race([downloadPromise, timeoutPromise]);

                if (!stream) {
                  throw new Error('Received empty stream from LINE');
                }

                console.log(`[BACKGROUND] File content stream received successfully for: ${fileName}`);
                break;

              } catch (downloadError) {
                retryCount++;
                console.error(`[BACKGROUND] Download attempt ${retryCount} failed for ${fileName}:`, downloadError.message);

                if (retryCount < maxRetries) {
                  // Quick retry with shorter delay
                  const retryDelay = 2000 + (Math.random() * 1000); // 2-3s random delay
                  console.log(`[BACKGROUND] Retrying download in ${Math.round(retryDelay)}ms...`);
                  await new Promise(resolve => setTimeout(resolve, retryDelay));
                } else {
                  throw new Error(`Failed to download file after ${maxRetries} attempts: ${downloadError.message}`);
                }
              }
            }

          // Convert stream to buffer with timeout
          console.log(`[CHECKLIST] Converting stream to buffer for: ${currentFile.fileName}`);
          const buffer = await streamToBuffer(stream, 30000);
          console.log(`[CHECKLIST] Stream converted successfully, size: ${(buffer.length / (1024 * 1024)).toFixed(2)} MB`);

          // Update status to uploading
          currentFile.status = 'uploading';

          // Send upload progress update
          const uploadMessage = `📤 กำลังอัพโหลดไฟล์ ${currentFile.index}/${fileEvents.length}

📁 ไฟล์: ${currentFile.fileName}
📊 ขนาด: ${(buffer.length / (1024 * 1024)).toFixed(2)} MB
📊 สถานะ: กำลังอัพโหลดไป Google Drive...

⏳ กรุณารอสักครู่`;

          try {
            await lineClient.pushMessage(userId, {
              type: 'text',
              text: uploadMessage,
            });
          } catch (lineError) {
            console.error(`[CHECKLIST] Failed to send upload message: ${lineError.message}`);
            // Continue processing even if message sending fails
          }

          // Add file to upload queue immediately
          console.log(`[CHECKLIST] Adding file to upload queue: ${currentFile.fileName}`);
          const queueId = uploadQueue.addToQueue(userId, {
            fileName: currentFile.fileName,
            buffer,
            messageId,
            messageType: event.message.type,
            checklistIndex: fileIndex,
            onComplete: async (success, result, error) => {
              if (success) {
                currentFile.status = 'completed';
                currentFile.completedTime = new Date();

                // Send success message
                const successMessage = `✅ อัพโหลดสำเร็จ ${currentFile.index}/${fileEvents.length}

📁 ไฟล์: ${currentFile.fileName}
🔗 ลิงก์: ${result.webViewLink || 'ไม่สามารถสร้างลิงก์ได้'}

⏭️ ดำเนินการไฟล์ถัดไป...`;

                try {
                  await lineClient.pushMessage(userId, {
                    type: 'text',
                    text: successMessage,
                  });
                } catch (lineError) {
                  console.error(`[CHECKLIST] Failed to send success message: ${lineError.message}`);
                }
              } else {
                currentFile.status = 'failed';
                currentFile.error = error;

                // Send error message
                const errorMessage = `❌ อัพโหลดล้มเหลว ${currentFile.index}/${fileEvents.length}

📁 ไฟล์: ${currentFile.fileName}
🔍 สาเหตุ: ${error}

⏭️ ดำเนินการไฟล์ถัดไป...`;

                try {
                  await lineClient.pushMessage(userId, {
                    type: 'text',
                    text: errorMessage,
                  });
                } catch (lineError) {
                  console.error(`[CHECKLIST] Failed to send error message: ${lineError.message}`);
                }
              }

              // Process next file
              setTimeout(() => processFileSequentially(fileIndex + 1), 1000);
            }
          });

          console.log(`[CHECKLIST] File added to queue with ID: ${queueId}`);

        } catch (downloadError) {
          console.error(`[CHECKLIST] Error processing file ${currentFile.index}: ${downloadError.message}`);

          // Update checklist status
          currentFile.status = 'failed';
          currentFile.error = downloadError.message;

          // Notify user about error
          let errorType = 'ไม่ทราบสาเหตุ';
          if (downloadError.message.includes('timeout')) {
            errorType = 'หมดเวลาในการดาวน์โหลด (ไฟล์อาจใหญ่เกินไป)';
          } else if (downloadError.message.includes('socket')) {
            errorType = 'ปัญหาการเชื่อมต่อเครือข่าย';
          } else if (downloadError.message.includes('stream')) {
            errorType = 'ปัญหาในการประมวลผลไฟล์';
          }

          const errorMessage = `❌ ประมวลผลล้มเหลว ${currentFile.index}/${fileEvents.length}

📁 ไฟล์: ${currentFile.fileName}
🔍 สาเหตุ: ${errorType}

💡 แนะนำ:
- ลองส่งไฟล์ใหม่อีกครั้ง
- หากไฟล์ใหญ่ ลองย่อขนาดก่อนส่ง

⏭️ ดำเนินการไฟล์ถัดไป...`;

          try {
            await lineClient.pushMessage(userId, {
              type: 'text',
              text: errorMessage,
            });
          } catch (lineError) {
            console.error(`[CHECKLIST] Failed to send download error message: ${lineError.message}`);
          }

          // Process next file after error
          setTimeout(() => processFileSequentially(fileIndex + 1), 1000);
        }
      };

      // Start processing files sequentially
      processFileSequentially(0);
    } // End of file events handling

    return res.status(200).end();
  } catch (error) {
    console.error('[ERROR] Error processing webhook:', error);

    // Always return 200 OK for LINE webhook
    return res.status(200).end();
  }
}
