import { createIcons, Image, Upload, Plus, Trash2, Download, ImagePlus, UploadCloud, AlignLeft, AlignCenter, AlignRight } from 'lucide';

// Initialize Lucide icons
createIcons({
  icons: {
    Image,
    Upload,
    Plus,
    Trash2,
    Download,
    ImagePlus,
    UploadCloud,
    AlignLeft,
    AlignCenter,
    AlignRight
  }
});

// App State
let appState = {
  imageSrc: null,
  imageWidth: 0,
  imageHeight: 0,
  texts: [],      // Array of text objects
  activeTextId: null, // ID of currently selected text
  nextId: 1
};

/* DOM Elements */
// Sidebar
const imageUpload = document.getElementById('image-upload');
const textControlsSection = document.getElementById('text-controls-section');
const addTextBtn = document.getElementById('add-text-btn');
const activeTextSettings = document.getElementById('active-text-settings');
const textContentInput = document.getElementById('text-content-input');
const fontFamilySelect = document.getElementById('font-family-select');
const textColorInput = document.getElementById('text-color-input');
const textColorValue = document.getElementById('text-color-value');
const textSizeInput = document.getElementById('text-size-input');
const textSizeValue = document.getElementById('text-size-value');
const alignLeftBtn = document.getElementById('align-left-btn');
const alignCenterBtn = document.getElementById('align-center-btn');
const alignRightBtn = document.getElementById('align-right-btn');
const deleteTextBtn = document.getElementById('delete-text-btn');
const downloadBtn = document.getElementById('download-btn');

// Canvas Area
const canvasWrapper = document.getElementById('canvas-wrapper');
const emptyState = document.getElementById('empty-state');
const mainImage = document.getElementById('main-image');
const textLayer = document.getElementById('text-layer');
const exportCanvas = document.getElementById('export-canvas');

/* Event Listeners */
imageUpload.addEventListener('change', handleImageUpload);
addTextBtn.addEventListener('click', addTextElement);
deleteTextBtn.addEventListener('click', deleteActiveText);
downloadBtn.addEventListener('click', handleDownload);

// Settings listeners (Sync to state and DOM)
textContentInput.addEventListener('input', (e) => updateActiveText('text', e.target.value));
fontFamilySelect.addEventListener('change', (e) => updateActiveText('fontFamily', e.target.value));
textColorInput.addEventListener('input', (e) => {
  textColorValue.textContent = e.target.value;
  updateActiveText('color', e.target.value);
});
textSizeInput.addEventListener('input', (e) => {
  textSizeValue.textContent = e.target.value;
  updateActiveText('fontSize', parseInt(e.target.value, 10));
});

alignLeftBtn.addEventListener('click', () => updateActiveText('textAlign', 'left'));
alignCenterBtn.addEventListener('click', () => updateActiveText('textAlign', 'center'));
alignRightBtn.addEventListener('click', () => updateActiveText('textAlign', 'right'));

// Deselect text when clicking outside
canvasWrapper.addEventListener('click', (e) => {
  if (e.target === canvasWrapper || e.target === mainImage || e.target === textLayer) {
    setActiveText(null);
  }
});

// Drag and drop image
emptyState.addEventListener('click', () => {
  imageUpload.click();
});

emptyState.addEventListener('dragover', (e) => {
  e.preventDefault();
  emptyState.classList.add('drag-active-zone');
});

emptyState.addEventListener('dragleave', (e) => {
  e.preventDefault();
  emptyState.classList.remove('drag-active-zone');
});

emptyState.addEventListener('drop', (e) => {
  e.preventDefault();
  emptyState.classList.remove('drag-active-zone');
  const file = e.dataTransfer.files ? e.dataTransfer.files[0] : null;
  if (file && file.type.startsWith('image/')) {
    handleImageUpload({ target: { files: [file] } });
  }
});

/* Core Functions */

function handleImageUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    const dataUrl = event.target.result;
    
    // Load image to get true dimensions
    const imgObj = new window.Image();
    imgObj.onload = () => {
      appState.imageSrc = dataUrl;
      appState.imageWidth = imgObj.width;
      appState.imageHeight = imgObj.height;

      // Update UI
      mainImage.src = dataUrl;
      mainImage.classList.remove('hidden');
      emptyState.classList.add('hidden');
      textLayer.classList.remove('hidden');
      canvasWrapper.classList.add('has-image');
      textControlsSection.style.opacity = '1';
      textControlsSection.style.pointerEvents = 'auto';
      downloadBtn.disabled = false;
      
      // Clear previous texts
      appState.texts = [];
      appState.activeTextId = null;
      renderTexts();
      updateSettingsPanel();
    };
    imgObj.src = dataUrl;
  };
  reader.readAsDataURL(file);
}

