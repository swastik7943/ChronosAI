# ChronosAI - Enterprise Meeting Scheduler Agent

ChronosAI is a production-ready system that allows users to schedule, manage, and view meetings through natural language chat. Engineered with an intelligent agent, responsive design, and seamless cloud integrations.

## 🚀 Key Features
- **AI Chat Scheduler:** Understands intent (schedule, reschedule, cancel) and extracts date, time, and participants locally avoiding rate limits.
- **Enterprise Integrations:** Integrated deep with Google Calendar OAuth and SMTP NodeMailer to dynamically push events and notify attendees perfectly.
- **Smart Disambiguation Engine:** Detects and resolves overlapping contacts or ambiguous names seamlessly via database querying before locking a meeting.
- **Timezone & Buffer Management:** Prevent collisions with an engine that calculates personalized Buffer Times and auto-adjusts local Timezones natively.
- **Premium UI/UX:** Fully responsive Dashboard featuring interactive Light/Dark mode toggling, sliding Settings modalities, and stateful 'AI is thinking' dynamic loading mechanisms.
- **Clean Architecture:** Strict separation between React frontend, Node/Express backend API, and Python FastAPI AI service.

## 💻 Tech Stack
- **Frontend:** Vite, React, Tailwind CSS, FullCalendar, Lucide Icons, Jitsi Video SDK
- **Backend:** Node.js, Express, MongoDB (Mongoose), JWT Auth, Nodemailer, Googleapis
- **AI Service:** Python, FastAPI, Google Gemini, spaCy, dateparser

## ⚙️ Setup Instructions

### Prerequisites
- Docker and Docker Compose installed (for full stack)
- Node.js (v18+) for local dev without Docker

### Docker Compose Quickstart
1. Navigate to the root directory `c:\ChronosAI`.
2. Run the deployment sequence:
   ```bash
   cd deployment
   docker-compose up --build -d
   ```
3. Access your local applications:
   - Frontend: `http://localhost:5173`
   - Backend API: `http://localhost:5000`
   - AI Service API Docs: `http://localhost:8000/docs`

### Local Setup (Without Docker)
1. Ensure a MongoDB instance is running locally on port 27017.
2. **Setup the AI Service:**
   ```bash
   cd ai_service
   pip install -r requirements.txt
   python main.py
   ```
3. **Setup the Backend:**
   ```bash
   cd backend
   npm install
   npm run dev
   ```
4. **Setup the Frontend:**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

## 🔐 Environment Variables (.env)
To fully enable cloud integration, provide the following variables in the `backend/.env` file:
- `MONGODB_URI`
- `JWT_SECRET`
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`
- `AI_SERVICE_URL`

## 📡 API Documentation

### Auth
- `POST /api/auth/register` - `{ name, email, password }`
- `POST /api/auth/login` - `{ email, password }`
- `GET /api/auth/google/url` - Generates Google OAuth Link

### Users / Settings
- `GET /api/users/settings` - Retrieves timezone & buffer boundaries
- `PUT /api/users/settings` - `{ bufferTime, timezone }`

### Meetings
*(Requires Bearer JWT in Authorization header)*
- `POST /api/meetings/schedule` - `{ title, date, startTime, duration, participants }`
- `GET /api/meetings/all` - Returns schedule of current user
- `GET /api/meetings/date/:date` - Returns schedule for specific `YYYY-MM-DD`
- `PUT /api/meetings/reschedule/:id`
- `DELETE /api/meetings/cancel/:id`

### Dialogue
- `POST /api/dialogue/process` - `{ message, sessionId }`
  Coordinates with AI to deeply parse entities, calculate overlaps, dispatch cloud emails/calendar pushes, and generate user-facing responses.

### AI Service (Internal)
- `POST /parse` - `{ message }` -> Returns structured JSON entities natively mapping to application schemas.

## 📦 Deployment Steps
1. The AI Service and Backend should be deployed using Docker containers (e.g., Render, Railway, DigitalOcean App Platform).
2. The Frontend can be deployed trivially to Vercel/Netlify. Supply `VITE_API_URL` linking to backend.
3. Configure your production MongoDB Atlas cluster correctly with whitelisted IPs.
