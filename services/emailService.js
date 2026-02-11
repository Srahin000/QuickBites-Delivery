import { supabase } from '../supabaseClient';

/**
 * Email Service
 *
 * Sends order-related emails by calling the `send-order-email` Supabase Edge
 * Function, which delivers the email directly via SMTP — no third-party email
 * service required.
 *
 * SMTP credentials must be configured as Supabase secrets:
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM_NAME
 */
class EmailService {
  // Reuse the same helper from notificationService
  async getAccessToken() {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) return null;

      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) return null;
      return session.access_token || null;
    } catch (e) {
      console.error('EmailService: Error getting access token:', e);
      return null;
    }
  }

  getFunctionsBaseUrl() {
    return (
      process.env.EXPO_PUBLIC_SUPABASE_FUNCTIONS_URL ||
      'https://pgouwzuufnnhthwrewrv.functions.supabase.co'
    );
  }

  /**
   * Send an order confirmation email to the customer.
   *
   * @param {object} params
   * @param {string}   params.orderId          – Database order ID
   * @param {string}   params.orderCode        – Human-readable order code
   * @param {string}   params.userId           – Customer user ID
   * @param {string}   params.restaurantName   – Restaurant name
   * @param {Array}    params.items            – Array of order items
   * @param {number}   params.subtotal
   * @param {number}   params.deliveryFee
   * @param {number}   params.tax
   * @param {number}   params.transactionFee
   * @param {number}   params.total
   * @param {string}   params.deliveryDate     – ISO date string (YYYY-MM-DD)
   * @param {string}   params.deliveryLocation
   * @param {string|null} params.deliveryTime  – Human-readable time slot string
   * @returns {Promise<{ok: boolean, error?: string}>}
   */
  async sendOrderConfirmation({
    orderId,
    orderCode,
    userId,
    restaurantName,
    items,
    subtotal,
    deliveryFee,
    tax,
    transactionFee,
    total,
    deliveryDate,
    deliveryLocation,
    deliveryTime,
  }) {
    if (!orderId || !userId) {
      return { ok: false, error: 'Missing orderId or userId' };
    }

    const token = await this.getAccessToken();
    if (!token) {
      return { ok: false, error: 'No session token available' };
    }

    const url = `${this.getFunctionsBaseUrl()}/send-order-email`;

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          orderId,
          orderCode,
          userId,
          restaurantName,
          items,
          subtotal,
          deliveryFee,
          tax,
          transactionFee,
          total,
          deliveryDate,
          deliveryLocation,
          deliveryTime,
        }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        console.error('EmailService: Edge function returned error:', json);
        return { ok: false, error: json?.error || `HTTP ${res.status}` };
      }

      console.log('EmailService: Order confirmation email sent for order', orderId);
      return { ok: true, result: json };
    } catch (e) {
      console.error('EmailService: Error sending order confirmation email:', e);
      return { ok: false, error: e?.message || String(e) };
    }
  }
}

export default new EmailService();
