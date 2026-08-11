const {setGlobalOptions} = require("firebase-functions");
const {onRequest} = require("firebase-functions/https");
const {defineSecret} = require("firebase-functions/params");

setGlobalOptions({maxInstances: 10});

const OPENAI_API_KEY = defineSecret("OPENAI_API_KEY");

exports.investigateSleepNight = onRequest(
    {secrets: [OPENAI_API_KEY]},
    async (request, response) => {
      response.set("Access-Control-Allow-Origin", "*");

      if (request.method === "OPTIONS") {
        response.set("Access-Control-Allow-Methods", "POST");
        response.set("Access-Control-Allow-Headers", "Content-Type");
        response.status(204).send("");
        return;
      }

      if (request.method !== "POST") {
        response.status(405).json({error: "Use POST"});
        return;
      }

      const {
        question,
        selectedDate = null,
        selectedNight = null,
        selectedWeather = null,
        dataset = [],
      } = request.body || {};

      if (!question || !question.trim()) {
        response.status(400).json({error: "Missing question"});
        return;
      }

      if (!Array.isArray(dataset) || dataset.length === 0) {
        response.status(400).json({error: "Missing dataset"});
        return;
      }

      const context = {
        question: question.trim(),
        selectedDate,
        selectedNight,
        selectedWeather,
        dataset,
      };

      const prompt = `
You are a thoughtful, conversational sleep-data analyst inside a personal visualization tool.

Your job is not to sound like a report. Talk like a smart person who has actually looked through the user's data and is explaining what stands out in plain language.

Use only the supplied data, but reason across it carefully. Look for comparisons, contrasts, clusters, unusual dates, shifts in timing, changes in duration, fragmentation, sleep stages, activity, and selected-night weather when relevant.

How to answer:
- Start with the main point, not a disclaimer or summary of the question.
- Be specific. Use concrete dates and numbers when they help.
- Explain what matters and why it is notable in context.
- If several signals point in the same direction, synthesize them instead of listing fields one by one.
- If the evidence is mixed, say that naturally.
- If the user asks a casual follow-up, answer casually and directly.
- If the user asks "why", give the strongest data-supported explanation first, then mention uncertainty only where needed.
- When the question refers to "this night", "tonight", "selected night", or similar wording, use selectedDate and selectedNight.
- When the question is about trends or unusual periods, compare across the full Q4 2025 dataset.
- Do not diagnose medical conditions.
- Do not claim causation from correlation.
- Do not invent missing data.
- Do not pad the answer with generic sleep advice unless the user asks for advice.
- Do not repeatedly say "based on the data" or "the data shows" unless needed.
- Avoid stiff headings like OBSERVED, POSSIBLE PATTERN, UNKNOWN, or NEXT STEP unless the user explicitly asks for a structured breakdown.
- Prefer 2 to 4 short conversational paragraphs. A compact list is fine only when it genuinely makes the answer clearer.

Tone:
- Warm, clear, intelligent, and natural.
- Slightly informal, but not jokey or overly enthusiastic.
- Sound like someone helping the user notice patterns, not like a dashboard narrating itself.

Example style:
Instead of: "Sleep duration was 8.2 hours, which is 1.6 hours above the nearby median."
Say: "The biggest difference is duration: you slept 8.2 hours, about 1.6 hours longer than nearby nights."

Instead of: "Fragmentation was not unusual."
Say: "Your awakenings were pretty typical for that period, so the night looks unusual mainly because it was longer, not because it was more restless."

USER QUESTION:
${context.question}

SELECTED DATE:
${context.selectedDate || "None"}

SELECTED NIGHT:
${JSON.stringify(context.selectedNight, null, 2)}

SELECTED WEATHER:
${JSON.stringify(context.selectedWeather, null, 2)}

Q4 DATASET:
${JSON.stringify(context.dataset, null, 2)}
      `.trim();

      try {
        const openAIResponse = await fetch("https://api.openai.com/v1/responses", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${OPENAI_API_KEY.value()}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-5-mini",
            store: false,
            input: prompt,
          }),
        });

        const openAIResult = await openAIResponse.json();

        if (!openAIResponse.ok) {
          console.error("OpenAI error:", openAIResult);
          response.status(500).json({
            error: "OpenAI request failed",
            details: openAIResult.error?.message || "Unknown OpenAI error",
          });
          return;
        }

        const answer = (openAIResult.output || [])
            .flatMap((item) => item.content || [])
            .find((content) => content.type === "output_text")?.text;

        if (!answer) {
          response.status(500).json({error: "No answer returned by OpenAI"});
          return;
        }

        response.json({
          ok: true,
          selectedDate,
          answer,
        });
      } catch (error) {
        console.error("Sleep agent error:", error);
        response.status(500).json({
          error: "Sleep agent failed",
          details: error.message,
        });
      }
    },
);
