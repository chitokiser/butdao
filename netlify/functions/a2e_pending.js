// netlify/functions/a2e_pending.js
import { getStore } from "@netlify/blobs";
import { JsonRpcProvider, Interface, Contract } from "ethers";

const RPC_URL =
  process.env.OPBNB_RPC_URL || "https://opbnb-mainnet-rpc.bnbchain.org";

const A2E_ADDR =
  process.env.A2E_ADDR || "0x29C82645A2299F460BB07A76ba0aF32349bEcB3c";

const ABI_EVENTS = [
  "event ClaimReq(uint256 indexed id, uint256 indexed missionId, bytes32 proof)"
];

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": "*"
    },
    body: JSON.stringify(body)
  };
}

function makeStore() {
  const siteID = process.env.NETLIFY_SITE_ID;
  const token = process.env.NETLIFY_AUTH_TOKEN;

  if (!siteID || !token) {
    return {
      ok: false,
      error:
        "Netlify Blobs 미설정: NETLIFY_SITE_ID, NETLIFY_AUTH_TOKEN 필요"
    };
  }

  return {
    ok: true,
    store: getStore({
      name: "a2e-pending",
      siteID,
      token
    })
  };
}

export const handler = async (event) => {
  const qs = event.queryStringParameters || {};
  const action = (qs.action || "list").toLowerCase();

  const st = makeStore();
  if (!st.ok) return json(200, st);

  const store = st.store;

  try {
    // =====================
    // LIST
    // =====================
    if (action === "list") {
      const { blobs } = await store.list();
      const items = [];

      for (const b of blobs) {
        const v = await store.get(b.key, { type: "json" });
        if (v) items.push(v);
      }

      items.sort((a, b) => (b.requestedAt || 0) - (a.requestedAt || 0));
      return json(200, { ok: true, count: items.length, items });
    }

    // =====================
    // CLEAR
    // =====================
    if (action === "clear") {
      const { blobs } = await store.list();
      await Promise.all(blobs.map(b => store.delete(b.key)));
      return json(200, { ok: true, cleared: blobs.length });
    }

    // =====================
    // SYNC (on-chain → blobs)
    // =====================
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
        const id = Number(e.args.id);
        const missionId = Number(e.args.missionId);
        const proof = e.args.proof;

        const key = `${id}_${missionId}`;
        await store.set(
          key,
          JSON.stringify({
            key,
            id,
            missionId,
            proof,
            tx: e.transactionHash,
            blockNumber: e.blockNumber,
            requestedAt: Date.now()
          })
        );
        upserted++;
      }

      return json(200, { ok: true, fromBlock, latest, upserted });
    }

    return json(400, { ok: false, error: "unknown action" });
  } catch (e) {
    return json(500, { ok: false, error: e.message || String(e) });
  }
};
