import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, FileText, Mic } from "lucide-react";

interface Props {
  path: string;
  type: "image" | "audio" | "document";
  mime?: string | null;
  transcription?: string | null;
}

// Genera una URL firmada (1 h) bajo demanda para el adjunto del bucket privado.
const useSignedUrl = (path: string) =>
  useQuery({
    queryKey: ["chat-media-url", path],
    queryFn: async () => {
      const { data, error } = await supabase.storage.from("chat-media").createSignedUrl(path, 3600);
      if (error) throw error;
      return data.signedUrl;
    },
    enabled: !!path,
    staleTime: 50 * 60 * 1000,
  });

const ChatMedia = ({ path, type, mime, transcription }: Props) => {
  const { data: url, isLoading, isError } = useSignedUrl(path);

  if (isLoading) return <div className="flex h-24 items-center justify-center"><Loader2 className="h-4 w-4 animate-spin opacity-60" /></div>;
  if (isError || !url) return <p className="text-xs italic opacity-70">No se pudo cargar el adjunto</p>;

  if (type === "image") {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="block">
        <img src={url} alt="Adjunto" className="max-h-64 w-auto max-w-full rounded-lg object-cover" loading="lazy" />
      </a>
    );
  }

  if (type === "audio") {
    return (
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <Mic className="h-3.5 w-3.5 shrink-0 opacity-70" />
          <audio controls src={url} className="h-8 max-w-full" />
        </div>
        {transcription && (
          <p className="whitespace-pre-wrap break-words border-l-2 border-current/20 pl-2 text-[13px] italic opacity-90">
            "{transcription}"
          </p>
        )}
      </div>
    );
  }

  return (
    <a href={url} target="_blank" rel="noreferrer" className="flex items-center gap-2 underline">
      <FileText className="h-4 w-4" /> Abrir documento
    </a>
  );
};

export default ChatMedia;
