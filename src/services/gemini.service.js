const axios = require("axios");

const MODEL = "gemini-3.6-flash";

const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

const askGeminiFlash = async (prompt) => {
    const API_KEY = process.env.GEMINI_API_KEY;

    const headers = {
        "Content-Type": "application/json",
        "x-goog-api-key": API_KEY,
    };

    const body = {
        contents:[
            {parts: [{text: prompt}]}
        ]
    }

    const response = await axios.post(ENDPOINT, body, {headers});

    return response.data;
};

const extraerTexto = (data) => {
    const parts = data.candidates?.[0]?.content?.parts || [];
    return parts.find((p) => p.text)?.text || "";
};

module.exports = { askGeminiFlash, extraerTexto };