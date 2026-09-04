import React, { useRef, useState, useEffect } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  RotateCcw,
  Maximize2,
  Download,
  Github,
  CheckCircle2,
  ExternalLink,
  Sparkles,
  Zap,
  Globe,
  ShieldCheck,
  Clock,
  Laptop
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';

export function ExtensionInstallSection() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.5);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  // Set initial 1.5x playback speed on mount
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed]);

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const current = videoRef.current.currentTime;
      const total = videoRef.current.duration || 1;
      setCurrentTime(current);
      setProgress((current / total) * 100);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
      videoRef.current.playbackRate = playbackSpeed;
    }
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !videoRef.current.muted;
    setIsMuted(videoRef.current.muted);
  };

  const changeSpeed = (speed: number) => {
    setPlaybackSpeed(speed);
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
  };

  const restartVideo = () => {
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play();
      setIsPlaying(true);
      videoRef.current.playbackRate = playbackSpeed;
    }
  };

  const toggleFullscreen = () => {
    if (videoRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        videoRef.current.requestFullscreen();
      }
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!videoRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    videoRef.current.currentTime = pos * videoRef.current.duration;
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <section id="extension-install" className="relative z-10 py-20 px-4 sm:px-6 max-w-7xl mx-auto border-t border-border/50">
      {/* Background ambient glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-rose-500/8 rounded-full blur-[140px] pointer-events-none" />

      <div className="text-center mb-12">
        <Badge variant="outline" className="text-xs uppercase font-mono tracking-wider mb-2.5 text-rose-500 border-rose-500/30 gap-1.5 px-3 py-1">
          <Sparkles className="w-3 h-3 text-rose-500" />
          60-Second Setup Walkthrough
        </Badge>
        <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
          See how effortlessly it installs
        </h2>
        <p className="text-xs sm:text-sm text-muted-foreground mt-2 max-w-2xl mx-auto leading-relaxed">
          Watch the complete browser extension installation flow in real time. Download, unpack in Chrome Developer Mode, and connect your token in under one minute.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        {/* Left / Top: Interactive Step Guide */}
        <div className="lg:col-span-5 space-y-4">
          <div className="p-4 rounded-2xl bg-card/80 border border-border hover:border-rose-500/30 transition-colors shadow-xs">
            <div className="flex items-start gap-3.5">
              <span className="flex items-center justify-center w-7 h-7 rounded-xl bg-rose-500/10 text-rose-500 border border-rose-500/20 text-xs font-bold shrink-0 mt-0.5">
                1
              </span>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  Download the Extension ZIP
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Grab the compiled <code className="text-[11px] font-mono bg-muted px-1.5 py-0.5 rounded text-foreground border border-border">autoeod-extension.zip</code> directly from the latest GitHub Release and extract it to a local folder.
                </p>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-card/80 border border-border hover:border-rose-500/30 transition-colors shadow-xs">
            <div className="flex items-start gap-3.5">
              <span className="flex items-center justify-center w-7 h-7 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-xs font-bold shrink-0 mt-0.5">
                2
              </span>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  Load Unpacked in Chrome
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Navigate to <code className="text-[11px] font-mono bg-muted px-1.5 py-0.5 rounded text-foreground border border-border">chrome://extensions</code>, toggle on <strong>Developer mode</strong>, and click <strong>Load unpacked</strong>.
                </p>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-card/80 border border-border hover:border-rose-500/30 transition-colors shadow-xs">
            <div className="flex items-start gap-3.5">
              <span className="flex items-center justify-center w-7 h-7 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 text-xs font-bold shrink-0 mt-0.5">
                3
              </span>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  Connect & Capture Autonomously
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Paste your secure AutoEOD extension token from the dashboard. Your ChatGPT discussions and documentation context sync automatically.
                </p>
              </div>
            </div>
          </div>

          {/* Action Button Row */}
          <div className="pt-2 flex items-center gap-3 flex-wrap">
            <Button asChild size="default" className="h-10 px-5 text-xs font-semibold rounded-xl gap-2 shadow-sm shadow-rose-500/20 bg-rose-500 hover:bg-rose-600 text-white">
              <a
                href="https://github.com/kachakaran6/AutoEOD/releases/latest/download/autoeod-extension.zip"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Download className="w-4 h-4" /> Download Latest ZIP
              </a>
            </Button>
            <Button variant="outline" size="default" asChild className="h-10 px-4 text-xs font-medium rounded-xl gap-2 border-border">
              <a
                href="https://github.com/kachakaran6/AutoEOD/releases/latest"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Github className="w-3.5 h-3.5" /> Release Notes <ExternalLink className="w-3 h-3 text-muted-foreground" />
              </a>
            </Button>
          </div>
        </div>

        {/* Right / Bottom: The Video Mockup Player */}
        <div className="lg:col-span-7">
          <Card className="border-border/80 bg-card/95 shadow-2xl overflow-hidden backdrop-blur-xl relative group rounded-2xl border">
            {/* macOS Browser Mockup Header */}
            <div className="px-4 py-3 bg-muted/60 border-b border-border/80 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-rose-500/90 inline-block" />
                  <span className="w-3 h-3 rounded-full bg-amber-500/90 inline-block" />
                  <span className="w-3 h-3 rounded-full bg-emerald-500/90 inline-block" />
                </div>
                <div className="hidden sm:flex items-center gap-1.5 ml-3 px-3 py-1 bg-background/80 rounded-md border border-border/60 font-mono text-[11px] text-muted-foreground">
                  <Globe className="w-3 h-3 text-rose-500" />
                  <span>chrome://extensions // AutoEOD Activity Radar</span>
                </div>
              </div>

              {/* Live Badge & Speed Tag */}
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="bg-rose-500/10 text-rose-500 border border-rose-500/20 text-[10px] font-mono flex items-center gap-1 px-2 py-0.5">
                  <Zap className="w-3 h-3 fill-current" />
                  {playbackSpeed}x Speed
                </Badge>
                <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-mono text-emerald-500">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Demo
                </span>
              </div>
            </div>

            {/* Video Container */}
            <div className="relative aspect-video bg-black/90 flex items-center justify-center overflow-hidden">
              <video
                ref={videoRef}
                src="/extension-installtion.mp4"
                className="w-full h-full object-contain"
                autoPlay
                muted={isMuted}
                loop
                playsInline
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onPlay={() => {
                  setIsPlaying(true);
                  if (videoRef.current) {
                    videoRef.current.playbackRate = playbackSpeed;
                  }
                }}
                onPause={() => setIsPlaying(false)}
                onClick={togglePlay}
              />

              {/* Big Centered Play/Pause Overlay Indicator on Hover */}
              {!isPlaying && (
                <button
                  onClick={togglePlay}
                  className="absolute inset-0 m-auto w-16 h-16 rounded-full bg-black/60 backdrop-blur-md border border-white/20 flex items-center justify-center text-white shadow-xl hover:scale-110 transition-transform cursor-pointer"
                  aria-label="Play Video"
                >
                  <Play className="w-7 h-7 fill-white ml-1" />
                </button>
              )}

              {/* Bottom Custom Controls Bar */}
              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-3 pt-6 flex flex-col gap-2 transition-opacity duration-200">
                {/* Scrubbing Bar */}
                <div
                  className="w-full h-1.5 bg-white/20 hover:h-2.5 rounded-full cursor-pointer transition-all relative overflow-hidden"
                  onClick={handleSeek}
                >
                  <div
                    className="h-full bg-rose-500 transition-all rounded-full"
                    style={{ width: `${progress}%` }}
                  />
                </div>

                {/* Control Buttons */}
                <div className="flex items-center justify-between text-xs text-white/90">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={togglePlay}
                      className="p-1.5 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
                      title={isPlaying ? 'Pause' : 'Play'}
                    >
                      {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
                    </button>

                    <button
                      onClick={toggleMute}
                      className="p-1.5 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
                      title={isMuted ? 'Unmute' : 'Mute'}
                    >
                      {isMuted ? <VolumeX className="w-4 h-4 text-white/60" /> : <Volume2 className="w-4 h-4" />}
                    </button>

                    <button
                      onClick={restartVideo}
                      className="p-1.5 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
                      title="Restart"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>

                    <span className="font-mono text-[11px] text-white/70 ml-1">
                      {formatTime(currentTime)} / {formatTime(duration)}
                    </span>
                  </div>

                  {/* Playback Speed Switcher */}
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-white/60 font-mono mr-1 hidden sm:inline">Speed:</span>
                    {[1, 1.25, 1.5, 2].map((speed) => (
                      <button
                        key={speed}
                        onClick={() => changeSpeed(speed)}
                        className={`px-2 py-0.5 rounded text-[10px] font-mono transition-all ${
                          playbackSpeed === speed
                            ? 'bg-rose-500 text-white font-bold shadow-xs'
                            : 'bg-white/10 hover:bg-white/20 text-white/80'
                        }`}
                      >
                        {speed}x
                      </button>
                    ))}

                    <button
                      onClick={toggleFullscreen}
                      className="p-1.5 hover:text-white rounded-lg hover:bg-white/10 transition-colors ml-1"
                      title="Fullscreen"
                    >
                      <Maximize2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
}
