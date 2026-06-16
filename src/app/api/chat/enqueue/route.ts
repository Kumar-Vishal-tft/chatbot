import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis';

export const dynamic = 'force-dynamic';

// Strict prompt for precision lead details extraction using JSON mode
const SYSTEM_PROMPT = `You are a precise clinical lead extractor. Your task is to extract user profile details from the given chat conversation.
Extract the following fields if mentioned by the user:
- name: Full name (string or null)
- phone_number: Phone number / mobile number (string or null)
- age: Age (integer number or null)
- gender: Gender (string or null)
- health_goal: The user's health goal, motive, or target (string or null)
- conditions: Medical conditions, symptoms, or diagnoses (array of strings, or empty array if none)
- program: Recommended program or focus area mentioned, e.g. T1D, general wellness, weight loss, etc. (string or null)

CRITICAL: Return ONLY a valid JSON object. Do not include any markdown styling like \`\`\`json, do not explain anything, do not output any other text than the JSON object.

Example output:
{
  "name": "John Doe",
  "phone_number": "9876543210",
  "age": 34,
  "gender": "male",
  "health_goal": "Manage Type 2 Diabetes",
  "conditions": ["Diabetes", "Hypertension"],
  "program": "T1D"
}`;

function cleanJsonResponse(text: string): string {
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '');
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    cleaned = cleaned.substring(start, end + 1);
  }
  return cleaned.trim();
}

