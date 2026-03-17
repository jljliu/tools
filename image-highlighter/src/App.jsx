import { useState, useRef, useEffect } from 'react';
import './App.css';

function App() {
  const [image, setImage] = useState(null);
  const [blurLevel, setBlurLevel] = useState(10);
  const [dimLevel, setDimLevel] = useState(0.5);
  
  // Selection box state
  const [isDrawing, setIsDrawing] = useState(false);
  const [selectionBox, setSelectionBox] = useState(null); // {x, y, w, h}
  const [startPos, setStartPos] = useState(null);

  const canvasRef = useRef(null);
  const imageElementRef = useRef(null);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        imageElementRef.current = img;
        setImage(url);
        setSelectionBox(null);
      };
      img.src = url;
    }
  };

  const drawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas || !imageElementRef.current) return;

    const ctx = canvas.getContext('2d');
    const img = imageElementRef.current;

    // Set canvas size to match image
    canvas.width = img.width;
    canvas.height = img.height;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1. Draw blurred base image
    ctx.filter = `blur(${blurLevel}px)`;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    ctx.filter = 'none'; // reset filter

    // 2. Draw dim overlay
    ctx.fillStyle = `rgba(0, 0, 0, ${dimLevel})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 3. Draw highlighted selection (if exists)
    if (selectionBox && selectionBox.w !== 0 && selectionBox.h !== 0) {
      let { x, y, w, h } = selectionBox;

      // Handle negative width/height from dragging backwards
      if (w < 0) { x += w; w = Math.abs(w); }
      if (h < 0) { y += h; h = Math.abs(h); }

      ctx.save();
      ctx.beginPath();
      // Optionally add rounded corners to the clip
      const radius = 8;
      ctx.roundRect(x, y, w, h, radius);
      ctx.clip();

      // Draw the crisp, unblurred, undimmed original image in the clipped region
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      ctx.restore();

      // 4. Draw a premium glow/stroke around the selection
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, radius);
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.stroke();
      
      // Outer subtle glow
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.shadowColor = 'rgba(255, 255, 255, 0.6)';
      ctx.shadowBlur = 15;
      ctx.stroke();
      ctx.shadowBlur = 0; // reset
    }
  };

  useEffect(() => {
    drawCanvas();
  }, [image, blurLevel, dimLevel, selectionBox]);

  const getCanvasCoordinates = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    // Calculate scale factor between rendered size and actual pixel size
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  const onMouseDown = (e) => {
    if (!image) return;
    const pos = getCanvasCoordinates(e);
    setIsDrawing(true);
    setStartPos(pos);
    setSelectionBox({ x: pos.x, y: pos.y, w: 0, h: 0 });
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDrawing || !startPos) return;
      // Allow dragging outside the canvas by capturing global mouse events
      const currentPos = getCanvasCoordinates(e);
      setSelectionBox({
        x: startPos.x,
        y: startPos.y,
        w: currentPos.x - startPos.x,
        h: currentPos.y - startPos.y,
      });
    };

    const handleMouseUp = () => {
      setIsDrawing(false);
    };

    if (isDrawing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDrawing, startPos]);

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const link = document.createElement('url');
    link.download = 'highlighted-image.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  return (
    <div className="app-container">
      <header className="header">
        <h1>Spotlight</h1>
        <p>Highlight your UI in seconds. Purely in-browser.</p>
      </header>

      <div className="main-content">
        <aside className="sidebar">
          <div className="control-group">
            <label className="upload-btn">
              Upload Image
              <input type="file" accept="image/*" onChange={handleImageUpload} hidden />
            </label>
          </div>

          {image && (
            <>
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

              <div className="control-group instructions">
                <p>Click and drag on the image to draw a highlight box.</p>
              </div>

              <button className="download-btn" onClick={handleDownload} disabled={!selectionBox || selectionBox.w === 0}>
                Download Image
              </button>
            </>
          )}
        </aside>

        <main className="canvas-wrapper">
          {!image ? (
            <div className="empty-state">
              <div className="empty-icon">🖼️</div>
              <p>Upload an image to get started</p>
            </div>
          ) : (
            <canvas
              ref={canvasRef}
              onMouseDown={onMouseDown}
              className="image-canvas"
            />
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
