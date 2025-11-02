import { NextResponse } from 'next/server';

export async function POST() {
  try {
    // Get OpenAI API key from environment variable
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    // --- CHANGE: Migrated from `/v1/realtime/sessions` to `/v1/realtime/client_secrets`.
    // The new endpoint is designed to generate a short-lived, ephemeral key for client-side use.
    // This is the recommended approach for the Agents SDK, as it allows the client to handle
    // session configuration directly, reducing backend complexity.
    const response = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      // --- CHANGE: The request body is now minimal.
      // We only specify the session type and model required to generate the key.
      // All other configuration (instructions, voice, turn detection) has been moved
      // to the client-side `RealtimeSession` constructor.
      body: JSON.stringify({
        session: {
          type: 'realtime',
          model: 'gpt-4o-mini-realtime-preview',
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('OpenAI API error:', error);
      // --- CHANGE: Improved error message for clarity.
      return NextResponse.json(
        { error: 'Failed to generate ephemeral client key' },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    // --- CHANGE: The response format from `/client_secrets` is different.
    // The key is in the `value` property at the top level. We return it in a format
    // the client expects, ensuring a seamless transition.
    return NextResponse.json({ client_secret: data.value });
    
  } catch (error) {
    console.error('Error creating ephemeral key:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}