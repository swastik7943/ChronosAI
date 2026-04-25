import os
import json
import re
from pathlib import Path
from datetime import date, datetime, timezone
import dateparser
from google import genai
from pydantic import BaseModel
from dotenv import load_dotenv

# Try to load .env from multiple possible locations
env_locations = [
    Path(__file__).resolve().parent.parent.parent / ".env",  # Root (local dev)
    Path.cwd() / ".env",                                   # Current working dir (Docker)
    Path(__file__).resolve().parent.parent / ".env"         # ai_service root
]

loaded = False
for path in env_locations:
    if path.exists():
        load_dotenv(dotenv_path=path)
        if os.environ.get("GEMINI_API_KEY"):
            print(f"Loaded configuration from {path}")
            loaded = True
            break

if not loaded:
    # Final fallback to standard load_dotenv (current dir or ENV)
    load_dotenv()
    if not os.environ.get("GEMINI_API_KEY"):
        print("Warning: GEMINI_API_KEY not found in environment or .env files.")

class ParsedResult(BaseModel):
    intent: str
    date: str | None = None
    time: str | None = None
    time_range: str | None = None  # e.g. "afternoon", "morning"
    timezone: str | None = None
    duration: int | None = None # in minutes
    participants: list[str] = []
    title_hint: str | None = None  # extracted context for title generation

# Client is initialized lazily in parse_message to avoid crashing on import when no key is set
_client = None
GEMINI_MODEL = 'gemini-2.0-flash'

def _get_client():
    global _client
    if _client is None:
        _client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))
    return _client

def _get_now(current_time: str | None = None) -> datetime:
    """
    Parse the provided ISO datetime string into a datetime object.
    Falls back to the system's current UTC time if not provided.
    """
    if current_time:
        try:
            # Parse ISO 8601 with timezone (e.g. "2026-04-21T08:00:00+05:30")
            return datetime.fromisoformat(current_time)
        except ValueError:
            pass
    return datetime.now(timezone.utc)

