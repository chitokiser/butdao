// /assets/js/missions.js
(() => {
  const KEY = "A2E_MISSION_IDS_V1";

  // 초기 기본 노출 미션ID
  const DEFAULT_IDS = [1, 2, 3, 4, 5, 6];

  // 오프체인 미션 메타(설명/가이드/예시 proof 포맷)
  // 원하는대로 문구를 편집하세요.
  // proof는 사용자가 "문자열"로 입력하고, 프론트에서 bytes32로 해시(keccak256)되어 온체인 저장됩니다.
  const MISSION_META = {
    1: {
      title: "hexdao 페이스북 활동",
      desc: "https://www.facebook.com/groups/1453946632758823",
      guide: [
        "하루한번 게시글 올리고 댓글 하나,좋아요,자기 페이스북에 공유하기",
        "https://www.facebook.com/groups/1453946632758823 URL 복사",
        "하루한번만 인정 합니다"
      ],
      proofExample: "https://g.co/kgs/xxxxx  (리뷰 링크)"
    },
    2: {
      title: "페이스북 공유 미션",
      desc: "지정된 게시물을 공유하고 공개 범위를 전체공개로 유지합니다.",
      guide: [
        "게시물 공유 → 공개범위 전체공개",
        "공유된 게시물 URL 복사",
        "댓글로 확인용 키워드 추가(선택)"
      ],
      proofExample: "https://www.facebook.com/xxxx/posts/xxxx"
    },
    3: {
      title: "유튜브 댓글 미션",
      desc: "지정된 유튜브 영상에 댓글을 남기고 좋아요를 누릅니다.",
      guide: [
        "댓글 작성 후 댓글이 노출되는지 확인",
        "가능하면 고정 댓글에 답글로 남기기",
        "댓글 링크 또는 스크린샷 공유(링크 권장)"
      ],
      proofExample: "영상URL + 댓글내용\n예) https://youtu.be/xxxx | 닉네임:OOO | 댓글:좋아요!"
    },
    4: {
      title: "인스타 스토리 미션",
      desc: "지정된 이미지/링크를 스토리에 업로드합니다.",
      guide: [
        "스토리 업로드 후 24시간 유지",
        "스토리 캡쳐(닉네임/시간 보이게)",
        "가능하면 링크 스티커 포함"
      ],
      proofExample: "insta:@yourid | story uploaded at 2026-01-03 21:15 | screenshot ok"
    },
    5: {
      title: "티스토리 블로그 포스팅 미션",
      desc: "지정 키워드/링크 포함하여 블로그 글을 작성합니다.",
      guide: [
        "제목/본문에 지정 키워드 포함",
        "지정 링크 1개 이상 포함",
        "글 공개 상태 유지"
      ],
      proofExample: "https://blog.naver.com/xxxx/xxxxxxxx"
    },
    6: {
      title: "네이버 블로그 포스팅  미션",
      desc: "지정 커뮤니티에서 활동 후 인증 글을 남깁니다.",
      guide: [
        "지정 커뮤니티 규칙 준수",
        "인증 글 작성 후 URL 복사",
        "관리자 확인을 위한 태그/키워드 포함(선택)"
      ],
      proofExample: "커뮤니티URL/게시글URL"
    },
      7: {
      title: "카카오 그룹채팅방 활동",
      desc: "지정 커뮤니티에서 활동 후 인증 글을 남깁니다.",
      guide: [
        "지정 커뮤니티 규칙 준수",
        "인증 글 작성 후 URL 복사",
        "관리자 확인을 위한 태그/키워드 포함(선택)"
      ],
      proofExample: "커뮤니티URL/게시글URL"
    },
     8: {
      title: "텔레그램 그룹채팅방 활동",
      desc: "지정 커뮤니티에서 활동 후 인증 글을 남깁니다.",
      guide: [
        "지정 커뮤니티 규칙 준수",
        "인증 글 작성 후 URL 복사",
        "관리자 확인을 위한 태그/키워드 포함(선택)"
      ],
      proofExample: "커뮤니티URL/게시글URL"
    }
  };

  function uniqSorted(arr) {
    return Array.from(
      new Set(arr.map(n => Number(n)).filter(n => Number.isFinite(n) && n > 0))
    ).sort((a, b) => a - b);
  }

  function loadIds() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return [...DEFAULT_IDS];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [...DEFAULT_IDS];
      const ids = uniqSorted(parsed);
      return ids.length ? ids : [...DEFAULT_IDS];
    } catch (e) {
      return [...DEFAULT_IDS];
    }
  }

  function saveIds(ids) {
    const v = uniqSorted(ids);
    localStorage.setItem(KEY, JSON.stringify(v));
    return v;
  }

  function addId(id) {
    const ids = loadIds();
    ids.push(Number(id));
    return saveIds(ids);
  }

  function removeId(id) {
    const n = Number(id);
    const ids = loadIds().filter(x => x !== n);
    return saveIds(ids);
  }

  // 메타 조회 (없으면 기본값)
  function getMeta(id) {
    const mid = Number(id);
    const m = MISSION_META[mid];
    if (!m) {
      return {
        title: "미션",
        desc: "미션 설명이 아직 등록되지 않았습니다.",
        guide: ["관리자에게 미션 설명 등록을 요청하세요."],
        proofExample: "예) URL 또는 식별값"
      };
    }
    return {
      title: m.title || "미션",
      desc: m.desc || "",
      guide: Array.isArray(m.guide) ? m.guide : [],
      proofExample: m.proofExample || ""
    };
  }

  window.A2E_MISSIONS = {
    loadIds,
    saveIds,
    addId,
    removeId,
    getMeta
  };
})();
