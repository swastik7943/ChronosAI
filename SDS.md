# Software Design Specification (SDS) for ChronosAI

## 1. Introduction

### 1.1 Purpose
This Software Design Specification (SDS) provides a comprehensive technical blueprint of the **ChronosAI** meeting scheduler and workspace platform. It describes the system architecture, database schemas, component structures, API specifications, and internal logic flows necessary to build, maintain, and scale the application.

### 1.2 Scope
This document covers the architectural design of the full-stack system, including the React frontend with sidebar-driven navigation, Node.js backend with workspace/contact/API key subsystems, MongoDB entity relationships, Python AI service bindings, integration patterns for Google Calendar, and the comprehensive Automated Testing Infrastructure (Jest/Vitest).

---

## 2. System Architecture

### 2.1 High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        CLIENT (Browser)                          │
│  ┌──────────┐  ┌─────────────────────────────────────────────┐   │
│  │ Sidebar  │  │              Header (Fixed)                 │   │
│  │          │  │  [Search] [Notifications] [Theme] [Logout]  │   │
│  │  Home    │  ├─────────────────────────────────────────────┤   │
│  │  Meetings│  │                                             │   │
│  │  Contacts│  │           Main Content Area                 │   │
│  │  Chat    │  │     (Renders active sidebar view)           │   │
│  │  Dashboard│ │                                             │   │
│  │  Profile │  │                                             │   │
│  └──────────┘  └─────────────────────────────────────────────┘   │
└─────────────────────────────┬────────────────────────────────────┘
                              │ HTTP (REST)
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    BACKEND (Node.js / Express)               │
│                                                             │
│  ┌────────────┐  ┌──────────┐  ┌───────────┐  ┌───────────┐ │
│  │ Auth (Cookie)│  │ Meetings │  │ Teams     │  │ Contacts  │ │
│  │ Controller │  │ Controller│  │Controller │  │ Controller│ │
│  ├────────────┤  ├──────────┤  ├───────────┤  ├───────────┤ │
│  │ Dialogue   │  │ API Keys │  │ User      │  │ Security  │ │
│  │ Controller │  │ Controller│  │Settings   │  │ Middleware│ │
│  └─────┬──────┘  └──────────┘  └───────────┘  └───────────┘ │
│        │                                                    │
│  ┌─────▼─────┐  ┌──────────────┐  ┌───────────────────┐     │
│  │ AI Service │  │ Google Sync  │  │ Reminder Cron     │     │
│  │ HTTP Call  │  │ (Encrypted)  │  │ (node-cron)       │     │
│  └─────┬──────┘  └──────┬───────┘  └────────┬──────────┘     │
│        │                │                    │                │
│  ┌─────▼────────────────▼────────────────────▼─────────┐     │
│  │                  MongoDB (Mongoose)                   │     │
│  │  User │ Meeting │ Team │ Contact │ ApiKey │ Session   │     │
│  └───────────────────────────────────────────────────────┘     │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTP (Internal)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│               AI SERVICE (Python / FastAPI)                  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  parser.py                                           │   │
│  │  ┌─────────────┐     ┌────────────────────────┐     │   │
│  │  │ Gemini LLM  │────▶│ Structured JSON Output │     │   │
│  │  └──────┬──────┘     └────────────────────────┘     │   │
│  │         │ (fallback)                                 │   │
│  │  ┌──────▼──────┐                                    │   │
│  │  │ dateparser +│                                    │   │
│  │  │ (heuristic) │                                    │   │
│  │  └─────────────┘                                    │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Service Architecture

| Service | Port | Technology | Responsibility |
|---------|------|-----------|----------------|
| Frontend | 5173 | Vite + React | UI rendering, automated cookie-auth state |
| Backend | 5000 | Node.js + Express | Hardened REST API (Helmet, Sanitization, Cookies) |
| AI Service | 8000 | Python + FastAPI | NLP parsing, intent detection |
| Database | 27017 | MongoDB | Encrypted persistent storage |

### 2.3 System Flow — Meeting Scheduling Sequence

