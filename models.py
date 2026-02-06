import sqlite3

def init_db():
    conn = sqlite3.connect("diet_planner.db")
    cursor = conn.cursor()

    # ---------------- Users Table ----------------
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        age INTEGER,
        weight REAL,
        height REAL,
        activity_level TEXT DEFAULT '',
        health_conditions TEXT,
        password TEXT,
        email TEXT DEFAULT '',
        phone TEXT DEFAULT '',
        diet_preference TEXT DEFAULT 'veg'
        )
    """)
    
    # ---------------- Foods Table ----------------
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS foods (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        food TEXT,
        calories REAL,
        protein REAL,
        carbs REAL,
        fat REAL,
        safe_for TEXT,   -- e.g. "diabetes, hypertension"
        meal TEXT,       -- morning, afternoon, dinner
        price REAL       -- cost per serving
    )
    """)

    # ---------------- Reminders Table ----------------
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS reminders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        type TEXT,
        message TEXT,
        time TEXT,
        last_checkup TEXT,
        frequency TEXT,
        FOREIGN KEY(user_id) REFERENCES users(id)
    )
    """)

    # ---------------- Feedback Table ----------------
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS feedback (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        rating INTEGER,
        notes TEXT,
        FOREIGN KEY(user_id) REFERENCES users(id)
    )
    """)

    # ---------------- Consumption Tracking Table ----------------
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS consumption_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        meal_type TEXT,  -- breakfast, lunch, dinner, water
        food_name TEXT,
        calories REAL,
        protein REAL,
        carbs REAL,
        fat REAL,
        consumed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        date TEXT,  -- YYYY-MM-DD format for easy querying
        FOREIGN KEY(user_id) REFERENCES users(id)
    )
    """)

    # ---------------- User Goals Table ----------------
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS user_goals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        daily_calorie_goal REAL,
        weekly_calorie_goal REAL,
        daily_water_goal INTEGER DEFAULT 8,  -- glasses of water
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id)
    )
    """)

    # ---------------- Active Reminders Table ----------------
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS active_reminders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        reminder_type TEXT,  -- meal, water, doctor
        reminder_time TEXT,  -- HH:MM format
        is_active BOOLEAN DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id)
    )
    """)

    # ---------------- Doctor Appointments Table ----------------
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS doctor_appointments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        last_checkup_date TEXT,  -- YYYY-MM-DD
        frequency TEXT,  -- weekly, monthly
        next_appointment_date TEXT,  -- YYYY-MM-DD
        is_active BOOLEAN DEFAULT 1,
        FOREIGN KEY(user_id) REFERENCES users(id)
    )
    """)

    # ---------------- Saved Meal Plans Table ----------------
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS saved_meal_plans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        plan_data TEXT,  -- JSON string of the weekly meal plan
        selected_foods TEXT,  -- JSON string of user selected foods
        week_start_date TEXT,  -- YYYY-MM-DD
        week_end_date TEXT,  -- YYYY-MM-DD
        is_active BOOLEAN DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id)
    )
    """)

    # ---------------- Push Subscriptions Table ----------------
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS push_subscriptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER UNIQUE,
        endpoint TEXT,
        p256dh TEXT,
        auth TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id)
    )
    """)

    conn.commit()
    conn.close()
    print("✨ diet_planner.db initialized successfully with health tracking support!")
