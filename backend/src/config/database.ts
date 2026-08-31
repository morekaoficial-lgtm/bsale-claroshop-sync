import { Sequelize } from "sequelize";
import { logger } from "../utils/logger";

export const sequelize = new Sequelize(
  process.env.DB_NAME || "bsale_claroshop",
  process.env.DB_USER || "bcsync",
  process.env.DB_PASSWORD || "bcsync_secret",
  {
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "5432", 10),
    dialect: "postgres",
    logging: (msg) => logger.debug(msg),
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
    define: {
      timestamps: true,
      underscored: true,
    },
  }
);
