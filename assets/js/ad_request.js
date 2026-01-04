// /assets/js/ad_request.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getFirestore, collection, addDoc, serverTimestamp, updateDoc, doc
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import {
  getAuth, signInAnonymously
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

const $ = (id) => document.getElementById(id);

const CFG = window.APP;
const ADS = CFG.ads;

const SERVICES = ADS.services;
const ORDERS_COL = ADS.ordersCollection;

const PAY = ADS.payment;
const HEX_TOKEN = PAY.tokenAddress;
const A2E_RECEIVER = PAY.receiver;
const OPBNB_CHAIN_ID = PAY.chainId;

const ERC20_ABI = [
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)"
];

const app = initializeApp(CFG.firebase);
const db = getFirestore(app);
const auth = getAuth(app);

async function ensureAuth() {
  try {
    if (auth.currentUser) return auth.currentUser;
    const cred = await signInAnonymously(auth);
    return cred.user;
  } catch (e) {
    console.warn("anonymous auth failed:", e);
    return null;
  }
}

function renderTable() {
  const body = $("svcBody");
  body.innerHTML = "";

  for (const s of SERVICES) {
    const tr = document.createElement("tr");
    const priceText = (s.pricePaw == null) ? "미설정" : String(s.pricePaw);

    tr.innerHTML = `
      <td><span class="chip">${s.id}</span></td>
      <td>${s.name}</td>
      <td class="muted">${s.base}</td>
      <td class="muted">${s.required}</td>
      <td class="right"><span class="price">${priceText}</span></td>
      <td class="right"><button class="btn" data-order="${s.id}">주문하기</button></td>
    `;
    body.appendChild(tr);
  }

  body.querySelectorAll("button[data-order]").forEach((btn) => {
    btn.addEventListener("click", () => openModal(Number(btn.getAttribute("data-order"))));
  });
}

let selectedService = null;

function openModal(serviceId) {
  selectedService = SERVICES.find(x => x.id === serviceId);
  if (!selectedService) return;

  $("mTitle").textContent = `주문 요청 — [${selectedService.id}] ${selectedService.name}`;
  $("mDesc").textContent = `기본 제공: ${selectedService.base}`;

  $("mContact").value = "";
  $("mRequired").value = "";
  $("mLink").value = "";
  $("mMemo").value = "";

  $("mStatus").textContent = "";
  $("modalBack").style.display = "flex";

  // 결제 버튼 텍스트
  $("btnSubmit").textContent = `${PAY.tokenSymbol} ${selectedService.pricePaw} 결제 및 주문`;
}

function closeModal() {
  $("modalBack").style.display = "none";
}

function safeTrim(v) {
  return String(v || "").trim();
}

