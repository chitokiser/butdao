// netlify/functions/a2e_pending.js
import { JsonRpcProvider, Contract, Interface } from "ethers";
import { getStore } from "@netlify/blobs";

const RPC_URL = process.env.OPBNB_RPC_URL || "https://opbnb-mainnet-rpc.bnbchain.org";
const A2E_ADDR = (process.env.A2E_ADDR || "").trim();
const START_BLOCK = Number(process.env.A2E_START_BLOCK || "0");
const CONFIRMATIONS = Number(process.env.A2E_CONFIRMATIONS || "5");

// 컨트랙트 이벤트가 아래와 다르면 "여기 3줄"만 실제 이벤트로 바꿔야 합니다.
const ABI_EVENTS = [
  "event ClaimRequested(uint256 indexed id,uint256 indexed missionId,bytes32 proof,uint64 reqAt)",
  "event ClaimCancelled(uint256 indexed id,uint256 indexed missionId)",
  "event ClaimResolved(uint256 indexed id,uint256 indexed missionId)"
];

// onchain 보강 조회 (없으면 지워도 됩니다)
const ABI_VIEWS = [
  "function myInfo(uint256) view returns (address owner,address mento,uint256 level,uint256 exp,uint256 mypay,uint256 totalpay,uint256 memberUntil,bool blacklisted)",
  "function adprice(uint256) view returns (uint256)",
  "function staff(address) view returns (uint8)"
];

function jok(data) {
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    body: JSON.stringify({ ok: true, ...data })
  };
}

function jbad(code, msg) {
  return {
    statusCode: code,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    body: JSON.stringify({ ok: false, error: msg })
  };
}

function keyOf(id, missionId) {
  return `${id}:${missionId}`;
}

function toNum(v) {
  // ethers v6는 bigint가 많이 나옵니다.
  try {
    if (typeof v === "bigint") return Number(v);
    return Number(v?.toString?.() ?? v);
  } catch {
    return 0;
  }
}

function toStr(v) {
  try {
    if (typeof v === "bigint") return v.toString();
    return (v?.toString?.() ?? String(v));
  } catch {
    return String(v);
  }
}

async function safeHead(provider) {
  const head = await provider.getBlockNumber();
  return Math.max(0, head - CONFIRMATIONS);
}

async function syncOnce({ provider, contract, store }) {
  if (!A2E_ADDR) throw new Error("A2E_ADDR env missing");

  const meta = (await store.get("meta", { type: "json" })) || {};
  let fromBlock = Number(meta.lastScannedBlock || 0);
  if (!fromBlock || fromBlock < START_BLOCK) fromBlock = START_BLOCK;

  const toBlock = await safeHead(provider);
  if (toBlock <= fromBlock) {
    return { fromBlock, toBlock, scanned: 0, added: 0, removed: 0 };
  }

  const CHUNK = 50_000;
  let cursor = fromBlock + 1;

  let scanned = 0;
  let added = 0;
  let removed = 0;

  const pending = (await store.get("pending", { type: "json" })) || {};

  while (cursor <= toBlock) {
    const end = Math.min(cursor + CHUNK - 1, toBlock);

    const reqLogs = await contract.queryFilter(contract.filters.ClaimRequested(), cursor, end);
    for (const l of reqLogs) {
      scanned++;
      const a = l.args || [];
      const id = toStr(a.id);
      const missionId = toStr(a.missionId);
      const proof = a.proof;
      const reqAt = toNum(a.reqAt);

      const k = keyOf(id, missionId);
      pending[k] = {
        id,
        missionId,
        proof,
        reqAt,
        tx: l.transactionHash,
        block: l.blockNumber
      };
      added++;
    }

    const canLogs = await contract.queryFilter(contract.filters.ClaimCancelled(), cursor, end);
    for (const l of canLogs) {
      scanned++;
      const a = l.args || [];
      const id = toStr(a.id);
      const missionId = toStr(a.missionId);
      const k = keyOf(id, missionId);
      if (pending[k]) {
        delete pending[k];
        removed++;
      }
    }

    const resLogs = await contract.queryFilter(contract.filters.ClaimResolved(), cursor, end);
    for (const l of resLogs) {
      scanned++;
      const a = l.args || [];
      const id = toStr(a.id);
      const missionId = toStr(a.missionId);
      const k = keyOf(id, missionId);
      if (pending[k]) {
        delete pending[k];
        removed++;
      }
    }

    cursor = end + 1;
  }

  await store.set("pending", pending, { type: "json" });
  await store.set("meta", { lastScannedBlock: toBlock }, { type: "json" });

  return { fromBlock, toBlock, scanned, added, removed };
}

async function listPending({ store, contract, includeOnchain }) {
  const pending = (await store.get("pending", { type: "json" })) || {};
  const arr = Object.values(pending);

  arr.sort((a, b) => (b.reqAt || 0) - (a.reqAt || 0) || (b.block || 0) - (a.block || 0));

  if (!includeOnchain) return arr;

  const out = [];
  for (const p of arr) {
    try {
      const ui = await contract.myInfo(BigInt(p.id));
      const priceWei = await contract.adprice(BigInt(p.missionId));

      out.push({
        ...p,
        owner: ui.owner,
        memberUntil: toNum(ui.memberUntil),
        blacklisted: !!ui.blacklisted,
        priceWei: toStr(priceWei)
      });
    } catch {
      out.push({ ...p });
    }
  }
  return out;
}

export const handler = async (event) => {
  try {
    const qs = event.queryStringParameters || {};
    const action = String(qs.action || "list").toLowerCase();

    const store = getStore("a2e-pending");

    const provider = new JsonRpcProvider(RPC_URL);
    const iface = new Interface([...ABI_EVENTS, ...ABI_VIEWS]);
    const contract = new Contract(A2E_ADDR, iface, provider);

    if (action === "sync") {
      const r = await syncOnce({ provider, contract, store });
      return jok({ action: "sync", ...r });
    }

    if (action === "list") {
      const includeOnchain = String(qs.onchain || "0") === "1";
      const items = await listPending({ store, contract, includeOnchain });
      return jok({ action: "list", count: items.length, items });
    }

    return jbad(400, "unknown action");
  } catch (e) {
    return jbad(500, e?.message || String(e));
  }
};
