export class MalmunchiError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = "MalmunchiError";
  }
}

export class DocumentNotFoundError extends MalmunchiError {
  constructor(identifier: string) {
    super(`Document not found: "${identifier}"`, "DOCUMENT_NOT_FOUND");
    this.name = "DocumentNotFoundError";
  }
}

export class CategoryNotFoundError extends MalmunchiError {
  constructor(slug: string) {
    super(`Category not found: "${slug}"`, "CATEGORY_NOT_FOUND");
    this.name = "CategoryNotFoundError";
  }
}

export class InvalidInputError extends MalmunchiError {
  constructor(message: string) {
    super(message, "INVALID_INPUT");
    this.name = "InvalidInputError";
  }
}

export class SourceNotFoundError extends MalmunchiError {
  constructor(blogId: string) {
    super(`Source not found: "${blogId}"`, "SOURCE_NOT_FOUND");
    this.name = "SourceNotFoundError";
  }
}

export class DataIntegrityError extends MalmunchiError {
  constructor(message: string) {
    super(message, "DATA_INTEGRITY");
    this.name = "DataIntegrityError";
  }
}
