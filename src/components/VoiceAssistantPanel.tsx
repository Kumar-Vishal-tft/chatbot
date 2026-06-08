'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, X, Play, Pause, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { GoogleGenAI, Modality } from "@google/genai";
import { YHEALTH_PERSONA } from './persona';
import { useWakeLock } from '@/hooks/useWakeLock';
import { activePersonaManager } from '@/persona/PersonaManager';
import { PersonaContextBuilder } from '@/persona/PersonaContextBuilder';
import { useChatStore } from '@/store/chatStore';
import { fetchPredefinedPersona, getOfflineCampaignFocusPrompt } from '@/store/api';
import { captureAnalyticsEvent } from '@/utils/analytics';

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

  // Voice transcription accumulation refs for Langfuse tracing
  const userSpeechAccumulatedRef = useRef<string>("");
  const aiSpeechAccumulatedRef = useRef<string>("");
  const sessionStartTimeRef = useRef<number | null>(null);

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
      captureAnalyticsEvent('voice_recording_completed');
    }
    if (sessionRef.current) {
      try {
        sessionRef.current.close();
      } catch (_) {}
      sessionRef.current = null;

      let durationSeconds = 0;
      if (sessionStartTimeRef.current) {
        durationSeconds = Math.round((Date.now() - sessionStartTimeRef.current) / 1000);
        sessionStartTimeRef.current = null;
      }
      captureAnalyticsEvent('voice_session_ended', { duration_seconds: durationSeconds });
    }
    userSpeechAccumulatedRef.current = "";
    aiSpeechAccumulatedRef.current = "";
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
      captureAnalyticsEvent('voice_recording_started');

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
    userSpeechAccumulatedRef.current = "";
    aiSpeechAccumulatedRef.current = "";

    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) {
      setState('error');
      setConnectionError('Missing NEXT_PUBLIC_GEMINI_API_KEY env key.');
      return;
    }

    try {
      await ensurePlaybackCtx();

      // Retrieve current text chat history
      const activeChatId = useChatStore.getState().activeChatId;
      const allMessages = useChatStore.getState().messages;
      const currentChatMessages = activeChatId ? (allMessages[activeChatId] || []) : [];

      let historyContext = "";
      if (currentChatMessages.length > 0) {
        const recentMessages = currentChatMessages.slice(-10);
        historyContext = recentMessages
          .map(m => `[${m.sender === 'user' ? 'User' : 'Assistant'}]: ${m.content}`)
          .join("\n");
      }

      // Resolve active campaign role focusing prompt
      const utmCampaign = typeof window !== 'undefined' ? sessionStorage.getItem('utm_campaign') || 'default' : 'default';
      let campaignFocusPrompt = "";
      try {
        const backendPersonaPrompt = await fetchPredefinedPersona(utmCampaign);
        if (backendPersonaPrompt) {
          campaignFocusPrompt = backendPersonaPrompt;
        } else {
          campaignFocusPrompt = getOfflineCampaignFocusPrompt(utmCampaign);
        }
      } catch (e) {
        console.warn("Failed to fetch predefined campaign persona in voice assistant:", e);
        campaignFocusPrompt = getOfflineCampaignFocusPrompt(utmCampaign);
      }

      // Initialize GenAI Live API
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: { apiVersion: 'v1alpha' } as any
      });

      const onboardingStep = useChatStore.getState().onboardingStep;
      const onboardingProfile = useChatStore.getState().onboardingProfile;
      const isOnboarding = onboardingStep !== 'completed';

      const hasPersona = !!activePersonaManager.getRawPersona();
      let voiceSystemInstruction = YHEALTH_PERSONA;

      if (isOnboarding) {
        // Build list of already collected vs. missing details
        const collectedList: string[] = [];
        const missingList: string[] = [];
        
        if (onboardingProfile.name) collectedList.push(`Name: ${onboardingProfile.name}`);
        else missingList.push('Name');
        
        if (onboardingProfile.age) collectedList.push(`Age: ${onboardingProfile.age}`);
        else missingList.push('Age');

        if (onboardingProfile.gender) collectedList.push(`Gender: ${onboardingProfile.gender}`);
        else missingList.push('Gender');

        if (onboardingProfile.phone_number) collectedList.push(`Phone number: ${onboardingProfile.phone_number}`);
        else missingList.push('Phone number');

        if (onboardingProfile.health_goal) collectedList.push(`Health goal: ${onboardingProfile.health_goal}`);
        else missingList.push('Health goal');

        if (onboardingProfile.conditions && onboardingProfile.conditions.length > 0) collectedList.push(`Conditions: ${onboardingProfile.conditions.join(', ')}`);
        else missingList.push('Pre-existing medical conditions (optional)');

        if (onboardingProfile.feeling_note) collectedList.push(`Feeling note: ${onboardingProfile.feeling_note}`);
        else missingList.push('How they feel today (optional)');

        voiceSystemInstruction = `You are YHealth AI Assistant. The user is currently in the onboarding and lead registration process.
Your job is to converse with them warmly in real-time and gather the following missing information:
${missingList.map(item => `- ${item}`).join('\n')}

Already collected details (do not ask for these again unless verifying):
${collectedList.map(item => `- ${item}`).join('\n')}

${campaignFocusPrompt}

CRITICAL INSTRUCTIONS:
1. You MUST speak with a natural, warm Indian English voice tone, accent, and pacing (using Indian English speech syntax, polite phrasing like "Kindly share" or "Please let me know", and common Indian medical terms like "acidity", "loose motions", "body pain", "giddiness", or "tension" when appropriate to match typical Indian conversational style and decorum).
2. Be extremely conversational, friendly, and brief (1-2 sentences per turn). Ask for one missing detail at a time. Do NOT list all questions at once.
3. If the user asks general health questions during onboarding, answer them briefly (1-2 sentences) and gently pivot back to collecting the missing details.
4. Once you have collected all details, call the "submitLeadProfile" tool to save and register their profile.
5. After calling the tool, warmly welcome them to YHealth and say that their health profile is now complete.`;
      } else if (hasPersona) {
        const clinicalContextBlock = PersonaContextBuilder.buildContext("voice session initialized", activePersonaManager);
        voiceSystemInstruction = `${YHEALTH_PERSONA}

### ACTIVE PATIENT CLINICAL HISTORY & RECORD CONTEXT:
${clinicalContextBlock}

CRITICAL RULES FOR RESPONSES:
1. You are communicating via real-time speech. Keep your responses extremely short, concise, and natural (1-3 sentences max). Never output long explanations, markdown lists, bullet points, or complex tables because they are hard to understand when spoken!
2. You MUST speak with a natural, warm Indian English voice tone, accent, and pacing (using Indian English speech syntax, polite phrasing like "Kindly share" or "Please let me know", and common Indian medical terms like "acidity", "loose motions", "body pain", "giddiness", or "tension" when appropriate to match typical Indian conversational style and decorum).
3. Suggest consulting Samarth Gupta (Endocrinologist) when relevant.
4. Be supportive and acknowledge their efforts, emphasizing low-glycemic eating and stress reduction.
5. If they ask about their doctor, mention Dr. Samarth Gupta as their endocrinologist lead.
6. Address the patient warmly by their name (e.g. Lisha).`;
      } else {
        // Guest user who finished onboarding but has no custom persona yet
        voiceSystemInstruction = `${YHEALTH_PERSONA}

${campaignFocusPrompt}

CRITICAL RULES FOR RESPONSES:
1. You are communicating via real-time speech. Keep your responses extremely short, concise, and natural (1-3 sentences max). Never output long explanations, markdown lists, bullet points, or complex tables because they are hard to understand when spoken!
2. You MUST speak with a natural, warm Indian English voice tone, accent, and pacing (using Indian English speech syntax, polite phrasing like "Kindly share" or "Please let me know", and common Indian medical terms like "acidity", "loose motions", "body pain", "giddiness", or "tension" when appropriate to match typical Indian conversational style and decorum).`;
      }

      const userName = useChatStore.getState().userName;

      if (userName && !isOnboarding) {
        voiceSystemInstruction += `\n\n### USER PROFILE:\nThe user's name is ${userName}. You MUST address them warmly by their name in your greeting and responses.`;
      }

      if (historyContext) {
        voiceSystemInstruction += `\n\n### RECENT TEXT CHAT HISTORY CONTEXT:\nThe user has been chatting with you via text in this active session. Keep this history context in mind so you don't repeat yourself and can reference previous messages if asked:\n${historyContext}`;
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
          tools: isOnboarding ? ([{
            functionDeclarations: [
              {
                name: 'submitLeadProfile',
                description: 'Call this function to save and submit the patient\'s onboarding/lead details. Use this once you have collected name, age, phone number, gender, health goal, pre-existing conditions, and how they feel today.',
                parameters: {
                  type: 'OBJECT',
                  properties: {
                    name: { type: 'STRING', description: 'Patient name' },
                    age: { type: 'INTEGER', description: 'Patient age' },
                    phone_number: { type: 'STRING', description: 'Patient contact phone number' },
                    gender: { type: 'STRING', description: 'Patient gender' },
                    health_goal: { type: 'STRING', description: 'Patient main health goal' },
                    conditions: {
                      type: 'ARRAY',
                      items: { type: 'STRING' },
                      description: 'Pre-existing medical conditions (e.g. Type 2 Diabetes, Hypertension)'
                    },
                    feeling_note: { type: 'STRING', description: 'Note on how they are feeling today' }
                  },
                  required: ['name', 'age', 'phone_number', 'gender', 'health_goal']
                }
              }
            ]
          }] as any) : undefined,
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
        callbacks: {
          onopen: () => {
            setState('listening');
            sessionStartTimeRef.current = Date.now();
            captureAnalyticsEvent('voice_session_started');
            sessionPromise.then(session => {
              sessionRef.current = session;
              
              // Send initial welcome trigger to prompt Gemini to start speaking
              try {
                if (isOnboarding) {
                  session.sendRealtimeInput({
                    text: `User named ${userName || 'guest'} joined the voice session for onboarding. Say a warm, brief welcome and ask them to complete the missing onboarding details, starting with the next missing piece of information.`
                  });
                } else if (currentChatMessages.length > 0) {
                  session.sendRealtimeInput({
                    text: `User named ${userName || 'guest'} transitioned from text chat to voice. Greet them warmly by their name, acknowledge this transition, and address their latest point in the text chat in a warm, brief 1-sentence welcome.`
                  });
                } else {
                  session.sendRealtimeInput({
                    text: `User named ${userName || 'guest'} joined the voice session. Say a warm, brief 1-sentence welcome greeting them by their name and inviting them to share their concern today.`
                  });
                }
              } catch (e) {}
              
              startMic();
            });
          },

          onmessage: async (msg: any) => {
            // Handle tool calls from the model
            if (msg.toolCall?.functionCalls) {
              const calls = msg.toolCall.functionCalls;
              for (const call of calls) {
                if (call.name === 'submitLeadProfile') {
                  const args = call.args || {};
                  
                  // 1. Immediately send function response back to Gemini Live socket to avoid any delay
                  sessionPromise.then(session => {
                    try {
                      session.sendToolResponse({
                        functionResponses: [{
                          id: call.id,
                          name: call.name,
                          response: { 
                            success: true,
                            message: "Onboarding and lead registration completed successfully. Please warmly thank the user by their name and welcome them to YHealth!"
                          }
                        }]
                      });
                    } catch (e) {
                      console.error('Failed to send tool response:', e);
                    }
                  });

                  // 2. Perform all backend/state updates asynchronously in the background so the user experience is completely smooth and unblocked
                  setTimeout(() => {
                    const store = useChatStore.getState();
                    const completeProfile = {
                      name: args.name || store.onboardingProfile.name || '',
                      age: String(args.age || store.onboardingProfile.age || ''),
                      phone_number: args.phone_number || store.onboardingProfile.phone_number || '',
                      gender: args.gender || store.onboardingProfile.gender || '',
                      health_goal: args.health_goal || store.onboardingProfile.health_goal || 'General wellness',
                      conditions: args.conditions || store.onboardingProfile.conditions || [],
                      feeling_note: args.feeling_note || store.onboardingProfile.feeling_note || '',
                      mobile_verified: true
                    };

                    const sessionUUID = store.sessionId || store.activeChatId || '';
                    const ageNum = parseInt(String(completeProfile.age)) || 0;

                    // Lead submission to backend
                    fetch('/api/leads', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({
                        session_id: sessionUUID,
                        name: completeProfile.name,
                        age: ageNum,
                        phone_number: completeProfile.phone_number,
                        gender: completeProfile.gender,
                        additional_details: {
                          health_goal: completeProfile.health_goal,
                          conditions: completeProfile.conditions,
                          feeling_note: completeProfile.feeling_note,
                          utm_campaign: store.utm_campaign || sessionStorage.getItem('utm_campaign') || 'default',
                        }
                      })
                    })
                    .then(async (res) => {
                      if (res.ok) {
                        console.log('Lead captured via Voice and sent to backend successfully:', await res.json());
                      }
                    })
                    .catch(err => {
                      console.error('Failed to submit voice lead:', err);
                    });

                    // Save to localStorage
                    if (typeof window !== 'undefined') {
                      localStorage.setItem('yhealth_lead_v1', JSON.stringify({
                        name: completeProfile.name,
                        timestamp: new Date().toISOString(),
                        onboarding: completeProfile,
                      }));
                    }

                    // Update Zustand store
                    store.setOnboardingProfile(completeProfile);
                    store.setUserName(completeProfile.name);
                    store.setOnboardingStep('completed');
                    store.setIsVerified(true);

                    // Sync details to text chat history
                    let activeId = store.activeChatId;
                    if (!activeId && store.chatSessions.length > 0) {
                      activeId = store.chatSessions[0].id;
                    }

                    if (activeId) {
                      const conditionsSummary =
                        completeProfile.conditions && completeProfile.conditions.length > 0
                          ? completeProfile.conditions.join(', ')
                          : 'None mentioned';

                      const confirmationMsg = `You're all set, **${completeProfile.name || 'there'}**! 🎉 (Profile gathered via Voice)\n\nHere's a quick look at your profile:\n*   **Age / Gender:** ${completeProfile.age || '—'} / ${completeProfile.gender || '—'}\n*   **Phone:** ${completeProfile.phone_number || '—'}\n*   **Health Goal:** ${completeProfile.health_goal || 'General wellness'}\n*   **Conditions:** ${conditionsSummary}\n*   **Additional Note:** ${completeProfile.feeling_note || 'None'}\n\nWhat would you like to explore today?\n\n[FollowUps: Check Symptoms | Analyze Report | Diet Guidance | Medicine Help]`;

                      const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                      const systemBotMsg = {
                        id: Math.random().toString(36).substring(7),
                        sender: 'assistant' as const,
                        content: confirmationMsg,
                        timestamp,
                      };

                      useChatStore.setState((state) => {
                        const nextMessages = {
                          ...state.messages,
                          [activeId!]: [...(state.messages[activeId!] || []), systemBotMsg]
                        };

                        if (typeof window !== 'undefined') {
                          localStorage.setItem('yhealth_chats_v1', JSON.stringify(nextMessages));
                        }

                        fetch('/api/session/save', {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                          },
                          body: JSON.stringify({
                            sessionId: sessionUUID,
                            sessions: state.chatSessions,
                            messages: nextMessages,
                          })
                        }).catch(err => console.error('Failed to sync session to backend:', err));

                        return { messages: nextMessages };
                      });
                    }
                  }, 0);
                }
              }
            }

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
              userSpeechAccumulatedRef.current += userSpeech;
            }

            // AI Speech transcription preview
            const aiSpeech = msg.serverContent?.modelTurn?.parts?.[0]?.text;
            if (aiSpeech) {
              setTranscript(aiSpeech);
              aiSpeechAccumulatedRef.current += aiSpeech;
            }

            // If model completes turn, restore listening state
            if (msg.serverContent?.turnComplete) {
              setState('listening');
              setAudioVolume(0);

              const inputContent = userSpeechAccumulatedRef.current.trim();
              const outputContent = aiSpeechAccumulatedRef.current.trim();

              if (inputContent || outputContent) {
                const store = useChatStore.getState();
                const activeId = store.activeChatId || store.sessionId || 'voice-session';

                fetch('/api/trace', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    name: 'voice-interaction',
                    input: inputContent || '[Voice session initialized]',
                    output: outputContent,
                    model: GEMINI_LIVE_MODEL,
                    userId: store.userName || 'anonymous',
                    sessionId: activeId,
                  })
                }).catch(err => console.warn('Langfuse voice tracing failed:', err));
              }

              // Reset accumulated refs for the next turn
              userSpeechAccumulatedRef.current = "";
              aiSpeechAccumulatedRef.current = "";
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

  const handleCloseSession = useCallback(() => {
    const store = useChatStore.getState();
    const activeId = store.activeChatId || store.sessionId || 'voice-session';
    
    // 1. Gather all profile details
    const name = store.onboardingProfile?.name || store.userName || 'Anonymous';
    const age = parseInt(String(store.onboardingProfile?.age)) || 0;
    const gender = store.onboardingProfile?.gender || '';
    const phoneNumber = store.onboardingProfile?.phone_number || '';
    const utmCampaign = store.utm_campaign || (typeof window !== 'undefined' ? sessionStorage.getItem('utm_campaign') : null) || 'default';
    
    const additionalDetails = {
      health_goal: store.onboardingProfile?.health_goal || '',
      conditions: store.onboardingProfile?.conditions || [],
      feeling_note: store.onboardingProfile?.feeling_note || ''
    };

    // 2. Gather history/chat data
    const msgs = activeId ? (store.messages[activeId] || []) : [];
    const chatPairs: { user: string; agent: string }[] = [];

    for (let i = 0; i < msgs.length; i++) {
      if (msgs[i].sender === 'user') {
        const userContent = msgs[i].content;
        let agentContent = '';
        for (let j = i + 1; j < msgs.length; j++) {
          if (msgs[j].sender === 'assistant') {
            agentContent = msgs[j].content;
            break;
          }
        }
        chatPairs.push({
          user: userContent,
          agent: agentContent,
        });
      }
    }

    // 3. Send payload to backend via Next.js proxy route
    fetch(`/api/leads/${activeId}/session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'accept': 'application/json',
      },
      body: JSON.stringify({
        name,
        age,
        gender: gender.toLowerCase(),
        phone_number: phoneNumber,
        session_id: activeId,
        utm_campaign: utmCampaign,
        history: chatPairs,
        additional_details: additionalDetails
      })
    })
    .then(async (res) => {
      if (res.ok) {
        console.log('Voice session data synced to backend successfully on close:', await res.json());
      } else {
        console.warn('Failed to sync voice session data to backend on close:', res.status, await res.text());
      }
    })
    .catch((err) => {
      console.error('Error syncing voice session data on close:', err);
    });

    // 4. Finally trigger standard onClose callback
    onClose();
  }, [onClose]);

  const handleTryClose = () => {
    triggerHaptic(15);
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    // Only show confirmation alert on mobile screens when actively listening with some input
    if (isMobile && state === 'listening' && transcript.length > 5) {
      setShowConfirmClose(true);
    } else {
      handleCloseSession();
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
                  {state === 'connecting' ? 'Connecting to YHealth...' :
                   state === 'listening' ? 'Listening...' :
                   state === 'speaking' ? 'YHealth is speaking...' :
                   state === 'error' ? 'Connection Error' : 'Ready'}
                </span>
              </div>
              
              <div className="flex items-center gap-2">
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
                  handleCloseSession();
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
