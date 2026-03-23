import './style.css';

document.addEventListener('DOMContentLoaded', () => {
  const imageUpload = document.getElementById('imageUpload');
  const fileNameDisplay = document.getElementById('fileName');
  const watermarkText = document.getElementById('watermarkText');
  const fontSizeInput = document.getElementById('fontSize');
  const opacityInput = document.getElementById('opacity');
  const rotationInput = document.getElementById('rotation');
  const textColorInput = document.getElementById('textColor');
  
  const fontSizeDisplay = document.getElementById('fontSizeDisplay');
  const opacityDisplay = document.getElementById('opacityDisplay');
  const rotationDisplay = document.getElementById('rotationDisplay');
  
  const downloadBtn = document.getElementById('downloadBtn');
  const canvas = document.getElementById('canvas');
  const placeholder = document.getElementById('placeholder');
  const ctx = canvas.getContext('2d');
  
  let currentImage = null;

  // Initialize
  updateDisplays();

  // Event Listeners
  imageUpload.addEventListener('change', handleImageUpload);
  watermarkText.addEventListener('input', drawImage);
  fontSizeInput.addEventListener('input', () => { updateDisplays(); drawImage(); });
  opacityInput.addEventListener('input', () => { updateDisplays(); drawImage(); });
  rotationInput.addEventListener('input', () => { updateDisplays(); drawImage(); });
  textColorInput.addEventListener('input', drawImage);
  
  downloadBtn.addEventListener('click', downloadImage);

  function updateDisplays() {
    fontSizeDisplay.textContent = fontSizeInput.value;
    opacityDisplay.textContent = opacityInput.value;
    rotationDisplay.textContent = rotationInput.value;
  }

  function handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    fileNameDisplay.textContent = file.name;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      currentImage = new Image();
      currentImage.onload = () => {
        // Show canvas, hide placeholder
        placeholder.style.display = 'none';
        canvas.style.display = 'block';
        downloadBtn.disabled = false;
        
        // Setup canvas based on image aspect ratio, maintaining high res
        canvas.width = currentImage.width;
        canvas.height = currentImage.height;
        
        drawImage();
      };
      currentImage.src = event.target.result;
    };
    reader.readAsDataURL(file);
  }

  function hexToRgba(hex, opacity) {
    // Remove the hash if present
    hex = hex.replace(/^#/, '');
    
    // Parse the hex values
    let r = parseInt(hex.substring(0, 2), 16);
    let g = parseInt(hex.substring(2, 4), 16);
    let b = parseInt(hex.substring(4, 6), 16);
    
    // Adjust opacity from 0-100 to 0-1
    let a = opacity / 100;
    
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }

  function drawImage() {
    if (!currentImage) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw original image
    ctx.drawImage(currentImage, 0, 0, canvas.width, canvas.height);
    
    // Add watermark
    const text = watermarkText.value;
    if (!text) return;

    // In a tiled watermark, font size is relative to the image size.
    // The slider value represents a scaling factor (10 to 200).
    const fontSizeSlider = parseInt(fontSizeInput.value, 10);
    // Scale font size based on image width to keep it relative
    const relativeFontSize = (fontSizeSlider / 1000) * Math.max(canvas.width, canvas.height);
    
    const color = textColorInput.value;
    const opacity = parseInt(opacityInput.value, 10);
    const rotation = parseInt(rotationInput.value, 10);
    
    ctx.save();
    
    // Set text properties
    ctx.font = `bold ${relativeFontSize}px Inter, system-ui, sans-serif`;
    ctx.fillStyle = hexToRgba(color, opacity);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    const textMetrics = ctx.measureText(text);
    // Rough estimate of text height
    const textHeight = textMetrics.actualBoundingBoxAscent + textMetrics.actualBoundingBoxDescent || relativeFontSize;
    
    // Add subtle shadow for better readability
    ctx.shadowColor = `rgba(0, 0, 0, ${opacity / 250})`; 
    ctx.shadowBlur = relativeFontSize * 0.1;
    ctx.shadowOffsetX = relativeFontSize * 0.05;
    ctx.shadowOffsetY = relativeFontSize * 0.05;

    // Pattern spacing parameters
    const tileSpacingX = textMetrics.width + relativeFontSize * 2;
    const tileSpacingY = textHeight + relativeFontSize * 2;
    
    // Calculate diagonal bounds to fill the whole rotated canvas
    const diagonal = Math.sqrt(canvas.width**2 + canvas.height**2);
    
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    
    // Draw multiple texts across the screen
    for(let x = -diagonal; x < diagonal; x += tileSpacingX) {
        let rowCount = 0;
        for(let y = -diagonal; y < diagonal; y += tileSpacingY) {
            // Offset every other row
            const offsetX = (rowCount % 2 === 1) ? tileSpacingX / 2 : 0;
            ctx.fillText(text, x + offsetX, y);
            rowCount++;
        }
    }
    
    ctx.restore();
  }

  function downloadImage() {
    if (!currentImage) return;

    const link = document.createElement('a');
    let originalName = fileNameDisplay.textContent;
    let baseName = originalName.substring(0, originalName.lastIndexOf('.')) || 'image';
    
    link.download = `${baseName}_watermarked.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }
});
