export class CorpusError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = "CorpusError";
  }
}

export class EpisodeNotFoundError extends CorpusError {
  constructor(identifier: string) {
    super(`Episode not found: "${identifier}"`, "EPISODE_NOT_FOUND");
    this.name = "EpisodeNotFoundError";
  }
}

export class TopicNotFoundError extends CorpusError {
  constructor(slug: string) {
    super(`Topic not found: "${slug}"`, "TOPIC_NOT_FOUND");
    this.name = "TopicNotFoundError";
  }
}

export class InvalidInputError extends CorpusError {
  constructor(message: string) {
    super(message, "INVALID_INPUT");
    this.name = "InvalidInputError";
  }
}

export class BlogNotFoundError extends CorpusError {
  constructor(blogId: string) {
    super(`Blog not found: "${blogId}"`, "BLOG_NOT_FOUND");
    this.name = "BlogNotFoundError";
  }
}

export class DataIntegrityError extends CorpusError {
  constructor(message: string) {
    super(message, "DATA_INTEGRITY");
    this.name = "DataIntegrityError";
  }
}
