import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../config/database";

export interface AppConfigAttributes {
  id: number;
  key: string;
  value: string;
  description?: string;
  updated_at?: Date;
  created_at?: Date;
}

export interface AppConfigCreationAttributes extends Optional<AppConfigAttributes, "id" | "created_at" | "updated_at"> {}

export class AppConfig extends Model<AppConfigAttributes, AppConfigCreationAttributes> implements AppConfigAttributes {
  public id!: number;
  public key!: string;
  public value!: string;
  public description?: string;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

AppConfig.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    key: { type: DataTypes.STRING, allowNull: false, unique: true },
    value: { type: DataTypes.TEXT, allowNull: false },
    description: { type: DataTypes.STRING },
  },
  {
    sequelize,
    tableName: "app_configs",
  }
);

// Defaults
export const DEFAULT_CONFIGS = {
  "sync.interval_minutes": "15",
  "sync.products.enabled": "true",
  "sync.stock.enabled": "true",
  "sync.orders.enabled": "true",
  "bsale.price_list_id": "1",
  "bsale.office_id": "1",
  "claroshop.shipping_time_days": "5",
  "notifications.telegram.enabled": "false",
  "notifications.email.enabled": "false",
};
