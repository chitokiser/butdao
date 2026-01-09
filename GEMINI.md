<!-- /partials/header.html -->
<header class="top-header top-header--sleek" id="siteHeaderRoot">

  <!-- ====== HEADER MAIN ====== -->
  <div class="hdr-shell">
    <div class="hdr-inner">

      <!-- Left: Brand -->
      <a class="brand" href="index.html" aria-label="home">
        <img
          class="brand-logo"
          src="assets/images/exp.png"
          alt="ExpDAO"
          width="32"
          height="32"
        />
        <div class="brand-text">
          <div class="brand-name">Exp DAO</div>
          <div class="brand-sub">MT5 계좌 p2p거래소</div>
        </div>
      </a>

      <!-- Center: Desktop nav -->
      <nav class="nav-links nav-desktop" aria-label="primary">
        <a href="index.html">계좌리스트</a>
        <a href="mt5.html">계좌등록소</a>
      </nav>

      <!-- Right: Network + Wallet + Burger -->
      <div class="hdr-right">
        <span class="net-badge" id="netBadge">-</span>

        <!-- header-wallet.js에서 이 버튼을 사용 -->
        <button class="btn btn-connect" id="wallet-btn" type="button">
          지갑연결
        </button>

        <button class="burger" id="btnBurger" type="button" aria-label="menu">
          <span></span><span></span><span></span>
        </button>
      </div>
    </div>
  </div>

  <!-- ====== MOBILE DRAWER ====== -->
  <div class="nav-backdrop" id="navBackdrop"></div>

  <aside class="nav-drawer" id="navDrawer">
    <div class="nav-top">
      <div class="nav-title">MENU</div>
      <button class="nav-close" id="navClose" type="button">×</button>
    </div>
    <nav class="nav-links">
      <a href="index.html">홈</a>
      <a href="mt5.html">MT5 계좌마켓</a>
    </nav>
  </aside>

  <!-- ====== TOKEN BAR (지갑 연결 후 표시) ====== -->
  <div class="hdr-tokenbar" id="hdrTokenWrap" style="display:none;">
    <div class="tokenbar-inner" id="hdrTokenBar">
      <!-- header-wallet.js가 여기 span.token-pill 을 채움 -->
    </div>
  </div>
</header>
