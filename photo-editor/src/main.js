import './style.css';
// Import modules
import { initCropper } from './cropper/cropper.js';
import { initCollage } from './collage/collage.js';

document.addEventListener('DOMContentLoaded', () => {
  const navCropper = document.getElementById('nav-cropper');
  const navCollage = document.getElementById('nav-collage');
  const viewCropper = document.getElementById('view-cropper');
  const viewCollage = document.getElementById('view-collage');

  // Simple Router
  function switchView(viewName) {
    if (viewName === 'cropper') {
      viewCropper.classList.remove('hidden');
      viewCollage.classList.add('hidden');
      navCropper.classList.add('active');
      navCollage.classList.remove('active');
    } else {
      viewCropper.classList.add('hidden');
      viewCollage.classList.remove('hidden');
      navCropper.classList.remove('active');
      navCollage.classList.add('active');
    }
  }

  navCropper.addEventListener('click', () => switchView('cropper'));
  navCollage.addEventListener('click', () => switchView('collage'));

  // Initialize Modules
  initCropper();
  initCollage();
});
