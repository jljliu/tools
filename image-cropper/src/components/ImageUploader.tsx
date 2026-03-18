import React, { useCallback, useState } from 'react';
import { UploadCloud } from 'lucide-react';

interface ImageUploaderProps {
  onImageSelected: (src: string) => void;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({ onImageSelected }) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleFile = (file: File) => {
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.addEventListener('load', () => {
        onImageSelected(reader.result?.toString() || '');
      });
      reader.readAsDataURL(file);
    }
  };

  const onDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  }, []);

  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFile(e.target.files[0]);
    }
  };

  return (
    <div
      className={`upload-zone ${isDragging ? 'drag-active' : ''}`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={() => document.getElementById('file-upload')?.click()}
    >
      <UploadCloud className="upload-icon" />
      <div className="upload-text">Drop your image here</div>
      <div className="upload-hint">or click to browse from your computer</div>
      <input
        id="file-upload"
        type="file"
        accept="image/*"
        onChange={onFileInput}
        style={{ display: 'none' }}
      />
    </div>
  );
};
