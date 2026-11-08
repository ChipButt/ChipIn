/* Chip In reviews: never display a fabricated 0.0 rating when the third-party feed is incomplete.
   Review text and the real rating still come directly from ReviewsPlugin when available. */
(function () {
  function initSnapshotSliders() {
    document.querySelectorAll('[data-ci-review-slider]').forEach(function (slider) {
      var cards = Array.from(slider.querySelectorAll('.ci-review-card'));
      var dots = Array.from(slider.querySelectorAll('.ci-snapshot-dot'));
      if (!cards.length) return;
      var active = 0;
      function render() {
        cards.forEach(function (card, index) {
          card.style.order = (index - active + cards.length) % cards.length;
          card.dataset.active = index === active ? 'true' : 'false';
        });
        dots.forEach(function (dot, index) {
          dot.setAttribute('aria-pressed', index === active ? 'true' : 'false');
        });
      }
      function move(delta) {
        active = (active + delta + cards.length) % cards.length;
        render();
      }
      slider.querySelector('.ci-snapshot-arrow--prev')?.addEventListener('click', function () { move(-1); });
      slider.querySelector('.ci-snapshot-arrow--next')?.addEventListener('click', function () { move(1); });
      dots.forEach(function (dot, index) {
        dot.addEventListener('click', function () { active = index; render(); });
      });
      render();
    });
  }
  function init() {
    initSnapshotSliders();
    document.querySelectorAll('.ci-google-reviews').forEach(function (frame) {
      var widget = frame.querySelector('[data-rpi]');
      var fallback = frame.nextElementSibling;
      if (!widget || !fallback || !fallback.classList.contains('ci-reviews-fallback')) return;
      var queued = false;
      function validate() {
        queued = false;
        var text = (widget.textContent || '').replace(/\s+/g, ' ').trim();
        var count = text.match(/\b(?:Based on\s+)?([1-9][\d,]*)\s+(?:Google\s+)?reviews?\b/i);
        var rating = text.match(/\b([1-5]\.\d)\b/);
        var valid = !!(count && rating) && !/\bundefined\b|\bunable to load\b|\bPOOR\b|\b0\.0\b/i.test(text);
        frame.dataset.reviewsValid = valid ? 'true' : 'false';
        fallback.hidden = valid;
      }
      var observer = new MutationObserver(function () {
        if (!queued) {
          queued = true;
          requestAnimationFrame(validate);
        }
      });
      observer.observe(widget, {childList: true, subtree: true, characterData: true});
      validate();
      window.addEventListener('pageshow', validate);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
