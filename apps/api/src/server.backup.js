import express from "express";
import cors from "cors";
import helmet from "helmet";

const app = express();
app.use(express.json());
app.use(cors({ origin: true, credentials: true }));
app.use(helmet());

app.get("/v1/health", (req, res) => res.json({ code: 0, msg: "ok" }));

const port = process.env.PORT || 8080;
app.listen(port, () => console.log(`API listening on ${port}`));
