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
        date,
        sleep = null,
        activity = null,
        weather = null,
        recentSleep = null,
      } = request.body || {};

      if (!date) {
        response.status(400).json({error: "Missing date"});
        return;
      }

      const context = {
        date,
        sleep,
        activity,
        weather,
        recentSleep,
      };

      const prompt = `
You are a sleep-context investigation agent for a personal data visualization.

Your task is to examine one selected night in relation to the available behavioral and environmental context. Use only the supplied data. Do not diagnose medical conditions and do not claim that any factor caused the sleep outcome.

Clearly distinguish:
1. OBSERVED — facts directly supported by the supplied data.
2. POSSIBLE PATTERN — cautious associations or comparisons suggested by the data.
3. UNKNOWN — potentially relevant factors that are not present in the dataset, such as caffeine timing, stress, late meals, illness, medication, or screen use.
4. NEXT STEP — 2 or 3 practical, low-risk things the user could track or try next. Suggestions must be conditional and proportionate to the evidence.

If recentSleep is available, compare the selected night with nearby nights and note whether the pattern appears isolated or part of a short run. If activity or weather data are missing, explicitly say so rather than inventing them.

Keep the answer concise and readable for a web interface. Do not exceed about 220 words.

DATA:
${JSON.stringify(context, null, 2)}
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

        const analysis = (openAIResult.output || [])
            .flatMap((item) => item.content || [])
            .find((content) => content.type === "output_text")?.text;

        if (!analysis) {
          response.status(500).json({error: "No analysis returned by OpenAI"});
          return;
        }

        response.json({
          ok: true,
          date,
          analysis,
        });
      } catch (error) {
        console.error("Sleep investigation error:", error);
        response.status(500).json({
          error: "Sleep investigation failed",
          details: error.message,
        });
      }
    },
);
