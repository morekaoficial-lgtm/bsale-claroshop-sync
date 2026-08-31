import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../config/database";

export interface OrderAttributes {
  id: number;
  claroshop_order_id: string;
  bsale_document_id?: number;
  bsale_document_number?: string;
  customer_name: string;
  customer_email?: string;
  customer_phone?: string;
  shipping_address?: object;
  total: number;
  shipping_cost?: number;
  status: "pending" | "processing" | "completed" | "cancelled" | "refunded" | "error";
  claroshop_status?: string;
  bsale_status?: string;
  items: object[];
  sync_error?: string;
  imported_at: Date;
  processed_at?: Date;
  created_at?: Date;
  updated_at?: Date;
}

export interface OrderCreationAttributes extends Optional<OrderAttributes, "id" | "created_at" | "updated_at"> {}

export class Order extends Model<OrderAttributes, OrderCreationAttributes> implements OrderAttributes {
  public id!: number;
  public claroshop_order_id!: string;
  public bsale_document_id?: number;
  public bsale_document_number?: string;
  public customer_name!: string;
  public customer_email?: string;
  public customer_phone?: string;
  public shipping_address?: object;
  public total!: number;
  public shipping_cost?: number;
  public status!: "pending" | "processing" | "completed" | "cancelled" | "refunded" | "error";
  public claroshop_status?: string;
  public bsale_status?: string;
  public items!: object[];
  public sync_error?: string;
  public imported_at!: Date;
  public processed_at?: Date;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

Order.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    claroshop_order_id: { type: DataTypes.STRING, allowNull: false, unique: true },
    bsale_document_id: { type: DataTypes.INTEGER },
    bsale_document_number: { type: DataTypes.STRING },
    customer_name: { type: DataTypes.STRING, allowNull: false },
    customer_email: { type: DataTypes.STRING },
    customer_phone: { type: DataTypes.STRING },
    shipping_address: { type: DataTypes.JSONB },
    total: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    shipping_cost: { type: DataTypes.DECIMAL(12, 2) },
    status: {
      type: DataTypes.ENUM("pending", "processing", "completed", "cancelled", "refunded", "error"),
      defaultValue: "pending",
    },
    claroshop_status: { type: DataTypes.STRING },
    bsale_status: { type: DataTypes.STRING },
    items: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
    sync_error: { type: DataTypes.TEXT },
    imported_at: { type: DataTypes.DATE, allowNull: false },
    processed_at: { type: DataTypes.DATE },
  },
  {
    sequelize,
    tableName: "orders",
    indexes: [
      { fields: ["claroshop_order_id"], unique: true },
      { fields: ["status"] },
      { fields: ["imported_at"] },
      { fields: ["bsale_document_id"] },
    ],
  }
);
