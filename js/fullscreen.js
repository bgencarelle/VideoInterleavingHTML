// fullscreen.js

export function requestFullscreen() {
  const element = document.documentElement;
  if (element.requestFullscreen) {
    element.requestFullscreen();
  } else if (element.mozRequestFullScreen) {
    element.mozRequestFullScreen();
  } else if (element.webkitRequestFullscreen) {
    element.webkitRequestFullscreen();
  } else if (element.msRequestFullscreen) {
    element.msRequestFullscreen();
  }
}

// fullscreen.js

export function initializeFullscreen(fullscreenButtonId) {
  const fullscreenButton = document.getElementById(fullscreenButtonId);

  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement) {
      fullscreenButton.style.display = 'block';
    } else {
      fullscreenButton.style.display = 'none';
    }
  });

  fullscreenButton.addEventListener('click', () => {
    requestFullscreen();
    fullscreenButton.style.display = 'none';
  });
}
