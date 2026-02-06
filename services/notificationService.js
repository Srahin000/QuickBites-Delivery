import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from '../supabaseClient';
import { getDeviceId } from '../utils/deviceId';

// Configure how notifications are handled when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

class NotificationService {
  async getAccessToken() {
    try {
      // First, refresh the token if needed by calling getUser() which auto-refreshes expired tokens
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError) {
        // Check if it's a token refresh error (invalid refresh token)
        if (userError.message?.includes('refresh_token') || 
            userError.message?.includes('JWT') || 
            userError.message?.includes('expired') ||
            userError.message?.includes('Invalid')) {
          console.log('NotificationService: Refresh token invalid - cannot get access token');
          return null;
        }
        console.error('NotificationService: Error refreshing user:', userError);
        return null;
      }

      if (!user) {
        return null;
      }

      // Get the refreshed session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) return null;
      return session.access_token || null;
    } catch (e) {
      console.error('NotificationService: Error getting access token:', e);
      return null;
    }
  }

  getFunctionsBaseUrl() {
    return process.env.EXPO_PUBLIC_SUPABASE_FUNCTIONS_URL || 'https://pgouwzuufnnhthwrewrv.functions.supabase.co';
  }

  async sendPushToUser(userId, { type = 'general', title, body, data = {} }) {
    if (!userId || !title || !body) return { ok: false, error: 'Missing userId/title/body' };

    const token = await this.getAccessToken();
    if (!token) return { ok: false, error: 'No session token available' };

    const url = `${this.getFunctionsBaseUrl()}/send-notification`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          userId,
          type,
          title,
          body,
          data: { type, ...(data || {}) },
        }),
      });
      const json = await res.json().catch(() => ({}));
      return { ok: res.ok, status: res.status, result: json };
    } catch (e) {
      return { ok: false, error: e?.message || String(e) };
    }
  }

  async sendPushToUsers(userIds, payload) {
    const ids = Array.from(new Set((userIds || []).filter(Boolean).map(String)));
    if (ids.length === 0) return { ok: true, sent: 0 };

    // Fire sequentially to avoid bursting the Edge Function / Expo API
    let sent = 0;
    for (const id of ids) {
      const r = await this.sendPushToUser(id, payload);
      if (r.ok) sent += 1;
    }
    return { ok: true, sent, total: ids.length };
  }

  async getUserIdsByRole(role) {
    const { data, error } = await supabase.from('users').select('id').eq('role', role);
    if (error) {
      console.error('getUserIdsByRole error:', error);
      return [];
    }
    return (data || []).map((r) => r.id);
  }

  async notifyDeliverers(payload, excludeUserId = null) {
    const ids = await this.getUserIdsByRole('deliverer');
    // Exclude the order placer if they're also a deliverer
    const filteredIds = excludeUserId 
      ? ids.filter(id => String(id) !== String(excludeUserId))
      : ids;
    return await this.sendPushToUsers(filteredIds, payload);
  }

  async notifyAdmins(payload, excludeUserId = null) {
    const ids = await this.getUserIdsByRole('admin');
    // Exclude the order placer if they're also an admin
    const filteredIds = excludeUserId 
      ? ids.filter(id => String(id) !== String(excludeUserId))
      : ids;
    return await this.sendPushToUsers(filteredIds, payload);
  }

  async notifyByStatus(status, payload) {
    try {
      const accessToken = await this.getAccessToken();
      if (!accessToken) {
        console.error('Cannot notify by status: No access token');
        return;
      }

      // Get user IDs with the specified status using the database function
      const { data: statusUsers, error: statusError } = await supabase
        .rpc('get_users_with_status', { p_status: status });

      if (statusError) {
        console.error('Error fetching users with status:', statusError);
        return;
      }

      if (!statusUsers || statusUsers.length === 0) {
        console.log(`No users found with status: ${status}`);
        return;
      }

      const userIds = statusUsers.map(u => u.user_id);
      return await this.sendPushToUsers(userIds, payload);
    } catch (e) {
      console.error('notifyByStatus error:', e);
    }
  }

  async notifyByRole(role, payload) {
    const ids = await this.getUserIdsByRole(role);
    return await this.sendPushToUsers(ids, payload);
  }

  async notifyAllUsers(payload) {
    try {
      const { data, error } = await supabase.from('users').select('id');
      if (error) {
        console.error('notifyAllUsers error:', error);
        return { ok: false, error: error.message };
      }
      const ids = (data || []).map((r) => r.id);
      return await this.sendPushToUsers(ids, payload);
    } catch (e) {
      console.error('notifyAllUsers error:', e);
      return { ok: false, error: e?.message || String(e) };
    }
  }

  async requestPermissions() {
    // Check if running on a physical device
    // Note: expo-device can be added if needed, but we'll use a simpler check
    const isPhysicalDevice = Platform.OS !== 'web';
    
    if (!isPhysicalDevice) {
      console.warn('Push notifications require a physical device');
      return false;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('Failed to get push token for push notification!');
      return false;
    }

    return true;
  }

  async registerForPushNotifications(userId) {
    if (!userId) {
      console.warn('Cannot register notifications without userId');
      return null;
    }

    const hasPermission = await this.requestPermissions();
    if (!hasPermission) return null;

    try {
      const token = await Notifications.getExpoPushTokenAsync({
        projectId: '444ed843-9ec5-4779-8b4a-45817fd22e20', // From app.json
      });

      // Get device ID for device-specific token management
      const deviceId = await getDeviceId();

      // Save token to Supabase with device_id
      // Try to update existing token for this user+device, or insert new one
      // Note: If database has unique constraint on (user_id, device_id), this will update
      // If constraint is on (user_id, token), it will still work but may create duplicates
      const { error } = await supabase
        .from('push_tokens')
        .upsert({
          user_id: userId,
          token: token.data,
          platform: Platform.OS,
          device_id: deviceId,
        }, {
          onConflict: 'user_id,token' // Keep existing constraint for compatibility
        });

      if (error) {
        console.error('Error saving push token:', error);
        return null;
      }

      console.log('Push token registered for device:', deviceId, token.data);
      return token.data;
    } catch (error) {
      console.error('Error registering for push notifications:', error);
      return null;
    }
  }

  setupNotificationListeners(navigationRef) {
    if (!navigationRef) {
      console.warn('Navigation ref not provided for notification listeners');
      return;
    }

    // Handle notification received while app is in foreground
    // Don't auto-navigate - just show the alert/sound
    // Navigation happens only when user taps the notification
    const receivedSubscription = Notifications.addNotificationReceivedListener(notification => {
      console.log('📬 Notification received in foreground:', notification);
      // Just log - don't navigate automatically when app is open
      // User can continue what they're doing and tap notification if they want
    });

    // Handle notification tapped (only navigate when user explicitly taps)
    const responseSubscription = Notifications.addNotificationResponseReceivedListener(response => {
      const { data } = response.notification.request.content;
      console.log('👆 Notification tapped:', data);
      
      // Wait a bit to ensure navigation is ready
      setTimeout(() => {
        try {
          // Get the navigation ref - handle both ref object and direct ref
          const nav = navigationRef?.current || navigationRef;
          
          if (!nav || !nav.navigate) {
            console.warn('⚠️ Navigation not ready yet, retrying...');
            // Retry after another short delay
            setTimeout(() => {
              const navRetry = navigationRef?.current || navigationRef;
              if (navRetry?.navigate) {
                this.performNavigation(navRetry, data);
              } else {
                console.error('❌ Navigation still not available');
              }
            }, 500);
            return;
          }
          
          this.performNavigation(nav, data);
        } catch (navError) {
          console.error('❌ Navigation error:', navError);
        }
      }, 300); // Small delay to ensure navigation is ready
    });

    // Return cleanup function
    return () => {
      receivedSubscription.remove();
      responseSubscription.remove();
    };
  }

  performNavigation(nav, data) {
    try {
      if (data?.type === 'order_ready' && data?.orderId) {
        console.log('📍 Navigating to OrderDetails:', data.orderId);
        nav.navigate('OrderDetails', { orderId: data.orderId });
      } else if (data?.type === 'chat_message') {
        console.log('📍 Navigating to Chat');
        // Try navigating to MainTabs with Chat screen
        if (nav.navigate) {
          nav.navigate('MainTabs', { screen: 'Chat' });
        }
      } else if (data?.type === 'announcement') {
        // For announcements, just log - no navigation needed
        console.log('📢 Announcement received:', data);
        // Optionally, you could navigate to a notifications/announcements screen if you have one
      }
    } catch (error) {
      console.error('❌ Error during navigation:', error);
    }
  }

  async unregisterToken(userId, token) {
    if (!userId || !token) return;

    try {
      const { error } = await supabase
        .from('push_tokens')
        .delete()
        .eq('user_id', userId)
        .eq('token', token);

      if (error) {
        console.error('Error unregistering push token:', error);
      }
    } catch (error) {
      console.error('Error in unregisterToken:', error);
    }
  }

  async unregisterDeviceTokens(userId) {
    if (!userId) return;

    try {
      // Get current device ID
      const deviceId = await getDeviceId();

      // Only delete tokens for this specific device
      const { error } = await supabase
        .from('push_tokens')
        .delete()
        .eq('user_id', userId)
        .eq('device_id', deviceId);

      if (error) {
        console.error('Error unregistering device push tokens:', error);
      } else {
        console.log(`Unregistered push tokens for device ${deviceId} (user ${userId})`);
      }
    } catch (error) {
      console.error('Error in unregisterDeviceTokens:', error);
    }
  }

  async unregisterAllTokens(userId) {
    if (!userId) return;

    try {
      const { error } = await supabase
        .from('push_tokens')
        .delete()
        .eq('user_id', userId);

      if (error) {
        console.error('Error unregistering all push tokens:', error);
      } else {
        console.log(`Unregistered all push tokens for user ${userId}`);
      }
    } catch (error) {
      console.error('Error in unregisterAllTokens:', error);
    }
  }
}

export default new NotificationService();

