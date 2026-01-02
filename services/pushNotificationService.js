const { Expo } = require('expo-server-sdk');

// Create a new Expo SDK client
const expo = new Expo();

/**
 * Send push notification to a single device
 * @param {string} pushToken - Expo push token
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {object} data - Additional data to send
 * @returns {Promise<object>} Result object with success status
 */
async function sendPushNotification(pushToken, title, body, data = {}) {
  // Validate push token
  if (!Expo.isExpoPushToken(pushToken)) {
    console.error(`❌ Invalid Expo push token: ${pushToken}`);
    return { success: false, error: 'Invalid Expo push token' };
  }

  // Create message
  const message = {
    to: pushToken,
    sound: 'default',
    title: title,
    body: body,
    data: data,
    priority: 'high',
    channelId: 'default',
    badge: 1,
  };

  try {
    console.log(`📤 Sending push notification to ${pushToken}: ${title}`);
    const ticketChunk = await expo.sendPushNotificationsAsync([message]);
    console.log('✅ Push notification sent:', ticketChunk);
    
    return { 
      success: true, 
      ticket: ticketChunk[0],
      message: 'Push notification sent successfully'
    };
  } catch (error) {
    console.error('❌ Push notification error:', error);
    return { 
      success: false, 
      error: error.message || 'Failed to send push notification'
    };
  }
}

/**
 * Send push notifications to multiple devices
 * @param {Array<object>} notifications - Array of {pushToken, title, body, data}
 * @returns {Promise<object>} Results array
 */
async function sendBulkPushNotifications(notifications) {
  const messages = [];
  
  for (const notif of notifications) {
    if (!Expo.isExpoPushToken(notif.pushToken)) {
      console.warn(`⚠️ Skipping invalid token: ${notif.pushToken}`);
      continue;
    }
    
    messages.push({
      to: notif.pushToken,
      sound: 'default',
      title: notif.title,
      body: notif.body,
      data: notif.data || {},
      priority: 'high',
      channelId: 'default',
      badge: 1,
    });
  }

  try {
    console.log(`📤 Sending ${messages.length} bulk push notifications`);
    const ticketChunks = await expo.sendPushNotificationsAsync(messages);
    console.log(`✅ Sent ${ticketChunks.length} push notifications`);
    
    return { 
      success: true, 
      tickets: ticketChunks,
      count: ticketChunks.length
    };
  } catch (error) {
    console.error('❌ Bulk push notification error:', error);
    return { 
      success: false, 
      error: error.message || 'Failed to send bulk notifications'
    };
  }
}

/**
 * Send notification based on event type
 * @param {object} params - Notification parameters
 * @returns {Promise<object>} Result object
 */
async function sendEventNotification({ type, recipientToken, senderName, data = {} }) {
  let title, body;
  
  switch (type) {
    case 'like':
      title = '❤️ New Like';
      body = `${senderName} liked your post`;
      break;
    case 'comment':
      title = '💬 New Comment';
      body = `${senderName} commented: ${data.comment || ''}`.substring(0, 100);
      break;
    case 'follow':
      title = '👥 New Follower';
      body = `${senderName} started following you`;
      break;
    case 'message':
      title = senderName;
      body = data.message || 'New message';
      break;
    case 'story':
      title = '📸 Story Update';
      body = `${senderName} posted a new story`;
      break;
    case 'live':
      title = '🔴 Live Now';
      body = `${senderName} is live!`;
      break;
    case 'mention':
      title = '🔔 Mention';
      body = `${senderName} mentioned you`;
      break;
    default:
      title = 'New Notification';
      body = `${senderName} interacted with you`;
  }
  
  return await sendPushNotification(recipientToken, title, body, { type, ...data });
}

module.exports = {
  sendPushNotification,
  sendBulkPushNotifications,
  sendEventNotification,
};
