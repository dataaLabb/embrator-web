# Embrator Web

بوابة ويب لإدارة الزيارات والتحصيلات والطلبيات والعملاء والمنتجات ولوحات التحليل.

## الملفات المهمة

- `index.html`: الواجهة
- `src/styles.css`: التصميم
- `src/app.js`: منطق الواجهة
- `server.js`: الـ backend بـ Node/Express
- `.env.example`: متغيرات البيئة المطلوبة
- `render.yaml`: إعداد النشر على Render

## التشغيل المحلي

```powershell
cd C:\Users\Dell\Documents\embrator\embrator-web
npm install
npm start
```

ثم افتح:

`http://localhost:3000`

## متغيرات البيئة

أنشئ ملف `.env` داخل المشروع:

```env
PORT=3000
DATABASE_URL=postgresql://USER:PASSWORD@HOST/DBNAME?sslmode=require
JWT_SECRET=replace-with-a-long-random-secret
```

## رفع المشروع على Render

المشروع أصبح جاهزًا للرفع على Render كـ `Web Service`.

### 1. ارفع المشروع على GitHub

من داخل [C:\Users\Dell\Documents\embrator\embrator-web](C:\Users\Dell\Documents\embrator\embrator-web):

```powershell
git init
git add .
git commit -m "Prepare Embrator Web for Render deployment"
```

ثم أنشئ repo جديد على GitHub وارفعه له.

### 2. أنشئ خدمة جديدة على Render

1. ادخل [Render Dashboard](https://render.com/)
2. اختر `New +`
3. اختر `Web Service`
4. اربط GitHub repository
5. Render سيقرأ `render.yaml` تلقائيًا

### 3. أضف Environment Variables

داخل Render أضف:

- `DATABASE_URL`
- `JWT_SECRET`

ولا ترفع ملف `.env` نفسه إلى GitHub.

### 4. Health Check

تمت إضافة endpoint جاهز:

`/healthz`

Render سيستخدمه للتأكد أن الخدمة تعمل.

## ملاحظات مهمة

- المشروع يخدم الواجهة والـ API من نفس الخدمة
- صور الشيكات تُضغط من المتصفح قبل الرفع لتقليل البطء
- معاينة صورة الشيك تتم عند الطلب فقط لتحسين الأداء
- لو أردت دومين مجاني من Render سيظهر بالشكل:
  `https://your-service.onrender.com`

## بيانات دخول افتراضية

- `admin@embrator.com`
- `12345678`
