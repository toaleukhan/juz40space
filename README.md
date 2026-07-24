# JUZ40 Space

Кураторларға арналған JUZ40 ішкі платформасы: сабақ кестесі, СТ (сабақ тапсыру) жазбалары мен отслежкасы, кураторлар базасы, дэшборд.

Публикалық тіркелу жоқ — жаңа куратор аккаунтын тек сервер қолжетімділігі бар адам [backend/scripts/create-curator.js](backend/scripts/create-curator.js) скрипті арқылы қолмен жасайды.

## Негізгі беттер

- `/login` — жалғыз ашық бет, жүйеге кіру
- `/schedule` — сабақ кестесі (SMART/JUNIOR ағындары бойынша апталық/айлық)
- `/st-recordings` — СТ жүйесі: пән/ағым бойынша кураторлардың Мит-і, видео жазбасы, отслежкасы
- `/curators` — кураторлар базасы (тек admin)
- `/dashboard` — аналитика: KPI, тренд, куратор рейтингі
- `/profile` — куратордың жеке кабинеті (профиль + өз СТ-жазба тарихы)

## Архитектура

```
Frontend (React + Vite, Vercel) → Backend (Node.js + Express, Railway) → PostgreSQL
                                          ↓
                          Google Calendar/Meet + Drive (пән бойынша жеке аккаунт)
```

## Даму процесі — `main`-ге тікелей push жасамау

`main` = әрқашан жұмыс істейтін, тексерілген нұсқа (production осыдан деплой болады). Жаңа функция немесе үлкенірек өзгеріс кезінде:

1. **Жаңа branch ашу** (GitHub Desktop: "Current Branch" → "New Branch", атын мағыналы қой, мыс. `feature/file-upload`)
2. Сол branch-қа commit жасап, **соны** push жасау (`main`-ді емес)
3. Vercel GitHub-пен байланысты болғандықтан, әр push-тан кейін **автоматты preview сілтеме** пайда болады (Vercel dashboard → Deployments, немесе GitHub-тағы commit статусында сілтеме шығады) — production доменге (`juz40.space`) тимейді
4. Сол preview сілтемеде тексер (мыс. ауыр файл жүктеу, жаңа беттер, т.б.) — сынса, тек preview бұзылады, нақты сайт зақымдалмайды
5. Көңіліңізден шықса ғана — branch-ты `main`-ге merge жаса (GitHub Desktop: "Branch" → "Merge into current branch" немесе GitHub-та Pull Request ашу)

Backend (Railway) үшін preview автоматты емес — ауыр жүктеме/деректер қорына қатысты өзгерісті локалды (`npm run dev` + локалды Postgres) тексеріп алған дұрыс.

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

## Google Meet/Calendar — пән бойынша жеке аккаунт

СТ жүйесіндегі "Мит ашу" әр пән үшін **өз алдына жеке Google аккаунтпен** жұмыс істейді (мыс. физика кураторлары физика домен аккаунтымен ашады) — ортақ аккаунт жоқ, себебі бір пәннің Мит-і басқа пәннің атынан ашылмауы керек.

Пән коды → орта айнымалысының жалғауы: `ФИЗ→FIZ, МАТ→MAT, ТІЛ→TIL, БИО→BIO, ИНФО→INFO, ГЕО→GEO, ТАРИХ→TARIH, РУС→RUS, ХИМ→HIM, МС→MS, ӘДЕБ→ADEB, АНГЛ→ANGL, ДЖТ→DZHT`.

Әр пән үшін Railway-де (backend Variables) осы екеуінің **біреуін** орнату керек:

- `GOOGLE_TOKEN_JSON_<КОД>` + `GOOGLE_CREDENTIALS_JSON_<КОД>` — OAuth client + refresh token жұбы (қолданушы аккаунтпен, ұсынылады, себебі Meet сілтемесін нақты адам аккаунты сенімді жасайды)
- немесе `GOOGLE_SERVICE_ACCOUNT_JSON_<КОД>` — service account (domain-wide delegation жоқ болса, Мит жасауда шектеулі болуы мүмкін)

Токен/credentials жұбын генерациялау үшін: `node backend/scripts/generate-google-token.js path/to/credentials.json` (Google Cloud Console-дан жүктелген OAuth client JSON-ды бір реттік consent flow арқылы токенге айырбастайды — client_id/secret сәйкессіздігінен болатын `invalid_client` қатесін болдырмау үшін екеуін бірге, бір client-тен генерациялау маңызды).

Пәннің өз аккаунты орнатылмаса, сол пәннің кураторлары "Мит ашу" баса алмайды (әдейі істелген тежеу) — "Google авторизация кілттері табылмады" қатесі шығады.

## Railway-ге Deploy (backend, өндіріс)

### 1. Railway.app-та жаңа проект
1. railway.app → New Project → GitHub repo
2. **PostgreSQL** қосу: Add Service → Database → PostgreSQL
3. **Backend** сервис: Root Directory = `backend`
   - Environment Variables:
     ```
     DATABASE_URL=${{Postgres.DATABASE_URL}}
     JWT_SECRET=кез_келген_ұзын_кілт
     NODE_ENV=production
     FRONTEND_URL=https://juz40.space
     ```
   - Пән бойынша Google айнымалылары (жоғарыдағы бөлімді қараңыз)

### 2. Vercel-ге Deploy (frontend, өндіріс)

Frontend Vercel-де GitHub repo-мен байланысты (Root Directory = `frontend`), Environment Variables:
```
VITE_API_URL=https://сенің-backend.up.railway.app/api
```

## API Endpoints

### Auth
- `POST /api/auth/login` — кіру
- `GET /api/auth/me` — ағымдағы қолданушы
- `PUT /api/auth/profile` — профильді жаңарту

### Schedule
- `POST /api/parse-schedule` — .docx кестені парсинг жасау (Басқарушы кабинеті)
- `GET /api/schedule/overrides` — "Енгізу" арқылы қолмен қосылған сабақтар (барлық кураторға ортақ)
- `PUT /api/schedule/overrides` — сол деректерді сақтау

### СТ жазбалары (st-recordings)
- `GET /api/st-recordings` — пән/ағым/апта бойынша тізім (куратор тек өзінікін көреді)
- `POST /api/st-recordings/curator` — жаңа куратор жолы қосу
- `POST /api/st-recordings/create-meet` — Google Meet сілтемесін ашу (пән аккаунты арқылы)
- `POST /api/st-recordings/sync-drive` — Drive-тан видео/отслежка файлдарын тауып байлау
- `PUT /api/st-recordings/:id` — жолды жаңарту (оқушылар саны, ескертпе)
- `DELETE /api/st-recordings/:id` — жолды өшіру

### Кураторлар базасы (тек admin)
- `GET /api/curators` — тізім
- `POST /api/curators` — куратор қосу
- `POST /api/curators/bulk` — жаппай қосу
- `POST /api/curators/:id/generate-login` — логин/пароль генерациялау
- `PUT /api/curators/:id` — жаңарту
- `DELETE /api/curators/:id` — өшіру

### Dashboard
- `GET /api/dashboard/status` — жалпы статус
- `GET /api/dashboard/:subject/monthly` — пән бойынша айлық аналитика

### Stats
- `GET /api/stats` — метрикалар
