from typing import Optional, List
from fastapi import FastAPI, HTTPException, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from transformers import MBart50TokenizerFast, MBartForConditionalGeneration
from passlib.context import CryptContext
import psycopg2
import psycopg2.extras
import pandas as pd
import os
import shutil
import uuid
import random
from datetime import datetime

app = FastAPI()

# Mount static folder uploads to serve files
UPLOAD_DIR = "assets/uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/static", StaticFiles(directory=UPLOAD_DIR), name="static")

# Allow all origins so React Native (device/emulator) can reach the server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Database connection ───────────────────────────────────────────────────────
def get_db():
    return psycopg2.connect(
        host="localhost",
        database="postgres",
        user="postgres",
        password="bokeeer03",
        port=5432,
    )

# ── Database init — Milestone 1 ───────────────────────────────────────────────
def init_db():
    try:
        conn = get_db()
        cur = conn.cursor()

        # ── Existing tables (unchanged) ───────────────────────────────────────
        cur.execute("""
            CREATE TABLE IF NOT EXISTS lessons (
                id SERIAL PRIMARY KEY,
                topic_id VARCHAR(100) NOT NULL,
                title VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS lesson_slides (
                id SERIAL PRIMARY KEY,
                lesson_id INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
                slide_index INTEGER NOT NULL,
                description_text TEXT NOT NULL,
                image_url TEXT,
                UNIQUE(lesson_id, slide_index)
            );
        """)

        # ── Milestone 1: New columns on existing tables ───────────────────────
        cur.execute("""
            ALTER TABLE lessons
                ADD COLUMN IF NOT EXISTS lesson_group_id INTEGER,
                ADD COLUMN IF NOT EXISTS difficulty VARCHAR(10) DEFAULT 'easy';
        """)

        cur.execute("""
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.table_constraints
                    WHERE constraint_name = 'unique_lesson_per_difficulty'
                ) THEN
                    ALTER TABLE lessons
                        ADD CONSTRAINT unique_lesson_per_difficulty
                        UNIQUE (lesson_group_id, difficulty);
                END IF;
            END$$;
        """)

        cur.execute("""
            ALTER TABLE quizzes
                ADD COLUMN IF NOT EXISTS difficulty VARCHAR(10) DEFAULT 'easy';
        """)

        # ── Milestone 1: New tables ───────────────────────────────────────────
        cur.execute("""
            CREATE TABLE IF NOT EXISTS lesson_groups (
                id SERIAL PRIMARY KEY,
                topic_id VARCHAR(100) NOT NULL,
                title VARCHAR(255) NOT NULL,
                order_index INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS student_quiz_attempts (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL,
                quiz_id INTEGER NOT NULL,
                question_ids INTEGER[] NOT NULL,
                started_at TIMESTAMP DEFAULT NOW(),
                completed_at TIMESTAMP,
                score INTEGER DEFAULT 0,
                total_questions INTEGER DEFAULT 10,
                time_spent_seconds INTEGER DEFAULT 0,
                difficulty VARCHAR(10) DEFAULT 'easy'
            );

            CREATE TABLE IF NOT EXISTS student_question_answers (
                id SERIAL PRIMARY KEY,
                attempt_id INTEGER NOT NULL REFERENCES student_quiz_attempts(id) ON DELETE CASCADE,
                question_id INTEGER NOT NULL,
                is_correct BOOLEAN NOT NULL,
                time_spent_seconds INTEGER DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS student_lesson_progress (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL,
                lesson_group_id INTEGER NOT NULL,
                easy_passed BOOLEAN DEFAULT FALSE,
                medium_passed BOOLEAN DEFAULT FALSE,
                hard_passed BOOLEAN DEFAULT FALSE,
                easy_best_score FLOAT DEFAULT 0.0,
                medium_best_score FLOAT DEFAULT 0.0,
                hard_best_score FLOAT DEFAULT 0.0,
                attempts_count INTEGER DEFAULT 0,
                last_updated TIMESTAMP DEFAULT NOW(),
                UNIQUE(user_id, lesson_group_id)
            );

            CREATE TABLE IF NOT EXISTS student_profiles (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL,
                topic_id VARCHAR(100) NOT NULL,
                knowledge_level VARCHAR(10) DEFAULT 'easy',
                avg_accuracy FLOAT DEFAULT 0.0,
                avg_time_seconds FLOAT DEFAULT 0.0,
                quizzes_completed INTEGER DEFAULT 0,
                total_stars INTEGER DEFAULT 0,
                last_updated TIMESTAMP DEFAULT NOW(),
                UNIQUE(user_id, topic_id)
            );

            CREATE TABLE IF NOT EXISTS topic_settings (
                topic_id VARCHAR(100) PRIMARY KEY,
                pass_threshold FLOAT DEFAULT 70.0
            );
        """)

        # ── Phase 2: ITS tables ───────────────────────────────────────────────
        cur.execute("""
            CREATE TABLE IF NOT EXISTS knowledge_components (
                id SERIAL PRIMARY KEY,
                topic_id VARCHAR(100),
                name VARCHAR(100) UNIQUE NOT NULL,
                display_name VARCHAR(255) NOT NULL,
                prior FLOAT DEFAULT 0.10,
                learns FLOAT DEFAULT 0.20,
                guesses FLOAT DEFAULT 0.25,
                slips FLOAT DEFAULT 0.10,
                created_at TIMESTAMP DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS student_kc_mastery (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL,
                kc_name VARCHAR(100) NOT NULL,
                p_mastery FLOAT DEFAULT 0.10,
                correct_count INTEGER DEFAULT 0,
                wrong_count INTEGER DEFAULT 0,
                total_opportunities INTEGER DEFAULT 0,
                last_updated TIMESTAMP DEFAULT NOW(),
                UNIQUE(user_id, kc_name)
            );
        """)

        # Add KC column to questions if missing
        cur.execute("""
            ALTER TABLE questions
                ADD COLUMN IF NOT EXISTS knowledge_component VARCHAR(100);
        """)

        # ── Phase 3: Streak & Daily Quiz tables ──────────────────────────────
        cur.execute("""
            CREATE TABLE IF NOT EXISTS student_streaks (
                user_id INTEGER PRIMARY KEY,
                current_streak INTEGER DEFAULT 0,
                longest_streak INTEGER DEFAULT 0,
                last_activity_date DATE,
                pre_break_streak INTEGER DEFAULT 0,
                updated_at TIMESTAMP DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS daily_quiz_slots (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL,
                slot_date DATE NOT NULL DEFAULT CURRENT_DATE,
                slot_difficulty VARCHAR(10) NOT NULL,   -- 'easy' | 'medium' | 'hard'
                quiz_id INTEGER,
                lesson_group_id INTEGER,
                completed BOOLEAN DEFAULT FALSE,
                refresh_used BOOLEAN DEFAULT FALSE,
                stars_earned INTEGER DEFAULT 0,
                UNIQUE(user_id, slot_date, slot_difficulty)
            );
        """)

        conn.commit()
        cur.close()
        conn.close()
        print("Database initialized successfully.")
    except Exception as e:
        print("Database init error:", e)

init_db()

# ── Password hashing ─────────────────────────────────────────────────────────
pwd_context = CryptContext(schemes=["sha256_crypt"], deprecated="auto")

# ══════════════════════════════════════════════════════════════════════════════
# ── Phase 3: Streak Helper ────────────────────────────────────────────────────
# ══════════════════════════════════════════════════════════════════════════════

from datetime import date, timedelta

def _update_student_streak(cur, user_id: int):
    """
    Called after every quiz completion.
    - If last activity was yesterday  → current_streak += 1
    - If last activity was today      → no change (already counted)
    - If last activity was older      → reset to 1, save pre_break_streak for repair
    """
    today = date.today()
    cur.execute(
        "SELECT * FROM student_streaks WHERE user_id = %s",
        (user_id,)
    )
    row = cur.fetchone()

    if not row:
        cur.execute(
            """INSERT INTO student_streaks (user_id, current_streak, longest_streak, last_activity_date, pre_break_streak)
               VALUES (%s, 1, 1, %s, 0)""",
            (user_id, today)
        )
        return

    last = row["last_activity_date"]
    current = row["current_streak"]
    longest = row["longest_streak"]

    if last == today:
        # Already counted today
        return
    elif last == today - timedelta(days=1):
        # Consecutive day
        new_streak = current + 1
        new_longest = max(longest, new_streak)
        cur.execute(
            """UPDATE student_streaks
               SET current_streak = %s, longest_streak = %s,
                   last_activity_date = %s, pre_break_streak = 0, updated_at = NOW()
               WHERE user_id = %s""",
            (new_streak, new_longest, today, user_id)
        )
    else:
        # Streak broken — save old streak for repair
        cur.execute(
            """UPDATE student_streaks
               SET pre_break_streak = %s, current_streak = 1,
                   last_activity_date = %s, updated_at = NOW()
               WHERE user_id = %s""",
            (current, today, user_id)
        )


def _get_total_stars(cur, user_id: int) -> int:
    """Sum of all stars across all student_profiles rows for this user."""
    cur.execute(
        "SELECT COALESCE(SUM(total_stars), 0) AS stars FROM student_profiles WHERE user_id = %s",
        (user_id,)
    )
    row = cur.fetchone()
    return int(row["stars"]) if row else 0


def _deduct_stars(cur, user_id: int, amount: int, topic_id: str = None):
    """
    Deduct stars from the student's profile(s).
    Deducts from the topic_id profile if provided, otherwise from the first profile found.
    """
    if topic_id:
        cur.execute(
            "UPDATE student_profiles SET total_stars = GREATEST(0, total_stars - %s) WHERE user_id = %s AND topic_id = %s",
            (amount, user_id, topic_id)
        )
    else:
        # Deduct from first profile
        cur.execute(
            "UPDATE student_profiles SET total_stars = GREATEST(0, total_stars - %s) WHERE user_id = %s AND id = (SELECT id FROM student_profiles WHERE user_id = %s LIMIT 1)",
            (amount, user_id, user_id)
        )


# ══════════════════════════════════════════════════════════════════════════════
# ── Phase 2: Bayesian Knowledge Tracing Engine ────────────────────────────────
# ══════════════════════════════════════════════════════════════════════════════

def bkt_update(p_know: float, p_learn: float, p_guess: float, p_slip: float, correct: bool) -> float:
    """
    Core BKT equation — same math as pyBKT library.
    Updates P(mastery) given one observation (correct=True or False).
    Works from Day 1 with literature-based priors (no student data needed).
    """
    if correct:
        # P(know | correct) = P(know) * P(not_slip) / [P(know)*P(not_slip) + P(not_know)*P(guess)]
        numerator = p_know * (1.0 - p_slip)
        denominator = numerator + (1.0 - p_know) * p_guess
    else:
        # P(know | wrong) = P(know) * P(slip) / [P(know)*P(slip) + P(not_know)*P(not_guess)]
        numerator = p_know * p_slip
        denominator = numerator + (1.0 - p_know) * (1.0 - p_guess)

    p_know_given_obs = numerator / max(denominator, 1e-9)
    # Apply learning transition: P(know_next) = P(know|obs) + P(not_know|obs) * P(learn)
    p_know_next = p_know_given_obs + (1.0 - p_know_given_obs) * p_learn
    return round(min(0.99, max(0.01, p_know_next)), 4)