```
User Input: "Schedule a meeting with Alex and Bob tomorrow at 3 PM"
    │
    ▼
1. ChatWidget.jsx → POST /api/dialogue/process
    │
    ▼
2. dialogue.controller.js
    ├── Retrieve/create ConversationSession from MongoDB
    ├── Forward raw text to AI Service → POST /parse (FastAPI)
    │     └── parser.py extracts: {intent: "schedule", date: "2026-04-07",
    │         time: "15:00", participants: ["Alex", "Bob"]}
    ├── Map entities into session state
    ├── Disambiguate participants via Contact search
    └── If missing fields (duration → ask user)
    │
    ▼ (once all fields collected)
3. Availability Engine (availability.service.js)
    ├── Load settings for Organizer AND all registered participants
    │    (timezone, workingHours, breakTime, bufferTime)
    ├── Normalize all constraints to UTC absolute time
    ├── Calculate "Common Free Intersection":
    │    Free = Intersection(All Members' Available Windows) - Union(All Members' Busy Blocks)
    ├── Factor in post-meeting buffer zones for every existing meeting
    ├── If requested slot is Busy:
    │    └── Suggest top 3 alternative slots within common working hours
    │
    ▼ (no conflict or user chooses suggested slot)
4. Meeting.create() → Save to MongoDB
    ├── Generate Jitsi room link (VITE_JITSI_DOMAIN)
    ├── Non-blocking Integrations:
    │    ├── SMTP: Send invitations to all participants
    │    └── Google Sync: One-way push to organizer's Google Calendar
    └── Return confirmation with local + UTC times
```

---

## 3. Data Design

### 3.1 Entity Relationship Diagram

```
┌──────────┐     1:N     ┌───────────┐
│   User   │────────────▶│  Meeting   │
│          │             │            │
│          │──┐  1:N     └────────────┘
│          │  │
│          │  │  1:N     ┌───────────┐
│          │──┼─────────▶│  Contact   │
│          │  │          │            │
│          │  │          └────┬───────┘
│          │  │               │ ref: contactUser → User
│          │  │
│          │  │  N:M     ┌───────────┐
│          │──┼─────────▶│   Team    │
│          │  │          │ (members) │
│          │  │          └───────────┘
│          │  │
│          │  │  1:N     ┌───────────┐
│          │──┼─────────▶│  ApiKey   │
│          │  │          └───────────┘
│          │  │
│          │  │  1:N     ┌────────────────────┐
│          │──┘─────────▶│ConversationSession │
└──────────┘             └────────────────────┘
```

### 3.2 Schema Definitions

#### User
| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `name` | String | required | Display name |
| `email` | String | unique, required | Login identifier |
| `password` | String | — | bcrypt hashed |
| `timezone` | String | default: "UTC" | IANA or abbreviation (IST, PST, etc.) |
| `bufferTime` | Number | default: 0 | Post-meeting buffer in minutes |
| `workingHoursStart` | String | default: "09:00" | Day start (HH:MM) |
| `workingHoursEnd` | String | default: "18:00" | Day end (HH:MM) |
| `breakStart` | String | default: "13:00" | Break period start |
| `breakEnd` | String | default: "14:00" | Break period end |
| `googleId` | String | — | Google OAuth subject ID |
| `googleAccessToken` | String | AES-256-GCM | Encrypted OAuth access token |
| `googleRefreshToken` | String | AES-256-GCM | Encrypted OAuth refresh token |
| `avatar` | String | — | Base64 encoded avatar image |

#### Meeting
| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `title` | String | required | Meeting title |
| `date` | String | required | YYYY-MM-DD format |
| `startTime` | String | required | HH:MM format (24hr) |
| `duration` | Number | required | Minutes |
| `participants` | [String] | — | Email addresses or names |
| `organizer` | ObjectId | ref: User | Meeting creator |
| `status` | String | enum: scheduled/canceled | Default: scheduled |
| `jitsiRoom` | String | — | Auto-generated video room ID |

#### Team
| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `name` | String | required | Workspace name |
| `description` | String | — | Optional description |
| `owner` | ObjectId | ref: User | Workspace creator |
| `inviteCode` | String | unique | 8-character auto-generated code |
| `members` | [{user, role}] | — | Array of {user: ObjectId, role: admin/member} |

#### Contact
| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `owner` | ObjectId | ref: User | Contact list owner |
| `contactUser` | ObjectId | ref: User | The referenced user |
| `nickname` | String | — | Optional display name |
| `notes` | String | — | Optional notes |
| **Index** | | unique: {owner, contactUser} | Prevent duplicate contacts |

#### ApiKey
| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `user` | ObjectId | ref: User | Key owner |
| `name` | String | required | Descriptive key name |
| `key` | String | unique | Full hashed key (`cai_` prefix). Excluded from JSON via `.select('-key')` |
| `isActive` | Boolean | default: true | Revocation flag |
| `lastUsedAt` | Date | — | Usage tracking |

