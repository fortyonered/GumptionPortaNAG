function setupStrahdClouds(background) {
  const video = background.querySelector('video');
  let active = false;
  let moving = false;

  function updatePlayback() {
    if (!active || !moving || document.hidden) {
      video.pause();
      return;
    }

    if (!video.hasAttribute('src')) video.src = video.dataset.src;
    video.play().catch(() => {
      // The poster remains available if the browser disallows autoplay.
    });
  }

  document.addEventListener('visibilitychange', updatePlayback);
  return (show, animate) => {
    active = show;
    moving = animate;
    updatePlayback();
  };
}
