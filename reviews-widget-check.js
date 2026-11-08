/* Chip In reviews: never display a fabricated 0.0 rating when the third-party feed is incomplete.
   Review text and the real rating still come directly from ReviewsPlugin when available. */
(function () {
  function init() {
    document.querySelectorAll('.ci-google-reviews').forEach(function (frame) {
      var widget = frame.querySelector('[data-rpi]');
      var fallback = frame.nextElementSibling;
      if (!widget || !fallback || !fallback.classList.contains('ci-reviews-fallback')) return;
      var queued = false;
      function validate() {
        queued = false;
        var text = (widget.textContent || '').replace(/\s+/g, ' ').trim();
        var count = text.match(/\b(?:Based on\s+)?([1-9][\d,]*)\s+(?:Google\s+)?reviews?\b/i);
        var rating = text.match(/(?<![\d.])([1-5](?:\.\d)?)(?![\d.])/);
        var valid = !!(count && rating) && !/\bundefined\b|\bunable to load\b/i.test(text);
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
