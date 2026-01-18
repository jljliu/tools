import React, { useState, useEffect } from 'react'
import { Upload, FileVideo, Settings, Play, X, MonitorPlay } from 'lucide-react'

// Types for file status
type FileStatus = 'idle' | 'converting' | 'completed' | 'error';

interface VideoFile {
  path: string;
  name: string;
  status: FileStatus;
  progress?: number;
}

function App() {
  const [files, setFiles] = useState<VideoFile[]>([])
  const [dragActive, setDragActive] = useState(false)
  const [format, setFormat] = useState('mp4')
  const [hwAccel, setHwAccel] = useState(true)
  const [codec, setCodec] = useState('auto')
  const [resolution, setResolution] = useState('original')
  const [bitrate, setBitrate] = useState('')
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0


  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const newFiles = Array.from(e.dataTransfer.files).map(file => ({
        path: (file as any).path, // Electron adds path property
        name: file.name,
        status: 'idle' as FileStatus
      }))
      setFiles(prev => [...prev, ...newFiles])
    }
  }

  const removeFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index))
  }

  const startConversion = () => {
    // Send to main process
    files.forEach((file, index) => {
      if (file.status === 'idle') {
        window.ipcRenderer.send('transcode-file', {
          filePath: file.path,
          format,
          id: index,
          hwAccel,
          codec,
          resolution,
          bitrate
        })
        setFiles(prev => prev.map((f, i) => i === index ? { ...f, status: 'converting', progress: 0 } : f))
      }
    })
  }

  useEffect(() => {
    const removeProgress = window.ipcRenderer.on('conversion-progress', (_event, { id, progress }) => {
      setFiles(prev => prev.map((f, i) => i === id ? { ...f, progress: Math.round(progress) } : f))
    })

    const removeComplete = window.ipcRenderer.on('conversion-complete', (_event, { id }) => {
      setFiles(prev => prev.map((f, i) => i === id ? { ...f, status: 'completed', progress: 100 } : f))
    })

    const removeError = window.ipcRenderer.on('conversion-error', (_event, { id, error }) => {
      setFiles(prev => prev.map((f, i) => i === id ? { ...f, status: 'error' } : f))
      console.error(`Error converting file ${id}:`, error)
    })

    return () => {
      removeProgress()
      removeComplete()
      removeError()
    }
  }, [])

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col p-6 font-sans">
      {/* Header */}
      <header className="flex justify-between items-center mb-8 draggable">
        <div className="flex items-center space-x-2">
          <MonitorPlay className="w-6 h-6 text-blue-500" />
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">Antigravity FFMPEG</h1>
        </div>
        <div className="p-2 hover:bg-gray-800 rounded-full cursor-pointer no-drag">
          <Settings className="w-5 h-5 text-gray-400" />
        </div>
      </header>

      {/* Drop Zone */}
      <div
        className={`border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center mb-6 transition-all duration-300 ${dragActive ? 'border-blue-500 bg-blue-500/10 scale-[1.02]' : 'border-gray-700 hover:border-gray-600'}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <Upload className={`w-12 h-12 text-gray-500 mb-4 transition-transform duration-300 ${dragActive ? 'scale-110 text-blue-400' : ''}`} />
        <p className="text-lg text-gray-300">Drag and drop video files here</p>
        <p className="text-sm text-gray-500 mt-2">Supports MKV, AVI, MOV, and more</p>
      </div>

      {/* File List */}
      <div className="flex-1 overflow-y-auto space-y-3 mb-4">
        {files.length === 0 && (
          <div className="text-center text-gray-600 mt-10">
            No files selected
          </div>
        )}
        {files.map((file, idx) => (
          <div key={idx} className="bg-gray-800 rounded-xl p-4 flex items-center justify-between border border-gray-700">
            <div className="flex items-center space-x-4">
              <FileVideo className="w-6 h-6 text-blue-400" />
              <div>
                <p className="font-medium text-sm">{file.name}</p>
                <p className="text-xs text-gray-500 capitalize">{file.status}</p>
              </div>
            </div>
            {file.status === 'converting' && (
              <div className="w-24 bg-gray-700 h-1.5 rounded-full overflow-hidden mx-4">
                <div className="bg-blue-500 h-full transition-all duration-500" style={{ width: `${file.progress || 0}%` }} />
              </div>
            )}
            <button onClick={() => removeFile(idx)} className="p-1 hover:bg-gray-700 rounded-full text-gray-400 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="mt-auto pt-6 border-t border-gray-800 flex items-center justify-between">
        <div className="flex items-center space-x-3 bg-gray-800 p-2 rounded-lg">
          <span className="text-xs text-gray-400 font-medium px-2">Format</span>
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value)}
            className="bg-gray-700 text-sm border-none rounded px-3 py-1 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            <option value="mp4">MP4 (H.264)</option>
            <option value="mov">MOV (ProRes)</option>
            <option value="webm">WebM</option>
            <option value="gif">GIF</option>
            <option value="mp3">MP3 (Audio)</option>
          </select>
        </div>
        {isMac && (['mp4', 'mov'].includes(format)) && (
          <div className="flex items-center space-x-2 bg-gray-800 p-2 rounded-lg">
            <input
              type="checkbox"
              id="hwAccel"
              checked={hwAccel}
              onChange={(e) => setHwAccel(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 bg-gray-700 border-gray-600"
            />
            <label htmlFor="hwAccel" className="text-xs text-gray-300 cursor-pointer">Hardware Accel</label>
          </div>
        )}

        <div className="flex items-center space-x-3 bg-gray-800 p-2 rounded-lg">
          <span className="text-xs text-gray-400 font-medium px-2">Codec</span>
          <select
            value={codec}
            onChange={(e) => setCodec(e.target.value)}
            className="bg-gray-700 text-sm border-none rounded px-3 py-1 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            disabled={!['mp4', 'mov', 'mkv'].includes(format)}
          >
            <option value="auto">Auto</option>
            <option value="h264">H.264</option>
            <option value="hevc">H.265 (HEVC)</option>
          </select>
        </div>

        <div className="flex items-center space-x-3 bg-gray-800 p-2 rounded-lg">
          <span className="text-xs text-gray-400 font-medium px-2">Res</span>
          <select
            value={resolution}
            onChange={(e) => setResolution(e.target.value)}
            className="bg-gray-700 text-sm border-none rounded px-3 py-1 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            disabled={['mp3'].includes(format)}
          >
            <option value="original">Original</option>
            <option value="3840x2160">4K</option>
            <option value="1920x1080">1080p</option>
            <option value="1280x720">720p</option>
            <option value="854x480">480p</option>
          </select>
        </div>

        <div className="flex items-center space-x-3 bg-gray-800 p-2 rounded-lg">
          <span className="text-xs text-gray-400 font-medium px-2">Bitrate (k)</span>
          <input
            type="number"
            value={bitrate}
            onChange={(e) => setBitrate(e.target.value)}
            placeholder="Auto"
            className="bg-gray-700 text-sm border-none rounded px-3 py-1 text-white w-20 focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={['gif'].includes(format)}
          />
        </div>

        <button
          onClick={startConversion}
          className={`bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-xl font-medium flex items-center space-x-2 transition-all shadow-lg shadow-blue-900/20 active:scale-95 ${files.length === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-blue-500/20'}`}
          disabled={files.length === 0 || files.every(f => f.status === 'completed')}
        >
          <Play className="w-4 h-4 fill-current" />
          <span>Start Conversion</span>
        </button>
      </div>
    </div>
  )
}

export default App
