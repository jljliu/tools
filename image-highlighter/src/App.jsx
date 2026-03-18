import { useState, useRef, useEffect } from 'react';
import * as StackBlur from 'stackblur-canvas';
import { UploadCloud, Download, Image as ImageIcon } from 'lucide-react';
import './App.css';

function App() {
  const [image, setImage] = useState(null);
  const [blurLevel, setBlurLevel] = useState(10);
  const [dimLevel, setDimLevel] = useState(0.5);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Selection box state
  const [isDrawing, setIsDrawing] = useState(false);
  const [selectionBox, setSelectionBox] = useState(null); // {x, y, w, h}
  const [startPos, setStartPos] = useState(null);

  // Interaction state
  const [dragMode, setDragMode] = useState(null); // 'draw', 'move', 'nw', 'n', 'ne', 'w', 'e', 'sw', 's', 'se'
  const [dragOffset, setDragOffset] = useState({ dx: 0, dy: 0 });
  const [hoverMode, setHoverMode] = useState(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);

  const canvasRef = useRef(null);
  const imageElementRef = useRef(null);
  const fileInputRef = useRef(null);

  const handleFile = (file) => {
    if (file && file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        imageElementRef.current = img;
        setImage(url);
        setSelectionBox({ x: 0, y: 0, w: 0, h: 0 }); // init empty box to prevent UI jump
      };
      img.src = url;
    }
  };

  const handleImageUpload = (e) => {
    handleFile(e.target.files[0]);
  };

  const onDragOver = (e) => {
    e.preventDefault();
    setIsDraggingFile(true);
  };

  const onDragLeave = (e) => {
    e.preventDefault();
    setIsDraggingFile(false);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setIsDraggingFile(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const drawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas || !imageElementRef.current) return;

    const ctx = canvas.getContext('2d');
    const img = imageElementRef.current;

    canvas.width = img.width;
    canvas.height = img.height;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1. Draw base image
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    
    // Process software blur
    if (blurLevel > 0) {
      StackBlur.canvasRGBA(canvas, 0, 0, canvas.width, canvas.height, blurLevel);
    }

    // 2. Draw dim overlay
    ctx.fillStyle = `rgba(0, 0, 0, ${dimLevel})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 3. Draw highlighted selection
    if (selectionBox && selectionBox.w !== 0 && selectionBox.h !== 0) {
      let { x, y, w, h } = selectionBox;

      if (w < 0) { x += w; w = Math.abs(w); }
      if (h < 0) { y += h; h = Math.abs(h); }

      ctx.save();
      ctx.beginPath();
      const radius = 8;
      ctx.roundRect(x, y, w, h, radius);
      ctx.clip();

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      ctx.restore();

      // 4. Draw stroke
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, radius);
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.stroke();
      
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.shadowColor = 'rgba(255, 255, 255, 0.6)';
      ctx.shadowBlur = 15;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
  };

  useEffect(() => {
    drawCanvas();
  }, [image, blurLevel, dimLevel, selectionBox]);

  const getCanvasCoordinates = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    
    // account for object-fit: contain scaling and offset
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  const getHitZone = (pos, box) => {
    if (!box || box.w === 0 || box.h === 0) return null;
    let { x, y, w, h } = box;
    if (w < 0) { x += w; w = Math.abs(w); }
    if (h < 0) { y += h; h = Math.abs(h); }
    
    const canvas = canvasRef.current;
    const scaleX = canvas ? canvas.width / canvas.getBoundingClientRect().width : 1;
    const margin = 12 * scaleX; 

    const right = x + w;
    const bottom = y + h;

    const onLeft = pos.x >= x - margin && pos.x <= x + margin;
    const onRight = pos.x >= right - margin && pos.x <= right + margin;
    const onTop = pos.y >= y - margin && pos.y <= y + margin;
    const onBottom = pos.y >= bottom - margin && pos.y <= bottom + margin;

    const insideX = pos.x > x - margin && pos.x < right + margin;
    const insideY = pos.y > y - margin && pos.y < bottom + margin;
    
    const strictlyInsideX = pos.x > x + margin && pos.x < right - margin;
    const strictlyInsideY = pos.y > y + margin && pos.y < bottom - margin;

    if (onTop && onLeft) return 'nw';
    if (onTop && onRight) return 'ne';
    if (onBottom && onLeft) return 'sw';
    if (onBottom && onRight) return 'se';
    if (onTop && insideX) return 'n';
    if (onBottom && insideX) return 's';
    if (onLeft && insideY) return 'w';
    if (onRight && insideY) return 'e';
    if (strictlyInsideX && strictlyInsideY) return 'move';
    
    return null;
  };

  const onCanvasMouseMove = (e) => {
    if (isDrawing) return;
    const pos = getCanvasCoordinates(e);
    const zone = getHitZone(pos, selectionBox);
    setHoverMode(zone);
  };

  const onMouseDown = (e) => {
    if (!image) return;
    const pos = getCanvasCoordinates(e);
    const zone = getHitZone(pos, selectionBox);
    
    setIsDrawing(true);
    setStartPos(pos);

    if (zone) {
      setDragMode(zone);
      if (zone === 'move') {
        let { x, y, w, h } = selectionBox;
        if (w < 0) { x += w; w = Math.abs(w); }
        if (h < 0) { y += h; h = Math.abs(h); }
        setDragOffset({ dx: pos.x - x, dy: pos.y - y });
      } else {
        let { x, y, w, h } = selectionBox;
        if (w < 0) { x += w; w = Math.abs(w); }
        if (h < 0) { y += h; h = Math.abs(h); }
        setSelectionBox({ x, y, w, h });
      }
    } else {
      setDragMode('draw');
      setSelectionBox({ x: pos.x, y: pos.y, w: 0, h: 0 });
    }
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDrawing || !startPos) return;
      const currentPos = getCanvasCoordinates(e);
      
      setSelectionBox(prev => {
        if (!prev) return prev;
        
        // Always use normalized variables for boundary math
        let { x, y, w, h } = prev;
        let nx = x, ny = y, nw = w, nh = h;
        if (nw < 0) { nx += nw; nw = Math.abs(nw); }
        if (nh < 0) { ny += nh; nh = Math.abs(nh); }
        let activeBox = { x: nx, y: ny, w: nw, h: nh };

        if (dragMode === 'draw') {
          return {
             x: startPos.x,
             y: startPos.y,
             w: currentPos.x - startPos.x,
             h: currentPos.y - startPos.y,
          };
        } else if (dragMode === 'move') {
          return {
             x: currentPos.x - dragOffset.dx,
             y: currentPos.y - dragOffset.dy,
             w: activeBox.w,
             h: activeBox.h,
          };
        } else {
          // Resize logic based on dragMode
          let newX = activeBox.x;
          let newY = activeBox.y;
          let newW = activeBox.w;
          let newH = activeBox.h;

          if (dragMode.includes('w')) {
             const dx = currentPos.x - activeBox.x;
             newX = currentPos.x;
             newW = activeBox.w - dx;
          }
          if (dragMode.includes('e')) {
             newW = currentPos.x - activeBox.x;
          }
          if (dragMode.includes('n')) {
             const dy = currentPos.y - activeBox.y;
             newY = currentPos.y;
             newH = activeBox.h - dy;
          }
          if (dragMode.includes('s')) {
             newH = currentPos.y - activeBox.y;
          }
          
          return { x: newX, y: newY, w: newW, h: newH };
        }
      });
    };

    const handleMouseUp = () => {
      setIsDrawing(false);
      
      setSelectionBox(prev => {
        if (!prev) return prev;
        let { x, y, w, h } = prev;
        if (w < 0) { x += w; w = Math.abs(w); }
        if (h < 0) { y += h; h = Math.abs(h); }
        return { x, y, w, h };
      });
    };

    if (isDrawing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDrawing, startPos, dragMode, dragOffset]);

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    setIsProcessing(true);
    // Add small delay to let UI show processing state
    setTimeout(() => {
      const link = document.createElement('a');
      link.download = 'highlighted-image.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
      setIsProcessing(false);
    }, 50);
  };

  const getCursorStyle = () => {
    if (!image) return 'default';
    const mode = isDrawing ? dragMode : hoverMode;
    switch (mode) {
      case 'nw': case 'se': return 'nwse-resize';
      case 'ne': case 'sw': return 'nesw-resize';
      case 'n': case 's': return 'ns-resize';
      case 'w': case 'e': return 'ew-resize';
      case 'move': return 'move';
      case 'draw': return 'crosshair';
      default: return 'crosshair';
    }
  };

  return (
    <div className="app-container">
      <header className="header">
        <h1>Spotlight Highlighter</h1>
        <p>Highlight your UI in seconds. Purely in-browser.</p>
      </header>

      <div className={`main-content ${image ? 'has-image' : ''}`}>
        {!image ? (
          <div 
            className={`empty-upload-zone ${isDraggingFile ? 'drag-active' : ''}`}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <UploadCloud className="upload-icon" />
            <div className="upload-text">Drop your image here</div>
            <div className="upload-hint">or click to browse from your computer</div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              style={{ display: 'none' }}
            />
          </div>
        ) : (
          <>
            {/* Sidebar Controls */}
            <aside className="panel settings-group">
              <div className="panel-title">
                <ImageIcon size={20} className="text-accent" />
                <span>Adjustments</span>
              </div>
              
              <div className="control-group">
                <div className="label-row">
                  <label>Blur Intensity</label>
                  <span>{blurLevel}px</span>
                </div>
                <input 
                  type="range" 
                  min="0" max="40" 
                  value={blurLevel} 
                  onChange={(e) => setBlurLevel(Number(e.target.value))} 
                />
              </div>

              <div className="control-group">
                <div className="label-row">
                  <label>Dim Overlay</label>
                  <span>{Math.round(dimLevel * 100)}%</span>
                </div>
                <input 
                  type="range" 
                  min="0" max="1" step="0.05" 
                  value={dimLevel} 
                  onChange={(e) => setDimLevel(Number(e.target.value))} 
                />
              </div>

              <div className="instructions control-group">
                <p>Click and drag on the image to draw a highlight box. You can then drag its center to move it, or drag its edges to resize.</p>
              </div>

              <div style={{ marginTop: 'auto', paddingTop: '24px' }}>
                <button
                  onClick={handleDownload}
                  disabled={!selectionBox || selectionBox.w === 0 || isProcessing}
                  className="btn btn-primary"
                >
                  <Download size={18} />
                  {isProcessing ? 'Processing...' : 'Download Image'}
                </button>
                
                <button
                  onClick={() => setImage(null)}
                  className="btn btn-secondary"
                  style={{ marginTop: '12px' }}
                >
                  Change Image
                </button>
              </div>
            </aside>

            {/* Canvas Area */}
            <main className="editor-area">
              <div className="canvas-wrapper">
                <canvas
                  ref={canvasRef}
                  onMouseDown={onMouseDown}
                  onMouseMove={onCanvasMouseMove}
                  className="image-canvas"
                  style={{ cursor: getCursorStyle() }}
                />
              </div>
            </main>
          </>
        )}
      </div>
    </div>
  );
}

export default App;
