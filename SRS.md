# Software Requirements Specification (SRS) for ChronosAI

## 1. Introduction

### 1.1 Purpose
This document outlines the software requirements for **ChronosAI**, an AI-powered meeting scheduler and multi-user workspace platform. It provides developers, project managers, and stakeholders with a detailed overview of system capabilities, architecture, constraints, and external interactions.

### 1.2 Scope
ChronosAI is designed to streamline scheduling for professionals and enterprise teams through natural language processing (NLP). The application enables users to schedule, reschedule, and cancel meetings via a conversational AI interface. It supports multi-user workspaces, shared calendars, contact management, automated meeting reminders, third-party API access via API keys, and integrations with Google Calendar and email services. The system enforces working hours, break times, timezone-aware scheduling, and post-meeting buffers to prevent calendar conflicts.

### 1.3 Definitions and Acronyms
| Term | Definition |
|------|-----------|
| AI | Artificial Intelligence |
| NLP | Natural Language Processing |
| SRS | Software Requirements Specification |
| JWT | JSON Web Token — encrypted token for session management |
| AES-256-GCM| Advanced Encryption Standard with Galois/Counter Mode for tokens at rest |
| HttpOnly | Security flag for cookies preventing Javascript access |
| SMTP | Simple Mail Transfer Protocol — used for email delivery |
| OAuth2 | Open Authorization 2.0 — used for Google Calendar API access |
| IANA | Internet Assigned Numbers Authority — timezone database standard |
| CRUD | Create, Read, Update, Delete |
| SPA | Single Page Application |

---

## 2. Overall Description

### 2.1 Product Perspective
ChronosAI is a full-stack web application consisting of three decoupled services:

1. **Frontend SPA:** A React.js application providing a sidebar-driven dashboard with six distinct views, automated authentication state management via secure cookies, and real-time AI chat interface.
2. **Backend API:** A Node.js/Express.js server handling hardened security (AES-256-GCM, Helmet, HttpOnly cookies), database operations via MongoDB, workspace/contact management, meeting CRUD, automated reminders, and integration orchestration.
3. **AI Microservice:** A Python/FastAPI service for parsing natural language scheduling requests using Google Gemini LLM with a local fallback parser (dateparser + heuristic regex).

### 2.2 Product Functions
- **Conversational AI Scheduling:** Process unstructured messages into structured meeting parameters via multi-turn dialogues.
- **Smart Conflict Resolution:** Detect scheduling conflicts considering working hours, break times, and post-meeting buffers. Suggest alternative available slots.
- **Multi-User Workspaces:** Create teams/organizations, manage members with role-based access (admin/member), invite via codes, and view shared calendars.
- **Contact Book Management:** Add, search, and manage contacts linked to registered users.
- **Automated Reminders:** Cron-based system that sends email reminders to organizers and participants 15 minutes before meeting start.
- **Analytics Dashboard:** Visualize scheduling patterns — meetings per week, busiest days, average meeting duration, and top participants.
- **Third-Party API Access:** Issue, revoke, and manage API keys for external integration.
- **Google Calendar Sync:** One-way push synchronization (ChronosAI → Google) with automatic OAuth2 token refresh.
- **Email Notifications:** HTML-formatted meeting invitations and reminders via SMTP.
- **Video Conferencing:** Auto-generated Jitsi Meet room links attached to every meeting.

### 2.3 User Classes and Characteristics

| User Class | Description |
|-----------|-------------|
| **Standard User** | Professionals managing their personal or team schedule. Interacts via chat, configures working hours/timezone/buffer, manages contacts and workspaces. |
| **Workspace Admin** | User who creates a workspace and manages team membership. Has elevated permissions (add/remove members, delete workspace). |
| **Workspace Member** | User who joins a workspace. Can view the shared team calendar. |
| **API Consumer** | Third-party applications using API keys (`x-api-key`) to access ChronosAI endpoints programmatically. |
| **Meeting Participant** | Person receiving email notifications with meeting details and video links. |

### 2.4 Operating Environment
- **Client:** Modern web browsers (Chrome, Firefox, Safari, Edge) on desktop and mobile.
- **Server:** Node.js v18+ runtime, Python 3.10+ runtime.
- **Database:** MongoDB v5.0+ (Atlas cloud or local instance).
- **Containerization:** Docker and Docker Compose support.

---

## 3. System Features

### 3.1 Conversational AI Dialogue Engine
**Description:** The system processes natural language input, maintains multi-turn conversation state, and fulfills scheduling instructions autonomously.

