# ChronosAI — Intelligent Meeting Scheduler & Workspace Platform

ChronosAI is a full-stack, AI-powered meeting management platform that transforms natural language into scheduled events. It features multi-user workspaces, smart conflict detection, conversational AI scheduling, analytics dashboards, and seamless Google Calendar & email integrations.

## Key Features

### AI-Powered Scheduling
- **Conversational AI Chat** — Natural language scheduling: _"Schedule a meeting with Alex and Bob tomorrow at 3 PM"_
- **Multi-Turn Dialogue** — The AI asks follow-up questions for missing details (participants, time, duration)
- **Smart Conflict Detection** — Detects double-bookings and suggests alternative time slots
- **Auto Meeting Titles** — Generates contextual titles when user doesn't specify one
- **Intent Intelligence** — Detects `schedule`, `reschedule`, `cancel`, `query`, `availability` intents

### Multi-User Availability Engine
- **Timezone-Aware Intersection** — Calculates common free slots across all registered participants in UTC, honoring each user's timezone, working hours, and break times
- **Privacy-First Design** — Only "Busy/Free" status is shared with organizers. Meeting titles/details are never exposed cross-user
- **Least-Conflict Fallback** — When no common slot exists, ranks candidates by fewest conflicts and surfaces top 5 options
- **External Participant Handling** — Non-registered participants are included in email invites but skipped for availability calculations

### Workspace & Collaboration
- **Multi-User Workspaces** — Create teams/organizations, add members, shared calendars
- **Contact Book** — Manage contacts with search, add registered users by email
- **Join by Invite Code** — Share workspace invite codes for team onboarding
- **Meeting Reminders** — Automated email reminders 15 minutes before meetings (via `node-cron`)

### Production Security & Resilience
- **AES-256-GCM Token Encryption** — Google tokens are encrypted "at rest" in MongoDB with unique initialization vectors.
- **HttpOnly AUTH Session** — Authentication shifted from localStorage to secure, HttpOnly, SameSite=Strict cookies to prevent XSS attacks.
- **Helmet Protected Headers** — Express server hardened with secure HTTP headers.
- **NoSQL Injection Defense** — Automatic sanitization of all incoming API payloads.
- **Fail-Fast Configuration** — Application prevents startup in production if critical security keys are missing.
- **Google OAuth2 Lifecycle** — Automatic token refresh and secure disconnect/revocation management.
- **3-Tier Rate Limiting** — Auth (20/15min), General (100/15min), Dialogue (30/min). Bypassed in `NODE_ENV=test`.

### Smart Scheduling Engine
- **Working Hours Enforcement** — No meetings outside configured hours (e.g., 9 AM–6 PM)
- **Break Time Protection** — Configurable break windows (e.g., 1 PM–2 PM)
- **Post-Meeting Buffer** — Customizable buffer applied after each meeting
- **Timezone-Aware** — All scheduling normalized to UTC; displayed in user's local timezone

### Modern Frontend
- **6-View Sidebar Layout** — Home, Meetings, Contacts/Workspaces, Chat, Dashboard, Profile
- **Analytics Dashboard** — Charts for meetings/week, busiest days, avg duration, top participants (Recharts)
- **Global Search** — Search contacts, meetings, and workspaces from the header
- **Notification Bell** — Real-time meeting notification feed (scheduled, upcoming, ended, canceled)
- **Light/Dark Mode** — Persistent theme toggle
- **Video Conferencing** — Jitsi Meet integration with auto-generated room links (configurable domain via `VITE_JITSI_DOMAIN`)
- **Google Calendar Sync** — One-way push (ChronosAI → Google) to keep your Google Calendar current without importing personal events


## Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Frontend** | React 18, Vite, Tailwind CSS, FullCalendar, Recharts, Vitest (Testing) |
| **Backend** | Node.js, Express, MongoDB, Jest (Testing), Helmet, mongo-sanitize, cookie-parser |
| **AI Service** | Python, FastAPI, Google Gemini (via `google-genai`), dateparser |
| **Integrations** | Google Calendar API (OAuth2), AES-256-GCM Encryption, Jitsi Meet |

## Project Structure

