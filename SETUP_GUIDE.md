# 🚀 คู่มือการตั้งค่า LINE Bot File Upload System

## 📋 ข้อกำหนดเบื้องต้น

1. **บัญชี LINE Developers** - [สมัครที่นี่](https://developers.line.biz/)
2. **บัญชี Google Cloud Platform** - [สมัครที่นี่](https://cloud.google.com/)
3. **บัญชี Vercel** - [สมัครที่นี่](https://vercel.com/)
4. **Node.js 18+** - [ดาวน์โหลดที่นี่](https://nodejs.org/)

## 🔧 การตั้งค่า LINE Bot

### 1. สร้าง LINE Bot Channel

1. เข้าไปที่ [LINE Developers Console](https://developers.line.biz/)
2. สร้าง Provider ใหม่ (หากยังไม่มี)
3. สร้าง Channel ใหม่ประเภท "Messaging API"
4. กรอกข้อมูลพื้นฐาน:
   - **Channel name**: ชื่อบอทของคุณ
   - **Channel description**: คำอธิบายบอท
   - **Category**: เลือกหมวดหมู่ที่เหมาะสม
   - **Subcategory**: เลือกหมวดหมู่ย่อย

### 2. ดึงข้อมูล Channel Access Token และ Channel Secret

1. ไปที่แท็บ **"Basic settings"**
   - คัดลอก **Channel secret**
2. ไปที่แท็บ **"Messaging API"**
   - คัดลอก **Channel access token** (หากยังไม่มีให้กด Issue)

## ☁️ การตั้งค่า Google Drive API

### 1. สร้าง Google Cloud Project

1. เข้าไปที่ [Google Cloud Console](https://console.cloud.google.com/)
2. สร้าง Project ใหม่หรือเลือก Project ที่มีอยู่
3. เปิดใช้งาน Google Drive API:
   - ไปที่ **APIs & Services > Library**
   - ค้นหา "Google Drive API"
   - คลิก **Enable**

### 2. สร้าง Service Account

1. ไปที่ **APIs & Services > Credentials**
2. คลิก **Create Credentials > Service Account**
3. กรอกข้อมูล:
   - **Service account name**: ชื่อ service account
   - **Service account ID**: จะถูกสร้างอัตโนมัติ
   - **Description**: คำอธิบาย (ไม่บังคับ)
4. คลิก **Create and Continue**
5. ข้าม **Grant this service account access to project** (ไม่จำเป็น)
6. คลิก **Done**

### 3. สร้าง Private Key

1. คลิกที่ Service Account ที่เพิ่งสร้าง
2. ไปที่แท็บ **Keys**
3. คลิก **Add Key > Create new key**
4. เลือก **JSON** format
5. คลิก **Create** - ไฟล์ JSON จะถูกดาวน์โหลด

### 4. สร้างโฟลเดอร์ใน Google Drive

1. เข้าไปที่ [Google Drive](https://drive.google.com/)
2. สร้างโฟลเดอร์ใหม่สำหรับเก็บไฟล์ที่อัพโหลด
3. คลิกขวาที่โฟลเดอร์ > **Share**
4. เพิ่ม email ของ Service Account (จากไฟล์ JSON) และให้สิทธิ์ **Editor**
5. คัดลอก **Folder ID** จาก URL (ส่วนหลัง `/folders/`)

## 🔐 การตั้งค่า Environment Variables

### 1. สร้างไฟล์ .env.local

สร้างไฟล์ `.env.local` ในโฟลเดอร์ root ของโปรเจ็ค:

```env
# LINE Bot Configuration
LINE_CHANNEL_ACCESS_TOKEN=your_channel_access_token_here
LINE_CHANNEL_SECRET=your_channel_secret_here

# Google Drive Configuration
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour_Private_Key_Here\n-----END PRIVATE KEY-----"
GOOGLE_DRIVE_FOLDER_ID=your_folder_id_here

# Admin Configuration
ADMIN_KEY=your_admin_password_here

# Environment
NODE_ENV=development
```

### 2. การดึงข้อมูลจากไฟล์ JSON

จากไฟล์ JSON ที่ดาวน์โหลดมา:

```json
{
  "type": "service_account",
  "project_id": "your-project-id",
  "private_key_id": "key-id",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "your-service-account@your-project.iam.gserviceaccount.com",
  "client_id": "client-id",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/..."
}
```

ใช้ข้อมูลดังนี้:
- `GOOGLE_SERVICE_ACCOUNT_EMAIL` = `client_email`
- `GOOGLE_PRIVATE_KEY` = `private_key` (รวมทั้ง `\n`)

## 🚀 การ Deploy บน Vercel

### 1. เชื่อมต่อ GitHub Repository

1. Push โค้ดขึ้น GitHub
2. เข้าไปที่ [Vercel Dashboard](https://vercel.com/dashboard)
3. คลิก **New Project**
4. เลือก Repository ของคุณ
5. คลิก **Import**

### 2. ตั้งค่า Environment Variables บน Vercel

1. ไปที่ **Settings > Environment Variables**
2. เพิ่ม Environment Variables ทั้งหมดจากไฟล์ `.env.local`
3. ตั้งค่าให้ใช้ได้กับ **Production**, **Preview**, และ **Development**

### 3. Deploy

1. คลิก **Deploy**
2. รอให้ deployment เสร็จสิ้น
3. คัดลอก URL ที่ได้ (เช่น `https://your-app.vercel.app`)

## 🔗 การตั้งค่า Webhook

### 1. ตั้งค่า Webhook URL ใน LINE

1. กลับไปที่ LINE Developers Console
2. ไปที่แท็บ **Messaging API**
3. ในส่วน **Webhook settings**:
   - **Webhook URL**: `https://your-app.vercel.app/api/callback`
   - เปิด **Use webhook**: ON
   - เปิด **Verify webhook**: ON (ทดสอบการเชื่อมต่อ)

### 2. ปิดการตอบกลับอัตโนมัติ

1. ในส่วน **LINE Official Account features**:
   - **Auto-reply messages**: OFF
   - **Greeting messages**: OFF (หรือตั้งค่าตามต้องการ)

## ✅ การทดสอบ

### 1. ทดสอบ Webhook

1. ใน LINE Developers Console ไปที่ **Messaging API**
2. คลิก **Verify** ข้าง Webhook URL
3. ควรได้ **Success**

### 2. ทดสอบ Bot

1. สแกน QR Code ใน LINE Developers Console
2. เพิ่มบอทเป็นเพื่อน
3. ส่งข้อความ `help` เพื่อดูคำสั่งที่ใช้ได้
4. ทดสอบอัพโหลดไฟล์

## 🔧 การแก้ไขปัญหา

### ปัญหาที่พบบ่อย

1. **Webhook ไม่ทำงาน**
   - ตรวจสอบ URL ให้ถูกต้อง
   - ตรวจสอบ Environment Variables
   - ดู Logs ใน Vercel

2. **Google Drive ไม่สามารถอัพโหลดได้**
   - ตรวจสอบ Service Account Email ใน Google Drive folder
   - ตรวจสอบ Private Key format
   - ตรวจสอบ Folder ID

3. **ไฟล์ขนาดใหญ่อัพโหลดไม่ได้**
   - Vercel Free Plan จำกัดที่ 50MB
   - ตรวจสอบ timeout settings

### การดู Logs

1. **Vercel Logs**: ไปที่ Vercel Dashboard > Functions > View Function Logs
2. **LINE Webhook Logs**: ไปที่ LINE Developers Console > Messaging API > Webhook

## 📞 การสนับสนุน

หากพบปัญหา:
1. ตรวจสอบ Environment Variables
2. ดู Logs ใน Vercel
3. ทดสอบ API endpoints ด้วย `/api/performance`
4. ใช้คำสั่ง `performance` ใน LINE Bot

---

**หมายเหตุ**: อย่าลืม commit ไฟล์ `.env.local` ลงใน `.gitignore` เพื่อความปลอดภัย!
