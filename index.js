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
app.set("trust proxy", 1);
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.ip;
  },
});

app.use("/api/", limiter);

const logger = winston.createLogger({
  level: "info",
  format: winston.format.json(),
  defaultMeta: { service: "perplexity-service" },
  transports: [
    new winston.transports.File({ filename: "error.log", level: "error" }),
    new winston.transports.File({ filename: "combined.log" }),
  ],
});
app.post("/api/query", async (req, res) => {
  try {
    const { query } = req.body;

    const cachedResponse = cache.get(query);
    if (cachedResponse) {
      return res.json(cachedResponse);
    }

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

    cache.set(query, perplexityResponse.data);

    res.json(perplexityResponse.data);
  } catch (error) {
    logger.error("Błąd:", error);
    res.status(500).json({ error });
  }
});

app.use((err, req, res, next) => {
  logger.error(err.stack);
  res.status(500).send("Coś poszło nie tak!");
});

app.listen(port, () => {
  console.log(`Usługa pośrednicząca Perplexity działa na porcie ${port}`);
});
