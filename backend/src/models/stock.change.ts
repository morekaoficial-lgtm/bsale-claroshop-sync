import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../config/database";

export interface StockChangeAttributes {
  id: number;
  bsale_variant_id: number;
  bsale_office_id: number;
  old_stock: number;
  new_stock: number;
  change_reason?: string;
  synced_to_claroshop: boolean;
  sync_error?: string;
  created_at?: Date;
}

export interface StockChangeCreationAttributes extends Optional<StockChangeAttributes, "id" | "created_at"> {}

export class StockChange extends Model<StockChangeAttributes, StockChangeCreationAttributes> implements StockChangeAttributes {
  public id!: number;
  public bsale_variant_id!: number;
  public bsale_office_id!: number;
  public old_stock!: number;
  public new_stock!: number;
  public change_reason?: string;
  public synced_to_claroshop!: boolean;
  public sync_error?: string;
  public readonly created_at!: Date;
}

StockChange.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    bsale_variant_id: { type: DataTypes.INTEGER, allowNull: false },
    bsale_office_id: { type: DataTypes.INTEGER, allowNull: false },
    old_stock: { type: DataTypes.INTEGER, allowNull: false },
    new_stock: { type: DataTypes.INTEGER, allowNull: false },
    change_reason: { type: DataTypes.STRING },
    synced_to_claroshop: { type: DataTypes.BOOLEAN, defaultValue: false },
    sync_error: { type: DataTypes.TEXT },
  },
  {
    sequelize,
    tableName: "stock_changes",
    indexes: [
      { fields: ["bsale_variant_id", "bsale_office_id"] },
      { fields: ["synced_to_claroshop"] },
      { fields: ["created_at"] },
    ],
  }
);
