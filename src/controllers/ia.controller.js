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