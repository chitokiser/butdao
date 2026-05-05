// /netlify/functions/jump_tx.js
// Jump 수탁지갑 트랜잭션 서명 및 브로드캐스트
//
// 필요한 Netlify 환경변수:
//   JUMP_MASTER_KEY — jump_wallet.js와 동일한 비밀키

const { createHmac } = require("crypto");

const FIREBASE_WEB_API_KEY = "AIzaSyD6oGXWcQIAa46ZiO6E9fBWOXqiNCAL4-c";
const PARTNER_API_KEY = "3fd9afc326ff3f687197f3fbc8f746133d513e5f3237a54a94cd87a3dd3b56cf";
const OPBNB_RPC = "https://opbnb-mainnet-rpc.bnbchain.org";

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

function derivePrivateKey(uid, masterKey) {
  return "0x" + createHmac("sha256", masterKey).update(uid).digest("hex");
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: JSON_HEADERS, body: JSON.stringify({ ok: false, msg: "Method Not Allowed" }) };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const { idToken, partnerApiKey, txData } = body;

    if (!partnerApiKey || partnerApiKey !== PARTNER_API_KEY) {
      return { statusCode: 403, headers: JSON_HEADERS, body: JSON.stringify({ ok: false, msg: "Unauthorized" }) };
    }

    const masterKey = process.env.JUMP_MASTER_KEY;
    if (!masterKey) {
      return { statusCode: 500, headers: JSON_HEADERS, body: JSON.stringify({ ok: false, msg: "Server misconfigured" }) };
    }

    if (!idToken) {
      return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ ok: false, msg: "idToken required" }) };
    }

    if (!txData || !txData.to) {
      return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ ok: false, msg: "txData.to required" }) };
    }

    const firebaseUser = await verifyFirebaseToken(idToken);
    const privateKey = derivePrivateKey(firebaseUser.localId, masterKey);

    const { Wallet, JsonRpcProvider } = require("ethers");
    const provider = new JsonRpcProvider(OPBNB_RPC);
    const wallet = new Wallet(privateKey, provider);

    const tx = await wallet.sendTransaction({
      to: txData.to,
      data: txData.data || "0x",
      value: txData.value || "0x0",
    });

    return {
      statusCode: 200,
      headers: JSON_HEADERS,
      body: JSON.stringify({ ok: true, txHash: tx.hash }),
    };
  } catch (e) {
    console.error("jump_tx error:", e);
    return {
      statusCode: 500,
      headers: JSON_HEADERS,
      body: JSON.stringify({ ok: false, msg: e?.message || String(e) }),
    };
  }
};