function isValidUrlMaybe(v) {
  const s = safeTrim(v);
  if (!s) return true;
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function txUrl(hash) {
  return PAY.explorerTx + hash;
}

async function ensureWalletOnOpBNB(provider) {
  const net = await provider.getNetwork();
  if (Number(net.chainId) === OPBNB_CHAIN_ID) return;

  // opBNB 체인 전환(204 = 0xCC)
  await window.ethereum.request({
    method: "wallet_switchEthereumChain",
    params: [{ chainId: "0xCC" }]
  });
}

async function payHexAndGetReceipt(amountHuman) {
  if (!window.ethereum || !window.ethers) {
    throw new Error("지갑(메타마스크/라비)을 설치/연결해 주세요.");
  }

  const provider = new ethers.providers.Web3Provider(window.ethereum, "any");
  await provider.send("eth_requestAccounts", []);
  await ensureWalletOnOpBNB(provider);

  const signer = provider.getSigner();
  const payer = await signer.getAddress();

  // HexStableToken 컨트랙트
  const token = new ethers.Contract(HEX_TOKEN, ERC20_ABI, signer);

  // decimals(없으면 18로)
  const dec = await token.decimals().catch(() => PAY.decimalsFallback);
  const sym = await token.symbol().catch(() => PAY.tokenSymbol);

  // 결제 금액을 토큰 최소단위로 변환
  const amountWei = ethers.utils.parseUnits(String(amountHuman), Number(dec));

  // 잔액 체크
  const bal = await token.balanceOf(payer);
  if (bal.lt(amountWei)) throw new Error(`${sym} 잔액이 부족합니다.`);

  // 여기서 “HexStableToken.sol 함수”를 호출하는 것 = transfer()
  // 받는 곳: 0x0f9a94A3...
  const tx = await token.transfer(A2E_RECEIVER, amountWei);
  const receipt = await tx.wait();

  return {
    payer,
    chainId: (await provider.getNetwork()).chainId,
    token: sym,
    tokenAddress: HEX_TOKEN,
    to: A2E_RECEIVER,
    amountWei: amountWei.toString(),
    amountHuman: String(amountHuman),
    txHash: tx.hash,
    txUrl: txUrl(tx.hash),
    blockNumber: receipt.blockNumber
  };
}



async function submitOrder() {
  const statusEl = $("mStatus");
  const btn = $("btnSubmit");

  statusEl.textContent = "";
  statusEl.className = "muted";
  btn.disabled = true;

  try {
    if (!selectedService) throw new Error("서비스 선택 오류");

    const contact = safeTrim($("mContact").value);
    const required = safeTrim($("mRequired").value);
    const link = safeTrim($("mLink").value);
    const memo = safeTrim($("mMemo").value);

    if (contact.length < 3) throw new Error("연락처를 입력하세요.");
    if (required.length < 3) throw new Error("필수 제공사항을 입력하세요.");
    if (!isValidUrlMaybe(link)) throw new Error("추가 참고 링크는 http/https URL만 가능합니다.");

    const user = await ensureAuth();

    // 1) 주문 문서 생성
    statusEl.textContent = "주문 저장 중...";
    const orderDoc = {
      serviceId: selectedService.id,
      serviceName: selectedService.name,
      pricePaw: selectedService.pricePaw ?? null,

      contact,
      required,
      link: link || null,
      memo: memo || null,

      status: "REQUESTED",
      payment: {
        chainId: null,
        token: PAY.tokenSymbol,
        tokenAddress: HEX_TOKEN,
        to: A2E_RECEIVER,
        amountWei: null,
        amountHuman: String(selectedService.pricePaw),
        payer: null,
        txHash: null,
        txUrl: null,
        blockNumber: null,
        paidAt: null
      },

      client: {
        uid: user ? user.uid : null,
        userAgent: navigator.userAgent || "",
        lang: navigator.language || ""
      },

      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    const ref = await addDoc(collection(db, ORDERS_COL), orderDoc);

    // 2) 결제 진행
    statusEl.textContent = "지갑 결제 진행 중... (HEX 전송)";
    const pay = await payHexAndGetReceipt(selectedService.pricePaw);

    // 3) 결제 영수증 링크 DB 업데이트
    statusEl.textContent = "결제 확인 중... DB 업데이트";
    await updateDoc(doc(db, ORDERS_COL, ref.id), {
      status: "PAID",
      "payment.chainId": pay.chainId,
      "payment.token": pay.token,
      "payment.tokenAddress": pay.tokenAddress,
      "payment.to": pay.to,
      "payment.amountWei": pay.amountWei,
      "payment.amountHuman": pay.amountHuman,
      "payment.payer": pay.payer,
      "payment.txHash": pay.txHash,
      "payment.txUrl": pay.txUrl,
      "payment.blockNumber": pay.blockNumber,
      "payment.paidAt": serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    statusEl.className = "ok";
    statusEl.textContent = `완료: 결제 영수증 저장됨 (${pay.txUrl})`;

    setTimeout(() => closeModal(), 800);
  } catch (e) {
    statusEl.className = "bad";
    statusEl.textContent = e?.message || String(e);
  } finally {
    btn.disabled = false;
  }
}

async function refreshTokenInfo() {
  try {
    if (!window.ethereum || !window.ethers) {
      $("tokenInfo").textContent = "지갑 미연결";
      return;
    }
    const provider = new ethers.providers.Web3Provider(window.ethereum, "any");
    const token = new ethers.Contract(HEX_TOKEN, ERC20_ABI, provider);
    const sym = await token.symbol().catch(() => PAY.tokenSymbol);
    const dec = await token.decimals().catch(() => PAY.decimalsFallback);

    const r = A2E_RECEIVER;
    $("tokenInfo").textContent = `토큰: ${sym} · decimals: ${dec} · 결제수령: ${r.slice(0, 6)}...${r.slice(-4)}`;
  } catch {
    $("tokenInfo").textContent = "토큰 정보 조회 실패";
  }
}

function bind() {
  $("btnClose").addEventListener("click", closeModal);
  $("modalBack").addEventListener("click", (e) => {
    if (e.target === $("modalBack")) closeModal();
  });

  $("btnSubmit").addEventListener("click", submitOrder);
  $("btnRefreshPrice").addEventListener("click", refreshTokenInfo);
}

document.addEventListener("DOMContentLoaded", async () => {
  renderTable();
  bind();
  await refreshTokenInfo();
  await ensureAuth();
});