function addTextElement() {
  const newText = {
    id: appState.nextId++,
    text: 'Double click or edit in sidebar',
    fontFamily: "'Inter', sans-serif",
    color: '#ffffff',
    fontSize: 48,
    textAlign: 'center',
    // Store position as percentages (0 to 100) for responsive accuracy
    x: 50,
    y: 50,
    width: null,
    height: null
  };
  
  appState.texts.push(newText);
  setActiveText(newText.id);
  renderTexts();
}

function updateActiveText(prop, value) {
  if (!appState.activeTextId) return;
  const activeText = appState.texts.find(t => t.id === appState.activeTextId);
  if (activeText) {
    activeText[prop] = value;
    // Fast DOM update for performance during dragging/typing
    updateDOMElement(activeText);
  }
}

function deleteActiveText() {
  if (!appState.activeTextId) return;
  appState.texts = appState.texts.filter(t => t.id !== appState.activeTextId);
  setActiveText(null);
  renderTexts();
}

function setActiveText(id) {
  appState.activeTextId = id;
  renderTexts();
  updateSettingsPanel();
}

function updateSettingsPanel() {
  if (!appState.activeTextId) {
    activeTextSettings.classList.add('hidden');
    return;
  }
  
  const activeText = appState.texts.find(t => t.id === appState.activeTextId);
  if (!activeText) return;

  activeTextSettings.classList.remove('hidden');
  textContentInput.value = activeText.text;
  fontFamilySelect.value = activeText.fontFamily;
  textColorInput.value = activeText.color;
  textColorValue.textContent = activeText.color;
  textSizeInput.value = activeText.fontSize;
  textSizeValue.textContent = activeText.fontSize;

  const align = activeText.textAlign || 'center';
  alignLeftBtn.classList.toggle('active', align === 'left');
  alignCenterBtn.classList.toggle('active', align === 'center');
  alignRightBtn.classList.toggle('active', align === 'right');
}

/* Rendering and Dragging */

function renderTexts() {
  // Clear layer
  textLayer.innerHTML = '';
  
  appState.texts.forEach(textObj => {
    const el = document.createElement('div');
    el.className = `text-element ${textObj.id === appState.activeTextId ? 'selected' : ''}`;
    el.id = `text-${textObj.id}`;
    
    // Apply styling
    const content = document.createElement('div');
    content.className = 'text-content';
    content.innerText = textObj.text;
    el.appendChild(content);

    if (textObj.id === appState.activeTextId) {
      const handles = ['left', 'right', 'top', 'bottom'];
      handles.forEach(pos => {
        const handle = document.createElement('div');
        handle.className = `resize-handle handle-${pos}`;
        handle.addEventListener('mousedown', (e) => startResize(e, textObj, pos));
        handle.addEventListener('touchstart', (e) => startResize(e, textObj, pos), { passive: false });
        el.appendChild(handle);
      });
    }

    // The font size in the UI should scale relative to the image currently displayed
    // It shouldn't be microscopic if the image is huge.
    // We treat 'fontSize' as a base size based on a 1000px height image for consistency.
    // Or just absolute pixel values adjusted for scale. Let's compute a scale factor.
    updateDOMElementStyles(el, textObj);
    
    // Interactions
    content.addEventListener('mousedown', (e) => startDrag(e, textObj));
    content.addEventListener('touchstart', (e) => startDrag(e, textObj), { passive: false });
    
    // Select on click
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      setActiveText(textObj.id);
    });

    textLayer.appendChild(el);
  });
}

function updateDOMElement(textObj) {
  const el = document.getElementById(`text-${textObj.id}`);
  if (el) {
    const content = el.querySelector('.text-content');
    if (content) content.innerText = textObj.text;
    updateDOMElementStyles(el, textObj);
  }
}

