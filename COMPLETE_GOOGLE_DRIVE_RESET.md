# 🔄 การลบและสร้างใหม่ทั้งหมด - Google Drive Integration

## 🗑️ ขั้นตอนที่ 1: ลบทุกอย่างที่เกี่ยวข้อง

### A. ลบ Google Cloud Project เก่า (ถ้ามี)
1. ไปที่ [Google Cloud Console](https://console.cloud.google.com/)
2. เลือก Project เก่า: `continual-works-461209-t4`
3. ไปที่ **Settings > Shut down**
4. ยืนยันการลบ Project

### B. ลบโฟลเดอร์ Google Drive เก่า (ถ้ามี)
1. ไปที่ [Google Drive](https://drive.google.com/)
2. หาโฟลเดอร์ที่เกี่ยวข้องกับ LINE Bot
3. คลิกขวา > **Move to trash**

## 🆕 ขั้นตอนที่ 2: สร้างใหม่ทั้งหมด

### A. สร้าง Google Cloud Project ใหม่
1. ไปที่ [Google Cloud Console](https://console.cloud.google.com/)
2. คลิก **Select a project** > **NEW PROJECT**
3. กรอกข้อมูล:
   - **Project name**: `linebot-drive-2024`
   - **Project ID**: จะถูกสร้างอัตโนมัติ (เช่น `linebot-drive-2024-123456`)
4. คลิก **CREATE**
5. รอให้ Project สร้างเสร็จ (ประมาณ 1-2 นาที)

### B. เปิดใช้งาน Google Drive API
1. เลือก Project ใหม่ที่สร้าง
2. ไปที่ **APIs & Services > Library**
3. ค้นหา "Google Drive API"
4. คลิก **Google Drive API**
5. คลิก **ENABLE**
6. รอให้เปิดใช้งานเสร็จ

### C. สร้าง Service Account ใหม่
1. ไปที่ **APIs & Services > Credentials**
2. คลิก **+ CREATE CREDENTIALS**
3. เลือก **Service account**
4. กรอกข้อมูล:
   - **Service account name**: `linebot-service`
   - **Service account ID**: จะถูกสร้างอัตโนมัติ (เช่น `linebot-service`)
   - **Description**: `Service account for LINE Bot Google Drive integration`
5. คลิก **CREATE AND CONTINUE**
6. ข้าม **Grant this service account access to project** (คลิก **CONTINUE**)
7. ข้าม **Grant users access to this service account** (คลิก **DONE**)

### D. สร้าง Private Key
1. ในหน้า **Credentials** จะเห็น Service Account ที่สร้าง
2. คลิกที่ **Service Account ที่สร้าง**
3. ไปที่แท็บ **KEYS**
4. คลิก **ADD KEY > Create new key**
5. เลือก **JSON**
6. คลิก **CREATE**
7. ไฟล์ JSON จะถูกดาวน์โหลดอัตโนมัติ - **เก็บไฟล์นี้ไว้ให้ปลอดภัย**

### E. ดึงข้อมูลจากไฟล์ JSON
เปิดไฟล์ JSON ที่ดาวน์โหลด จะเห็นข้อมูลแบบนี้:
```json
{
  "type": "service_account",
  "project_id": "linebot-drive-2024-123456",
  "private_key_id": "abc123...",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...\n-----END PRIVATE KEY-----\n",
  "client_email": "linebot-service@linebot-drive-2024-123456.iam.gserviceaccount.com",
  "client_id": "123456789...",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token"
}
```

**บันทึกข้อมูลสำคัญ:**
- **client_email**: `linebot-service@linebot-drive-2024-123456.iam.gserviceaccount.com`
- **private_key**: `-----BEGIN PRIVATE KEY-----\n....\n-----END PRIVATE KEY-----\n`

### F. สร้างโฟลเดอร์ Google Drive ใหม่
1. ไปที่ [Google Drive](https://drive.google.com/)
2. คลิกขวาในพื้นที่ว่าง
3. เลือก **New > Folder**
4. ตั้งชื่อโฟลเดอร์: `LINE Bot Uploads 2024`
5. คลิก **CREATE**

### G. แชร์โฟลเดอร์ให้ Service Account
1. คลิกขวาที่โฟลเดอร์ที่สร้าง
2. เลือก **Share**
3. ในช่อง **Add people and groups** ใส่:
   ```
   linebot-service@linebot-drive-2024-123456.iam.gserviceaccount.com
   ```
   (ใช้ email จากไฟล์ JSON ที่ได้)
4. เปลี่ยนสิทธิ์เป็น **Editor**
5. **ยกเลิกการติ๊ก** "Notify people"
6. คลิก **Share**

### H. คัดลอก Folder ID
1. เปิดโฟลเดอร์ที่สร้าง
2. ดู URL ในแถบที่อยู่:
   ```
   https://drive.google.com/drive/folders/1NEW_FOLDER_ID_HERE
   ```
3. คัดลอกส่วน **Folder ID**: `1NEW_FOLDER_ID_HERE`

## 🔧 ขั้นตอนที่ 3: อัปเดต Environment Variables

### แก้ไขไฟล์ .env.local
แทนที่ค่าในไฟล์ `.env.local`:

```env
# Google Drive Configuration - COMPLETELY NEW SETUP
GOOGLE_SERVICE_ACCOUNT_EMAIL=linebot-service@linebot-drive-2024-123456.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...\n-----END PRIVATE KEY-----\n"
GOOGLE_DRIVE_FOLDER_ID=1NEW_FOLDER_ID_HERE
```

**หมายเหตุ:**
- ใช้ `client_email` จากไฟล์ JSON
- ใช้ `private_key` จากไฟล์ JSON (รวมทั้ง `\n`)
- ใช้ Folder ID ที่คัดลอกมา

## 🧪 ขั้นตอนที่ 4: ทดสอบการเชื่อมต่อ

### ทดสอบผ่านเว็บไซต์
1. เปิดเว็บไซต์ LINE Bot Dashboard
2. คลิกปุ่ม **"📂 ทดสอบ Google Drive API"**
3. ตรวจสอบผลลัพธ์

### ผลลัพธ์ที่คาดหวัง
**หากสำเร็จ:**
```
✅ การทดสอบผ่าน
เชื่อมต่อ Google Drive สำเร็จ! พบ 0 ไฟล์ในโฟลเดอร์ "LINE Bot Uploads 2024"
```

## 📋 Checklist การตั้งค่า

- [ ] ลบ Google Cloud Project เก่า
- [ ] ลบโฟลเดอร์ Google Drive เก่า
- [ ] สร้าง Google Cloud Project ใหม่
- [ ] เปิดใช้งาน Google Drive API
- [ ] สร้าง Service Account ใหม่
- [ ] สร้าง Private Key และดาวน์โหลดไฟล์ JSON
- [ ] สร้างโฟลเดอร์ Google Drive ใหม่
- [ ] แชร์โฟลเดอร์ให้ Service Account
- [ ] คัดลอก Folder ID
- [ ] อัปเดต Environment Variables ใน .env.local
- [ ] ทดสอบการเชื่อมต่อ

## ⚠️ ข้อควรระวัง

1. **เก็บไฟล์ JSON ให้ปลอดภัย** - อย่าแชร์หรือ commit ลง Git
2. **ตรวจสอบ Project ID** - ต้องใช้ Project ใหม่ที่สร้าง
3. **ตรวจสอบ Service Account Email** - ต้องตรงกับที่แชร์ในโฟลเดอร์
4. **ตรวจสอบ Folder ID** - ต้องเป็นโฟลเดอร์ใหม่ที่สร้าง

## 🎯 เป้าหมาย

หลังจากทำตามขั้นตอนนี้เสร็จ:
- ✅ Google Drive integration ทำงานได้ 100%
- ✅ ไม่มีปัญหาเรื่อง permissions
- ✅ ระบบพร้อมสำหรับการใช้งานจริง
- ✅ ปลอดภัยและเป็นระเบียบ

---
**สำคัญ:** ทำตามขั้นตอนทีละขั้น และทดสอบหลังจากแต่ละขั้นตอนเสร็จ!
