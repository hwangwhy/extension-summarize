# endpoint.py

from fastapi import FastAPI, File, UploadFile, Form
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from transformers import pipeline, AutoTokenizer, AutoModelForSeq2SeqLM
from langdetect import detect
import docx
import yake

# Load Models
tokenizer_en = AutoTokenizer.from_pretrained("facebook/bart-large-cnn")
model_en = AutoModelForSeq2SeqLM.from_pretrained("facebook/bart-large-cnn")

tokenizer_vi = AutoTokenizer.from_pretrained("csebuetnlp/mT5_multilingual_XLSum")
model_vi = AutoModelForSeq2SeqLM.from_pretrained("csebuetnlp/mT5_multilingual_XLSum")

topic_classifier = pipeline("zero-shot-classification", model="facebook/bart-large-mnli")

stopwords_vi = set(open("vietnamese-stopwords.txt", encoding='utf-8').read().splitlines())

labels_file = "labels.txt"
with open(labels_file, "r", encoding="utf-8") as f:
    candidate_labels = [line.strip() for line in f.readlines() if line.strip()]

# FastAPI App
app = FastAPI()

# Allow CORS (Frontend)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Utility: Read .docx
def read_docx(file) -> str:
    return "\n".join([para.text for para in docx.Document(file).paragraphs])

# Utility: Detect language
def detect_language(text):
    try:
        return detect(text)
    except:
        return None

# Utility: Summarize
def summarize_text(text: str, lang: str):
    tokenizer, model = (tokenizer_vi, model_vi) if lang == "vi" else (tokenizer_en, model_en)
    prefix = "summarize: " if lang == "vi" else ""
    inputs = tokenizer(prefix + text, return_tensors="pt", max_length=1024, truncation=True)
    summary_ids = model.generate(inputs.input_ids, max_length=150, min_length=40, num_beams=4, length_penalty=2.0)
    return tokenizer.decode(summary_ids[0], skip_special_tokens=True)

# Utility: Keywords
def extract_keywords(text: str, lang: str, stopwords=None, max_keywords=10):
    kw_extractor = yake.KeywordExtractor(lan=lang, n=1, top=max_keywords * 2)
    raw_keywords = kw_extractor.extract_keywords(text)
    if lang == "vi" and stopwords:
        return [kw.lower() for kw, _ in raw_keywords if kw.lower() not in stopwords][:max_keywords]
    return [kw for kw, _ in raw_keywords[:max_keywords]]

# Utility: Topic classification
def classify_topic(text: str, lang: str):
    hypothesis_template = "This text is about {}." if lang == "en" else "Đoạn văn này nói về {}."
    result = topic_classifier(text, candidate_labels, hypothesis_template=hypothesis_template, multi_label=True)
    top_3 = [{"label": label, "score": round(score, 3)} for label, score in list(zip(result["labels"], result["scores"]))[:3]]
    return top_3

# Base route
@app.get("/")
def root():
    return {"message": "Text Analysis API - Summarize | Keywords | Topic Classification"}

# Endpoint: Summarize
@app.post("/summary")
async def summarize(text: Optional[str] = Form(None), file: Optional[UploadFile] = File(None)):
    if not text and not file:
        return JSONResponse(status_code=400, content={"error": "Missing 'text' or '.docx' file."})
    if file:
        if not file.filename.endswith(".docx"):
            return JSONResponse(status_code=400, content={"error": "Only .docx files allowed."})
        text = read_docx(file.file)
    lang = detect_language(text)
    if lang not in ["en", "vi"]:
        return JSONResponse(status_code=400, content={"error": "Only English and Vietnamese supported."})
    return {"language": lang, "summary": summarize_text(text, lang)}

# Endpoint: Keywords
@app.post("/keywords")
async def keywords(text: Optional[str] = Form(None), file: Optional[UploadFile] = File(None)):
    if not text and not file:
        return JSONResponse(status_code=400, content={"error": "Missing 'text' or '.docx' file."})
    if file:
        if not file.filename.endswith(".docx"):
            return JSONResponse(status_code=400, content={"error": "Only .docx files allowed."})
        text = read_docx(file.file)
    lang = detect_language(text)
    if lang not in ["en", "vi"]:
        return JSONResponse(status_code=400, content={"error": "Only English and Vietnamese supported."})
    stopwords = stopwords_vi if lang == "vi" else None
    keywords = extract_keywords(text, lang, stopwords)
    return {"language": lang, "keywords": keywords}

# Endpoint: Topic
@app.post("/topic")
async def topic(text: Optional[str] = Form(None), file: Optional[UploadFile] = File(None)):
    if not text and not file:
        return JSONResponse(status_code=400, content={"error": "Missing 'text' or '.docx' file."})
    if file:
        if not file.filename.endswith(".docx"):
            return JSONResponse(status_code=400, content={"error": "Only .docx files allowed."})
        text = read_docx(file.file)
    lang = detect_language(text)
    if lang not in ["en", "vi"]:
        return JSONResponse(status_code=400, content={"error": "Only English and Vietnamese supported."})
    topics = classify_topic(text, lang)
    return {"language": lang, "topics": topics}

#uvicorn endpoint:app --reload
