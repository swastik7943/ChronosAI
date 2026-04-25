from fastapi import FastAPI
from pydantic import BaseModel
from agent.parser import parse_message, ParsedResult
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

app = FastAPI(title="ChronosAI - AI Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ParseRequest(BaseModel):
    message: str
    current_time: str | None = None  # ISO format with timezone e.g. "2026-04-21T08:00:00+05:30"
    history: list[dict] | None = None  # [{role: 'user'|'model', content: str}]

@app.post("/parse", response_model=ParsedResult)
def parse_endpoint(request: ParseRequest):
    result = parse_message(request.message, request.current_time, request.history)
    return result

@app.get("/health")
def health_check():
    return {"status": "ok"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
