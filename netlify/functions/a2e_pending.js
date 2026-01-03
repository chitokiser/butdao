// netlify/functions/a2e_pending.js
import { getStore } from "@netlify/blobs";
import { ethers } from "ethers";

/*
  endpoints
  - ?action=sync : 온체인 이벤트를 읽어 pending 스토어에 누적(간단 sync)
  - ?action=list : pending 목록 반환
  - ?action=clear : (선택) pending 전체 삭제 (관리자만 쓰게 하려면 토큰체크 추가 권장)
*/

const RPC_URL =
  process.env.OPBNB_RPC_URL || "https://opbnb-mainnet-rpc.bnbchain.org";

// 여기에 당신 프로젝트의 실제 a2e_slim 주소
const A2E_ADDR =
  process.env.A2E_ADDR || "0x29C82645A2299F460BB07A76ba0aF32349bEcB3c";

// 최소 ABI (ClaimRequested 이벤트만 읽으면 pending 구축 가능)
// 만약 이벤트 시그니처가 다르면 여기만 맞춰주면 됩니다.
const ABI_EVENTS = [
  // 예: event ClaimRequested(address indexed user, uint256 indexed missionId, bytes32 proofHash);
  "event ClaimRequested(address indexed user, uint256 indexed missionId, bytes32 proofHash)",
];

// 스토어 생성 (Blobs 설정 없으면 안내 에러)
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

export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return json(200, { ok: true });

  const qs = event.queryStringParameters || {};
  const action = String(qs.action || "list").toLowerCase();

  const st = makeStore();
  if (!st.ok) return json(200, st);

  const store = st.store;

  try {
    // pending list
    if (action === "list") {
      const keys = [];
      for await (const k of store.list()) keys.push(k);

      const items = [];
      for (const k of keys) {
        const v = await store.get(k, { type: "json" });
        if (v) items.push(v);
      }

      // 최신순 정렬
      items.sort((a, b) => (b.requestedAt || 0) - (a.requestedAt || 0));

      return json(200, { ok: true, count: items.length, items });
    }

    // clear all (옵션)
    if (action === "clear") {
      const keys = [];
      for await (const k of store.list()) keys.push(k);
      await Promise.all(keys.map((k) => store.delete(k)));
      return json(200, { ok: true, cleared: keys.length });
    }

    // sync: ClaimRequested 이벤트를 읽어서 store에 넣기
    if (action === "sync") {
      const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
      const iface = new ethers.utils.Interface(ABI_EVENTS);
      const contract = new ethers.Contract(A2E_ADDR, iface, provider);

      // 너무 멀리 뒤지면 느리니 기본 5000블록만(필요시 qs.fromBlock로 지정)
      const latest = await provider.getBlockNumber();
      const span = Number(qs.span || 5000);
      const fromBlock = Math.max(0, latest - span);

      const ev = await contract.queryFilter(
        contract.filters.ClaimRequested(),
        fromBlock,
        latest
      );

      let upserted = 0;

      for (const e of ev) {
        const user = e.args?.user;
        const missionId = e.args?.missionId?.toString?.() ?? String(e.args?.missionId);
        const proof = e.args?.proofHash ?? "0x";

        // key는 user+missionId 조합 (중복 방지)
        const key = `${String(user).toLowerCase()}_${missionId}`;

        const data = {
          key,
          user,
          missionId: Number(missionId),
          proof,
          tx: e.transactionHash,
          blockNumber: e.blockNumber,
          requestedAt: Date.now(), // 온체인 timestamp로 바꾸려면 block 조회해서 넣으면 됨
        };

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
