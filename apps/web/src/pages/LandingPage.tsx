import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Zap,
  GitBranch,
  GitCommitHorizontal,
  GitPullRequest,
  Globe,
  Bot,
  Mail,
  Clock,
  Calendar,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  Terminal,
  Layers,
  RefreshCw,
  Cpu,
  ExternalLink,
  Code2,
  Users,
  FileText,
  Check,
  Star,
  Lock,
  Moon,
  Sun,
  ChevronRight,
  ChevronDown,
  LayoutDashboard,
  Shield,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { useTheme } from '@/contexts/ThemeContext'
import { useAuth } from '@/contexts/AuthContext'

export function LandingPage() {
  const { theme, setTheme } = useTheme()
  const { isAuthenticated } = useAuth()
  const [activeTab, setActiveTab] = useState<'stream' | 'ai' | 'email'>('ai')
  const [activeTemplate, setActiveTemplate] = useState<'modern' | 'executive' | 'minimalist'>('modern')

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/20 selection:text-primary overflow-x-hidden font-sans">
      {/* ── Background Glow Effects ─────────────────────────────────── */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[500px] bg-primary/10 rounded-full blur-[140px] opacity-70" />
        <div className="absolute top-[40%] -left-40 w-[500px] h-[400px] bg-sky-500/5 rounded-full blur-[120px]" />
        <div className="absolute top-[70%] -right-40 w-[500px] h-[400px] bg-purple-500/5 rounded-full blur-[120px]" />
      </div>

      {/* ── Top Navigation Bar ───────────────────────────────────────── */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-background/80 border-b border-border/60 transition-colors w-full">
        <div className="w-full px-4 sm:px-8 lg:px-10 h-16 flex items-center justify-between">
          {/* Logo (No lighting emoji, crisp typographic branding) */}
          <Link to="/" className="flex items-center gap-2 group">
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg tracking-tight text-foreground group-hover:text-primary transition-colors">
                  AutoEOD
                </span>
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 bg-primary/10 text-primary rounded-md border border-primary/25">
                  v1.0
                </span>
              </div>
              <span className="text-[10px] text-muted-foreground font-medium -mt-0.5 tracking-tight">Autonomous Report Engine</span>
            </div>
          </Link>

          {/* Nav Links */}
          <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#interactive-demo" className="hover:text-foreground transition-colors">Live Preview</a>
            <a href="#architecture" className="hover:text-foreground transition-colors">Architecture</a>
            <a href="#roadmap" className="hover:text-foreground transition-colors">Roadmap</a>
            <a href="#pricing" className="hover:text-foreground transition-colors">Open Source</a>
          </nav>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-2.5">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="h-8.5 w-8.5 rounded-xl text-muted-foreground hover:text-foreground"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>

            {isAuthenticated ? (
              <Link to="/dashboard">
                <Button className="h-8.5 px-4 text-xs font-semibold rounded-xl gap-2 shadow-xs">
                  <LayoutDashboard className="w-3.5 h-3.5" /> Open App
                </Button>
              </Link>
            ) : (
              <>
                <Link to="/login">
                  <Button variant="ghost" className="h-8.5 px-3 text-xs font-medium rounded-xl">
                    Sign in
                  </Button>
                </Link>
                <Link to="/signup">
                  <Button className="h-8.5 px-4 text-xs font-semibold rounded-xl gap-1.5 shadow-sm shadow-primary/20">
                    Get Started <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ── Hero Section ────────────────────────────────────────────── */}
      <section className="relative z-10 pt-16 pb-20 md:pt-24 md:pb-28 px-4 sm:px-6 max-w-5xl mx-auto text-center">
        {/* Announcement Pill */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/25 text-primary text-xs font-medium mb-6 shadow-xs animate-fade-in">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Automate your daily engineering standup & EOD summary</span>
          <ChevronRight className="w-3 h-3 text-primary/70" />
        </div>

        {/* Main Headline */}
        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-foreground max-w-4xl mx-auto leading-[1.12]">
          Your daily work writes its own{' '}
          <span className="bg-gradient-to-r from-primary via-primary/80 to-purple-400 bg-clip-text text-transparent">
            executive report.
          </span>
        </h1>

        {/* Subtitle */}
        <p className="mt-5 text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          AutoEOD aggregates your GitHub commits, PR reviews, browser documentation research, and ChatGPT discussions. At the end of your workday, it synthesizes a structured report and delivers it directly to your team on autopilot.
        </p>

        {/* CTA Group */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link to={isAuthenticated ? '/dashboard' : '/signup'} className="w-full sm:w-auto">
            <Button size="lg" className="w-full sm:w-auto h-11 px-6 text-sm font-semibold rounded-xl gap-2 shadow-md shadow-primary/25">
              <Zap className="w-4 h-4 fill-current" />
              {isAuthenticated ? 'Go to Dashboard' : 'Start Tracking Free'}
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
          <a href="#interactive-demo" className="w-full sm:w-auto">
            <Button variant="outline" size="lg" className="w-full sm:w-auto h-11 px-5 text-sm font-medium rounded-xl border-border bg-card/60 backdrop-blur-xs">
              Explore Live Demo
            </Button>
          </a>
        </div>

        {/* Trust Badges */}
        <div className="mt-12 pt-8 border-t border-border/50 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-xs text-muted-foreground font-mono">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span>GitHub OAuth 2.0 Ingestion</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span>Browser Radar Extension</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span>BullMQ Redis Pipeline</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span>OpenRouter Claude & GPT-4o</span>
          </div>
        </div>
      </section>

      {/* ── Interactive Live Preview Section ─────────────────────────── */}
      <section id="interactive-demo" className="relative z-10 py-16 px-4 sm:px-6 max-w-6xl mx-auto">
        <div className="text-center mb-10">
          <Badge variant="outline" className="text-xs uppercase font-mono tracking-wider mb-2 text-primary border-primary/30">
            Interactive Product Preview
          </Badge>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            From raw developer activity to executive clarity
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground mt-2 max-w-xl mx-auto">
            See how AutoEOD automatically turns commits, pull requests, and browser sessions into structured markdown reports.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex justify-center mb-6">
          <div className="flex space-x-1.5 bg-muted/60 p-1.5 rounded-xl border border-border">
            <button
              onClick={() => setActiveTab('stream')}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all flex items-center gap-2 ${
                activeTab === 'stream'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <GitBranch className="w-3.5 h-3.5 text-primary" />
              1. Captured Activity Stream
            </button>
            <button
              onClick={() => setActiveTab('ai')}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all flex items-center gap-2 ${
                activeTab === 'ai'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Bot className="w-3.5 h-3.5 text-purple-400" />
              2. AI Synthesized EOD Report
            </button>
            <button
              onClick={() => setActiveTab('email')}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all flex items-center gap-2 ${
                activeTab === 'email'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Mail className="w-3.5 h-3.5 text-amber-400" />
              3. Delivered Email Format
            </button>
          </div>
        </div>

        {/* Interactive Card Canvas */}
        <Card className="border-border bg-card/95 shadow-2xl overflow-hidden backdrop-blur-xl">
          {/* Card Window Top Header */}
          <div className="px-4 py-3 bg-muted/50 border-b border-border flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80 inline-block" />
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80 inline-block" />
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 inline-block" />
              <span className="ml-2 font-mono text-[11px]">autoeod-pipeline // live-session</span>
            </div>
            <div className="flex items-center gap-2 font-mono text-[11px]">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Cron: 18:30 IST</span>
            </div>
          </div>

          <CardContent className="p-5 sm:p-6">
            {/* 1. Captured Activity Stream View */}
            {activeTab === 'stream' && (
              <div className="space-y-3 font-mono text-xs">
                <div className="p-3.5 rounded-xl bg-muted/40 border border-border/80 flex items-start gap-3">
                  <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 shrink-0 mt-0.5">
                    <GitCommitHorizontal className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-foreground">feat(auth): add OAuth2 refresh token handling & audit hooks</span>
                      <span className="text-[10px] text-muted-foreground">11:42 AM</span>
                    </div>
                    <p className="text-muted-foreground text-[11px] mt-0.5">repo: <span className="text-primary font-medium">AutoEOD/api</span> · commit <span className="text-purple-400">8f2a1b9</span> · +142 -28 lines</p>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-muted/40 border border-border/80 flex items-start gap-3">
                  <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20 shrink-0 mt-0.5">
                    <GitPullRequest className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-foreground">PR #42: Approved & merged BullMQ queue rate limiting</span>
                      <span className="text-[10px] text-muted-foreground">03:15 PM</span>
                    </div>
                    <p className="text-muted-foreground text-[11px] mt-0.5">repo: <span className="text-primary font-medium">AutoEOD/worker</span> · reviewer: <span className="text-emerald-400">Karan</span></p>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-muted/40 border border-border/80 flex items-start gap-3">
                  <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0 mt-0.5">
                    <Globe className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-foreground">Browser Radar: Researched Redis Upstash TLS connection & latency profiles</span>
                      <span className="text-[10px] text-muted-foreground">04:20 PM</span>
                    </div>
                    <p className="text-muted-foreground text-[11px] mt-0.5">domain: <span className="text-foreground">upstash.com/docs</span> · duration: <span className="text-amber-400">18m 40s</span></p>
                  </div>
                </div>
              </div>
            )}

            {/* 2. AI Synthesized EOD Report View */}
            {activeTab === 'ai' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <div>
                    <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-primary" />
                      AutoEOD Daily Summary Report
                    </h3>
                    <p className="text-xs text-muted-foreground">Generated automatically via Claude 3.5 Sonnet / OpenRouter</p>
                  </div>
                  <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-xs">
                    Draft Ready
                  </Badge>
                </div>

                <div className="space-y-4 text-xs font-sans">
                  {/* Completed Items */}
                  <div className="space-y-2">
                    <h4 className="font-semibold text-emerald-500 flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Completed Today
                    </h4>
                    <ul className="space-y-1.5 pl-5 list-disc text-foreground/90 leading-relaxed">
                      <li>Implemented OAuth2 refresh token rotation and security audit logging across API endpoints.</li>
                      <li>Reviewed and merged PR #42 implementing BullMQ Redis worker rate limiters and retry backoffs.</li>
                      <li>Completed performance diagnostics on Redis Upstash TLS latency with 24ms round-trip verified.</li>
                    </ul>
                  </div>

                  {/* In Progress */}
                  <div className="space-y-2">
                    <h4 className="font-semibold text-blue-400 flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                      <Clock className="w-3.5 h-3.5" /> In Progress
                    </h4>
                    <ul className="space-y-1.5 pl-5 list-disc text-foreground/90 leading-relaxed">
                      <li>Finalizing multi-account Zoho & Google SMTP transport switchers in user settings.</li>
                    </ul>
                  </div>

                  {/* Blockers & Tomorrow */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <div className="p-3 rounded-xl bg-muted/40 border border-border space-y-1">
                      <span className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider">Blockers</span>
                      <p className="text-muted-foreground text-xs">None today. All deployment pipelines operational.</p>
                    </div>
                    <div className="p-3 rounded-xl bg-muted/40 border border-border space-y-1">
                      <span className="text-[11px] font-semibold text-purple-400 uppercase tracking-wider">Tomorrow's Plan</span>
                      <p className="text-muted-foreground text-xs">Ship Linear two-way issue status webhooks and VS Code telemetry.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 3. Delivered Email Format View */}
            {activeTab === 'email' && (
              <div className="space-y-3 font-sans">
                <div className="flex items-center justify-between bg-muted/40 p-2.5 rounded-lg border border-border text-xs text-muted-foreground">
                  <div>
                    <span className="font-semibold text-foreground">To: </span> engineering-leads@company.com
                  </div>
                  <div>
                    <span className="font-semibold text-foreground">Subject: </span> 📊 AutoEOD Report: Aug 25 — Karan Kacha
                  </div>
                </div>

                <div className="p-5 rounded-xl border border-primary/20 bg-background/50 space-y-3 text-xs">
                  <div className="flex items-center justify-between border-b border-border/80 pb-2">
                    <span className="font-bold text-sm text-foreground">Karan Kacha · End of Day Activity</span>
                    <span className="text-[11px] font-mono text-muted-foreground">Aug 25, 2026</span>
                  </div>
                  <p className="text-muted-foreground leading-relaxed">
                    Here is the verified EOD engineering summary compiled autonomously from 6 commits and 2 PR reviews:
                  </p>
                  <div className="bg-muted/30 p-3 rounded-lg border border-border/60 text-xs space-y-1.5">
                    <p className="font-semibold text-foreground">Key Highlights:</p>
                    <p className="text-muted-foreground">✓ Shipped OAuth2 refresh token rotation (AutoEOD/api)</p>
                    <p className="text-muted-foreground">✓ Approved & merged BullMQ queue rate limiting (AutoEOD/worker)</p>
                    <p className="text-muted-foreground">✓ Verified Upstash TLS latency under 30ms</p>
                  </div>
                  <p className="text-[11px] text-muted-foreground pt-1 italic">
                    Delivered automatically by AutoEOD Engine at 18:30 IST.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* ── Core Features Grid (Authentic & Accurate) ─────────────────── */}
      <section id="features" className="relative z-10 py-20 px-4 sm:px-6 max-w-7xl mx-auto border-t border-border/50">
        <div className="text-center mb-16">
          <Badge variant="outline" className="text-xs uppercase font-mono tracking-wider mb-2 text-primary border-primary/30">
            Engine Capabilities
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
            Engineered specifically for software engineers & teams
          </h2>
          <p className="text-sm text-muted-foreground mt-2 max-w-2xl mx-auto">
            Zero fluff, zero manual writing. Every component connects directly to your actual development tools.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* Feature 1 */}
          <Card className="border-border bg-card/80 hover:border-primary/40 transition-all duration-200 shadow-xs">
            <CardContent className="p-6 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center">
                <GitBranch className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-foreground">GitHub Native Ingestion</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Connects via GitHub OAuth to automatically stream commits, PR creations, reviews, and merged branches across all your public and private repositories every 15 minutes.
              </p>
            </CardContent>
          </Card>

          {/* Feature 2 */}
          <Card className="border-border bg-card/80 hover:border-primary/40 transition-all duration-200 shadow-xs">
            <CardContent className="p-6 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
                <Globe className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-foreground">Browser Radar Extension</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Lightweight Chrome/Firefox/Brave extension captures coding documentation research tabs and ChatGPT discussion topics while strictly filtering out noise and private browsing.
              </p>
            </CardContent>
          </Card>

          {/* Feature 3 */}
          <Card className="border-border bg-card/80 hover:border-primary/40 transition-all duration-200 shadow-xs">
            <CardContent className="p-6 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center justify-center">
                <Bot className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-foreground">Multi-LLM OpenRouter Pipeline</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Processes raw activity logs into professional bulleted reports using Claude 3.5 Sonnet, GPT-4o, and DeepSeek with automatic model fallback cascades to guarantee 100% uptime.
              </p>
            </CardContent>
          </Card>

          {/* Feature 4 */}
          <Card className="border-border bg-card/80 hover:border-primary/40 transition-all duration-200 shadow-xs">
            <CardContent className="p-6 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center">
                <Calendar className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-foreground">Timezones & Holiday Rules</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Configure your active working days, daily report delivery window (e.g. 6:30 PM), and add holiday/PTO calendar exceptions so reports are never sent when you're off.
              </p>
            </CardContent>
          </Card>

          {/* Feature 5 */}
          <Card className="border-border bg-card/80 hover:border-primary/40 transition-all duration-200 shadow-xs">
            <CardContent className="p-6 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center">
                <Mail className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-foreground">Executive Email Templates</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Choose from 6 professionally styled HTML templates (Professional, Executive, Modern, Minimalist, Creative, Qwintsoft) with support for Google, Zoho, and custom SMTP relays.
              </p>
            </CardContent>
          </Card>

          {/* Feature 6 */}
          <Card className="border-border bg-card/80 hover:border-primary/40 transition-all duration-200 shadow-xs">
            <CardContent className="p-6 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center justify-center">
                <Clock className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-foreground">Minute-by-Minute Timeline</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Inspect a chronological breakdown of your entire working day with repo tags, branch badges, commit diff links, and time spent on specific engineering tasks.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ── Architecture Pipeline Section ────────────────────────────── */}
      <section id="architecture" className="relative z-10 py-20 px-4 sm:px-6 max-w-6xl mx-auto border-t border-border/50">
        <div className="text-center mb-16">
          <Badge variant="outline" className="text-xs uppercase font-mono tracking-wider mb-2 text-primary border-primary/30">
            System Architecture
          </Badge>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">
            How AutoEOD processes your work in real-time
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground mt-2 max-w-xl mx-auto">
            High-performance asynchronous architecture built with Fastify, BullMQ, Prisma PostgreSQL, and Redis.
          </p>
        </div>

        {/* Pipeline Step Flow */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl bg-card border border-border space-y-2.5 relative">
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
              STAGE 01
            </span>
            <h4 className="text-sm font-bold text-foreground flex items-center gap-1.5 mt-2">
              <Code2 className="w-4 h-4 text-blue-400" /> Event Ingestion
            </h4>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              GitHub API sync runs every 15 min. Browser Radar extension captures research URLs and ChatGPT sessions into PostgreSQL.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-card border border-border space-y-2.5 relative">
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
              STAGE 02
            </span>
            <h4 className="text-sm font-bold text-foreground flex items-center gap-1.5 mt-2">
              <Layers className="w-4 h-4 text-purple-400" /> BullMQ Scheduler
            </h4>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Cron dispatcher checks active users, working days, and configured report times to enqueue report generation jobs into Redis.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-card border border-border space-y-2.5 relative">
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
              STAGE 03
            </span>
            <h4 className="text-sm font-bold text-foreground flex items-center gap-1.5 mt-2">
              <Bot className="w-4 h-4 text-emerald-400" /> LLM Synthesis
            </h4>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Worker parses commits, PR titles, and active logs, generating structured Completed, In Progress, and Blockers markdown.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-card border border-border space-y-2.5 relative">
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
              STAGE 04
            </span>
            <h4 className="text-sm font-bold text-foreground flex items-center gap-1.5 mt-2">
              <Mail className="w-4 h-4 text-amber-400" /> Delivery & Audit
            </h4>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Dispatches responsive HTML emails to managers/teams or saves drafts for one-click review, logging security audit trails.
            </p>
          </div>
        </div>
      </section>

      {/* ── Future Scope & Engineering Roadmap ───────────────────────── */}
      <section id="roadmap" className="relative z-10 py-20 px-4 sm:px-6 max-w-6xl mx-auto border-t border-border/50">
        <div className="text-center mb-16">
          <Badge variant="outline" className="text-xs uppercase font-mono tracking-wider mb-2 text-purple-400 border-purple-400/30">
            Roadmap & Future Scope
          </Badge>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">
            What we're building next
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground mt-2 max-w-xl mx-auto">
            Our upcoming engineering milestones to expand automated developer intelligence.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Milestone 1 */}
          <div className="p-6 rounded-2xl bg-card border border-border space-y-3 relative overflow-hidden group hover:border-primary/40 transition-colors">
            <div className="flex items-center justify-between">
              <Badge variant="secondary" className="text-[11px] font-mono bg-primary/10 text-primary border-primary/20">
                Q3 2026 · IN PROGRESS
              </Badge>
              <span className="text-xs font-mono text-muted-foreground">Milestone 01</span>
            </div>
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-blue-400" />
              Linear & Jira Two-Way Issue Sync
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Auto-detect issue keys (e.g. <code className="font-mono text-foreground">ENG-124</code>, <code className="font-mono text-foreground">PROJ-89</code>) in commit messages, pull active issue titles, and automatically update ticket status to "In Review" or "Done" based on your daily EOD report.
            </p>
          </div>

          {/* Milestone 2 */}
          <div className="p-6 rounded-2xl bg-card border border-border space-y-3 relative overflow-hidden group hover:border-primary/40 transition-colors">
            <div className="flex items-center justify-between">
              <Badge variant="secondary" className="text-[11px] font-mono bg-purple-500/10 text-purple-400 border-purple-500/20">
                Q4 2026 · PLANNED
              </Badge>
              <span className="text-xs font-mono text-muted-foreground">Milestone 02</span>
            </div>
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              <Terminal className="w-4 h-4 text-purple-400" />
              Native IDE Extensions (VS Code & JetBrains)
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Lightweight editor plugin measuring local file editing heatmaps, test suite executions, and debugging sessions without leaving your code editor.
            </p>
          </div>

          {/* Milestone 3 */}
          <div className="p-6 rounded-2xl bg-card border border-border space-y-3 relative overflow-hidden group hover:border-primary/40 transition-colors">
            <div className="flex items-center justify-between">
              <Badge variant="secondary" className="text-[11px] font-mono bg-amber-500/10 text-amber-400 border-amber-500/20">
                Q1 2027 · PLANNED
              </Badge>
              <span className="text-xs font-mono text-muted-foreground">Milestone 03</span>
            </div>
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              <Users className="w-4 h-4 text-amber-400" />
              Team Roll-Up & Manager Engineering Dashboards
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Multi-tenant organizational workspaces allowing engineering leads to review team-wide blocker trends, repository velocity, and cross-squad progress summaries in one central dashboard.
            </p>
          </div>

          {/* Milestone 4 */}
          <div className="p-6 rounded-2xl bg-card border border-border space-y-3 relative overflow-hidden group hover:border-primary/40 transition-colors">
            <div className="flex items-center justify-between">
              <Badge variant="secondary" className="text-[11px] font-mono bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                Q2 2027 · RESEARCH
              </Badge>
              <span className="text-xs font-mono text-muted-foreground">Milestone 04</span>
            </div>
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              Voice Standup Dictation with Local Whisper
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Speak a 30-second audio summary on your phone or desktop. OpenAI Whisper transcribes and merges your spoken notes into your automated GitHub activity report.
            </p>
          </div>
        </div>
      </section>

      {/* ── Open Source & Deployment Tier ────────────────────────────── */}
      <section id="pricing" className="relative z-10 py-20 px-4 sm:px-6 max-w-5xl mx-auto border-t border-border/50">
        <div className="text-center mb-14">
          <Badge variant="outline" className="text-xs uppercase font-mono tracking-wider mb-2 text-primary border-primary/30">
            Open Source & Deployment
          </Badge>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">
            100% Free & Open Source for Developers
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground mt-2 max-w-xl mx-auto">
            Self-host on your own infrastructure with Docker & Coolify, or use our cloud-hosted instance.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {/* Community Self-Hosted */}
          <Card className="border-border bg-card p-6 rounded-2xl flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-foreground">Self-Hosted Community</h3>
                <Badge variant="secondary" className="text-xs font-mono">Free Forever</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Deploy on your own VPS (Coolify, Docker, or Kubernetes) with full database ownership.
              </p>
              <ul className="space-y-2 text-xs text-foreground/90 font-medium">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-500 shrink-0" /> Unlimited daily EOD reports
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-500 shrink-0" /> Full GitHub OAuth integration
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-500 shrink-0" /> Browser Radar extension included
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-500 shrink-0" /> Bring your own OpenRouter / OpenAI keys
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-500 shrink-0" /> 6 Executive email templates
                </li>
              </ul>
            </div>
            <div className="pt-6">
              <a href="https://github.com/kachakaran6/AutoEOD" target="_blank" rel="noopener noreferrer" className="block">
                <Button variant="outline" className="w-full text-xs font-semibold h-10 rounded-xl gap-2">
                  <Code2 className="w-4 h-4" /> View on GitHub <ExternalLink className="w-3 h-3" />
                </Button>
              </a>
            </div>
          </Card>

          {/* Managed Cloud */}
          <Card className="border-primary/40 bg-primary/5 p-6 rounded-2xl flex flex-col justify-between relative shadow-lg shadow-primary/5">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-foreground">Managed Cloud Instance</h3>
                <Badge className="text-xs font-mono bg-primary text-primary-foreground">Instant Setup</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Zero infrastructure setup. Sign up, connect your GitHub, and start receiving reports today.
              </p>
              <ul className="space-y-2 text-xs text-foreground/90 font-medium">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-primary shrink-0" /> All Community features included
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-primary shrink-0" /> Automated BullMQ Redis cron scheduling
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-primary shrink-0" /> Pre-configured high-availability API
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-primary shrink-0" /> Multi-recipient manager routing & CCs
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-primary shrink-0" /> Continuous auto-deploy on master updates
                </li>
              </ul>
            </div>
            <div className="pt-6">
              <Link to={isAuthenticated ? '/dashboard' : '/signup'} className="block">
                <Button className="w-full text-xs font-semibold h-10 rounded-xl gap-2 shadow-sm">
                  {isAuthenticated ? 'Open Your Dashboard' : 'Get Started Now'} <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
            </div>
          </Card>
        </div>
      </section>

      {/* ── Bottom Call To Action ───────────────────────────────────── */}
      <section className="relative z-10 py-20 px-4 sm:px-6 max-w-4xl mx-auto text-center border-t border-border/50">
        <div className="p-8 sm:p-12 rounded-3xl bg-gradient-to-b from-card to-card/60 border border-border shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
          
          <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-foreground max-w-xl mx-auto">
            Stop spending 20 minutes at the end of every day writing reports.
          </h2>
          <p className="mt-4 text-xs sm:text-sm text-muted-foreground max-w-lg mx-auto leading-relaxed">
            Let AutoEOD track your actual engineering output and deliver pristine executive summaries to your manager on autopilot.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link to={isAuthenticated ? '/dashboard' : '/signup'}>
              <Button size="lg" className="h-11 px-6 text-sm font-semibold rounded-xl gap-2 shadow-md shadow-primary/25">
                <Zap className="w-4 h-4 fill-current" />
                {isAuthenticated ? 'Go to Dashboard' : 'Create Free Account'}
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Global Footer ───────────────────────────────────────────── */}
      <footer className="relative z-10 border-t border-border/60 bg-muted/20 py-10 w-full">
        <div className="w-full px-4 sm:px-8 lg:px-10 flex flex-col sm:flex-row items-center justify-between gap-6 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-sm text-foreground">AutoEOD</span>
            <span className="text-muted-foreground">· Autonomous End-of-Day Engineering Reports</span>
          </div>

          <div className="flex items-center gap-6">
            <a href="https://github.com/kachakaran6/AutoEOD" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors flex items-center gap-1">
              GitHub <ExternalLink className="w-3 h-3" />
            </a>
            <Link to="/login" className="hover:text-foreground transition-colors">Sign in</Link>
            <Link to="/signup" className="hover:text-foreground transition-colors">Register</Link>
          </div>

          <div className="flex items-center gap-2 font-mono text-[11px]">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>All systems operational</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
