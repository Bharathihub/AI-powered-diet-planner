import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';
import './modern-colors.css';

function App() {
    const [user, setUser] = useState(null);
    const [currentView, setCurrentView] = useState('home');
    const [selectedFoods, setSelectedFoods] = useState({
        morning: [],
        afternoon: [],
        dinner: []
    });
    const [availableFoods, setAvailableFoods] = useState({
        morning: [],
        afternoon: [],
        dinner: []
    });
    const [weeklyMealPlan, setWeeklyMealPlan] = useState(null);
    const [currentDay, setCurrentDay] = useState('Sunday');
    const [showNotification, setShowNotification] = useState(false);
    const [notificationMessage, setNotificationMessage] = useState('');
    const [chatInput, setChatInput] = useState('');
    const [chatMessages, setChatMessages] = useState([]);
    const [chatLoading, setChatLoading] = useState(false);
    const [dashboardData, setDashboardData] = useState(null);
    const [consumptionStatus, setConsumptionStatus] = useState({});
    const [dayCompletion, setDayCompletion] = useState({});
    const [weeklyDashboard, setWeeklyDashboard] = useState(null);
    const [showChatbot, setShowChatbot] = useState(false);
    const [lastCheckupDate, setLastCheckupDate] = useState('');
    const [checkupFrequency, setCheckupFrequency] = useState('monthly');
    const [activeRemindersCount, setActiveRemindersCount] = useState(0);

    // Set axios base URL
    axios.defaults.baseURL = 'http://127.0.0.1:5000';

    const getCurrentDayName = () => {
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const today = new Date();
        return days[today.getDay()];
    };

    const getDayDate = (dayName) => {
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const today = new Date();
        const currentDayIndex = today.getDay();
        const targetDayIndex = days.indexOf(dayName);
        
        // Calculate the date for the target day in the current week
        const dayDifference = targetDayIndex - currentDayIndex;
        const targetDate = new Date(today);
        targetDate.setDate(today.getDate() + dayDifference);
        
        return targetDate.toISOString().split('T')[0];
    };

    const showNotificationMessage = (message, type = 'success') => {
        setNotificationMessage(message);
        setShowNotification(true);
        setTimeout(() => setShowNotification(false), 3000);
    };

    const handleLogin = async (formData) => {
        try {
            const response = await axios.post('/login', formData);
            if (response.data && response.data.user_id) {
                const userData = { id: response.data.user_id, name: formData.name };
                setUser(userData);
                showNotificationMessage(`Welcome back, ${formData.name}!`);
                
                // Check if user has an active meal plan and redirect accordingly
                const { has_active_plan, plan_is_current_week, redirect_to } = response.data;
                
                if (has_active_plan && plan_is_current_week) {
                    // User has an ongoing weekly plan, take them to weekly plan page
                    setCurrentView('weeklyPlan');
                    showNotificationMessage('Continuing your weekly meal plan. Mark meals as consumed when you eat them!');
                    
                    // Load their existing meal plan
                    try {
                        const planResponse = await axios.get(`/get_saved_meal_plan/${userData.id}`);
                        if (planResponse.data && planResponse.data.meal_plan) {
                            setWeeklyMealPlan(planResponse.data.meal_plan);
                        }
                    } catch (planError) {
                        console.warn('Could not load saved meal plan:', planError);
                    }
                } else {
                    // No active plan or plan is old, go to dashboard
                    setCurrentView('dashboard');
                    if (has_active_plan && !plan_is_current_week) {
                        showNotificationMessage('Your previous meal plan has expired. Ready to create a new one?');
                    } else {
                        showNotificationMessage('Welcome back! Let\'s customize your meal plan.');
                    }
                }
            }
        } catch (error) {
            showNotificationMessage(error.response?.data?.error || 'Login failed', 'error');
        }
    };

    const handleRegister = async (formData) => {
        console.log('Registration attempt with data:', formData);
        
        try {
            // Validate required fields
            if (!formData.name || !formData.age || !formData.weight || !formData.height || !formData.health_conditions || !formData.diet_preference || !formData.password) {
                showNotificationMessage('Please fill in all required fields', 'error');
                return;
            }
            
            showNotificationMessage('Creating account...', 'info');
            
            const response = await axios.post('/register', formData);
            console.log('Registration response:', response.data);
            
            showNotificationMessage(response.data.message);
            
            if (response.data.message.includes('successfully')) {
                showNotificationMessage('Account created successfully! Logging you in...', 'success');
                
                // Auto-login after successful registration and go to customised meal plan
                setTimeout(async () => {
                    try {
                        const loginResponse = await axios.post('/login', { name: formData.name, password: formData.password });
                        console.log('Auto-login response:', loginResponse.data);
                        
                        if (loginResponse.data && loginResponse.data.user_id) {
                            const userData = { id: loginResponse.data.user_id, name: formData.name };
                            setUser(userData);
                            setCurrentView('dashboard'); // Go to customised meal plan page
                            showNotificationMessage('Welcome! Let\'s create your customised meal plan.');
                        }
                    } catch (loginError) {
                        console.error('Auto-login failed:', loginError);
                        showNotificationMessage('Registration successful! Please login to continue.', 'success');
                        setCurrentView('login');
                    }
                }, 1500);
            }
        } catch (error) {
            console.error('Registration error:', error);
            const errorMessage = error.response?.data?.error || error.message || 'Registration failed';
            showNotificationMessage(errorMessage, 'error');
        }
    };

    const loadAvailableFoods = async () => {
        if (!user) return;
        
        try {
            const response = await axios.get(`/available_foods/${user.id}`);
            if (response.data && response.data.foods_by_meal) {
                setAvailableFoods(response.data.foods_by_meal);
            }
        } catch (error) {
            showNotificationMessage('Failed to load foods', 'error');
        }
    };

    const toggleFoodSelection = (food, mealType) => {
        setSelectedFoods(prev => {
            const currentSelected = prev[mealType] || [];
            const isSelected = currentSelected.some(f => f.food === food.food);
            
            if (isSelected) {
                return {
                    ...prev,
                    [mealType]: currentSelected.filter(f => f.food !== food.food)
                };
            } else {
                return {
                    ...prev,
                    [mealType]: [...currentSelected, food]
                };
            }
        });
    };

    const generateWeeklyMealPlan = async () => {
        if (!user) return;
        
        try {
            const response = await axios.post('/generate_weekly_meal_plan', {
                user_id: user.id,
                selected_foods: selectedFoods
            });
            
            if (response.data && response.data.meal_plan) {
                setWeeklyMealPlan(response.data.meal_plan);

                // Move user to weekly plan immediately
                setCurrentView('weeklyPlan');
                showNotificationMessage('Weekly meal plan generated successfully!');

                // Try to persist the plan, but don't block navigation if it fails
                try {
                    await axios.post('/save_meal_plan', {
                        user_id: user.id,
                        meal_plan: response.data.meal_plan,
                        selected_foods: selectedFoods
                    });
                } catch (saveErr) {
                    console.warn('Failed to save meal plan', saveErr);
                    showNotificationMessage('Plan generated, but saving failed. You can still view it.', 'error');
                }
            } else {
                showNotificationMessage('Meal plan response missing', 'error');
            }
        } catch (error) {
            console.error('Generate meal plan failed', error?.response || error);
            const apiMsg = error?.response?.data?.error || 'Failed to generate meal plan';
            showNotificationMessage(apiMsg, 'error');
        }
    };

    const sendChatMessage = async () => {
        if (!chatInput.trim() || chatLoading) return;
        
        const userMessage = chatInput.trim();
        setChatMessages(prev => [...prev, { type: 'user', message: userMessage }]);
        setChatInput('');
        setChatLoading(true);
        
        try {
            // Include current day and meal plan context in the chat request
            const response = await axios.post('/chat', {
                user_id: user?.id,
                message: userMessage,
                current_day: currentDay,
                meal_plan: weeklyMealPlan
            });
            
            setChatMessages(prev => [...prev, { type: 'bot', message: response.data.response }]);
        } catch (error) {
            setChatMessages(prev => [...prev, { type: 'bot', message: 'Sorry, I encountered an error. Please try again.' }]);
        } finally {
            setChatLoading(false);
        }
    };

    const loadDashboard = async () => {
        if (!user) return;
        
        try {
            console.log('Loading dashboard for user:', user.id);
            const response = await axios.get(`/health_dashboard/${user.id}`);
            console.log('Dashboard response:', response.data);
            if (response.data) {
                setDashboardData(response.data);
            }
        } catch (error) {
            console.error('Dashboard loading error:', error);
            showNotificationMessage('Failed to load dashboard', 'error');
        }
    };

    const loadConsumptionStatus = async () => {
        if (!user) return;
        
        try {
            const response = await axios.get(`/get_consumption_status/${user.id}`);
            if (response.data) {
                setConsumptionStatus(response.data.consumption_status);
            }
        } catch (error) {
            console.log('Failed to load consumption status');
        }
    };

    const loadDayCompletion = async () => {
        if (!user) return;
        
        try {
            const response = await axios.get(`/get_day_completion_status/${user.id}`);
            if (response.data) {
                setDayCompletion(response.data.day_completion);
            }
        } catch (error) {
            console.log('Failed to load day completion status');
        }
    };

    const loadWeeklyDashboard = async () => {
        if (!user) return;
        
        try {
            const response = await axios.get(`/get_weekly_dashboard/${user.id}`);
            if (response.data) {
                setWeeklyDashboard(response.data.weekly_dashboard);
            }
        } catch (error) {
            console.log('Failed to load weekly dashboard');
        }
    };

    const markConsumedForDate = async (date, mealType, foods = []) => {
        if (!user) return;
        
        try {
            const response = await axios.post('/mark_consumed_for_date', {
                user_id: user.id,
                meal_type: mealType,
                date: date,
                foods: foods
            });
            
            if (response.data.success) {
                showNotificationMessage(response.data.message);
                // Reload consumption status and dashboard
                loadConsumptionStatus();
                loadDayCompletion();
                loadWeeklyDashboard();
                loadDashboard();
            }
        } catch (error) {
            showNotificationMessage('Failed to mark as consumed', 'error');
        }
    };

    const setupReminders = async () => {
        if (!user) return;
        
        try {
            // First, request notification permission
            if ('Notification' in window) {
                const permission = await Notification.requestPermission();
                if (permission !== 'granted') {
                    showNotificationMessage('Please allow notifications to receive reminders', 'error');
                    return;
                }
            }

            // Register service worker for push notifications
            if ('serviceWorker' in navigator && 'PushManager' in window) {
                try {
                    const registration = await navigator.serviceWorker.register('/sw.js');
                    console.log('Service Worker registered:', registration);

                    // Subscribe to push notifications
                    const subscription = await registration.pushManager.subscribe({
                        userVisibleOnly: true,
                        applicationServerKey: urlBase64ToUint8Array('BEl62iUYgUivxIkv69yViEuiBIa40HI80NM9f53NlqKOYWmCh_MoCpkHEHqdYrOcHcVwYDbC4VmMwWPLiGkn8ec') // Demo VAPID key
                    });

                    // Send subscription to server
                    await axios.post('/subscribe_push', {
                        user_id: user.id,
                        subscription: subscription.toJSON()
                    });

                    console.log('Push subscription successful');
                } catch (pushError) {
                    console.warn('Push notification setup failed:', pushError);
                    // Continue with regular reminders even if push fails
                }
            }

            // Setup reminders on server
            const response = await axios.post('/setup_reminders', {
                user_id: user.id
            });
            
            if (response.data) {
                const data = response.data;
                
                // Update active reminders count
                setActiveRemindersCount(data.total_reminders);
                
                showNotificationMessage(
                    `🎉 Smart reminders enabled! ${data.total_reminders} reminders set up with push notifications.`
                );
                
                // Show success details
                console.log('Reminders setup:', {
                    meal_reminders: data.meal_reminders,
                    water_reminders: data.water_reminders,
                    doctor_reminders: data.doctor_reminders,
                    features: data.features
                });
            }
        } catch (error) {
            console.error('Setup reminders error:', error);
            showNotificationMessage('Failed to setup reminders. Please try again.', 'error');
        }
    };

    const testPushNotification = async () => {
        if (!user) return;
        
        try {
            const response = await axios.post(`/test_push/${user.id}`);
            
            if (response.data.success) {
                showNotificationMessage('🧪 Test notification sent! Check your desktop/mobile notifications.');
                
                // Also show browser notification as fallback
                if ('Notification' in window && Notification.permission === 'granted') {
                    new Notification('🧪 Test Notification', {
                        body: 'Your push notification system is working perfectly!',
                        icon: '/favicon.ico',
                        tag: 'test-notification'
                    });
                }
            }
        } catch (error) {
            if (error.response?.status === 404) {
                showNotificationMessage('Please enable push notifications first by clicking "Enable Smart Reminders"', 'error');
            } else {
                showNotificationMessage('Failed to send test notification', 'error');
            }
        }
    };

    const testAllReminders = async () => {
        if (!user) return;
        
        try {
            const response = await axios.post(`/trigger_all_reminders/${user.id}`);
            
            if (response.data.success) {
                const data = response.data;
                showNotificationMessage(
                    `🚀 ${data.total_reminders_triggered} reminders sent! Check your notifications now.`
                );
                
                // Show detailed success info
                console.log('All reminders triggered:', {
                    total: data.total_reminders_triggered,
                    time: data.current_time,
                    reminders: data.reminders,
                    instructions: data.instructions
                });
                
                // Also show browser notification as confirmation
                if ('Notification' in window && Notification.permission === 'granted') {
                    new Notification('🎯 All Reminders Triggered!', {
                        body: `${data.total_reminders_triggered} test notifications sent. Check your notification panel!`,
                        icon: '/favicon.ico',
                        tag: 'all-reminders-test'
                    });
                }
            }
        } catch (error) {
            console.error('Test all reminders error:', error);
            showNotificationMessage('Failed to trigger all reminders. Please try again.', 'error');
        }
    };

    const checkRemindersNow = async () => {
        if (!user) return;
        
        try {
            const response = await axios.get(`/check_reminders/${user.id}`, {
                params: {
                    force_check: 'true'
                }
            });
            
            if (response.data.success) {
                const data = response.data;
                if (data.reminders.length > 0) {
                    showNotificationMessage(
                        `🔔 ${data.reminders.length} reminders triggered! Check your notifications.`
                    );
                } else {
                    showNotificationMessage(
                        '✅ Reminder system checked. No reminders to trigger right now.'
                    );
                }
            }
        } catch (error) {
            console.error('Check reminders error:', error);
            showNotificationMessage('Failed to check reminders. Please try again.', 'error');
        }
    };

    // Helper function to convert VAPID key
    const urlBase64ToUint8Array = (base64String) => {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding)
            .replace(/-/g, '+')
            .replace(/_/g, '/');

        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);

        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    };

    const setupDoctorReminder = async () => {
        console.log('Doctor reminder button clicked!');
        console.log('User:', user);
        console.log('Last checkup date:', lastCheckupDate);
        console.log('Checkup frequency:', checkupFrequency);
        
        if (!user) {
            showNotificationMessage('Please login first', 'error');
            return;
        }
        
        if (!lastCheckupDate) {
            showNotificationMessage('Please select your last checkup date', 'error');
            return;
        }
        
        try {
            showNotificationMessage('Setting up doctor reminder...', 'info');
            
            const requestData = {
                user_id: user.id,
                doctor_type: 'General Checkup',
                last_visit_date: lastCheckupDate,
                frequency: checkupFrequency,
                reminder_time: '10:00'
            };
            
            console.log('Sending request:', requestData);
            
            const response = await axios.post('/setup_doctor_reminder', requestData);
            
            console.log('Response:', response.data);
            
            if (response.data.success) {
                const data = response.data;
                showNotificationMessage(
                    `🏥 Doctor reminder set! Next checkup reminder: ${data.next_reminder} (${data.frequency})`
                );
                
                // Reset form
                setLastCheckupDate('');
                setCheckupFrequency('monthly');
            } else {
                showNotificationMessage('Failed to setup doctor reminder', 'error');
            }
        } catch (error) {
            console.error('Setup doctor reminder error:', error);
            const errorMessage = error.response?.data?.error || error.message || 'Failed to setup doctor reminder. Please try again.';
            showNotificationMessage(errorMessage, 'error');
        }
    };

    useEffect(() => {
        if (currentView === 'foodSelection' && user) {
            loadAvailableFoods();
        }
    }, [currentView, user]);

    useEffect(() => {
        if (currentView === 'healthDashboard' && user) {
            loadDashboard();
        }
    }, [currentView, user]);

    useEffect(() => {
        if (currentView === 'weeklyPlan' && user) {
            loadConsumptionStatus();
            loadDayCompletion();
            loadWeeklyDashboard();
        }
    }, [currentView, user]);

    useEffect(() => {
        if (currentView === 'healthDashboard' && user) {
            loadWeeklyDashboard();
            loadConsumptionStatus();
            loadDayCompletion();
        }
    }, [currentView, user]);

    useEffect(() => {
        if (currentView === 'weeklyProgress' && user) {
            loadDashboard();
            loadConsumptionStatus();
            loadDayCompletion();
        }
    }, [currentView, user]);

    const renderHome = () => (
        <div className="home-page">
            <div className="home-container">
                <div className="hero-section">
                    <div className="hero-content">
                        <div className="hero-badge">
                            <span>AI-POWERED</span>
                        </div>
                        <h1 className="hero-title">
                            <span className="gradient-text">Diet Planner</span>
                        </h1>
                        <p className="hero-description">
                            Get personalized diet recommendations based on your health 
                            conditions, preferences, and lifestyle with smart reminders to 
                            keep you on track.
                        </p>
                        <div className="hero-actions">
                            <button 
                                className="hero-btn primary-btn"
                                onClick={() => setCurrentView('register')}
                            >
                                GET STARTED
                            </button>
                            <button 
                                className="hero-btn secondary-btn"
                                onClick={() => setCurrentView('login')}
                            >
                                LOGIN
                            </button>
                        </div>
                    </div>
                    <div className="hero-visual">
                        <div className="floating-icons">
                            <div className="floating-icon icon-1">🍎</div>
                            <div className="floating-icon icon-2">🥗</div>
                            <div className="floating-icon icon-3">🥑</div>
                            <div className="floating-icon icon-4">🔔</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    const renderLogin = () => (
        <div className="login-page">
            <div className="login-container">
                <div className="login-card">
                    <div className="login-header">
                        <div className="login-icon">👋</div>
                        <h2>Welcome Back</h2>
                        <p>Continue your health journey</p>
                    </div>
                    <form className="login-form" onSubmit={(e) => {
                        e.preventDefault();
                        const formData = new FormData(e.target);
                        handleLogin({
                            name: formData.get('name'),
                            password: formData.get('password')
                        });
                    }}>
                        <div className="input-group">
                            <div className="input-label">Name</div>
                            <input 
                                type="text" 
                                name="name" 
                                className="modern-input"
                                placeholder="john" 
                                required 
                            />
                        </div>
                        <div className="input-group">
                            <div className="input-label">Password</div>
                            <input 
                                type="password" 
                                name="password" 
                                className="modern-input"
                                placeholder="••••" 
                                required 
                            />
                        </div>
                        <button type="submit" className="login-btn">
                            LOGIN →
                        </button>
                    </form>
                    <div className="login-footer">
                        <p>Don't have an account? 
                            <span 
                                className="register-link"
                                onClick={() => setCurrentView('register')}
                            >
                                Register here
                            </span>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );

    const renderRegister = () => (
        <div className="register-page">
            <div className="register-container">
                <div className="register-card">
                    <div className="register-header">
                        <div className="register-icon">✨</div>
                        <h2>Create Your Account</h2>
                        <p>Join thousands of users on their health journey</p>
                    </div>
                    <form className="register-form" onSubmit={(e) => {
                        e.preventDefault();
                        console.log('Form submitted!');
                        
                        const formData = new FormData(e.target);
                        const registrationData = {
                            name: formData.get('name'),
                            age: parseInt(formData.get('age')),
                            weight: parseFloat(formData.get('weight')),
                            height: parseFloat(formData.get('height')),
                            health_conditions: formData.get('health_conditions'),
                            diet_preference: formData.get('diet_preference'),
                            password: formData.get('password')
                        };
                        
                        console.log('Registration data:', registrationData);
                        handleRegister(registrationData);
                    }}>
                        <div className="input-group">
                            <div className="input-label">Full Name</div>
                            <input 
                                type="text" 
                                name="name" 
                                className="modern-input"
                                placeholder="" 
                                autoComplete="off"
                                required 
                            />
                        </div>
                        <div className="input-row">
                            <div className="input-group">
                                <div className="input-label">Age</div>
                                <input 
                                    type="number" 
                                    name="age" 
                                    className="modern-input"
                                    placeholder="" 
                                    autoComplete="off"
                                    required 
                                />
                            </div>
                            <div className="input-group">
                                <div className="input-label">Weight (kg)</div>
                                <input 
                                    type="number" 
                                    name="weight" 
                                    className="modern-input"
                                    placeholder="" 
                                    step="0.1" 
                                    autoComplete="off"
                                    required 
                                />
                            </div>
                        </div>
                        <div className="input-group">
                            <div className="input-label">Height (cm)</div>
                            <input 
                                type="number" 
                                name="height" 
                                className="modern-input"
                                placeholder="" 
                                autoComplete="off"
                                required 
                            />
                        </div>
                        <div className="input-group">
                            <div className="input-label">Health Condition</div>
                            <select name="health_conditions" className="modern-select" required>
                                <option value="">Select Health Condition</option>
                                <option value="normal">Normal Healthy Adult</option>
                                <option value="diabetes">Diabetes Management</option>
                                <option value="bp">Blood Pressure (BP)</option>
                                <option value="obesity">Obesity Management</option>
                                <option value="heart">Heart Disease Management</option>
                            </select>
                        </div>
                        <div className="input-group">
                            <div className="input-label">Diet Preference</div>
                            <select name="diet_preference" className="modern-select" required>
                                <option value="">Select Diet Preference</option>
                                <option value="veg">Vegetarian</option>
                                <option value="non-veg">Non-Vegetarian</option>
                            </select>
                        </div>
                        <div className="input-group">
                            <div className="input-label">Password</div>
                            <input 
                                type="password" 
                                name="password" 
                                className="modern-input"
                                placeholder="" 
                                autoComplete="off"
                                required 
                            />
                        </div>
                        <button 
                            type="submit" 
                            className="register-btn"
                            onClick={() => console.log('Create Account button clicked!')}
                        >
                            CREATE ACCOUNT →
                        </button>
                    </form>
                    <div className="register-footer">
                        <p>Already have an account? 
                            <span 
                                className="login-link"
                                onClick={() => setCurrentView('login')}
                            >
                                Login here
                            </span>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );

    const renderDashboard = () => (
        <div className="dashboard-page">
            <div className="dashboard-wrapper">
                <div className="dashboard-header-section">
                    <div className="welcome-card">
                        <div className="welcome-content">
                            <h1>Welcome back, <span className="user-name">{user?.name}</span>! 👋</h1>
                            <p>Ready to continue your health journey?</p>
                        </div>
                        <div className="header-controls">
                            <div className="reminder-badge">
                                <div className="pulse-dot"></div>
                                <span>Smart Reminders Active</span>
                            </div>
                            <button 
                                className="logout-button"
                                onClick={() => {
                                    setUser(null);
                                    setCurrentView('home');
                                    setSelectedFoods({ morning: [], afternoon: [], dinner: [] });
                                    setWeeklyMealPlan(null);
                                }}
                            >
                                Logout
                            </button>
                        </div>
                    </div>
                </div>

                <div className="main-features">
                    <div className="feature-card-modern">
                        <div className="card-header">
                            <div className="feature-icon meal-icon">🍽️</div>
                            <h2>Customized Meal Plans</h2>
                        </div>
                        <p className="feature-description">
                            AI-powered diet plans based on your health profile and preferences
                        </p>
                        <div className="feature-stats">
                            <div className="stat-item">
                                <span className="stat-value">100+</span>
                                <span className="stat-name">FOOD OPTIONS</span>
                            </div>
                            <div className="stat-item">
                                <span className="stat-value">7</span>
                                <span className="stat-name">DAY PLANNING</span>
                            </div>
                        </div>
                        <button 
                            className="feature-action-btn generate-plan-btn"
                            onClick={async () => {
                                // If meal plan exists, show confirmation before regenerating
                                if (weeklyMealPlan) {
                                    const confirmRegenerate = window.confirm(
                                        'You already have a meal plan. Do you want to create a new one? This will clear your current plan and consumption history.'
                                    );
                                    
                                    if (confirmRegenerate) {
                                        try {
                                            // Clear consumption status on backend
                                            await axios.post(`/clear_consumption_status/${user.id}`);
                                            
                                            setWeeklyMealPlan(null);
                                            setSelectedFoods({
                                                morning: [],
                                                afternoon: [],
                                                dinner: []
                                            });
                                            
                                            // Clear frontend consumption status
                                            setConsumptionStatus({});
                                            setDayCompletion({});
                                            setWeeklyDashboard(null);
                                            
                                            showNotificationMessage('Ready to create a new meal plan! Select your preferred foods.');
                                            setCurrentView('foodSelection');
                                        } catch (error) {
                                            console.error('Error clearing consumption status:', error);
                                            showNotificationMessage('Error clearing consumption history. Please try again.', 'error');
                                        }
                                    }
                                } else {
                                    showNotificationMessage('Let\'s create your personalized meal plan!');
                                    setCurrentView('foodSelection');
                                }
                            }}
                        >
                            {weeklyMealPlan ? '🔄 REGENERATE PLAN' : '🍎 GENERATE PLAN'}
                        </button>
                    </div>

                    <div className="feature-card-modern">
                        <div className="card-header">
                            <div className="feature-icon reminder-icon">🔔</div>
                            <h2>Smart Reminders</h2>
                        </div>
                        <p className="feature-description">
                            Intelligent notifications for water, meals, and doctor visits
                        </p>
                        <div className="feature-stats">
                            <div className="stat-item">
                                <span className="stat-value">{activeRemindersCount}</span>
                                <span className="stat-name">ACTIVE REMINDERS</span>
                            </div>
                            <div className="stat-item">
                                <span className="stat-value">24/7</span>
                                <span className="stat-name">MONITORING</span>
                            </div>
                        </div>
                        <button 
                            className="feature-action-btn setup-reminders-btn"
                            onClick={() => setCurrentView('smartReminders')}
                        >
                            🔔 SETUP REMINDERS
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );

    const renderFoodSelection = () => (
        <div className="page-container">
            <div className="food-selection-container">
                <div className="food-selection-header">
                    <div className="header-content">
                        <h1>Select Your Preferred Foods</h1>
                        <p>Choose foods you enjoy for each meal type. We'll create a personalized weekly plan.</p>
                    </div>
                    <div className="user-health-info">
                        <div className="health-badge">
                            <div className="badge-label">AGE</div>
                            <div className="badge-value">42</div>
                        </div>
                        <div className="health-badge">
                            <div className="badge-label">BMI</div>
                            <div className="badge-value">27.34</div>
                        </div>
                        <div className="health-badge">
                            <div className="badge-label">CONDITION</div>
                            <div className="badge-value">bp</div>
                        </div>
                    </div>
                </div>

                {['morning', 'afternoon', 'dinner'].map(mealType => (
                    <div key={mealType} className={`meal-category ${mealType === 'morning' ? 'breakfast' : mealType}`}>
                        <div className="meal-category-header">
                            <div className="meal-title-section">
                                <div className="meal-icon">
                                    {mealType === 'morning' ? '🌅' : mealType === 'afternoon' ? '☀️' : '🌙'}
                                </div>
                                <h2 className="meal-category-title">
                                    {mealType === 'morning' ? 'Breakfast' : mealType === 'afternoon' ? 'Lunch' : 'Dinner'}
                                </h2>
                            </div>
                            <div className="selection-counter">
                                <span className="counter-badge">
                                    {selectedFoods[mealType]?.length || 0} selected
                                </span>
                            </div>
                            <div className="meal-stats">
                                <span className="available-count">
                                    {availableFoods[mealType]?.length || 0} options available
                                </span>
                                <span className="scroll-hint">← Scroll to see more →</span>
                            </div>
                        </div>

                        <div className="food-selection-carousel">
                            <div className="food-cards-wrapper">
                                {availableFoods[mealType]?.map((food, index) => {
                                    const isSelected = selectedFoods[mealType]?.some(f => f.food === food.food);
                                    return (
                                        <div
                                            key={index}
                                            className={`food-option-card ${isSelected ? 'selected' : ''}`}
                                            onClick={() => toggleFoodSelection(food, mealType)}
                                        >
                                            <div className="food-card-header">
                                                <h3 className="food-name">
                                                    {food.veg_type === 'non-veg' ? '🍗' : '🥬'} {food.food}
                                                </h3>
                                                {isSelected && <div className="selection-check">✓</div>}
                                            </div>
                                            <div className="food-nutrition-grid">
                                                <div className="nutrition-item">
                                                    <div className="nutrition-label">CALORIES</div>
                                                    <div className="nutrition-value">{Math.round(food.calories)}</div>
                                                </div>
                                                <div className="nutrition-item">
                                                    <div className="nutrition-label">PROTEIN</div>
                                                    <div className="nutrition-value">{Math.round(food.protein)}g</div>
                                                </div>
                                                <div className="nutrition-item">
                                                    <div className="nutrition-label">FAT</div>
                                                    <div className="nutrition-value">{Math.round(food.fat)}g</div>
                                                </div>
                                                <div className="nutrition-item">
                                                    <div className="nutrition-label">CARBS</div>
                                                    <div className="nutrition-value">{Math.round(food.carbs)}g</div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                ))}

                <div className="food-selection-next-button">
                    <button 
                        onClick={generateWeeklyMealPlan}
                        className="next-btn"
                        disabled={Object.values(selectedFoods).flat().length === 0}
                    >
                        Next
                    </button>
                </div>
            </div>
        </div>
    );

    const renderWeeklyPlan = () => {
        if (!weeklyMealPlan) {
            return (
                <div className="page-container">
                    <div className="no-plan-container">
                        <h2>No meal plan generated yet</h2>
                        <p>Please select your preferred foods first</p>
                        <button onClick={() => setCurrentView('foodSelection')} className="generate-plan-btn">
                            Select Foods
                        </button>
                    </div>
                </div>
            );
        }

        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const currentDayMeals = weeklyMealPlan[currentDay] || {};
        
        // Calculate nutrition totals for current day
        const calculateDayNutrition = (dayMeals) => {
            let totalCalories = 0, totalProtein = 0, totalCarbs = 0, totalFat = 0;
            
            Object.values(dayMeals).forEach(meals => {
                if (Array.isArray(meals)) {
                    meals.forEach(meal => {
                        totalCalories += meal.calories || 0;
                        totalProtein += meal.protein || 0;
                        totalCarbs += meal.carbs || 0;
                        totalFat += meal.fat || 0;
                    });
                }
            });
            
            return { totalCalories, totalProtein, totalCarbs, totalFat };
        };

        const { totalCalories, totalProtein, totalCarbs, totalFat } = calculateDayNutrition(currentDayMeals);
        
        // Calculate percentages for donut chart
        const totalMacros = totalProtein + totalCarbs + totalFat;
        const proteinPercent = totalMacros > 0 ? Math.round((totalProtein / totalMacros) * 100) : 0;
        const carbsPercent = totalMacros > 0 ? Math.round((totalCarbs / totalMacros) * 100) : 0;
        const fatPercent = totalMacros > 0 ? Math.round((totalFat / totalMacros) * 100) : 0;

        return (
            <div className="weekly-plan-page">
                <div className="weekly-plan-container">
                    {/* Day Navigation */}
                    <div className="day-navigation-with-legend">
                        <div className="day-navigation">
                            {days.map(day => {
                                // Check if this day is completed based on day completion data
                                const dayDate = getDayDate(day);
                                const isCompleted = dayCompletion[dayDate] && dayCompletion[dayDate].is_complete;
                                
                                return (
                                    <button
                                        key={day}
                                        className={`day-button ${currentDay === day ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}
                                        onClick={() => setCurrentDay(day)}
                                    >
                                        {day}
                                        {isCompleted && <span className="completion-indicator">✓</span>}
                                    </button>
                                );
                            })}
                        </div>
                        <div className="symbol-indicators">
                            <span className="indicator-text">Legend:</span>
                            <div className="symbol-item">
                                <div className="symbol-icon selected">✓</div>
                                <span>Your Choice</span>
                            </div>
                            <div className="symbol-item">
                                <div className="symbol-icon recommended">★</div>
                                <span>Recommended</span>
                            </div>
                        </div>
                    </div>

                    <div className="meal-plan-layout">
                        {/* Left Side - Nutrition Chart */}
                        <div className="nutrition-section">
                            <div className="nutrition-chart">
                                <div className="donut-chart-container">
                                    <svg width="220" height="220" viewBox="0 0 220 220" className="donut-svg">
                                        <defs>
                                            <clipPath id="donutCircle">
                                                <circle cx="110" cy="110" r="110" />
                                            </clipPath>
                                        </defs>
                                        <g clipPath="url(#donutCircle)">
                                            {/* Protein segment (green) */}
                                            <circle
                                                cx="110"
                                                cy="110"
                                                r="80"
                                                fill="none"
                                                stroke="#10b981"
                                                strokeWidth="32"
                                                strokeDasharray={`${proteinPercent * 5.03} 503`}
                                                strokeDashoffset="0"
                                                transform="rotate(-90 110 110)"
                                                strokeLinecap="round"
                                            />
                                            
                                            {/* Carbs segment (blue) */}
                                            <circle
                                                cx="110"
                                                cy="110"
                                                r="80"
                                                fill="none"
                                                stroke="#3b82f6"
                                                strokeWidth="32"
                                                strokeDasharray={`${carbsPercent * 5.03} 503`}
                                                strokeDashoffset={`-${proteinPercent * 5.03}`}
                                                transform="rotate(-90 110 110)"
                                                strokeLinecap="round"
                                            />
                                            
                                            {/* Fat segment (orange) */}
                                            <circle
                                                cx="110"
                                                cy="110"
                                                r="80"
                                                fill="none"
                                                stroke="#f59e0b"
                                                strokeWidth="32"
                                                strokeDasharray={`${fatPercent * 5.03} 503`}
                                                strokeDashoffset={`-${(proteinPercent + carbsPercent) * 5.03}`}
                                                transform="rotate(-90 110 110)"
                                                strokeLinecap="round"
                                            />
                                        </g>
                                        
                                        {/* Center text - white background circle */}
                                        <circle cx="110" cy="110" r="49" fill="#f8fafc" />
                                        
                                        {/* Total Calories */}
                                        <text x="110" y="102" textAnchor="middle" className="donut-total-calories">
                                            {totalCalories}
                                        </text>
                                        
                                        {/* kcal label */}
                                        <text x="110" y="118" textAnchor="middle" className="donut-kcal-label">
                                            kcal
                                        </text>
                                    </svg>
                                </div>
                                
                                {/* Macro percentages - Horizontal below donut */}
                                <div className="macro-percentages-horizontal">
                                    <div className="macro-percent-item protein-percent">
                                        <span className="percent-label">{proteinPercent}% protein</span>
                                    </div>
                                    <div className="macro-percent-item carbs-percent">
                                        <span className="percent-label">{carbsPercent}% carbs</span>
                                    </div>
                                    <div className="macro-percent-item fat-percent">
                                        <span className="percent-label">{fatPercent}% fat</span>
                                    </div>
                                </div>
                                
                                <div className="nutrition-breakdown">
                                    <div className="macro-stat protein">
                                        <span className="macro-color"></span>
                                        <span className="macro-amount">{Math.round(totalProtein)}g protein</span>
                                    </div>
                                    <div className="macro-stat carbs">
                                        <span className="macro-color"></span>
                                        <span className="macro-amount">{Math.round(totalCarbs)}g carbs</span>
                                    </div>
                                    <div className="macro-stat fat">
                                        <span className="macro-color"></span>
                                        <span className="macro-amount">{Math.round(totalFat)}g fat</span>
                                    </div>
                                </div>
                                <div className="day-summary">
                                    <p>Tap a day above to view details. Each meal shows 3 food options.</p>
                                </div>
                            </div>
                        </div>

                        {/* Right Side - Meal Details */}
                        <div className="meals-section">
                            {['breakfast', 'lunch', 'dinner'].map(mealType => {
                                const meals = currentDayMeals[mealType === 'breakfast' ? 'morning' : mealType === 'lunch' ? 'afternoon' : 'dinner'] || [];
                                const currentDayDate = getDayDate(currentDay);
                                const isConsumed = consumptionStatus[currentDayDate]?.[mealType === 'breakfast' ? 'morning' : mealType === 'lunch' ? 'afternoon' : 'dinner'];
                                
                                return (
                                    <div key={mealType} className={`meal-card ${mealType} ${isConsumed ? 'consumed' : ''}`}>
                                        <div className="meal-header">
                                            <h3 className="meal-title">{mealType.charAt(0).toUpperCase() + mealType.slice(1)}</h3>
                                            <div className="meal-status">
                                                {isConsumed ? (
                                                    <span className="status-badge consumed">Consumed</span>
                                                ) : (
                                                    <span className="status-badge pending">Pending</span>
                                                )}
                                            </div>
                                        </div>
                                        
                                        <div className="meal-foods-list">
                                            {meals.slice(0, 3).map((meal, index) => (
                                                <div key={index} className="food-item">
                                                    <div className="food-header">
                                                        <div className={`food-symbol ${meal.isUserSelected ? 'selected' : 'recommended'}`}>
                                                            {meal.isUserSelected ? '✓' : '★'}
                                                        </div>
                                                        <h4 className="food-name">
                                                            {meal.veg_type === 'non-veg' ? '🍗' : '🥬'} {meal.food}
                                                        </h4>
                                                    </div>
                                                    <div className="food-nutrition">
                                                        <span>{meal.protein}g protein</span>
                                                        <span>{meal.fat}g fat</span>
                                                        <span>{meal.carbs}g carbs</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        
                                        <button 
                                            className={`consume-button ${isConsumed ? 'consumed' : ''}`}
                                            onClick={() => {
                                                const selectedDayDate = getDayDate(currentDay);
                                                const backendMealType = mealType === 'breakfast' ? 'morning' : mealType === 'lunch' ? 'afternoon' : 'dinner';
                                                markConsumedForDate(selectedDayDate, backendMealType, meals);
                                            }}
                                        >
                                            {isConsumed ? 'Mark as Not Consumed' : 'Mark as Consumed'}
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* AI Chatbot Section */}
                    <div className="ai-chatbot-section">
                        <div className="chatbot-header">
                            <div className="chatbot-title">
                                <span className="chatbot-icon">🤖</span>
                                <div>
                                    <h3>AI Recipe Assistant</h3>
                                    <p className="chatbot-subtitle">Ask me how to prepare your foods!</p>
                                </div>
                            </div>
                            <button 
                                className={`chat-toggle-btn ${showChatbot ? 'active' : ''}`}
                                onClick={() => setShowChatbot(!showChatbot)}
                            >
                                {showChatbot ? '−' : '+'}
                            </button>
                        </div>
                        
                        {showChatbot && (
                            <div className="chatbot-container">
                                <div className="chat-messages">
                                    {chatMessages.length === 0 && (
                                        <div className="chat-message ai-message">
                                            <div className="message-avatar">🤖</div>
                                            <div className="message-content">
                                                <div className="message-text">
                                                    Hello! I'm your recipe assistant. Ask me how to prepare any food from your meal plan!
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    {chatMessages.map((msg, index) => (
                                        <div key={index} className={`chat-message ${msg.type === 'user' ? 'user-message' : 'ai-message'}`}>
                                            <div className="message-avatar">
                                                {msg.type === 'user' ? '👤' : '🤖'}
                                            </div>
                                            <div className="message-content">
                                                <div className="message-text">{msg.message}</div>
                                            </div>
                                        </div>
                                    ))}
                                    {chatLoading && (
                                        <div className="chat-message ai-message">
                                            <div className="message-avatar">🤖</div>
                                            <div className="message-content">
                                                <div className="message-text">Thinking...</div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="chat-input-container">
                                    <input
                                        type="text"
                                        value={chatInput}
                                        onChange={(e) => setChatInput(e.target.value)}
                                        placeholder="Help me cook breakfast foods"
                                        onKeyPress={(e) => e.key === 'Enter' && sendChatMessage()}
                                        className="chat-input"
                                    />
                                    <button 
                                        onClick={sendChatMessage} 
                                        disabled={chatLoading || !chatInput.trim()}
                                        className="send-button"
                                    >
                                        Send
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Navigation Buttons */}
                    <div className="plan-navigation">
                        <button 
                            onClick={async () => {
                                // Show confirmation before regenerating
                                const confirmRegenerate = window.confirm(
                                    'Are you sure you want to regenerate your meal plan? This will clear your current plan and consumption history, and you\'ll need to select foods again.'
                                );
                                
                                if (confirmRegenerate) {
                                    try {
                                        // Clear consumption status on backend
                                        await axios.post(`/clear_consumption_status/${user.id}`);
                                        
                                        // Clear current meal plan and selected foods for regeneration
                                        setWeeklyMealPlan(null);
                                        setSelectedFoods({
                                            morning: [],
                                            afternoon: [],
                                            dinner: []
                                        });
                                        
                                        // Clear frontend consumption status
                                        setConsumptionStatus({});
                                        setDayCompletion({});
                                        setWeeklyDashboard(null);
                                        
                                        // Go to food selection to start fresh
                                        setCurrentView('foodSelection');
                                        showNotificationMessage('Ready to create a new meal plan! Select your preferred foods.');
                                    } catch (error) {
                                        console.error('Error clearing consumption status:', error);
                                        showNotificationMessage('Error clearing consumption history. Please try again.', 'error');
                                    }
                                }
                            }}
                            className="plan-bottom-button regenerate-plan-btn"
                        >
                            🔄 Regenerate Plan
                        </button>
                        <button 
                            onClick={() => setCurrentView('weeklyProgress')}
                            className="plan-bottom-button continue-plan-btn"
                        >
                            View Health Dashboard →
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    const renderSmartReminders = () => (
        <div className="smart-reminders-page">
            <div className="smart-reminders-container">
                <div className="reminders-header">
                    <h1>🔔 Smart Health Reminders</h1>
                    <p>Get push notifications for meals, water, and doctor visits - even when the app is closed!</p>
                    <div className="current-time">
                        🕐 Current Time: {new Date().toLocaleTimeString()} | {new Date().toLocaleDateString()}
                    </div>
                </div>

                <div className="reminders-grid">
                    {/* Meal Reminders Card */}
                    <div className="reminder-type-card meal-reminders">
                        <div className="reminder-icon">🍽️</div>
                        <h3>Meal Reminders</h3>
                        <p>Never miss breakfast, lunch, or dinner</p>
                        
                        <div className="reminder-times">
                            <span className="time-badge breakfast">🌅 08:00 Breakfast</span>
                            <span className="time-badge lunch">☀️ 13:00 Lunch</span>
                            <span className="time-badge dinner">🌙 19:00 Dinner</span>
                        </div>
                        

                    </div>

                    {/* Water Reminders Card */}
                    <div className="reminder-type-card water-reminders">
                        <div className="reminder-icon">💧</div>
                        <h3>Water Reminders</h3>
                        <p>Stay hydrated throughout the day</p>
                        
                        <div className="reminder-times">
                            <span className="time-badge water">Every 2 hours</span>
                            <span className="time-badge water">8 AM - 8 PM</span>
                            <span className="time-badge water">7 daily reminders</span>
                        </div>
                        

                    </div>

                    {/* Doctor Reminders Card */}
                    <div className="reminder-type-card doctor-reminders">
                        <div className="reminder-icon">🏥</div>
                        <h3>Doctor Visit Reminders</h3>
                        <p>Never miss important health checkups</p>
                        
                        <div className="doctor-form">
                            <div className="form-group">
                                <label className="form-label">Last Checkup Date:</label>
                                <input 
                                    type="date" 
                                    className="date-input"
                                    value={lastCheckupDate}
                                    onChange={(e) => setLastCheckupDate(e.target.value)}
                                />
                            </div>
                            
                            <div className="form-group">
                                <label className="form-label">Checkup Frequency:</label>
                                <select 
                                    className="frequency-select"
                                    value={checkupFrequency}
                                    onChange={(e) => setCheckupFrequency(e.target.value)}
                                >
                                    <option value="weekly">Weekly</option>
                                    <option value="monthly">Monthly</option>
                                    <option value="quarterly">Quarterly (3 months)</option>
                                    <option value="yearly">Yearly</option>
                                </select>
                            </div>
                            
                            <button 
                                className="set-doctor-reminder-btn"
                                onClick={() => {
                                    console.log('Button clicked!');
                                    setupDoctorReminder();
                                }}
                                disabled={!lastCheckupDate}
                            >
                                🏥 Set Doctor Reminder
                            </button>
                        </div>
                    </div>
                </div>

                {/* Main Action Buttons */}
                <div className="reminder-actions">
                    <button 
                        className="enable-reminders-btn primary"
                        onClick={setupReminders}
                    >
                        🔔 Enable All Smart Reminders
                    </button>

                </div>




            </div>
        </div>
    );

    const renderWeeklyProgress = () => (
        <div className="weekly-progress-page">
            <div className="progress-dashboard">
                <div className="dashboard-header">
                    <h1>Weekly Meal Progress</h1>
                </div>

                {dashboardData && (
                    <div className="dashboard-content-split">
                        <div className="progress-circle-section">
                            <div className="progress-circle-container">
                                <div className="progress-circle">
                                    <svg width="200" height="200" viewBox="0 0 200 200">
                                        <circle
                                            cx="100"
                                            cy="100"
                                            r="80"
                                            fill="none"
                                            stroke="#1e293b"
                                            strokeWidth="16"
                                        />
                                        <circle
                                            cx="100"
                                            cy="100"
                                            r="80"
                                            fill="none"
                                            stroke="#10b981"
                                            strokeWidth="16"
                                            strokeDasharray={`${(dashboardData.weekly.meal_completion_percentage / 100) * 502} 502`}
                                            strokeDashoffset="0"
                                            transform="rotate(-90 100 100)"
                                            className="progress-stroke"
                                        />
                                    </svg>
                                    <div className="progress-text">
                                        <div className="progress-percentage">
                                            {Math.round(dashboardData.weekly.meal_completion_percentage)}%
                                        </div>
                                        <div className="progress-label">Weekly Goal</div>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="progress-stats">
                                <div className="stat-item">
                                    <div className="stat-value">
                                        {dashboardData.weekly.total_calories} / {dashboardData.weekly.total_planned_calories} kcal consumed this week
                                    </div>
                                </div>
                                <div className="stat-item">
                                    <div className="stat-value">
                                        {dashboardData.weekly.meals_consumed} / {dashboardData.weekly.total_possible_meals} meals consumed
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bar-chart-section">
                            <div className="weekly-chart">
                                <h3 style={{textAlign: 'center', marginBottom: '20px', color: '#1e293b'}}>Daily Progress</h3>
                                <div className="chart-container">
                                    {dashboardData.weekly.chart_data && dashboardData.weekly.chart_data.map((day, index) => (
                                        <div key={index} className="chart-day">
                                            <div className="chart-bar-container">
                                                <div 
                                                    className={`chart-bar ${day.completion_percentage === 100 ? 'complete' : day.completion_percentage > 0 ? 'partial' : 'empty'}`}
                                                    style={{ height: `${Math.max(day.completion_percentage, 10)}%` }}
                                                ></div>
                                            </div>
                                            <div className="day-label">{day.day}</div>
                                            <div className="meal-count">{day.meals_consumed}/3</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {!dashboardData && (
                    <div className="loading-container">
                        <p>Loading your progress data...</p>
                        <p style={{fontSize: '0.9rem', marginTop: '10px', color: '#64748b'}}>
                            If this takes too long, try marking some meals as consumed first.
                        </p>
                    </div>
                )}

                <div className="navigation-buttons">
                    <button 
                        onClick={() => setCurrentView('weeklyPlan')}
                        className="nav-btn secondary"
                    >
                        ← Back to Weekly Plan
                    </button>
                </div>
            </div>
        </div>
    );

    const renderHealthDashboard = () => (
        <div className="health-dashboard-page">
            <div className="dashboard-container">
                <div className="dashboard-header">
                    <h1>Weekly Meal Progress</h1>
                </div>

                {dashboardData && (
                    <div className="dashboard-content">
                        <div className="progress-overview">
                            <div className="progress-circle-container">
                                <div className="progress-circle">
                                    <svg width="200" height="200" viewBox="0 0 200 200">
                                        <circle
                                            cx="100"
                                            cy="100"
                                            r="80"
                                            fill="none"
                                            stroke="#1e293b"
                                            strokeWidth="16"
                                        />
                                        <circle
                                            cx="100"
                                            cy="100"
                                            r="80"
                                            fill="none"
                                            stroke="#10b981"
                                            strokeWidth="16"
                                            strokeDasharray={`${(dashboardData.weekly.meal_completion_percentage / 100) * 502} 502`}
                                            strokeDashoffset="0"
                                            transform="rotate(-90 100 100)"
                                            className="progress-stroke"
                                        />
                                    </svg>
                                    <div className="progress-text">
                                        <div className="progress-percentage">
                                            {Math.round(dashboardData.weekly.meal_completion_percentage)}%
                                        </div>
                                        <div className="progress-label">Weekly Goal</div>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="progress-stats">
                                <div className="stat-item">
                                    <div className="stat-value">
                                        {dashboardData.weekly.total_calories} / {dashboardData.weekly.total_planned_calories} kcal consumed this week
                                    </div>
                                </div>
                                <div className="stat-item">
                                    <div className="stat-value">
                                        {dashboardData.weekly.meals_consumed} / {dashboardData.weekly.total_possible_meals} meals consumed
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="weekly-chart">
                            <div className="chart-container">
                                {dashboardData.weekly.chart_data.map((day, index) => (
                                    <div key={index} className="chart-day">
                                        <div className="chart-bar-container">
                                            <div 
                                                className={`chart-bar ${day.completion_percentage === 100 ? 'complete' : day.completion_percentage > 0 ? 'partial' : 'empty'}`}
                                                style={{ height: `${Math.max(day.completion_percentage, 10)}%` }}
                                            ></div>
                                        </div>
                                        <div className="day-label">{day.day}</div>
                                        <div className="day-meals">{day.meals_consumed}/3</div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="dashboard-actions">
                            <button 
                                onClick={() => setCurrentView('weeklyPlan')}
                                className="action-button"
                            >
                                Go to Meal Plan
                            </button>
                        </div>
                    </div>
                )}

                <div className="navigation-buttons">
                    <button 
                        onClick={() => setCurrentView('dashboard')}
                        className="nav-btn secondary"
                    >
                        ← Back to Dashboard
                    </button>
                </div>
            </div>
        </div>
    );

    // Navigation configuration for each page - Updated order
    const getNavigationConfig = (view) => {
        const navConfigs = {
            // 2. Login page comes first
            'login': {
                back: { view: 'home' },
                next: { view: 'register' }
            },
            
            // 3. Register page comes after login
            'register': {
                back: { view: 'login' },
                next: { view: 'dashboard' } // Go to customised meal plan after registration
            },
            
            // 4. Customised meal plan page (dashboard)
            'dashboard': {
                back: { view: 'register' },
                next: { view: 'foodSelection' }
            },
            
            // 5. Food selection page
            'foodSelection': {
                back: { view: 'dashboard' },
                next: { view: 'smartReminders' }
            },
            
            // 6. Reminder setting page
            'smartReminders': {
                back: { view: 'foodSelection' },
                next: { view: 'weeklyPlan' }
            },
            
            // 7. Weekly meal plan page
            'weeklyPlan': {
                back: { view: 'smartReminders' },
                next: { view: 'weeklyProgress' }
            },
            
            // 8. Weekly Progress page
            'weeklyProgress': {
                back: { view: 'weeklyPlan' },
                next: null // Remove right arrow
            },
            
            // 9. Health Dashboard (final page)
            'healthDashboard': {
                back: { view: 'weeklyProgress' },
                next: null // End of flow
            }
        };
        
        return navConfigs[view] || { back: null, next: null };
    };

    const renderNavigationArrows = (view) => {
        const navConfig = getNavigationConfig(view);
        
        if (!navConfig.back && !navConfig.next) return null;
        
        return (
            <div className="navigation-arrows">
                {navConfig.back && (
                    <button 
                        className="nav-arrow-btn left-arrow"
                        onClick={() => setCurrentView(navConfig.back.view)}
                        title="Go back"
                    >
                        ←
                    </button>
                )}
                
                {navConfig.next && (
                    <button 
                        className="nav-arrow-btn right-arrow"
                        onClick={() => setCurrentView(navConfig.next.view)}
                        title="Go next"
                    >
                        →
                    </button>
                )}
            </div>
        );
    };

    return (
        <div className="App">
            {showNotification && (
                <div className="notification">
                    {notificationMessage}
                </div>
            )}

            {currentView === 'home' && renderHome()}
            {currentView === 'login' && renderLogin()}
            {currentView === 'register' && renderRegister()}
            {currentView === 'dashboard' && user && renderDashboard()}
            {currentView === 'foodSelection' && user && renderFoodSelection()}
            {currentView === 'weeklyPlan' && user && renderWeeklyPlan()}
            {currentView === 'smartReminders' && user && renderSmartReminders()}
            {currentView === 'weeklyProgress' && user && renderWeeklyProgress()}
            {currentView === 'healthDashboard' && user && renderHealthDashboard()}
            
            {renderNavigationArrows(currentView)}
        </div>
    );
}

export default App;