function updateDOMElementStyles(el, textObj) {
  el.style.left = `${textObj.x}%`;
  el.style.top = `${textObj.y}%`;
  el.style.fontFamily = textObj.fontFamily;
  el.style.color = textObj.color;
  
  if (textObj.width !== null) {
    el.style.width = `${textObj.width}%`;
    const content = el.querySelector('.text-content');
    if (content) {
      content.style.whiteSpace = 'normal';
      content.style.wordBreak = 'break-word';
    }
  } else {
    el.style.width = 'auto';
    const content = el.querySelector('.text-content');
    if (content) {
      content.style.whiteSpace = 'pre-wrap';
      content.style.wordBreak = 'normal';
    }
  }

  if (textObj.height !== null) {
    el.style.height = `${textObj.height}%`;
  } else {
    el.style.height = 'auto';
  }
  
  const contentNode = el.querySelector('.text-content');
  if (contentNode) {
    contentNode.style.textAlign = textObj.textAlign || 'center';
  }
  
  // Calculate rendered scale
  const displayedHeight = mainImage.clientHeight;
  const scale = displayedHeight / appState.imageHeight;
  const scaledSize = textObj.fontSize * scale;
  
  el.style.fontSize = `${scaledSize}px`;
  
  // Update line height to keep it tight
  el.style.lineHeight = '1.2';
}

// Window resize needs to re-evaluate responsive font sizes
window.addEventListener('resize', () => {
  if (appState.imageSrc) {
    appState.texts.forEach(updateDOMElement);
  }
});

// Dragging Logic
let isDragging = false;
let currentDragObj = null;

function startDrag(e, textObj) {
  e.preventDefault();
  if (appState.activeTextId !== textObj.id) {
    setActiveText(textObj.id);
  }
  
  isDragging = true;
  currentDragObj = textObj;
  
  document.addEventListener('mousemove', onDrag);
  document.addEventListener('mouseup', endDrag);
  document.addEventListener('touchmove', onDrag, { passive: false });
  document.addEventListener('touchend', endDrag);
}

function onDrag(e) {
  if (!isDragging || !currentDragObj) return;
  e.preventDefault();
  
  let clientX, clientY;
  if (e.type.includes('mouse')) {
    clientX = e.clientX;
    clientY = e.clientY;
  } else {
    clientX = e.touches[0].clientX;
    clientY = e.touches[0].clientY;
  }
  
  const rect = canvasWrapper.getBoundingClientRect();
  
  // Calculate as percentage
  let pctX = ((clientX - rect.left) / rect.width) * 100;
  let pctY = ((clientY - rect.top) / rect.height) * 100;
  
  // Clamp to 0-100
  pctX = Math.max(0, Math.min(100, pctX));
  pctY = Math.max(0, Math.min(100, pctY));
  
  currentDragObj.x = pctX;
  currentDragObj.y = pctY;
  
  updateDOMElement(currentDragObj);
}

function endDrag() {
  isDragging = false;
  currentDragObj = null;
  document.removeEventListener('mousemove', onDrag);
  document.removeEventListener('mouseup', endDrag);
  document.removeEventListener('touchmove', onDrag);
  document.removeEventListener('touchend', endDrag);
}

// Resizing Logic
let isResizing = false;
let currentResizeObj = null;
let currentResizeSide = null;
let resizeStartX = 0;
let resizeStartY = 0;
let initialWidth = 0;
let initialHeight = 0;
let initialX = 0;
let initialY = 0;

function startResize(e, textObj, side) {
  e.preventDefault();
  e.stopPropagation();
  isResizing = true;
  currentResizeObj = textObj;
  currentResizeSide = side;
  
  if (e.type.includes('mouse')) {
    resizeStartX = e.clientX;
    resizeStartY = e.clientY;
  } else {
    resizeStartX = e.touches[0].clientX;
    resizeStartY = e.touches[0].clientY;
  }

  const el = document.getElementById(`text-${textObj.id}`);
  const rect = el.getBoundingClientRect();
  const parentRect = canvasWrapper.getBoundingClientRect();

  if (currentResizeObj.width === null) {
    currentResizeObj.width = (rect.width / parentRect.width) * 100;
  }
  if (currentResizeObj.height === null) {
    currentResizeObj.height = (rect.height / parentRect.height) * 100;
  }

  initialWidth = currentResizeObj.width;
  initialHeight = currentResizeObj.height;
  initialX = currentResizeObj.x;
  initialY = currentResizeObj.y;

  document.addEventListener('mousemove', onResize);
  document.addEventListener('mouseup', endResize);
  document.addEventListener('touchmove', onResize, { passive: false });
  document.addEventListener('touchend', endResize);
}

