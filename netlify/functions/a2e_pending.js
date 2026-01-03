// netlify/functions/a2e_pending.js
import { getStore } from "@netlify/blobs";
import { JsonRpcProvider, Interface, Contract } from "ethers";

const RPC_URL =
  process.env.OPBNB_RPC_URL || "https://opbnb-mainnet-rpc.bnbchain.org";

const A2E_ADDR =
  process.env.A2E_ADDR || "0x29C82645A2299F460BB07A76ba0aF32349bEcB3c";

// ⚠️ 이벤트명/시그니처는 실제 컨트랙트와 동일해야 sync가 됩니다.
const ABI_EVENTS = [
  "event ClaimReq(uint256 indexed id, uint256 indexed missionId, bytes32 proof)",
];

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers": "content-type",
    },
    body: JSON.stringify(body),
  };
}

function makeStore() {
  const siteID = process.env.NETLIFY_SITE_ID;
  const token = process.env.NETLIFY_AUTH_TOKEN;

  if (!siteID || !token) {
    const missing = [
      !siteID ? "NETLIFY_SITE_ID" : null,
      !token ? "NETLIFY_AUTH_TOKEN" : null,
    ].filter(Boolean);

    return {
      ok: false,
      error:
        "Netlify Blobs 미설정: 환경변수 필요 -> " +
        missing.join(", ") +
        " (Project configuration > Environment variables)",
    };
  }

  return {
    ok: true,
    store: getStore({ name: "a2e-pending", siteID, token }),
  };
}

// store.list는 async iterable이 아니라 페이지 객체 반환 → 전체 key 수집
async function listAllKeys(store) {
  const keys = [];
  let cursor = undefined;

  while (true) {
    const res = await store.list(cursor ? { cursor } : {});
    const blobs = res?.blobs || [];
    for (const b of blobs) if (b?.key) keys.push(b.key);

    cursor = res?.next_cursor || res?.cursor;
    if (!cursor) break;
  }
  return keys;
}

export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return json(200, { ok: true });

  const qs = event.queryStringParameters || {};
  const action = String(qs.action || "list").toLowerCase();

  const st = makeStore();
  if (!st.ok) return json(200, st);
  const store = st.store;

  try {
    if (action === "list") {
      const keys = await listAllKeys(store);

      const items = [];
      for (const k of keys) {
        const v = await store.get(k, { type: "json" });
        if (v) items.push(v);
      }

      items.sort((a, b) => (b.blockNumber || 0) - (a.blockNumber || 0));
      return json(200, { ok: true, count: items.length, items });
    }

    if (action === "del") {
      const key = String(qs.key || "");
      if (!key) return json(400, { ok: false, error: "missing key" });
      await store.delete(key);
      return json(200, { ok: true, deleted: key });
    }

    if (action === "clear") {
      const keys = await listAllKeys(store);
      await Promise.all(keys.map((k) => store.delete(k)));
      return json(200, { ok: true, cleared: keys.length });
    }

    if (action === "sync") {
      const provider = new JsonRpcProvider(RPC_URL);
      const iface = new Interface(ABI_EVENTS);
      const contract = new Contract(A2E_ADDR, iface, provider);

      const latest = await provider.getBlockNumber();
      const span = Number(qs.span || 5000);
      const fromBlock = Math.max(0, latest - span);

      const events = await contract.queryFilter(
        contract.filters.ClaimReq(),
        fromBlock,
        latest
      );

      let upserted = 0;

      for (const e of events) {
        const id = Number(e.args?.id);
        const missionId = Number(e.args?.missionId);
        const proof = e.args?.proof ?? "0x";

        if (!Number.isFinite(id) || !Number.isFinite(missionId)) continue;

        const key = `${id}_${missionId}`;

        // block timestamp(가능하면)
        let requestedAt = Date.now();
        try {
          const blk = await provider.getBlock(e.blockNumber);
          const ts = Number(blk?.timestamp || 0);
          if (ts > 0) requestedAt = ts * 1000;
        } catch {}

        const data = {
          key,
          id,
          missionId,
          proof: String(proof),
          tx: e.transactionHash,
          blockNumber: e.blockNumber,
          requestedAt,
        };

        await store.set(key, JSON.stringify(data));
        upserted++;
      }

      return json(200, { ok: true, fromBlock, latest, found: events.length, upserted });
    }

    return json(400, { ok: false, error: "unknown action" });
  } catch (e) {
    return json(500, { ok: false, error: e?.message || String(e) });
  }
};
