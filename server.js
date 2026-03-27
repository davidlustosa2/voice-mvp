import express from "express";
import cors from "cors";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  app.use(cors());
  app.use(express.json());

  app.post("/api/session", async (req, res) => {
    try {
      const apiKey = process.env.OPENAI_API_KEY;

      if (!apiKey) {
        return res.status(500).json({
          error: "OPENAI_API_KEY não configurada."
        });
      }

      const response = await fetch(
        "https://api.openai.com/v1/realtime/client_secrets",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            session: {
              type: "realtime",
              model: "gpt-realtime-mini",
              instructions: `
Você é um atendente virtual em fase de testes.
Responda sempre em português do Brasil.
Use apenas estas informações:
- Horário de atendimento: segunda a sexta, das 8h às 18h.
- Atendimento humano: pode ser solicitado pelo usuário.
- Este canal está em testes.
Se não souber, diga que ainda está em fase de testes.
`.trim(),
              audio: {
                input: {
                  turn_detection: {
                    type: "server_vad",
                    threshold: 0.5,
                    prefix_padding_ms: 300,
                    silence_duration_ms: 600
                  }
                },
                output: {
                  voice: "marin"
                }
              }
            }
          })
        }
      );

      const text = await response.text();

      if (!response.ok) {
        console.error("Erro OpenAI:", text);
        return res.status(response.status).type("application/json").send(text);
      }

      return res.type("application/json").send(text);
    } catch (error) {
      console.error("Internal Server Error:", error);
      return res.status(500).json({
        error: "Falha ao criar sessão realtime."
      });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
