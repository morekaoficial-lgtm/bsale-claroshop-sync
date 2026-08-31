import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../config/database";

export interface SyncLogAttributes {
  id: number;
  sync_type: "product" | "stock" | "price" | "order" | "webhook" | "retry";
  direction: "bsale_to_claroshop" | "claroshop_to_bsale";
  entity_id: string;
  entity_type: "product" | "variant" | "order" | "stock";
  status: "success" | "error" | "skipped" | "pending";
  message?: string;
  error_detail?: string;
  request_payload?: object;
  response_payload?: object;
  created_at?: Date;
}

export interface SyncLogCreationAttributes extends Optional<SyncLogAttributes, "id" | "created_at"> {}

export class SyncLog extends Model<SyncLogAttributes, SyncLogCreationAttributes> implements SyncLogAttributes {
  public id!: number;
  public sync_type!: "product" | "stock" | "price" | "order" | "webhook" | "retry";
  public direction!: "bsale_to_claroshop" | "claroshop_to_bsale";
  public entity_id!: string;
  public entity_type!: "product" | "variant" | "order" | "stock";
  public status!: "success" | "error" | "skipped" | "pending";
  public message?: string;
  public error_detail?: string;
  public request_payload?: object;
  public response_payload?: object;
  public readonly created_at!: Date;
}

SyncLog.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    sync_type: {
      type: DataTypes.ENUM("product", "stock", "price", "order", "webhook", "retry"),
      allowNull: false,
    },
    direction: {
      type: DataTypes.ENUM("bsale_to_claroshop", "claroshop_to_bsale"),
      allowNull: false,
    },
    entity_id: { type: DataTypes.STRING, allowNull: false },
    entity_type: {
      type: DataTypes.ENUM("product", "variant", "order", "stock"),
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM("success", "error", "skipped", "pending"),
      defaultValue: "pending",
    },
    message: { type: DataTypes.TEXT },
    error_detail: { type: DataTypes.TEXT },
    request_payload: { type: DataTypes.JSONB },
    response_payload: { type: DataTypes.JSONB },
  },
  {
    sequelize,
    tableName: "sync_logs",
    indexes: [
      { fields: ["sync_type"] },
      { fields: ["status"] },
      { fields: ["entity_id", "entity_type"] },
      { fields: ["created_at"] },
    ],
  }
);
