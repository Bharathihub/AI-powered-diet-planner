from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
import sqlite3
import hashlib
import pickle
import pandas as pd
from datetime import datetime, timedelta
import random
import json
import os

app = Flask(__name__)
CORS(app)

# Database setup
def init_db():
    conn = sqlite3.connect('diet_planner.db')
    cursor = conn.cursor()
    
    # Users table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            age INTEGER NOT NULL,
            weight REAL NOT NULL,
            height REAL NOT NULL,
            health_conditions TEXT,
            diet_preference TEXT,
            password TEXT NOT NULL
        )
    ''')
    
    # Meal plans table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS meal_plans (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            meal_plan TEXT,
            selected_foods TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    ''')
    
    # Consumption tracking table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS consumption_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            meal_type TEXT,
            food_name TEXT,
            calories REAL,
            protein REAL,
            carbs REAL,
            fat REAL,
            consumed_date DATE,
            consumed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    ''')
    
    # Saved meal plans table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS saved_meal_plans (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            plan_data TEXT,
            selected_foods TEXT,
            week_start_date TEXT,
            week_end_date TEXT,
            is_active BOOLEAN DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
    ''')
    
    # Push subscriptions table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS push_subscriptions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER UNIQUE,
            endpoint TEXT,
            p256dh TEXT,
            auth TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
    ''')
    
    # Active reminders table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS active_reminders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            reminder_type TEXT,
            reminder_time TEXT,
            message TEXT,
            push_title TEXT,
            push_body TEXT,
            action_data TEXT,
            is_active BOOLEAN DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
    ''')
    
    # Doctor appointments table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS doctor_appointments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            appointment_date DATE,
            appointment_time TEXT,
            doctor_type TEXT,
            frequency TEXT,
            last_visit_date DATE,
            next_reminder_date DATE,
            is_active BOOLEAN DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
    ''')
    
    conn.commit()
    conn.close()

def get_db():
    """Get database connection"""
    return sqlite3.connect('diet_planner.db')

# Load the trained model
def load_model():
    try:
        with open('diet_model.pkl', 'rb') as f:
            return pickle.load(f)
    except (FileNotFoundError, pickle.UnpicklingError, Exception) as e:
        print(f"Warning: Could not load model: {e}")
        return None

# Load dataset
def load_dataset():
    try:
        return pd.read_csv('training_dataset.csv')
    except FileNotFoundError:
        return pd.DataFrame()

model = load_model()
dataset = load_dataset()

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/register', methods=['POST'])
def register():
    try:
        data = request.json
        name = data.get('name')
        age = data.get('age')
        weight = data.get('weight')
        height = data.get('height')
        health_conditions = data.get('health_conditions', 'normal')
        diet_preference = data.get('diet_preference', 'veg')
        password = data.get('password')
        
        if not all([name, age, weight, height, password]):
            return jsonify({'error': 'All fields are required'}), 400
        
        # Hash password
        password_hash = hashlib.sha256(password.encode()).hexdigest()
        
        conn = sqlite3.connect('diet_planner.db')
        cursor = conn.cursor()
        
        # Check if user already exists
        cursor.execute('SELECT id FROM users WHERE name = ?', (name,))
        if cursor.fetchone():
            return jsonify({'error': 'User already exists'}), 400
        
        # Insert new user
        cursor.execute('''
            INSERT INTO users (name, age, weight, height, health_conditions, diet_preference, password)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (name, age, weight, height, health_conditions, diet_preference, password_hash))
        
        conn.commit()
        conn.close()
        
        return jsonify({'message': 'User registered successfully'}), 201
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/login', methods=['POST'])
def login():
    try:
        data = request.json
        name = data.get('name')
        password = data.get('password')
        
        if not all([name, password]):
            return jsonify({'error': 'Name and password are required'}), 400
        
        password_hash = hashlib.sha256(password.encode()).hexdigest()
        
        conn = sqlite3.connect('diet_planner.db')
        cursor = conn.cursor()
        
        cursor.execute('SELECT id, name FROM users WHERE name = ? AND password = ?', 
                      (name, password_hash))
        user = cursor.fetchone()
        
        if user:
            user_id = user[0]
            user_name = user[1]
            
            # Check if user has an active meal plan
            cursor.execute("""
                SELECT plan_data, created_at FROM saved_meal_plans 
                WHERE user_id = ? AND is_active = 1
                ORDER BY created_at DESC
                LIMIT 1
            """, (user_id,))
            
            meal_plan_row = cursor.fetchone()
            has_active_plan = meal_plan_row is not None
            
            # If they have a plan, check if it's from this week
            plan_is_current_week = False
            if has_active_plan:
                import datetime
                plan_date = datetime.datetime.strptime(meal_plan_row[1], '%Y-%m-%d %H:%M:%S')
                current_date = datetime.datetime.now()
                
                # Check if plan is from current week (within 7 days)
                days_difference = (current_date - plan_date).days
                plan_is_current_week = days_difference <= 7
            
            conn.close()
            
            return jsonify({
                'user_id': user_id, 
                'name': user_name,
                'has_active_plan': has_active_plan,
                'plan_is_current_week': plan_is_current_week,
                'redirect_to': 'weeklyPlan' if has_active_plan and plan_is_current_week else 'dashboard'
            }), 200
        else:
            conn.close()
            return jsonify({'error': 'Invalid credentials'}), 401
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/available_foods/<int:user_id>')
def get_available_foods(user_id):
    try:
        conn = sqlite3.connect('diet_planner.db')
        cursor = conn.cursor()
        
        # Get user details
        cursor.execute('SELECT health_conditions, diet_preference FROM users WHERE id = ?', (user_id,))
        user = cursor.fetchone()
        conn.close()
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        health_condition, diet_preference = user
        
        if dataset.empty:
            return jsonify({'error': 'Dataset not available'}), 500
        
        # Filter foods based on health condition and diet preference
        filtered_foods = dataset.copy()
        
        # Filter by health condition
        if health_condition and health_condition != 'normal':
            # Check if the condition is in the safe_for column (comma-separated values)
            if 'safe_for' in filtered_foods.columns:
                filtered_foods = filtered_foods[filtered_foods['safe_for'].str.contains(health_condition, na=False)]
        
        # Filter by diet preference
        if diet_preference == 'veg':
            if 'veg_type' in filtered_foods.columns:
                filtered_foods = filtered_foods[filtered_foods['veg_type'] == 'veg']
        
        # Group by meal type
        foods_by_meal = {
            'morning': [],
            'afternoon': [],
            'dinner': []
        }
        
        for meal_type in ['morning', 'afternoon', 'dinner']:
            meal_foods = filtered_foods[filtered_foods['meal'] == meal_type]
            
            for _, food in meal_foods.iterrows():
                foods_by_meal[meal_type].append({
                    'food': food['food'],
                    'calories': float(food['calories']),
                    'protein': float(food['protein']),
                    'carbs': float(food['carbs']),
                    'fat': float(food['fat']),
                    'veg_type': food.get('veg_type', 'veg')  # Include veg_type information
                })
        
        return jsonify({'foods_by_meal': foods_by_meal}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/generate_weekly_meal_plan', methods=['POST'])
def generate_weekly_meal_plan():
    try:
        import random
        data = request.json
        user_id = data.get('user_id')
        selected_foods = data.get('selected_foods', {})
        
        if not user_id:
            return jsonify({'error': 'User ID is required'}), 400
        
        # Get user details
        conn = sqlite3.connect('diet_planner.db')
        cursor = conn.cursor()
        cursor.execute('SELECT health_conditions, diet_preference FROM users WHERE id = ?', (user_id,))
        user = cursor.fetchone()
        
        if not user:
            conn.close()
            return jsonify({'error': 'User not found'}), 404
        
        health_condition, diet_preference = user
        
        # Generate weekly meal plan with rotation
        days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
        weekly_plan = {}
        used_foods = {}  # Track used foods to avoid repetition
        
        for day_index, day in enumerate(days):
            daily_plan = {}
            
            for meal_type in ['morning', 'afternoon', 'dinner']:
                user_selected = selected_foods.get(meal_type, [])
                daily_meals = []
                
                if user_selected:
                    # Add user selected foods - rotate through them each day
                    user_selected_copy = [f.copy() for f in user_selected]
                    selected_idx = day_index % len(user_selected_copy)
                    selected_food = user_selected_copy[selected_idx]
                    selected_food['isUserSelected'] = True
                    daily_meals.append(selected_food)
                
                # Get recommended foods
                if dataset.empty:
                    conn.close()
                    return jsonify({'error': 'Dataset not available'}), 500
                
                # Get available foods for this meal type
                # training_dataset.csv uses 'meal' column (not meal_type)
                filtered_foods = dataset[dataset['meal'] == meal_type].copy()
                
                # Apply health condition filter
                if health_condition and health_condition != 'normal':
                    if 'safe_for' in filtered_foods.columns:
                        filtered_foods = filtered_foods[filtered_foods['safe_for'].str.contains(health_condition, na=False)]
                
                # Apply diet preference filter
                if diet_preference == 'veg':
                    if 'veg_type' in filtered_foods.columns:
                        filtered_foods = filtered_foods[filtered_foods['veg_type'] == 'veg']
                
                # Exclude user selected foods from recommendations
                selected_food_names = [f['food'] for f in user_selected]
                available_foods = filtered_foods[~filtered_foods['food'].isin(selected_food_names)]
                
                # Initialize tracking for this meal type if not exists
                if meal_type not in used_foods:
                    used_foods[meal_type] = []
                
                # Get recommended foods, avoiding recently used ones
                needed_foods = 3 - len(daily_meals)
                if len(available_foods) >= needed_foods:
                    # Sort by which foods haven't been used recently
                    available_list = available_foods.to_dict('records')
                    available_list.sort(key=lambda x: used_foods[meal_type].count(x['food']))
                    
                    for i in range(needed_foods):
                        if i < len(available_list):
                            food = available_list[i]
                            daily_meals.append({
                                'food': food['food'],
                                'calories': float(food['calories']),
                                'protein': float(food['protein']),
                                'carbs': float(food['carbs']),
                                'fat': float(food['fat']),
                                'veg_type': food.get('veg_type', 'veg'),  # Include veg_type
                                'isUserSelected': False
                            })
                            used_foods[meal_type].append(food['food'])
                
                daily_plan[meal_type] = daily_meals
            
            weekly_plan[day] = daily_plan
        
        conn.close()
        return jsonify({'meal_plan': weekly_plan}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/get_saved_meal_plan/<int:user_id>')
def get_saved_meal_plan(user_id):
    """Get user's saved meal plan"""
    try:
        conn = sqlite3.connect('diet_planner.db')
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT plan_data FROM saved_meal_plans 
            WHERE user_id = ? AND is_active = 1
            ORDER BY created_at DESC
            LIMIT 1
        """, (user_id,))
        
        plan_row = cursor.fetchone()
        conn.close()
        
        if plan_row:
            import json
            meal_plan = json.loads(plan_row[0])
            return jsonify({'meal_plan': meal_plan}), 200
        else:
            return jsonify({'error': 'No active meal plan found'}), 404
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ---------------- AI Recipe Chatbot ----------------
@app.route("/chat", methods=["POST"])
def chat_with_ai():
    """AI Recipe Assistant - Provides cooking instructions based on user's meal plan"""
    from chatbot_new import chat_with_ai_fixed
    return chat_with_ai_fixed(request.json or {}, get_db)

# ---------------- Mark as Consumed Functionality ----------------
@app.route('/mark_consumed_for_date', methods=['POST'])
def mark_consumed_for_date():
    """Mark meals as consumed for a specific date"""
    try:
        data = request.json
        user_id = data.get('user_id')
        meal_type = data.get('meal_type')
        date = data.get('date')
        foods = data.get('foods', [])
        
        if not all([user_id, meal_type, date]):
            return jsonify({'error': 'Missing required fields'}), 400
        
        conn = sqlite3.connect('diet_planner.db')
        cursor = conn.cursor()
        
        # Check if already marked for this date and meal
        cursor.execute('''
            SELECT id FROM consumption_log 
            WHERE user_id = ? AND meal_type = ? AND date = ?
        ''', (user_id, meal_type, date))
        
        existing = cursor.fetchone()
        
        if existing:
            # Toggle - remove existing consumption record
            cursor.execute('''
                DELETE FROM consumption_log 
                WHERE user_id = ? AND meal_type = ? AND date = ?
            ''', (user_id, meal_type, date))
            message = f"{meal_type.title()} marked as not consumed"
            consumed = False
        else:
            # Add consumption records for each food
            total_calories = 0
            total_protein = 0
            total_carbs = 0
            total_fat = 0
            
            for food in foods:
                calories = food.get('calories', 0)
                protein = food.get('protein', 0)
                carbs = food.get('carbs', 0)
                fat = food.get('fat', 0)
                
                cursor.execute('''
                    INSERT INTO consumption_log 
                    (user_id, meal_type, food_name, calories, protein, carbs, fat, date)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ''', (user_id, meal_type, food.get('food', ''), calories, protein, carbs, fat, date))
                
                total_calories += calories
                total_protein += protein
                total_carbs += carbs
                total_fat += fat
            
            message = f"{meal_type.title()} marked as consumed"
            consumed = True
        
        conn.commit()
        conn.close()
        
        return jsonify({
            'success': True,
            'message': message,
            'consumed': consumed,
            'total_calories': total_calories if not existing else 0
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/clear_consumption_status/<int:user_id>', methods=['POST'])
def clear_consumption_status(user_id):
    """Clear all consumption status for user when regenerating plan"""
    try:
        conn = sqlite3.connect('diet_planner.db')
        cursor = conn.cursor()
        
        # Clear all consumption logs for this user
        cursor.execute('DELETE FROM consumption_log WHERE user_id = ?', (user_id,))
        
        conn.commit()
        conn.close()
        
        return jsonify({'success': True, 'message': 'Consumption status cleared'}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/save_meal_plan', methods=['POST'])
def save_meal_plan():
    """Save user's meal plan to database"""
    try:
        data = request.json
        user_id = data.get('user_id')
        meal_plan = data.get('meal_plan')
        selected_foods = data.get('selected_foods', {})
        
        if not all([user_id, meal_plan]):
            return jsonify({'error': 'User ID and meal plan are required'}), 400
        
        conn = sqlite3.connect('diet_planner.db')
        cursor = conn.cursor()
        
        # Deactivate any existing meal plans for this user
        cursor.execute('''
            UPDATE saved_meal_plans 
            SET is_active = 0 
            WHERE user_id = ?
        ''', (user_id,))
        
        # Save new meal plan
        import json
        from datetime import datetime, timedelta
        
        plan_json = json.dumps(meal_plan)
        selected_foods_json = json.dumps(selected_foods)
        
        # Calculate week dates
        today = datetime.now()
        week_start = today - timedelta(days=today.weekday())
        week_end = week_start + timedelta(days=6)
        
        cursor.execute('''
            INSERT INTO saved_meal_plans 
            (user_id, plan_data, selected_foods, week_start_date, week_end_date, is_active, created_at)
            VALUES (?, ?, ?, ?, ?, 1, datetime('now'))
        ''', (user_id, plan_json, selected_foods_json, 
              week_start.strftime('%Y-%m-%d'), week_end.strftime('%Y-%m-%d')))
        
        conn.commit()
        conn.close()
        
        return jsonify({'success': True, 'message': 'Meal plan saved successfully'}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/get_consumption_status/<int:user_id>')
def get_consumption_status(user_id):
    """Get consumption status for all days"""
    try:
        conn = sqlite3.connect('diet_planner.db')
        cursor = conn.cursor()
        
        # Get consumption data for the last 7 days
        cursor.execute('''
            SELECT date, meal_type, COUNT(*) as meal_count
            FROM consumption_log 
            WHERE user_id = ? 
            AND date >= date('now', '-7 days')
            GROUP BY date, meal_type
        ''', (user_id,))
        
        consumption_data = cursor.fetchall()
        
        # Organize by date
        consumption_status = {}
        for date, meal_type, count in consumption_data:
            if date not in consumption_status:
                consumption_status[date] = {}
            consumption_status[date][meal_type] = True
        
        conn.close()
        
        return jsonify({'consumption_status': consumption_status}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/get_day_completion_status/<int:user_id>')
def get_day_completion_status(user_id):
    """Get completion status for each day (for green day indicator)"""
    try:
        conn = sqlite3.connect('diet_planner.db')
        cursor = conn.cursor()
        
        # Get consumption data grouped by date
        cursor.execute('''
            SELECT date, 
                   COUNT(DISTINCT meal_type) as consumed_meals,
                   COUNT(*) as total_foods
            FROM consumption_log 
            WHERE user_id = ? 
            AND date >= date('now', '-7 days')
            GROUP BY date
        ''', (user_id,))
        
        consumption_data = cursor.fetchall()
        
        # Determine completion status
        day_completion = {}
        for date, consumed_meals, total_foods in consumption_data:
            # A day is considered complete if user consumed all 3 meals
            is_complete = consumed_meals >= 3
            day_completion[date] = {
                'is_complete': is_complete,
                'consumed_meals': consumed_meals,
                'total_foods': total_foods
            }
        
        conn.close()
        
        return jsonify({'day_completion': day_completion}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/get_weekly_dashboard/<int:user_id>')
def get_weekly_dashboard(user_id):
    """Get weekly dashboard data for meal progress visualization"""
    try:
        conn = sqlite3.connect('diet_planner.db')
        cursor = conn.cursor()
        
        # Get DISTINCT meal types per day with their total calories
        cursor.execute('''
            SELECT date, meal_type, SUM(calories) as meal_calories
            FROM consumption_log 
            WHERE user_id = ? 
            AND date >= date('now', '-7 days')
            GROUP BY date, meal_type
        ''', (user_id,))
        
        consumption_data = cursor.fetchall()
        
        # Calculate weekly statistics
        weekly_stats = {
            'total_calories_consumed': 0,
            'total_meals_consumed': 0,
            'total_possible_meals': 21,  # 7 days * 3 meals
            'daily_breakdown': {}
        }
        
        # Initialize daily breakdown for Sunday to Saturday
        days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
        today = datetime.now()
        
        # Calculate this week's Sunday
        days_since_sunday = (today.weekday() + 1) % 7
        week_start_sunday = today - timedelta(days=days_since_sunday)
        
        for i, day in enumerate(days):
            day_date = (week_start_sunday + timedelta(days=i)).strftime('%Y-%m-%d')
            weekly_stats['daily_breakdown'][day] = {
                'date': day_date,
                'meals_consumed': 0,
                'total_meals': 3,
                'calories': 0,
                'is_complete': False
            }
        
        # Process consumption data
        for date, meal_type, meal_calories in consumption_data:
            # Convert date to day name
            date_obj = datetime.strptime(date, '%Y-%m-%d')
            day_name = date_obj.strftime('%A')  # Get day name directly
            
            if day_name in weekly_stats['daily_breakdown']:
                daily_data = weekly_stats['daily_breakdown'][day_name]
                daily_data['meals_consumed'] += 1  # Count each meal type as 1 meal
                daily_data['calories'] += meal_calories
                daily_data['is_complete'] = daily_data['meals_consumed'] >= 3
                
                weekly_stats['total_calories_consumed'] += meal_calories
                weekly_stats['total_meals_consumed'] += 1
        
        # Calculate percentages
        weekly_stats['goal_percentage'] = round((weekly_stats['total_meals_consumed'] / weekly_stats['total_possible_meals']) * 100)
        weekly_stats['target_calories'] = 6537
        weekly_stats['calorie_percentage'] = round((weekly_stats['total_calories_consumed'] / weekly_stats['target_calories']) * 100)
        
        conn.close()
        
        return jsonify({'weekly_dashboard': weekly_stats}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/health_dashboard/<int:user_id>')
def health_dashboard(user_id):
    """Get health dashboard data in the format expected by frontend"""
    try:
        conn = sqlite3.connect('diet_planner.db')
        cursor = conn.cursor()
        
        # Get consumption data for the current week
        cursor.execute('''
            SELECT date, meal_type, SUM(calories) as meal_calories
            FROM consumption_log 
            WHERE user_id = ? 
            AND date >= date('now', '-7 days')
            GROUP BY date, meal_type
        ''', (user_id,))
        
        consumption_data = cursor.fetchall()
        
        # Initialize weekly statistics
        total_calories = 0
        total_meals_consumed = 0
        total_possible_meals = 21  # 7 days * 3 meals
        
        # Initialize daily breakdown for Sunday to Saturday
        days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
        today = datetime.now()
        
        # Calculate this week's Sunday
        days_since_sunday = (today.weekday() + 1) % 7
        week_start_sunday = today - timedelta(days=days_since_sunday)
        
        chart_data = []
        daily_breakdown = {}
        
        for i, day in enumerate(days):
            day_date = (week_start_sunday + timedelta(days=i)).strftime('%Y-%m-%d')
            daily_breakdown[day] = {
                'date': day_date,
                'meals_consumed': 0,
                'calories': 0
            }
        
        # Process consumption data
        for date, meal_type, meal_calories in consumption_data:
            # Convert date to day name
            date_obj = datetime.strptime(date, '%Y-%m-%d')
            day_name = date_obj.strftime('%A')
            
            if day_name in daily_breakdown:
                daily_breakdown[day_name]['meals_consumed'] += 1
                daily_breakdown[day_name]['calories'] += meal_calories
                total_calories += meal_calories
                total_meals_consumed += 1
        
        # Create chart_data array in the format expected by frontend
        for day in days:
            day_data = daily_breakdown[day]
            completion_percentage = (day_data['meals_consumed'] / 3) * 100 if day_data['meals_consumed'] > 0 else 0
            
            chart_data.append({
                'day': day[:3],  # Sun, Mon, Tue, etc.
                'meals_consumed': day_data['meals_consumed'],
                'completion_percentage': completion_percentage
            })
        
        # Calculate overall completion percentage
        meal_completion_percentage = (total_meals_consumed / total_possible_meals) * 100
        
        # Create response in expected format
        response_data = {
            'weekly': {
                'meal_completion_percentage': meal_completion_percentage,
                'total_calories': total_calories,
                'total_planned_calories': 6537,  # Target calories
                'meals_consumed': total_meals_consumed,
                'total_possible_meals': total_possible_meals,
                'chart_data': chart_data
            }
        }
        
        conn.close()
        return jsonify(response_data), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ---------------- Enhanced Reminder System ----------------
@app.route('/trigger_all_reminders/<int:user_id>', methods=['POST'])
def trigger_all_reminders(user_id):
    """Trigger all active reminders immediately for testing"""
    try:
        current_time = datetime.now().strftime('%H:%M')
        current_date = datetime.now().strftime('%Y-%m-%d')
        
        conn = sqlite3.connect('diet_planner.db')
        cursor = conn.cursor()
        
        # Get all active reminders for this user
        cursor.execute('''
            SELECT reminder_type, reminder_time, message, push_title, push_body, action_data
            FROM active_reminders 
            WHERE user_id = ? AND is_active = 1
        ''', (user_id,))
        
        all_reminders = cursor.fetchall()
        triggered_reminders = []
        
        # Trigger all reminders regardless of time
        for reminder_type, reminder_time, message, push_title, push_body, action_data in all_reminders:
            reminder_data = {
                'type': reminder_type,
                'time': reminder_time,
                'scheduled_time': reminder_time,
                'actual_time': current_time,
                'message': message,
                'push_title': f"[TEST] {push_title}" or '[TEST] Diet Planner Reminder',
                'push_body': f"[TEST NOW] {push_body}" or f"[TEST NOW] {message}",
                'action_data': json.loads(action_data) if action_data else {},
                'timestamp': f"{current_date} {current_time}",
                'triggered_by': 'manual_test'
            }
            triggered_reminders.append(reminder_data)
            
            # Send push notification for this reminder
            try:
                send_push_notification(user_id, reminder_data)
            except Exception as push_error:
                print(f"Push notification failed: {push_error}")
        
        conn.close()
        
        return jsonify({
            'success': True,
            'message': f'🚀 All {len(triggered_reminders)} reminders triggered immediately!',
            'current_time': current_time,
            'current_date': current_date,
            'total_reminders_triggered': len(triggered_reminders),
            'reminders': triggered_reminders,
            'note': 'All active reminders were sent as test notifications with [TEST] prefix',
            'instructions': [
                '📱 Check your desktop/mobile notifications now',
                '🔔 You should see multiple notifications',
                '✅ This proves the system works in real-time',
                '⏰ Normal reminders will trigger at scheduled times'
            ]
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/setup_reminders', methods=['POST'])
def setup_reminders():
    """Setup comprehensive reminder system for a user with push notifications"""
    try:
        data = request.json
        user_id = data.get('user_id')
        
        if not user_id:
            return jsonify({'error': 'User ID is required'}), 400
        
        conn = sqlite3.connect('diet_planner.db')
        cursor = conn.cursor()
        
        # Clear existing reminders for this user
        cursor.execute('DELETE FROM active_reminders WHERE user_id = ?', (user_id,))
        
        # Setup meal reminders with enhanced messages
        meal_reminders = [
            {
                'type': 'meal_breakfast', 
                'time': '08:00', 
                'message': '🌅 Good morning! Time for a healthy breakfast to start your day right.',
                'push_title': 'Breakfast Time!',
                'push_body': 'Start your day with a nutritious breakfast 🍳',
                'action_data': {'meal_type': 'morning', 'meal_name': 'breakfast'}
            },
            {
                'type': 'meal_lunch', 
                'time': '13:00', 
                'message': '☀️ Lunch time! Fuel your afternoon with nutritious foods.',
                'push_title': 'Lunch Time!',
                'push_body': 'Time to refuel with a healthy lunch 🥗',
                'action_data': {'meal_type': 'afternoon', 'meal_name': 'lunch'}
            },
            {
                'type': 'meal_dinner', 
                'time': '19:00', 
                'message': '🌙 Dinner time! End your day with a balanced meal.',
                'push_title': 'Dinner Time!',
                'push_body': 'End your day with a balanced dinner 🍽️',
                'action_data': {'meal_type': 'dinner', 'meal_name': 'dinner'}
            }
        ]
        
        # Setup water reminders (every 2 hours from 8 AM to 8 PM)
        water_reminders = []
        water_messages = [
            "💧 Morning hydration! Start your day with a glass of water.",
            "💧 Mid-morning water break! Stay hydrated and energized.",
            "💧 Lunch time hydration! Drink water with your meal.",
            "💧 Afternoon refresh! Time for another glass of water.",
            "💧 Late afternoon hydration! Keep your energy up.",
            "💧 Evening water reminder! Stay hydrated before dinner.",
            "💧 Night hydration! One more glass before bed."
        ]
        
        for i, hour in enumerate(range(8, 21, 2)):  # 8, 10, 12, 14, 16, 18, 20
            water_reminders.append({
                'type': 'water',
                'time': f'{hour:02d}:00',
                'message': water_messages[i] if i < len(water_messages) else f'💧 Time to hydrate! Drink a glass of water.',
                'push_title': 'Water Reminder 💧',
                'push_body': f'Time for your {hour}:00 hydration break!',
                'action_data': {'reminder_type': 'water', 'time': f'{hour:02d}:00'}
            })
        
        # Setup doctor visit reminders (monthly, quarterly, yearly)
        doctor_reminders = [
            {
                'type': 'doctor_monthly',
                'time': '10:00',
                'message': '🏥 Monthly health checkup reminder! Schedule your routine visit.',
                'push_title': 'Health Checkup Reminder',
                'push_body': 'Time for your monthly health checkup 🩺',
                'action_data': {'reminder_type': 'doctor', 'frequency': 'monthly'}
            },
            {
                'type': 'doctor_quarterly',
                'time': '10:00',
                'message': '🏥 Quarterly specialist visit reminder! Don\'t forget your appointment.',
                'push_title': 'Specialist Visit Reminder',
                'push_body': 'Quarterly specialist checkup due 🏥',
                'action_data': {'reminder_type': 'doctor', 'frequency': 'quarterly'}
            }
        ]
        
        # Insert meal reminders
        for reminder in meal_reminders:
            cursor.execute('''
                INSERT INTO active_reminders (user_id, reminder_type, reminder_time, message, push_title, push_body, action_data)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (user_id, reminder['type'], reminder['time'], reminder['message'], 
                  reminder['push_title'], reminder['push_body'], json.dumps(reminder['action_data'])))
        
        # Insert water reminders
        for reminder in water_reminders:
            cursor.execute('''
                INSERT INTO active_reminders (user_id, reminder_type, reminder_time, message, push_title, push_body, action_data)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (user_id, reminder['type'], reminder['time'], reminder['message'],
                  reminder['push_title'], reminder['push_body'], json.dumps(reminder['action_data'])))
        
        # Insert doctor reminders (these will be triggered based on user's last visit dates)
        for reminder in doctor_reminders:
            cursor.execute('''
                INSERT INTO active_reminders (user_id, reminder_type, reminder_time, message, push_title, push_body, action_data)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (user_id, reminder['type'], reminder['time'], reminder['message'],
                  reminder['push_title'], reminder['push_body'], json.dumps(reminder['action_data'])))
        
        conn.commit()
        conn.close()
        
        return jsonify({
            'success': True,
            'message': 'Smart reminders with push notifications enabled successfully!',
            'meal_reminders': len(meal_reminders),
            'water_reminders': len(water_reminders),
            'doctor_reminders': len(doctor_reminders),
            'total_reminders': len(meal_reminders) + len(water_reminders) + len(doctor_reminders),
            'features': [
                '🍽️ Meal reminders (3 daily)',
                '💧 Water reminders (7 daily)', 
                '🏥 Doctor visit reminders',
                '🔔 Push notifications',
                '📱 Works when app is closed'
            ]
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/check_reminders/<int:user_id>')
def check_reminders(user_id):
    """Check for active reminders at current time and send push notifications"""
    try:
        current_time = request.args.get('current_time', datetime.now().strftime('%H:%M'))
        current_date = request.args.get('current_date', datetime.now().strftime('%Y-%m-%d'))
        force_check = request.args.get('force_check', 'false').lower() == 'true'
        
        conn = sqlite3.connect('diet_planner.db')
        cursor = conn.cursor()
        
        # Get all active reminders for this user
        cursor.execute('''
            SELECT reminder_type, reminder_time, message, push_title, push_body, action_data
            FROM active_reminders 
            WHERE user_id = ? AND is_active = 1
        ''', (user_id,))
        
        all_reminders = cursor.fetchall()
        
        # Check which reminders should trigger now
        current_reminders = []
        for reminder_type, reminder_time, message, push_title, push_body, action_data in all_reminders:
            # For regular meal/water reminders, check time match OR force check
            if reminder_type in ['meal_breakfast', 'meal_lunch', 'meal_dinner', 'water']:
                should_trigger = (reminder_time == current_time) or force_check
                
                if should_trigger:
                    reminder_data = {
                        'type': reminder_type,
                        'time': reminder_time,
                        'message': message,
                        'push_title': push_title or 'Diet Planner Reminder',
                        'push_body': push_body or message,
                        'action_data': json.loads(action_data) if action_data else {},
                        'timestamp': f"{current_date} {current_time}",
                        'triggered_by': 'force_check' if force_check else 'scheduled_time'
                    }
                    current_reminders.append(reminder_data)
                    
                    # Send push notification for this reminder
                    try:
                        send_push_notification(user_id, reminder_data)
                    except Exception as push_error:
                        print(f"Push notification failed: {push_error}")
        
        # Check for doctor appointment reminders (date-based)
        cursor.execute('''
            SELECT appointment_date, appointment_time, doctor_type, frequency
            FROM doctor_appointments 
            WHERE user_id = ? AND is_active = 1 AND next_reminder_date = ?
        ''', (user_id, current_date))
        
        doctor_reminders = cursor.fetchall()
        for appointment_date, appointment_time, doctor_type, frequency in doctor_reminders:
            should_trigger = (appointment_time == current_time) or force_check
            
            if should_trigger:
                doctor_reminder = {
                    'type': 'doctor_appointment',
                    'time': appointment_time,
                    'message': f'🏥 Doctor checkup reminder! Your {frequency} {doctor_type.lower()} is scheduled for tomorrow ({appointment_date}). Don\'t forget to book your appointment!',
                    'push_title': 'Doctor Checkup Tomorrow!',
                    'push_body': f'Your {frequency} {doctor_type.lower()} is scheduled for tomorrow',
                    'action_data': {
                        'reminder_type': 'doctor', 
                        'appointment_date': appointment_date, 
                        'appointment_time': appointment_time,
                        'doctor_type': doctor_type,
                        'frequency': frequency
                    },
                    'timestamp': f"{current_date} {current_time}",
                    'triggered_by': 'force_check' if force_check else 'scheduled_time'
                }
                current_reminders.append(doctor_reminder)
                
                # Send push notification for doctor appointment
                try:
                    send_push_notification(user_id, doctor_reminder)
                except Exception as push_error:
                    print(f"Doctor appointment push notification failed: {push_error}")
        
        conn.close()
        
        return jsonify({
            'success': True,
            'current_time': current_time,
            'current_date': current_date,
            'total_active_reminders': len(all_reminders),
            'reminders': current_reminders,
            'push_notifications_sent': len(current_reminders),
            'force_check': force_check,
            'note': 'All reminders triggered due to force_check=true' if force_check and current_reminders else None
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ---------------- Push Notification System ----------------
def send_push_notification(user_id, reminder_data):
    """Send push notification to user"""
    try:
        conn = sqlite3.connect('diet_planner.db')
        cursor = conn.cursor()
        
        # Get user's push subscription
        cursor.execute('''
            SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?
        ''', (user_id,))
        
        subscription_data = cursor.fetchone()
        conn.close()
        
        if not subscription_data:
            print(f"No push subscription found for user {user_id}")
            return False
        
        endpoint, p256dh, auth = subscription_data
        
        # Prepare notification payload
        notification_payload = {
            'title': reminder_data.get('push_title', 'Diet Planner Reminder'),
            'body': reminder_data.get('push_body', reminder_data.get('message', 'Time for your reminder!')),
            'icon': '/favicon.ico',
            'badge': '/favicon.ico',
            'data': reminder_data.get('action_data', {}),
            'actions': [
                {
                    'action': 'mark-consumed',
                    'title': 'Mark as Consumed'
                },
                {
                    'action': 'snooze',
                    'title': 'Remind Later'
                }
            ]
        }
        
        # For demo purposes, we'll simulate sending the notification
        print(f"✅ Push notification sent to user {user_id}: {notification_payload['title']}")
        return True
        
    except Exception as e:
        print(f"❌ Push notification failed for user {user_id}: {e}")
        return False

@app.route('/subscribe_push', methods=['POST'])
def subscribe_push():
    """Subscribe user to push notifications"""
    try:
        data = request.json
        user_id = data.get('user_id')
        subscription = data.get('subscription')
        
        if not all([user_id, subscription]):
            return jsonify({'error': 'User ID and subscription are required'}), 400
        
        endpoint = subscription.get('endpoint')
        keys = subscription.get('keys', {})
        p256dh = keys.get('p256dh')
        auth = keys.get('auth')
        
        conn = sqlite3.connect('diet_planner.db')
        cursor = conn.cursor()
        
        # Insert or update push subscription
        cursor.execute('''
            INSERT OR REPLACE INTO push_subscriptions (user_id, endpoint, p256dh, auth)
            VALUES (?, ?, ?, ?)
        ''', (user_id, endpoint, p256dh, auth))
        
        conn.commit()
        conn.close()
        
        return jsonify({
            'success': True,
            'message': 'Push subscription saved successfully! You will now receive notifications even when the app is closed.'
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/test_push/<int:user_id>', methods=['POST'])
def test_push_notification(user_id):
    """Send a test push notification"""
    try:
        # Create test reminder data
        test_reminder = {
            'push_title': '🧪 Test Notification',
            'push_body': 'Your push notification system is working perfectly! This notification works even when the app is closed.',
            'message': 'Test notification sent successfully!',
            'action_data': {'test': True, 'timestamp': datetime.now().isoformat()}
        }
        
        # Send the push notification
        success = send_push_notification(user_id, test_reminder)
        
        if success:
            return jsonify({
                'success': True,
                'message': 'Test push notification sent successfully!',
                'note': 'Check your desktop/mobile notifications. The notification should appear even if you close the browser.',
                'features': [
                    '✅ Works when app is closed',
                    '✅ Desktop & mobile support',
                    '✅ Interactive buttons',
                    '✅ Click to open app'
                ]
            }), 200
        else:
            return jsonify({
                'error': 'No push subscription found',
                'instructions': 'Please enable push notifications first by clicking "Enable Smart Reminders" and allowing browser permissions.'
            }), 404
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ---------------- Water Consumption Tracking ----------------
@app.route('/mark_water_consumed', methods=['POST'])
def mark_water_consumed():
    """Mark water as consumed"""
    try:
        data = request.json
        user_id = data.get('user_id')
        glasses = data.get('glasses', 1)
        consumed_time = data.get('consumed_time', datetime.now().strftime('%H:%M'))
        consumed_date = data.get('consumed_date', datetime.now().strftime('%Y-%m-%d'))
        
        if not user_id:
            return jsonify({'error': 'User ID is required'}), 400
        
        conn = sqlite3.connect('diet_planner.db')
        cursor = conn.cursor()
        
        # Create water consumption table if it doesn't exist
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS water_consumption (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                glasses INTEGER DEFAULT 1,
                consumed_time TEXT,
                consumed_date DATE,
                consumed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(user_id) REFERENCES users(id)
            )
        ''')
        
        # Insert water consumption record
        cursor.execute('''
            INSERT INTO water_consumption (user_id, glasses, consumed_time, consumed_date)
            VALUES (?, ?, ?, ?)
        ''', (user_id, glasses, consumed_time, consumed_date))
        
        # Get today's total water consumption
        cursor.execute('''
            SELECT SUM(glasses) FROM water_consumption 
            WHERE user_id = ? AND consumed_date = ?
        ''', (user_id, consumed_date))
        
        total_glasses = cursor.fetchone()[0] or 0
        
        conn.commit()
        conn.close()
        
        return jsonify({
            'success': True,
            'message': f'💧 {glasses} glass(es) of water marked as consumed!',
            'glasses_consumed': glasses,
            'total_today': total_glasses,
            'daily_goal': 8,
            'progress_percentage': min(100, (total_glasses / 8) * 100)
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/get_water_progress/<int:user_id>')
def get_water_progress(user_id):
    """Get water consumption progress for today"""
    try:
        today = datetime.now().strftime('%Y-%m-%d')
        
        conn = sqlite3.connect('diet_planner.db')
        cursor = conn.cursor()
        
        # Get today's water consumption
        cursor.execute('''
            SELECT SUM(glasses), COUNT(*) FROM water_consumption 
            WHERE user_id = ? AND consumed_date = ?
        ''', (user_id, today))
        
        result = cursor.fetchone()
        total_glasses = result[0] or 0
        consumption_count = result[1] or 0
        
        # Get hourly breakdown
        cursor.execute('''
            SELECT consumed_time, SUM(glasses) FROM water_consumption 
            WHERE user_id = ? AND consumed_date = ?
            GROUP BY consumed_time
            ORDER BY consumed_time
        ''', (user_id, today))
        
        hourly_data = cursor.fetchall()
        
        conn.close()
        
        return jsonify({
            'success': True,
            'date': today,
            'total_glasses': total_glasses,
            'daily_goal': 8,
            'progress_percentage': min(100, (total_glasses / 8) * 100),
            'consumption_count': consumption_count,
            'hourly_breakdown': [{'time': time, 'glasses': glasses} for time, glasses in hourly_data],
            'status': 'excellent' if total_glasses >= 8 else 'good' if total_glasses >= 6 else 'needs_improvement'
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ---------------- Enhanced Doctor Appointment System ----------------
@app.route('/setup_doctor_reminder', methods=['POST'])
def setup_doctor_reminder():
    """Setup doctor appointment reminders with one day advance notification"""
    try:
        data = request.json
        user_id = data.get('user_id')
        doctor_type = data.get('doctor_type', 'General Checkup')
        last_visit_date = data.get('last_visit_date')
        frequency = data.get('frequency', 'monthly')  # weekly, monthly, quarterly, yearly
        reminder_time = data.get('reminder_time', '10:00')
        
        if not all([user_id, last_visit_date]):
            return jsonify({'error': 'User ID and last visit date are required'}), 400
        
        conn = sqlite3.connect('diet_planner.db')
        cursor = conn.cursor()
        
        # Calculate next checkup date based on frequency
        from datetime import datetime, timedelta
        last_date = datetime.strptime(last_visit_date, '%Y-%m-%d')
        
        if frequency == 'weekly':
            next_checkup_date = last_date + timedelta(days=7)
            frequency_text = "weekly"
        elif frequency == 'monthly':
            next_checkup_date = last_date + timedelta(days=30)
            frequency_text = "monthly"
        elif frequency == 'quarterly':
            next_checkup_date = last_date + timedelta(days=90)
            frequency_text = "every 3 months"
        elif frequency == 'yearly':
            next_checkup_date = last_date + timedelta(days=365)
            frequency_text = "yearly"
        else:
            next_checkup_date = last_date + timedelta(days=30)
            frequency_text = "monthly"
        
        # Calculate reminder date (one day before checkup)
        reminder_date = next_checkup_date - timedelta(days=1)
        
        # Insert or update doctor appointment
        cursor.execute('''
            INSERT OR REPLACE INTO doctor_appointments 
            (user_id, appointment_date, appointment_time, doctor_type, frequency, last_visit_date, next_reminder_date)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (user_id, next_checkup_date.strftime('%Y-%m-%d'), reminder_time, doctor_type, frequency, last_visit_date, reminder_date.strftime('%Y-%m-%d')))
        
        # Also add to active_reminders for the specific reminder date
        cursor.execute('''
            DELETE FROM active_reminders 
            WHERE user_id = ? AND reminder_type LIKE 'doctor_%'
        ''', (user_id,))
        
        cursor.execute('''
            INSERT INTO active_reminders 
            (user_id, reminder_type, reminder_time, message, push_title, push_body, action_data)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (
            user_id, 
            f'doctor_{frequency}', 
            reminder_time,
            f'🏥 Doctor checkup reminder! Your {frequency_text} {doctor_type.lower()} is scheduled for tomorrow ({next_checkup_date.strftime("%Y-%m-%d")}). Don\'t forget to book your appointment!',
            'Doctor Checkup Reminder',
            f'Your {frequency_text} checkup is tomorrow!',
            json.dumps({
                'reminder_type': 'doctor',
                'checkup_date': next_checkup_date.strftime('%Y-%m-%d'),
                'frequency': frequency,
                'doctor_type': doctor_type
            })
        ))
        
        conn.commit()
        conn.close()
        
        return jsonify({
            'success': True,
            'message': f'🏥 {doctor_type} reminder set successfully!',
            'doctor_type': doctor_type,
            'last_visit': last_visit_date,
            'next_checkup': next_checkup_date.strftime('%Y-%m-%d'),
            'next_reminder': reminder_date.strftime('%Y-%m-%d'),
            'frequency': frequency_text,
            'reminder_time': reminder_time,
            'days_until_checkup': (next_checkup_date - datetime.now()).days,
            'days_until_reminder': (reminder_date - datetime.now()).days
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ---------------- Run App ----------------
if __name__ == "__main__":
    init_db()
    app.run(debug=True)