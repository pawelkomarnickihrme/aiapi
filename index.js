const express = require("express");
const axios = require("axios");
const NodeCache = require("node-cache");
const rateLimit = require("express-rate-limit");
const winston = require("winston");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 3000;
const cache = new NodeCache({ stdTTL: 600 }); // Cache na 10 minut

app.use(express.json());

// Konfiguracja limitera zapytań
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minut
  max: 100, // limit 100 zapytań na 15 minut
});

app.use("/api/", limiter);

// Konfiguracja loggera
const logger = winston.createLogger({
  level: "info",
  format: winston.format.json(),
  defaultMeta: { service: "perplexity-service" },
  transports: [
    new winston.transports.File({ filename: "error.log", level: "error" }),
    new winston.transports.File({ filename: "combined.log" }),
  ],
});

// Endpoint do obsługi zapytań Perplexity AI
app.post("/api/query", async (req, res) => {
  try {
    const { query } = req.body;

    // Sprawdź, czy odpowiedź jest w cache
    const cachedResponse = cache.get(query);
    if (cachedResponse) {
      return res.json(cachedResponse);
    }

    // Jeśli nie ma w cache, zapytaj Perplexity AI API
    const perplexityResponse = await axios.post(
      "https://api.perplexity.ai/chat/completions",
      {
        model: "mistral-7b-instruct", // Dostosuj model według potrzeb
        messages: [
          { role: "system", content: "You are a helpful assistant." },
          { role: "user", content: query },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.PERPLEXITY_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    // Zapisz odpowiedź w cache
    cache.set(query, perplexityResponse.data);

    res.json(perplexityResponse.data);
  } catch (error) {
    logger.error("Błąd:", error);
    res
      .status(500)
      .json({ error: "Wystąpił błąd podczas przetwarzania zapytania" });
  }
});

// Obsługa błędów
app.use((err, req, res, next) => {
  logger.error(err.stack);
  res.status(500).send("Coś poszło nie tak!");
});

app.listen(port, () => {
  console.log(`Usługa pośrednicząca Perplexity działa na porcie ${port}`);
});
