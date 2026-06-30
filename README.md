# JUZNOTIFY — WhatsApp Рассылка Платформасы

## Архитектура

```
Frontend (React + Vite) → Backend (Node.js + Express) → PostgreSQL
                                      ↓
                              WhatsApp Web JS (рассылка)
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

### 3. Frontend
```bash
cd frontend
npm install
cp .env.example .env
# VITE_API_URL=http://localhost:3001/api

npm run dev
# → http://localhost:5173
```

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
- `POST /api/auth/register` — тіркелу
- `POST /api/auth/login` — кіру

### Groups
- `GET /api/groups` — топтар тізімі
- `POST /api/groups` — топ жасау
- `GET /api/groups/:id/students` — оқушылар
- `POST /api/groups/:id/students` — оқушы қосу
- `POST /api/groups/:id/students/bulk` — жаппай қосу

### WhatsApp
- `GET /api/whatsapp/qr` — QR код (SSE)
- `GET /api/whatsapp/status` — статус
- `POST /api/whatsapp/send` — хабарлама жіберу
- `GET /api/whatsapp/history` — тарих

### Stats
- `GET /api/stats` — метрикалар

## Маңызды ескерту

WhatsApp-web.js **unofficial** API қолданады. WhatsApp кез келген уақытта сессияны блоктауы мүмкін. Өндірістік пайдалану үшін **WhatsApp Business API** (Meta) ресми нұсқасын қарастырыңыз.
