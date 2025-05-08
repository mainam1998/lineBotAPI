# LINE File Bot

LINE Bot ที่รับไฟล์จากผู้ใช้และอัปโหลดไปยัง Google Drive โดยใช้ Next.js และ Vercel

## คุณสมบัติ

- รับไฟล์จากผู้ใช้ผ่าน LINE Messaging API
- อัปโหลดไฟล์ไปยัง Google Drive โดยอัตโนมัติ
- ทำงานบน Vercel โดยไม่ต้องตั้งเซิร์ฟเวอร์ของตัวเอง
- รองรับคำสั่งพื้นฐาน เช่น help, status, list

## ขั้นตอนการติดตั้ง

### 1. สร้าง LINE Bot

1. ไปที่ [LINE Developers Console](https://developers.line.biz/console/)
2. สร้าง Provider และ Channel ใหม่ (Messaging API)
3. ตั้งค่า Basic Settings และ Messaging API
4. บันทึก Channel Secret และ Channel Access Token

### 2. ตั้งค่า Google Cloud และ Google Drive API

1. ไปที่ [Google Cloud Console](https://console.cloud.google.com/)
2. สร้างโปรเจกต์ใหม่
3. เปิดใช้งาน Google Drive API
4. สร้าง Service Account และดาวน์โหลดคีย์ (JSON)
5. สร้างหรือเลือกโฟลเดอร์ใน Google Drive และแชร์กับ Service Account
6. บันทึก Folder ID ของโฟลเดอร์ที่จะใช้เก็บไฟล์

### 3. ตั้งค่าโปรเจกต์

1. สร้างไฟล์ `.env.local` จากไฟล์ตัวอย่าง `.env.local.example`
   ```
   Copy-Item .env.local.example .env.local
   ```

2. แก้ไขไฟล์ `.env.local` และใส่ค่าต่อไปนี้:
   - `LINE_CHANNEL_SECRET`: Channel Secret จาก LINE Developers Console
   - `LINE_CHANNEL_ACCESS_TOKEN`: Channel Access Token จาก LINE Developers Console
   - `GOOGLE_CLIENT_EMAIL`: Email ของ Service Account
   - `GOOGLE_PRIVATE_KEY`: Private Key ของ Service Account (ต้องใส่ทั้ง key รวมถึง `-----BEGIN PRIVATE KEY-----` และ `-----END PRIVATE KEY-----`)
   - `GOOGLE_DRIVE_FOLDER_ID`: ID ของโฟลเดอร์ใน Google Drive ที่จะใช้เก็บไฟล์

3. ติดตั้ง dependencies:
   ```
   npm install
   ```

### 4. ทดสอบบนเครื่องท้องถิ่น

1. รันเซิร์ฟเวอร์ในโหมดพัฒนา:
   ```
   npm run dev
   ```

2. ใช้ [ngrok](https://ngrok.com/) เพื่อสร้าง public URL:
   ```
   ngrok http 3000
   ```

3. ตั้งค่า Webhook URL ใน LINE Developers Console เป็น:
   ```
   https://<your-ngrok-domain>/api/callback
   ```

### 5. Deploy บน Vercel

1. ติดตั้ง Vercel CLI:
   ```
   npm install -g vercel
   ```

2. Deploy โปรเจกต์:
   ```
   vercel --prod
   ```

3. ตั้งค่า Environment Variables ใน Vercel Dashboard

4. ตั้งค่า Webhook URL ใน LINE Developers Console เป็น:
   ```
   https://<your-vercel-domain>/api/callback
   ```

## การใช้งาน

1. เพิ่ม LINE Bot เป็นเพื่อน
2. ส่งไฟล์ไปยัง Bot
3. Bot จะอัปโหลดไฟล์ไปยัง Google Drive และส่งข้อความยืนยันกลับมา

### คำสั่งที่รองรับ

- `help` หรือ `ช่วยเหลือ`: แสดงคำสั่งที่ใช้ได้
- `status` หรือ `สถานะ`: แสดงสถานะของบอท
- `list` หรือ `รายการ`: แสดงรายการไฟล์ล่าสุด

## การพัฒนาเพิ่มเติม

### โครงสร้างโปรเจกต์

- `pages/api/callback.js`: API Route หลักสำหรับรับ webhook จาก LINE
- `pages/api/callback-advanced.js`: เวอร์ชันขั้นสูงที่รองรับไฟล์ขนาดใหญ่
- `pages/api/status.js`: API Route สำหรับตรวจสอบสถานะของบอท
- `pages/api/commands.js`: API Route สำหรับจัดการคำสั่งข้อความ
- `utils/googleDrive.js`: ฟังก์ชันสำหรับทำงานกับ Google Drive API
- `utils/lineClient.js`: ฟังก์ชันสำหรับทำงานกับ LINE Messaging API
- `middleware/lineWebhook.js`: Middleware สำหรับตรวจสอบลายเซ็นของ LINE webhook

### ฟีเจอร์ที่สามารถพัฒนาเพิ่มเติม

1. **การกรองประเภทไฟล์**: เพิ่มการรองรับการกรองไฟล์ตามประเภทหรือขนาด
2. **การยืนยันตัวตนผู้ใช้**: จำกัดการเข้าถึงเฉพาะผู้ใช้ที่ได้รับอนุญาต
3. **การจัดการไฟล์**: สร้างโฟลเดอร์ตามวันที่หรือผู้ใช้
4. **การแสดงตัวอย่างไฟล์**: สร้างภาพขนาดย่อหรือตัวอย่างสำหรับไฟล์ที่อัปโหลด
5. **การค้นหาไฟล์**: อนุญาตให้ผู้ใช้ค้นหาไฟล์ตามชื่อหรือเนื้อหา

## ข้อจำกัด

- ขนาดไฟล์สูงสุดที่ LINE รองรับคือ 300 MB
- ระยะเวลาการทำงานสูงสุดของ Vercel Serverless Function คือ 10 วินาที (ตามที่กำหนดใน vercel.json)
- หน่วยความจำสูงสุดของ Vercel Serverless Function คือ 1024 MB (ตามที่กำหนดใน vercel.json สำหรับ Hobby plan)

## การแก้ไขปัญหา

- หากไฟล์มีขนาดใหญ่เกินไป อาจต้องใช้ Resumable Upload ของ Google Drive API
- ตรวจสอบ Log ใน Vercel Dashboard เพื่อดูข้อผิดพลาด
- ตรวจสอบการตั้งค่า Environment Variables ใน Vercel

## สคริปต์ช่วยเหลือ

โปรเจกต์นี้มีสคริปต์ช่วยเหลือ 2 ตัว:

1. `setup.ps1`: ช่วยในการตั้งค่าโปรเจกต์บนเครื่องท้องถิ่น
   ```
   .\setup.ps1
   ```

2. `deploy.ps1`: ช่วยในการ deploy โปรเจกต์ไปยัง Vercel
   ```
   .\deploy.ps1
   ```
