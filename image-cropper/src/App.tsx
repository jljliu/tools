import React, { useState, useCallback, useEffect } from 'react';
import { type Crop, type PixelCrop, convertToPixelCrop } from 'react-image-crop';
import { Download, RefreshCw, Scissors, Image as ImageIcon } from 'lucide-react';
import { ImageUploader } from './components/ImageUploader';
import { CropperArea } from './components/CropperArea';
import { getCroppedResizedImage, downloadBlob, initCrop } from './utils/imageOperations';

function App() {
  const [imageSrc, setImageSrc] = useState<string>('');
  const [imageName, setImageName] = useState<string>('');
  const [imageRef, setImageRef] = useState<HTMLImageElement | null>(null);
  
  const [originalWidth, setOriginalWidth] = useState<number>(0);
  const [originalHeight, setOriginalHeight] = useState<number>(0);
  
  const [targetWidth, setTargetWidth] = useState<number>(1080);
  const [targetHeight, setTargetHeight] = useState<number>(1080);
  const [isLockToCrop, setIsLockToCrop] = useState<boolean>(false);
  const [selectedPreset, setSelectedPreset] = useState<string>('custom');

  const [crop, setCrop] = useState<Crop>({
    unit: '%',
    width: 90,
    height: 90,
    x: 5,
    y: 5
  });
  
  const [completedCrop, setCompletedCrop] = useState<PixelCrop | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Calculate aspect ratio
  const aspectRatio = targetWidth / targetHeight;

  const onImageLoad = useCallback((img: HTMLImageElement) => {
    setImageRef(img);
    setOriginalWidth(img.naturalWidth);
    setOriginalHeight(img.naturalHeight);
    
    // Automatically set target width and height to match original resolution initially
    setTargetWidth(img.naturalWidth);
    setTargetHeight(img.naturalHeight);
    setSelectedPreset('original');
    
    // Set crop to match natural aspect ratio of the image
    const aspect = img.naturalWidth / img.naturalHeight;
    const initialCrop = initCrop(img.width, img.height, aspect);
    setCrop(initialCrop);
    setCompletedCrop(convertToPixelCrop(initialCrop, img.width, img.height));
  }, []);

  const getCropNaturalDimensions = useCallback(() => {
    if (!completedCrop || !imageRef || !originalWidth || !originalHeight) return null;
    const scaleX = originalWidth / imageRef.width;
    const scaleY = originalHeight / imageRef.height;
    return {
      w: Math.round(completedCrop.width * scaleX),
      h: Math.round(completedCrop.height * scaleY)
    };
  }, [completedCrop, imageRef, originalWidth, originalHeight]);

  // Synchronize target dimensions when lock-to-crop is enabled
  useEffect(() => {
    if (isLockToCrop && completedCrop && imageRef && originalWidth && originalHeight) {
      const scaleX = originalWidth / imageRef.width;
      const scaleY = originalHeight / imageRef.height;
      const w = Math.round(completedCrop.width * scaleX);
      const h = Math.round(completedCrop.height * scaleY);
      if (w > 0 && h > 0) {
        setTargetWidth(w);
        setTargetHeight(h);
      }
    }
  }, [isLockToCrop, completedCrop, imageRef, originalWidth, originalHeight]);

  const handleWidthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    setSelectedPreset('custom');
    if (!isNaN(val) && val > 0) {
      setTargetWidth(val);
      if (imageRef) {
        const aspect = val / targetHeight;
        const newCrop = initCrop(imageRef.width, imageRef.height, aspect);
        setCrop(newCrop);
        setCompletedCrop(convertToPixelCrop(newCrop, imageRef.width, imageRef.height));
      }
    } else if (e.target.value === '') {
      setTargetWidth(0);
    }
  };

  const handleHeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    setSelectedPreset('custom');
    if (!isNaN(val) && val > 0) {
      setTargetHeight(val);
      if (imageRef) {
        const aspect = targetWidth / val;
        const newCrop = initCrop(imageRef.width, imageRef.height, aspect);
        setCrop(newCrop);
        setCompletedCrop(convertToPixelCrop(newCrop, imageRef.width, imageRef.height));
      }
    } else if (e.target.value === '') {
      setTargetHeight(0);
    }
  };

  const applyPreset = (preset: string) => {
    setSelectedPreset(preset);
    setIsLockToCrop(false);
    if (!imageRef || !originalWidth || !originalHeight) return;

    let w = targetWidth;
    let h = targetHeight;

    if (preset === 'original') {
      w = originalWidth;
      h = originalHeight;
    } else if (preset === 'square') {
      w = 1080;
      h = 1080;
    } else if (preset === 'landscape') {
      w = 1920;
      h = 1080;
    } else if (preset === 'portrait') {
      w = 1080;
      h = 1920;
    }

    setTargetWidth(w);
    setTargetHeight(h);

    const aspect = w / h;
    const newCrop = initCrop(imageRef.width, imageRef.height, aspect);
    setCrop(newCrop);
    setCompletedCrop(convertToPixelCrop(newCrop, imageRef.width, imageRef.height));
  };

  const applyScaleFactor = (factor: number) => {
    const naturalDims = getCropNaturalDimensions();
    if (!naturalDims || !imageRef) return;
    
    setIsLockToCrop(false);
    setSelectedPreset('custom');
    
    const w = Math.round(naturalDims.w * factor);
    const h = Math.round(naturalDims.h * factor);
    
    setTargetWidth(w);
    setTargetHeight(h);
    
    const aspect = w / h;
    const newCrop = initCrop(imageRef.width, imageRef.height, aspect);
    setCrop(newCrop);
    setCompletedCrop(convertToPixelCrop(newCrop, imageRef.width, imageRef.height));
  };

  const handleDownload = async () => {
    if (!completedCrop || !imageRef || !targetWidth || !targetHeight) return;

    try {
      setIsProcessing(true);
      const blob = await getCroppedResizedImage(
        imageRef,
        completedCrop,
        targetWidth,
        targetHeight
      );
      
      if (blob) {
        downloadBlob(blob, `cropped-${targetWidth}x${targetHeight}.png`);
      }
    } catch (err) {
      console.error('Failed to crop image', err);
      alert('Failed to crop and resize the image.');
    } finally {
      setIsProcessing(false);
    }
  };

  const resetState = () => {
    setImageSrc('');
    setImageName('');
    setImageRef(null);
    setCompletedCrop(null);
    setOriginalWidth(0);
    setOriginalHeight(0);
    setIsLockToCrop(false);
    setSelectedPreset('custom');
  };

  // Get current scaling status
  const scalingStats = getScalingStats();

  function getScalingStats() {
    const naturalDims = getCropNaturalDimensions();
    if (!naturalDims || !targetWidth || !targetHeight) return null;
    
    const factorX = targetWidth / naturalDims.w;
    
    const factor = factorX; // scale factor
    
    let type: 'original' | 'upscale' | 'downscale' = 'original';
    if (factor > 1.01) {
      type = 'upscale';
    } else if (factor < 0.99) {
      type = 'downscale';
    }
    
    return {
      factor,
      type,
      cropW: naturalDims.w,
      cropH: naturalDims.h
    };
  }

  return (
    <div className="app-container">
      <header className="header">
        <h1>Precision Cropper</h1>
        <p>Perfectly crop and resize your images to any dimension</p>
      </header>

      <main className="main-content">
        {/* Settings Panel */}
        <aside className="panel settings-group">
          {imageSrc && originalWidth > 0 && (
            <div className="source-info-card">
              <div className="info-card-title">
                <ImageIcon size={16} />
                <span>Source Image</span>
              </div>
              <div className="info-card-detail">
                <div className="info-filename" title={imageName}>{imageName || 'unnamed_image'}</div>
                <div className="info-resolution">{originalWidth} × {originalHeight} px</div>
              </div>
            </div>
          )}

          <div className="panel-title">
            <Scissors size={20} className="text-accent" />
            <span>Target Dimensions</span>
          </div>

          <div className="lock-crop-option">
            <label className="checkbox-container">
              <input
                type="checkbox"
                checked={isLockToCrop}
                onChange={(e) => setIsLockToCrop(e.target.checked)}
              />
              <span className="checkbox-label">Match crop pixel size (1:1)</span>
            </label>
          </div>
          
          <div className="input-row">
            <div className="input-group">
              <label htmlFor="width">Width (px)</label>
              <input
                id="width"
                type="number"
                min="1"
                disabled={isLockToCrop}
                value={targetWidth || ''}
                onChange={handleWidthChange}
                className="input-field"
                placeholder="e.g. 1080"
              />
            </div>

            <div className="input-group">
              <label htmlFor="height">Height (px)</label>
              <input
                id="height"
                type="number"
                min="1"
                disabled={isLockToCrop}
                value={targetHeight || ''}
                onChange={handleHeightChange}
                className="input-field"
                placeholder="e.g. 1080"
              />
            </div>
          </div>

          {!isLockToCrop && (
            <>
              <div className="presets-section">
                <label className="section-label">Presets</label>
                <div className="presets-grid">
                  <button
                    onClick={() => applyPreset('original')}
                    className={`btn-preset ${selectedPreset === 'original' ? 'active' : ''}`}
                    disabled={!imageSrc}
                  >
                    Original Ratio
                  </button>
                  <button
                    onClick={() => applyPreset('square')}
                    className={`btn-preset ${selectedPreset === 'square' ? 'active' : ''}`}
                    disabled={!imageSrc}
                  >
                    1:1 Square (1080p)
                  </button>
                  <button
                    onClick={() => applyPreset('landscape')}
                    className={`btn-preset ${selectedPreset === 'landscape' ? 'active' : ''}`}
                    disabled={!imageSrc}
                  >
                    16:9 Landscape (1080p)
                  </button>
                  <button
                    onClick={() => applyPreset('portrait')}
                    className={`btn-preset ${selectedPreset === 'portrait' ? 'active' : ''}`}
                    disabled={!imageSrc}
                  >
                    9:16 Portrait (1080p)
                  </button>
                </div>
              </div>

              <div className="scale-modifiers-section">
                <label className="section-label">Quick Scale Crop</label>
                <div className="scale-buttons-row">
                  <button
                    onClick={() => applyScaleFactor(0.5)}
                    className="btn-scale"
                    disabled={!completedCrop}
                    title="Scale output to 50% of the cropped region's original size"
                  >
                    0.5x
                  </button>
                  <button
                    onClick={() => applyScaleFactor(1.0)}
                    className="btn-scale"
                    disabled={!completedCrop}
                    title="Scale output to 100% of the cropped region's original size"
                  >
                    1.0x
                  </button>
                  <button
                    onClick={() => applyScaleFactor(1.5)}
                    className="btn-scale"
                    disabled={!completedCrop}
                    title="Scale output to 150% of the cropped region's original size"
                  >
                    1.5x
                  </button>
                  <button
                    onClick={() => applyScaleFactor(2.0)}
                    className="btn-scale"
                    disabled={!completedCrop}
                    title="Scale output to 200% of the cropped region's original size"
                  >
                    2.0x
                  </button>
                </div>
              </div>
            </>
          )}

          {scalingStats && (
            <div className="scaling-info-panel">
              <div className="scaling-badge-row">
                <span className="info-label">Scaling Status:</span>
                {scalingStats.type === 'original' && (
                  <span className="badge badge-original">Original (1:1)</span>
                )}
                {scalingStats.type === 'upscale' && (
                  <span className="badge badge-upscale" title="Image quality will be stretched/lossy">
                    Upscaling ({scalingStats.factor.toFixed(2)}x)
                  </span>
                )}
                {scalingStats.type === 'downscale' && (
                  <span className="badge badge-downscale" title="Image will be resized cleanly to a smaller size">
                    Downscaling ({scalingStats.factor.toFixed(2)}x)
                  </span>
                )}
              </div>
              <div className="scaling-details">
                <div className="scaling-detail-row">
                  <span>Selected Crop:</span>
                  <strong>{scalingStats.cropW} × {scalingStats.cropH} px</strong>
                </div>
                <div className="scaling-detail-row">
                  <span>Output Size:</span>
                  <strong>{targetWidth} × {targetHeight} px</strong>
                </div>
              </div>
            </div>
          )}

          <div className="ratio-display">
            Ratio: {aspectRatio ? aspectRatio.toFixed(2) : '-'} : 1
          </div>

          <div style={{ marginTop: 'auto', paddingTop: '24px' }}>
            <button
              onClick={handleDownload}
              disabled={!completedCrop || !imageSrc || !targetWidth || !targetHeight || isProcessing}
              className="btn btn-primary"
            >
              <Download size={18} />
              {isProcessing ? 'Processing...' : 'Download Image'}
            </button>
            
            {imageSrc && (
              <button
                onClick={resetState}
                className="btn btn-secondary"
                style={{ marginTop: '12px' }}
              >
                <RefreshCw size={18} />
                Start Over
              </button>
            )}
          </div>
        </aside>

        {/* Main Editor Area */}
        <section className="editor-area">
          {!imageSrc ? (
            <ImageUploader onImageSelected={(src, name) => {
              setImageSrc(src);
              setImageName(name);
            }} />
          ) : (
            <CropperArea
              imageSrc={imageSrc}
              aspectRatio={aspectRatio}
              onImageLoad={onImageLoad}
              crop={crop}
              setCrop={setCrop}
              setCompletedCrop={setCompletedCrop}
            />
          )}
        </section>
      </main>
    </div>
  );
}

export default App;
