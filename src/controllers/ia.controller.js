// const { askGeminiFlash } = require("../services/gemini.service");

// const useGeminiFlash = async (req, res) => {
//     try {
//         const prompt = req.body.prompt;

//         if (!prompt) {
//             return res.status(400).json({ error: "Falta el campo 'prompt' en el body" });
//         }

//         const data = await askGeminiFlash(prompt);

//         const parts = data.candidates?.[0]?.content?.parts || [];
//         const finalText = parts.find((p) => p.text)?.text || "";

//         res.json({
//             message: "Gemini 3.6 Flash response",
//             final: finalText,
//             data
//         })
//     } catch (error) {
//         console.error(error?.response?.data || error.message);
//         res.status(500).json({ message: "Error occurred while using Gemini Flash model" });
//     }
// };

// module.exports = { useGeminiFlash };


const { askGroq, extraerTexto } = require("../services/groq.service");

const useGroq = async (req, res) => {
    try {
        const prompt = req.body.prompt;

        if (!prompt) {
            return res.status(400).json({ error: "Falta el campo 'prompt' en el body" });
        }

        const data = await askGroq(prompt);
        const finalText = extraerTexto(data);

        res.json({
            message: "Groq response",
            final: finalText,
            data
        });
    } catch (error) {
        console.error(error?.response?.data || error.message);
        res.status(500).json({ message: "Error occurred while using Groq" });
    }
};

module.exports = { useGroq };