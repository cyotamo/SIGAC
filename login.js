// Garante que o cursor (I) fica a piscar no campo Email
window.addEventListener("load", () => {
  const email = document.getElementById("email");
  if (email) {
    email.focus();
  }
});
