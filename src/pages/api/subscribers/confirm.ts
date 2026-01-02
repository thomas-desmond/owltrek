import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ url, locals }) => {
  const env = locals.runtime.env;
  const db = env.OWLTREK_DB;

  const token = url.searchParams.get('token');

  if (!token) {
    return new Response(
      `<!DOCTYPE html>
      <html>
      <body style="font-family: system-ui, sans-serif; background: #0f0d1a; color: white; padding: 32px; text-align: center;">
        <h1 style="color: #ef4444;">❌ Invalid Link</h1>
        <p>This confirmation link is invalid or missing a token.</p>
        <a href="https://owltrek.com" style="color: #a5b4fc;">Go to OwlTrek</a>
      </body>
      </html>`,
      { status: 400, headers: { 'Content-Type': 'text/html' } }
    );
  }

  try {
    // Find subscriber by token
    const subscriber = await db.prepare(
      'SELECT email, confirmed FROM subscribers WHERE confirm_token = ?'
    ).bind(token).first<{ email: string; confirmed: number }>();

    if (!subscriber) {
      return new Response(
        `<!DOCTYPE html>
        <html>
        <body style="font-family: system-ui, sans-serif; background: #0f0d1a; color: white; padding: 32px; text-align: center;">
          <h1 style="color: #ef4444;">❌ Link Expired</h1>
          <p>This confirmation link has expired or already been used.</p>
          <a href="https://owltrek.com" style="color: #a5b4fc;">Go to OwlTrek</a>
        </body>
        </html>`,
        { status: 404, headers: { 'Content-Type': 'text/html' } }
      );
    }

    if (subscriber.confirmed) {
      return new Response(
        `<!DOCTYPE html>
        <html>
        <body style="font-family: system-ui, sans-serif; background: #0f0d1a; color: white; padding: 32px; text-align: center;">
          <h1 style="color: #a5b4fc;">✅ Already Confirmed</h1>
          <p>Your subscription is already active!</p>
          <a href="https://owltrek.com" style="color: #a5b4fc;">Go to OwlTrek</a>
        </body>
        </html>`,
        { status: 200, headers: { 'Content-Type': 'text/html' } }
      );
    }

    // Confirm the subscription and clear the token
    await db.prepare(
      'UPDATE subscribers SET confirmed = 1, confirm_token = NULL WHERE confirm_token = ?'
    ).bind(token).run();

    return new Response(
      `<!DOCTYPE html>
      <html>
      <body style="font-family: system-ui, sans-serif; background: #0f0d1a; color: white; padding: 32px; text-align: center;">
        <h1 style="color: #22c55e;">🦉 You're In!</h1>
        <p>Your subscription has been confirmed. You'll start receiving night sky alerts soon!</p>
        <a href="https://owltrek.com" style="display: inline-block; background: #6366f1; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin-top: 16px;">
          Go to OwlTrek
        </a>
      </body>
      </html>`,
      { status: 200, headers: { 'Content-Type': 'text/html' } }
    );

  } catch (error) {
    console.error('Confirm error:', error);
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
