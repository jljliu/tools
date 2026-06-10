import { useState, useEffect } from 'react';
import { 
  FileText, 
  Settings, 
  Download, 
  Sparkles, 
  Calculator, 
  HelpCircle, 
  RefreshCw, 
  Sliders, 
  Coins, 
  Eye, 
  ChevronRight,
  Printer
} from 'lucide-react';
import { GENERATORS } from './utils/generators';
import type { GeneratorItem, GeneratorConfig } from './utils/generators';
import PDFDocument from 'pdfkit/js/pdfkit.standalone';
import blobStream from 'blob-stream';

export default function App() {
  const [activeGenerator, setActiveGenerator] = useState<GeneratorItem>(GENERATORS[0]);
  const [config, setConfig] = useState<GeneratorConfig>({ ...GENERATORS[0].defaultConfig });
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState<boolean>(false);
  const [fontBuffer, setFontBuffer] = useState<ArrayBuffer | null>(null);
  const [loadingFont, setLoadingFont] = useState<boolean>(true);
  const [sampleQuestions, setSampleQuestions] = useState<string[]>([]);

  // Category mapping for sidebar filtering
  const categories = Array.from(new Set(GENERATORS.map(g => g.category)));

  // Load Chinese font on mount to support CNY and Chinese Word problems
  useEffect(() => {
    fetch('./NotoSansSC-VariableFont_wght.ttf')
      .then(res => {
        if (!res.ok) throw new Error("Font fetch failed");
        return res.arrayBuffer();
      })
      .then(buf => {
        setFontBuffer(buf);
        setLoadingFont(false);
      })
      .catch(err => {
        console.error("Failed to load Chinese font NotoSansSC, falling back to default PDF fonts:", err);
        setLoadingFont(false);
      });
  }, []);

  // Update configuration when active generator changes
  useEffect(() => {
    setConfig({ ...activeGenerator.defaultConfig });
    // Reset PDF preview until user hits generate
    setPdfUrl(null);
    // Generate simple sample preview questions (first 5 questions)
    setSampleQuestions(activeGenerator.generateQuestions(5));
  }, [activeGenerator]);

  const handleConfigChange = (key: keyof GeneratorConfig, value: number) => {
    setConfig(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const regenerateSample = () => {
    setSampleQuestions(activeGenerator.generateQuestions(5));
  };

  const generatePDF = () => {
    setGenerating(true);
    // Reset previous URL to avoid memory leaks
    if (pdfUrl) {
      URL.revokeObjectURL(pdfUrl);
      setPdfUrl(null);
    }

    try {
      // Initialize PDFKit document (Letter size, no margins because we customize column spacing)
      const doc = new PDFDocument({ size: 'letter', margin: 0 });
      const stream = doc.pipe(blobStream());

      // Register custom Chinese font if loaded
      if (fontBuffer) {
        doc.registerFont('NotoSansSC', fontBuffer);
        doc.font('NotoSansSC');
      }

      const { numberOfQuestions, pageCount, columns, fontSize, rowSpacing } = config;

      for (let i = 0; i < pageCount; i++) {
        // Generate unique questions for the page
        const pageQuestions = activeGenerator.generateQuestions(numberOfQuestions);

        if (activeGenerator.id === 'mixed_0_to_10000') {
          // Custom 2 cols x 3 rows grid layout matching mixed_0_to_10000.js
          const rows = 3;
          const startX = 20;
          const startY = 20;
          const columnWidth = 240;
          const columnGap = 30;
          const rowGap = 270;

          pageQuestions.forEach((question, index) => {
            const col = Math.floor(index / rows);
            const row = index % rows;
            const x = startX + col * (columnWidth + columnGap);
            const y = startY + row * rowGap;
            doc.fontSize(fontSize).text(question, x, y);
          });
        } else {
          // Standard columns layout
          const columnLength = Math.ceil(pageQuestions.length / columns);
          const startX = (activeGenerator.id === 'mixed_div_rem_add_sub') ? 20 : 50;
          const startY = (activeGenerator.id === 'mixed_div_rem_add_sub') ? 20 : 50;
          const columnWidth = columns === 3 
            ? (activeGenerator.id === 'mixed_div_rem_add_sub' ? 200 : 180) 
            : columns === 2 ? 270 : 500;
          const columnGap = 0;

          let x = startX;
          let y = startY;

          pageQuestions.forEach((question, index) => {
            if (index !== 0 && index % columnLength === 0) {
              x += columnWidth + columnGap;
              y = startY;
            }
            doc.fontSize(fontSize).text(question, x, y);
            y += rowSpacing;
          });
        }

        // Add page break if not on the last page
        if (i !== pageCount - 1) {
          doc.addPage();
        }
      }

      doc.end();

      stream.on('finish', () => {
        const url = stream.toBlobURL('application/pdf');
        setPdfUrl(url);
        setGenerating(false);
      });

    } catch (error) {
      console.error("Failed to generate PDF document:", error);
      setGenerating(false);
    }
  };

  const downloadPDF = () => {
    if (!pdfUrl) return;
    const link = document.createElement('a');
    link.href = pdfUrl;
    link.download = `${activeGenerator.id}_worksheet.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'Addition':
        return <Sparkles size={16} />;
      case 'Subtraction':
        return <Calculator size={16} />;
      case 'Mixed':
        return <Sliders size={16} />;
      case 'CNY Money':
        return <Coins size={16} />;
      default:
        return <HelpCircle size={16} />;
    }
  };

  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <div className="brand-section">
          <Printer className="brand-icon" size={32} />
          <div className="brand-title">
            <h1>Math PDF Generator</h1>
            <p>Generate clean, printable math worksheets instantly</p>
          </div>
        </div>
        
        {/* Font Loading Status */}
        <div className={`font-badge ${loadingFont ? 'loading' : ''}`}>
          {loadingFont ? (
            <>
              <RefreshCw className="spinner" size={12} />
              <span>Loading Chinese Font...</span>
            </>
          ) : (
            <>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} />
              <span>Chinese Font Active</span>
            </>
          )}
        </div>
      </header>

      {/* Main Layout Grid */}
      <div className="main-grid">
        
        {/* Sidebar: Generator List */}
        <aside className="glass-panel sidebar">
          <h2>Question Sheets</h2>
          
          {categories.map(category => (
            <div key={category} className="category-group">
              <div className="category-title">{category}</div>
              <div className="generator-list">
                {GENERATORS.filter(g => g.category === category).map(gen => (
                  <button
                    key={gen.id}
                    className={`generator-item ${activeGenerator.id === gen.id ? 'active' : ''}`}
                    onClick={() => setActiveGenerator(gen)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {getCategoryIcon(category)}
                      <span className="generator-name">{gen.name}</span>
                    </div>
                    <span className="generator-desc">{gen.description}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </aside>

        {/* Workspace: Config and Preview */}
        <main className="workspace">
          
          {/* Controls & Configuration */}
          <section className="glass-panel controls-panel">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#c084fc' }}>
              <Settings size={20} />
              <h2 className="panel-title">Configuration</h2>
            </div>
            <p className="panel-desc">Customize layout parameters and document properties</p>

            <div className="config-section">
              <div className="form-group">
                <label>Questions per Page</label>
                <input 
                  type="number" 
                  value={config.numberOfQuestions}
                  min={1}
                  max={100}
                  onChange={(e) => handleConfigChange('numberOfQuestions', parseInt(e.target.value) || 1)}
                />
              </div>

              <div className="form-group">
                <label>Page Count</label>
                <input 
                  type="number" 
                  value={config.pageCount}
                  min={1}
                  max={100}
                  onChange={(e) => handleConfigChange('pageCount', parseInt(e.target.value) || 1)}
                />
              </div>

              <div className="form-group">
                <label>Columns Layout</label>
                <input 
                  type="number" 
                  value={config.columns}
                  min={1}
                  max={5}
                  onChange={(e) => handleConfigChange('columns', parseInt(e.target.value) || 1)}
                />
              </div>

              <div className="form-group">
                <label>Font Size (pt)</label>
                <input 
                  type="number" 
                  value={config.fontSize}
                  min={8}
                  max={72}
                  onChange={(e) => handleConfigChange('fontSize', parseInt(e.target.value) || 8)}
                />
              </div>

              <div className="form-group">
                <label>Row Spacing (Line height)</label>
                <input 
                  type="number" 
                  value={config.rowSpacing}
                  min={10}
                  max={500}
                  onChange={(e) => handleConfigChange('rowSpacing', parseInt(e.target.value) || 10)}
                />
              </div>
            </div>

            {/* Questions Sample Preview */}
            <div className="sample-preview">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span className="sample-title">Sample Problems Preview</span>
                <button 
                  onClick={regenerateSample}
                  style={{ background: 'none', border: 'none', color: '#60a5fa', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                >
                  <RefreshCw size={10} /> Refresh
                </button>
              </div>
              <div className="sample-questions">
                {sampleQuestions.map((q, idx) => (
                  <div key={idx} className="sample-question-item">
                    {idx + 1}. {q}
                  </div>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="action-buttons">
              <button 
                className="btn btn-primary"
                onClick={generatePDF}
                disabled={generating}
              >
                {generating ? (
                  <>
                    <RefreshCw className="spinner" size={16} />
                    Generating PDF...
                  </>
                ) : (
                  <>
                    <Eye size={16} />
                    Generate & Preview
                  </>
                )}
              </button>

              <button 
                className="btn btn-secondary"
                onClick={downloadPDF}
                disabled={!pdfUrl}
              >
                <Download size={16} />
                Download PDF
              </button>
            </div>
          </section>

          {/* Live Preview Display */}
          <section className="glass-panel preview-panel">
            <div className="preview-header">
              <h3>Interactive PDF Preview</h3>
              {pdfUrl && (
                <span style={{ fontSize: '0.75rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <ChevronRight size={12} /> Ready to print
                </span>
              )}
            </div>

            <div className="preview-container">
              {pdfUrl ? (
                <iframe 
                  className="preview-iframe"
                  src={pdfUrl}
                  title="PDF Document Preview"
                />
              ) : (
                <div className="placeholder-view">
                  <FileText className="placeholder-icon" />
                  <h4>No PDF Generated</h4>
                  <p>Adjust settings and click "Generate & Preview" to build the PDF document worksheet.</p>
                </div>
              )}
            </div>
          </section>

        </main>
      </div>
    </div>
  );
}
