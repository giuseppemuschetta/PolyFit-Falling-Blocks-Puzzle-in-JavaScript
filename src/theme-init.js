// Runs before the page is drawn, so a visitor who chose the dark (or light) theme on
// the website never sees a flash of the other one. Same storage key as the website.
(function () {
  try {
    var theme = localStorage.getItem('theme');
    if (theme === 'light' || theme === 'dark') document.documentElement.dataset.theme = theme;
  } catch (e) {
    // storage blocked: follow the system setting
  }
})();
