// Home page: doorsturen naar het spelscherm (die maakt zelf de lobby aan),
// of als controller joinen met een code.
const createBtn = document.getElementById('createBtn');
const joinForm = document.getElementById('joinForm');
const codeInput = document.getElementById('codeInput');

createBtn.addEventListener('click', () => {
  // Navigeer direct naar het spelscherm. De socket van game.html maakt de lobby aan.
  window.location.href = '/game.html';
});

joinForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const code = codeInput.value.trim().toUpperCase();
  if (code.length !== 4) {
    codeInput.focus();
    return;
  }
  window.location.href = `/controller.html?room=${encodeURIComponent(code)}`;
});

// Auto-upper-case
codeInput.addEventListener('input', () => {
  codeInput.value = codeInput.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
});