**Functional Requirements:**
- FR-3.1.1: Detect intents: `schedule`, `reschedule`, `cancel`, `query` (view meetings), `availability` (check free slots).
- FR-3.1.2: Extract entities: date, time, duration, participants, meeting title from unstructured text.
- FR-3.1.3: Handle multi-participant extraction (e.g., "with Alex, Bob, and Carol").
- FR-3.1.4: Auto-generate meeting titles when user doesn't provide one (e.g., "Team Sync Meeting").
- FR-3.1.5: Maintain `ConversationSession` state for iterative data collection across multiple messages.
- FR-3.1.6: Fall back to local dateparser + heuristic regex parsing if the Gemini API key is unavailable.
- FR-3.1.7: Provide suggested action buttons in responses (time slots, durations, etc.).

### 3.2 Scheduling & Collision Engine
**Description:** Prevents double-booking using configurable rules and suggests alternatives.

**Functional Requirements:**
- FR-3.2.1: Users configure personal settings: `timezone`, `workingHoursStart`, `workingHoursEnd`, `breakStart`, `breakEnd`, `bufferTime`.
- FR-3.2.2: Buffer time applies only **after** meetings (post-meeting buffer).
- FR-3.2.3: No meetings can be scheduled outside working hours or during break periods.
- FR-3.2.4: All scheduling logic normalizes times to UTC for conflict detection, then converts back to local timezone for display.
- FR-3.2.5: On conflict detection, the AI suggests up to 3 available alternative time slots within working hours.
- FR-3.2.6: Email notifications display meeting times in both the user's local timezone and UTC.
- FR-3.2.7: **Multi-User Availability Engine:** When participants are specified, the system calculates the intersection of all registered participants' free time in UTC, factoring in each participant's individual timezone, working hours, break times, and existing meetings.
- FR-3.2.8: **Privacy Enforcement:** Only "Busy/Free" status from participant calendars is exposed to the organizer. Meeting titles, descriptions, and other details are never shared between users.
- FR-3.2.9: **External Participant Handling:** Participants not registered in ChronosAI are ignored for availability calculations but included in email invitations.
- FR-3.2.10: **Least-Conflict Fallback:** If no common free slot exists, the AI ranks candidate slots by number of attendee conflicts and suggests the top 5 least-conflicting options with a transparent conflict count.

### 3.3 Multi-User Workspace System
**Description:** Team-based collaboration with shared calendars and member management.

**Functional Requirements:**
- FR-3.3.1: Users can create workspaces with a name, description, and auto-generated 8-character invite code.
- FR-3.3.2: Workspace owners can add members by email (must be registered users), assign roles (`admin`/`member`), and remove members.
- FR-3.3.3: Users can join workspaces via invite codes.
- FR-3.3.4: Workspace shared calendar aggregates all members' meetings for a given date range.
- FR-3.3.5: Only workspace admins/owners can update or delete the workspace.

### 3.4 Contact Book
**Description:** User-maintained directory of known contacts within the platform.

**Functional Requirements:**
- FR-3.4.1: Users can add contacts by email. The target user must be registered in ChronosAI.
- FR-3.4.2: Users cannot add themselves as contacts.
- FR-3.4.3: Contacts support optional nickname and notes fields.
- FR-3.4.4: Contacts are searchable by name and email.
- FR-3.4.5: Users can browse all registered users to discover potential contacts.

### 3.5 Meeting Reminders
**Description:** Automated notification system for upcoming meetings.

**Functional Requirements:**
- FR-3.5.1: A background cron job runs every 60 seconds, scanning for meetings starting within 14–16 minutes.
- FR-3.5.2: HTML-formatted reminder emails are sent to the organizer and all participants.
- FR-3.5.3: Duplicate reminders are prevented via in-memory deduplication.
- FR-3.5.4: Old deduplication records are cleaned up periodically to prevent memory leaks.
- FR-3.5.5: Integration Management (Revoke/Unbind): Users can disconnect Google access directly from the Profile page, securely wiping encrypted tokens from the database.

### 3.6 API Keys & Rate Limiting
**Description:** Third-party API access and endpoint protection.

**Functional Requirements:**
- FR-3.6.1: Users can generate named API keys (prefix: `cai_`). Full key is shown only once at creation.
- FR-3.6.2: Keys are stored as hashed values in the database; listed as masked for security.
- FR-3.6.3: API keys authenticate via `x-api-key` header and function as an alternative to JWT Bearer tokens.
- FR-3.6.4: Keys can be revoked or deleted by the owner. Revoked keys return 401 on use.
- FR-3.6.5: Three rate limiting tiers are enforced: auth (20/15min), general (100/15min), dialogue (30/min). Rate limiting is bypassed in `NODE_ENV=test`.

### 3.7 Google Calendar Sync
**Description:** One-way outbound synchronization to Google Calendar (ChronosAI → Google).

