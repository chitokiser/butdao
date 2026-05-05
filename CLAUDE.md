# CLAUDE.md — PawDAO / ButDAO 프로젝트 가이드

이 파일은 Claude Code가 이 프로젝트를 이해하고 작업하기 위한 참조 문서입니다.

---

## 프로젝트 개요

**PawDAO** (브랜드명) / **ButDAO** (레포명)는 opBNB 메인넷 기반의 DAO 서비스입니다.  
회원이 SNS 미션을 수행하고 HEX 토큰 보상을 받는 **A2E(Activity-to-Earn)** 구조가 핵심입니다.  
광고 의뢰인이 SNS 활성화를 의뢰하고, DAO 회원들이 미션을 수행하여 수익을 나눕니다.

### 주요 URL
- 프로덕션: `https://butdao.netlify.app`
- 로컬 개발: `http://127.0.0.1:5601` (Netlify CLI: `netlify dev`)

---

## 블록체인

| 항목 | 값 |
|------|-----|
| 체인 | opBNB Mainnet |
| Chain ID | 204 |
| RPC | `https://opbnb-mainnet-rpc.bnbchain.org` |
| 익스플로러 | `https://opbnbscan.com` |
| ethers.js | **v6** (CDN: `ethers@6.14.0`) — BigInt 사용, v5 방식 금지 |

### 스마트 컨트랙트

| 이름 | 주소 |
|------|------|
| A2E 메인 컨트랙트 | `0x0f9a94A3ccae5B685e5a712cdd37f6DA21CfC8f3` |
| HEX Token (HexStableToken, ERC-20) | `0x41F2Ea9F4eF7c4E35ba1a8438fC80937eD4E5464` |

HEX 토큰은 결제 및 보상 모두 이 주소를 사용합니다. 수신 주소는 A2E 컨트랙트 주소와 동일합니다.

### A2E 컨트랙트 주요 함수 (ABI → `config.js`)

```
view: admin(), staff(address)→uint8, totalMember(), nextId(), idOf(address)
view: price(), mentoFee(), claimCooldown(), withdrawCooldown(), seizeGrace()
view: myInfo(id)→(owner,mento,level,exp,mypay,totalpay,memberUntil,blacklisted)
view: claimInfo(id,missionId)→(status,reqAt,proof,lastAt,price_)
view: pendingAt(index)→(id,missionId,owner,reqAt,proof), pendingCount()
view: getDelinquents(start,limit)→(ids,owners,memberUntil)
write: join(mento), renew(id,months), claim(id,missionId,proof), cancelClaim(id,missionId)
write: withdraw(id)
admin: approveClaim, rejectClaim, setAdPrice, setPrice, setMentoFee, setBlacklist, setLevel, flushFee
```

- `staff(address)` → uint8: 0=일반, ≥5=관리자(admin)
- `myInfo.mypay` = 출금 가능 잔액 (wei), `totalpay` = 누적 수령액 (wei)
- `claimInfo.status`: 0=미청구, 1=심사중, 2=반려/취소, 3=승인완료
- 미션 보상 가격은 `adprice(missionId)`로 조회
- 멘토 수수료율: `mentoFee()` (%) — 멘티 totalpay의 해당 % 가 멘토 수익 추정치

---

## Firebase

### 메인 앱 (puppi-d67a1)

```javascript
// config.js에 정의
apiKey: "AIzaSyCoeMQt7UZzNHFt22bnGv_-6g15BnwCEBA"
projectId: "puppi-d67a1"
authDomain: "puppi-d67a1.firebaseapp.com"
```

- Firebase compat SDK v10.12.5 사용 (CDN에서 로드)
- 익명 로그인 + Google OAuth 지원

### Jump 파트너 앱 (jumper-b15aa)

```javascript
// jump-auth.js에 정의
apiKey: "AIzaSyD6oGXWcQIAa46ZiO6E9fBWOXqiNCAL4-c"
projectId: "jumper-b15aa"
authDomain: "jumper-b15aa.firebaseapp.com"
```

- Google OAuth 전용
- 별도의 Firebase App으로 초기화: `firebase.initializeApp(JUMP_CONFIG, "jump")`

### Firestore 컬렉션

| 컬렉션 | 설명 |
|--------|------|
| `users` | 메인 회원 정보 |
| `inventories` | 인벤토리 |
| `shops/{shopId}/**` | 상점 및 아이템 |
| `c2e_mission_refs/**` | C2E 미션 참고자료 |
| `mission_status/{missionId}` | **미션 활성/비활성 상태** (off-chain 관리) |
| `mission_guides` | 미션 가이드 (config.js `missionGuideCollection`) |
| `ad_orders` | 광고 의뢰 주문 |
| `jump_users/{uid}` | Jump 파트너 사용자 정보 |

