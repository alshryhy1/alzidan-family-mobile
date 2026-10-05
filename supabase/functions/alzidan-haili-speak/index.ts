const VOICE_ID = "uuQ7Ev5fwxB4iMNxGX3Z";
const MAX_CHARS = 2000;

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  let text = "";
  try {
    const body = await req.json();
    text = String(body?.text ?? "").replace(/\s+/g, " ").trim();
  } catch {
    return json({ error: "bad_json" }, 400);
  }

  if (!text || text.length > MAX_CHARS) {
    return json({ error: "bad_text" }, 400);
  }

  const apiKey = Deno.env.get("ELEVENLABS_API_KEY");
  if (!apiKey) {
    return json({ error: "missing_key" }, 500);
  }

  const upstream = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text,
      model_id: "eleven_multilingual_v2",
    }),
  });

  if (!upstream.ok || !upstream.body) {
    return json({ error: "voice_failed" }, 502);
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "no-store",
    },
  });
});

function json(payload: unknown, status: number) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
