# Software Design Specification (SDS) for ChronosAI

## 1. Introduction

### 1.1 Purpose
This Software Design Specification (SDS) document provides a comprehensive technical blueprint of the **ChronosAI** meeting scheduler platform. It describes the system architecture, database models, internal component structures, and sequence logics necessary to build, maintain, and scale the application. 

### 1.2 Scope
This document covers the architectural layout of the full-stack system, including the React frontend UI patterns, Node.js backend integration routes, database entity relationships, and Python AI NLP bindings. 

---

## 2. System Architecture

### 2.1 High-Level Architecture
ChronosAI employs a decoupled, microservices-inspired monolithic structure broken into three functional nodes:
1.  **Frontend Single Page Application (SPA):** Served via Vite, orchestrating UI rendering via React and Tailwind CSS.
2.  **API Gateway & Controller Node:** A Node.js/Express.js server responsible for database transactions, Session state logic, and 3rd Party integrations (Google, SMTP).
3.  **NLP Analytics Service:** A standalone Python/FastAPI backend executing Large Language Model (Gemini) abstraction and Regex/Dateparser fallback mapping for semantic extraction.

### 2.2 System Flow (Sequence Context)
When a user inputs a chat command (e.g., *"Schedule a meeting with Alex tomorrow"*):
1.  `ChatWidget.jsx` invokes `POST /api/dialogue/process`.
2.  `dialogue.controller.js` retrieves or provisions a `ConversationSession` from MongoDB.
3.  The controller routes the raw text via internal HTTP to the FastAPI python microservice at `POST /parse`.
4.  `parser.py` maps the extracted NLP JSON back to the Node controller.
5.  Node maps the entities into MongoDB, executes algorithmic collision checks against `bufferTime`, and fires integration dispatches (`syncWithGoogleCalendar` and `sendEmail`) if the node successfully saves a `Meeting.model.js` object.

---

## 3. Data Design

The platform uses MongoDB natively via `mongoose` Object Data Modeling (ODM).

### 3.1 User Schema
Handles Identity, Settings, and OAuth limits.
- `name` (String, required)
- `email` (String, unique, required)
- `password` (String) *hashed via bcrypt*
- `timezone` (String, default: "UTC")
- `bufferTime` (Number, default: 0) *used for collision prevention*
- `googleId` (String)
- `googleAccessToken` (String)
- `googleRefreshToken` (String)

### 3.2 Meeting Schema
Houses finite scheduling events mapped to external calendars.
- `title` (String, required)
- `date` (String, YYYY-MM-DD, required)
- `startTime` (String, HH:MM, required)
- `duration` (Number, minutes, required)
- `participants` (Array of Strings)
- `organizer` (ObjectId, ref: 'User')
- `status` (String, ['scheduled', 'canceled'], default: 'scheduled')
- `jitsiRoom` (String) *Unique identifier for Video conference routing*

### 3.3 ConversationSession Schema
Houses state machine logic for multi-turn NLP conversations.
- `userId` (ObjectId, ref: 'User')
- `intent` (String) *['schedule', 'reschedule', 'cancel']*
- `participants` / `resolvedParticipants` (Array)
- `date` / `time` / `timezone` / `duration` (Strings/Numbers)
- `pendingResolutionName` (String) *Used if multiple contacts match*
- `ambiguousCandidates` (Array)
- `status` (String, ['active', 'completed', 'canceled'])

---

## 4. API Interface Specifications

### 4.1 Node.js REST API (Port 5000)
All protected endpoints require an `Authorization: Bearer <JWT>` header.

**Auth Module:**
- `POST /api/auth/register` & `POST /api/auth/login` (Returns JWT)
- `GET /api/auth/google/url` & `GET /api/auth/google/callback`

**Meetings Module:**
- `POST /api/meetings/schedule` (Standard manual creation fallback)
- `GET /api/meetings/all` (Resolves organizer bounds)
- `GET /api/meetings/date/:date`
- `PUT /api/meetings/reschedule/:id`
- `DELETE /api/meetings/cancel/:id`

**User Preferences Module:**
- `GET /api/users/settings`
- `PUT /api/users/settings` (Payload: `{ bufferTime, timezone }`)

**Dialogue Node:**
- `POST /api/dialogue/process`
  - Payload: `{ message: String, sessionId: String }`
  - Response: `{ reply: String, sessionId: String, meeting: Object }`

### 4.2 Python Analytics API (Port 8000)
**Analytics Module:**
- `POST /parse`
  - Payload: `ParseRequest { message: String }`
  - Response: `ParsedResult { intent, date, time, timezone, duration, participants }`

---

## 5. Component & Module Design (Frontend)

### 5.1 Hierarchical Structure
The React UI cleanly divides stateless presentation components from stateful analytical wrappers.
- `App.jsx`: Global provider. Hooks `localStorage` for Theme (`dark`/`light` mode) propagation across the `div` root.
- `Dashboard.jsx`: Central state orchestrator storing UI logic for `meetings`, `selectedDate`, and integrating child widgets.

### 5.2 Key Widgets
1.  **`ChatWidget.jsx`**: 
    - Handles isolated HTTP states handling the `Chronos is thinking...` dynamic skeleton loading UI.
    - Synchronizes context-bubble colors via dual `bg-gradient-to-r` styles dynamically injected on Tailwind conditions.
2.  **`CalendarWidget.jsx`**:
    - Abstraction layer wrapping `@fullcalendar/react`. Hooks specifically into standard DOM classes to forcibly inject global `index.css` overwrites allowing FullCalendar to obey Light/Dark transitions smoothly.
3.  **`SettingsModal` / `MeetingDetailsModal`**: 
    - Floating Modals leveraging absolute Z-index mapping and `backdrop-blur` UI properties to lock user attention safely without unmounting parent components.

### 5.3 Integrations Handling
- **Jitsi**: Rendered natively via `@jitsi/react-sdk` inside the `MeetingRoom.jsx` router boundary extracting the `:roomName` parameter structurally generated in `meeting.controller.js`.
