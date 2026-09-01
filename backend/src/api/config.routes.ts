import { Router } from "express";
import bcrypt from "bcryptjs";
import { generateToken, authMiddleware } from "../middleware/auth";
import { AppConfig, DEFAULT_CONFIGS } from "../models/config";

const router = Router();

/**
 * POST /api/config/login
 * Login para el panel de administración. SIN auth (obvio).
 */
router.post("/login", async (req, res, next) => {
  try {
    const { password } = req.body;
    const adminPassword = process.env.ADMIN_PASSWORD || "admin";

    // En producción usar bcrypt
    const valid = password === adminPassword;
    if (!valid) {
      return res.status(401).json({ error: "Contraseña incorrecta" });
    }

    const token = generateToken();
    res.json({ token });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/config
 * Obtener configuración del sistema. CON auth.
 */
router.get("/", authMiddleware, async (_req, res, next) => {
  try {
    const configs = await AppConfig.findAll();
    const configMap: Record<string, string> = {};
    configs.forEach((c) => (configMap[c.key] = c.value));

    // Completar con defaults
    for (const [key, value] of Object.entries(DEFAULT_CONFIGS)) {
      if (!(key in configMap)) configMap[key] = value;
    }

    res.json(configMap);
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/config
 * Actualizar configuración. CON auth.
 */
router.put("/", authMiddleware, async (req, res, next) => {
  try {
    const updates = req.body;
    for (const [key, value] of Object.entries(updates)) {
      await AppConfig.upsert({ key, value: String(value) });
    }
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