`mission_status` 컬렉션: 문서 없음 = 활성(기본값). `{ active: false }` 저장 시 비활성.

### Firestore 보안 규칙 (`firestore.rules`)

- `mission_status`: 누구나 읽기, 로그인 사용자 쓰기
- `users`, `inventories`: 로그인 사용자 읽기/쓰기
- `shops`, `c2e_mission_refs`: 누구나 읽기, 로그인 사용자 쓰기
- 나머지 catch-all: 누구나 읽기, `admin==true` 필드가 있어야 쓰기

---

## 파일 구조

### HTML 페이지

| 파일 | 설명 |
|------|------|
| `index.html` | 메인/랜딩 페이지 |
| `a2e.html` | A2E 미션 메인 페이지 |
| `mypage.html` | 마이페이지 (내 정보, 멘티, 미션 상태) |
| `admin.html` | 관리자 페이지 (심사, 광고 주문 등) |
| `jump.html` | Jump 파트너 로그인/대시보드 |
| `ad_request.html` | 광고 의뢰 신청 페이지 |
| `intro.html` | 소개 페이지 |
| `head.html` / `footer.html` | 공통 헤더/푸터 (include.js로 삽입) |

### JavaScript 파일 (`assets/js/`)

| 파일 | 역할 |
|------|------|
| `config.js` | `window.APP` 전역 설정 (체인, 컨트랙트, ABI, Firebase, 미션 목록, 광고 서비스) |
| `wallet.js` | MetaMask 지갑 연결, `window.WALLET` 주입 |
| `include.js` | `head.html`, `footer.html` 동적 삽입 |
| `a2e.js` | A2E 미션 페이지 전체 로직 (회원 가입, 미션 청구, 관리자 기능) |
| `mypage.js` | 마이페이지 로직 (내 정보, 멘티 목록+수익, 미션 상태) |
| `admin.js` | 관리자 페이지 로직 |
| `admin_pending_list.js` | 심사 대기 목록 |
| `admin_orders.js` | 광고 주문 관리 |
| `missions.js` | 미션 관련 공통 유틸 |
| `a2e_id.js` | A2E ID 조회 유틸 |
| `ad_request.js` | 광고 의뢰 신청 로직 |
| `jump-auth.js` | Jump Google 로그인, 수탁지갑 조회, A2E 회원 확인 |
| `jump-a2e.js` | Jump 수탁지갑 → `window.WALLET` 주입, `JumpCustodialSigner` |
| `jump-header.js` | 헤더용 Jump 로그인 상태 표시 |
| `header-wallet.js` | 헤더 지갑 UI 컴포넌트 |
| `i18n.js` | 다국어 지원 |

### Netlify Functions (`netlify/functions/`)

| 파일 | 역할 |
|------|------|
| `jump_wallet.js` | Jump 수탁지갑 생성/조회 (HMAC-SHA256 키 파생) |
| `jump_tx.js` | Jump 수탁지갑으로 온체인 트랜잭션 서명/브로드캐스트 |
| `a2e_pending.js` | A2E 심사 대기 목록 조회 |
| `proof_save.js` | 미션 증명 저장 |
| `proof_get.js` | 미션 증명 조회 |
| `ad_orders_list.js` | 광고 주문 목록 조회 |
| `gemini.js` | Gemini AI 연동 |
| `gpt.js` | GPT AI 연동 |
| `images.js` | 이미지 처리 |

---

## 지갑 시스템

### `window.WALLET` 전역 객체

```javascript
window.WALLET = {
  provider,      // ethers.BrowserProvider 또는 JsonRpcProvider
  signer,        // AbstractSigner (MetaMask 또는 JumpCustodialSigner)
  address,       // 연결된 지갑 주소 (checksum)
  chainId        // 204 (opBNB)
}
```

페이지는 `window.onWalletConnected` 콜백을 통해 지갑 준비 완료를 감지합니다.

### 경로 1: MetaMask (일반 사용자)

`wallet.js`가 MetaMask를 감지하여 `window.WALLET`을 주입합니다.

### 경로 2: Jump 수탁지갑

`jump-a2e.js`가 `JumpCustodialSigner`를 생성하여 `window.WALLET`을 주입합니다.
- `localStorage`의 `jump_session`에서 주소를 읽음
- 트랜잭션은 `/.netlify/functions/jump_tx`로 라우팅
- 로컬 개발 시 Netlify 함수 미응답 → 테스트용 지갑으로 폴백

### Jump 세션 (`localStorage['jump_session']`)

```javascript
{
  uid: string,           // Firebase UID
  walletAddress: string, // 수탁지갑 주소
  isLocalTest: boolean,  // true = 로컬 파생 임시 주소 (실제 주소 아님)
  displayName: string,
  email: string,
  photoURL: string,
  memberLevel: number | null
}
```

