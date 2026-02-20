// /assets/js/i18n.js
(function () {
  // minimal selector->text translations. Add more keys as needed.
  const translations = {
    ko: {
      "header .header-logo span": "BUT DAO",
      "nav.header-nav a[href='/ad_request.html']": "광고의뢰",
      "nav.header-nav a[href='/a2e.html']": "광고미션수행",
      "nav.header-nav a[href='/mypage.html']": "마이페이지",
      "#wallet-addr": "지갑: -",
      "#wallet-btn": "지갑연결",
      "#wallet-status": "연결 대기",

      // index
      ".h1": "BlueEco DAO",
      ".sub": "광고 미션 · 리워드 · 토큰 생태계",
      ".item .title": "광고 의뢰",
      ".item .desc": "상품/가게/콘텐츠 홍보를 미션으로 구성하고 집행합니다.",
      ".pill": "HEX 결제",

      // ad_request
      "#mTitle": "주문 요청",
      "#mContact[placeholder]": "예:  @telegram / 카톡ID",
      "#mRequired[placeholder]": "상품홍보,가게홍보,조회수 증가등",
      "#mLink[placeholder]": "웹사이트 또는 상품정보 URL",
      "#mMemo[placeholder]": "원하는 콘셉트, 광고기간등",
      ".h1.page-title": "가격 / 주문",
    },
    en: {
      "header .header-logo span": "BUT DAO",
      "nav.header-nav a[href='/ad_request.html']": "Ad Request",
      "nav.header-nav a[href='/a2e.html']": "Ad Missions",
      "nav.header-nav a[href='/mypage.html']": "My Page",
      "#wallet-addr": "Wallet: -",
      "#wallet-btn": "Connect Wallet",
      "#wallet-status": "Waiting",

      // index
      ".h1": "BlueEco DAO",
      ".sub": "Ad missions · Rewards · Token ecosystem",
      ".item .title": "Ad Requests",
      ".item .desc": "We package and run promotional missions for products/shops/content.",
      ".pill": "Pay with HEX",

      // ad_request
      "#mTitle": "Order Request",
      "#mContact[placeholder]": "e.g. @telegram / KakaoTalk ID",
      "#mRequired[placeholder]": "Product promotion, shop promotion, increase views, etc",
      "#mLink[placeholder]": "Website or product info URL",
      "#mMemo[placeholder]": "Desired concept, ad period, etc",
      ".h1.page-title": "Price / Order",
    }
  };

  function applyTranslations(lang) {
    const map = translations[lang] || {};

    Object.keys(map).forEach((key) => {
      // placeholder override support: selector like "#mContact[placeholder]"
      const placeholderMatch = key.match(/(.+)\[placeholder\]$/);
      if (placeholderMatch) {
        const sel = placeholderMatch[1];
        document.querySelectorAll(sel).forEach(el => {
          if (el && el.placeholder !== undefined) el.placeholder = map[key];
        });
        return;
      }

      const els = document.querySelectorAll(key);
      if (els && els.length) {
        els.forEach(el => {
          if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
            el.value = map[key];
          } else {
            el.textContent = map[key];
          }
        });
      }
    });
  }

  function getLang() {
    return localStorage.getItem('lang') || (navigator.language && navigator.language.startsWith('en') ? 'en' : 'ko');
  }

  function setLang(lang) {
    localStorage.setItem('lang', lang);
    applyTranslations(lang);
  }

  // initialize when DOM ready
  document.addEventListener('DOMContentLoaded', () => {
    const lang = getLang();
    const sel = document.getElementById('langSelect');
    if (sel) {
      sel.value = lang;
      sel.addEventListener('change', (e) => setLang(e.target.value));
    }

    // small delay to allow include.html content to be present
    setTimeout(() => applyTranslations(lang), 80);
  });

  window.I18N = { setLang, getLang };
})();