#### ConversationSession
| Field | Type | Description |
|-------|------|-------------|
| `userId` | ObjectId | ref: User |
| `intent` | String | schedule / reschedule / cancel |
| `participants` | [String] | Raw extracted names |
| `resolvedParticipants` | [String] | Disambiguated emails |
| `date` / `time` / `duration` | String/Number | Collected scheduling params |
| `timezone` | String | User's timezone at session start |
| `pendingResolutionName` | String | Ambiguous name awaiting user clarification |
| `ambiguousCandidates` | [Mixed] | Multiple matching contacts |
| `status` | String | active / completed / canceled |

---

## 4. API Interface Specifications

### 4.1 Backend REST API (Port 5000)

All protected endpoints accept either:
- `Authorization: Bearer <JWT>` header, OR
- `x-api-key: <api_key>` header

#### Rate Limiting Tiers

| Tier | Routes | Limit | Window |
|------|--------|-------|--------|
| Auth | `/api/auth/*` | 20 requests | 15 minutes |
| General | `/api/meetings/*`, `/api/teams/*`, `/api/contacts/*`, `/api/apikeys/*`, `/api/users/*` | 100 requests | 15 minutes |
| Dialogue | `/api/dialogue/*` | 30 requests | 1 minute |

#### Auth Module
| Endpoint | Method | Payload | Response |
|----------|--------|---------|----------|
| `/api/auth/register` | POST | `{name, email, password}` | `Set-Cookie: token`, `{user}` |
| `/api/auth/login` | POST | `{email, password}` | `Set-Cookie: token`, `{user}` |
| `/api/auth/me` | GET | — | Current `{user}` object |
| `/api/auth/logout` | POST | — | `Clear-Cookie: token` |
| `/api/auth/google/url` | GET | — | `{url}` |
| `/api/auth/google/callback` | GET | OAuth code param | `Set-Cookie: token`, Redirect |

#### Meetings Module
| Endpoint | Method | Payload | Response |
|----------|--------|---------|----------|
| `/api/meetings/schedule` | POST | `{title, date, startTime, duration, participants}` | Meeting object |
| `/api/meetings/all` | GET | — | [Meeting] |
| `/api/meetings/date/:date` | GET | — | [Meeting] for date |
| `/api/meetings/reschedule/:id` | PUT | `{date?, startTime?}` | Updated meeting |
| `/api/meetings/cancel/:id` | DELETE | — | Confirmation |

#### Teams Module
| Endpoint | Method | Payload | Response |
|----------|--------|---------|----------|
| `/api/teams` | POST | `{name, description}` | Team with inviteCode |
| `/api/teams` | GET | — | [Team] for user |
| `/api/teams/join` | POST | `{inviteCode}` | Team object |
| `/api/teams/:id` | GET | — | Team with populated members |
| `/api/teams/:id` | PUT | `{name?, description?}` | Updated team |
| `/api/teams/:id` | DELETE | — | Confirmation |
| `/api/teams/:id/members` | POST | `{email}` | Updated team |
| `/api/teams/:id/members/:userId` | DELETE | — | Updated team |
| `/api/teams/:id/calendar` | GET | `?date=YYYY-MM-DD` | [Meeting] aggregated |

#### Contacts Module
| Endpoint | Method | Payload | Response |
|----------|--------|---------|----------|
| `/api/contacts` | POST | `{email, nickname?, notes?}` | Contact object |
| `/api/contacts` | GET | — | [Contact] populated |
| `/api/contacts/search` | GET | `?q=query` | [Contact] filtered |
| `/api/contacts/users` | GET | `?q=query` | [User] matches |
| `/api/contacts/:id` | PUT | `{nickname?, notes?}` | Updated contact |
| `/api/contacts/:id` | DELETE | — | Confirmation |

#### API Keys Module
| Endpoint | Method | Payload | Response |
|----------|--------|---------|----------|
| `/api/apikeys` | POST | `{name}` | `{key, maskedKey, name, _id}` |
| `/api/apikeys` | GET | — | [ApiKey] (masked) |
| `/api/apikeys/:id/revoke` | PUT | — | Confirmation |
| `/api/apikeys/:id` | DELETE | — | Confirmation |

#### Settings Module
| Endpoint | Method | Payload | Response |
|----------|--------|---------|----------|
| `/api/users/settings` | GET | — | User profile object |
| `/api/users/settings` | PUT | `{timezone?, bufferTime?, workingHoursStart?, ...}` | Updated user |

#### Dialogue Module
| Endpoint | Method | Payload | Response |
|----------|--------|---------|----------|
| `/api/dialogue/process` | POST | `{message, sessionId?}` | `{reply, sessionId, meeting?, suggestedActions?}` |

