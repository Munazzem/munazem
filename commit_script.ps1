git checkout -b feature/platform-updates

# WhatsApp
git add backend/src/infrastructure/queues/* whatsapp*
git add backend/src/infrastructure/socket/* whatsapp*
git add backend/src/common/utils/whatsapp.service.ts
git add "frontend/src/app/(dashboard)/admin/automation"
git commit -m "feat(whatsapp): implement realtime automation and socket queues"

# Exams
git add backend/src/modules/exams/exam-pdf.service.ts
git add backend/src/modules/exams/exams.controller.ts
git add "frontend/src/app/(dashboard)/exams"
git add frontend/src/components/exams
git add frontend/src/lib/api/exams.ts
git commit -m "feat(exams): add exam to PDF print-ready generation service"

# Core/Enums
git add backend/src/common/enums/enum.service.ts
git add frontend/src/lib/constants/grade.constants.ts
git add frontend/src/lib/utils/grades.ts
git commit -m "feat(core): add primary school stage to system enums"

# Payments
git add frontend/src/components/payments
git add frontend/src/lib/utils/receiptHtml.ts
git add backend/src/modules/payments
git add backend/src/database/models/price-settings.model.ts
git add backend/src/database/models/transaction.model.ts
git add backend/src/types/price-settings.types.ts
git add backend/src/validation/payment.validation.ts
git add frontend/src/lib/api/payments.ts
git commit -m "feat(payments): add center deduction modal and receipt templates"

# Students
git add backend/src/modules/students/group-cards-pdf.service.ts
git commit -m "feat(students): add group cards PDF generation service"

# Add the documentation file
git add CHANGES_DOC.md
git commit -m "docs: add uncommitted changes documentation"

# Add everything else
git add .
git commit -m "chore(ui): update dashboard charts, admin settings pages, and remaining features"

# Push
git push -u origin feature/platform-updates

# Create PR (using GitHub CLI if available)
gh pr create --title "feat: Major Platform Updates (WhatsApp, Exams, Payments)" --body-file CHANGES_DOC.md --base dev --head feature/platform-updates
