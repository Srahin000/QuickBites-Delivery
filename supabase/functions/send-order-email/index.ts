// send-order-email/index.ts
// Supabase Edge Function that sends order confirmation emails via SMTP

// deno-lint-ignore-file
declare const Deno: any;

// @ts-ignore: Deno URL import — resolved at runtime on Supabase Edge
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
// @ts-ignore: Deno URL import
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
// @ts-ignore: Deno URL import
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts';

// Supabase setup
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);
const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey);

// SMTP configuration from Supabase secrets
const SMTP_HOST = Deno.env.get('SMTP_HOST') || '';
const SMTP_PORT = parseInt(Deno.env.get('SMTP_PORT') || '587');
const SMTP_USER = Deno.env.get('SMTP_USER') || '';
const SMTP_PASS = Deno.env.get('SMTP_PASS') || '';
const SMTP_FROM_NAME = Deno.env.get('SMTP_FROM_NAME') || 'QuickBites Delivery';

// ---------- helpers ----------

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

function formatCurrency(amount: number): string {
  return `$${Number(amount).toFixed(2)}`;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// ---------- email HTML builder ----------

interface OrderItem {
  name: string;
  quantity: number;
  price: number;
  notes?: string;
  customizations?: string[];
}

interface OrderEmailData {
  orderCode: string;
  restaurantName: string;
  items: OrderItem[];
  subtotal: number;
  deliveryFee: number;
  tax: number;
  transactionFee: number;
  total: number;
  deliveryDate: string;
  deliveryLocation: string;
  deliveryTime: string | null;
  customerFirstName: string;
}

function buildOrderEmailHtml(order: OrderEmailData): string {
  const itemRows = order.items
    .map(
      (item) => `
      <tr>
        <td style="padding: 12px 16px; border-bottom: 1px solid #f0f0f0;">
          <strong>${item.name}</strong>${item.quantity > 1 ? ` × ${item.quantity}` : ''}
          ${item.notes ? `<br><span style="color: #888; font-size: 13px;">Note: ${item.notes}</span>` : ''}
          ${item.customizations?.length ? `<br><span style="color: #888; font-size: 13px;">${item.customizations.join(', ')}</span>` : ''}
        </td>
        <td style="padding: 12px 16px; border-bottom: 1px solid #f0f0f0; text-align: right; white-space: nowrap;">
          ${formatCurrency(item.price * item.quantity)}
        </td>
      </tr>`
    )
    .join('');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Order Confirmation</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 24px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background-color: #f97316; padding: 32px 24px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 26px; font-weight: 700;">QuickBites Delivery</h1>
              <p style="margin: 8px 0 0; color: rgba(255,255,255,0.9); font-size: 15px;">Order Confirmation</p>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding: 28px 24px 8px;">
              <p style="margin: 0; font-size: 16px; color: #333;">
                Hi ${order.customerFirstName},
              </p>
              <p style="margin: 8px 0 0; font-size: 16px; color: #333;">
                Your order has been placed successfully! Here are the details:
              </p>
            </td>
          </tr>

          <!-- Order Info -->
          <tr>
            <td style="padding: 16px 24px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #fff7ed; border-radius: 8px; padding: 16px;">
                <tr>
                  <td style="padding: 8px 16px;">
                    <span style="color: #888; font-size: 13px;">Order Code</span><br>
                    <strong style="font-size: 20px; color: #f97316; letter-spacing: 2px;">${order.orderCode}</strong>
                  </td>
                  <td style="padding: 8px 16px; text-align: right;">
                    <span style="color: #888; font-size: 13px;">Restaurant</span><br>
                    <strong style="font-size: 16px; color: #333;">${order.restaurantName}</strong>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Items Table -->
          <tr>
            <td style="padding: 8px 24px;">
              <h3 style="margin: 0 0 12px; font-size: 16px; color: #333;">Items Ordered</h3>
              <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #f0f0f0; border-radius: 8px; overflow: hidden;">
                <thead>
                  <tr style="background-color: #fafafa;">
                    <th style="padding: 10px 16px; text-align: left; font-size: 13px; color: #888; font-weight: 600;">Item</th>
                    <th style="padding: 10px 16px; text-align: right; font-size: 13px; color: #888; font-weight: 600;">Price</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemRows}
                </tbody>
              </table>
            </td>
          </tr>

          <!-- Cost Breakdown -->
          <tr>
            <td style="padding: 16px 24px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding: 6px 0; color: #666; font-size: 14px;">Subtotal</td>
                  <td style="padding: 6px 0; text-align: right; color: #666; font-size: 14px;">${formatCurrency(order.subtotal)}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #666; font-size: 14px;">Delivery Fee</td>
                  <td style="padding: 6px 0; text-align: right; color: #666; font-size: 14px;">${formatCurrency(order.deliveryFee)}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #666; font-size: 14px;">Tax</td>
                  <td style="padding: 6px 0; text-align: right; color: #666; font-size: 14px;">${formatCurrency(order.tax)}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #666; font-size: 14px;">Transaction Fee</td>
                  <td style="padding: 6px 0; text-align: right; color: #666; font-size: 14px;">${formatCurrency(order.transactionFee)}</td>
                </tr>
                <tr>
                  <td colspan="2" style="padding: 0;"><hr style="border: none; border-top: 2px solid #f0f0f0; margin: 8px 0;" /></td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-size: 18px; font-weight: 700; color: #333;">Total</td>
                  <td style="padding: 6px 0; text-align: right; font-size: 18px; font-weight: 700; color: #f97316;">${formatCurrency(order.total)}</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Delivery Info -->
          <tr>
            <td style="padding: 8px 24px 24px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f0fdf4; border-radius: 8px; padding: 16px;">
                <tr>
                  <td style="padding: 8px 16px;">
                    <span style="color: #888; font-size: 13px;">Delivery Date</span><br>
                    <strong style="color: #333;">${formatDate(order.deliveryDate)}</strong>
                  </td>
                </tr>
                ${order.deliveryTime ? `
                <tr>
                  <td style="padding: 8px 16px;">
                    <span style="color: #888; font-size: 13px;">Delivery Time</span><br>
                    <strong style="color: #333;">${order.deliveryTime}</strong>
                  </td>
                </tr>` : ''}
                <tr>
                  <td style="padding: 8px 16px;">
                    <span style="color: #888; font-size: 13px;">Delivery Location</span><br>
                    <strong style="color: #333;">${order.deliveryLocation}</strong>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #fafafa; padding: 20px 24px; text-align: center; border-top: 1px solid #f0f0f0;">
              <p style="margin: 0; font-size: 13px; color: #999;">
                Thank you for ordering with QuickBites Delivery!
              </p>
              <p style="margin: 6px 0 0; font-size: 12px; color: #bbb;">
                If you have any questions, reply to this email or reach out to us in the app.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ---------- main handler ----------

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    // ----- Auth check (same pattern as send-notification) -----
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return jsonResponse({ error: 'Missing or invalid authorization header' }, 401);
    }

    const token = authHeader.replace('Bearer ', '');
    try {
      const { data: { user }, error } = await supabaseAnon.auth.getUser(token);
      if (error || !user) {
        console.warn('Auth validation warning:', error?.message);
      } else {
        console.log('Authenticated user:', user.id);
      }
    } catch (err) {
      console.warn('Auth validation error (continuing):', (err as Error).message);
    }

    // ----- Parse body -----
    const body = await req.json();
    const { orderId, orderCode, restaurantName, items, subtotal, deliveryFee, tax, transactionFee, total, deliveryDate, deliveryLocation, deliveryTime, userId } = body;

    if (!orderId || !userId) {
      return jsonResponse({ error: 'Missing required fields: orderId, userId' }, 400);
    }

    // ----- Look up user email + name -----
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('email, first_name, last_name')
      .eq('id', userId)
      .single();

    if (userError || !userData) {
      console.error('Error fetching user:', userError);
      return jsonResponse({ error: 'User not found' }, 404);
    }

    // Also get the email from Supabase Auth (more reliable source)
    let recipientEmail = userData.email;
    if (!recipientEmail) {
      // Fallback: fetch from auth.users via admin API
      const { data: { user: authUser }, error: authError } = await supabase.auth.admin.getUserById(userId);
      if (authError || !authUser?.email) {
        return jsonResponse({ error: 'Could not determine user email' }, 400);
      }
      recipientEmail = authUser.email;
    }

    // ----- Validate SMTP config -----
    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
      console.error('SMTP not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS as Supabase secrets.');
      return jsonResponse({ error: 'Email service not configured' }, 500);
    }

    // ----- Build email -----
    const emailData: OrderEmailData = {
      orderCode: orderCode || `#${orderId}`,
      restaurantName: restaurantName || 'Unknown Restaurant',
      items: items || [],
      subtotal: subtotal || 0,
      deliveryFee: deliveryFee || 0,
      tax: tax || 0,
      transactionFee: transactionFee || 0,
      total: total || 0,
      deliveryDate: deliveryDate || new Date().toISOString().split('T')[0],
      deliveryLocation: deliveryLocation || 'N/A',
      deliveryTime: deliveryTime || null,
      customerFirstName: userData.first_name || 'there',
    };

    const htmlContent = buildOrderEmailHtml(emailData);

    // ----- Send via SMTP -----
    const client = new SMTPClient({
      connection: {
        hostname: SMTP_HOST,
        port: SMTP_PORT,
        tls: true,
        auth: {
          username: SMTP_USER,
          password: SMTP_PASS,
        },
      },
    });

    await client.send({
      from: `${SMTP_FROM_NAME} <${SMTP_USER}>`,
      to: recipientEmail,
      subject: `Order Confirmed — #${emailData.orderCode} from ${emailData.restaurantName}`,
      content: 'auto',
      html: htmlContent,
    });

    await client.close();

    console.log(`Order confirmation email sent to ${recipientEmail} for order ${orderId}`);

    return jsonResponse({
      success: true,
      message: `Email sent to ${recipientEmail}`,
    });
  } catch (error) {
    console.error('Error in send-order-email:', error);
    return jsonResponse(
      { error: (error as Error).message || 'Internal server error' },
      500
    );
  }
});
