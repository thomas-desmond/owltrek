import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ url, locals }) => {
  const env = locals.runtime.env;
  const db = env.OWLTREK_DB;

  const email = url.searchParams.get('email');
  const sig = url.searchParams.get('sig');

  // For now, we'll use a simple approach without signature verification
  // TODO: Add HMAC signature verification for production security
  
  if (!email) {
    return new Response(
      `<!DOCTYPE html>
      <html>
      <body style="font-family: system-ui, sans-serif; background: #0f0d1a; color: white; padding: 32px; text-align: center;">
        <h1 style="color: #ef4444;">❌ Invalid Link</h1>
        <p>This unsubscribe link is invalid.</p>
        <a href="https://owltrek.com" style="color: #a5b4fc;">Go to OwlTrek</a>
      </body>
      </html>`,
      { status: 400, headers: { 'Content-Type': 'text/html' } }
    );
  }

  try {
    // Check if subscriber exists
    const subscriber = await db.prepare(
      'SELECT email, subscribed FROM subscribers WHERE email = ?'
    ).bind(email).first<{ email: string; subscribed: number }>();

    if (!subscriber) {
      return new Response(
        `<!DOCTYPE html>
        <html>
        <body style="font-family: system-ui, sans-serif; background: #0f0d1a; color: white; padding: 32px; text-align: center;">
          <h1 style="color: #f59e0b;">🤔 Not Found</h1>
          <p>We couldn't find a subscription for this email address.</p>
          <a href="https://owltrek.com" style="color: #a5b4fc;">Go to OwlTrek</a>
        </body>
        </html>`,
        { status: 404, headers: { 'Content-Type': 'text/html' } }
      );
    }

    if (!subscriber.subscribed) {
      return new Response(
        `<!DOCTYPE html>
        <html>
        <body style="font-family: system-ui, sans-serif; background: #0f0d1a; color: white; padding: 32px; text-align: center;">
          <h1 style="color: #a5b4fc;">👋 Already Unsubscribed</h1>
          <p>You've already been unsubscribed from OwlTrek emails.</p>
          <a href="https://owltrek.com" style="color: #a5b4fc;">Go to OwlTrek</a>
        </body>
        </html>`,
        { status: 200, headers: { 'Content-Type': 'text/html' } }
      );
    }

    // Unsubscribe the user
    await db.prepare(
      'UPDATE subscribers SET subscribed = 0 WHERE email = ?'
    ).bind(email).run();

    return new Response(
      `<!DOCTYPE html>
      <html>
      <body style="font-family: system-ui, sans-serif; background: #0f0d1a; color: white; padding: 32px; text-align: center;">
        <h1 style="color: #22c55e;">👋 Unsubscribed</h1>
        <p>You've been successfully unsubscribed from OwlTrek emails.</p>
        <p style="color: #9ca3af; font-size: 14px; margin-top: 16px;">Changed your mind? You can always subscribe again on our website.</p>
        <a href="https://owltrek.com" style="display: inline-block; background: #6366f1; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin-top: 16px;">
          Go to OwlTrek
        </a>
      </body>
      </html>`,
      { status: 200, headers: { 'Content-Type': 'text/html' } }
    );

  } catch (error) {
    console.error('Unsubscribe error:', error);
    return new Response(
      `<!DOCTYPE html>
      <html>
      <body style="font-family: system-ui, sans-serif; background: #0f0d1a; color: white; padding: 32px; text-align: center;">
        <h1 style="color: #ef4444;">❌ Something went wrong</h1>
        <p>Please try again later or contact support.</p>
        <a href="https://owltrek.com" style="color: #a5b4fc;">Go to OwlTrek</a>
      </body>
      </html>`,
      { status: 500, headers: { 'Content-Type': 'text/html' } }
    );
  }
};
