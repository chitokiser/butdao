// netlify/functions/a2e_pending.js
import { getStore } from "@netlify/blobs";
import { JsonRpcProvider, Contract, Interface } from "ethers";

/*
  endpoints
  - ?action=sync : 온체인 ClaimRequested 이벤트를 읽어 pending 스토어에 누적
  - ?action=list : pending 목록 반환
  - ?action=clear : pending 전체 삭제
*/

const RPC_URL =
  process.env.OPBNB_RPC_URL || "https://opbnb-mainnet-rpc.bnbchain.org";

const A2E_ADDR =
  process.env.A2E_ADDR || "0x29C82645A2299F460BB07A76ba0aF32349bEcB3c";

// ClaimRequested 이벤트 시그니처가 실제 컨트랙트와 100% 일치해야 합니다.
// (만약 proofHash가 없거나, 파라미터가 다르면 여기만 수정)
const ABI_EVENTS = [
  "event ClaimRequested(address indexed user, uint256 indexed missionId, bytes32 proofHash)",
];

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

  const store = getStore({
    name: "a2e-pending",
    siteID,
    token,
  });

  return { ok: true, store };
}

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

function pickArg(e, idx, name) {
  // ethers v6: e.args는 array-like + named
  const a = e?.args;
  if (!a) return undefined;
  return a[name] ?? a[idx];
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
      const keys = [];
      // store.list()는 key(or entry)를 반환할 수 있어서 둘 다 처리
      for await (const k of store.list()) {
        const key = typeof k === "string" ? k : k?.key;
        if (key) keys.push(key);
      }

      const items = [];
      for (const k of keys) {
        const v = await store.get(k, { type: "json" });
        if (v) items.push(v);
      }

      items.sort((a, b) => (b.requestedAt || 0) - (a.requestedAt || 0));
      return json(200, { ok: true, count: items.length, items });
    }

    if (action === "clear") {
      const keys = [];
      for await (const k of store.list()) {
        const key = typeof k === "string" ? k : k?.key;
        if (key) keys.push(key);
      }
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

      const filter = contract.filters.ClaimRequested();
      const ev = await contract.queryFilter(filter, fromBlock, latest);

      // 블록 timestamp 캐시(반복 조회 최적화)
      const blockTsCache = new Map();

      let upserted = 0;

      for (const e of ev) {
        const user = pickArg(e, 0, "user");
        const missionIdRaw = pickArg(e, 1, "missionId");
        const proofHash = pickArg(e, 2, "proofHash") ?? "0x";

        const missionId = Number(missionIdRaw?.toString?.() ?? missionIdRaw);
        const userLc = String(user || "").toLowerCase();

        if (!userLc || !Number.isFinite(missionId)) continue;

        const key = `${userLc}_${missionId}`;

        let requestedAt = Date.now();
        const bn = e.blockNumber;

        if (typeof bn === "number") {
          let ts = blockTsCache.get(bn);
          if (!ts) {
            const b = await provider.getBlock(bn);
            ts = Number(b?.timestamp || 0);
            blockTsCache.set(bn, ts);
          }
          if (ts > 0) requestedAt = ts * 1000;
        }

        const data = {
          key,
          user: userLc,
          missionId,
          proof: String(proofHash),
          tx: e.transactionHash,
          blockNumber: e.blockNumber,
          requestedAt,
        };

        // get(...,{type:"json"})와 맞추려면 JSON 문자열로 저장해야 합니다.
        await store.set(key, JSON.stringify(data));
        upserted++;
      }

      return json(200, { ok: true, fromBlock, latest, upserted });
    }

    return json(400, { ok: false, error: "unknown action" });
  } catch (e) {
    return json(500, { ok: false, error: e?.message || String(e) });
  }
};
