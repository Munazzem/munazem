# خطوات الـ Deployment (خطوة بخطوة)

الريبو فيه مجلدين: **frontend** (Next.js) و **backend** (Node + Express). كل واحد يتبقى على سيرفس منفصل.

---

## قبل ما تبدأ

1. حساب على [MongoDB Atlas](https://www.mongodb.com/atlas) (مجاني).
2. حساب على [Vercel](https://vercel.com) (فرونت).
3. حساب على [Render](https://render.com) (باك).

---

## الجزء ١: قاعدة البيانات (MongoDB Atlas)

1. ادخل [cloud.mongodb.com](https://cloud.mongodb.com) وسجّل دخول.
2. **Create Project** → سمّه مثلاً `monazem` → Create.
3. **Build Database** → اختر **M0 FREE** → Next.
4. اختار منطقة قريبة منك (مثلاً Frankfurt أو AWS eu) → Create.
5. **Create Database User**: username + password (احفظهم) → Create User.
6. **Where would you like to connect from?** → **Add My Current IP Address** (أو **Allow Access from Anywhere** `0.0.0.0/0` للاختبار) → Finish and Close.
7. من الشاشة الرئيسية اضغط **Connect** على الـ cluster → **Drivers** → انسخ الـ **Connection String** (شكلها `mongodb+srv://user:pass@cluster0.xxxxx.mongodb.net/`).
8. حط اسم الداتابيز في الرابط: في آخر الرابط قبل `?` اضف `/monazem` مثلاً:
   ```
   mongodb+srv://user:pass@cluster0.xxxxx.mongodb.net/monazem?retryWrites=true&w=majority
   ```
   احفظ الرابط ده؛ هتحطه في الـ Backend على Render باسم **MONGO_URL**.

---

## الجزء ٢: الـ Backend على Render

1. ادخل [dashboard.render.com](https://dashboard.render.com) → **New +** → **Web Service**.
2. **Connect a repository** → اختر الريبو (مثلاً `munazem-system/munazem`) وربطه بحساب GitHub.
3. الإعدادات:
   - **Name:** مثلاً `monazem-api`.
   - **Region:** أي منطقة مناسبة.
   - **Branch:** `main`.
   - **Root Directory:** اكتب `backend` (مهم جداً).
   - **Runtime:** `Node`.
   - **Build Command:**
     ```bash
     npm install
     ```
   - **Start Command:**
     ```bash
     npm start
     ```
   - **Instance Type:** Free.

4. **Environment Variables** (اضغط Add Environment Variable وحط كل واحد):
   | Key | Value |
   |-----|--------|
   | `NODE_ENV` | `production` |
   | `PORT` | اتركه فاضي (Render يحط القيمة تلقائي) أو `10000` |
   | `MONGO_URL` | الرابط اللي نسخته من Atlas (مع `/monazem` في الآخر) |
   | `JWT_SECRET` | سلسلة عشوائية قوية (مثلاً 64 حرف) |
   | `JWT_REFRESH_SECRET` | سلسلة عشوائية قوية مختلفة |
   | `FRONTEND_URL` | هتحطه بعد ما الفرونت يتبقى على Vercel (مثلاً `https://monazem.vercel.app`) |

   اختياري:
   - `ENABLE_AI_EXAMS` = `false` (لو عايز AI الامتحانات معطّل على الفري بلان).

5. **Create Web Service**.
6. انتظر الـ deploy يخلص. بعدها خد **الرابط** بتاع السيرفس (مثلاً `https://monazem-api.onrender.com`) — ده هيكون الـ **API URL** اللي تحطه في الفرونت.

---

## الجزء ٣: الـ Frontend على Vercel

1. ادخل [vercel.com](https://vercel.com) → **Add New…** → **Project**.
2. **Import** الريبو من GitHub (نفس ريبو monazem).
3. الإعدادات:
   - **Framework Preset:** Next.js (يختاره تلقائي).
   - **Root Directory:** غيّره من الافتراضي إلى **frontend** (مهم).
   - **Build Command:** يفضل يبقى `npm run build` أو اترك الافتراضي.
   - **Output Directory:** اترك الافتراضي.

4. **Environment Variables**:
   | Name | Value |
   |------|--------|
   | `NEXT_PUBLIC_API_URL` | رابط الـ Backend من Render (مثلاً `https://monazem-api.onrender.com`) **بدون** `/` في الآخر |

   لو عندك:
   - `NEXT_PUBLIC_ENABLE_AI_EXAMS` = `false` (لو عايز تخفي/تعطّل زر AI الامتحانات).

5. **Deploy**.
6. بعد ما الـ deploy يخلص، خد رابط المشروع (مثلاً `https://monazem.vercel.app`).

---

## الجزء ٤: ربط الفرونت بالباك

1. روح **Render** → مشروع الـ Backend → **Environment**.
2. عدّل **FRONTEND_URL** وحط رابط الـ Frontend من Vercel (مثلاً `https://monazem.vercel.app`).
3. احفظ واعمل **Manual Deploy** عشان السيرفس يقرأ القيمة الجديدة.

كدا الفرونت هيبعت الطلبات على الباك، والـ CORS هتكون مظبوطة لأنك حاطط نفس الـ FRONTEND_URL في الباك.

---

## ملخص الأوامر والقيم

| المكان | Root Directory | Build | Start / Deploy |
|--------|----------------|-------|-----------------|
| **Render (Backend)** | `backend` | `npm install` | `npm start` |
| **Vercel (Frontend)** | `frontend` | `npm run build` (افتراضي) | تلقائي |

---

## بعد الـ Deploy

- جرّب تسجيل الدخول من رابط Vercel.
- لو أول مرة: محتاج تنشئ أول مستخدم superAdmin من الـ Backend (يدوياً في الداتابيز أو endpoint خاص لو موجود).
- لو الـ Backend على Free tier في Render وهيغفّل بعد فترة عدم استخدام، ممكن تستخدم [cron-job.org](https://cron-job.org) يضرب `https://monazem-api.onrender.com/health` كل ١٤ دقيقة عشان السيرفس يفضل مستيقظ.
