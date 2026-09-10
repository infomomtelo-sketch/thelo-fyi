(() => {
  const links = document.querySelectorAll("[data-back-nav]");
  if (!links.length) return;

  function canUseHistoryBack() {
    if (window.history.length <= 1 || !document.referrer) return false;
    try {
      const referrer = new URL(document.referrer);
      return referrer.origin === window.location.origin && referrer.pathname !== window.location.pathname;
    } catch (_) {
      return false;
    }
  }

  links.forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      if (canUseHistoryBack()) {
        window.history.back();
        return;
      }
      window.location.assign(link.getAttribute("href") || "/");
    });
  });
})();