### 4.2 AI Service API (Port 8000)
| Endpoint | Method | Payload | Response |
|----------|--------|---------|----------|
| `/parse` | POST | `{message}` | `{intent, date, time, timezone, duration, participants}` |
| `/health` | GET | — | `{status: "ok"}` |

---

## 5. Component & Module Design (Frontend)

### 5.1 Application Layout Hierarchy

```
App.jsx
├── <BrowserRouter>
│   ├── /meet/:roomId → MeetingRoom.jsx
│   └── /* →
│       ├── (no token) → Login.jsx
│       └── (authenticated) →
│           ├── Header.jsx (fixed, always visible)
│           ├── Sidebar.jsx (collapsible)
│           └── Main Content (view-based routing):
│               ├── "home"       → HomePage.jsx
│               ├── "meetings"   → MeetingsPage.jsx
│               ├── "contacts"   → ContactsPage.jsx
│               ├── "chat"       → ChatPage.jsx
│               ├── "dashboard"  → DashboardPage.jsx
│               └── "profile"    → ProfilePage.jsx
```

### 5.2 Layout Components

#### Sidebar (`components/Layout/Sidebar.jsx`)
- 6 navigation items with icons from Lucide
- Active state indicator (highlight + dot)
- Collapse/expand with chevron toggle
- Collapsed mode shows only icons with tooltips
- Width transitions: 220px ↔ 68px

#### Header (`components/Layout/Header.jsx`)
- **Search Bar:** Debounced (300ms) live search across contacts, meetings, and workspaces via 3 parallel API calls. Results grouped in a dropdown by type.
- **Notification Bell:** Polls `/api/meetings/all` every 60 seconds. Categorizes meetings as: upcoming (< 60 min away), scheduled, ended, or canceled. Shows badge count for upcoming.
- **Controls:** Theme toggle (Sun/Moon), Settings gear, Logout button.

### 5.3 Page Components

| Page | Key Features |
|------|-------------|
| **HomePage** | Three-panel layout: Agenda panel (top-left), ChatWidget (bottom-left), CalendarWidget (right). Reuses existing ChatWidget and CalendarWidget. |
| **MeetingsPage** | Scrollable list with 5 filter tabs. Meeting cards show date badge, title, status badge, time, participant count, and Join button. |
| **ContactsPage** | Tab switcher (Contacts/Workspaces). Add Contact modal with user search. Create Workspace modal with contact selection. Inline member management, invite code copy, delete. |
| **ChatPage** | Full-width centered ChatWidget (max-width 768px). |
| **DashboardPage** | 4 KPI stat cards + 4 Recharts: AreaChart (meetings/week), BarChart (busiest days), PieChart (duration distribution), BarChart horizontal (top participants). |
| **ProfilePage** | Avatar with upload, editable display name, email (read-only), timezone dropdown, working hours selectors, break time selectors, buffer slider (0–60 min range), Google Calendar connect, Save button with success animation. |

### 5.4 Shared Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `ChatWidget` | `components/Chat/` | AI chat interface with message bubbles, suggested actions, typing indicator |
| `CalendarWidget` | `components/Calendar/` | FullCalendar monthly view with event click and date click handlers |
| `SettingsModal` | `components/Modals/` | Quick settings popup from header gear icon |
| `MeetingDetailsModal` | `components/Modals/` | Meeting detail view with cancel and join video buttons |

---

## 6. Middleware & Utilities Design

### 6.1 Authentication Middleware (`auth.middleware.js`)
- **Priority order:** Check `x-api-key` header first, then `Bearer` JWT token.
- API key auth: Lookup active key in database, update `lastUsedAt`, attach user to request.
- JWT auth: Verify token, decode user ID, attach user to request.
- Returns 401 if neither authentication method succeeds.

### 6.2 Rate Limiter (`rateLimiter.js`)
- Uses `express-rate-limit` with three exported middleware instances:
  - `authLimiter`: 20 requests / 15 minutes (protects login/register)
  - `generalLimiter`: 100 requests / 15 minutes (general API)
  - `dialogueLimiter`: 30 requests / 1 minute (chat protection)
- Standard rate limit headers (`RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`) included in responses.

### 6.3 Google Calendar Sync (`googleSync.js`)
- **Model:** One-way push synchronization (ChronosAI → Google).
- **Authentication:** Scoped OAuth2 client with stored tokens.
- **Auto-Refresh:** Registers `oauth2Client.on('tokens')` listener to auto-persist refreshed tokens. Proactively checks token expiry; refreshes if within 5 minutes of expiration.
- **Payload Mapping:** Timezone mapping from abbreviations to IANA names (e.g., IST → Asia/Kolkata).
- **Actions:** Supports `insert` (on schedule), `update` (on reschedule), and `delete` (on cancellation).
- **Integrity:** Professional status is prioritized; personal Google events are not imported into ChronosAI to avoid cluttering meeting slot availability.

