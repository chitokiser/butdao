// /netlify/functions/proof_get.js
const { getStore } = require("@netlify/blobs");

function isBytes32(x) {
  return typeof x === "string" && /^0x[0-9a-fA-F]{64}$/.test(x);
}

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "GET") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }

    const params = event.queryStringParameters || {};
    const proofHash = String(params.proofHash || "");

    if (!isBytes32(proofHash)) {
      return { statusCode: 400, body: JSON.stringify({ ok: false, msg: "invalid proofHash" }) };
    }

    const store = getStore("a2e-proof");
    const rec = await store.getJSON(proofHash.toLowerCase());

    if (!rec) {
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        body: JSON.stringify({ ok: true, found: false }),
      };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      body: JSON.stringify({ ok: true, found: true, rec }),
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: false, msg: e?.message || String(e) }),
    };
  }
};
