document.addEventListener("DOMContentLoaded", () => {
  const toast = document.getElementById("toast");
  const login = document.getElementById("login-btn");
  const register = document.getElementById("register-btn");

  const showToast = (msg) => {
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add("toast--show");
    window.clearTimeout(window.__toastTimer);
    window.__toastTimer = window.setTimeout(() => {
      toast.classList.remove("toast--show");
    }, 1400);
  };

  if (login) {
    login.addEventListener("click", () => showToast("Przenoszę do logowania…"));
  }
  if (register) {
    register.addEventListener("click", () => showToast("Rejestracja: dodamy później 🙂"));
  }
});