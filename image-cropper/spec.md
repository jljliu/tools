# Spec: Precision Cropper

A client-side web application designed to allow users to crop images with locked aspect ratios and resize/scale the output resolution cleanly (both upscaling and downscaling).

## Tech Stack
- **Framework**: React 19 + TypeScript + Vite
- **Cropping Engine**: `react-image-crop`
- **Icon Library**: `lucide-react`
- **Styling**: Vanilla CSS (specifically `index.css`)

## Core Features

### 1. Locked Aspect Ratio Cropping
- Crop area is locked to the aspect ratio of the user's desired target dimensions (`targetWidth / targetHeight`).
- Drag-and-resize interface via standard HTML canvas/react-image-crop bindings.

### 2. Resolution Scaling & Modes
- **Match Crop Size (1:1)**: Disables custom target dimensions and outputs the crop at its exact pixel resolution in the source image.
- **Custom Target Resolution**: Allows the user to specify custom dimensions. Automatically upscales or downscales the cropped area to match.
- **Quick Scale modifiers**: Quickly scale the output resolution to `0.5x`, `1.0x`, `1.5x`, or `2.0x` of the cropped region's original size.

### 3. Smart State Synchronization
- Programmatic changes to target dimensions (presets, scaling, manual input) automatically update the `completedCrop` using `convertToPixelCrop` to prevent aspect ratio distortion upon download.
- Initial load automatically sets target dimensions to the source image's original dimensions and centers the crop.

### 4. Real-time Feedback & Badges
- **Source Image details**: Displays file name and original resolution.
- **Scaling Badge**: Displays the current scaling status and factor:
  - `Original (1:1)` - Output resolution matches cropped area resolution.
  - `Upscaling (xN.NN)` - Output resolution is larger than source crop (lossy/interpolation).
  - `Downscaling (xN.NN)` - Output resolution is smaller than source crop (sharp).

## Component Architecture

- [App.tsx](file:///Users/jinyanliu/code/tools/image-cropper/src/App.tsx): Manages the main workspace state, inputs, presets, scaling factor math, and layout.
- [CropperArea.tsx](file:///Users/jinyanliu/code/tools/image-cropper/src/components/CropperArea.tsx): Wraps `react-image-crop` and updates crop dimensions.
- [ImageUploader.tsx](file:///Users/jinyanliu/code/tools/image-cropper/src/components/ImageUploader.tsx): Manages drag-and-drop or file system browsing for images.
- [imageOperations.ts](file:///Users/jinyanliu/code/tools/image-cropper/src/utils/imageOperations.ts): Canvas operations for cropping, resizing, and download triggering.