function onResize(e) {
  if (!isResizing || !currentResizeObj) return;
  e.preventDefault();
  
  let clientX, clientY;
  if (e.type.includes('mouse')) {
    clientX = e.clientX;
    clientY = e.clientY;
  } else {
    clientX = e.touches[0].clientX;
    clientY = e.touches[0].clientY;
  }

  const dx = clientX - resizeStartX;
  const dy = clientY - resizeStartY;
  
  const parentRect = canvasWrapper.getBoundingClientRect();
  const dxPct = (dx / parentRect.width) * 100;
  const dyPct = (dy / parentRect.height) * 100;

  if (currentResizeSide === 'right') {
    currentResizeObj.width = Math.max(5, initialWidth + dxPct);
    const actualDxPct = currentResizeObj.width - initialWidth;
    currentResizeObj.x = initialX + actualDxPct / 2;
  } else if (currentResizeSide === 'left') {
    currentResizeObj.width = Math.max(5, initialWidth - dxPct);
    const actualDxPct = initialWidth - currentResizeObj.width;
    currentResizeObj.x = initialX - actualDxPct / 2;
  } else if (currentResizeSide === 'bottom') {
    currentResizeObj.height = Math.max(5, initialHeight + dyPct);
    const actualDyPct = currentResizeObj.height - initialHeight;
    currentResizeObj.y = initialY + actualDyPct / 2;
  } else if (currentResizeSide === 'top') {
    currentResizeObj.height = Math.max(5, initialHeight - dyPct);
    const actualDyPct = initialHeight - currentResizeObj.height;
    currentResizeObj.y = initialY - actualDyPct / 2;
  }

  updateDOMElement(currentResizeObj);
}

function endResize() {
  isResizing = false;
  currentResizeObj = null;
  currentResizeSide = null;
  document.removeEventListener('mousemove', onResize);
  document.removeEventListener('mouseup', endResize);
  document.removeEventListener('touchmove', onResize);
  document.removeEventListener('touchend', endResize);
}

/* Download / Export */

function handleDownload() {
  if (!appState.imageSrc) return;
  
  // Setup canvas
  const ctx = exportCanvas.getContext('2d');
  exportCanvas.width = appState.imageWidth;
  exportCanvas.height = appState.imageHeight;
  
  // Draw base image
  const img = new window.Image();
  img.onload = () => {
    ctx.drawImage(img, 0, 0, exportCanvas.width, exportCanvas.height);
    
    // Draw text elements
    appState.texts.forEach(textObj => {
      ctx.font = `${textObj.fontSize}px ${textObj.fontFamily}`;
      ctx.fillStyle = textObj.color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle'; // Center vertically relative to coordinate
      
      // Calculate true coordinates
      const cx = (textObj.x / 100) * exportCanvas.width;
      const cy = (textObj.y / 100) * exportCanvas.height;
      
      // Basic shadow for canvas text for visibility matching DOM
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = Math.max(4, textObj.fontSize * 0.1);
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = Math.max(2, textObj.fontSize * 0.05);

      // Handle multi-line text and word wrapping if width is defined
      let lines = [];
      const paragraphs = textObj.text.split('\n');
      const maxWidth = textObj.width !== null ? (textObj.width / 100) * exportCanvas.width : Number.MAX_VALUE;
      let actualMaxWidth = 0;

      paragraphs.forEach(paragraph => {
        let words = paragraph.split(' ');
        let currentLine = words[0] || '';
        
        for (let i = 1; i < words.length; i++) {
          let word = words[i];
          let testLine = currentLine + " " + word;
          let testWidth = ctx.measureText(testLine).width;
          if (testWidth < maxWidth) {
            currentLine = testLine;
          } else {
            lines.push(currentLine);
            currentLine = word;
          }
        }
        lines.push(currentLine);
      });

      // Find the rendering width for alignment calculations
      lines.forEach(line => {
        let w = ctx.measureText(line).width;
        if (w > actualMaxWidth) actualMaxWidth = w;
      });

      const boxPxWidth = textObj.width !== null ? maxWidth : actualMaxWidth;
      const lineHeight = textObj.fontSize * 1.2;
      
      // Adjust starting Y to center the whole block of lines
      let startY = cy - ((lines.length - 1) * lineHeight) / 2;
      
      const align = textObj.textAlign || 'center';

      lines.forEach((line, index) => {
        let drawX = cx;
        const lineWidth = ctx.measureText(line).width;
        
        if (align === 'left') {
          drawX = cx - (boxPxWidth / 2) + (lineWidth / 2);
        } else if (align === 'right') {
          drawX = cx + (boxPxWidth / 2) - (lineWidth / 2);
        }
        
        ctx.fillText(line, drawX, startY + (index * lineHeight));
      });
    });
    
    // Trigger download
    const dataUrl = exportCanvas.toDataURL('image/png', 1.0);
    const link = document.createElement('a');
    link.download = `text-on-image-${Date.now()}.png`;
    link.href = dataUrl;
    link.click();
  };
  img.src = appState.imageSrc;
}
