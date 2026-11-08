import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

/* Minimal typings for the Web Speech API (not in lib.dom for all targets). */
interface RecognitionResult {
  0: { transcript: string };
  isFinal: boolean;
}
interface RecognitionEvent {
  resultIndex: number;
  results: ArrayLike<RecognitionResult>;
}
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: RecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
}
type RecognitionCtor = new () => Recognition;

function getRecognition(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** ElevenLabs text-to-speech; dictation remains browser-local. */
export function useSpeaker() {
  const [supported, setSupported] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [loading, setLoading] = useState(false);
  const audio = useRef<HTMLAudioElement | null>(null);
  const controller = useRef<AbortController | null>(null);
  const audioUrl = useRef<string | null>(null);
  const clearAudio = useCallback(() => {
    controller.current?.abort();
    controller.current = null;
    if (audio.current) {
      audio.current.pause();
      audio.current.removeAttribute("src");
      audio.current.load();
      audio.current = null;
    }
    if (audioUrl.current) URL.revokeObjectURL(audioUrl.current);
    audioUrl.current = null;
  }, []);
  const stop = useCallback(() => {
    clearAudio();
    setSpeaking(false);
    setLoading(false);
  }, [clearAudio]);
  useEffect(() => {
    setSupported(typeof Audio !== "undefined");
    return clearAudio;
  }, [clearAudio]);
  const speak = useCallback(
    async (text: string) => {
      if (!supported || !text.trim()) return;
      stop();
      const pending = new AbortController();
      controller.current = pending;
      setLoading(true);
      try {
        const response = await fetch("/api/voice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: text.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/[*_#>`]/g, "") }),
          signal: pending.signal,
        });
        if (!response.ok) {
          const result = await response.json().catch(() => null);
          throw new Error(result?.error ?? `Voice playback failed (${response.status}).`);
        }
        const blob = await response.blob();
        if (pending.signal.aborted) return;
        if (!blob.size) throw new Error("ElevenLabs returned no audio. Try the voice button again.");
        audioUrl.current = URL.createObjectURL(blob);
        const player = new Audio(audioUrl.current);
        audio.current = player;
        player.onended = stop;
        player.onerror = () => {
          stop();
          toast.error("Could not play the stakeholder voice. Try the voice button again.");
        };
        await player.play();
        if (pending.signal.aborted) return;
        setLoading(false);
        setSpeaking(true);
      } catch (error) {
        if (pending.signal.aborted) return;
        stop();
        toast.error(error instanceof Error ? error.message : "Could not load the stakeholder voice.");
      }
    },
    [supported, stop],
  );
  return { supported, speaking, loading, speak, stop };
}

/** Browser speech-to-text for answering out loud. */
export function useDictation(onText: (text: string, final: boolean) => void) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const rec = useRef<Recognition | null>(null);
  const cb = useRef(onText);
  cb.current = onText;

  useEffect(() => {
    setSupported(!!getRecognition());
    return () => rec.current?.stop();
  }, []);

  const start = useCallback(() => {
    const Ctor = getRecognition();
    if (!Ctor) return;
    const r = new Ctor();
    r.lang = "en-US";
    r.continuous = true;
    r.interimResults = true;
    let finalText = "";
    r.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) finalText += `${res[0].transcript} `;
        else interim += res[0].transcript;
      }
      cb.current((finalText + interim).trim(), false);
    };
    r.onend = () => {
      setListening(false);
      cb.current(finalText.trim(), true);
    };
    r.onerror = () => setListening(false);
    rec.current = r;
    r.start();
    setListening(true);
  }, []);
  const stop = useCallback(() => rec.current?.stop(), []);
  return { supported, listening, start, stop };
}
