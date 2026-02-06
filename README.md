# Diet Planner

A comprehensive diet planning application with React frontend and Flask backend.

## Features

- **User Authentication**: Secure login and registration system
- **Smart Food Selection**: Browse and select foods by meal type (breakfast, lunch, dinner)
- **7-Day Diet Planning**: Generate personalized weekly meal plans
- **Budget Management**: Plan meals within your specified budget
- **Modern UI**: Beautiful dark theme with glassmorphism effects
- **Responsive Design**: Works seamlessly on desktop and mobile devices

## Tech Stack

### Frontend
- React.js
- Modern CSS with glassmorphism effects
- Responsive design
- Toast notifications

### Backend
- Flask (Python)
- SQLite database
- RESTful API design
- CORS enabled for cross-origin requests

## Project Structure

```
diet_planner/
├── diet-planner-frontend/     # React frontend
│   ├── src/
│   │   ├── App.js            # Main React component
│   │   ├── App.css           # Main styles
│   │   └── modern-colors.css # Color scheme
│   └── package.json
├── diet_planner/             # Flask backend
│   ├── app.py               # Main Flask application
│   └── diet_planner.db      # SQLite database
└── README.md
```

## Installation & Setup

### Backend Setup
1. Navigate to the backend directory:
   ```bash
   cd diet_planner
   ```

2. Install Python dependencies:
   ```bash
   pip install flask flask-cors sqlite3
   ```

3. Run the Flask server:
   ```bash
   python app.py
   ```
   The backend will run on `http://localhost:5000`

### Frontend Setup
1. Navigate to the frontend directory:
   ```bash
   cd diet-planner-frontend
   ```

2. Install Node.js dependencies:
   ```bash
   npm install
   ```

3. Start the React development server:
   ```bash
   npm start
   ```
   The frontend will run on `http://localhost:3000`

## Usage

1. **Register/Login**: Create an account or login with existing credentials
2. **Set Budget**: Enter your daily food budget
3. **Select Foods**: Browse and select foods for breakfast, lunch, and dinner
4. **Generate Plan**: Create your 7-day diet plan
5. **View Plan**: Review your personalized weekly meal schedule

## API Endpoints

- `POST /register` - User registration
- `POST /login` - User authentication
- `GET /foods/<meal_type>` - Get foods by meal type
- `POST /generate_plan` - Generate 7-day diet plan

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

This project is open source and available under the MIT License.