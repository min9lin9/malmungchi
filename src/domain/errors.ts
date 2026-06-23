export class MalmungchiError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = "MalmungchiError";
  }
}

export class DocumentNotFoundError extends MalmungchiError {
  constructor(identifier: string) {
    super(`Document not found: "${identifier}"`, "DOCUMENT_NOT_FOUND");
    this.name = "DocumentNotFoundError";
  }
}

export class CategoryNotFoundError extends MalmungchiError {
  constructor(slug: string) {
    super(`Category not found: "${slug}"`, "CATEGORY_NOT_FOUND");
    this.name = "CategoryNotFoundError";
  }
}

export class InvalidInputError extends MalmungchiError {
  constructor(message: string) {
    super(message, "INVALID_INPUT");
    this.name = "InvalidInputError";
  }
}

export class SourceNotFoundError extends MalmungchiError {
  constructor(blogId: string) {
    super(`Source not found: "${blogId}"`, "SOURCE_NOT_FOUND");
    this.name = "SourceNotFoundError";
  }
}

export class DataIntegrityError extends MalmungchiError {
  constructor(message: string) {
    super(message, "DATA_INTEGRITY");
    this.name = "DataIntegrityError";
  }
}