### 6.4 Availability & Conflict Engine (`availability.service.js`)
- **Normalization:** Converts all user window constraints (9-18, 13-14) from local timezone to UTC offsets.
- **Multi-User Logic:** 
  1. Identifies all registered ChronosAI users in the participant list.
  2. Aggregates all "Busy" blocks (meetings + buffers) from all participants.
  3. Calculates the geometric intersection of All-Participants' working windows.
  4. Subtracts the Union of Busy blocks from the Intersected windows.
- **Buffer Logic:** A "Restricted Zone" is created `bufferTime` minutes *after* every scheduled meeting.
- **Alternative Suggestion:** Uses a sliding window algorithm (step: 30min) to find the first 3 gaps large enough for the requested `duration` within the common window.

### 6.4 Reminder Cron (`reminderCron.js`)
- `node-cron` schedule: `* * * * *` (every minute).
- Scans meetings where `date + startTime` is 14–16 minutes in the future.
- Uses in-memory `Set` to track sent reminders (key: `meetingId`).
- Sends HTML emails to organizer and each participant.
- Cleanup job removes entries older than 30 minutes from the Set.

### 6.5 Email Service (`sendEmail.js`)
- Nodemailer transporter configured from environment variables.
- Sends HTML-formatted meeting invitations with Jitsi video links.
- Non-blocking execution (failures are logged, not thrown).

---

## 7. Security Architecture

### 7.1 Authentication Flow

```
User Login → POST /api/auth/login
  │ (bcrypt password verify)
  ▼
JWT Token issued (Set-Cookie: token)
  │ (HttpOnly, Secure, SameSite=Strict)
  ▼
Client authenticated via matching cookie
  │
  ▼
All API requests automatically include cookie
  │
  ▼
auth.middleware.js validates req.cookies.token → attaches req.user
```

### 7.2 Data Encryption at Rest (AES-256-GCM)

All sensitive third-party integrations (Google OAuth) are encrypted before database persistence:
1. **Utility:** `utils/encryption.js` using Node.js `crypto`.
2. **Method:** `aes-256-gcm` with 12-byte random Initialization Vectors (IV).
3. **Storage Format:** `iv:encryptedContent:authTag` saved in MongoDB.
4. **Resilience:** Decryptor handles legacy plain-text tokens gracefully.
```

### 7.3 OAuth2 Token Refresh

```
Before Google Calendar API call:
  │
  ▼
Check credentials.expiry_date
  │
  ├── > 5 min remaining → Use existing token
  │
  └── < 5 min or expired →
      └── Continue with refreshed credentials
```

---

## 8. Testing Architecture

ChronosAI implements a comprehensive testing pyramid consisting of 140 automated tests.

### 8.1 Backend Integration Testing (Jest)
- **Framework:** `Jest 30` with ESM support (`--experimental-vm-modules`).
- **Isolation:** `mongodb-memory-server` spins up a separate Mongo instance for every single test file.
- **Environment Guard:** `server.js` detects `NODE_ENV === 'test'` to skip connecting to the production/dev DB.
- **Rate Limit Bypass:** All rate limiters implement a `skip: (req) => process.env.NODE_ENV === 'test'` clause to prevent flaky tests during rapid execution cycles.
- **Global Setup:** `jest.globalSetup.js` initializes consistent encryption keys and JWT secrets before any module is loaded.
- **Coverage:** Targets 70%+ coverage of controllers and the core availability engine.

### 8.2 Frontend Component Testing (Vitest)
- **Framework:** `Vitest` with `Happy DOM` / `JSDOM` environment for rapid React test execution.
- **Assertions:** `React Testing Library` for user-centric DOM querying (finding by Label, Role, and Text).
- **Mocking Strategy:** `vi.mock('axios')` is used in each suite to simulate REST API responses without a live backend.
- **DOM Mocks:** `tests/setup.js` globally mocks `scrollIntoView` and `scrollTo` as they are not supported by JSDOM but used for Chat interaction.

### 8.3 Security & Hardening Verification
Tests explicitly verify security boundaries:
- Failure to access routes without HttpOnly cookie.
- AES-256-GCM decryption failure on tampered IVs.
- Masked API key enforcement (ensuring raw keys never leave the DB except on creation).
- Rate limit bypass verification under test conditions.

