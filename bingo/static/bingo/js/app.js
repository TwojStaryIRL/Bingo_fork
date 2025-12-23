document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("alert-btn");

  if (!btn) {
    console.warn("Button not found");
    return;
  }

  btn.addEventListener("click", () => {
    alert("KSYPRO TO GRZECZNY CHŁOPIEC");
  });
  });
