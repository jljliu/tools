import React, { useState, useCallback } from 'react';
import { type Crop, type PixelCrop } from 'react-image-crop';
import { Download, RefreshCw, Scissors } from 'lucide-react';
import { ImageUploader } from './components/ImageUploader';
import { CropperArea, initCrop } from './components/CropperArea';
import { getCroppedResizedImage, downloadBlob } from './utils/imageOperations';

function App() {
  const [imageSrc, setImageSrc] = useState<string>('');
  const [imageRef, setImageRef] = useState<HTMLImageElement | null>(null);
  
  const [targetWidth, setTargetWidth] = useState<number>(1080);
  const [targetHeight, setTargetHeight] = useState<number>(1080);

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
  }, []);

  const handleWidthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    if (!isNaN(val) && val > 0) {
      setTargetWidth(val);
      if (imageRef) {
        setCrop(initCrop(imageRef.width, imageRef.height, val / targetHeight));
      }
    } else if (e.target.value === '') {
      setTargetWidth(0 as any); // allow clearing input temporarily
    }
  };

  const handleHeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    if (!isNaN(val) && val > 0) {
      setTargetHeight(val);
      if (imageRef) {
        setCrop(initCrop(imageRef.width, imageRef.height, targetWidth / val));
      }
    } else if (e.target.value === '') {
      setTargetHeight(0 as any);
    }
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
    setImageRef(null);
    setCompletedCrop(null);
  };

  return (
    <div className="app-container">
      <header className="header">
        <h1>Precision Cropper</h1>
        <p>Perfectly crop and resize your images to any dimension</p>
      </header>

      <main className="main-content">
        {/* Settings Panel */}
        <aside className="panel settings-group">
          <div className="panel-title">
            <Scissors size={20} className="text-accent" />
            <span>Target Dimensions</span>
          </div>
          
          <div className="input-group">
            <label htmlFor="width">Width (px)</label>
            <div className="number-input-wrp">
              <input
                id="width"
                type="number"
                min="1"
                value={targetWidth || ''}
                onChange={handleWidthChange}
                className="input-field"
                placeholder="e.g. 1080"
              />
            </div>
          </div>

          <div className="input-group">
            <label htmlFor="height">Height (px)</label>
            <div className="number-input-wrp">
              <input
                id="height"
                type="number"
                min="1"
                value={targetHeight || ''}
                onChange={handleHeightChange}
                className="input-field"
                placeholder="e.g. 1080"
              />
            </div>
          </div>

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
            <ImageUploader onImageSelected={setImageSrc} />
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
