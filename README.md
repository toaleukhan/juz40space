# JUZ40 Online Education

Кураторларға арналған JUZ40 Online Education платформасы.

## Ағымдағы жағдай

Қазір негізгі назар — **сабақ кестесі** функционалына аударылған (SMART + JUNIOR ағындары бойынша апталық/айлық кесте, пәндер мен мұғалімдер шолуы). WhatsApp рассылка (куратор кабинеті) коды репозиторийде сақталған, бірақ **уақытша өшірілген** — интерфейсте (sidebar, роутинг) көрсетілмейді, сабақ кестесі толық дамығанша қайта қосылмайды.

Публикалық тіркелу жоқ — жаңа куратор аккаунтын тек сервер қолжетімділігі бар адам [backend/scripts/create-curator.js](backend/scripts/create-curator.js) скрипті арқылы қолмен жасайды.

## Даму процесі — `main`-ге тікелей push жасамау

`main` = әрқашан жұмыс істейтін, тексерілген нұсқа (production осыдан деплой болады). Жаңа функция немесе үлкенірек өзгеріс кезінде:

1. **Жаңа branch ашу** (GitHub Desktop: "Current Branch" → "New Branch", атын мағыналы қой, мыс. `feature/file-upload`)
2. Сол branch-қа commit жасап, **соны** push жасау (`main`-ді емес)
3. Vercel GitHub-пен байланысты болғандықтан, әр push-тан кейін **автоматты preview сілтеме** пайда болады (Vercel dashboard → Deployments, немесе GitHub-тағы commit статусында сілтеме шығады) — production доменге (`juz40.space`) тимейді
4. Сол preview сілтемеде тексер (мыс. ауыр файл жүктеу, жаңа беттер, т.б.) — сынса, тек preview бұзылады, нақты сайт зақымдалмайды
5. Көңіліңізден шықса ғана — branch-ты `main`-ге merge жаса (GitHub Desktop: "Branch" → "Merge into current branch" немесе GitHub-та Pull Request ашу)

Backend (Railway) үшін preview автоматты емес — ауыр жүктеме/деректер қорына қатысты өзгерісті локалды (`npm run dev` + локалды Postgres) тексеріп алған дұрыс.

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
node scripts/create-curator.js "Аты-жөні" "логин" "құпия_сөз" "Пән" ["Ағым"]
# мыс: node scripts/create-curator.js "Асель Ержанова" "asel_math" "kupiya123" "МАТ" "01"
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
- `GET /api/schedule/overrides` — "Енгізу" арқылы қолмен қосылған сабақтар (барлық кураторға ортақ)
- `PUT /api/schedule/overrides` — сол деректерді сақтау

### Stats
- `GET /api/stats` — метрикалар

### WhatsApp (уақытша өшірілген, интерфейсте жоқ)
- `GET /api/whatsapp/qr` — QR код (SSE)
- `GET /api/whatsapp/status` — статус
- `POST /api/whatsapp/send` — хабарлама жіберу
- `GET /api/whatsapp/history` — тарих

WhatsApp-web.js **unofficial** API қолданады. WhatsApp кез келген уақытта сессияны блоктауы мүмкін. Өндірістік пайдалану үшін **WhatsApp Business API** (Meta) ресми нұсқасын қарастырыңыз.