**중요**: `isLocalTest: true`면 프로덕션 서버의 실제 주소와 다름.  
로컬 개발에서 실제 주소로 강제 설정하는 방법:
```javascript
const s = JSON.parse(localStorage.getItem('jump_session') || '{}');
s.walletAddress = '0x실제주소...';
s.isLocalTest = false;
localStorage.setItem('jump_session', JSON.stringify(s));
location.reload();
```

### 수탁지갑 주소 파생 순서 (`jump-auth.js`)

1. `/.netlify/functions/jump_wallet` 호출 (HMAC-SHA256 서버 파생)
2. 실패 시: `jump_session` 캐시에서 `isLocalTest: false` 주소 재사용
3. 캐시도 없으면: `ethers.id("local-test:" + uid)` 로컬 임시 파생

---

## 관리자 시스템

- `contract.staff(address)` → uint8
- **0**: 일반 회원
- **≥ 5**: 관리자 (admin 기능 활성화)

`a2e.js`의 `IS_STAFF` 모듈 변수에 저장됨 (loadMe() 시 설정).  
관리자만 볼 수 있는 UI: 미션 활성/비활성 토글 버튼, 심사 승인/반려 버튼.

---

## 미션 시스템

### 미션 정의

`config.js`의 `APP.missions` 배열에 13개 미션 (id: 1~13) 정의.

### 미션 상태 코드 (온체인 `claimInfo.status`)

| 코드 | 의미 |
|------|------|
| 0 | 미청구 |
| 1 | 심사중 |
| 2 | 반려/취소 |
| 3 | 승인완료 |

### 미션 활성/비활성 (오프체인, Firestore)

- Firestore `mission_status/{missionId}` 문서: `{ active: false }` → 비활성
- 문서 없거나 `active !== false` → 활성 (기본값)
- 관리자만 토글 가능 (`IS_STAFF >= 5`)
- 비활성 미션: 회원이 청구 버튼 클릭 시 에러, 빨간 배너 표시

### 미션 흐름

1. 회원이 SNS 미션 수행 → `claim(id, missionId, proof)` 호출
2. 관리자가 심사 → `approveClaim` 또는 `rejectClaim`
3. 승인 시 `mypay` 증가 → 회원이 `withdraw(id)` 호출

---

## 멘토/멘티 수익 구조

- 신규 가입 시 `join(멘토주소)` 호출로 멘토 연결
- `mentoFee()` = 멘토 수수료율 (%)
- 멘티의 `totalpay × mentoFeeRate / 100` = 멘토의 추정 누적 수익
- 마이페이지에서 멘티별 상세보기: `claimInfo(menteeId, missionId)` 조회

---

## 광고 의뢰 시스템

- `APP.ads.services` 배열에 10개 서비스 정의 (구글Blogger, 티스토리, 유튜브 등)
- 결제: HEX 토큰을 A2E 컨트랙트 주소로 transfer
- Firestore `ad_orders` 컬렉션에 주문 저장
- 관리자 페이지에서 주문 관리

---

## 로컬 개발 주의사항

- `netlify dev` 명령으로 실행해야 Netlify Functions 사용 가능
- `npm start` 또는 일반 HTTP 서버 사용 시 Functions 미동작 → Jump 수탁지갑 로컬 폴백 작동
- **로컬에서 Jump 로그인 시 `isLocalTest: true` 주소가 저장됨** → 프로덕션 주소와 다름
- ethers.js는 v6만 사용 (v5 혼용 금지): BigInt, `formatUnits`, `JsonRpcProvider` 등 v6 API 준수

---

## 공통 패턴

### 컨트랙트 읽기 (지갑 불필요)
```javascript
const provider = new ethers.JsonRpcProvider(APP.chain.rpcUrl);
const a2e = new ethers.Contract(APP.contracts.a2e, APP.a2eAbi, provider);
const info = await a2e.myInfo(id);
```

### 컨트랙트 쓰기 (지갑 필요)
```javascript
const a2e = new ethers.Contract(APP.contracts.a2e, APP.a2eAbi, WALLET.signer);
const tx = await a2e.withdraw(id);
await tx.wait();
```

### 금액 표시 (18 decimals)
```javascript
ethers.formatUnits(bigIntValue, 18)  // HEX 토큰
// 또는
(Number(bigIntValue) / 1e18).toLocaleString("ko-KR", { maximumFractionDigits: 4 })
```

### Firestore 접근
```javascript
// firebase 앱 초기화는 include.js 또는 페이지 직접 초기화
const db = firebase.firestore();  // compat SDK
await db.collection("mission_status").doc(String(missionId)).set({ active: false }, { merge: true });
```

### 페이지 헤더/푸터 삽입
`include.js`가 `#include-head`와 `#include-footer` 요소에 `head.html`, `footer.html`을 fetch하여 삽입합니다.
