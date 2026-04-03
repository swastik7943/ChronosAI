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

@app.post("/parse", response_model=ParsedResult)
def parse_endpoint(request: ParseRequest):
    result = parse_message(request.message)
    return result

@app.get("/health")
def health_check():
    return {"status": "ok"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