function toValidUUID(id: string): string {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(id)) {
    return id.toLowerCase();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

async function extractLeadInfo(chatHistoryText: string): Promise<any> {
  const GEMINI_API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  if (!GEMINI_API_KEY) {
    console.error('Gemini API key is not configured on the server.');
    return null;
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${GEMINI_API_KEY}`;
  
  const payload = {
    contents: [
      {
        role: 'user',
        parts: [
          { text: `${SYSTEM_PROMPT}\n\nHere is the conversation history:\n${chatHistoryText}` }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.1, // low temperature for high extraction fidelity
      maxOutputTokens: 512,
      responseMimeType: "application/json", // Use JSON response type
      responseSchema: {
        type: "OBJECT",
        properties: {
          name: { type: "STRING" },
          phone_number: { type: "STRING" },
          age: { type: "INTEGER" },
          gender: { type: "STRING" },
          health_goal: { type: "STRING" },
          conditions: {
            type: "ARRAY",
            items: { type: "STRING" }
          },
          program: { type: "STRING" }
        }
      }
    }
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error('Gemini lead extraction request failed:', response.statusText);
      return null;
    }

    const data = await response.json();
    const replyText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (replyText) {
      const cleaned = cleanJsonResponse(replyText);
      return JSON.parse(cleaned);
    }
  } catch (error) {
    console.error('Error calling Gemini for lead extraction:', error);
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const { user_id, session_id, role, message, timestamp, is_existing_patient } = await request.json();

    if (!user_id) {
      return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
    }
    if (!session_id) {
      return NextResponse.json({ error: 'session_id is required' }, { status: 400 });
    }
    if (!role || (role !== 'user' && role !== 'assistant')) {
      return NextResponse.json({ error: 'role must be user or assistant' }, { status: 400 });
    }
    if (!message) {
      return NextResponse.json({ error: 'message is required' }, { status: 400 });
    }

    const msgTimestamp = timestamp || Math.floor(Date.now() / 1000);
    const messageData = {
      role,
      message,
      timestamp: msgTimestamp,
      session_id,
    };

    // 1. Store message in Redis list
    const messagesKey = `chat:user:${user_id}:messages`;
    await redis.rpush(messagesKey, JSON.stringify(messageData));

    // 2. Track patient status (existing patient vs guest/new user)
    const statusKey = `chat:user:${user_id}:is_existing_patient`;
    await redis.set(statusKey, is_existing_patient ? 'true' : 'false');

    // 3. Add user to active_users_zset Sorted Set with timestamp score
    await redis.zadd('active_users_zset', msgTimestamp, user_id);

    // 4. Set/refresh the user activity flag (15 minutes = 900 seconds)
    const activeFlagKey = `chat:user:${user_id}:active`;
    await redis.set(activeFlagKey, 'true', 'EX', 900);

    // 5. Update last activity timestamp
    const lastActivityKey = `chat:user:${user_id}:last_activity`;
    await redis.set(lastActivityKey, msgTimestamp.toString());

    // 6. Lead Capture & Extraction (only triggered on user role messages for new/guest users)
    if (role === 'user' && !is_existing_patient) {
      // Fetch entire enqueued chat history from Redis to extract lead details from context
      const rawHistory = await redis.lrange(messagesKey, 0, -1);
      const formattedHistory = rawHistory.map((mStr) => {
        try {
          const m = JSON.parse(mStr);
          return `${m.role.toUpperCase()}: ${m.message}`;
        } catch {
          return '';
        }
      }).join('\n');

      const extracted = await extractLeadInfo(formattedHistory);
      
      // If LLM successfully extracted lead info
      if (extracted) {
        console.log(`[Lead Extraction] Extracted info for session ${session_id}:`, extracted);

        // Check if lead has name and phone_number (the qualification criteria)
        if (extracted.name && extracted.phone_number) {
          const leadDataKey = `chat:user:${user_id}:lead_data`;
          const existingLeadRaw = await redis.get(leadDataKey);

          let shouldSubmit = false;
          let mergedLead = extracted;

          if (existingLeadRaw) {
            // Already captured before. Check for updates / newly collected fields
            const existing = JSON.parse(existingLeadRaw);
            
            // Check if there is any new information in the extracted data compared to existing
            const hasNewName = extracted.name && extracted.name !== existing.name;
            const hasNewPhone = extracted.phone_number && extracted.phone_number !== existing.phone_number;
            const hasNewAge = extracted.age && extracted.age !== existing.age;
            const hasNewGender = extracted.gender && extracted.gender !== existing.gender;
            const hasNewGoal = extracted.health_goal && extracted.health_goal !== existing.health_goal;
            const hasNewProgram = extracted.program && extracted.program !== existing.program;
            
            const existingConds = new Set(existing.conditions || []);
            const hasNewConds = extracted.conditions && extracted.conditions.some((c: string) => !existingConds.has(c));

            if (hasNewName || hasNewPhone || hasNewAge || hasNewGender || hasNewGoal || hasNewProgram || hasNewConds) {
              shouldSubmit = true;
              // Merge details, keeping the most complete fields
              mergedLead = {
                name: extracted.name || existing.name,
                phone_number: extracted.phone_number || existing.phone_number,
                age: extracted.age || existing.age,
                gender: extracted.gender || existing.gender,
                health_goal: extracted.health_goal || existing.health_goal,
                conditions: Array.from(new Set([...(existing.conditions || []), ...(extracted.conditions || [])])),
                program: extracted.program || existing.program
              };
            }
          } else {
            // New qualification
            shouldSubmit = true;
          }

          if (shouldSubmit) {
            console.log(`[Lead Submission] Submitting lead data to backend for user ${user_id}:`, mergedLead);
            const baseUrl = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
            const leadApiUrl = `${baseUrl.replace(/\/$/, '')}/leads`;
            
            try {
              const res = await fetch(leadApiUrl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'accept': 'application/json'
                },
                body: JSON.stringify({
                  session_id: toValidUUID(session_id),
                  name: mergedLead.name,
                  age: mergedLead.age || 0,
                  phone_number: mergedLead.phone_number,
                  gender: mergedLead.gender || '',
                  additional_details: {
                    health_goal: mergedLead.health_goal || 'General wellness',
                    conditions: mergedLead.conditions || [],
                    program: mergedLead.program || 'default'
                  }
                })
              });

              if (res.ok) {
                console.log(`[Lead Submission] Successfully submitted lead to backend for user ${user_id}`);
                // Store lead data state in Redis to prevent duplicates
                await redis.set(leadDataKey, JSON.stringify(mergedLead));
              } else {
                console.warn(`[Lead Submission] Backend lead registration failed status ${res.status}:`, await res.text());
              }
            } catch (err) {
              console.error(`[Lead Submission] Network error submitting lead:`, err);
            }
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Message successfully enqueued in Redis',
      user_id,
      session_id,
    });
  } catch (error: any) {
    console.error('Redis enqueue message error:', error);
    return NextResponse.json(
      { error: 'Failed to enqueue message to Redis', detail: error.message },
      { status: 500 }
    );
  }
}
