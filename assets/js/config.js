// /assets/js/config.js
window.APP = {
  // ─────────────────────────────────────────────
  // Chain
  // ─────────────────────────────────────────────
  chain: {
    name: "opBNB Mainnet",
    chainId: 204,
    rpcUrl: "https://opbnb-mainnet-rpc.bnbchain.org",
    blockExplorer: "https://opbnbscan.com",
  },

  // ─────────────────────────────────────────────
  // Contracts
  // ─────────────────────────────────────────────
  contracts: {
    // A2E 메인 컨트랙트 (결제 수령 주소로도 사용)
    a2e: "0x0f9a94A3ccae5B685e5a712cdd37f6DA21CfC8f3",

    // 결제 토큰 (HexStableToken)
    hexToken: "0x41F2Ea9F4eF7c4E35ba1a8438fC80937eD4E5464",
  },

  // ─────────────────────────────────────────────
  // ABI
  // ─────────────────────────────────────────────
  a2eAbi: [
    "function admin() view returns (address)",
    "function staff(address) view returns (uint8)",
    "function totalMember() view returns (uint256)",
    "function nextId() view returns (uint256)",
    "function idOf(address) view returns (uint256)",

    "function price() view returns (uint256)",
    "function mentoFee() view returns (uint256)",
    "function claimCooldown() view returns (uint256)",
    "function withdrawCooldown() view returns (uint256)",
    "function seizeGrace() view returns (uint256)",

    "function adprice(uint256) view returns (uint256)",
    "function pending(uint256,uint256) view returns (uint8)",
    "function pendingCount() view returns (uint256)",
    "function pendingAt(uint256) view returns (uint256 id, uint256 missionId, address owner, uint64 reqAt, bytes32 proof)",

    "function myInfo(uint256) view returns (address owner, address mento, uint256 level, uint256 exp, uint256 mypay, uint256 totalpay, uint256 memberUntil, bool blacklisted)",
    "function claimInfo(uint256,uint256) view returns (uint8 status, uint64 reqAt, bytes32 proof, uint256 lastAt, uint256 price_)",
    "function contractHexBalance() view returns (uint256)",

    "function getDelinquents(uint256,uint256) view returns (uint256[] ids, address[] owners, uint64[] memberUntil)",

    "function hexToken() view returns (address)",
    "function butbank() view returns (address)",

    "function join(address mento) returns (uint256)",
    "function renew(uint256 id, uint256 months)",
    "function claim(uint256 id, uint256 missionId, bytes32 proof)",
    "function cancelClaim(uint256 id, uint256 missionId)",
    "function withdraw(uint256 id)",

    "function approveClaim(uint256 id, uint256 missionId)",
    "function rejectClaim(uint256 id, uint256 missionId)",
    "function setAdPrice(uint256 missionId, uint256 v)",
    "function setTotalMember(uint256 p)",
    "function setPrice(uint256 v)",
    "function setMentoFee(uint256 v)",
    "function setBlacklist(uint256 id, bool b)",
    "function setLevel(uint256 id, uint8 lv)",
    "function flushFee()",

    "event Joined(uint256 indexed id, address indexed owner, address indexed mento, uint256 paid, uint256 until)",
    "event Renewed(uint256 indexed id, uint256 months, uint256 paid, uint256 until)",
    "event ClaimReq(uint256 indexed id, uint256 indexed missionId, bytes32 proof)",
    "event ClaimApprove(uint256 indexed id, uint256 indexed missionId, uint256 reward)",
    "event ClaimReject(uint256 indexed id, uint256 indexed missionId)",
    "event ClaimCancel(uint256 indexed id, uint256 indexed missionId)",
    "event Withdraw(uint256 indexed id, address indexed to, uint256 amount)",
  ],

  erc20Abi: [
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function decimals() view returns (uint8)",
    "function balanceOf(address) view returns (uint256)",
    "function allowance(address,address) view returns (uint256)",
    "function approve(address,uint256) returns (bool)",
    "function transfer(address,uint256) returns (bool)",
  ],

  // ─────────────────────────────────────────────
  // Firebase (Firestore / Auth)
  // ─────────────────────────────────────────────
  firebase: {
    apiKey: "AIzaSyCoeMQt7UZzNHFt22bnGv_-6g15BnwCEBA",
    authDomain: "puppi-d67a1.firebaseapp.com",
    projectId: "puppi-d67a1",
    storageBucket: "puppi-d67a1.firebasestorage.app",
    messagingSenderId: "552900371836",
    appId: "1:552900371836:web:88fb6c6a7d3ca3c84530f9",
    measurementId: "G-9TZ81RW0PL",
    appCheckSiteKey: "6LduZMErAAAAAJHFSyn2sQMusMCrjFOpQ0YrrbHz",
  },

  // ─────────────────────────────────────────────
  // 광고(의뢰) 설정 병합
  // ─────────────────────────────────────────────
  ads: {
    // Firestore 컬렉션명
    ordersCollection: "ad_orders",

    // 결제 설정: HEX 토큰을 a2e 주소로 transfer
    payment: {
      chainId: 204,
      tokenSymbol: "HEX",
      tokenAddress: "0x41F2Ea9F4eF7c4E35ba1a8438fC80937eD4E5464",
      receiver: "0x0f9a94A3ccae5B685e5a712cdd37f6DA21CfC8f3",
      explorerTx: "https://opbnbscan.com/tx/",
      decimalsFallback: 18,
    },

    // 광고 상품 목록 (요청하신 문구 반영)
    services: [
      {
        id: 1,
        name: "구글 Blogger 의뢰인 컨덴츠 게재",
        base: "검색 반영 빠름, 장기 노출에 유리",
        required: "사진/제품설명/기타 · 약 100개 이상의 회원 블로그에 월 5회, 총 500회 게재",
        pricePaw: 300
      },
         {
        id: 2,
        name: "구글 Blogger 활성화",
        base: "의뢰인 구글 Blogger에 댓글 달기 ",
        required: "약 100개 이상의 계정으로 하루 100회*30일 총 3000건",
        pricePaw: 300
      },
      {
        id: 3,
        name: "티스토리",
        base: "카카오 계열 블로그 + 구글 검색 노출 강함",
        required: "사진/제품설명/기타 · 약 100개 이상의 회원 블로그에 월 5회, 총 500회 게재",
        pricePaw: 300
      },
       {
        id: 4,
        name: "티스토리 활성화",
        base: "의뢰인 티스토리에 댓글,좋아요,구독하기 ",
        required: "약 100개 이상의 계정으로 하루 100회*30일 총 3000건",
        pricePaw: 300
      },
      {
        id: 5,
        name: "네이버 블로그",
        base: "국내 사용자 인지도 높음, 지역 키워드에 유리",
        required: "사진/제품설명/기타 · 약 100개 이상의 회원 블로그에 월 5회, 총 500회 게재",
        pricePaw: 300
      },
       {
        id: 6,
        name: "네이버 블로그 활성화",
        base: "의뢰인 네이버 블로그에 공감,댓글,이웃추가",
        required: "100개 이상의 계정으로 하루 100회*30일 총 3000건",
        pricePaw: 300
      },
  
      {
        id: 7,
        name: "유튜브 활성화",
        base: "의뢰인 유투브 채널에 댓글 좋아요 구독 ",
        required: "100개 이상의 계정으로 하루 100회*30일 총 3000건",
        pricePaw: 300
      },
      {
        id: 8,
        name: "인스타그램 게재",
        base: "해시태그 기반 노출 및 확산",
        required: "사진/설명 제공 · 100개 이상의 계정으로 게시물 월5회씩 500회 게재",
        pricePaw: 300
      },
      
      {
       id: 9,
        name: "인스타그램 확산",
        base: "의뢰인 인스타그램 채널에 좋아요 댓글 공유하기",
        required: "100개 이상의 계정으로 하루 100회*30일 총 3000건",
        pricePaw: 300
      },
         {
        id: 10,
        name: "페이스북 게재",
        base: "사진/내용 캠페인등",
        required: "100개 이상의 계정으로 게시물 월5회씩 500회 게재",
        pricePaw: 300
      },
      
      {
       id: 11,
        name: "페이스북 확산",
        base: "의뢰인 페이스북 채널에 좋아요 댓글 공유하기",
        required: "100개 이상의 계정으로 하루 100회*30일 총 3000건",
        pricePaw: 300
      },
      {
        id: 12,
        name: "카카오 오픈채팅방 활성화",
        base: "의뢰인이 지정한 오픈채팅방에 참여",
        required: "100개 이상의 계정으로 하루 500건 *30일 채팅",
        pricePaw: 300
      },
       {
        id: 13,
        name: "opBNB 메인넷 활성화",
        base: "지정한 토큰 및 Dapp 트래픽 발생",
        required: "100개 이상의 계정으로 하루 100회*30일 총 3000건",
        pricePaw: 500
      },

    ],
  },

  // ─────────────────────────────────────────────
  // 오프체인 미션 정의 (기존 유지)
  // ─────────────────────────────────────────────
missions: [
  {
    id: 1,
    title: "구글 Blogger 의뢰글 게재",
    desc: "자신의 구글 Blogger에 광고주가 의뢰한 콘텐츠를 5일에 1회씩 총5회 게재하고 URL을 증거로 제출"
  },
  {
    id: 2,
    title: "구글 Blogger 활성화",
    desc: "광고주 Blogger 글에 매일1회 댓글 작업 후 작업 링크를 5일에 한번 증거로 제출"
  },
  {
    id: 3,
    title: "티스토리 의뢰글 게재",
    desc: "자신의 티스토리에 광고주 의뢰 콘텐츠를 5일에 1회씩 총5회 게재하고 URL을 증거로 제출"
  },
  {
    id: 4,
    title: "티스토리 활성화",
    desc: "광고주 티스토리 글에 댓글/좋아요/구독 매일1회 작업 링크를  5일에 한번 증거로 제출"
  },
  {
    id: 5,
    title: "네이버 블로그 의뢰글 게재",
    desc: "자신의 네이버 블로그에 광고주 의뢰 콘텐츠를 5일에 1회씩 총5회 게재하고 URL을 증거로 제출"
  },
  {
    id: 6,
    title: "네이버 블로그 활성화",
    desc: "광고주 네이버 블로그에 공감/댓글/이웃추가 작업 후 링크를 5일에 한번 증거로  제출"
  },
  {
    id: 7,
    title: "유튜브 활성화",
    desc: "광고주 유튜브 채널/영상에 댓글·좋아요·구독 작업 후 증거 링크를 5일에 한번 증거로 제출"
  },
  {
    id: 8,
    title: "인스타그램 게재",
    desc: "자신의 인스타그램에 광고주 콘텐츠를 5일에 1회씩 총5회 게시하고 게시물 URL을 증거로 제출"
  },
  {
    id: 9,
    title: "인스타그램 확산",
    desc: "광고주 인스타그램에 좋아요/댓글/공유 매일 작업 후 링크를 5일에 한번 증거로 제출"
  },
  {
    id: 10,
    title: "페이스북 게재",
    desc: "자신의 페이스북 계정에 광고주 콘텐츠를 5일에 1회씩 총5회 게시하고 게시물 URL을 증거로 제출"
  },
  {
    id: 11,
    title: "페이스북 확산",
    desc: "광고주 페이스북에 좋아요/댓글/공유 매일 작업 후 증거 링크를 5일에 한번 증거로 제출"
  },
  {
    id: 12,
    title: "카카오 오픈채팅방 활성화",
    desc: "지정 카카오 오픈채팅방에서 하루 5회이상 맥락에 맞는 채팅 후 5일에 한번 신청"
  },
    {
    id: 13,
    title: "opBNB 메인넷 프로젝트 활성화",
    desc: "지정 토큰/DApp에 트래픽 작업 후 트랜잭션/활동 증거 링크를 5일에 한번 증거로 제출"
  }
],

   missionGuideCollection: "mission_guides"
};
