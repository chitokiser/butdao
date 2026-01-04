// /netlify/functions/proof_save.js
// Netlify Blobs 사용 (Netlify DB 역할)
// 설치 필요: npm i @netlify/blobs
// 배포 환경: Netlify (Functions)

const { getStore } = require("@netlify/blobs");

function isBytes32(x) {
  return typeof x === "string" && /^0x[0-9a-fA-F]{64}$/.test(x);
}

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }

    const body = JSON.parse(event.body || "{}");
    const proofHash = String(body.proofHash || "");
    const url = String(body.url || "").trim();

    if (!isBytes32(proofHash)) {
      return { statusCode: 400, body: JSON.stringify({ ok: false, msg: "invalid proofHash" }) };
    }
    if (!url || url.length < 8) {
      return { statusCode: 400, body: JSON.stringify({ ok: false, msg: "invalid url" }) };
    }

    // 추가 메타(선택)
    const rec = {
      proofHash,
      url,
      chainId: body.chainId || "",
      contract: body.contract || "",
      owner: body.owner || "",
      id: body.id || "",
      missionId: body.missionId || "",
      txHash: body.txHash || "",
      createdAt: Date.now()
    };

    const store = getStore("a2e-proof");
    await store.setJSON(proofHash.toLowerCase(), rec);

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
      body: JSON.stringify({ ok: true }),
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: false, msg: e?.message || String(e) }),
    };
  }
};