def _get_student_kc_mastery(cur, user_id: int, kc_name: str) -> float:
    """
    Returns current P(mastery) for a student on a KC.
    Falls back to literature-based prior if no history exists.
    """
    cur.execute(
        "SELECT p_mastery FROM student_kc_mastery WHERE user_id = %s AND kc_name = %s",
        (user_id, kc_name)
    )
    row = cur.fetchone()
    if row:
        return row["p_mastery"]
    # No history → use KC's configured prior
    cur.execute("SELECT prior FROM knowledge_components WHERE name = %s", (kc_name,))
    kc_row = cur.fetchone()
    return kc_row["prior"] if kc_row else 0.10


def _adaptive_question_selection(cur, user_id: int, all_questions: list, n: int = 10) -> list:
    """
    Phase 2 — Pedagogical Model: Adaptive question selection using BKT mastery.
    Prioritises KCs where P(mastery) is in 0.3-0.7 (Zone of Proximal Development).
    Falls back to random priority when no KC tag exists or no data yet.
    """
    scored = []
    for q in all_questions:
        kc_name = q.get("knowledge_component")
        if kc_name:
            p_mastery = _get_student_kc_mastery(cur, user_id, kc_name)
            # ZPD priority: highest score at mastery=0.5, drops off toward 0 or 1
            priority = 1.0 - abs(p_mastery - 0.5) * 2.0
        else:
            # No KC tag → mid priority with randomness (same as Phase 1 random)
            priority = 0.5
        # Add a small random jitter so equal-priority KCs are not deterministic
        priority += random.uniform(-0.05, 0.05)
        scored.append((priority, q))

    scored.sort(key=lambda x: x[0], reverse=True)
    return [q for _, q in scored[:n]]


def _upsert_kc_mastery(cur, user_id: int, kc_name: str, is_correct: bool):
    """
    Update student KC mastery via BKT after one question answer.
    Creates a new mastery record if the student has never attempted this KC.
    """
    cur.execute(
        "SELECT prior, learns, guesses, slips FROM knowledge_components WHERE name = %s",
        (kc_name,)
    )
    kc = cur.fetchone()
    if not kc:
        return  # KC not registered yet — skip silently

    current = _get_student_kc_mastery(cur, user_id, kc_name)
    new_mastery = bkt_update(current, kc["learns"], kc["guesses"], kc["slips"], is_correct)

    cur.execute(
        """
        INSERT INTO student_kc_mastery (user_id, kc_name, p_mastery, correct_count, wrong_count, total_opportunities)
        VALUES (%s, %s, %s, %s, %s, 1)
        ON CONFLICT (user_id, kc_name) DO UPDATE SET
            p_mastery = %s,
            correct_count   = student_kc_mastery.correct_count + %s,
            wrong_count     = student_kc_mastery.wrong_count + %s,
            total_opportunities = student_kc_mastery.total_opportunities + 1,
            last_updated    = NOW()
        """,
        (
            user_id, kc_name, new_mastery, int(is_correct), int(not is_correct),
            new_mastery, int(is_correct), int(not is_correct)
        )
    )

# ── Load model from local cache (already downloaded) ─────────────────────────
LOCAL_MODEL_PATH = r"C:\Users\Radny\.cache\huggingface\hub\models--manohonsy--asl-mbart-50-lora\snapshots\d1cd3a2abdad5b6df6438be5b0a2ed388c622e9e"
print("Loading tokenizer and model from local cache...")
tokenizer = MBart50TokenizerFast.from_pretrained(LOCAL_MODEL_PATH, local_files_only=True)
model = MBartForConditionalGeneration.from_pretrained(LOCAL_MODEL_PATH, local_files_only=True)

# Manually register asl_GL in case it isn't present
asl_id = tokenizer.convert_tokens_to_ids("asl_GL")
tokenizer.lang_code_to_id["asl_GL"] = asl_id

print(f"asl_GL token id: {asl_id}")
print("Model loaded and ready!")


# ══════════════════════════════════════════════════════════════════════════════
# ── Schemas ───────────────────────────────────────────────────────────────────
# ══════════════════════════════════════════════════════════════════════════════

class RegisterRequest(BaseModel):
    name: str
    username: str
    password: str

class LoginRequest(BaseModel):
    username: str
    password: str

class TranslationRequest(BaseModel):
    text: str
    direction: str  # "en_to_asl" or "asl_to_en"

class SlideInput(BaseModel):
    description_text: str
    image_url: Optional[str] = None

class LessonGroupCreateRequest(BaseModel):
    topic_id: str
    title: str
    order_index: int = 0

class LessonCreateRequest(BaseModel):
    topic_id: str
    title: str
    difficulty: str = 'easy'        # 'easy' | 'medium' | 'hard'
    lesson_group_id: Optional[int] = None
    slides: list[SlideInput]

class UpdateLessonSlidesRequest(BaseModel):
    slides: list[SlideInput]

class MatchingPairInput(BaseModel):
    left: str
    right: str

class QuestionInput(BaseModel):
    question_text: str
    question_type: str = "descriptive"
    image_url: Optional[str] = None
    knowledge_component: Optional[str] = None   # Phase 2: KC tag
    options: Optional[list[str]] = None
    correct_option_index: Optional[int] = None
    matching_pairs: Optional[list[MatchingPairInput]] = None

class QuizCreateRequest(BaseModel):
    title: str
    topic_id: str
    lesson_id: int
    difficulty: str = 'easy'        # inherited from lesson
    questions: list[QuestionInput]

class KCCreateRequest(BaseModel):
    topic_id: str
    name: str          # machine name e.g. "identify_vowels"
    display_name: str  # human label e.g. "Identify Vowels"
    prior: float = 0.10    # P(L0)  — prior probability of knowing
    learns: float = 0.20  # P(T)   — learning rate per opportunity
    guesses: float = 0.25 # P(G)   — guess probability (0.25 for 4-choice MCQ)
    slips: float = 0.10   # P(S)   — slip probability

class AnswerInput(BaseModel):
    question_id: int
    is_correct: bool
    time_spent_seconds: int = 0

class QuizCompleteRequest(BaseModel):
    score: int
    total_questions: int
    time_spent_seconds: int
    answers: list[AnswerInput]


# ══════════════════════════════════════════════════════════════════════════════
# ── Auth endpoints ────────────────────────────────────────────────────────────
# ══════════════════════════════════════════════════════════════════════════════

@app.post("/register")
def register(req: RegisterRequest):
    if not req.name.strip() or not req.username.strip() or not req.password.strip():
        raise HTTPException(status_code=400, detail="All fields are required.")
    hashed = pwd_context.hash(req.password)
    try:
        conn = get_db()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(
            "INSERT INTO users (name, username, password_hash) VALUES (%s, %s, %s) RETURNING id, name, username",
            (req.name.strip(), req.username.strip().lower(), hashed),
        )
        user = cur.fetchone()
        conn.commit()
        cur.close()
        conn.close()
        return {"success": True, "user": dict(user)}
    except psycopg2.errors.UniqueViolation:
        raise HTTPException(status_code=409, detail="Username already taken.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/login")
