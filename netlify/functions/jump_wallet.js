// /netlify/functions/jump_wallet.js
// Jump 파트너 수탁지갑 생성/조회
//
// 필요한 Netlify 환경변수:
//   JUMP_MASTER_KEY — 지갑 파생에 사용하는 서버 비밀키 (32바이트 hex)
//                     생성: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

const { createHmac } = require("crypto");

const FIREBASE_WEB_API_KEY = "AIzaSyD6oGXWcQIAa46ZiO6E9fBWOXqiNCAL4-c";
const PARTNER_API_KEY = "3fd9afc326ff3f687197f3fbc8f746133d513e5f3237a54a94cd87a3dd3b56cf";

const JSON_HEADERS = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};

async function verifyFirebaseToken(idToken) {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_WEB_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error("Firebase token verification failed: " + text);
  }
  const data = await res.json();
  if (!data.users?.[0]) throw new Error("Invalid Firebase token");
  return data.users[0];
}

function deriveWalletAddress(uid, masterKey) {
  // HMAC-SHA256(masterKey, uid) → 32바이트 → private key
  // 동일한 uid는 항상 동일한 지갑 주소를 반환 (재현 가능, DB 불필요)
  const privateKey = "0x" + createHmac("sha256", masterKey).update(uid).digest("hex");
  const { Wallet } = require("ethers");
  return new Wallet(privateKey).address;
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: JSON_HEADERS, body: JSON.stringify({ ok: false, msg: "Method Not Allowed" }) };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const { idToken, partnerApiKey } = body;

    if (!partnerApiKey || partnerApiKey !== PARTNER_API_KEY) {
      return { statusCode: 403, headers: JSON_HEADERS, body: JSON.stringify({ ok: false, msg: "Unauthorized" }) };
    }

    const masterKey = process.env.JUMP_MASTER_KEY;
    if (!masterKey) {
      console.error("JUMP_MASTER_KEY 환경변수가 설정되지 않았습니다.");
      return { statusCode: 500, headers: JSON_HEADERS, body: JSON.stringify({ ok: false, msg: "Server misconfigured" }) };
    }

    if (!idToken) {
      return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ ok: false, msg: "idToken required" }) };
    }

    const firebaseUser = await verifyFirebaseToken(idToken);
    const walletAddress = deriveWalletAddress(firebaseUser.localId, masterKey);

    return {
      statusCode: 200,
      headers: JSON_HEADERS,
      body: JSON.stringify({
        ok: true,
        walletAddress,
        displayName: firebaseUser.displayName || "",
        email: firebaseUser.email || "",
        photoUrl: firebaseUser.photoUrl || "",
      }),
    };
  } catch (e) {
    console.error("jump_wallet error:", e);
    return {
      statusCode: 500,
      headers: JSON_HEADERS,
      body: JSON.stringify({ ok: false, msg: e?.message || String(e) }),
    };
  }
};
