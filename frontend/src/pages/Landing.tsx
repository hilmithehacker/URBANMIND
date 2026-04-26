import { Link } from 'react-router-dom'
import { Brain, Zap, Target, Layers, ArrowRight, LayoutDashboard, Database, Map } from 'lucide-react'

export default function Landing() {
  return (
    <div className="landing-page">
      {/* Navbar */}
      <nav className="landing-nav glass-panel">
        <div className="nav-container">
          <div className="nav-logo">
            <img src="/logo.png" alt="UrbanMind Logo" className="logo-img" />
          </div>
          <div className="nav-actions">
            <Link to="/dashboard" className="btn-primary btn-sm glow-accent" style={{ borderRadius: 30 }}>
              Dashboard <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <header className="hero">
        <div className="hero-content">
          <div className="hero-badge glow-purple">
            <span className="badge-dot"></span> UrbanMind v2.0 Live
          </div>
          <h1 className="hero-title">
            The Future of <br />
            <span className="text-gradient">Urban Planning AI</span>
          </h1>
          <p className="hero-subtitle">
            Platform superapp terintegrasi untuk mahasiswa dan profesional Perencanaan Wilayah dan Kota. 
            Didukung Orkestrasi AI yang cerdas, cepat, dan presisi tinggi.
          </p>
          <div className="hero-cta">
            <Link to="/dashboard" className="btn-primary btn-lg glow-gradient">
              Mulai Eksplorasi <ArrowRight size={18} />
            </Link>
            <a href="#features" className="btn-ghost btn-lg" style={{ color: 'var(--text-secondary)' }}>
              Pelajari Lebih Lanjut
            </a>
          </div>
        </div>
        
        {/* Abstract 3D/Visual Elements */}
        <div className="hero-visual-wrapper">
          <div className="hero-visual glass-panel">
            <div className="visual-header">
              <div className="c-dots">
                <div className="c-dot red"></div><div className="c-dot yellow"></div><div className="c-dot green"></div>
              </div>
              <div className="visual-title">ai_orchestrator.ts</div>
            </div>
            <div className="visual-code">
              <pre className="code-text">
                <span className="c-keyword">import</span> {'{'} <span className="c-class">UrbanAI</span> {'}'} <span className="c-keyword">from</span> <span className="c-str">'@urbanmind/core'</span>;<br/><br/>
                <span className="c-keyword">const</span> <span className="c-var">analysis</span> = <span className="c-keyword">await</span> <span className="c-class">UrbanAI</span>.<span className="c-func">generatePlan</span>({'{'}<br/>
                &nbsp;&nbsp;location: <span className="c-str">"Jakarta"</span>,<br/>
                &nbsp;&nbsp;modules: [<span className="c-str">"TOD"</span>, <span className="c-str">"Spatial"</span>],<br/>
                &nbsp;&nbsp;ensembleMode: <span className="c-bool">true</span><br/>
                {'}'});<br/><br/>
                <span className="c-func">renderDiagram</span>(<span className="c-var">analysis</span>.architecture);
              </pre>
            </div>
          </div>
          {/* Glowing Orbs */}
          <div className="orb orb-1"></div>
          <div className="orb orb-2"></div>
        </div>
      </header>

      {/* Value Proposition */}
      <section id="features" className="features-section">
        <h2 className="section-title text-center">Kenapa UrbanMind?</h2>
        <div className="features-grid">
          <div className="feature-card glass-panel hover-glow-purple">
            <div className="f-icon bg-purple"><Zap size={24} color="#C4B5FD" /></div>
            <h3>Performa Kilat (&lt;10s)</h3>
            <p>Orkestrasi AI terdistribusi memastikan hasil analisis kompleks keluar dalam hitungan detik tanpa bottleneck.</p>
          </div>
          <div className="feature-card glass-panel hover-glow-accent">
            <div className="f-icon bg-accent"><Brain size={24} color="#93C5FD" /></div>
            <h3>Analisis Mendalam</h3>
            <p>Model AI khusus PWK yang dilatih untuk memahami regulasi, standar SNI, dan kaidah tata ruang Indonesia.</p>
          </div>
          <div className="feature-card glass-panel hover-glow-success">
            <div className="f-icon bg-success"><Target size={24} color="#86EFAC" /></div>
            <h3>Output Terstruktur</h3>
            <p>Tidak ada format berantakan. Semua hasil selalu disajikan dalam tabel, poin-poin, dan diagram Mermaid.</p>
          </div>
        </div>
      </section>

      {/* Workflow Explanation */}
      <section className="workflow-section glass-panel">
        <div className="workflow-content">
          <h2>Alur Perencanaan End-to-End</h2>
          <p>Mulai dari identifikasi masalah hingga perumusan indikasi program secara berurutan dan persisten.</p>
          <div className="workflow-steps">
            <div className="w-step"><div className="w-num">1</div><div className="w-text">Data Upload</div></div>
            <div className="w-step"><div className="w-num">2</div><div className="w-text">Spatial Analysis</div></div>
            <div className="w-step"><div className="w-num">3</div><div className="w-text">Strategic Synthesis</div></div>
            <div className="w-step"><div className="w-num">4</div><div className="w-text">Action Plan</div></div>
          </div>
        </div>
      </section>

      {/* Toolkit */}
      <section className="toolkit-section">
        <h2 className="section-title text-center">Toolkit Terintegrasi</h2>
        <div className="toolkit-grid">
          <div className="tool-item glass-panel">
            <LayoutDashboard size={36} className="text-purple" />
            <h4>AI Planning Workspace</h4>
          </div>
          <div className="tool-item glass-panel">
            <Database size={36} className="text-success" />
            <h4>Data Center & Pivot</h4>
          </div>
          <div className="tool-item glass-panel">
            <Map size={36} className="text-warning" />
            <h4>Spatial Map Composer</h4>
          </div>
          <div className="tool-item glass-panel">
            <Layers size={36} className="text-accent" />
            <h4>Academic Research</h4>
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <footer className="footer-cta">
        <div className="footer-content">
          <img src="/logo.png" alt="UrbanMind" style={{ height: 60, marginBottom: 30 }} />
          <h2>Siap mengubah cara Anda merencanakan kota?</h2>
          <Link to="/dashboard" className="btn-primary btn-lg glow-gradient mt-20" style={{ borderRadius: 30 }}>
            Masuk ke Dashboard <ArrowRight size={18} />
          </Link>
        </div>
        <div className="footer-bottom">
          &copy; 2026 UrbanMind. Plan • Analyze • Build Better Cities.
        </div>
      </footer>

      <style>{`
        .landing-page { background: #070A11; color: var(--text-primary); min-height: 100vh; overflow-x: hidden; font-family: 'Inter', sans-serif; position: relative; }
        
        /* Nav */
        .landing-nav { position: fixed; top: 24px; left: 50%; transform: translateX(-50%); width: calc(100% - 48px); max-width: 1200px; padding: 12px 24px; border-radius: 40px; z-index: 100; background: rgba(3, 5, 12, 0.6); border: 1px solid rgba(255,255,255,0.08); box-shadow: 0 10px 40px rgba(0,0,0,0.5); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); transition: all 0.4s ease; }
        .nav-container { display: flex; justify-content: space-between; align-items: center; }
        .logo-img { height: 36px; object-fit: contain; filter: drop-shadow(0 0 10px rgba(255,255,255,0.2)); }
        
        /* Hero */
        .hero { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; text-align: center; padding: 140px 20px 80px; position: relative; overflow: hidden; }
        .hero::before { content: ''; position: absolute; top: -20%; left: 50%; transform: translateX(-50%); width: 1000px; height: 1000px; background: radial-gradient(circle, rgba(56,189,248,0.2) 0%, rgba(192,132,252,0.1) 40%, transparent 70%); pointer-events: none; animation: pulseGlow 8s ease-in-out infinite alternate; }
        
        @keyframes pulseGlow { 0% { transform: translateX(-50%) scale(1); opacity: 0.8; } 100% { transform: translateX(-50%) scale(1.1); opacity: 1; } }
        
        .hero-content { max-width: 900px; z-index: 2; display: flex; flex-direction: column; align-items: center; }
        
        .hero-badge { display: inline-flex; align-items: center; gap: 10px; padding: 10px 24px; border-radius: 40px; font-size: 14px; font-weight: 800; background: rgba(192, 132, 252, 0.15); color: #e879f9; margin-bottom: 36px; border: 1px solid rgba(192, 132, 252, 0.4); backdrop-filter: blur(10px); box-shadow: 0 0 20px rgba(192, 132, 252, 0.3); }
        .badge-dot { width: 10px; height: 10px; background: var(--success); border-radius: 50%; box-shadow: 0 0 12px var(--success); animation: blink 2s infinite; }
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        
        .hero-title { font-size: clamp(56px, 7vw, 96px); font-weight: 900; line-height: 1.05; margin-bottom: 24px; letter-spacing: -3px; text-shadow: 0 10px 30px rgba(0,0,0,0.5); }
        .text-gradient { background: linear-gradient(135deg, #38bdf8, #818cf8, #c084fc, #e879f9); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-size: 300% 300%; animation: gradientShift 6s ease infinite; padding-bottom: 5px; filter: drop-shadow(0 0 20px rgba(56,189,248,0.3)); }
        
        @keyframes gradientShift { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
        
        .hero-subtitle { font-size: 20px; color: var(--text-secondary); max-width: 700px; margin-bottom: 48px; line-height: 1.8; text-shadow: 0 2px 10px rgba(0,0,0,0.5); }
        
        .hero-cta { display: flex; gap: 20px; align-items: center; justify-content: center; flex-wrap: wrap; }
        .btn-primary { display: inline-flex; align-items: center; gap: 10px; background: var(--text-primary); color: #03050c; font-weight: 800; border: none; cursor: pointer; text-decoration: none; transition: var(--transition); }
        .btn-primary:hover { transform: translateY(-3px) scale(1.02); }
        .btn-sm { padding: 10px 20px; font-size: 14px; }
        .btn-lg { padding: 20px 40px; font-size: 17px; border-radius: 40px; }
        .glow-gradient { background: linear-gradient(135deg, #38bdf8, #818cf8); color: white; box-shadow: 0 10px 30px rgba(56, 189, 248, 0.4); border: 1px solid rgba(255,255,255,0.2); }
        .glow-gradient:hover { box-shadow: 0 15px 40px rgba(56, 189, 248, 0.6); background: linear-gradient(135deg, #7dd3fc, #a5b4fc); }
        .glow-accent { background: linear-gradient(135deg, #38bdf8, #818cf8); color: white; box-shadow: 0 5px 20px rgba(56, 189, 248, 0.4); }
        
        .btn-ghost { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); text-decoration: none; font-weight: 700; padding: 20px 40px; border-radius: 40px; transition: var(--transition); backdrop-filter: blur(10px); }
        .btn-ghost:hover { background: rgba(255,255,255,0.1); color: white !important; border-color: rgba(255,255,255,0.3); transform: translateY(-3px); }
        
        .hero-visual-wrapper { position: relative; margin-top: 100px; width: 100%; max-width: 850px; perspective: 1200px; z-index: 2; }
        .hero-visual { background: rgba(13, 17, 30, 0.85); border-radius: var(--radius-xl); overflow: hidden; transform: rotateX(8deg) translateY(0); transition: transform 0.6s cubic-bezier(0.25, 1, 0.5, 1); box-shadow: 0 40px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.1); backdrop-filter: blur(20px); }
        .hero-visual-wrapper:hover .hero-visual { transform: rotateX(0deg) translateY(-15px); box-shadow: 0 50px 100px rgba(0,0,0,0.7), 0 0 0 1px rgba(56,189,248,0.4); }
        
        .visual-header { background: rgba(0,0,0,0.6); padding: 16px 24px; display: flex; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.08); }
        .c-dots { display: flex; gap: 8px; margin-right: 20px; }
        .c-dot { width: 14px; height: 14px; border-radius: 50%; }
        .c-dot.red { background: #fb7185; box-shadow: 0 0 10px #fb7185; } .c-dot.yellow { background: #facc15; box-shadow: 0 0 10px #facc15; } .c-dot.green { background: #4ade80; box-shadow: 0 0 10px #4ade80; }
        .visual-title { color: var(--text-secondary); font-size: 14px; font-family: monospace; font-weight: 600; letter-spacing: 0.5px; }
        
        .visual-code { text-align: left; padding: 40px; background: linear-gradient(180deg, rgba(255,255,255,0.02) 0%, transparent 100%); }
        .code-text { font-family: 'Fira Code', monospace; color: #f8fafc; font-size: 16px; line-height: 1.8; text-shadow: 0 2px 4px rgba(0,0,0,0.5); }
        .c-keyword { color: #fb7185; } .c-class { color: #38bdf8; } .c-func { color: #c084fc; } .c-str { color: #4ade80; } .c-var { color: #cbd5e1; } .c-bool { color: #facc15; }
        
        .orb { position: absolute; border-radius: 50%; filter: blur(100px); opacity: 0.5; z-index: -1; animation: floatOrb 10s ease-in-out infinite alternate; }
        .orb-1 { width: 400px; height: 400px; background: #818cf8; top: -100px; left: -150px; }
        .orb-2 { width: 500px; height: 500px; background: #c084fc; bottom: -150px; right: -200px; animation-delay: -5s; }
        @keyframes floatOrb { 0% { transform: translateY(0) scale(1); } 100% { transform: translateY(30px) scale(1.1); } }
        
        /* Features */
        .features-section { padding: 140px 20px; max-width: 1200px; margin: 0 auto; position: relative; z-index: 5; }
        .section-title { font-size: 48px; font-weight: 900; margin-bottom: 80px; letter-spacing: -1.5px; text-shadow: 0 5px 15px rgba(0,0,0,0.5); }
        .text-center { text-align: center; }
        .features-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: 40px; }
        .feature-card { padding: 50px 40px; border-radius: var(--radius-xl); text-align: left; border: 1px solid rgba(255,255,255,0.05); background: rgba(15,23,42,0.4); transition: var(--transition); backdrop-filter: blur(20px); position: relative; overflow: hidden; }
        .feature-card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 4px; background: transparent; transition: var(--transition); }
        .feature-card:hover { transform: translateY(-10px); background: rgba(30,41,59,0.6); }
        .hover-glow-purple:hover { box-shadow: 0 30px 60px rgba(192,132,252,0.15); border-color: rgba(192,132,252,0.4); }
        .hover-glow-purple:hover::before { background: var(--gradient-purple); }
        .hover-glow-accent:hover { box-shadow: 0 30px 60px rgba(56,189,248,0.15); border-color: rgba(56,189,248,0.4); }
        .hover-glow-accent:hover::before { background: var(--gradient-accent); }
        .hover-glow-success:hover { box-shadow: 0 30px 60px rgba(74,222,128,0.15); border-color: rgba(74,222,128,0.4); }
        .hover-glow-success:hover::before { background: var(--gradient-success); }
        
        .f-icon { width: 72px; height: 72px; border-radius: 24px; display: flex; align-items: center; justify-content: center; margin-bottom: 30px; box-shadow: inset 0 0 20px rgba(255,255,255,0.05); }
        .bg-purple { background: rgba(192, 132, 252, 0.15); border: 1px solid rgba(192, 132, 252, 0.3); }
        .bg-accent { background: rgba(56, 189, 248, 0.15); border: 1px solid rgba(56, 189, 248, 0.3); }
        .bg-success { background: rgba(74, 222, 128, 0.15); border: 1px solid rgba(74, 222, 128, 0.3); }
        .feature-card h3 { font-size: 26px; font-weight: 800; margin-bottom: 16px; letter-spacing: -0.5px; }
        .feature-card p { color: var(--text-secondary); line-height: 1.8; font-size: 16px; }

        /* Workflow */
        .workflow-section { max-width: 1000px; margin: 0 auto 140px; padding: 100px 60px; border-radius: 50px; text-align: center; border: 1px solid rgba(255,255,255,0.08); background: linear-gradient(180deg, rgba(30,41,59,0.5) 0%, rgba(15,23,42,0.2) 100%); box-shadow: 0 20px 60px rgba(0,0,0,0.5); backdrop-filter: blur(20px); position: relative; overflow: hidden; }
        .workflow-section::after { content: ''; position: absolute; top: -50%; left: -50%; width: 200%; height: 200%; background: radial-gradient(circle, rgba(56,189,248,0.05) 0%, transparent 50%); pointer-events: none; }
        .workflow-content { position: relative; z-index: 2; }
        .workflow-content h2 { font-size: 42px; font-weight: 900; margin-bottom: 24px; letter-spacing: -1.5px; }
        .workflow-content p { color: var(--text-secondary); margin-bottom: 60px; font-size: 18px; max-width: 600px; margin-left: auto; margin-right: auto; }
        .workflow-steps { display: flex; justify-content: center; flex-wrap: wrap; gap: 24px; }
        .w-step { display: flex; align-items: center; gap: 16px; background: rgba(3,5,12,0.6); padding: 20px 32px; border-radius: 40px; border: 1px solid rgba(255,255,255,0.1); transition: var(--transition); box-shadow: 0 10px 30px rgba(0,0,0,0.3); }
        .w-step:hover { background: rgba(30,41,59,0.8); transform: translateY(-5px) scale(1.02); border-color: rgba(56,189,248,0.4); box-shadow: 0 15px 40px rgba(56,189,248,0.2); }
        .w-num { width: 36px; height: 36px; background: var(--gradient-accent); color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 16px; box-shadow: 0 4px 15px rgba(56,189,248,0.5); }
        .w-text { font-weight: 700; font-size: 17px; letter-spacing: -0.3px; }

        /* Toolkit */
        .toolkit-section { max-width: 1200px; margin: 0 auto 140px; padding: 0 20px; }
        .toolkit-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 32px; }
        @media (max-width: 1000px) { .toolkit-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 600px) { .toolkit-grid { grid-template-columns: 1fr; } }
        .tool-item { background: rgba(15,23,42,0.4); padding: 50px 30px; border-radius: var(--radius-xl); text-align: center; border: 1px solid rgba(255,255,255,0.08); transition: var(--transition); backdrop-filter: blur(20px); position: relative; overflow: hidden; }
        .tool-item::before { content: ''; position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: radial-gradient(circle at center, rgba(255,255,255,0.05) 0%, transparent 70%); opacity: 0; transition: var(--transition); }
        .tool-item:hover { border-color: rgba(255,255,255,0.3); transform: translateY(-8px); box-shadow: 0 20px 50px rgba(0,0,0,0.4); }
        .tool-item:hover::before { opacity: 1; }
        .tool-item svg { margin-bottom: 30px; filter: drop-shadow(0 0 20px currentColor); opacity: 1; transition: transform 0.3s; }
        .tool-item:hover svg { transform: scale(1.1); }
        .tool-item h4 { font-weight: 800; font-size: 19px; color: var(--text-primary); letter-spacing: -0.5px; }

        /* Footer */
        .footer-cta { text-align: center; padding: 140px 20px 60px; border-top: 1px solid rgba(255,255,255,0.05); background: radial-gradient(circle at bottom, rgba(192, 132, 252, 0.1), transparent 70%); position: relative; }
        .footer-content { max-width: 900px; margin: 0 auto; display: flex; flex-direction: column; align-items: center; }
        .footer-cta h2 { font-size: 48px; font-weight: 900; margin-bottom: 50px; letter-spacing: -2px; line-height: 1.2; text-shadow: 0 5px 20px rgba(0,0,0,0.5); }
        .footer-bottom { margin-top: 120px; font-size: 14px; color: var(--text-muted); font-weight: 500; }
      `}</style>
    </div>
  )
}