def login(req: LoginRequest):
    try:
        conn = get_db()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(
            "SELECT id, name, username, password_hash FROM users WHERE username = %s",
            (req.username.strip().lower(),),
        )
        user = cur.fetchone()
        cur.close()
        conn.close()

        if user is None or not pwd_context.verify(req.password, user["password_hash"]):
            raise HTTPException(status_code=401, detail="Invalid username or password.")

        return {
            "success": True,
            "user": {"id": user["id"], "name": user["name"], "username": user["username"]},
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ══════════════════════════════════════════════════════════════════════════════
# ── Milestone 2: Lesson Group + Lesson CRUD ───────────────────────────────────
# ══════════════════════════════════════════════════════════════════════════════

@app.post("/admin/lesson-group/create")
def create_lesson_group(req: LessonGroupCreateRequest):
    if not req.title.strip() or not req.topic_id.strip():
        raise HTTPException(status_code=400, detail="Title and Topic ID are required.")
    try:
        conn = get_db()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(
            "INSERT INTO lesson_groups (topic_id, title, order_index) VALUES (%s, %s, %s) RETURNING id, topic_id, title, order_index, created_at",
            (req.topic_id.strip(), req.title.strip(), req.order_index),
        )
        group = dict(cur.fetchone())
        conn.commit()
        cur.close()
        conn.close()
        return {"success": True, "lesson_group": group}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/admin/lesson-groups/{topic_id}")
def get_lesson_groups(topic_id: str):
    try:
        conn = get_db()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(
            "SELECT id, topic_id, title, order_index, created_at FROM lesson_groups WHERE topic_id = %s ORDER BY order_index ASC, id ASC",
            (topic_id,),
        )
        groups = cur.fetchall()
        result = []
        for g in groups:
            # Fetch all difficulty lessons under this group
            cur.execute(
                "SELECT id, title, difficulty, created_at FROM lessons WHERE lesson_group_id = %s ORDER BY id ASC",
                (g["id"],)
            )
            lessons = cur.fetchall()
            # Count slides per lesson
            lessons_with_counts = []
            for l in lessons:
                cur.execute("SELECT COUNT(*) as cnt FROM lesson_slides WHERE lesson_id = %s", (l["id"],))
                slide_count = cur.fetchone()["cnt"]
                # Fetch quiz for this lesson
                cur.execute("SELECT id FROM quizzes WHERE lesson_id = %s LIMIT 1", (l["id"],))
                quiz_row = cur.fetchone()
                quiz_question_count = 0
                quiz_id = None
                if quiz_row:
                    quiz_id = quiz_row["id"]
                    cur.execute("SELECT COUNT(*) as cnt FROM questions WHERE quiz_id = %s", (quiz_id,))
                    quiz_question_count = cur.fetchone()["cnt"]
                lessons_with_counts.append({
                    **dict(l),
                    "slide_count": slide_count,
                    "quiz_id": quiz_id,
                    "quiz_question_count": quiz_question_count,
                })
            result.append({
                **dict(g),
                "lessons": lessons_with_counts
            })
        cur.close()
        conn.close()
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/admin/lesson-group/{group_id}")
def delete_lesson_group(group_id: int):
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute("DELETE FROM lesson_groups WHERE id = %s", (group_id,))
        conn.commit()
        cur.close()
        conn.close()
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/admin/lesson/create")
def create_lesson(req: LessonCreateRequest):
    if not req.title.strip() or not req.topic_id.strip():
        raise HTTPException(status_code=400, detail="Title and Topic ID are required.")
    if not req.slides:
        raise HTTPException(status_code=400, detail="At least one slide is required.")
    if req.difficulty not in ('easy', 'medium', 'hard'):
        raise HTTPException(status_code=400, detail="Difficulty must be easy, medium, or hard.")

    try:
        conn = get_db()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        # Insert lesson with difficulty + lesson_group_id
        cur.execute(
            "INSERT INTO lessons (topic_id, title, difficulty, lesson_group_id) VALUES (%s, %s, %s, %s) RETURNING id, topic_id, title, difficulty, lesson_group_id, created_at",
            (req.topic_id.strip(), req.title.strip(), req.difficulty, req.lesson_group_id),
        )
        lesson = dict(cur.fetchone())
        lesson_id = lesson["id"]

        # Insert slides
        inserted_slides = []
        for idx, slide in enumerate(req.slides):
            img_val = slide.image_url.strip() if slide.image_url else None
            cur.execute(
                "INSERT INTO lesson_slides (lesson_id, slide_index, description_text, image_url) VALUES (%s, %s, %s, %s) RETURNING slide_index, description_text, image_url",
                (lesson_id, idx, slide.description_text.strip(), img_val)
            )
            inserted_slides.append(dict(cur.fetchone()))

        conn.commit()
        cur.close()
        conn.close()

        return {
            "success": True,
            "lesson": {**lesson, "slides": inserted_slides}
        }
    except psycopg2.errors.UniqueViolation:
        raise HTTPException(status_code=409, detail=f"A {req.difficulty} lesson already exists for this lesson group.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/lessons/{topic_id}")
def get_lessons_by_topic(topic_id: str):
    """Returns all lessons for a topic, grouped by lesson_group_id."""
    try:
        conn = get_db()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        # Fetch lesson groups for this topic (ordered)
        cur.execute(
            "SELECT id, topic_id, title, order_index FROM lesson_groups WHERE topic_id = %s ORDER BY order_index ASC, id ASC",
            (topic_id,)
        )
        groups = cur.fetchall()

        result = []
        for g in groups:
            cur.execute(
                "SELECT id, topic_id, title, difficulty, lesson_group_id, created_at FROM lessons WHERE lesson_group_id = %s ORDER BY id ASC",
                (g["id"],)
            )
            lessons = cur.fetchall()
            group_lessons = []
            for l in lessons:
                cur.execute(
                    "SELECT slide_index, description_text, image_url FROM lesson_slides WHERE lesson_id = %s ORDER BY slide_index ASC",
                    (l["id"],)
                )
                slides = cur.fetchall()
                # Get quiz_id for this lesson
                cur.execute("SELECT id FROM quizzes WHERE lesson_id = %s LIMIT 1", (l["id"],))
                quiz_row = cur.fetchone()
                group_lessons.append({
                    **dict(l),
                    "slides": [dict(s) for s in slides],
                    "quiz_id": quiz_row["id"] if quiz_row else None,
                })
            result.append({
                **dict(g),
                "lessons": group_lessons
            })

        # Fallback: also return ungrouped lessons (lesson_group_id IS NULL) for backward compat
        cur.execute(
            "SELECT id, topic_id, title, difficulty, lesson_group_id, created_at FROM lessons WHERE topic_id = %s AND lesson_group_id IS NULL ORDER BY id ASC",
            (topic_id,)
        )
        ungrouped = cur.fetchall()
        for l in ungrouped:
            cur.execute(
                "SELECT slide_index, description_text, image_url FROM lesson_slides WHERE lesson_id = %s ORDER BY slide_index ASC",
                (l["id"],)
            )
            slides = cur.fetchall()
            cur.execute("SELECT id FROM quizzes WHERE lesson_id = %s LIMIT 1", (l["id"],))
            quiz_row = cur.fetchone()
            result.append({
                "id": l["id"],
                "topic_id": l["topic_id"],
                "title": l["title"],
                "order_index": 999,
                "lessons": [{
                    **dict(l),
                    "slides": [dict(s) for s in slides],
                    "quiz_id": quiz_row["id"] if quiz_row else None,
                }]
            })

        cur.close()
        conn.close()
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/admin/lesson/{lesson_id}")
def delete_lesson(lesson_id: int):
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute("DELETE FROM lessons WHERE id = %s", (lesson_id,))
        conn.commit()
        cur.close()
        conn.close()
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/admin/lesson/{lesson_id}/slides")
def get_lesson_slides(lesson_id: int):
    try:
        conn = get_db()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(
            "SELECT slide_index, description_text, image_url FROM lesson_slides WHERE lesson_id = %s ORDER BY slide_index ASC",
            (lesson_id,)
        )
        slides = cur.fetchall()
        cur.close()
        conn.close()
        return [dict(s) for s in slides]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/admin/lesson/{lesson_id}/slides")
def update_lesson_slides(lesson_id: int, req: UpdateLessonSlidesRequest):
    if not req.slides:
        raise HTTPException(status_code=400, detail="At least one slide is required.")
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute("DELETE FROM lesson_slides WHERE lesson_id = %s", (lesson_id,))
        for idx, slide in enumerate(req.slides):
            img_val = slide.image_url.strip() if slide.image_url else None
            cur.execute(
                "INSERT INTO lesson_slides (lesson_id, slide_index, description_text, image_url) VALUES (%s, %s, %s, %s)",
                (lesson_id, idx, slide.description_text.strip(), img_val)
            )
        conn.commit()
        cur.close()
        conn.close()
        return {"success": True, "message": "Slides updated successfully."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/admin/upload")
def upload_image(file: UploadFile = File(...)):
    ext = os.path.splitext(file.filename)[1]
    unique_filename = f"{uuid.uuid4()}{ext}"
    file_path = os.path.join(UPLOAD_DIR, unique_filename)
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        url = f"http://10.0.28.67:8000/static/{unique_filename}"
        return {"success": True, "url": url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")


# ══════════════════════════════════════════════════════════════════════════════
# ── Admin Quiz endpoints (updated with difficulty) ────────────────────────────
# ══════════════════════════════════════════════════════════════════════════════

@app.post("/admin/quiz/create")
def create_quiz(req: QuizCreateRequest):
    if not req.title.strip() or not req.topic_id.strip():
        raise HTTPException(status_code=400, detail="Title and Topic ID are required.")
    if not req.questions:
        raise HTTPException(status_code=400, detail="At least one question is required.")

    try:
        conn = get_db()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        # Insert quiz with difficulty
        cur.execute(
            "INSERT INTO quizzes (title, topic_id, lesson_id, difficulty) VALUES (%s, %s, %s, %s) RETURNING id",
            (req.title.strip(), req.topic_id.strip(), req.lesson_id, req.difficulty)
        )
        quiz_id = cur.fetchone()["id"]

        # Insert questions and options
        for q in req.questions:
            correct_letter = 'A'
            if q.question_type != 'matching' and q.correct_option_index is not None:
                correct_letter = chr(65 + q.correct_option_index)

            img_val = q.image_url.strip() if q.image_url else None
            kc_val = q.knowledge_component.strip() if q.knowledge_component else None
            cur.execute(
                "INSERT INTO questions (quiz_id, question_text, correct_option_letter, question_type, image_url, knowledge_component) VALUES (%s, %s, %s, %s, %s, %s) RETURNING id",
                (quiz_id, q.question_text.strip(), correct_letter, q.question_type, img_val, kc_val)
            )
            question_id = cur.fetchone()["id"]

            if q.question_type == 'matching':
                if q.matching_pairs:
                    for pair in q.matching_pairs:
                        cur.execute(
                            "INSERT INTO question_matches (question_id, left_item, right_item) VALUES (%s, %s, %s)",
                            (question_id, pair.left.strip(), pair.right.strip())
                        )
            else:
                if q.options:
                    for idx, opt_text in enumerate(q.options):
                        opt_letter = chr(65 + idx)
                        cur.execute(
                            "INSERT INTO question_options (question_id, option_letter, option_text) VALUES (%s, %s, %s)",
                            (question_id, opt_letter, opt_text.strip())
                        )

        conn.commit()
        cur.close()
        conn.close()
        return {"success": True, "quiz_id": quiz_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def _fetch_full_quiz(cur, quiz_id: int):
    """Helper: fetch quiz + all questions with options/matches."""
    cur.execute("SELECT id, title, topic_id, lesson_id, difficulty FROM quizzes WHERE id = %s", (quiz_id,))
    quiz = cur.fetchone()
    if not quiz:
        return None

    cur.execute(
        "SELECT id, question_text, correct_option_letter, question_type, image_url FROM questions WHERE quiz_id = %s ORDER BY id ASC",
        (quiz["id"],)
    )
    questions = cur.fetchall()

    quiz_questions = []
    for q in questions:
        q_type = q["question_type"]
        options_list = []
        correct_idx = 0
        matching_pairs_list = []

        if q_type == 'matching':
            cur.execute(
                "SELECT left_item, right_item FROM question_matches WHERE question_id = %s ORDER BY id ASC",
                (q["id"],)
            )
            matches = cur.fetchall()
            matching_pairs_list = [dict(m) for m in matches]
        else:
            cur.execute(
                "SELECT option_letter, option_text FROM question_options WHERE question_id = %s ORDER BY option_letter ASC",
                (q["id"],)
            )
            opts = cur.fetchall()
            options_list = [o["option_text"] for o in opts]
            correct_idx = ord(q["correct_option_letter"]) - 65

        quiz_questions.append({
            "id": q["id"],
            "question_text": q["question_text"],
            "question_type": q_type,
            "image_url": q["image_url"],
            "options": options_list,
            "correct_option_index": correct_idx,
            "matching_pairs": matching_pairs_list
        })

    return {
        "id": quiz["id"],
        "title": quiz["title"],
        "topic_id": quiz["topic_id"],
        "lesson_id": quiz["lesson_id"],
        "difficulty": quiz["difficulty"],
        "questions": quiz_questions
    }


@app.get("/quizzes/{topic_id}")
def get_quizzes_by_topic(topic_id: str):
    try:
        conn = get_db()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("SELECT id FROM quizzes WHERE topic_id = %s ORDER BY id DESC", (topic_id,))
        quiz_rows = cur.fetchall()
        result = [_fetch_full_quiz(cur, r["id"]) for r in quiz_rows if r]
        cur.close()
        conn.close()
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/quizzes/lesson/{lesson_id}")
def get_quiz_by_lesson(lesson_id: int):
    try:
        conn = get_db()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("SELECT id FROM quizzes WHERE lesson_id = %s ORDER BY id DESC LIMIT 1", (lesson_id,))
        row = cur.fetchone()
        if not row:
            cur.close()
            conn.close()
            return None
        result = _fetch_full_quiz(cur, row["id"])
        cur.close()
        conn.close()
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ══════════════════════════════════════════════════════════════════════════════
# ── Milestone 3: Quiz Session endpoints ───────────────────────────────────────
# ══════════════════════════════════════════════════════════════════════════════

def _get_pass_threshold(cur, topic_id: str) -> float:
    """Fetch admin-configured pass threshold for a topic (default 70%)."""
    cur.execute("SELECT pass_threshold FROM topic_settings WHERE topic_id = %s", (topic_id,))
    row = cur.fetchone()
    return row["pass_threshold"] if row else 70.0


def _get_or_create_lesson_progress(cur, user_id: int, lesson_group_id: int) -> dict:
    """Fetch or create student_lesson_progress row."""
    cur.execute(
        "SELECT * FROM student_lesson_progress WHERE user_id = %s AND lesson_group_id = %s",
        (user_id, lesson_group_id)
    )
    row = cur.fetchone()
    if row:
        return dict(row)
    # Create fresh progress row
    cur.execute(
        """INSERT INTO student_lesson_progress (user_id, lesson_group_id)
           VALUES (%s, %s)
           ON CONFLICT (user_id, lesson_group_id) DO NOTHING
           RETURNING *""",
        (user_id, lesson_group_id)
    )
    new_row = cur.fetchone()
    if new_row:
        return dict(new_row)
    # If insert raced, fetch again
    cur.execute(
        "SELECT * FROM student_lesson_progress WHERE user_id = %s AND lesson_group_id = %s",
        (user_id, lesson_group_id)
    )
    return dict(cur.fetchone())


@app.get("/quiz/session/{quiz_id}")
def start_quiz_session(quiz_id: int, user_id: int):
    """
    Milestone 3: Start a quiz session.
    - Checks sequential lesson lock (previous lesson's Easy must be passed)
    - Checks difficulty lock (Easy must be passed to unlock Medium, etc.)
    - Returns a fresh random set of up to 10 questions every call (including retries)
    - Creates a student_quiz_attempts record
    """
    try:
        conn = get_db()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        # Fetch quiz info
        cur.execute(
            "SELECT q.id, q.lesson_id, q.difficulty, q.topic_id, l.lesson_group_id FROM quizzes q LEFT JOIN lessons l ON q.lesson_id = l.id WHERE q.id = %s",
            (quiz_id,)
        )
        quiz = cur.fetchone()
        if not quiz:
            raise HTTPException(status_code=404, detail="Quiz not found.")

        lesson_group_id = quiz["lesson_group_id"]
        difficulty = quiz["difficulty"] or "easy"
        topic_id = quiz["topic_id"]

        # ── Sequential lesson lock check ──────────────────────────────────────
        if lesson_group_id:
            cur.execute(
                "SELECT id, order_index FROM lesson_groups WHERE id = %s",
                (lesson_group_id,)
            )
            current_group = cur.fetchone()
            if current_group and current_group["order_index"] > 0:
                cur.execute(
                    "SELECT id FROM lesson_groups WHERE topic_id = %s AND order_index = %s",
                    (topic_id, current_group["order_index"] - 1)
                )
                prev_group = cur.fetchone()
                if prev_group:
                    cur.execute(
                        "SELECT easy_passed FROM student_lesson_progress WHERE user_id = %s AND lesson_group_id = %s",
                        (user_id, prev_group["id"])
                    )
                    prev_progress = cur.fetchone()
                    if not prev_progress or not prev_progress["easy_passed"]:
                        raise HTTPException(
                            status_code=403,
                            detail="Complete the previous lesson's Easy quiz first to unlock this lesson."
                        )

        # ── Difficulty lock check ─────────────────────────────────────────────
        if lesson_group_id:
            progress = _get_or_create_lesson_progress(cur, user_id, lesson_group_id)
            if difficulty == 'medium' and not progress["easy_passed"]:
                raise HTTPException(status_code=403, detail="Complete the Easy quiz with 70%+ to unlock Medium.")
            if difficulty == 'hard' and not progress["medium_passed"]:
                raise HTTPException(status_code=403, detail="Complete the Medium quiz with 70%+ to unlock Hard.")

        # ── Fetch all questions for this quiz ─────────────────────────────────
        cur.execute(
            "SELECT id, question_text, correct_option_letter, question_type, image_url, knowledge_component FROM questions WHERE quiz_id = %s ORDER BY id ASC",
            (quiz_id,)
        )
        all_questions = cur.fetchall()

        if not all_questions:
            raise HTTPException(status_code=404, detail="No questions found for this quiz.")

        # ── Phase 2: Adaptive selection via BKT (falls back to random if no KC tags) ──
        all_q_dicts = [dict(q) for q in all_questions]
        selected_count = min(10, len(all_q_dicts))
        selected_questions = _adaptive_question_selection(cur, user_id, all_q_dicts, selected_count)
        selected_ids = [q["id"] for q in selected_questions]

        # Build full question objects
        result_questions = []
        for q in selected_questions:
            q_type = q["question_type"]
            options_list = []
            correct_idx = 0
            matching_pairs_list = []

            if q_type == 'matching':
                cur.execute(
                    "SELECT left_item, right_item FROM question_matches WHERE question_id = %s ORDER BY id ASC",
                    (q["id"],)
                )
                matches = cur.fetchall()
                matching_pairs_list = [dict(m) for m in matches]
            else:
                cur.execute(
                    "SELECT option_letter, option_text FROM question_options WHERE question_id = %s ORDER BY option_letter ASC",
                    (q["id"],)
                )
                opts = cur.fetchall()
                options_list = [o["option_text"] for o in opts]
                correct_idx = ord(q["correct_option_letter"]) - 65

            result_questions.append({
                "id": q["id"],
                "question_text": q["question_text"],
                "question_type": q_type,
                "image_url": q["image_url"],
                "knowledge_component": q.get("knowledge_component"),
                "options": options_list,
                "correct_option_index": correct_idx,
                "matching_pairs": matching_pairs_list,
            })

        # ── Create attempt record ─────────────────────────────────────────────
        cur.execute(
            """INSERT INTO student_quiz_attempts
               (user_id, quiz_id, question_ids, total_questions, difficulty)
               VALUES (%s, %s, %s, %s, %s)
               RETURNING id""",
            (user_id, quiz_id, selected_ids, selected_count, difficulty)
        )
        attempt_id = cur.fetchone()["id"]

        # Update attempt count on lesson progress
        if lesson_group_id:
            cur.execute(
                """UPDATE student_lesson_progress
                   SET attempts_count = attempts_count + 1, last_updated = NOW()
                   WHERE user_id = %s AND lesson_group_id = %s""",
                (user_id, lesson_group_id)
            )

        conn.commit()
        cur.close()
        conn.close()

        return {
            "attempt_id": attempt_id,
            "quiz_id": quiz_id,
            "difficulty": difficulty,
            "questions": result_questions,
            "total": selected_count,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/quiz/session/{attempt_id}/complete")
def complete_quiz_session(attempt_id: int, body: QuizCompleteRequest):
    """
    Milestone 3: Submit quiz results.
    - Saves all per-question answers
    - Updates student_lesson_progress (best score, passed flags)
    - Updates student_profiles (overall stats, total stars)
    - Returns: accuracy, passed, what was unlocked
    """
    try:
        conn = get_db()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        # Fetch attempt
        cur.execute(
            "SELECT * FROM student_quiz_attempts WHERE id = %s",
            (attempt_id,)
        )
        attempt = cur.fetchone()
        if not attempt:
            raise HTTPException(status_code=404, detail="Attempt not found.")

        user_id = attempt["user_id"]
        quiz_id = attempt["quiz_id"]
        difficulty = attempt["difficulty"] or "easy"

        # Fetch quiz + lesson info
        cur.execute(
            "SELECT q.topic_id, l.lesson_group_id FROM quizzes q LEFT JOIN lessons l ON q.lesson_id = l.id WHERE q.id = %s",
            (quiz_id,)
        )
        quiz_info = cur.fetchone()
        topic_id = quiz_info["topic_id"] if quiz_info else None
        lesson_group_id = quiz_info["lesson_group_id"] if quiz_info else None

        # Get pass threshold
        threshold = _get_pass_threshold(cur, topic_id) if topic_id else 70.0

        # Calculate accuracy
        total = body.total_questions or 1
        accuracy_pct = round((body.score / total) * 100, 2)
        passed = accuracy_pct >= threshold

        # Mark attempt as completed
        cur.execute(
            """UPDATE student_quiz_attempts
               SET completed_at = NOW(), score = %s, total_questions = %s, time_spent_seconds = %s
               WHERE id = %s""",
            (body.score, total, body.time_spent_seconds, attempt_id)
        )

        # Save per-question answers + update KC mastery via BKT
        for ans in body.answers:
            cur.execute(
                """INSERT INTO student_question_answers (attempt_id, question_id, is_correct, time_spent_seconds)
                   VALUES (%s, %s, %s, %s)""",
                (attempt_id, ans.question_id, ans.is_correct, ans.time_spent_seconds)
            )
            # Phase 2 — Student Model: update KC mastery for this answer
            cur.execute(
                "SELECT knowledge_component FROM questions WHERE id = %s",
                (ans.question_id,)
            )
            q_row = cur.fetchone()
            if q_row and q_row["knowledge_component"]:
                _upsert_kc_mastery(cur, user_id, q_row["knowledge_component"], ans.is_correct)

        # ── Update lesson progress ────────────────────────────────────────────
        unlocked_medium = False
        unlocked_hard = False
        unlocked_next_lesson = False

        if lesson_group_id:
            progress = _get_or_create_lesson_progress(cur, user_id, lesson_group_id)

            if difficulty == 'easy':
                new_best = max(progress["easy_best_score"], accuracy_pct)
                easy_passed_now = progress["easy_passed"] or passed
                unlocked_medium = passed and not progress["easy_passed"]
                unlocked_next_lesson = passed and not progress["easy_passed"]
                cur.execute(
                    """UPDATE student_lesson_progress
                       SET easy_best_score = %s, easy_passed = %s, last_updated = NOW()
                       WHERE user_id = %s AND lesson_group_id = %s""",
                    (new_best, easy_passed_now, user_id, lesson_group_id)
                )
            elif difficulty == 'medium':
                new_best = max(progress["medium_best_score"], accuracy_pct)
                medium_passed_now = progress["medium_passed"] or passed
                unlocked_hard = passed and not progress["medium_passed"]
                cur.execute(
                    """UPDATE student_lesson_progress
                       SET medium_best_score = %s, medium_passed = %s, last_updated = NOW()
                       WHERE user_id = %s AND lesson_group_id = %s""",
                    (new_best, medium_passed_now, user_id, lesson_group_id)
                )
            elif difficulty == 'hard':
                new_best = max(progress["hard_best_score"], accuracy_pct)
                hard_passed_now = progress["hard_passed"] or passed
                cur.execute(
                    """UPDATE student_lesson_progress
                       SET hard_best_score = %s, hard_passed = %s, last_updated = NOW()
                       WHERE user_id = %s AND lesson_group_id = %s""",
                    (new_best, hard_passed_now, user_id, lesson_group_id)
                )

        # ── Update topic-level student profile ────────────────────────────────
        # Phase 3: difficulty-based star reward (only awarded on pass)
        STAR_REWARDS = {"easy": 10, "medium": 20, "hard": 30}
        stars_earned = STAR_REWARDS.get(difficulty, 10) if passed else 0

        if topic_id:
            cur.execute(
                "SELECT * FROM student_profiles WHERE user_id = %s AND topic_id = %s",
                (user_id, topic_id)
            )
            profile = cur.fetchone()
            if profile:
                new_avg = round(
                    (profile["avg_accuracy"] * profile["quizzes_completed"] + accuracy_pct)
                    / (profile["quizzes_completed"] + 1), 2
                )
                avg_time = round(
                    (profile["avg_time_seconds"] * profile["quizzes_completed"] + (body.time_spent_seconds / total))
                    / (profile["quizzes_completed"] + 1), 2
                ) if total > 0 else profile["avg_time_seconds"]
                cur.execute(
                    """UPDATE student_profiles
                       SET avg_accuracy = %s, avg_time_seconds = %s,
                           quizzes_completed = quizzes_completed + 1,
                           total_stars = total_stars + %s,
                           knowledge_level = %s, last_updated = NOW()
                       WHERE user_id = %s AND topic_id = %s""",
                    (new_avg, avg_time, stars_earned, difficulty, user_id, topic_id)
                )
            else:
                avg_time = round(body.time_spent_seconds / total, 2) if total > 0 else 0
                cur.execute(
                    """INSERT INTO student_profiles
                       (user_id, topic_id, avg_accuracy, avg_time_seconds, quizzes_completed, total_stars, knowledge_level)
                       VALUES (%s, %s, %s, %s, 1, %s, %s)
                       ON CONFLICT (user_id, topic_id) DO NOTHING""",
                    (user_id, topic_id, accuracy_pct, avg_time, stars_earned, difficulty)
                )

        # Phase 3: update streak on every quiz completion
        _update_student_streak(cur, user_id)

        conn.commit()
        cur.close()
        conn.close()

        return {
            "success": True,
            "score": body.score,
            "total": total,
            "accuracy_pct": accuracy_pct,
            "passed": passed,
            "stars_earned": stars_earned,
            "unlocked_medium": unlocked_medium,
            "unlocked_hard": unlocked_hard,
            "unlocked_next_lesson": unlocked_next_lesson,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/student/{user_id}/profile/{topic_id}")
def get_student_profile(user_id: int, topic_id: str):
    """Returns student's unlock state across all lesson groups for a topic."""
    try:
        conn = get_db()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        # Get all lesson groups for topic
        cur.execute(
            "SELECT id, title, order_index FROM lesson_groups WHERE topic_id = %s ORDER BY order_index ASC, id ASC",
            (topic_id,)
        )
        groups = cur.fetchall()

        lesson_progress = []
        for g in groups:
            cur.execute(
                "SELECT * FROM student_lesson_progress WHERE user_id = %s AND lesson_group_id = %s",
                (user_id, g["id"])
            )
            prog = cur.fetchone()
            lesson_progress.append({
                "lesson_group_id": g["id"],
                "title": g["title"],
                "order_index": g["order_index"],
                "easy_passed": prog["easy_passed"] if prog else False,
                "medium_passed": prog["medium_passed"] if prog else False,
                "hard_passed": prog["hard_passed"] if prog else False,
                "easy_best_score": prog["easy_best_score"] if prog else 0.0,
                "medium_best_score": prog["medium_best_score"] if prog else 0.0,
                "hard_best_score": prog["hard_best_score"] if prog else 0.0,
                "attempts_count": prog["attempts_count"] if prog else 0,
            })

        # Overall topic profile
        cur.execute(
            "SELECT * FROM student_profiles WHERE user_id = %s AND topic_id = %s",
            (user_id, topic_id)
        )
        profile = cur.fetchone()

        cur.close()
        conn.close()

        return {
            "user_id": user_id,
            "topic_id": topic_id,
            "overall": dict(profile) if profile else None,
            "lesson_progress": lesson_progress,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/student/{user_id}/report")
def get_student_report(user_id: int):
    """Returns full student performance report with real data."""
    try:
        conn = get_db()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        # Overall stats across all topics
        cur.execute(
            """SELECT
                COALESCE(SUM(total_stars), 0) as total_stars,
                COALESCE(AVG(avg_accuracy), 0) as overall_accuracy,
                COALESCE(SUM(quizzes_completed), 0) as quizzes_completed
               FROM student_profiles WHERE user_id = %s""",
            (user_id,)
        )
        overall = cur.fetchone()

        # Total time from attempts
        cur.execute(
            "SELECT COALESCE(SUM(time_spent_seconds), 0) as total_time FROM student_quiz_attempts WHERE user_id = %s AND completed_at IS NOT NULL",
            (user_id,)
        )
        time_row = cur.fetchone()

        # Per-topic breakdown
        cur.execute(
            "SELECT * FROM student_profiles WHERE user_id = %s ORDER BY topic_id",
            (user_id,)
        )
        profiles = cur.fetchall()

        topic_breakdown = []
        weak_topics = []
        for p in profiles:
            topic_breakdown.append({
                "topic_id": p["topic_id"],
                "knowledge_level": p["knowledge_level"],
                "avg_accuracy": round(p["avg_accuracy"], 1),
                "quizzes_done": p["quizzes_completed"],
                "total_stars": p["total_stars"],
            })
            if p["avg_accuracy"] < 70.0 and p["quizzes_completed"] > 0:
                weak_topics.append({
                    "topic_id": p["topic_id"],
                    "accuracy": round(p["avg_accuracy"], 1),
                    "level": p["knowledge_level"],
                })

        # Recent attempts (last 10)
        cur.execute(
            """SELECT a.id, a.score, a.total_questions, a.difficulty, a.time_spent_seconds,
                      a.completed_at, q.title as quiz_title
               FROM student_quiz_attempts a
               LEFT JOIN quizzes q ON a.quiz_id = q.id
               WHERE a.user_id = %s AND a.completed_at IS NOT NULL
               ORDER BY a.completed_at DESC LIMIT 10""",
            (user_id,)
        )
        recent = cur.fetchall()
        recent_attempts = []
        for r in recent:
            recent_attempts.append({
                "quiz_title": r["quiz_title"] or "Quiz",
                "score": r["score"],
                "total": r["total_questions"],
                "difficulty": r["difficulty"],
                "accuracy": round((r["score"] / r["total_questions"]) * 100, 1) if r["total_questions"] else 0,
                "time_spent_seconds": r["time_spent_seconds"],
                "completed_at": r["completed_at"].isoformat() if r["completed_at"] else None,
            })

        cur.close()
        conn.close()

        return {
            "user_id": user_id,
            "total_stars": int(overall["total_stars"]),
            "overall_accuracy": round(float(overall["overall_accuracy"]), 1),
            "total_time_spent_seconds": int(time_row["total_time"]),
            "quizzes_completed": int(overall["quizzes_completed"]),
            "topic_breakdown": topic_breakdown,
            "weak_topics": weak_topics,
            "recent_attempts": recent_attempts,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/student/{user_id}/past-attempts")
def get_past_attempts(user_id: int):
    """Returns historical list of all completed quiz attempts with details."""
    try:
        conn = get_db()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        cur.execute(
            """SELECT a.id, a.quiz_id, a.score, a.total_questions, a.difficulty, a.time_spent_seconds,
                      a.completed_at, q.title as quiz_title, q.topic_id
               FROM student_quiz_attempts a
               LEFT JOIN quizzes q ON a.quiz_id = q.id
               WHERE a.user_id = %s AND a.completed_at IS NOT NULL
               ORDER BY a.completed_at DESC""",
            (user_id,)
        )
        rows = cur.fetchall()

        attempts = []
        for r in rows:
            total_q = r["total_questions"] or 1
            accuracy = round((r["score"] / total_q) * 100, 1)
            attempts.append({
                "id": r["id"],
                "quiz_id": r["quiz_id"],
                "quiz_title": r["quiz_title"] or "Quiz",
                "topic_id": r["topic_id"] or "general",
                "difficulty": r["difficulty"] or "easy",
                "score": r["score"],
                "total_questions": total_q,
                "accuracy": accuracy,
                "time_spent_seconds": r["time_spent_seconds"] or 0,
                "completed_at": r["completed_at"].strftime("%b %d, %Y, %I:%M %p") if r["completed_at"] else "Unknown date",
            })

        cur.close()
        conn.close()
        return {"user_id": user_id, "attempts": attempts}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/student/{user_id}/home-summary")
def get_home_summary(user_id: int):
    """Returns summarized stats and topic progresses for home screen."""
    try:
        conn = get_db()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        # 1. Total Stars
        total_stars = _get_total_stars(cur, user_id)

        # 2. Streak
        cur.execute("SELECT * FROM student_streaks WHERE user_id = %s", (user_id,))
        streak_row = cur.fetchone()
        today = date.today()
        current_streak = streak_row["current_streak"] if streak_row else 0
        longest_streak = streak_row["longest_streak"] if streak_row else 0
        active_today = bool(streak_row and streak_row["last_activity_date"] == today)

        # 3. Topic progress
        cur.execute("SELECT * FROM student_profiles WHERE user_id = %s", (user_id,))
        profiles = cur.fetchall()
        topic_map = {}
        for p in profiles:
            topic_map[p["topic_id"]] = {
                "stars": p["total_stars"],
                "accuracy": round(p["avg_accuracy"], 1),
                "quizzes_completed": p["quizzes_completed"]
            }

        cur.close()
        conn.close()

        return {
            "user_id": user_id,
            "total_stars": total_stars,
            "current_streak": current_streak,
            "longest_streak": longest_streak,
            "active_today": active_today,
            "topics": topic_map
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



# ══════════════════════════════════════════════════════════════════════════════
# ── Phase 2: Knowledge Component (KC) Management ─────────────────────────────
# ══════════════════════════════════════════════════════════════════════════════

@app.post("/admin/kc/create")
def create_kc(req: KCCreateRequest):
    """Admin creates a Knowledge Component with BKT parameters."""
    if not req.name.strip() or not req.display_name.strip():
        raise HTTPException(status_code=400, detail="Name and display name are required.")
    try:
        conn = get_db()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(
            """INSERT INTO knowledge_components (topic_id, name, display_name, prior, learns, guesses, slips)
               VALUES (%s, %s, %s, %s, %s, %s, %s)
               ON CONFLICT (name) DO UPDATE SET
                   display_name = EXCLUDED.display_name,
                   topic_id = EXCLUDED.topic_id,
                   prior = EXCLUDED.prior,
                   learns = EXCLUDED.learns,
                   guesses = EXCLUDED.guesses,
                   slips = EXCLUDED.slips
               RETURNING *""",
            (req.topic_id, req.name.strip().lower().replace(" ", "_"),
             req.display_name.strip(), req.prior, req.learns, req.guesses, req.slips)
        )
        kc = dict(cur.fetchone())
        conn.commit()
        cur.close()
        conn.close()
        return {"success": True, "kc": kc}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/admin/kcs/{topic_id}")
def get_kcs(topic_id: str):
    """Returns all KCs for a topic."""
    try:
        conn = get_db()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(
            "SELECT * FROM knowledge_components WHERE topic_id = %s ORDER BY name ASC",
            (topic_id,)
        )
        kcs = [dict(k) for k in cur.fetchall()]
        cur.close()
        conn.close()
        return kcs
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/admin/kcs")
def get_all_kcs():
    """Returns all KCs (all topics)."""
    try:
        conn = get_db()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("SELECT * FROM knowledge_components ORDER BY topic_id, name ASC")
        kcs = [dict(k) for k in cur.fetchall()]
        cur.close()
        conn.close()
        return kcs
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/admin/kc/{kc_name}")
def delete_kc(kc_name: str):
    """Deletes a KC (and all student mastery records for it)."""
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute("DELETE FROM student_kc_mastery WHERE kc_name = %s", (kc_name,))
        cur.execute("DELETE FROM knowledge_components WHERE name = %s", (kc_name,))
        conn.commit()
        cur.close()
        conn.close()
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/student/{user_id}/kc-mastery")
def get_student_kc_mastery(user_id: int, topic_id: Optional[str] = None):
    """
    Phase 2 — Interface Model: Returns all KC mastery levels for a student.
    Used by the Skill Tree screen. Shows P(mastery) for every KC the student
    has ever encountered, plus all registered KCs that the student hasn't tried yet
    (shown at their prior value).
    """
    try:
        conn = get_db()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        # Fetch all registered KCs (optionally filtered by topic)
        if topic_id:
            cur.execute(
                "SELECT * FROM knowledge_components WHERE topic_id = %s ORDER BY name ASC",
                (topic_id,)
            )
        else:
            cur.execute("SELECT * FROM knowledge_components ORDER BY topic_id, name ASC")
        all_kcs = cur.fetchall()

        # Fetch all student mastery records
        cur.execute(
            "SELECT kc_name, p_mastery, correct_count, wrong_count, total_opportunities FROM student_kc_mastery WHERE user_id = %s",
            (user_id,)
        )
        mastery_rows = {r["kc_name"]: dict(r) for r in cur.fetchall()}

        result = []
        for kc in all_kcs:
            student_data = mastery_rows.get(kc["name"])
            p_mastery = student_data["p_mastery"] if student_data else kc["prior"]
            total_opp = student_data["total_opportunities"] if student_data else 0
            correct = student_data["correct_count"] if student_data else 0
            wrong = student_data["wrong_count"] if student_data else 0

            # Mastery label for UI display
            if total_opp == 0:
                status = "not_started"
            elif p_mastery >= 0.70:
                status = "mastered"
            elif p_mastery >= 0.30:
                status = "learning"
            else:
                status = "struggling"

            result.append({
                "kc_name": kc["name"],
                "display_name": kc["display_name"],
                "topic_id": kc["topic_id"],
                "p_mastery": p_mastery,
                "p_mastery_pct": round(p_mastery * 100, 1),
                "status": status,
                "total_opportunities": total_opp,
                "correct_count": correct,
                "wrong_count": wrong,
                # BKT params (useful for debugging / admin view)
                "prior": kc["prior"],
                "learns": kc["learns"],
            })

        cur.close()
        conn.close()
        return {
            "user_id": user_id,
            "topic_id": topic_id,
            "kc_mastery": result,
            "total_kcs": len(result),
            "mastered": sum(1 for r in result if r["status"] == "mastered"),
            "learning": sum(1 for r in result if r["status"] == "learning"),
            "struggling": sum(1 for r in result if r["status"] == "struggling"),
            "not_started": sum(1 for r in result if r["status"] == "not_started"),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─────────────────────────────────────────────────────────────────────────────
# ── Phase 2c: pyBKT Model Fitting Endpoint ──────────────────────────────────
# ─────────────────────────────────────────────────────────────────────────────

@app.post("/admin/fit-bkt-model")
def fit_bkt_model(topic_id: Optional[str] = None):
    """
    Phase 2c — Uses the real pyBKT library to refit BKT parameters from actual student data.
    Reads all KC-tagged student answers -> runs pyBKT EM algorithm -> updates knowledge_components table.
    Should be run after collecting enough student answer data (recommended: 20+ answers per KC).
    """
    try:
        # Lazy import — so pyBKT does not slow down server startup
        from pyBKT.models import Model

        conn = get_db()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        # ── 1. Fetch all KC-tagged student answers from DB ──────────────────────
        base_query = """
            SELECT
                sqa2.user_id::text            AS user_id,
                q.knowledge_component         AS skill_name,
                CASE WHEN sqa.is_correct
                     THEN 1 ELSE 0 END        AS correct
            FROM student_question_answers sqa
            JOIN questions q            ON sqa.question_id = q.id
            JOIN student_quiz_attempts sqa2 ON sqa.attempt_id = sqa2.id
            WHERE q.knowledge_component IS NOT NULL
        """
        if topic_id:
            base_query += """
                AND q.quiz_id IN (
                    SELECT id FROM quizzes WHERE topic_id = %(topic_id)s
                )
            """
            cur.execute(base_query, {"topic_id": topic_id})
        else:
            cur.execute(base_query)

        rows = cur.fetchall()

        if len(rows) < 5:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Not enough data. Found only {len(rows)} KC-tagged answers. "
                    "Need at least 5 (ideally 20+ per KC) for meaningful fitting."
                )
            )

        # ── 2. Build pandas DataFrame in pyBKT format ────────────────────────
        df = pd.DataFrame([
            {
                "user_id":    r["user_id"],
                "skill_name": r["skill_name"],
                "correct":    int(r["correct"]),
            }
            for r in rows
        ])

        # Only fit KCs that have at least 3 answers (pyBKT needs minimum data)
        kc_counts = df.groupby("skill_name").size()
        valid_kcs = kc_counts[kc_counts >= 3].index.tolist()

        if not valid_kcs:
            raise HTTPException(
                status_code=400,
                detail="Each KC needs at least 3 student answers to fit. Collect more data first."
            )

        df = df[df["skill_name"].isin(valid_kcs)].reset_index(drop=True)

        # ── 3. Run pyBKT EM fitting ───────────────────────────────────────
        bkt_model = Model(seed=42, num_fits=5)
        bkt_model.fit(data=df)

        # ── 4. Extract fitted parameters from pyBKT ─────────────────────────
        coef = bkt_model.coef_

        updated = []
        skipped = []

        for kc_name in valid_kcs:
            try:
                kc_params = coef.get(kc_name, {})
                prior   = float(kc_params.get("prior",   0.10))
                learns  = float(kc_params.get("learns",  0.20))
                guesses_raw = kc_params.get("guesses", [0.25])
                slips_raw   = kc_params.get("slips",   [0.10])
                guesses = float(guesses_raw[0]) if isinstance(guesses_raw, (list, tuple)) else float(guesses_raw)
                slips   = float(slips_raw[0])   if isinstance(slips_raw,   (list, tuple)) else float(slips_raw)

                # Clamp to valid BKT ranges
                prior   = round(min(0.95, max(0.01, prior)),   4)
                learns  = round(min(0.99, max(0.01, learns)),  4)
                guesses = round(min(0.49, max(0.01, guesses)), 4)
                slips   = round(min(0.49, max(0.01, slips)),   4)

                cur.execute(
                    """UPDATE knowledge_components
                       SET prior = %s, learns = %s, guesses = %s, slips = %s
                       WHERE name = %s""",
                    (prior, learns, guesses, slips, kc_name)
                )
                updated.append({
                    "kc_name": kc_name,
                    "prior":   prior,
                    "learns":  learns,
                    "guesses": guesses,
                    "slips":   slips,
                    "answers_used": int(kc_counts[kc_name]),
                })
            except Exception as ex:
                skipped.append({"kc_name": kc_name, "reason": str(ex)})

        conn.commit()
        cur.close()
        conn.close()

        return {
            "success":            True,
            "message":            f"pyBKT model fitted. {len(updated)} KC(s) updated, {len(skipped)} skipped.",
            "total_answers_used": len(rows),
            "updated_kcs":        updated,
            "skipped_kcs":        skipped,
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"pyBKT fitting failed: {str(e)}")


# ══════════════════════════════════════════════════════════════════════════════
# ── Phase 3: Streak Endpoints ─────────────────────────────────────────────────
# ══════════════════════════════════════════════════════════════════════════════

@app.get("/student/{user_id}/streak")
def get_streak(user_id: int):
    """Returns current streak, longest streak, repair eligibility and total stars."""
    try:
        conn = get_db()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("SELECT * FROM student_streaks WHERE user_id = %s", (user_id,))
        row = cur.fetchone()
        total_stars = _get_total_stars(cur, user_id)
        cur.close()
        conn.close()
        today = date.today()
        if not row:
            return {
                "user_id": user_id, "current_streak": 0, "longest_streak": 0,
                "last_activity_date": None, "can_repair": False,
                "repair_cost": 30, "pre_break_streak": 0, "total_stars": total_stars,
                "active_today": False,
            }
        can_repair = (row["pre_break_streak"] > 0 and row["current_streak"] <= 1 and total_stars >= 30)
        active_today = row["last_activity_date"] == today
        return {
            "user_id": user_id, "current_streak": row["current_streak"],
            "longest_streak": row["longest_streak"],
            "last_activity_date": str(row["last_activity_date"]) if row["last_activity_date"] else None,
            "pre_break_streak": row["pre_break_streak"],
            "can_repair": can_repair, "repair_cost": 30,
            "total_stars": total_stars, "active_today": active_today,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/student/{user_id}/repair-streak")
def repair_streak(user_id: int):
    """Spends 30 stars to restore the student's pre-break streak."""
    try:
        conn = get_db()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("SELECT * FROM student_streaks WHERE user_id = %s", (user_id,))
        row = cur.fetchone()
        if not row or row["pre_break_streak"] == 0:
            raise HTTPException(status_code=400, detail="No streak to repair.")
        total_stars = _get_total_stars(cur, user_id)
        if total_stars < 30:
            raise HTTPException(status_code=400, detail="Not enough stars. Need 30 stars to repair streak.")
        _deduct_stars(cur, user_id, 30)
        restored = row["pre_break_streak"]
        cur.execute(
            "UPDATE student_streaks SET current_streak = %s, pre_break_streak = 0, updated_at = NOW() WHERE user_id = %s",
            (restored, user_id)
        )
        conn.commit()
        cur.close()
        conn.close()
        return {"success": True, "restored_streak": restored, "stars_spent": 30}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ══════════════════════════════════════════════════════════════════════════════
# ── Phase 3: Hint Endpoint ────────────────────────────────────────────────────
# ══════════════════════════════════════════════════════════════════════════════

class HintRequest(BaseModel):
    user_id: int
    question_id: int
    topic_id: Optional[str] = None

@app.post("/quiz/session/use-hint")
def use_hint(req: HintRequest):
    """Deducts 5 stars and returns a hint for the given question."""
    try:
        conn = get_db()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        total_stars = _get_total_stars(cur, req.user_id)
        if total_stars < 5:
            raise HTTPException(status_code=400, detail="Not enough stars. Need 5 stars to use a hint.")
        cur.execute(
            "SELECT question_text, correct_option_letter, question_type FROM questions WHERE id = %s",
            (req.question_id,)
        )
        q = cur.fetchone()
        if not q:
            raise HTTPException(status_code=404, detail="Question not found.")
        _deduct_stars(cur, req.user_id, 5, req.topic_id)
        conn.commit()
        if q["question_type"] == "matching":
            hint_text = "Look for matching pairs by focusing on similar categories."
        else:
            hint_text = f"The correct answer starts with option {q['correct_option_letter']}."
        cur.close()
        conn.close()
        return {"success": True, "hint": hint_text, "stars_spent": 5}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ══════════════════════════════════════════════════════════════════════════════
# ── Phase 3: Daily Quizzes Endpoints ─────────────────────────────────────────
# ══════════════════════════════════════════════════════════════════════════════

DAILY_STAR_REWARDS = {"easy": 10, "medium": 20, "hard": 30}
DAILY_FULL_CLEAR_BONUS = 25
DAILY_REFRESH_COST = 5

def _pick_quiz_for_slot(cur, user_id: int, difficulty: str, exclude_quiz_id: int = None):
    """
    Pick a daily quiz slot for the user.
    Uses unlocked/taken lessons. Fallback to any quizzes if there are no lesson groups or not enough quizzes.
    """
    # 1. Get lesson groups they have completed/passed or taken
    cur.execute(
        "SELECT lesson_group_id, easy_passed, medium_passed, hard_passed FROM student_lesson_progress WHERE user_id = %s",
        (user_id,)
    )
    progress_rows = cur.fetchall()
    taken_groups = [r["lesson_group_id"] for r in progress_rows]
    easy_passed_groups = [r["lesson_group_id"] for r in progress_rows if r["easy_passed"]]
    medium_passed_groups = [r["lesson_group_id"] for r in progress_rows if r["medium_passed"]]
    hard_passed_groups = [r["lesson_group_id"] for r in progress_rows if r["hard_passed"]]

    # Decide target difficulty based on what they have unlocked.
    # If they want Hard but have not passed Medium, fallback to Medium.
    # If they want Medium but have not passed Easy, fallback to Easy.
    target_difficulty = difficulty
    if difficulty == "hard" and not medium_passed_groups:
        target_difficulty = "medium"
    if target_difficulty == "medium" and not easy_passed_groups:
        target_difficulty = "easy"

    # Decide which lesson groups to target
    target_groups = []
    if target_difficulty == "hard":
        target_groups = medium_passed_groups
    elif target_difficulty == "medium":
        target_groups = easy_passed_groups
    else: # easy
        target_groups = taken_groups if taken_groups else easy_passed_groups

    # Helper function to query a quiz
    def run_query(use_exclude: bool, use_groups: bool, use_difficulty: bool, diff_val: str):
        where_clauses = []
        params = []
        
        if use_difficulty:
            where_clauses.append("q.difficulty = %s")
            params.append(diff_val)
            
        if use_groups and target_groups:
            where_clauses.append("l.lesson_group_id = ANY(%s)")
            params.append(target_groups)
            
        if use_exclude and exclude_quiz_id is not None:
            where_clauses.append("q.id != %s")
            params.append(exclude_quiz_id)
            
        where_str = " AND ".join(where_clauses)
        if where_str:
            where_str = "WHERE " + where_str
            
        query = f"""
            SELECT q.id, l.lesson_group_id 
            FROM quizzes q 
            LEFT JOIN lessons l ON q.lesson_id = l.id 
            {where_str} 
            ORDER BY RANDOM() LIMIT 1
        """
        cur.execute(query, params)
        return cur.fetchone()

    # Search strategy sequence:
    for excl in [True, False]:
        if excl and exclude_quiz_id is None:
            continue
            
        # Try 1: matching difficulty and target groups
        row = run_query(use_exclude=excl, use_groups=True, use_difficulty=True, diff_val=target_difficulty)
        if row and row["id"]: return row["id"], row["lesson_group_id"]
        
        # Try 2: matching difficulty, ignore group filter
        row = run_query(use_exclude=excl, use_groups=False, use_difficulty=True, diff_val=target_difficulty)
        if row and row["id"]: return row["id"], row["lesson_group_id"]

        # Try 3: ignore difficulty, ignore group filter (any quiz in system)
        row = run_query(use_exclude=excl, use_groups=False, use_difficulty=False, diff_val="")
        if row and row["id"]: return row["id"], row["lesson_group_id"]

    return None, None


@app.get("/daily-quizzes/{user_id}")
def get_daily_quizzes(user_id: int):
    """Returns today's 3 daily quiz slots for the student."""
    try:
        conn = get_db()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        today = date.today()
        total_stars = _get_total_stars(cur, user_id)
        slots = []
        for diff in ["easy", "medium", "hard"]:
            cur.execute(
                "SELECT * FROM daily_quiz_slots WHERE user_id = %s AND slot_date = %s AND slot_difficulty = %s",
                (user_id, today, diff)
            )
            slot = cur.fetchone()
            if not slot:
                quiz_id, lg_id = _pick_quiz_for_slot(cur, user_id, diff)
                cur.execute(
                    "INSERT INTO daily_quiz_slots (user_id, slot_date, slot_difficulty, quiz_id, lesson_group_id) VALUES (%s, %s, %s, %s, %s) ON CONFLICT (user_id, slot_date, slot_difficulty) DO NOTHING RETURNING *",
                    (user_id, today, diff, quiz_id, lg_id)
                )
                slot = cur.fetchone()
                if not slot:
                    cur.execute(
                        "SELECT * FROM daily_quiz_slots WHERE user_id = %s AND slot_date = %s AND slot_difficulty = %s",
                        (user_id, today, diff)
                    )
                    slot = cur.fetchone()
            quiz_title = None
            if slot and slot["quiz_id"]:
                cur.execute("SELECT title FROM quizzes WHERE id = %s", (slot["quiz_id"],))
                qt = cur.fetchone()
                quiz_title = qt["title"] if qt else None
            slots.append({
                "slot_difficulty": diff,
                "quiz_id": slot["quiz_id"] if slot else None,
                "quiz_title": quiz_title,
                "completed": slot["completed"] if slot else False,
                "refresh_used": slot["refresh_used"] if slot else False,
                "stars_earned": slot["stars_earned"] if slot else 0,
                "can_refresh": not (slot["refresh_used"] if slot else True),
                "refresh_cost": DAILY_REFRESH_COST,
                "slot_reward": DAILY_STAR_REWARDS.get(diff, 10),
            })
        conn.commit()
        completed_count = sum(1 for s in slots if s["completed"])
        cur.close()
        conn.close()
        return {
            "user_id": user_id, "date": str(today), "slots": slots,
            "completed_count": completed_count,
            "full_clear_bonus": DAILY_FULL_CLEAR_BONUS,
            "full_clear_achieved": completed_count == 3,
            "total_stars": total_stars,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class DailyRefreshRequest(BaseModel):
    slot_difficulty: str
    topic_id: Optional[str] = None

@app.post("/daily-quizzes/{user_id}/refresh")
def refresh_daily_slot(user_id: int, req: DailyRefreshRequest):
    """Spends 5 stars to reroll the quiz for a daily slot (max 1 per slot/day)."""
    try:
        conn = get_db()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        today = date.today()
        cur.execute(
            "SELECT * FROM daily_quiz_slots WHERE user_id = %s AND slot_date = %s AND slot_difficulty = %s",
            (user_id, today, req.slot_difficulty)
        )
        slot = cur.fetchone()
        if not slot:
            raise HTTPException(status_code=404, detail="Slot not found.")
        if slot["refresh_used"]:
            raise HTTPException(status_code=400, detail="Refresh already used for this slot today.")
        if slot["completed"]:
            raise HTTPException(status_code=400, detail="Slot already completed.")
        total_stars = _get_total_stars(cur, user_id)
        if total_stars < DAILY_REFRESH_COST:
            raise HTTPException(status_code=400, detail=f"Need {DAILY_REFRESH_COST} stars to refresh.")
        _deduct_stars(cur, user_id, DAILY_REFRESH_COST, req.topic_id)
        new_quiz_id, new_lg_id = _pick_quiz_for_slot(cur, user_id, req.slot_difficulty, slot["quiz_id"])
        cur.execute(
            "UPDATE daily_quiz_slots SET quiz_id = %s, lesson_group_id = %s, refresh_used = TRUE WHERE user_id = %s AND slot_date = %s AND slot_difficulty = %s",
            (new_quiz_id, new_lg_id, user_id, today, req.slot_difficulty)
        )
        conn.commit()
        quiz_title = None
        if new_quiz_id:
            cur.execute("SELECT title FROM quizzes WHERE id = %s", (new_quiz_id,))
            qt = cur.fetchone()
            quiz_title = qt["title"] if qt else None
        cur.close()
        conn.close()
        return {"success": True, "new_quiz_id": new_quiz_id, "new_quiz_title": quiz_title, "stars_spent": DAILY_REFRESH_COST}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class DailyCompleteRequest(BaseModel):
    slot_difficulty: str
    score: int
    total_questions: int
    time_spent_seconds: int = 0
    topic_id: Optional[str] = None

@app.post("/daily-quizzes/{user_id}/complete")
def complete_daily_quiz(user_id: int, req: DailyCompleteRequest):
    """Marks a daily slot as complete, awards stars, updates streak, grants full clear bonus if all 3 done."""
    try:
        conn = get_db()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        today = date.today()
        cur.execute(
            "SELECT * FROM daily_quiz_slots WHERE user_id = %s AND slot_date = %s AND slot_difficulty = %s",
            (user_id, today, req.slot_difficulty)
        )
        slot = cur.fetchone()
        if not slot:
            raise HTTPException(status_code=404, detail="Daily quiz slot not found.")
        if slot["completed"]:
            return {"success": True, "message": "Already completed.", "stars_earned": slot["stars_earned"]}
        total = max(req.total_questions, 1)
        accuracy = (req.score / total) * 100
        passed = accuracy >= 70.0
        slot_stars = DAILY_STAR_REWARDS.get(req.slot_difficulty, 10) if passed else 0
        cur.execute(
            "UPDATE daily_quiz_slots SET completed = TRUE, stars_earned = %s WHERE user_id = %s AND slot_date = %s AND slot_difficulty = %s",
            (slot_stars, user_id, today, req.slot_difficulty)
        )
        if slot_stars > 0 and req.topic_id:
            cur.execute(
                "INSERT INTO student_profiles (user_id, topic_id, total_stars) VALUES (%s, %s, %s) ON CONFLICT (user_id, topic_id) DO UPDATE SET total_stars = student_profiles.total_stars + %s",
                (user_id, req.topic_id, slot_stars, slot_stars)
            )
        _update_student_streak(cur, user_id)
        cur.execute(
            "SELECT COUNT(*) AS cnt FROM daily_quiz_slots WHERE user_id = %s AND slot_date = %s AND completed = TRUE",
            (user_id, today)
        )
        completed_count = cur.fetchone()["cnt"]
        bonus_awarded = False
        if completed_count == 3:
            bonus_awarded = True
            if req.topic_id:
                cur.execute(
                    "INSERT INTO student_profiles (user_id, topic_id, total_stars) VALUES (%s, %s, %s) ON CONFLICT (user_id, topic_id) DO UPDATE SET total_stars = student_profiles.total_stars + %s",
                    (user_id, req.topic_id, DAILY_FULL_CLEAR_BONUS, DAILY_FULL_CLEAR_BONUS)
                )
        conn.commit()
        cur.close()
        conn.close()
        return {
            "success": True, "passed": passed,
            "accuracy_pct": round(accuracy, 1), "stars_earned": slot_stars,
            "bonus_awarded": bonus_awarded,
            "bonus_stars": DAILY_FULL_CLEAR_BONUS if bonus_awarded else 0,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ══════════════════════════════════════════════════════════════════════════════
# ── Translation endpoint ───────────────────────────────────────────────────────
# ══════════════════════════════════════════════════════════════════════════════


@app.post("/translate")
def translate_text(request: TranslationRequest):
    if request.direction == "en_to_asl":
        tokenizer.src_lang = "en_XX"
        inputs = tokenizer(
            request.text,
            return_tensors="pt",
            max_length=128,
            truncation=True,
        )
        out = model.generate(
            **inputs,
            forced_bos_token_id=tokenizer.convert_tokens_to_ids("asl_GL"),
            max_length=128,
            num_beams=4,
        )
        result = tokenizer.decode(out[0], skip_special_tokens=True)
        return {"result": result, "direction": "en_to_asl"}

    elif request.direction == "asl_to_en":
        tokenizer.src_lang = "asl_GL"
        inputs = tokenizer(
            request.text,
            return_tensors="pt",
            max_length=128,
            truncation=True,
        )
        out = model.generate(
            **inputs,
            forced_bos_token_id=tokenizer.convert_tokens_to_ids("en_XX"),
            max_length=128,
            num_beams=4,
        )
        result = tokenizer.decode(out[0], skip_special_tokens=True)
        return {"result": result, "direction": "asl_to_en"}

    else:
        return {"error": "Invalid direction. Use 'en_to_asl' or 'asl_to_en'."}


@app.get("/health")
def health():
    return {"status": "ok"}


# ══════════════════════════════════════════════════════════════════════════════
# ── Phase 5: Profile, Badges, Leaderboard & Teacher Analytics ─────────────────
# ══════════════════════════════════════════════════════════════════════════════

class UpdateProfileRequest(BaseModel):
    name: str

class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str

@app.get("/student/{user_id}/profile-info")
def get_student_profile_info(user_id: int):
    try:
        conn = get_db()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("SELECT id, name, username FROM users WHERE id = %s", (user_id,))
        u = cur.fetchone()
        if not u:
            raise HTTPException(status_code=404, detail="User not found.")
        total_stars = _get_total_stars(cur, user_id)
        cur.execute("SELECT current_streak FROM student_streaks WHERE user_id = %s", (user_id,))
        streak_row = cur.fetchone()
        streak = streak_row["current_streak"] if streak_row else 0
        cur.close()
        conn.close()
        return {
            "id": u["id"],
            "name": u["name"],
            "username": u["username"],
            "total_stars": total_stars,
            "streak": streak
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/student/{user_id}/update-profile")
def update_student_profile(user_id: int, req: UpdateProfileRequest):
    if not req.name.strip():
        raise HTTPException(status_code=400, detail="Name cannot be empty.")
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute("UPDATE users SET name = %s WHERE id = %s", (req.name.strip(), user_id))
        conn.commit()
        cur.close()
        conn.close()
        return {"success": True, "message": "Profile updated successfully.", "name": req.name.strip()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/student/{user_id}/change-password")
def change_student_password(user_id: int, req: ChangePasswordRequest):
    if not req.old_password.strip() or not req.new_password.strip():
        raise HTTPException(status_code=400, detail="All password fields are required.")
    if len(req.new_password.strip()) < 4:
        raise HTTPException(status_code=400, detail="New password must be at least 4 characters.")
    try:
        conn = get_db()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("SELECT password_hash FROM users WHERE id = %s", (user_id,))
        u = cur.fetchone()
        if not u or not pwd_context.verify(req.old_password, u["password_hash"]):
            raise HTTPException(status_code=401, detail="Incorrect current password.")
        new_hashed = pwd_context.hash(req.new_password.strip())
        cur.execute("UPDATE users SET password_hash = %s WHERE id = %s", (new_hashed, user_id))
        conn.commit()
        cur.close()
        conn.close()
        return {"success": True, "message": "Password changed successfully."}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/student/{user_id}/badges")
def get_student_badges(user_id: int):
    try:
        conn = get_db()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        
        # 1. First Step: completed at least 1 quiz
        cur.execute("SELECT COUNT(*) AS cnt FROM student_quiz_attempts WHERE user_id = %s", (user_id,))
        quiz_attempts_count = cur.fetchone()["cnt"]
        first_step = quiz_attempts_count >= 1

        # 2. Streak Master: 3+ streak
        cur.execute("SELECT current_streak, longest_streak FROM student_streaks WHERE user_id = %s", (user_id,))
        streak_row = cur.fetchone()
        streak_master = (streak_row["current_streak"] >= 3 or streak_row["longest_streak"] >= 3) if streak_row else False

        # 3. Perfect Score: 100% on any quiz
        cur.execute("SELECT COUNT(*) AS cnt FROM student_quiz_attempts WHERE user_id = %s AND score = total_questions AND total_questions > 0", (user_id,))
        perfect_score = cur.fetchone()["cnt"] >= 1

        # 4. Daily Champion: completed 3 daily slots in a single day
        cur.execute("SELECT slot_date, COUNT(*) AS cnt FROM daily_quiz_slots WHERE user_id = %s AND completed = TRUE GROUP BY slot_date HAVING COUNT(*) = 3 LIMIT 1", (user_id,))
        daily_champ = cur.fetchone() is not None

        # 5. Story Explorer: passed Story Grammar easy
        cur.execute("""
            SELECT slp.easy_passed FROM student_lesson_progress slp 
            JOIN lesson_groups lg ON slp.lesson_group_id = lg.id 
            WHERE slp.user_id = %s AND lg.topic_id = 'story-grammar' AND slp.easy_passed = TRUE LIMIT 1
        """, (user_id,))
        story_explorer = cur.fetchone() is not None

        # 6. Literacy Champ: passed English Literacy easy
        cur.execute("""
            SELECT slp.easy_passed FROM student_lesson_progress slp 
            JOIN lesson_groups lg ON slp.lesson_group_id = lg.id 
            WHERE slp.user_id = %s AND lg.topic_id = 'english-literacy' AND slp.easy_passed = TRUE LIMIT 1
        """, (user_id,))
        literacy_champ = cur.fetchone() is not None

        cur.close()
        conn.close()

        badges = [
            {
                "id": "first_step",
                "title": "First Step",
                "description": "Complete your very first quiz attempt.",
                "icon": "footsteps-outline",
                "color": "#0284C7",
                "unlocked": bool(first_step),
            },
            {
                "id": "streak_master",
                "title": "Streak Master",
                "description": "Reach a 3-day active learning streak.",
                "icon": "flame",
                "color": "#EA580C",
                "unlocked": bool(streak_master),
            },
            {
                "id": "perfect_score",
                "title": "Perfect Score",
                "description": "Score 100% on any quiz.",
                "icon": "trophy",
                "color": "#F59E0B",
                "unlocked": bool(perfect_score),
            },
            {
                "id": "daily_champion",
                "title": "Daily Champion",
                "description": "Complete all 3 daily quiz slots in one day.",
                "icon": "calendar-outline",
                "color": "#10B981",
                "unlocked": bool(daily_champ),
            },
            {
                "id": "story_explorer",
                "title": "Story Explorer",
                "description": "Pass your first Story Grammar lesson.",
                "icon": "book-outline",
                "color": "#7C3AED",
                "unlocked": bool(story_explorer),
            },
            {
                "id": "literacy_champ",
                "title": "Literacy Champ",
                "description": "Pass your first English Literacy lesson.",
                "icon": "reader-outline",
                "color": "#0D9488",
                "unlocked": bool(literacy_champ),
            }
        ]
        return badges
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/leaderboard")
def get_leaderboard(user_id: Optional[int] = None):
    try:
        conn = get_db()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("""
            SELECT 
                u.id AS user_id,
                u.name,
                u.username,
                COALESCE(SUM(sp.total_stars), 0) AS total_stars,
                COALESCE(ss.current_streak, 0) AS current_streak,
                COALESCE(SUM(sp.quizzes_completed), 0) AS quizzes_completed
            FROM users u
            LEFT JOIN student_profiles sp ON u.id = sp.user_id
            LEFT JOIN student_streaks ss ON u.id = ss.user_id
            GROUP BY u.id, u.name, u.username, ss.current_streak
            ORDER BY total_stars DESC, current_streak DESC, u.id ASC
            LIMIT 20
        """)
        rows = cur.fetchall()
        leaderboard = []
        user_rank = None
        for rank, r in enumerate(rows, start=1):
            entry = {
                "rank": rank,
                "user_id": r["user_id"],
                "name": r["name"],
                "username": r["username"],
                "total_stars": int(r["total_stars"]),
                "current_streak": int(r["current_streak"]),
                "quizzes_completed": int(r["quizzes_completed"]),
                "is_current_user": bool(user_id and r["user_id"] == user_id)
            }
            leaderboard.append(entry)
            if user_id and r["user_id"] == user_id:
                user_rank = rank

        cur.close()
        conn.close()
        return {
            "leaderboard": leaderboard[:10],
            "user_rank": user_rank,
            "total_students": len(rows)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/admin/analytics/overview")
def get_admin_analytics_overview():
    try:
        conn = get_db()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        
        # 1. Total Students
        cur.execute("SELECT COUNT(*) AS total FROM users")
        total_students = cur.fetchone()["total"]

        # 2. Total Quiz Attempts & Class Avg Accuracy
        cur.execute("""
            SELECT 
                COUNT(*) AS total_attempts,
                COALESCE(AVG((score::FLOAT / NULLIF(total_questions, 0)) * 100), 0) AS avg_accuracy
            FROM student_quiz_attempts
        """)
        quiz_stats = cur.fetchone()
        total_attempts = quiz_stats["total_attempts"]
        avg_accuracy = round(float(quiz_stats["avg_accuracy"]), 1)

        # 3. Topic Breakdown (Story Grammar vs English Literacy)
        cur.execute("""
            SELECT 
                COALESCE(q.topic_id, 'other') AS topic_id,
                COUNT(*) AS attempts,
                COALESCE(AVG((sqa.score::FLOAT / NULLIF(sqa.total_questions, 0)) * 100), 0) AS avg_accuracy
            FROM student_quiz_attempts sqa
            JOIN quizzes q ON sqa.quiz_id = q.id
            GROUP BY q.topic_id
        """)
        topic_rows = cur.fetchall()
        topic_stats = {r["topic_id"]: {"attempts": r["attempts"], "avg_accuracy": round(float(r["avg_accuracy"]), 1)} for r in topic_rows}

        # 4. Weakest Knowledge Components across class
        cur.execute("""
            SELECT 
                kc.topic_id,
                kc.name,
                kc.display_name,
                COALESCE(AVG(skm.p_mastery), 0) AS avg_mastery,
                COUNT(skm.user_id) AS student_count
            FROM knowledge_components kc
            LEFT JOIN student_kc_mastery skm ON kc.name = skm.kc_name
            GROUP BY kc.topic_id, kc.name, kc.display_name
            ORDER BY avg_mastery ASC
            LIMIT 6
        """)
        weak_kcs = [
            {
                "topic_id": r["topic_id"],
                "name": r["name"],
                "display_name": r["display_name"],
                "avg_mastery_pct": round(float(r["avg_mastery"]) * 100, 1),
                "student_count": r["student_count"]
            }
            for r in cur.fetchall()
        ]

        # 5. Student Roster with progress
        cur.execute("""
            SELECT 
                u.id AS user_id,
                u.name,
                u.username,
                COALESCE(SUM(sp.total_stars), 0) AS total_stars,
                COALESCE(ss.current_streak, 0) AS current_streak,
                COALESCE(COUNT(sqa.id), 0) AS attempts_count,
                COALESCE(AVG((sqa.score::FLOAT / NULLIF(sqa.total_questions, 0)) * 100), 0) AS avg_accuracy
            FROM users u
            LEFT JOIN student_profiles sp ON u.id = sp.user_id
            LEFT JOIN student_streaks ss ON u.id = ss.user_id
            LEFT JOIN student_quiz_attempts sqa ON u.id = sqa.user_id
            GROUP BY u.id, u.name, u.username, ss.current_streak
            ORDER BY total_stars DESC, u.id ASC
        """)
        roster = [
            {
                "user_id": r["user_id"],
                "name": r["name"],
                "username": r["username"],
                "total_stars": int(r["total_stars"]),
                "current_streak": int(r["current_streak"]),
                "attempts_count": int(r["attempts_count"]),
                "avg_accuracy": round(float(r["avg_accuracy"]), 1)
            }
            for r in cur.fetchall()
        ]

        cur.close()
        conn.close()

        return {
            "total_students": total_students,
            "total_attempts": total_attempts,
            "class_avg_accuracy": avg_accuracy,
            "topic_stats": topic_stats,
            "weak_kcs": weak_kcs,
            "student_roster": roster
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

