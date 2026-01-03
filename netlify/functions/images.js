// File: netlify/functions/images.js
// 관련 이미지(PEXELS). 키 없으면 빈 배열 리턴
exports.handler = async (event) => {
  try {
    const { q = "", n = "6" } = event.queryStringParameters || {};
    if (!process.env.PEXELS_API_KEY) {
      return { statusCode: 200, body: JSON.stringify({ urls: [] }) };
    }
    const resp = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=${n}`, {
      headers: { Authorization: process.env.PEXELS_API_KEY }
    });
    const data = await resp.json();
    const urls = (data.photos || []).map(p => p.src?.medium).filter(Boolean);
    return { statusCode: 200, body: JSON.stringify({ urls }) };
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
