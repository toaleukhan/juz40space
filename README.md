# JUZ40 Online Education

Кураторларға арналған JUZ40 Online Education платформасы.

## Ағымдағы жағдай

Қазір негізгі назар — **сабақ кестесі** функционалына аударылған (SMART + JUNIOR ағындары бойынша апталық/айлық кесте, пәндер мен мұғалімдер шолуы). WhatsApp рассылка (куратор кабинеті) коды репозиторийде сақталған, бірақ **уақытша өшірілген** — интерфейсте (sidebar, роутинг) көрсетілмейді, сабақ кестесі толық дамығанша қайта қосылмайды.

Публикалық тіркелу жоқ — жаңа куратор аккаунтын тек сервер қолжетімділігі бар адам [backend/scripts/create-curator.js](backend/scripts/create-curator.js) скрипті арқылы қолмен жасайды.

## Архитектура

```
Frontend (React + Vite) → Backend (Node.js + Express) → PostgreSQL
```

## Жылдам старт (локально)

### 1. PostgreSQL орнату
```bash
# Mac
brew install postgresql && brew services start postgresql
createdb juznotify

# Ubuntu
sudo apt install postgresql
sudo -u postgres createdb juznotify
```

### 2. Backend
```bash
cd backend
npm install
cp .env.example .env
# .env файлын өзгерт: DATABASE_URL, JWT_SECRET

npm run dev
# → http://localhost:3001
```

### 3. Куратор аккаунтын жасау

Тіркелу беті жоқ, сондықтан бірінші (немесе кез келген) куратор аккаунтын қолмен жасау керек:

```bash
cd backend
node scripts/create-curator.js "Аты-жөні" "+77001234567" "құпия_сөз" "Топ атауы"
```

### 4. Frontend
```bash
cd frontend
npm install
cp .env.example .env
# VITE_API_URL=http://localhost:3001/api

npm run dev
# → http://localhost:5173
```

## Негізгі беттер

- `/login` — жалғыз ашық бет, жүйеге кіру
- `/dashboard`, `/` — пәндер шолуы
- `/schedule` — сабақ кестесі (қазіргі негізгі даму бағыты)

## Railway-ге Deploy (өндіріс)

### 1. GitHub-қа жүктеу
```bash
git init
git add .
git commit -m "JUZNOTIFY initial"
git push origin main
```

### 2. Railway.app-та жаңа проект
1. railway.app → New Project → GitHub repo
2. **PostgreSQL** қосу: Add Service → Database → PostgreSQL
3. **Backend** сервис: Root Directory = `backend`
   - Environment Variables:
     ```
     DATABASE_URL=${{Postgres.DATABASE_URL}}
     JWT_SECRET=кез_келген_ұзын_кілт
     NODE_ENV=production
     FRONTEND_URL=https://сенің-frontend.up.railway.app
     ```
4. **Frontend** сервис: Root Directory = `frontend`
   - Environment Variables:
     ```
     VITE_API_URL=https://сенің-backend.up.railway.app/api
     ```

## API Endpoints

### Auth
- `POST /api/auth/login` — кіру

### Groups
- `GET /api/groups` — топтар тізімі
- `POST /api/groups` — топ жасау
- `GET /api/groups/:id/students` — оқушылар
- `POST /api/groups/:id/students` — оқушы қосу
- `POST /api/groups/:id/students/bulk` — жаппай қосу

### Schedule
- `POST /api/parse-schedule` — .docx кестені парсинг жасау (Басқарушы кабинеті)

### Stats
- `GET /api/stats` — метрикалар

### WhatsApp (уақытша өшірілген, интерфейсте жоқ)
- `GET /api/whatsapp/qr` — QR код (SSE)
- `GET /api/whatsapp/status` — статус
- `POST /api/whatsapp/send` — хабарлама жіберу
- `GET /api/whatsapp/history` — тарих

WhatsApp-web.js **unofficial** API қолданады. WhatsApp кез келген уақытта сессияны блоктауы мүмкін. Өндірістік пайдалану үшін **WhatsApp Business API** (Meta) ресми нұсқасын қарастырыңыз.