```
ChronosAI/
├── frontend/                    # React SPA (Vite)
│   └── src/
│       ├── components/
│       │   ├── Layout/          # Sidebar.jsx, Header.jsx
│       │   ├── Calendar/        # CalendarWidget.jsx
│       │   ├── Chat/            # ChatWidget.jsx
│       │   └── Modals/          # SettingsModal, MeetingDetailsModal
│       ├── pages/               # HomePage, MeetingsPage, ContactsPage,
│       │                        # ChatPage, DashboardPage, ProfilePage
│       └── App.jsx              # Root layout with sidebar + header
├── backend/                     # Node.js API Server
│   └── src/
│       ├── controllers/         # auth, meeting, dialogue, team, contact, apikey
│       ├── models/              # User, Meeting, Team, Contact, ApiKey, ConversationSession
│       ├── routes/              # auth, meeting, dialogue, team, contact, apikey, user
│       ├── middleware/           # auth, rateLimiter, apiKeyAuth
│       ├── utils/               # googleSync, reminderCron, sendEmail
│       └── server.js            # Entry point
├── ai_service/                  # Python FastAPI NLP Service
│   ├── agent/parser.py          # Gemini + dateparser (spaCy optional fallback)
│   └── main.py                  # FastAPI entry point
├── deployment/                  # Docker Compose configs
├── .env.example                 # Environment variable template
├── SRS.md                       # Software Requirements Specification
└── SDS.md                       # Software Design Specification
```

## Setup Instructions

### Prerequisites
- Node.js v18+ and npm
- Python 3.10+ and pip
- MongoDB (local or Atlas)
- Docker & Docker Compose (optional, for containerized setup)

### Local Development

**1. Clone and configure environment:**
```bash
git clone https://github.com/your-org/ChronosAI.git
cd ChronosAI
cp .env.example backend/.env
# Edit backend/.env with your actual credentials
```

**2. Start AI Service:**
```bash
cd ai_service
pip install -r requirements.txt
# Set GEMINI_API_KEY in the repository root `.env` (parser loads root .env),
# or export it in your shell environment before starting the service.
python main.py
# Runs on http://localhost:8000
```

**3. Start Backend:**
```bash
cd backend
npm install
npm run dev
# Runs on http://localhost:5000
```

**4. Start Frontend:**
```bash
cd frontend
npm install
npm run dev
# Runs on http://localhost:5173
```

### Docker Compose
```bash
cd deployment
# This will start Backend, Frontend, AI Service, and MongoDB
docker-compose up --build -d
```

## Environment Variables

Create `backend/.env` from `.env.example`:

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGODB_URI` | Yes | MongoDB connection string |
| `JWT_SECRET` | Yes | Secret key for JWT signing |
| `ENCRYPTION_KEY` | Yes | Exactly 32 characters; used for AES-256-GCM encryption of third-party tokens |
| `GEMINI_API_KEY` | Yes | Google AI Studio Gemini key (used by the AI microservice) |
| `GOOGLE_CLIENT_ID` | No | Google OAuth2 client ID for Calendar sync |
| `GOOGLE_CLIENT_SECRET` | No | Google OAuth2 client secret |
| `BACKEND_URL` | No | Backend URL (default: `http://localhost:5000`) |
| `FRONTEND_URL` | No | Frontend URL (default: `http://localhost:5173`) |
| `SMTP_HOST` | No | SMTP server for email notifications |
| `SMTP_PORT` | No | SMTP port (default: 587) |
| `SMTP_USER` | No | SMTP username/email |
| `SMTP_PASS` | No | SMTP password or app password |
| `AI_SERVICE_URL` | No | AI service URL (default: `http://localhost:8000`) |
| `PORT` | No | Backend port (default: `5000`) |
| `NODE_ENV` | No | Node environment (`development` or `production`). `production` enables stricter fail-fast checks. |

## API Reference

All protected endpoints require `Authorization: Bearer <JWT>` or `x-api-key: <key>` header.

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register; sets HttpOnly cookie |
| POST | `/api/auth/login` | Login; sets HttpOnly cookie |
| GET | `/api/auth/me` | Fetch currently logged-in user |
| POST | `/api/auth/logout` | Clear auth cookie and logout |
| GET | `/api/auth/google/url` | Get Google OAuth consent URL |
| GET | `/api/auth/google/callback` | OAuth callback handler; sets cookie |
| POST | `/api/users/google-disconnect` | Revoke Google access and clear tokens |

### Meetings
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/meetings/schedule` | Create meeting |
| GET | `/api/meetings/all` | Get all user meetings |
| GET | `/api/meetings/date/:date` | Get meetings for date (YYYY-MM-DD) |
| PUT | `/api/meetings/reschedule/:id` | Reschedule meeting |
| DELETE | `/api/meetings/cancel/:id` | Cancel meeting |

### AI Dialogue
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/dialogue/process` | Send `{ message, sessionId }`, get AI response |

