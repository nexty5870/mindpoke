import Link from "next/link";
import { Github, Zap, Brain, Bell, ArrowRight } from "lucide-react";
import { HeroWebGL } from "@/components/landing/hero-webgl";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-[#e6e6e6]">
      {/* Header */}
      <header className="border-b border-[#2a2a30]">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 border border-[#00d4aa] flex items-center justify-center">
              <Zap className="w-4 h-4 text-[#00d4aa]" />
            </div>
            <span className="font-terminal text-sm text-[#888888]">MINDPOKE.COM</span>
          </div>
          
          <nav className="flex items-center gap-6">
            <a
              href="https://github.com/nexty5870/mindpoke"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-[#888888] hover:text-[#00d4aa] transition-colors font-terminal text-sm"
            >
              <Github className="w-4 h-4" />
              <span className="hidden sm:inline">GITHUB</span>
            </a>
            <Link
              href="/app"
              className="ascii-btn px-4 py-2 text-sm text-[#00d4aa] hover:bg-[#00d4aa] hover:text-[#0a0a0f]"
            >
              LAUNCH_APP
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative max-w-6xl mx-auto px-6 py-24 md:py-32 overflow-hidden">
        {/* WebGL Background */}
        <HeroWebGL />
        
        <div className="max-w-3xl relative z-10">
          {/* Terminal label */}
          <div className="font-terminal text-xs text-[#555555] mb-6">
            $ SYSTEM_INIT :: COGNITIVE_FEED_AGENT
          </div>
          
          {/* Main headline */}
          <h1 className="font-serif text-5xl md:text-7xl font-bold text-white mb-6 leading-[1.1]">
            Your interests,
            <br />
            <span className="text-[#00d4aa]">proactively served.</span>
          </h1>
          
          {/* Subheadline */}
          <p className="font-terminal text-lg text-[#888888] mb-10 max-w-xl leading-relaxed">
            Mindpoke monitors what matters to you across X, Reddit, Hacker News, 
            and RSS feeds - then pokes you when something relevant surfaces.
          </p>
          
          {/* CTA buttons */}
          <div className="flex flex-col sm:flex-row gap-4">
            <Link
              href="/app"
              className="group inline-flex items-center justify-center gap-3 bg-[#00d4aa] text-[#0a0a0f] px-8 py-4 font-terminal text-sm font-medium hover:bg-[#00b894] transition-colors"
            >
              <span>START_DISCOVERING</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
            <a
              href="https://github.com/nexty5870/mindpoke"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-3 border border-[#2a2a30] text-[#e6e6e6] px-8 py-4 font-terminal text-sm hover:border-[#00d4aa] hover:text-[#00d4aa] transition-colors"
            >
              <Github className="w-4 h-4" />
              <span>VIEW_SOURCE</span>
            </a>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-[#2a2a30]">
        <div className="max-w-6xl mx-auto px-6 py-24">
          <div className="font-terminal text-xs text-[#555555] mb-8">
            $ MODULE_LIST :: CORE_FEATURES
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="border border-[#2a2a30] p-6 relative">
              <span className="absolute -top-[1px] -left-[1px] font-terminal text-[10px] text-[#2a2a30]">┌</span>
              <span className="absolute -top-[1px] -right-[1px] font-terminal text-[10px] text-[#2a2a30]">┐</span>
              <span className="absolute -bottom-[1px] -left-[1px] font-terminal text-[10px] text-[#2a2a30]">└</span>
              <span className="absolute -bottom-[1px] -right-[1px] font-terminal text-[10px] text-[#2a2a30]">┘</span>
              
              <div className="w-12 h-12 border border-[#00d4aa] flex items-center justify-center mb-4">
                <Brain className="w-6 h-6 text-[#00d4aa]" />
              </div>
              <h3 className="font-serif text-xl text-white mb-3">Interest Graph</h3>
              <p className="font-terminal text-sm text-[#888888] leading-relaxed">
                Map your curiosities as nodes. Watch connections form as topics 
                overlap and evolve over time.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="border border-[#2a2a30] p-6 relative">
              <span className="absolute -top-[1px] -left-[1px] font-terminal text-[10px] text-[#2a2a30]">┌</span>
              <span className="absolute -top-[1px] -right-[1px] font-terminal text-[10px] text-[#2a2a30]">┐</span>
              <span className="absolute -bottom-[1px] -left-[1px] font-terminal text-[10px] text-[#2a2a30]">└</span>
              <span className="absolute -bottom-[1px] -right-[1px] font-terminal text-[10px] text-[#2a2a30]">┘</span>
              
              <div className="w-12 h-12 border border-[#ffb000] flex items-center justify-center mb-4">
                <Zap className="w-6 h-6 text-[#ffb000]" />
              </div>
              <h3 className="font-serif text-xl text-white mb-3">Multi-Source Discovery</h3>
              <p className="font-terminal text-sm text-[#888888] leading-relaxed">
                One interface for X, Reddit, Hacker News, arXiv, and RSS. 
                No more tab-hopping through feeds.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="border border-[#2a2a30] p-6 relative">
              <span className="absolute -top-[1px] -left-[1px] font-terminal text-[10px] text-[#2a2a30]">┌</span>
              <span className="absolute -top-[1px] -right-[1px] font-terminal text-[10px] text-[#2a2a30]">┐</span>
              <span className="absolute -bottom-[1px] -left-[1px] font-terminal text-[10px] text-[#2a2a30]">└</span>
              <span className="absolute -bottom-[1px] -right-[1px] font-terminal text-[10px] text-[#2a2a30]">┘</span>
              
              <div className="w-12 h-12 border border-[#00d4aa] flex items-center justify-center mb-4">
                <Bell className="w-6 h-6 text-[#00d4aa]" />
              </div>
              <h3 className="font-serif text-xl text-white mb-3">Proactive Pokes</h3>
              <p className="font-terminal text-sm text-[#888888] leading-relaxed">
                Get notified via WhatsApp, Telegram, or Discord when high-relevance 
                content matches your interests.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-[#2a2a30]">
        <div className="max-w-6xl mx-auto px-6 py-24">
          <div className="font-terminal text-xs text-[#555555] mb-8">
            $ PROCESS_FLOW :: HOW_IT_WORKS
          </div>
          
          <div className="grid md:grid-cols-4 gap-6">
            {[
              { step: "01", title: "Define", desc: "Add topics you care about as interest nodes" },
              { step: "02", title: "Discover", desc: "Mindpoke scans sources matching your keywords" },
              { step: "03", title: "Score", desc: "Content is ranked by relevance and engagement" },
              { step: "04", title: "Poke", desc: "Get notified when something truly matters" },
            ].map((item) => (
              <div key={item.step} className="relative">
                <div className="font-terminal text-3xl text-[#2a2a30] mb-4">{item.step}</div>
                <h4 className="font-serif text-lg text-white mb-2">{item.title}</h4>
                <p className="font-terminal text-sm text-[#888888]">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="border-t border-[#2a2a30]">
        <div className="max-w-6xl mx-auto px-6 py-24 text-center">
          <h2 className="font-serif text-3xl md:text-4xl text-white mb-6">
            Stop scrolling. Start discovering.
          </h2>
          <p className="font-terminal text-[#888888] mb-10 max-w-lg mx-auto">
            Mindpoke is open source and self-hostable. 
            Your interests, your data, your agent.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/app"
              className="inline-flex items-center justify-center gap-3 bg-[#00d4aa] text-[#0a0a0f] px-8 py-4 font-terminal text-sm font-medium hover:bg-[#00b894] transition-colors"
            >
              <span>LAUNCH_APP</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <a
              href="https://github.com/nexty5870/mindpoke"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-3 border border-[#2a2a30] text-[#e6e6e6] px-8 py-4 font-terminal text-sm hover:border-[#00d4aa] hover:text-[#00d4aa] transition-colors"
            >
              <Github className="w-4 h-4" />
              <span>STAR_ON_GITHUB</span>
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#2a2a30]">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="font-terminal text-xs text-[#555555]">
              ┌─ MINDPOKE v0.1.0 ─┐
            </div>
            <div className="flex items-center gap-6">
              <a
                href="https://github.com/nexty5870/mindpoke"
                target="_blank"
                rel="noopener noreferrer"
                className="font-terminal text-xs text-[#888888] hover:text-[#00d4aa] transition-colors"
              >
                SOURCE_CODE
              </a>
              <span className="font-terminal text-xs text-[#555555]">
                MIT LICENSE
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
