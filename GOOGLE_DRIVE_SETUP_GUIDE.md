# 🔄 คู่มือการตั้งค่า Google Drive ใหม่ทั้งหมด

## 📋 ขั้นตอนที่ 1: สร้าง Google Cloud Project ใหม่

### 1.1 สร้าง Project ใหม่
1. ไปที่ [Google Cloud Console](https://console.cloud.google.com/)
2. คลิก **Select a project** ด้านบน
3. คลิก **NEW PROJECT**
4. กรอกข้อมูล:
   - **Project name**: `line-bot-drive-new` (หรือชื่อที่ต้องการ)
   - **Organization**: เลือกตามที่มี
5. คลิก **CREATE**
6. รอให้ Project สร้างเสร็จ แล้วเลือก Project นี้

### 1.2 เปิดใช้งาน Google Drive API
1. ไปที่ **APIs & Services > Library**
2. ค้นหา "Google Drive API"
3. คลิก **Google Drive API**
4. คลิก **ENABLE**
5. รอให้เปิดใช้งานเสร็จ

## 🔑 ขั้นตอนที่ 2: สร้าง Service Account ใหม่

### 2.1 สร้าง Service Account
1. ไปที่ **APIs & Services > Credentials**
2. คลิก **+ CREATE CREDENTIALS**
3. เลือก **Service account**
4. กรอกข้อมูล:
   - **Service account name**: `linebot-drive-service`
   - **Service account ID**: จะถูกสร้างอัตโนมัติ
   - **Description**: `Service account for LINE Bot Google Drive integration`
5. คลิก **CREATE AND CONTINUE**
6. ข้าม **Grant this service account access to project** (คลิก **CONTINUE**)
7. ข้าม **Grant users access to this service account** (คลิก **DONE**)

### 2.2 สร้าง Private Key
1. ในหน้า **Credentials** จะเห็น Service Account ที่สร้าง
2. คลิก **Service Account ที่สร้าง**
3. ไปที่แท็บ **KEYS**
4. คลิก **ADD KEY > Create new key**
5. เลือก **JSON**
6. คลิก **CREATE**
7. ไฟล์ JSON จะถูกดาวน์โหลด - **เก็บไฟล์นี้ไว้อย่างปลอดภัย**

### 2.3 ดึงข้อมูลจากไฟล์ JSON
เปิดไฟล์ JSON ที่ดาวน์โหลด จะเห็นข้อมูลแบบนี้:
```json
{
  "type": "service_account",
  "project_id": "line-bot-drive-new",
  "private_key_id": "abc123...",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...\n-----END PRIVATE KEY-----\n",
  "client_email": "linebot-drive-service@line-bot-drive-new.iam.gserviceaccount.com",
  "client_id": "123456789...",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token"
}
```

**บันทึกข้อมูลนี้:**
- **client_email**: `linebot-drive-service@line-bot-drive-new.iam.gserviceaccount.com`
- **private_key**: `-----BEGIN PRIVATE KEY-----\n....\n-----END PRIVATE KEY-----\n`

## 📁 ขั้นตอนที่ 3: สร้างโฟลเดอร์ใน Google Drive

### 3.1 สร้างโฟลเดอร์ใหม่
1. ไปที่ [Google Drive](https://drive.google.com/)
2. คลิกขวาในพื้นที่ว่าง
3. เลือก **New > Folder**
4. ตั้งชื่อโฟลเดอร์: `LINE Bot Files` (หรือชื่อที่ต้องการ)
5. คลิก **CREATE**

### 3.2 แชร์โฟลเดอร์ให้ Service Account
1. คลิกขวาที่โฟลเดอร์ที่สร้าง
2. เลือก **Share**
3. ในช่อง **Add people and groups** ใส่:
   ```
   linebot-drive-service@line-bot-drive-new.iam.gserviceaccount.com
   ```
   (ใช้ email จากไฟล์ JSON ที่ได้)
4. เปลี่ยนสิทธิ์เป็น **Editor**
5. **ยกเลิกการติ๊ก** "Notify people"
6. คลิก **Share**

### 3.3 คัดลอก Folder ID
1. เปิดโฟลเดอร์ที่สร้าง
2. ดู URL ในแถบที่อยู่:
   ```
   https://drive.google.com/drive/folders/1ABC123XYZ789DEF456GHI
   ```
3. คัดลอกส่วน **Folder ID**: `1ABC123XYZ789DEF456GHI`

## 🔧 ขั้นตอนที่ 4: อัปเดต Environment Variables

### 4.1 แก้ไขไฟล์ .env.local
แทนที่ค่าในไฟล์ `.env.local`:

```env
# Google Drive Configuration - NEW SETUP
GOOGLE_SERVICE_ACCOUNT_EMAIL=linebot-drive-service@line-bot-drive-new.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...\n-----END PRIVATE KEY-----\n"
GOOGLE_DRIVE_FOLDER_ID=1ABC123XYZ789DEF456GHI
```

**หมายเหตุ:**
- ใช้ `client_email` จากไฟล์ JSON
- ใช้ `private_key` จากไฟล์ JSON (รวมทั้ง `\n`)
- ใช้ Folder ID ที่คัดลอกมา

### 4.2 ตัวอย่างการกรอกข้อมูล
```env
GOOGLE_SERVICE_ACCOUNT_EMAIL=linebot-drive-service@my-project-123456.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDEXAMPLE...\n-----END PRIVATE KEY-----\n"
GOOGLE_DRIVE_FOLDER_ID=1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms
```

## 🧪 ขั้นตอนที่ 5: ทดสอบการเชื่อมต่อ

### 5.1 ทดสอบผ่านเว็บไซต์
1. เปิดเว็บไซต์ LINE Bot Dashboard
2. คลิกปุ่ม **"📂 ทดสอบ Google Drive API"**
3. ตรวจสอบผลลัพธ์

### 5.2 ผลลัพธ์ที่คาดหวัง
**หากสำเร็จ:**
```
✅ การทดสอบผ่าน
เชื่อมต่อ Google Drive สำเร็จ! พบ 0 ไฟล์ในโฟลเดอร์ "LINE Bot Files"
```

**หากไม่สำเร็จ:**
```
❌ การทดสอบไม่ผ่าน
[ข้อความแสดงข้อผิดพลาดและข้อเสนอแนะ]
```

## ⚠️ การแก้ไขปัญหาที่พบบ่อย

### ปัญหา: "ไม่พบโฟลเดอร์ Google Drive หรือไม่มีสิทธิ์เข้าถึง"
**วิธีแก้:**
1. ตรวจสอบ Folder ID ให้ถูกต้อง
2. แชร์โฟลเดอร์ให้ Service Account Email
3. ให้สิทธิ์ Editor หรือ Owner

### ปัญหา: "ข้อมูล Service Account ไม่ถูกต้อง"
**วิธีแก้:**
1. ตรวจสอบ Private Key format
2. ตรวจสอบ Service Account Email
3. ตรวจสอบว่า Service Account ยังใช้งานได้

### ปัญหา: "Google Drive API ไม่ได้เปิดใช้งาน"
**วิธีแก้:**
1. เปิดใช้งาน Google Drive API ใน Google Cloud Console
2. ตรวจสอบ Project ID ให้ถูกต้อง

## 📞 การสนับสนุน

หากพบปัญหา:
1. ตรวจสอบ Environment Variables ให้ครบถ้วน
2. ทดสอบผ่านปุ่ม "ทดสอบ Google Drive API"
3. ดูข้อเสนอแนะในผลลัพธ์การทดสอบ
4. ตรวจสอบ Google Cloud Console และ Google Drive permissions

---
**สำคัญ:** อย่าลืม commit ไฟล์ `.env.local` ลงใน `.gitignore` เพื่อความปลอดภัย!
