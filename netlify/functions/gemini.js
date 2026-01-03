// File: netlify/functions/gemini.js
// Google Gemini 호출
exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }
    const { keyword, styleHint, refUrl, lang } = JSON.parse(event.body || "{}");

    const langGuide = lang === "mix"
      ? "Write alternating sections: Korean, English, Vietnamese, then repeat once."
      : (lang === "en" ? "Write in English." : lang === "vi" ? "Write in Vietnamese." : "Write in Korean.");

    const prompt = [
      "Write a publish-ready blog post in markdown.",
      `Keyword: ${keyword}`,
      `Style: ${styleHint}`,
      `Reference: ${refUrl || "N/A"}`,
      `Language: ${lang} — ${langGuide}`,
      "Include 3-6 subheadings, short paragraphs, bullets, and a clear CTA."
    ].join("\n");

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });

    if (!resp.ok) {
      const txt = await resp.text();
      return { statusCode: 500, body: JSON.stringify({ error: "Gemini error", detail: txt }) };
    }
    const data = await resp.json();
    const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text).join("\n") || "";

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
