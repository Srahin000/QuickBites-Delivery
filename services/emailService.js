import { supabase } from '../supabaseClient';

/**
 * Email Service
 *
 * Sends order-related emails by calling the `send-order-email` Supabase Edge
 * Function via the Supabase SDK. The SDK handles auth and request formatting.
 *
 * SMTP credentials must be configured as Supabase secrets:
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM_NAME
 */
class EmailService {
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

    // Build a strictly serializable payload (no undefined) to prevent serialization errors
    const payload = {
      orderId: String(orderId),
      orderCode: orderCode ?? '',
      userId: String(userId),
      restaurantName: restaurantName ?? '',
      items: Array.isArray(items) ? items : [],
      subtotal: Number(subtotal) || 0,
      deliveryFee: Number(deliveryFee) || 0,
      tax: Number(tax) || 0,
      transactionFee: Number(transactionFee) || 0,
      total: Number(total) || 0,
      deliveryDate: deliveryDate ?? '',
      deliveryLocation: deliveryLocation ?? '',
      deliveryTime: deliveryTime != null ? String(deliveryTime) : null,
    };

    console.log('EmailService: payload before invoke', payload);

    try {
      const { data, error } = await supabase.functions.invoke('send-order-email', {
        body: payload,
      });

      // Log everything we got back so we can debug
      console.log('EmailService: invoke result', JSON.stringify({ data, error: error?.message }, null, 2));

      if (error) {
        let detail = error.message || String(error);

        // Try every way to extract the real body from the error
        try {
          if (error.context) {
            // error.context is the raw Response object
            const text = typeof error.context.text === 'function'
              ? await error.context.text()
              : null;
            if (text) {
              console.error('EmailService: Edge function response text:', text);
              try {
                const parsed = JSON.parse(text);
                detail = parsed?.error || text;
              } catch {
                detail = text;
              }
            }
          }
        } catch (extractErr) {
          console.error('EmailService: Could not extract response body', extractErr);
        }

        // Also check if data was populated
        if (data) {
          console.error('EmailService: data on error', JSON.stringify(data));
          if (data?.error) detail = typeof data.error === 'string' ? data.error : JSON.stringify(data.error);
        }

        console.error('EmailService: final error detail:', detail);
        return { ok: false, error: detail };
      }

      if (data?.error) {
        console.error('EmailService: Edge function returned error', data.error);
        return { ok: false, error: typeof data.error === 'string' ? data.error : JSON.stringify(data.error) };
      }

      console.log('EmailService: Order confirmation email sent for order', orderId);
      return { ok: true, result: data };
    } catch (e) {
      console.error('EmailService: Error sending order confirmation email:', e);
      return { ok: false, error: e?.message || String(e) };
    }
  }
}

export default new EmailService();