def fallback_parse(text: str, intent: str, now: datetime | None = None) -> ParsedResult:
    if now is None:
        now = datetime.now(timezone.utc)

    date_val = None
    time_val = None
    time_range = None
    duration_val = None
    participants = []
    title_hint = None

    # Time extraction
    time_match = re.search(r'\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b', text.lower())
    if time_match:
        hour = int(time_match.group(1))
        minute = int(time_match.group(2)) if time_match.group(2) else 0
        am_pm = time_match.group(3)
        if am_pm == 'pm' and hour < 12: hour += 12
        if am_pm == 'am' and hour == 12: hour = 0
        time_val = f"{hour:02d}:{minute:02d}"
    elif re.search(r'^(\d{1,2})(?::(\d{2}))?$', text.strip()):
        tm = re.search(r'^(\d{1,2})(?::(\d{2}))?$', text.strip())
        hour = int(tm.group(1))
        minute = int(tm.group(2)) if tm.group(2) else 0
        if 0 <= hour <= 23:
            time_val = f"{hour:02d}:{minute:02d}"

    # Time range extraction (morning, afternoon, evening)
    lower = text.lower()
    if 'morning' in lower: time_range = 'morning'
    elif 'afternoon' in lower: time_range = 'afternoon'
    elif 'evening' in lower: time_range = 'evening'

    # Date extraction using dateparser with PREFER_DATES_FROM: future
    # This ensures "Tuesday" means next Tuesday, not last Tuesday.
    date_phrases = ['tomorrow', 'today', 'day after tomorrow', 'next monday', 'next tuesday',
                    'next wednesday', 'next thursday', 'next friday', 'next saturday', 'next sunday',
                    'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    for phrase in lower.split() + [lower]:
        for dp in date_phrases:
            if dp in lower:
                parsed = dateparser.parse(
                    dp,
                    settings={
                        'PREFER_DATES_FROM': 'future',
                        'RELATIVE_BASE': now,
                    }
                )
                if parsed:
                    parsed_date = parsed.date()
                    today = now.date()
                    # Reject any date that has already passed (could still happen for "today")
                    # For "today", keep it. For anything else, only use future dates.
                    if parsed_date >= today:
                        date_val = parsed_date.strftime("%Y-%m-%d")
                        break
        if date_val:
            break

    if not date_val and re.search(r'202\d-\d{2}-\d{2}', text):
        match = re.search(r'(202\d-\d{2}-\d{2})', text)
        if match:
            candidate_date_str = match.group(1)
            try:
                candidate_date = date.fromisoformat(candidate_date_str)
                if candidate_date >= now.date():
                    date_val = candidate_date_str
            except ValueError:
                pass

    # Multi-participant extraction
    # Pattern 1: "with Alex, Bob, and Carol" or "with Alex and Bob"
    multi_match = re.search(r'with\s+(.+?)(?:\s+(?:tomorrow|today|at\s+\d|on\s+|for\s+|about\s+|to\s+discuss|to\s+\w+day|next\s+|in\s+the)|\s*$)', text, re.IGNORECASE)
    if multi_match:
        names_str = multi_match.group(1).strip()
        names_str = re.sub(r'\s+and\s+', ', ', names_str)
        names = [n.strip().capitalize() for n in names_str.split(',') if n.strip() and len(n.strip()) > 1]
        # Filter out noise words and time-range words
        noise = {'the', 'a', 'an', 'my', 'our', 'team', 'at', 'on', 'for', 'in', 'to',
                 'morning', 'afternoon', 'evening', 'monday', 'tuesday', 'wednesday',
                 'thursday', 'friday', 'saturday', 'sunday'}
        participants = [n for n in names if n.lower() not in noise]
    elif re.search(r'^([a-zA-Z]+(?:\s*,\s*[a-zA-Z]+)*)$', text.strip()):
        # Handle comma separated names like "Alex, Bob, Carol"
        parts = [n.strip().capitalize() for n in text.strip().split(',') if n.strip()]
        noise = {'tomorrow', 'today', 'cancel', 'reschedule', 'yes', 'no', 'schedule'}
        participants = [p for p in parts if p.lower() not in noise]
    elif re.search(r'^([a-zA-Z]+)$', text.strip()):
        words = text.strip().lower()
        skip = ['tomorrow', 'today', 'cancel', 'reschedule', 'yes', 'no', 'schedule',
                'morning', 'afternoon', 'evening', 'ok', 'sure', 'please']
        if words not in skip:
            participants.append(text.strip().capitalize())

    # Duration
    dur_match = re.search(r'(\d+)\s*(min|minute|minutes|hour|hours|hr|hrs)', text.lower())
    if dur_match:
        val = int(dur_match.group(1))
        unit = dur_match.group(2)
        if 'hour' in unit or 'hr' in unit: duration_val = val * 60
        else: duration_val = val

    # Title hint extraction: "to discuss X", "about X", "regarding X" (not "for 1 hour" etc.)
    title_match = re.search(r'(?:to\s+discuss|about|regarding)\s+(.+?)(?:\s+(?:tomorrow|today|at\s+\d|with\s+)|\s*$)', text, re.IGNORECASE)
    if title_match:
        hint = title_match.group(1).strip()
        # Don't capture duration-only phrases as titles
        if not re.match(r'^\d+\s*(min|minute|minutes|hour|hours|hr|hrs)$', hint, re.IGNORECASE):
            title_hint = hint

    return ParsedResult(
        intent=intent,
        date=date_val,
        time=time_val,
        time_range=time_range,
        duration=duration_val,
        participants=participants,
        title_hint=title_hint
    )

def parse_message(text: str, current_time: str | None = None, history: list[dict] | None = None) -> ParsedResult:
    lower = text.lower().strip()
    intent = "unknown"

    now = _get_now(current_time)
    today_str = now.date().isoformat()
    # ISO format is always in UTC if no TZ is given; the backend sends user-local time with offset.
    now_time_str = now.strftime("%H:%M")  # local time of the user

    # Enhanced intent detection
    schedule_words = ['schedule', 'set up', 'create', 'book', 'arrange', 'plan', 'new meeting']
    cancel_words = ['cancel', 'delete', 'remove', 'drop']
    reschedule_words = ['reschedule', 'move', 'postpone', 'push', 'shift', 'change time', 'change date']
    query_words = ['what meeting', 'what do i have', 'do i have', 'show me', 'list', 'my meetings',
                   'my schedule', 'my calendar', 'any meeting', 'am i busy']
    availability_words = ['when am i free', 'when i am free', 'available', 'free slot', 'free time',
                         'open slot', 'availability', 'when can i']

    for w in availability_words:
        if w in lower:
            intent = "availability"
            break
    if intent == "unknown":
        for w in query_words:
            if w in lower:
                intent = "query"
                break
    if intent == "unknown":
        for w in cancel_words:
            if w in lower:
                intent = "cancel"
                break
    if intent == "unknown":
        for w in reschedule_words:
            if w in lower:
                intent = "reschedule"
                break
    if intent == "unknown":
        for w in schedule_words:
            if w in lower:
                intent = "schedule"
                break
    # Default: if message contains meeting-related words with "with" or time
    if intent == "unknown":
        if 'with' in lower or 'meeting' in lower:
            intent = "schedule"

    if not os.environ.get("GEMINI_API_KEY") or os.environ.get("GEMINI_API_KEY") == "your_gemini_api_key_here":
        print("Warning: GEMINI_API_KEY is not configured. Using fallback parser.")
        return fallback_parse(text, intent, now)

    # Core instruction prompt
    instruction = f"""
    The current date is {today_str} and the current local time is {now_time_str}.
    
    IMPORTANT: You are analyzing a message as part of a MULTI-TURN conversation. 
    Use the provided history to resolve pronouns like "him", "her", "them" or phrases like "that meeting".

    Analyze the user's scheduling message and extract the following details into a strict JSON format with exactly these keys:
    - "intent": string ("schedule", "reschedule", "cancel", "query", "availability", or "unknown")
    - "date": string (YYYY-MM-DD) or null
    - "time": string (HH:MM in 24-hour format) or null
    - "time_range": string ("morning", "afternoon", "evening") or null
    - "timezone": string (e.g. "EST", "PST", "UTC") or null
    - "duration": integer (in minutes) or null
    - "participants": array of strings (ALL names/emails mentioned, extract EVERY participant)
    - "title_hint": string (any topic/agenda mentioned, e.g. "budget review") or null

    Intent meanings:
    - "schedule": user wants to create a new meeting
    - "reschedule": user wants to move an existing meeting
    - "cancel": user wants to cancel/delete a meeting
    - "query": user wants to know about their existing meetings
    - "availability": user wants to know when they are free

    CRITICAL DATE/TIME RULES:
    1. ALWAYS prefer FUTURE dates. Never return a date or time that is in the past.
    2. If the user says a weekday (e.g. "Tuesday") and that day has already passed this week, return the NEXT occurrence of that day (next week's Tuesday).
    3. If the user says "today" and a specific time that has already passed, assume they mean TOMORROW at that time.
    4. If no date is mentioned and the user specifies a time that has already passed today, set the date to tomorrow.
    5. "Next Monday" always means Monday of the NEXT WEEK, never today even if today is Monday.

    IMPORTANT: Extract ALL participants. "Schedule with Alex, Bob, and Carol" should give ["Alex", "Bob", "Carol"].
    If the user's message is ONLY a list of names (e.g. "Alex and Bob" or "Alex, Bob"), extract them into the participants array.
    
    Respond ONLY with the JSON object. Do not include markdown codeblocks like ```json .
    """

    # Prepare multi-turn contents
    contents = []
    if history:
        for msg in history:
            role = 'user' if msg['role'] == 'user' else 'model'
            contents.append({'role': role, 'parts': [{'text': msg['content']}]})
    
    # Append current context and message
    full_message = f"INSTRUCTION: {instruction}\n\nUSER MESSAGE: \"{text}\""
    contents.append({'role': 'user', 'parts': [{'text': full_message}]})

    try:
        client = _get_client()
        response = client.models.generate_content(model=GEMINI_MODEL, contents=contents)
        clean_text = response.text.replace("```json", "").replace("```", "").strip()
        data = json.loads(clean_text)
        
        # Post-processing safety: reject any date that is strictly in the past
        parsed_date = data.get("date")
        if parsed_date:
            try:
                if date.fromisoformat(parsed_date) < now.date():
                    # Gemini returned a past date despite our instructions — discard it
                    # so the dialogue controller will ask the user for clarification.
                    print(f"Warning: Gemini returned a past date ({parsed_date}). Discarding.")
                    data["date"] = None
            except ValueError:
                data["date"] = None

        return ParsedResult(
            intent=data.get("intent", "unknown"),
            date=data.get("date"),
            time=data.get("time"),
            time_range=data.get("time_range"),
            timezone=data.get("timezone"),
            duration=data.get("duration"),
            participants=data.get("participants", []),
            title_hint=data.get("title_hint")
        )
    except Exception as e:
        import traceback
        print(f"\n--- GEMINI API ERROR ---\n{e}")
        print("Traceback:")
        traceback.print_exc()
        print("------------------------\n")
        print("Falling back to rule-based parsing...")
        return fallback_parse(text, intent, now)
