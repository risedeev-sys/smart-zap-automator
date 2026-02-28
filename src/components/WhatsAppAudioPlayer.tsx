import { useState, useRef, useEffect } from "react";
import { Play, Pause, Mic } from "lucide-react";

interface WhatsAppAudioPlayerProps {
  src: string;
}

export function WhatsAppAudioPlayer({ src }: WhatsAppAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onLoaded = () => setDuration(audio.duration || 0);
    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onEnded = () => setIsPlaying(false);

    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("ended", onEnded);
    };
  }, []);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    audio.currentTime = pct * duration;
  };

  const formatTime = (sec: number) => {
    if (!sec || !isFinite(sec)) return "0:00";
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="flex items-center gap-2 min-w-[220px] max-w-[280px]">
      <audio ref={audioRef} src={src} preload="metadata" />

      {/* Play/Pause button */}
      <button
        onClick={togglePlay}
        className="h-10 w-10 rounded-full bg-primary flex items-center justify-center flex-shrink-0 hover:bg-primary/90 transition-colors"
      >
        {isPlaying ? (
          <Pause className="h-5 w-5 text-primary-foreground" />
        ) : (
          <Play className="h-5 w-5 text-primary-foreground ml-0.5" />
        )}
      </button>

      {/* Waveform / Progress */}
      <div className="flex-1 space-y-1">
        <div
          className="h-2 bg-muted rounded-full cursor-pointer relative overflow-hidden"
          onClick={handleSeek}
        >
          <div
            className="absolute inset-y-0 left-0 bg-primary/60 rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
          {/* Fake waveform dots */}
          <div className="absolute inset-0 flex items-center justify-between px-0.5">
            {Array.from({ length: 30 }).map((_, i) => (
              <div
                key={i}
                className="w-[2px] rounded-full bg-foreground/20"
                style={{ height: `${3 + Math.sin(i * 0.8) * 3 + Math.random() * 2}px` }}
              />
            ))}
          </div>
        </div>
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Mic icon */}
      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
        <Mic className="h-4 w-4 text-muted-foreground" />
      </div>
    </div>
  );
}
