# Frame — Image Framing Studio

เว็บแอปภาษาไทยสำหรับ zoom out / zoom in / resize และขยายฉากเพื่อเปลี่ยนแนวภาพ พร้อม UI ให้เลือกงานและภาพอ้างอิงก่อนอัปโหลดภาพต้นฉบับ

## ต้องใช้ข้อมูลรับรองแบบใด

เว็บนี้ใช้ **OpenAI API key** ที่ฝั่งเซิร์ฟเวอร์ เพื่อเรียก Images API สำหรับแก้ไขภาพ การลงชื่อเข้าใช้ Codex ด้วยบัญชี ChatGPT ไม่มี Codex token ที่เว็บ GitHub ภายนอกนำมาใช้แทน API key ได้ เว็บจึงไม่อ่านหรือส่งต่อ Codex session token

API key ไม่ได้รวมอยู่ใน source และห้ามเพิ่มลง GitHub ให้ใส่เป็น environment secret บนโฮสต์ที่ใช้รันเซิร์ฟเวอร์แทน การใช้ Images API อาจมีค่าใช้จ่ายแยกจากสิทธิ์ใช้งาน Codex/ChatGPT

หาก deploy เป็นเว็บสาธารณะ ให้ตั้ง `APP_ACCESS_PASSWORD` เป็นรหัสเข้าใช้แบบ shared secret ด้วย production server จะไม่เริ่มทำงานถ้าไม่มีค่านี้ หน้าเว็บจะขอรหัสก่อนส่งคำขอแก้ภาพ และเก็บรหัสไว้ในหน่วยความจำของแท็บปัจจุบันเท่านั้น

## รันในเครื่อง

ต้องใช้ Node.js 22 ขึ้นไป

```bash
npm install
```

ตั้ง environment variable ก่อนเริ่มเซิร์ฟเวอร์:

**PowerShell**

```powershell
$env:OPENAI_API_KEY="your-api-key"
$env:APP_ACCESS_PASSWORD="choose-a-private-access-password"
npm run dev
```

**macOS / Linux**

```bash
OPENAI_API_KEY="your-api-key" npm run dev
```

เปิด `http://localhost:3000` เว็บจะส่งภาพไปยัง API ผ่านเซิร์ฟเวอร์ของโปรเจ็กต์ และแสดงผลลัพธ์ให้ดาวน์โหลด

## นำขึ้น GitHub และ deploy

โปรเจ็กต์นี้มีทั้งหน้าเว็บและ API server จึงไม่สามารถทำ image edit บน GitHub Pages เพียงอย่างเดียวได้ ให้นำ repository นี้ขึ้น GitHub แล้ว deploy Node.js service บนโฮสต์ที่รองรับ Node.js เช่น Render, Railway หรือ Fly.io จากนั้นตั้ง `OPENAI_API_KEY` เป็น secret/environment variable ในหน้า dashboard ของโฮสต์ ห้ามใส่ key ใน GitHub Actions log, source code หรือไฟล์ `.env` ที่ commit ขึ้น repository

บนโฮสต์ให้ใช้คำสั่ง build ว่าง และ start command เป็น `npm start` (Node 22+). ตั้ง `OPENAI_API_KEY` และ `APP_ACCESS_PASSWORD` เป็น environment secrets ในหน้า dashboard ของโฮสต์ ตรวจว่า route `/api/health` ตอบกลับก่อนใช้งาน

## การทำงาน

- เลือกหนึ่งรายการหรือหลายรายการใน UI: Zoom out, Zoom in, Resize และเปลี่ยนแนวตั้ง/แนวนอน
- เลือกว่าจะมีภาพอ้างอิงหรือไม่; ถ้าเลือกมี ระบบจะรอภาพอ้างอิงก่อนส่งประมวลผล
- เลือกระดับซูมหรือสัดส่วนภาพจากตัวเลือกสำเร็จรูป โดยสัดส่วนที่เลือกจะกำหนดขนาดผลลัพธ์ผ่าน Images API ด้วย
- ภาพต้นฉบับและภาพอ้างอิงถูกส่งเป็น multipart form ไปยัง API server แล้วส่งต่อให้ OpenAI Images API
- ไฟล์ภาพถูกเก็บในหน่วยความจำระหว่างคำขอและไม่เขียนลงดิสก์โดยแอป

## หมายเหตุ

- รองรับ PNG, JPEG และ WebP ขนาดไม่เกิน 20 MB ต่อภาพ
- ค่าใช้จ่าย, สิทธิ์ใช้งาน และ rate limits เป็นไปตาม OpenAI API project ที่ใช้กับ API key
- การแก้ไขภาพด้วย AI อาจเปลี่ยนรายละเอียดบางส่วนของภาพต้นฉบับ
