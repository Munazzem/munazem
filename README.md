# Monazem 🚀

**Monazem** is a comprehensive, closed-ecosystem SaaS management system designed to support and manage educational centers and teachers. The system facilitates the automated and fully secured management of students, attendance, assistants, and subscriptions.

---

## 🛠 Tech Stack
- **Environment:** Node.js, Express.js
- **Language:** TypeScript (for code quality and error reduction)
- **Database:** MongoDB (via Mongoose)
- **Security:** JWT (JSON Web Tokens), Bcrypt (for password hashing)
- **Data Validation:** Zod

---

## ✨ Implemented Features

### 1. Authentication & Security 🔒
- **Robust Login Flow:** Utilizes short-lived `Access Tokens` for enhanced security.
- **Refresh Tokens:** Long-lived tokens (valid for 1 year) to ensure users remain logged in without frequent re-authentication, supporting dynamic session renewal.
- **Password Hashing:** Uses `Bcrypt` to ensure no plain-text passwords are saved in the database.
- **Route Guards:** Custom `Middleware` layers to prevent unauthorized access to sensitive routes.

### 2. Data Validation 🛡
- Integration of **Zod** as a central `Middleware` layer to validate all incoming server requests (Request Body, Query, Params).
- The system rejects any non-compliant data (e.g., phone numbers less than 10 digits, invalid emails) and returns clear `400 Bad Request` errors before reaching the database.

### 3. Role-Based Access Control (RBAC) 👑
The system is designed as a **Closed Ecosystem**, meaning there is no public signup route. User creation follows a strict hierarchical structure:

- **Super Admin:**
  - Holds the highest server authority.
  - Can view invoices and system subscriptions.
  - **Creation Rights:** Authorized to create **Teacher** accounts only.
  
- **Teacher:**
  - Manages their own educational center and students.
  - **Creation Rights:** Authorized to create **Assistant** accounts. The new assistant is automatically linked to the teacher's ID, preventing interference with other teachers.

- **Assistant:**
  - A helping hand for the teacher (e.g., taking attendance, recording grades).
  - No authorization to create any new accounts in the system (`403 Forbidden`).

---

## ⚙️ Development Setup

1. Clone the repository.
2. Install dependencies:
   ```bash
   cd backend
   npm install
   ```
3. Create the `.env` file (including `DB_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`).
4. Start the development server:
   ```bash
   npm run dev
   ```

*(Note: The initial Super Admin record is seeded directly into the database to access the main dashboard).*

---
*Developed with pride to build a stronger educational and organizational environment.* ☕💻
