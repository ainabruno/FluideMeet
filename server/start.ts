import dotenv from "dotenv";
dotenv.config();

import { initDb } from "./db";

// Initialise la base de données AVANT tout
initDb();