import React, { useRef } from 'react';
import ReactCrop, { type Crop, type PixelCrop } from 'react-image-crop';
import { initCrop } from '../utils/imageOperations';
import 'react-image-crop/dist/ReactCrop.css';

interface CropperAreaProps {
  imageSrc: string;
  aspectRatio: number;
  onImageLoad: (img: HTMLImageElement) => void;
  crop: Crop;
  setCrop: (crop: Crop) => void;
  setCompletedCrop: (crop: PixelCrop) => void;
}

export const CropperArea: React.FC<CropperAreaProps> = ({
  imageSrc,
  aspectRatio,
  onImageLoad,
  crop,
  setCrop,
  setCompletedCrop
}) => {
  const imgRef = useRef<HTMLImageElement>(null);

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    if (aspectRatio) {
      const initialCrop = initCrop(width, height, aspectRatio);
      setCrop(initialCrop);
    }
    onImageLoad(e.currentTarget);
  };

  return (
    <div className="crop-container">
      <ReactCrop
        crop={crop}
        onChange={(_, percentCrop) => setCrop(percentCrop)}
        onComplete={(c) => setCompletedCrop(c)}
        aspect={aspectRatio}
        className="crop-wrapper"
      >
        <img
          ref={imgRef}
          src={imageSrc}
          alt="Crop preview"
          onLoad={handleImageLoad}
          className="ReactCrop__image"
        />
      </ReactCrop>
      <div className="info-text">
        Drag to adjust the crop area. It is locked to your target dimension's aspect ratio.
      </div>
    </div>
  );
};
