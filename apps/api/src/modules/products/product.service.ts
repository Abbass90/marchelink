import { ProductRepository, type ProductRow, type BrowseParams, type BrowsePage } from './product.repository.js';
import { NotFoundError } from '../../errors/index.js';
import type { CreateProductInput, UpdateProductInput } from './product.schema.js';

export class ProductService {
  constructor(private readonly repo: ProductRepository) {}

  async createProduct(organizationId: string, input: CreateProductInput, userId?: string): Promise<ProductRow> {
    return this.repo.create(organizationId, {
      ...input,
      created_by: userId,
    });
  }

  async updateProduct(id: string, organizationId: string, input: UpdateProductInput, userId?: string): Promise<ProductRow> {
    const product = await this.repo.update(id, organizationId, input, userId);
    if (!product) {
      throw new NotFoundError('Not found');
    }
    return product;
  }

  async listByOrg(organizationId: string): Promise<ProductRow[]> {
    return this.repo.findAllByOrg(organizationId);
  }

  async listAll(): Promise<ProductRow[]> {
    return this.repo.findAllActive();
  }

  async browse(params: BrowseParams): Promise<BrowsePage> {
    return this.repo.browse(params);
  }

  async getById(id: string, organizationId: string): Promise<ProductRow> {
    const product = await this.repo.findById(id, organizationId);
    if (!product) {
      throw new NotFoundError('Not found');
    }
    return product;
  }

  async getByIdPublic(id: string): Promise<ProductRow> {
    const product = await this.repo.findByIdPublic(id);
    if (!product) {
      throw new NotFoundError('Not found');
    }
    return product;
  }

  async deleteProduct(id: string, organizationId: string): Promise<void> {
    const deleted = await this.repo.softDelete(id, organizationId);
    if (!deleted) {
      throw new NotFoundError('Not found');
    }
  }
}
