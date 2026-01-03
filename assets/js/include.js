async function includeHTML(id, url) {
  const el = document.getElementById(id);
  if (!el) return;

  const res = await fetch(url);
  el.innerHTML = await res.text();
}

document.addEventListener("DOMContentLoaded", () => {
  includeHTML("include-head", "/head.html");
  includeHTML("include-footer", "/footer.html");
});
