import { useRef, useState, DragEvent, ChangeEvent } from "react";
import { Upload, X, FileAudio, FileImage, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

interface FileUploadZoneProps {
  accept: string;
  acceptLabel: string;
  file: File | null;
  onFileChange: (file: File | null) => void;
  icon?: "audio" | "image" | "document";
}

export function FileUploadZone({
  accept,
  acceptLabel,
  file,
  onFileChange,
  icon = "document",
}: FileUploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const IconComponent =
    icon === "audio" ? FileAudio : icon === "image" ? FileImage : FileText;

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped && isAccepted(dropped)) {
      onFileChange(dropped);
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) onFileChange(selected);
    // reset so the same file can be re-selected
    e.target.value = "";
  };

  const isAccepted = (f: File) => {
    const extensions = accept.split(",").map((s) => s.trim().toLowerCase());
    const name = f.name.toLowerCase();
    return extensions.some((ext) => name.endsWith(ext));
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (file) {
    return (
      <div className="border border-border rounded-lg p-3 flex items-center gap-3 bg-muted/30">
        <IconComponent className="h-8 w-8 text-primary flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{file.name}</p>
          <p className="text-xs text-muted-foreground">{formatSize(file.size)}</p>
        </div>
        <button
          type="button"
          onClick={() => onFileChange(null)}
          className="text-muted-foreground hover:text-destructive transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <>
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={cn(
          "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
          dragOver
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50"
        )}
      >
        <Upload className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">
          Para inserir o arquivo, clique aqui ou arraste o arquivo para esta área.
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Formatos aceitos: {acceptLabel}
        </p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={handleChange}
      />
    </>
  );
}
