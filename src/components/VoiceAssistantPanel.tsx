'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, X, Play, Pause, Volume2, VolumeX, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { GoogleGenAI, Modality } from "@google/genai";
import { YHEALTH_PERSONA } from './persona';
import { useWakeLock } from '@/hooks/useWakeLock';
import { activePersonaManager } from '@/persona/PersonaManager';
import { PersonaContextBuilder } from '@/persona/PersonaContextBuilder';

// Types of voice states
export type VoiceState = 'idle' | 'connecting' | 'listening' | 'paused' | 'thinking' | 'speaking' | 'error';

interface VoiceAssistantPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSendQuery: (query: string) => void;
  isAISpeaking?: boolean;
}

const GEMINI_LIVE_MODEL = "gemini-3.1-flash-live-preview";
const OUTPUT_SAMPLE_RATE = 24000;
const INPUT_SAMPLE_RATE = 16000;

export default function VoiceAssistantPanel({
  isOpen,
  onClose,
  onSendQuery,
  isAISpeaking = false
}: VoiceAssistantPanelProps) {
  const [state, setState] = useState<VoiceState>('idle');
  const [isMuted, setIsMuted] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [showConfirmClose, setShowConfirmClose] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // Screen Wake Lock support
  const { requestWakeLock, releaseWakeLock } = useWakeLock();

  // Keep screen awake while voice panel is active
  useEffect(() => {
    if (isOpen) {
      requestWakeLock();
    } else {
      releaseWakeLock();
    }
    return () => {
      releaseWakeLock();
    };
  }, [isOpen, state, requestWakeLock, releaseWakeLock]);

  // Audio refs
  const playbackCtxRef = useRef<AudioContext | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const sessionRef = useRef<any>(null);
  const scheduledEndRef = useRef(0);

  // Real-time audio amplitude for waveform syncing (0 to 1 scale)
  const [audioVolume, setAudioVolume] = useState(0);

  // Canvas waveform ref
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameId = useRef<number | null>(null);

  // Trigger tactile haptics if available
  const triggerHaptic = (duration = 15) => {
    if (typeof window !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(duration);
      } catch {}
    }
  };

  const ensurePlaybackCtx = async () => {
    if (!playbackCtxRef.current) {
      playbackCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: OUTPUT_SAMPLE_RATE,
      });
    }
    if (playbackCtxRef.current.state === 'suspended') {
      await playbackCtxRef.current.resume();
    }
    return playbackCtxRef.current;
  };

  const scheduleAudioChunk = useCallback(async (base64Data: string) => {
    if (isMuted) return;
    try {
      const ctx = await ensurePlaybackCtx();
      const binary = atob(base64Data);
      const bytes = Uint8Array.from({ length: binary.length }, (_, i) => binary.charCodeAt(i));
      const pcm16 = new Int16Array(bytes.buffer);
      const float32 = Float32Array.from(pcm16, s => s / 32768.0);

      // Measure volume energy
      let sum = 0;
      for (let i = 0; i < float32.length; i++) {
        sum += float32[i] * float32[i];
      }
      const rms = Math.sqrt(sum / float32.length);
      
      // Update real-time speaker amplitude
      setAudioVolume(Math.min(1.0, rms * 4.5));
      setTimeout(() => setAudioVolume(0), (float32.length / OUTPUT_SAMPLE_RATE) * 1000);

      const buffer = ctx.createBuffer(1, float32.length, OUTPUT_SAMPLE_RATE);
      buffer.getChannelData(0).set(float32);

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);

      const now = ctx.currentTime;
      const startTime = Math.max(now, scheduledEndRef.current);
      source.start(startTime);
      scheduledEndRef.current = startTime + buffer.duration;
    } catch (e) {
      console.error("Error scheduling audio chunk:", e);
    }
  }, [isMuted]);

  const clearAudio = useCallback(() => {
    scheduledEndRef.current = 0;
    if (playbackCtxRef.current) {
      playbackCtxRef.current.close().catch(() => {});
      playbackCtxRef.current = null;
    }
    setAudioVolume(0);
  }, []);

  const teardown = useCallback(() => {
    clearAudio();
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(t => t.stop());
      micStreamRef.current = null;
    }
    if (sessionRef.current) {
      try {
        sessionRef.current.close();
      } catch (_) {}
      sessionRef.current = null;
    }
    setState('idle');
    setAudioVolume(0);
  }, [clearAudio]);

  const startMic = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false
      });
      micStreamRef.current = stream;

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const micCtx = new AudioCtx({ sampleRate: INPUT_SAMPLE_RATE });
      const source = micCtx.createMediaStreamSource(stream);
      const processor = micCtx.createScriptProcessor(1024, 1, 1);

      source.connect(processor);
      processor.connect(micCtx.destination);

      processor.onaudioprocess = (e) => {
        if (!sessionRef.current) return;
        const inputData = e.inputBuffer.getChannelData(0);
        const pcm16 = new Int16Array(inputData.length);
        
        // Measure microphone input volume level for waveform animation
        let sum = 0;
        for (let i = 0; i < inputData.length; i++) {
          pcm16[i] = Math.max(-1, Math.min(1, inputData[i])) * 0x7fff;
          sum += inputData[i] * inputData[i];
        }

        const rms = Math.sqrt(sum / inputData.length);
        if (state === 'listening') {
          // Feed microphone volume directly into the wave graphics
          setAudioVolume(Math.min(1.0, rms * 5.0));
        }

        const u8 = new Uint8Array(pcm16.buffer);
        let binary = '';
        for (let i = 0; i < u8.length; i++) {
          binary += String.fromCharCode(u8[i]);
        }
        const base64 = btoa(binary);

        try {
          sessionRef.current.sendRealtimeInput({
            audio: { data: base64, mimeType: `audio/pcm;rate=${INPUT_SAMPLE_RATE}` },
          });
        } catch (err) {}
      };
    } catch (err: any) {
      console.error('Mic access denied:', err);
      setState('error');
      setConnectionError('Microphone access denied. Please check permissions.');
      teardown();
    }
  };

  const startConnection = useCallback(async () => {
    setState('connecting');
    setConnectionError(null);

    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) {
      setState('error');
      setConnectionError('Missing NEXT_PUBLIC_GEMINI_API_KEY env key.');
      return;
    }

    try {
      await ensurePlaybackCtx();

      // Initialize GenAI Live API
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: { apiVersion: 'v1alpha' } as any
      });

      const hasPersona = !!activePersonaManager.getRawPersona();
      let voiceSystemInstruction = YHEALTH_PERSONA;

      if (hasPersona) {
        const clinicalContextBlock = PersonaContextBuilder.buildContext("voice session initialized", activePersonaManager);
        voiceSystemInstruction = `${YHEALTH_PERSONA}

### ACTIVE PATIENT CLINICAL HISTORY & RECORD CONTEXT:
${clinicalContextBlock}

CRITICAL RULES FOR RESPONSES:
1. You are communicating via real-time speech. Keep your responses extremely short, concise, and natural (1-3 sentences max). Never output long explanations, markdown lists, bullet points, or complex tables because they are hard to understand when spoken!
2. You MUST speak with a natural, warm Indian English voice tone and pacing (natural rhythm, fillers, and professional Indian medical conversational decorum) as specified in the speech instructions above.
3. Suggest consulting Samarth Gupta (Endocrinologist) when relevant.
4. Be supportive and acknowledge their efforts, emphasizing low-glycemic eating and stress reduction.
5. If they ask about their doctor, mention Dr. Samarth Gupta as their endocrinologist lead.
6. Address the patient warmly by their name (e.g. Lisha).`;
      }

      const sessionPromise = ai.live.connect({
        model: GEMINI_LIVE_MODEL,
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Aoede' } }, // Aoede (Expressive female)
          },
          systemInstruction: {
            parts: [{
              text: voiceSystemInstruction
            }]
          },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
        callbacks: {
          onopen: () => {
            setState('listening');
            sessionPromise.then(session => {
              sessionRef.current = session;
              
              // Send initial welcome trigger to prompt Gemini to start speaking
              try {
                session.sendRealtimeInput({
                  text: 'User joined the voice session. Say a warm, brief 1-sentence welcome inviting them to share their concern today.'
                });
              } catch (e) {}
              
              startMic();
            });
          },

          onmessage: async (msg: any) => {
            // 1. Play returned model voice audio
            const audio = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audio) {
              setState('speaking');
              scheduleAudioChunk(audio);
            }

            // 2. Handle interruption
            if (msg.serverContent?.interrupted) {
              clearAudio();
              setState('listening');
            }

            // 3. Process Live Transcriptions
            // User Speech transcription
            const userSpeech = msg.inputAudioTranscription?.parts?.[0]?.text;
            if (userSpeech) {
              setTranscript(userSpeech);
            }

            // AI Speech transcription preview
            const aiSpeech = msg.serverContent?.modelTurn?.parts?.[0]?.text;
            if (aiSpeech) {
              setTranscript(aiSpeech);
            }

            // If model completes turn, restore listening state
            if (msg.serverContent?.turnComplete) {
              setState('listening');
              setAudioVolume(0);
            }
          },

          onerror: (err: any) => {
            console.error('Live API error:', err);
            setState('error');
            setConnectionError('Connection lost. Please try again.');
            teardown();
          },

          onclose: () => {
            teardown();
          }
        }
      });

      await sessionPromise;

    } catch (err: any) {
      console.error('Failed to connect to Gemini Live:', err);
      setState('error');
      setConnectionError(err.message || 'Connection failed.');
      teardown();
    }
  }, [scheduleAudioChunk, clearAudio, teardown]);

  // Reset transcript and connect on fresh open
  useEffect(() => {
    if (isOpen) {
      setTranscript('');
      setConnectionError(null);
      triggerHaptic(20);
      startConnection();
    } else {
      teardown();
      setTranscript('');
      setShowConfirmClose(false);
    }
    return () => teardown();
  }, [isOpen, startConnection, teardown]);

  // Visual Waveform Animation Canvas loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let phase = 0;
    
    // Auto resize canvas resolution for high-DPI displays
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;

    const render = () => {
      ctx.clearRect(0, 0, width, height);
      phase += 0.08;

      // Draw multi-layered sine waves based on active voice state & volume amplitude
      let numWaves = 3;
      let amplitude = 0;
      let frequency = 0.015;
      let speedFactor = 1;

      if (state === 'listening') {
        // Base listening pulse + direct mic audio level!
        amplitude = 6 + audioVolume * 32;
        frequency = 0.02;
        numWaves = 4;
        speedFactor = 1.1;
      } else if (state === 'speaking') {
        // Direct speaker audio volume level!
        amplitude = 8 + audioVolume * 40;
        frequency = 0.025;
        numWaves = 5;
        speedFactor = 1.4;
      } else if (state === 'connecting') {
        amplitude = 4;
        frequency = 0.01;
        numWaves = 2;
        speedFactor = 0.5;
      } else {
        // paused or idle -> flat line
        amplitude = 0.5;
        frequency = 0.005;
        numWaves = 1;
        speedFactor = 0.1;
      }

      ctx.lineWidth = 2.5;
      const isDarkMode = document.documentElement.classList.contains('dark');

      for (let i = 0; i < numWaves; i++) {
        ctx.beginPath();
        const wavePhase = phase * speedFactor + i * Math.PI / numWaves;
        
        // Colors: Sleek dark grey/black on light, Clean silver/white on dark
        const opacity = (1 - (i / numWaves)) * 0.45;
        ctx.strokeStyle = isDarkMode 
          ? `rgba(255, 255, 255, ${opacity})`
          : `rgba(17, 17, 17, ${opacity})`;

        for (let x = 0; x < width; x++) {
          // Centered sine wave envelope (taper off at edges)
          const envelope = Math.sin((x / width) * Math.PI);
          const y = height / 2 + Math.sin(x * frequency + wavePhase) * amplitude * envelope;
          if (x === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();
      }

      animationFrameId.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
    };
  }, [state, audioVolume]);

  // Action Handlers
  const handleToggleMute = () => {
    triggerHaptic(15);
    setIsMuted(!isMuted);
    if (!isMuted) {
      clearAudio();
    }
  };

  const handleTryClose = () => {
    triggerHaptic(15);
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    // Only show confirmation alert on mobile screens when actively listening with some input
    if (isMobile && state === 'listening' && transcript.length > 5) {
      setShowConfirmClose(true);
    } else {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-end md:items-center justify-center bg-black/30 dark:bg-black/60 backdrop-blur-md p-0 md:p-4 animate-fade-in">
      
      {/* Background tap dismissal */}
      <div className="absolute inset-0" onClick={handleTryClose} />

      <AnimatePresence>
        {!showConfirmClose ? (
          <motion.div
            initial={{ y: "100%", opacity: 0.8 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: 'spring', damping: 26, stiffness: 220 }}
            className="relative w-full md:max-w-[480px] bg-white dark:bg-[#121212] 
              border border-black/[0.06] dark:border-white/[0.08]
              rounded-t-[28px] md:rounded-[28px] shadow-2xl overflow-hidden
              h-[52vh] md:h-auto flex flex-col z-10 p-6 select-none"
          >
            {/* Minimal Drag Notch */}
            <div className="md:hidden w-12 h-1 rounded-full bg-neutral-200 dark:bg-neutral-800 mx-auto -mt-2 mb-4" />

            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  {(state === 'listening' || state === 'speaking') && (
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  )}
                  <span className={`relative inline-flex rounded-full h-2 w-2 ${
                    state === 'listening' ? 'bg-emerald-500' :
                    state === 'speaking' ? 'bg-indigo-500' :
                    state === 'connecting' ? 'bg-amber-500' :
                    state === 'error' ? 'bg-red-500' : 'bg-neutral-400'
                  }`} />
                </span>
                <span className="text-[11px] font-extrabold uppercase tracking-widest text-neutral-400 dark:text-neutral-500">
                  {state === 'connecting' ? 'Connecting to Pravakta Stack...' :
                   state === 'listening' ? 'Listening...' :
                   state === 'speaking' ? 'YHealth is speaking...' :
                   state === 'error' ? 'Connection Error' : 'Ready'}
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                {/* Clean inline Mute button */}
                <button
                  onClick={handleToggleMute}
                  className={`w-8 h-8 rounded-full flex items-center justify-center border border-black/10 dark:border-white/10 hover:bg-neutral-50 dark:hover:bg-white/[0.03] transition cursor-pointer ${
                    isMuted ? 'bg-red-500 text-white border-transparent' : 'text-neutral-400 hover:text-black dark:hover:text-white'
                  }`}
                  title={isMuted ? "Unmute AI speaker" : "Mute AI speaker"}
                >
                  {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                </button>

                <button
                  onClick={handleTryClose}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-neutral-400 hover:text-black dark:hover:text-white bg-neutral-50 dark:bg-white/[0.03] hover:bg-neutral-100 dark:hover:bg-white/[0.08] transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Body - Center large mic button with volumetric dynamic pulse */}
            <div className="flex-1 flex flex-col items-center justify-center py-6 relative">
              
              <div className="relative w-28 h-28 flex items-center justify-center">
                
                {/* Breathing volumetric outer glows synced to audioVolume */}
                <AnimatePresence>
                  {(state === 'listening' || state === 'speaking') && (
                    <>
                      <motion.div
                        animate={{ scale: 1.1 + audioVolume * 0.45 }}
                        transition={{ duration: 0.15, ease: "easeOut" }}
                        className="absolute inset-0 rounded-full border border-black/10 dark:border-white/10"
                      />
                      <motion.div
                        animate={{ scale: 1.02 + audioVolume * 0.25 }}
                        transition={{ duration: 0.1, ease: "easeOut" }}
                        className="absolute inset-0 rounded-full bg-black/[0.02] dark:bg-white/[0.02]"
                      />
                    </>
                  )}
                </AnimatePresence>

                {/* Main Mic Button Target - 80px circle */}
                <motion.div
                  animate={(state === 'listening' || state === 'speaking') ? {
                    scale: 1 + audioVolume * 0.08,
                    boxShadow: [
                      '0 4px 20px rgba(0,0,0,0.05)',
                      '0 10px 30px rgba(0,0,0,0.08)',
                      '0 4px 20px rgba(0,0,0,0.05)'
                    ]
                  } : { scale: 1 }}
                  transition={{ duration: 0.15 }}
                  className={`w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 relative z-10 cursor-pointer ${
                    state === 'listening'
                      ? 'bg-black text-white dark:bg-white dark:text-black shadow-lg'
                      : state === 'speaking'
                        ? 'bg-indigo-600 text-white dark:bg-indigo-500 shadow-lg'
                        : 'bg-neutral-100 text-neutral-400 dark:bg-white/[0.04]'
                  }`}
                >
                  <Mic className={`w-8 h-8 ${state === 'listening' ? 'stroke-[2.5]' : ''}`} />
                </motion.div>
              </div>

              {/* Real dynamic audio-synced waveform */}
              <div className="w-full h-16 mt-4 relative">
                <canvas ref={canvasRef} className="w-full h-full block" />
              </div>

              {/* Real-time Transcription Stream */}
              <div className="w-full max-w-[340px] text-center min-h-[48px] px-4 mt-2">
                {state === 'error' ? (
                  <p className="text-xs font-semibold text-red-500">
                    {connectionError || 'An error occurred during secure connection setup.'}
                  </p>
                ) : (
                  <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200 leading-relaxed italic">
                    {transcript ? `"${transcript}"` : 
                     state === 'connecting' ? 'Initializing voice channel...' : 
                     'Say something, I am listening...'}
                  </p>
                )}
              </div>
            </div>

            {/* Bottom Spacer */}
            <div className="h-4" />

          </motion.div>
        ) : (
          /* Confirmation SafeGuard Modal */
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="w-full max-w-[340px] bg-white dark:bg-[#151515] border border-black/10 dark:border-white/10 rounded-[24px] shadow-2xl p-6 z-20 mx-4"
          >
            <div className="flex items-center gap-3 text-red-500 mb-3">
              <AlertCircle className="w-6 h-6 flex-shrink-0" />
              <h3 className="font-extrabold text-sm text-neutral-900 dark:text-white uppercase tracking-wider">End voice session?</h3>
            </div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed mb-5">
              You are currently connected to the live session. Are you sure you want to end this voice call?
            </p>
            <div className="flex justify-end gap-3.5">
              <button
                onClick={() => {
                  triggerHaptic(10);
                  setShowConfirmClose(false);
                }}
                className="px-4 py-2 rounded-full text-xs font-bold text-neutral-500 dark:text-neutral-400 hover:text-black dark:hover:text-white transition cursor-pointer"
              >
                Keep talking
              </button>
              <button
                onClick={() => {
                  triggerHaptic(15);
                  onClose();
                }}
                className="px-4 py-2 rounded-full bg-red-500 hover:bg-red-600 text-white text-xs font-extrabold transition cursor-pointer"
              >
                End Call
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
