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
})();

  (() => {
    const path = location.pathname.split("/").pop();
    document.querySelectorAll(".header-nav a").forEach(a => {
      if (a.getAttribute("href").includes(path)) {
        a.classList.add("active");
      }
    });
  })();
