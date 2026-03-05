# الإعداد للإنتاج (Production)

## مراقبة السيرفر (Monitoring)

- **Logs:** كل طلب يُسجَّل كسطر JSON واحد (`request_completed`) مع `method`, `path`, `statusCode`, `durationMs`, `userId`, `role`.
- **أخطاء:** الأخطاء تُسجَّل عبر `request_error` مع `path`, `message`, `stack` (للـ 500).
- **Health:** `GET /health` يرجع:
  - `status`, `uptime`, `timestamp`
  - `memory`: `heapUsedMB`, `heapTotalMB`, `rssMB` — لمتابعة استهلاك الذاكرة على Render.

يمكنك استخدام Logs في Render لفلترة `request_error` أو مراقبة `memory.heapUsedMB` إذا زاد عن حد معين.

---

## النسخ الاحتياطي (Backup) — MongoDB

### لو بتستخدم MongoDB Atlas

- من الـ Dashboard: **Database → … → Backup**.
- فعّل **Continuous Backup** (مدفوع) أو **Cloud Backup** حسب الخطة.
- أو استخدم **Scheduled Snapshots** من نفس القائمة وحدد التكرار (يومي/أسبوعي).

### لو قاعدة البيانات self-hosted أو تريد نسخ يدوي

```bash
# تصدير كامل للـ DB (شغّل من جهاز يتصل بالـ MongoDB)
mongodump --uri="mongodb://USER:PASS@HOST:27017/DB_NAME" --out=./backup-$(date +%Y%m%d)

# استعادة من نسخة
mongorestore --uri="mongodb://USER:PASS@HOST:27017/DB_NAME" ./backup-YYYYMMDD/DB_NAME
```

يُفضّل أتمتة الـ backup (cron أو scheduled job) وحفظ الملفات في مكان آمن (مثلاً S3 أو قرص مرفق).

---

## قبل الإطلاق — Checklist مختصر

- [ ] تفعيل/مراجعة backup للـ MongoDB (Atlas أو cron).
- [ ] مراجعة متغيرات البيئة على Render: `MONGO_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `FRONTEND_URL`.
- [ ] التأكد من أن `/health` يعمل وأن Render يستخدمه كـ Health Check Path.
- [ ] تجربة سيناريوهات ثقيلة (PDF، AI امتحانات، تقارير) ومراقبة الـ logs والـ memory من `/health`.
