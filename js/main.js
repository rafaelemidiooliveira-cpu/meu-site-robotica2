(() => {
  const menuButton = document.querySelector(".nav-toggle");
  const menu = document.querySelector("#menu-principal");

  if (!menuButton || !menu) return;

  const label = menuButton.querySelector(".sr-only");

  function setMenuOpen(isOpen) {
    menuButton.setAttribute("aria-expanded", String(isOpen));
    menu.classList.toggle("is-open", isOpen);
    if (label) label.textContent = isOpen ? "Fechar menu" : "Abrir menu";
  }

  menuButton.addEventListener("click", () => {
    setMenuOpen(menuButton.getAttribute("aria-expanded") !== "true");
  });

  menu.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => setMenuOpen(false));
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setMenuOpen(false);
  });

  document.addEventListener("click", (event) => {
    if (!menu.contains(event.target) && !menuButton.contains(event.target)) {
      setMenuOpen(false);
    }
  });
})();
