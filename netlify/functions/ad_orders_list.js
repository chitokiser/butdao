// /netlify/functions/ad_orders_list.js
import admin from "firebase-admin";

let inited = false;

function init() {
  if (inited) return;

  const json = process.env.FIREBASE_ADMIN_JSON;
  if (!json) throw new Error("Missing FIREBASE_ADMIN_JSON");

  const cred = admin.credential.cert(JSON.parse(json));
  admin.initializeApp({ credential: cred });

  inited = true;
}

export async function handler(event) {
  try {
    init();

    const limit = Math.min(
      Math.max(parseInt(event.queryStringParameters?.limit || "50", 10), 1),
      200
    );

    const col = process.env.AD_ORDERS_COLLECTION || "ad_orders";
    const db = admin.firestore();

    const snap = await db
      .collection(col)
      .orderBy("createdAt", "desc")
      .limit(limit)
      .get();

    const items = snap.docs.map((d) => {
      const x = d.data() || {};
      const p = x.payment || {};

      return {
        docId: d.id,
        serviceId: x.serviceId ?? null,
        serviceName: x.serviceName ?? "",
        pricePaw: x.pricePaw ?? null,
        status: x.status ?? "",
        createdAt: x.createdAt ? x.createdAt.toDate().toISOString() : null,
        payment: {
          payer: p.payer ?? null,
          txHash: p.txHash ?? null,
          txUrl: p.txUrl ?? null,
          amountHuman: p.amountHuman ?? null,
          token: p.token ?? null
        }
      };
    });

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store"
      },
      body: JSON.stringify({ ok: true, items })
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ok: false,
        error: e?.message || String(e)
      })
    };
  }
}
