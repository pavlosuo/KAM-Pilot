"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Square, Loader2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/design-system/ventura-6bef42/components/ui/button";
import { transcribeAudio } from "@/design-system/ventura-6bef42/lib/voice-transcription.functions";
import { cn } from "@/design-system/ventura-6bef42/lib/utils";

interface VoiceTranscribeButtonProps {
  onTranscript: (text: string) => void;
  className?: string;
  onRecordingChange?: (recording: boolean) => void;
  onTranscribingChange?: (transcribing: boolean) => void;
}

export function VoiceTranscribeButton({
  onTranscript,
  className,
  onRecordingChange,
  onTranscribingChange,
}: VoiceTranscribeButtonProps) {
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const transcribe = useServerFn(transcribeAudio);

  useEffect(() => {
    onRecordingChange?.(recording);
  }, [recording, onRecordingChange]);

  useEffect(() => {
    onTranscribingChange?.(transcribing);
  }, [transcribing, onTranscribingChange]);

  const toggle = async () => {
    if (recording) {
      mediaRecorderRef.current?.stop();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/mp4";

      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        setRecording(false);
        stream.getTracks().forEach((track) => track.stop());

        const blob = new Blob(chunksRef.current, { type: mimeType });
        if (blob.size < 100) {
          toast.error("That recording was too short — please try again.");
          return;
        }

        setTranscribing(true);
        try {
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = () => reject(new Error("Failed to read recording"));
            reader.readAsDataURL(blob);
          });

          const text = await transcribe({ data: { audio: base64, mimeType } });
          if (text) {
            onTranscript(text);
          } else {
            toast.error("No speech detected — please try again.");
          }
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "Transcription failed");
        } finally {
          setTranscribing(false);
        }
      };

      recorder.start();
      setRecording(true);
      mediaRecorderRef.current = recorder;
    } catch {
      toast.error("Microphone access is needed to record voice notes.");
    }
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      disabled={transcribing}
      onClick={toggle}
      className={cn(
        "h-8 w-8 rounded-full text-muted-foreground hover:text-foreground",
        recording && "animate-pulse text-red-500 hover:text-red-600",
        className
      )}
      title={recording ? "Stop recording" : "Record voice note"}
    >
      {transcribing ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : recording ? (
        <Square className="h-4 w-4 fill-current" />
      ) : (
        <Mic className="h-4 w-4" />
      )}
    </Button>
  );
}
