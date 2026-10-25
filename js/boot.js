// boot.js | script clasico y bloqueante del <head> (sin module, defer ni async).
// Marca JS activo y evita el parpadeo del espanol si el visitante eligio ingles.
// Vive en un archivo aparte para que la CSP no necesite hashes de scripts inline.
document.documentElement.classList.add('js');
try {
  if (localStorage.getItem('portfolio_lang') === 'en') {
    document.documentElement.setAttribute('data-lang-pending', '');
    setTimeout(function () { document.documentElement.removeAttribute('data-lang-pending'); }, 2000);
  }
} catch (e) {}
