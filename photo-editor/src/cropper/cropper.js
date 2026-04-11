import 'cropperjs/dist/cropper.css';
import Cropper from 'cropperjs';
import './cropper.css';

export function initCropper() {
    const container = document.getElementById('cropper-container');
    container.innerHTML = `
    <div class="cropper-layout">
      <div class="cropper-toolbar">
         <div class="file-upload-wrapper btn btn-secondary">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
            Upload Photo
            <input type="file" id="crop-input" accept="image/*">
         </div>
         
         <div class="control-group">
            <label>Aspect Ratio</label>
            <select id="crop-ratio">
              <option value="1.77777">16:9 (Landscape)</option>
              <option value="1.33333">4:3 (Standard)</option>
              <option value="1">1:1 (Square)</option>
              <option value="0.66666">2:3 (Portrait)</option>
              <option value="NaN">Free</option>
            </select>
         </div>

         <div class="control-group">
             <button id="crop-rotate" class="btn btn-secondary">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12A10 10 0 0 0 12 2v10z"/><circle cx="12" cy="12" r="10"/><path d="M12 22a10 10 0 0 0 10-10"/></svg>
                Rotate
             </button>
         </div>

         <button id="btn-crop-download" class="btn btn-primary" disabled>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
            Crop & Download
         </button>
      </div>
      
      <div id="cropper-workspace" class="cropper-workspace">
        <div id="cropper-placeholder" class="placeholder-text" style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; text-align: center; cursor: pointer;">
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--color-accent); margin-bottom: 16px;"><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="M12 12v9"/><path d="m16 16-4-4-4 4"/></svg>
            <p style="font-weight: 500; color: var(--color-text-primary); font-size: 1.1rem;">Drop your image here</p>
            <p style="font-size: 0.875rem; margin-top: 8px; color: var(--color-text-muted);">or click to browse from your computer</p>
        </div>
        <div>
           <img id="cropper-img" style="max-width: 100%; display: block;">
        </div>
      </div>
    </div>
  `;

    const inputImage = document.getElementById('crop-input');
    const image = document.getElementById('cropper-img');
    const placeholder = document.getElementById('cropper-placeholder');
    const workspace = document.getElementById('cropper-workspace');
    const btnDownload = document.getElementById('btn-crop-download');
    const btnRotate = document.getElementById('crop-rotate');
    const selectRatio = document.getElementById('crop-ratio');

    let cropper;

    function handleFile(file) {
        if (!file || !file.type.startsWith('image/')) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            // Reset previous cropper instance
            if (cropper) {
                cropper.destroy();
            }

            image.src = event.target.result;
            placeholder.style.display = 'none';
            btnDownload.disabled = false;

            // Initialize Cropper
            cropper = new Cropper(image, {
                aspectRatio: 16 / 9,
                viewMode: 1,
                autoCropArea: 0.8,
                responsive: true,
                background: false, // Cleaner look
            });
        };
        reader.readAsDataURL(file);
    }

    // File Upload Handling
    inputImage.addEventListener('change', (e) => {
        handleFile(e.target.files[0]);
        // Reset value so same file can be selected again
        inputImage.value = '';
    });

    placeholder.addEventListener('click', () => {
        inputImage.click();
    });

    // Drag and drop logic
    workspace.addEventListener('dragover', (e) => {
        e.preventDefault();
        workspace.classList.add('drag-active');
    });

    workspace.addEventListener('dragleave', (e) => {
        e.preventDefault();
        workspace.classList.remove('drag-active');
    });

    workspace.addEventListener('drop', (e) => {
        e.preventDefault();
        workspace.classList.remove('drag-active');
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFile(e.dataTransfer.files[0]);
        }
    });

    // Controls
    selectRatio.addEventListener('change', (e) => {
        if (!cropper) return;
        cropper.setAspectRatio(Number(e.target.value));
    });

    btnRotate.addEventListener('click', () => {
        if (!cropper) return;
        cropper.rotate(90);
    });

    // Download logic
    btnDownload.addEventListener('click', () => {
        if (!cropper) return;

        // Get cropped canvas
        const canvas = cropper.getCroppedCanvas({
            // Optional: limit max resolution if needed, but keeping original quality is usually better for photo apps
            // maxWidth: 4096,
            // maxHeight: 4096,
        });

        // Convert to blob and download
        canvas.toBlob((blob) => {
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'cropped-image.png';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }, 'image/png');
    });
}
