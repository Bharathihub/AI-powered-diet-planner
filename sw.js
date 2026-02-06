// Service Worker for Push Notifications
self.addEventListener('push', function(event) {
    console.log('Push notification received:', event);
    
    let notificationData = {};
    
    if (event.data) {
        try {
            notificationData = event.data.json();
        } catch (e) {
            notificationData = {
                title: 'Diet Planner Reminder',
                body: event.data.text() || 'Time for your meal!',
                icon: '/favicon.ico',
                badge: '/favicon.ico'
            };
        }
    } else {
        notificationData = {
            title: 'Diet Planner Reminder',
            body: 'Time for your meal!',
            icon: '/favicon.ico',
            badge: '/favicon.ico'
        };
    }
    
    const options = {
        body: notificationData.body,
        icon: notificationData.icon || '/favicon.ico',
        badge: notificationData.badge || '/favicon.ico',
        vibrate: [200, 100, 200],
        data: notificationData.data || {},
        actions: [
            {
                action: 'mark-consumed',
                title: 'Mark as Consumed',
                icon: '/favicon.ico'
            },
            {
                action: 'snooze',
                title: 'Remind Later',
                icon: '/favicon.ico'
            }
        ],
        requireInteraction: true, // Keep notification until user interacts
        tag: 'diet-reminder' // Replace previous notifications
    };
    
    event.waitUntil(
        self.registration.showNotification(notificationData.title, options)
    );
});

// Handle notification clicks
self.addEventListener('notificationclick', function(event) {
    console.log('Notification clicked:', event);
    
    event.notification.close();
    
    if (event.action === 'mark-consumed') {
        // Handle mark as consumed action
        event.waitUntil(
            clients.openWindow('/diet-planner/?action=mark-consumed&meal=' + (event.notification.data.meal_type || 'breakfast'))
        );
    } else if (event.action === 'snooze') {
        // Handle snooze action - show notification again in 15 minutes
        console.log('Snoozed for 15 minutes');
    } else {
        // Default action - open the app
        event.waitUntil(
            clients.openWindow('/diet-planner/')
        );
    }
});

// Handle notification close
self.addEventListener('notificationclose', function(event) {
    console.log('Notification closed:', event);
});

// Install event
self.addEventListener('install', function(event) {
    console.log('Service Worker installing');
    self.skipWaiting();
});

// Activate event
self.addEventListener('activate', function(event) {
    console.log('Service Worker activating');
    event.waitUntil(self.clients.claim());
});