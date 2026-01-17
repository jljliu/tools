import './collage.css';

export function initCollage() {
    const container = document.getElementById('collage-container');
    container.innerHTML = `
    <div class="collage-layout">
        <div class="collage-sidebar">
            <div class="panel">
                <div class="form-group">
                    <label>Canvas Settings</label>
                    <div class="tool-row">
                       <button id="btn-toggle-orientation" class="btn btn-secondary w-full">
                          Swap to Landscape
                       </button>
                    </div>
                </div>

                <div class="form-group">
                    <label>Canvas Settings</label>
                    <div class="tool-row">
                       <button id="btn-toggle-orientation" class="btn btn-secondary w-full">
                          Swap to Landscape
                       </button>
                    </div>
                </div>

                <h3>Add Photo</h3>
                <div class="form-group">
                    <label>Select Image</label>
                    <div class="file-upload-wrapper btn btn-secondary w-full">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
                        Upload
                        <input type="file" id="collage-upload" accept="image/*">
                    </div>
                </div>
                <div class="form-group">
                    <label>Width (mm)</label>
                    <input type="number" id="img-width-mm" value="50" min="10">
                </div>
                <div class="form-group">
                     <label>Height (mm) <small class="text-muted">(Auto if empty)</small></label>
                     <input type="number" id="img-height-mm" placeholder="Auto">
                </div>
                <button id="btn-add-to-canvas" class="btn btn-primary w-full">Add to Canvas</button>
            </div>

            <div class="panel">
                <h3>Border Settings</h3>
                <div class="form-group">
                    <label>Border Color</label>
                    <div class="tool-row">
                        <input type="color" id="border-color" value="#000000" class="color-picker w-full">
                    </div>
                </div>
                <div class="form-group">
                     <label>Thickness (mm)</label>
                     <input type="number" id="border-thickness" value="0" min="0" step="0.1">
                </div>
                <button id="btn-apply-border" class="btn btn-secondary w-full">
                   Update Selected / Default
                </button>
            </div>

            <button id="btn-download-collage" class="btn btn-success w-full" style="background-color: var(--color-success); color: #000;">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                Download 4x6 Print
            </button>
            <div style="text-align:center; color: var(--color-text-muted); font-size: 0.8rem;">
                Canvas: 4x6 inch @ 300 DPI
            </div>
        </div>

        <div class="collage-workspace">
             <canvas id="collage-canvas"></canvas>
        </div>
    </div>
  `;

    // Constants
    const DPI = 300;
    const INCH_TO_MM = 25.4;
    let CANVAS_WIDTH = 4 * DPI; // 1200
    let CANVAS_HEIGHT = 6 * DPI; // 1800
    let isLandscape = false;

    // Helpers
    const mmToPx = (mm) => (mm / INCH_TO_MM) * DPI;

    // State
    const canvas = document.getElementById('collage-canvas');
    const ctx = canvas.getContext('2d');

    // Initialize Canvas
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;

    let images = []; // { img, x, y, width, height, borderColor, borderThickness, id }
    let selectedImageId = null;
    let isDragging = false;
    let dragStartX, dragStartY;
    let activeImageOriginalX, activeImageOriginalY;

    // Inputs
    const btnOrientation = document.getElementById('btn-toggle-orientation');
    const uploadInput = document.getElementById('collage-upload');
    const widthInput = document.getElementById('img-width-mm');
    const heightInput = document.getElementById('img-height-mm');
    const addBtn = document.getElementById('btn-add-to-canvas');
    const borderColorInput = document.getElementById('border-color');
    const borderThicknessInput = document.getElementById('border-thickness');
    const updateBorderBtn = document.getElementById('btn-apply-border');
    const downloadBtn = document.getElementById('btn-download-collage');

    // Logic
    function render() {
        // Clear
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        // Draw Images
        images.forEach(obj => {
            const borderPx = mmToPx(obj.borderThickness);

            // Draw Border
            if (borderPx > 0) {
                ctx.fillStyle = obj.borderColor;
                ctx.fillRect(
                    obj.x - borderPx,
                    obj.y - borderPx,
                    obj.width + borderPx * 2,
                    obj.height + borderPx * 2
                );
            }

            // Draw Image
            ctx.drawImage(obj.img, obj.x, obj.y, obj.width, obj.height);

            // Selection Highlight (only on screen, not saved? Actually let's just draw a thin blue line for selection)
            // We might need a flag "isExporting" to hide this during download.
            if (obj.id === selectedImageId) {
                ctx.strokeStyle = '#38bdf8';
                ctx.lineWidth = 4;
                ctx.strokeRect(
                    obj.x - borderPx,
                    obj.y - borderPx,
                    obj.width + borderPx * 2,
                    obj.height + borderPx * 2
                );
            }
        });
    }

    // Add Item
    let loadedImage = null; // Temp holder for uploaded image

    uploadInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            const img = new Image();
            img.onload = () => {
                loadedImage = img;
                addBtn.textContent = "Add to Canvas (Ready)";
                addBtn.classList.remove('btn-primary');
                addBtn.classList.add('btn-success');
            };
            img.src = evt.target.result;
        };
        reader.readAsDataURL(file);
    });

    addBtn.addEventListener('click', () => {
        if (!loadedImage) {
            alert('Please upload an image first.');
            return;
        }

        const reqWidthMM = Number(widthInput.value);
        let reqHeightMM = Number(heightInput.value);

        if (!reqWidthMM) {
            alert('Please specify width.');
            return;
        }

        // Calculate Pixels
        const aspect = loadedImage.width / loadedImage.height;

        let widthPx = mmToPx(reqWidthMM);
        let heightPx;

        if (reqHeightMM) {
            heightPx = mmToPx(reqHeightMM);
            // Note: this stretches if aspect ratio doesn't match. 
            // Usually users expect "Fit" or "Crop". For now simplest is stretch or they leave it auto.
        } else {
            heightPx = widthPx / aspect;
        }

        const newObj = {
            id: Date.now(),
            img: loadedImage,
            x: 50, // Default positions
            y: 50,
            width: widthPx,
            height: heightPx,
            borderColor: borderColorInput.value,
            borderThickness: Number(borderThicknessInput.value)
        };

        images.push(newObj);
        selectedImageId = newObj.id;
        render();

        // Reset
        loadedImage = null;
        uploadInput.value = '';
        addBtn.textContent = "Add to Canvas";
        addBtn.classList.add('btn-primary');
        addBtn.classList.remove('btn-success');
    });

    // Border Updates
    updateBorderBtn.addEventListener('click', () => {
        if (selectedImageId) {
            const obj = images.find(i => i.id === selectedImageId);
            if (obj) {
                obj.borderColor = borderColorInput.value;
                obj.borderThickness = Number(borderThicknessInput.value);
                render();
            }
        }
    });

    // Orientation Toggle
    btnOrientation.addEventListener('click', () => {
        isLandscape = !isLandscape;

        // Swap Dimensions
        const temp = CANVAS_WIDTH;
        CANVAS_WIDTH = CANVAS_HEIGHT;
        CANVAS_HEIGHT = temp;

        canvas.width = CANVAS_WIDTH;
        canvas.height = CANVAS_HEIGHT;

        btnOrientation.textContent = isLandscape ? "Swap to Portrait" : "Swap to Landscape";

        render();
    });

    // Canvas Interactions (Drag & Select)
    function getCanvasCoords(e) {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY
        };
    }

    canvas.addEventListener('mousedown', (e) => {
        const { x, y } = getCanvasCoords(e);

        // Find clicked image (Check top-most first, so reverse loop)
        let clickedId = null;
        for (let i = images.length - 1; i >= 0; i--) {
            const obj = images[i];
            const bPx = mmToPx(obj.borderThickness);
            if (
                x >= obj.x - bPx &&
                x <= obj.x + obj.width + bPx &&
                y >= obj.y - bPx &&
                y <= obj.y + obj.height + bPx
            ) {
                clickedId = obj.id;
                break;
            }
        }

        selectedImageId = clickedId;

        if (clickedId) {
            isDragging = true;
            dragStartX = x;
            dragStartY = y;
            const obj = images.find(i => i.id === clickedId);
            activeImageOriginalX = obj.x;
            activeImageOriginalY = obj.y;

            // Move to top of stack?
            // images = images.filter(i => i.id !== clickedId).concat(obj); 
            // (Optional: usually better UX)

            // Populate tools
            borderColorInput.value = obj.borderColor;
            borderThicknessInput.value = obj.borderThickness;
        }

        render();
    });

    window.addEventListener('mouseup', () => {
        isDragging = false;
    });

    // Snapping Logic
    const SNAP_THRESHOLD = 30; // Amount of pixels to snap within
    let activeGuides = []; // lines to draw {x, y, vertical: bool}

    function getSnapLines(currentObj) {
        const lines = { x: [], y: [] };

        // Canvas Edges
        lines.x.push(0);
        lines.x.push(CANVAS_WIDTH);
        lines.x.push(CANVAS_WIDTH / 2); // Center snap

        lines.y.push(0);
        lines.y.push(CANVAS_HEIGHT);
        lines.y.push(CANVAS_HEIGHT / 2);

        // Other Images
        images.forEach(img => {
            if (img.id === currentObj.id) return;
            const bPx = mmToPx(img.borderThickness);

            // Left/Right edges of other image (including border)
            lines.x.push(img.x - bPx);
            lines.x.push(img.x + img.width + bPx);

            // Top/Bottom edges
            lines.y.push(img.y - bPx);
            lines.y.push(img.y + img.height + bPx);
        });

        return lines;
    }

    canvas.addEventListener('mousemove', (e) => {
        if (!isDragging || !selectedImageId) return;

        const { x, y } = getCanvasCoords(e);
        const dx = x - dragStartX;
        const dy = y - dragStartY;

        const obj = images.find(i => i.id === selectedImageId);
        if (obj) {
            let newX = activeImageOriginalX + dx;
            let newY = activeImageOriginalY + dy;
            const bPx = mmToPx(obj.borderThickness);

            // Edges of the moving object (including its border)
            // We want to snap: left, right, center(x) -- top, bottom, center(y)

            activeGuides = []; // Reset guides

            const snapLines = getSnapLines(obj);

            // --- X Snapping ---
            let snappedX = false;

            // Check Left Edge
            for (const lineX of snapLines.x) {
                if (Math.abs((newX - bPx) - lineX) < SNAP_THRESHOLD) {
                    newX = lineX + bPx;
                    snappedX = true;
                    activeGuides.push({ x: lineX, vertical: true });
                    break;
                }
            }

            // Check Right Edge (if not already snapped)
            if (!snappedX) {
                for (const lineX of snapLines.x) {
                    if (Math.abs((newX + obj.width + bPx) - lineX) < SNAP_THRESHOLD) {
                        newX = lineX - obj.width - bPx;
                        snappedX = true;
                        activeGuides.push({ x: lineX, vertical: true });
                        break;
                    }
                }
            }

            // --- Y Snapping ---
            let snappedY = false;

            // Check Top Edge
            for (const lineY of snapLines.y) {
                if (Math.abs((newY - bPx) - lineY) < SNAP_THRESHOLD) {
                    newY = lineY + bPx;
                    snappedY = true;
                    activeGuides.push({ y: lineY, vertical: false });
                    break;
                }
            }

            // Check Bottom Edge
            if (!snappedY) {
                for (const lineY of snapLines.y) {
                    if (Math.abs((newY + obj.height + bPx) - lineY) < SNAP_THRESHOLD) {
                        newY = lineY - obj.height - bPx;
                        snappedY = true;
                        activeGuides.push({ y: lineY, vertical: false });
                        break;
                    }
                }
            }

            obj.x = newX;
            obj.y = newY;
            render();

            // Draw Guides
            ctx.save();
            ctx.strokeStyle = '#ec4899'; // Pink guidelines
            ctx.lineWidth = 2;
            ctx.setLineDash([10, 10]);

            activeGuides.forEach(g => {
                ctx.beginPath();
                if (g.vertical) {
                    ctx.moveTo(g.x, 0);
                    ctx.lineTo(g.x, CANVAS_HEIGHT);
                } else {
                    ctx.moveTo(0, g.y);
                    ctx.lineTo(CANVAS_WIDTH, g.y);
                }
                ctx.stroke();
            });
            ctx.restore();
        }
    });

    // Touch support (basic)
    // ... (omitted for brevity, but recommended for mobile)

    // Download
    downloadBtn.addEventListener('click', () => {
        // De-select to remove selection box
        const prevSelection = selectedImageId;
        selectedImageId = null;
        render();

        const link = document.createElement('a');
        link.download = 'collage-4x6.jpg';
        link.href = canvas.toDataURL('image/jpeg', 0.9);
        link.click();

        // Restore
        selectedImageId = prevSelection;
        render();
    });

    // Initial render
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
}
