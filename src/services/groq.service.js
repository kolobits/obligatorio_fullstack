const axios = require("axios");

const MODEL = "openai/gpt-oss-20b";
const ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";

const askGroq = async (prompt) => {
    const API_KEY = process.env.GROQ_API_KEY;

    const headers = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${API_KEY}`,
    };

    const body = {
        model: MODEL,
        messages: [
            { role: "user", content: prompt }
        ]
    };

    const response = await axios.post(ENDPOINT, body, { headers });

    return response.data;
};

const extraerTexto = (data) => {
    return data.choices?.[0]?.message?.content || "";
};

module.exports = { askGroq, extraerTexto };