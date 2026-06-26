// Copy-to-clipboard for colour swatches
document.querySelectorAll('.swatch').forEach(sw => {
  sw.addEventListener('click', () => {
    const hex = sw.dataset.hex;
    if (!hex) return;
    navigator.clipboard.writeText(hex).then(() => {
      const el = sw.querySelector('.hex');
      const orig = el.textContent;
      el.textContent = 'Copied ✓';
      el.classList.add('copied');
      setTimeout(() => { el.textContent = orig; el.classList.remove('copied'); }, 1200);
    });
  });
});
