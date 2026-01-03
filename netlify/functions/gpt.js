// File: netlify/functions/gpt.js
// ChatGPT 호출 (OpenAI)
exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }
    const { keyword, styleHint, refUrl, lang } = JSON.parse(event.body || "{}");

    const system = `You are a helpful content writer. Write a blog article based on the given keyword/style.
Output plain markdown (no code fences). Keep it publish-ready.`;

    const langGuide = lang === "mix"
      ? "Use a natural mix: start with Korean paragraph, then English, then Vietnamese, and keep alternating by sections."
      : (lang === "en" ? "Write in English." : lang === "vi" ? "Write in Vietnamese." : "Write in Korean.");

    const user = [
      `Keyword: ${keyword}`,
      `Style: ${styleHint}`,
      `Reference: ${refUrl || "N/A"}`,
      `Language: ${lang} — ${langGuide}`,
      `Include 3-6 short subheadings and bullet lists where helpful. CTA at the end.`
    ].join("\n");

    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user }
        ],
        temperature: 0.8
      })
    });

    if (!resp.ok) {
      const txt = await resp.text();
      return { statusCode: 500, body: JSON.stringify({ error: "OpenAI error", detail: txt }) };
    }
    const data = await resp.json();
    const text = data.choices?.[0]?.message?.content || "";

    return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};


const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: CORS, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: CORS, body: "Method Not Allowed" };
  }
  // ... 기존 로직 ...
  return { statusCode: 200, headers: { ...CORS, "Content-Type": "application/json" }, body: JSON.stringify({ text }) };
};
