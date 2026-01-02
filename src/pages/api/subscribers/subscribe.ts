import type { APIRoute } from 'astro';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export const OPTIONS: APIRoute = async () => {
  return new Response(null, { status: 204, headers: corsHeaders });
};

export const POST: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime.env;
  const db = env.OWLTREK_DB;
  const RESEND_API_KEY = env.RESEND_API_KEY;

  try {
    const body = await request.json() as {
      email?: string;
      location_lat?: number;
      location_lon?: number;
      location_name?: string;
      timezone?: string;
      frequency?: string;
    };

    const { email, location_lat, location_lon, location_name, timezone, frequency } = body;

    // Validate required fields
    if (!email || !location_lat || !location_lon || !location_name) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields: email, location_lat, location_lon, location_name' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Basic email validation
    if (!email.includes('@') || !email.includes('.')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid email format' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Generate confirmation token
    const confirmToken = crypto.randomUUID();

    // Check if email already exists
    const existing = await db.prepare(
      'SELECT email, confirmed FROM subscribers WHERE email = ?'
    ).bind(email).first<{ email: string; confirmed: number }>();

    if (existing) {
      if (existing.confirmed) {
        return new Response(
          JSON.stringify({ success: false, error: 'Email already subscribed' }),
          { status: 409, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }
      // Update existing unconfirmed subscription
      await db.prepare(`
        UPDATE subscribers 
        SET location_lat = ?, location_lon = ?, location_name = ?, timezone = ?, frequency = ?, confirm_token = ?, subscribed = 1
        WHERE email = ?
      `).bind(
        location_lat,
        location_lon,
        location_name,
        timezone || 'America/Los_Angeles',
        frequency || 'daily',
        confirmToken,
        email
      ).run();
    } else {
      // Insert new subscriber
      await db.prepare(`
        INSERT INTO subscribers (email, location_lat, location_lon, location_name, timezone, frequency, confirm_token)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(
        email,
        location_lat,
        location_lon,
        location_name,
        timezone || 'America/Los_Angeles',
        frequency || 'daily',
        confirmToken
      ).run();
    }

    // Send confirmation email
    const confirmUrl = `https://owltrek.com/api/subscribers/confirm?token=${confirmToken}`;
    
    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'OwlTrek <noreply@mail.owltrek.com>',
        to: [email],
        subject: '🦉 Confirm your OwlTrek subscription',
        html: `
          <!DOCTYPE html>
          <html>
          <body style="font-family: system-ui, sans-serif; background: #0f0d1a; color: white; padding: 32px;">
            <div style="max-width: 500px; margin: 0 auto;">
              <h1 style="color: #a5b4fc;">🦉 Welcome to OwlTrek!</h1>
              <p>You're almost there! Click the button below to confirm your subscription and start receiving night sky alerts for <strong>${location_name}</strong>.</p>
              <a href="${confirmUrl}" style="display: inline-block; background: #6366f1; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin: 16px 0;">
                Confirm Subscription
              </a>
              <p style="color: #9ca3af; font-size: 14px; margin-top: 24px;">
                If you didn't request this, you can safely ignore this email.
              </p>
            </div>
          </body>
          </html>
        `,
      }),
    });

    if (!emailResponse.ok) {
      const errorData = await emailResponse.json();
      console.error('Failed to send confirmation email:', errorData);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to send confirmation email' }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Confirmation email sent. Please check your inbox.' }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );

  } catch (error) {
    console.error('Subscribe error:', error);
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
};
