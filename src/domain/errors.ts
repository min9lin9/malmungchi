export class CorpusError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = "CorpusError";
  }
}

export class DocumentNotFoundError extends CorpusError {
  constructor(identifier: string) {
    super(`Document not found: "${identifier}"`, "DOCUMENT_NOT_FOUND");
    this.name = "DocumentNotFoundError";
  }
}

export class CategoryNotFoundError extends CorpusError {
  constructor(slug: string) {
    super(`Category not found: "${slug}"`, "CATEGORY_NOT_FOUND");
    this.name = "CategoryNotFoundError";
  }
}

export class InvalidInputError extends CorpusError {
  constructor(message: string) {
    super(message, "INVALID_INPUT");
    this.name = "InvalidInputError";
  }
}

export class SourceNotFoundError extends CorpusError {
  constructor(blogId: string) {
    super(`Source not found: "${blogId}"`, "SOURCE_NOT_FOUND");
    this.name = "SourceNotFoundError";
  }
}

export class DataIntegrityError extends CorpusError {
  constructor(message: string) {
    super(message, "DATA_INTEGRITY");
    this.name = "DataIntegrityError";
  }
}
