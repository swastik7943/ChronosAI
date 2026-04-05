# Software Requirements Specification (SRS) for ChronosAI

## 1. Introduction

### 1.1 Purpose
The purpose of this document is to outline the software requirements for **ChronosAI**, an AI-powered meeting scheduler and management platform. This document intended for developers, project managers, and stakeholders provides a detailed overview of the system architecture, features, constraints, and external interactions.

### 1.2 Scope
ChronosAI is designed to streamline the scheduling process for professionals and enterprise users by utilizing natural language processing (NLP). The application enables users to schedule, reschedule, and cancel meetings through an AI chat interface. It acts as an autonomous assistant capable of disambiguating contacts, resolving timezone differences, preventing calendar collisions through customizable buffer times, and dynamically syncing with Google Calendar while dispatching automated email notifications containing Jitsi video conferencing links.

### 1.3 Definitions and Acronyms
- **AI:** Artificial Intelligence
- **NLP:** Natural Language Processing
- **SRS:** Software Requirements Specification
- **JWT:** JSON Web Token (used for authentication)
- **SMTP:** Simple Mail Transfer Protocol (used for email distribution)
- **OAuth:** Open Authorization (used for Google Calendar API access)
- **UI/UX:** User Interface / User Experience

---

## 2. Overall Description

### 2.1 Product Perspective
ChronosAI is an independent full-stack web application consisting of three distinct micro-architectures:
1.  **Frontend Module:** A React.js Single Page Application (SPA) providing the interactive dashboard, calendar views, and real-time chat interface.
2.  **Backend API:** A Node.js/Express.js service handling authentication, database interactions via MongoDB, integration orchestration (Google Calendar/SMTP), and state management for the dialogue controller.
3.  **AI Microservice:** A Python/FastAPI service dedicated to parsing natural language scheduling requests using Google Gemini, with a robust local fallback mechanism utilizing `spaCy` and `dateparser`.

### 2.2 Product Functions
- **Natural Language Scheduling:** Process unstructured user messages into structured meeting parameters (`intent`, `date`, `time`, `participants`, `duration`).
- **Stateful Dialogue Manager:** Maintain conversational context to implicitly ask for missing meeting constraints iteratively.
- **Calendar Visualization:** Display user's upcoming schedules dynamically on interactive daily and monthly grids.
- **Smart Conflict Resolution:** Analyze existing DB records combined with user-defined "buffer times" to reject conflicting queries and suggest alternative timeslots.
- **Contact Disambiguation:** Verify participant names against a database directory. Ask targeted follow-up queries if multiple identities share the same identifier.
- **Video Meeting Provisioning:** Automatically generate and attach unique Jitsi Meeting URL coordinates to approved events.
- **Third-Party Integrations:** Push finalized meetings synchronously to Google Calendar and distribute email invites via SMTP.

### 2.3 User Classes and Characteristics
- **Standard User:** A professional using the platform to manage their personal or business schedule. Needs to quickly establish parameters, hook into external tools (Google, Email), and modify UI themes based on visual preference (Light/Dark mode).
- **Meeting Participant:** An external recipient who receives standardized email notifications containing ChronosAI meeting data and video links. 

### 2.4 Operating Environment
- **Client Side:** Modern web browsers (Chrome, Firefox, Safari, Edge) on desktop and mobile platforms.
- **Server Side:** Node.js (v18+) Runtime environment, Python (3.10+) environment for AI.
- **Database Server:** MongoDB Atlas or local MongoDB instance (v5.0+).

---

## 3. System Features

### 3.1 AI Dialogue and State Engine
- **Description:** The system must actively parse input and retain conversational context (`ConversationSession` schema) to fulfill complex scheduling instructions.
- **Functional Requirements:**
  - FR-3.1.1: The AI must identify intents:`schedule`, `reschedule`, `cancel`.
  - FR-3.1.2: The system must execute local `spaCy`/Regex fallback logic to parse time and names if the primary LLM API key is unavailable.
  - FR-3.1.3: The system must enforce sequential query logic if critical elements (Date, Time, Participants) are missing.

### 3.2 Automated Collision and Buffer Engine
- **Description:** The system prevents dangerous double-booking using localized user configurations.
- **Functional Requirements:**
  - FR-3.2.1: Users can modify a personal `bufferTime` setting (e.g., 15 minutes) and a standard `timezone`.
  - FR-3.2.2: The scheduler controller must evaluate `[existing_meeting.start - buffer]` to `[existing_meeting.end + buffer]` before executing `Meeting.create()`.
  - FR-3.2.3: If a collision occurs, the AI must formulate a rejection phrase highlighting the immediate next available chronological timeslot.

### 3.3 Third-Party Integrations
- **Description:** Automating workflow connections once a meeting is successfully orchestrated by the AI.
- **Functional Requirements:**
  - FR-3.3.1: The system securely retrieves and maps an OAuth2 Token for Google API upon user consent.
  - FR-3.3.2: ChronosAI must emit `calendar.events.insert` payloads securely mapping to the user's primary calendar upon generating a new meeting.
  - FR-3.3.3: NodeMailer must dispatch HTML-formatted invitations synchronously to all mapped attendee emails.

### 3.4 Premium UI Interface
- **Description:** A modern, visually engaging dashboard ensuring professional functionality.
- **Functional Requirements:**
  - FR-3.4.1: The system must support persistent Light/Dark mode transitions modifying Tailwind CSS classes securely evaluated via browser Local Storage.
  - FR-3.4.2: Real-time API calls to the AI Service must render a skeleton "Chronos is thinking..." bouncing node animation to maintain engagement.
  - FR-3.4.3: Sliding off-canvas Settings panels and Meeting Detail Modals must contain contextual blur-backdrops (`backdrop-blur`).

---

## 4. External Interface Requirements

### 4.1 User Interfaces
- **Dashboard:** Features a 3-pane responsive grid layout—Agenda List (Left), Chat Widget (Center-Left Array), and FullCalendar Module (Right).
- **Controls:** Smooth toggles (Sun/Moon icon) for dynamic theming, interactive forms for login and registration.

### 4.2 Software Interfaces
- **Database:** MongoDB (via Mongoose ODM) to store `User`, `Meeting`, and stateful `ConversationSession` documents.
- **Google Calendar API:** Connected via `googleapis` Node module passing restricted `calendar.events` scopes.
- **Jitsi Meet API:** Invoked via `@jitsi/react-sdk` embedded dynamically within standard React DOM components.
- **LLM Engine:** Google Gemini SDK (`google-generativeai`) embedded via internal Python REST abstractions.

---

## 5. Nonfunctional Requirements

### 5.1 Performance Requirements
- **Latency Target:** Local fallback interactions must return in < 500ms. External Gemini API calls should render placeholder animations instantly and resolve in < 3000ms.
- **Sync Reliability:** Background integration dispatches (Email/Calendar) must be non-blocking to the main Client UI response thread where technically possible to prevent hanging frames.

### 5.2 Security Requirements
- **Authentication:** All primary endpoints must enforce JWT structural validation (`Bearer Token`). Passwords must be hashed via `bcrypt` natively.
- **Data Privacy:** OAuth Tokens (`googleAccessToken` and `googleRefreshToken`) are kept explicitly behind protected DB walls inside specific User schemas.

### 5.3 Reliability
- **Graceful Degradation:** If the SMTP NodeMailer service is offline entirely, or the Gemini Key is unconfigured, the system must utilize functional internal fail-safes (e.g., standard Regex extraction or local log catches) rather than throwing `500 Server Errors` to the client boundary.
