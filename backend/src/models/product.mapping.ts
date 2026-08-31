import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../config/database";

export interface ProductMappingAttributes {
  id: number;
  bsale_product_id: number;
  bsale_variant_id: number;
  claroshop_product_id: string;
  bsale_sku: string;
  claroshop_sku: string;
  name: string;
  description?: string;
  images?: string[];
  category_id?: string;
  brand?: string;
  status: "pending" | "synced" | "error" | "inactive";
  last_sync_at?: Date;
  sync_error?: string;
  price?: number;
  offer_price?: number;
  stock?: number;
  created_at?: Date;
  updated_at?: Date;
}

export interface ProductMappingCreationAttributes
  extends Optional<ProductMappingAttributes, "id" | "created_at" | "updated_at"> {}

export class ProductMapping
  extends Model<ProductMappingAttributes, ProductMappingCreationAttributes>
  implements ProductMappingAttributes
{
  public id!: number;
  public bsale_product_id!: number;
  public bsale_variant_id!: number;
  public claroshop_product_id!: string;
  public bsale_sku!: string;
  public claroshop_sku!: string;
  public name!: string;
  public description?: string;
  public images?: string[];
  public category_id?: string;
  public brand?: string;
  public status!: "pending" | "synced" | "error" | "inactive";
  public last_sync_at?: Date;
  public sync_error?: string;
  public price?: number;
  public offer_price?: number;
  public stock?: number;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

ProductMapping.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    bsale_product_id: { type: DataTypes.INTEGER, allowNull: false },
    bsale_variant_id: { type: DataTypes.INTEGER, allowNull: false, unique: true },
    claroshop_product_id: { type: DataTypes.STRING, allowNull: true },
    bsale_sku: { type: DataTypes.STRING, allowNull: false },
    claroshop_sku: { type: DataTypes.STRING, allowNull: false, unique: true },
    name: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.TEXT },
    images: { type: DataTypes.ARRAY(DataTypes.STRING) },
    category_id: { type: DataTypes.STRING },
    brand: { type: DataTypes.STRING },
    status: {
      type: DataTypes.ENUM("pending", "synced", "error", "inactive"),
      defaultValue: "pending",
    },
    last_sync_at: { type: DataTypes.DATE },
    sync_error: { type: DataTypes.TEXT },
    price: { type: DataTypes.DECIMAL(12, 2) },
    offer_price: { type: DataTypes.DECIMAL(12, 2) },
    stock: { type: DataTypes.INTEGER, defaultValue: 0 },
  },
  {
    sequelize,
    tableName: "product_mappings",
    indexes: [
      { fields: ["bsale_variant_id"], unique: true },
      { fields: ["claroshop_sku"], unique: true },
      { fields: ["status"] },
      { fields: ["last_sync_at"] },
    ],
  }
);
