/* Solo navegación de la landing; los productos y controles científicos viven en index.html. */
(() => {
  const toggle = document.querySelector('.menu-toggle');
  const navigation = document.getElementById('main-nav');
  toggle.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', String(open));
    navigation.classList.toggle('is-open', open);
  });
  navigation.addEventListener('click', (event) => {
    const link = event.target.closest('a');
    if (!link) return;
    toggle.setAttribute('aria-expanded', 'false');
    navigation.classList.remove('is-open');
    if (link.getAttribute('href').startsWith('#')) {
      navigation.querySelector('.active')?.classList.remove('active');
      link.classList.add('active');
    }
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
      toggle.setAttribute('aria-expanded', 'false'); navigation.classList.remove('is-open'); toggle.focus();
    }
  });
})();
