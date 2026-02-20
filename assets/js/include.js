// /assets/js/include.js
(async function () {
  async function load(id, url) {
    const el = document.getElementById(id);
    if (!el) return;
    const res = await fetch(url, { cache: "no-store" });
    el.innerHTML = await res.text();
  }

  await Promise.all([
    load("include-head", "/head.html"),
    load("include-footer", "/footer.html"),
  ]);

  // inject a simple language selector into the header (if present)
  const header = document.getElementById("include-head");
  if (header) {
    const container = header.querySelector('.header-inner');
    if (container) {
      const langWrap = document.createElement('div');
      langWrap.style.marginLeft = '12px';
      langWrap.innerHTML = `
        <select id="langSelect" aria-label="language select" style="background:transparent;border-radius:8px;padding:6px;border:1px solid rgba(255,255,255,.08);color:inherit">
          <option value="ko">한국어</option>
          <option value="en">English</option>
        </select>
      `;
      container.appendChild(langWrap);
    }

    // load i18n helper
    const s = document.createElement('script');
    s.src = '/assets/js/i18n.js';
    s.defer = true;
    document.body.appendChild(s);
  }
})();

  (() => {
    const path = location.pathname.split("/").pop();
    document.querySelectorAll(".header-nav a").forEach(a => {
      if (a.getAttribute("href").includes(path)) {
        a.classList.add("active");
      }
    });
  })();