### Teams / Workspaces
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/teams` | Create workspace |
| GET | `/api/teams` | List user's workspaces |
| POST | `/api/teams/join` | Join via `{ inviteCode }` |
| GET | `/api/teams/:id` | Get workspace details |
| PUT | `/api/teams/:id` | Update workspace |
| DELETE | `/api/teams/:id` | Delete workspace |
| POST | `/api/teams/:id/members` | Add member by `{ email }` |
| DELETE | `/api/teams/:id/members/:userId` | Remove member |
| GET | `/api/teams/:id/calendar` | Shared team calendar |

### Contacts
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/contacts` | Add contact by `{ email }` |
| GET | `/api/contacts` | List all contacts |
| GET | `/api/contacts/search?q=` | Search contacts |
| GET | `/api/contacts/users?q=` | Search registered users |
| PUT | `/api/contacts/:id` | Update contact |
| DELETE | `/api/contacts/:id` | Remove contact |

### API Keys
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/apikeys` | Create key with `{ name }` — full key shown once |
| GET | `/api/apikeys` | List keys (masked) |
| PUT | `/api/apikeys/:id/revoke` | Revoke a key |
| DELETE | `/api/apikeys/:id` | Delete a key |

### User Settings
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users/settings` | Get user profile & preferences |
| PUT | `/api/users/settings` | Update settings (timezone, working hours, buffer, etc.) |

### AI Service (Internal)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/parse` | Parse natural language → structured JSON |

## Testing

ChronosAI has a comprehensive automated test suite: **96 backend tests** across 8 test suites, and **44 frontend tests** across 4 test files — **140 tests total**.

### Backend Tests (Jest + MongoMemoryServer)

Run on Windows using:
```cmd
cd backend
set NODE_OPTIONS=--experimental-vm-modules
node_modules\.bin\jest.cmd --runInBand --forceExit
```

#### Test Suites
| File | Tests | Coverage |
|------|-------|----------|
| `availability.unit.test.js` | 24 | Pure logic: timezone resolution, slot generation, conflict detection |
| `auth.controller.test.js` | 9 | Register, login, logout, cookie lifecycle |
| `meeting.controller.test.js` | 16 | Full meeting CRUD + cross-user isolation |
| `user.controller.test.js` | 12 | Settings GET/PUT + Google disconnect |
| `team.controller.test.js` | 9 | Workspace create, join, member management |
| `contact.controller.test.js` | 13 | Add, list, search, delete contacts |
| `apikey.controller.test.js` | 8 | Key creation, masking, revocation, auth |
| `dialogue.controller.test.js` | 5 | Auth guard for AI dialogue endpoint |

#### Test Architecture
- **Database Isolation:** Each test file creates its own `MongoMemoryServer` instance and manages lifecycle in `beforeAll`/`afterAll`. The `server.js` skips `connectDB()` when `NODE_ENV=test`.
- **Rate Limiter Bypass:** All three rate limiters (auth, general, dialogue) are bypassed in `NODE_ENV=test` via a `skip: isTest` function.
- **Global Setup** (`tests/jest.globalSetup.js`): Sets test env vars before any module imports.

### Frontend Tests (Vitest + React Testing Library)

```cmd
cd frontend
node_modules\.bin\vitest.cmd run
```

| File | Tests | Coverage |
|------|-------|----------|
| `Login.test.jsx` | 11 | Sign in / register form toggle, input handling, API call |
| `ProfilePage.test.jsx` | 11 | Loading state, settings form, Google connect/disconnect |
| `MeetingsPage.test.jsx` | 8 | Empty state, meeting list, filters, participant count, Join button |
| `ChatWidget.test.jsx` | 14 | Initial render, quick actions, send/receive messages, error state |

#### Test Setup (`tests/setup.js`)
- `window.HTMLElement.prototype.scrollIntoView = vi.fn()` — mocks the JSDOM-unsupported `scrollIntoView` API.
- All axios calls are mocked via `vi.mock('axios')` per test file.

### Coverage
```cmd
cd backend
set NODE_OPTIONS=--experimental-vm-modules
node_modules\.bin\jest.cmd --coverage --runInBand --forceExit
```

## Deployment

1. **Backend & AI Service** — Deploy via Docker (Render, Railway, DigitalOcean App Platform)
2. **Frontend** — Deploy to Vercel/Netlify with `VITE_API_URL` pointing to backend
3. **Database** — Use MongoDB Atlas with IP whitelisting
4. **Cron Job** — The `node-cron` reminder job starts automatically with the backend server. For horizontally scaled deployments, ensure only one instance runs the cron.

## License

This project is for educational and demonstration purposes.