**Functional Requirements:**
- FR-3.7.1: OAuth2 consent flow to authorize calendar access.
- FR-3.7.2: Meetings are pushed to Google Calendar with timezone-aware start/end times on creation.
- FR-3.7.3: Meetings are updated in Google Calendar on reschedule, and deleted on cancellation.
- FR-3.7.4: Access tokens are automatically refreshed using stored refresh tokens before each API call.
- FR-3.7.5: Refreshed tokens are persisted to the database.
- FR-3.7.6: Calendar events include 15-minute popup and email reminders.
- FR-3.7.7: **Professional Isolation:** Sync is one-way only. ChronosAI does not import Google events, ensuring professional scheduling integrity — only meetings managed within the workspace affect slot availability.

### 3.8 Frontend Interface
**Description:** Modern, responsive dashboard with sidebar navigation and analytics.

**Functional Requirements:**
- FR-3.8.1: Collapsible sidebar with 6 views: Home, Meetings, Contacts/Workspaces, Chat, Dashboard, Profile.
- FR-3.8.2: Fixed header with global search (contacts, meetings, workspaces), notification bell, theme toggle, settings, and logout.
- FR-3.8.3: Meetings page with timeline filters: Ended, Today, This Week, This Month, All Upcoming.
- FR-3.8.4: Analytics dashboard with 4 charts: meetings per week, busiest days, duration distribution, top participants.
- FR-3.8.5: Profile page with avatar upload, display name editing, scheduling preference controls, and Google integration status.
- FR-3.8.6: Notifications categorized as scheduled, upcoming, ended, or canceled.
- FR-3.8.7: Persistent Light/Dark mode via localStorage.

---

## 4. External Interface Requirements

### 4.1 User Interfaces
- **Sidebar Navigation:** Collapsible sidebar with icon + label navigation for 6 primary views.
- **Header Bar:** Fixed top bar with search field, notification bell with badge counter, theme toggle, settings gear, and logout.
- **Visual Feedback:** All CRUD operations provide toast notifications or success/error animations.

### 4.2 Software Interfaces
| Interface | Technology | Purpose |
|-----------|-----------|---------|
| Database | MongoDB via Mongoose ODM | Store User, Meeting, Team, Contact, ApiKey, ConversationSession |
| Google Calendar | `googleapis` Node module | One-way push (ChronosAI → Google) |
| Email | Nodemailer (SMTP) | Send meeting invitations and reminders |
| Video | `@jitsi/react-sdk` | Embedded video conferencing (configurable domain via `VITE_JITSI_DOMAIN`) |
| AI Engine | Google Gemini SDK | Natural language understanding |
| Charts | Recharts | Analytics visualizations |
| Calendar UI | FullCalendar | Interactive monthly calendar view |

---

## 5. Nonfunctional Requirements

### 5.1 Performance
- Local fallback NLP must respond in < 500ms.
- Gemini API calls render "thinking" animations and resolve in < 3000ms.
- Integration dispatches (email, calendar) are optimized for reliability; the system awaits confirmation to ensure record consistency.
- Cron job completes scan within 5 seconds per cycle.

### 5.2 Security
- **AES-256-GCM Encryption**: All sensitive third-party tokens (Google Access/Refresh) are encrypted at rest with unique IVs.
- **HttpOnly Secure Cookies**: All user sessions are managed via HttpOnly, Secure, SameSite=Strict cookies to eliminate localStorage-based XSS vectors.
- **Fail-Fast Environment Validation**: System prevents startup in production if ENCRYPTION_KEY or JWT_SECRET are missing.
- **NoSQL Injection Protection**: Incoming JSON payloads are sanitized (mongo-sanitize) to strip operator injection attempts.
- **Standard Security Headers**: Helmet middleware enforces modern web security policies (CSP, X-Frame-Options, etc.).
- Rate limiting prevents brute force attacks on auth endpoints (20 requests/15 min).

### 5.3 Reliability
- **Graceful Degradation:** If SMTP is offline, meetings are still created. If Gemini is unavailable, the local parser handles requests.
- **Duplicate Prevention:** Reminder cron prevents sending duplicate notifications via in-memory tracking.
- **Token Resilience:** Google OAuth tokens are proactively refreshed 5 minutes before expiration.

### 5.4 Scalability
- The three-service architecture allows independent horizontal scaling.
- The reminder cron job must be limited to a single instance in multi-server deployments.

### 5.5 Maintainability
- Clean separation between frontend (React), backend (Express), and AI (FastAPI) services.
- Consistent REST API design with proper HTTP status codes.

### 5.6 Testability
- **Target Coverage:** ≥ 70% code coverage across all backend utilities and controllers.
- **Backend:** Jest test suite with `mongodb-memory-server` (96 tests).
- **Frontend:** Vitest + React Testing Library suite (44 tests).
- **Test Isolation:** Each test file manages its own in-memory database instance.
