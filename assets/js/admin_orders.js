// /assets/js/admin_orders.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getFirestore, collection, getDocs, query, orderBy, limit
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import {
  getAuth, signInAnonymously
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

const $ = (id) => document.getElementById(id);

function fmtAddr(a) {
  if (!a) return "-";
  return a.slice(0, 6) + "..." + a.slice(-4);
}
function fmtISO(iso) {
  if (!iso) return "-";
  try { return new Date(iso).toLocaleString(); } catch { return String(iso); }
}
function setMsg(msg) {
  const el = $("ordersMsg");
  if (el) el.textContent = msg || "";
}
function renderEmpty(msg) {
  const list = $("ordersList");
  if (!list) return;
  list.innerHTML = "";
  const div = document.createElement("div");
  div.className = "item muted";
  div.textContent = msg || "주문 없음";
  list.appendChild(div);
}
function link(url, text) {
  const a = document.createElement("a");
  a.href = url;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  a.textContent = text || url;
  return a;
}

// 관리자 여부(스태프 레벨) 체크: 컨트랙트 staff>=5
async function isAdminStaff() {
  try {
    if (!window.ethereum || !window.ethers) return false;
    const provider = new ethers.providers.Web3Provider(window.ethereum, "any");
    await provider.send("eth_requestAccounts", []);
    const signer = provider.getSigner();
    const me = await signer.getAddress();

    const a2eAddr = window.APP?.contracts?.a2e;
    const abi = window.APP?.a2eAbi;
    if (!a2eAddr || !abi) return false;

    const a2e = new ethers.Contract(a2eAddr, abi, provider);
    const lv = await a2e.staff(me).catch(() => 0);
    return Number(lv) >= 5;
  } catch {
    return false;
  }
}

async function ensureAnonAuth(auth) {
  try {
    if (auth.currentUser) return auth.currentUser;
    const cred = await signInAnonymously(auth);
    return cred.user;
  } catch {
    return null;
  }
}

async function loadOrders(db) {
  const list = $("ordersList");
  if (!list) return;

  const okStaff = await isAdminStaff();
  if (!okStaff) {
    renderEmpty("접근 불가: staff 레벨이 5 이상이어야 합니다.");
    return;
  }

  const lim = Number($("ordersLimit")?.value || 50) || 50;

  renderEmpty("불러오는 중...");
  setMsg("");

  const colName = window.APP?.ads?.ordersCollection || "ad_orders";
  const q = query(collection(db, colName), orderBy("createdAt", "desc"), limit(lim));
  const snap = await getDocs(q);

  if (snap.empty) {
    renderEmpty("주문 0개");
    return;
  }

  list.innerHTML = "";

  snap.forEach((docSnap) => {
    const d = docSnap.data() || {};
    const p = d.payment || {};
    const createdAtISO =
      d.createdAt?.toDate ? d.createdAt.toDate().toISOString() : null;

    const txUrl =
      p.txUrl ||
      (p.txHash ? (window.APP?.chain?.blockExplorer || "https://opbnbscan.com") + "/tx/" + p.txHash : null);

    const item = document.createElement("div");
    item.className = "item";

    const top = document.createElement("div");
    top.style.display = "flex";
    top.style.justifyContent = "space-between";
    top.style.gap = "10px";
    top.style.flexWrap = "wrap";

    const left = document.createElement("div");
    left.style.fontWeight = "800";
    left.textContent = (d.serviceName || "서비스") + " (#" + (d.serviceId ?? "-") + ")";

    const right = document.createElement("div");
    right.className = "muted";
    right.textContent = "status: " + (d.status || "-");

    top.appendChild(left);
    top.appendChild(right);

    const line1 = document.createElement("div");
    line1.className = "muted";
    line1.style.marginTop = "6px";
    line1.textContent = "주문ID: " + docSnap.id + " / 생성: " + fmtISO(createdAtISO);

    const line2 = document.createElement("div");
    line2.className = "muted";
    line2.style.marginTop = "6px";
    line2.textContent = "가격: " + (d.pricePaw != null ? String(d.pricePaw) : "-") + " HEX";

    const line3 = document.createElement("div");
    line3.className = "muted";
    line3.style.marginTop = "6px";
    line3.textContent = "결제자: " + (p.payer ? fmtAddr(p.payer) : "-");

    const line4 = document.createElement("div");
    line4.className = "muted";
    line4.style.marginTop = "6px";
    line4.textContent = "영수증: ";
    
   const line5 = document.createElement("div");
line5.className = "muted";
line5.style.marginTop = "6px";
line5.textContent = "연락처: " + (d.contact || "-");

const line6 = document.createElement("div");
line6.className = "muted";
line6.style.marginTop = "6px";
line6.textContent = "요청사항: " + (d.required || "-");

const line7 = document.createElement("div");
line7.className = "muted";
line7.style.marginTop = "6px";
line7.textContent = "참고링크: ";

if (d.link) line7.appendChild(link(d.link, d.link));
else line7.appendChild(document.createTextNode("-"));

const line8 = document.createElement("div");
line8.className = "muted";
line8.style.marginTop = "6px";
line8.textContent = "메모: " + (d.memo || "-");

    if (txUrl && p.txHash) {
      line4.appendChild(link(txUrl, p.txHash));
    } else {
      line4.appendChild(document.createTextNode("-"));
    }

    item.appendChild(top);
    item.appendChild(line1);
    item.appendChild(line2);
    item.appendChild(line3);
    item.appendChild(line4);
    item.appendChild(line5);
item.appendChild(line6);
item.appendChild(line7);
item.appendChild(line8);
    list.appendChild(item);
  });

  setMsg("표시 완료");
}

document.addEventListener("DOMContentLoaded", async () => {
  const cfg = window.APP?.firebase;
  if (!cfg) {
    renderEmpty("APP.firebase 설정이 없습니다. config.js 로드 순서를 확인하세요.");
    return;
  }

  const app = initializeApp(cfg);
  const db = getFirestore(app);
  const auth = getAuth(app);

  // 익명 인증(규칙에서 request.auth 요구하는 경우 대비)
  await ensureAnonAuth(auth);

  $("btnOrdersRefresh")?.addEventListener("click", () => loadOrders(db));

  // 자동 1회 로드
  await loadOrders(db);
});
