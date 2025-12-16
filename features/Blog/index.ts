/**
 * Blog Feature Module
 * Public API for the blog system
 */

// Types
export type {
  BlogPost,
  BlogPostMeta,
  Category,
  Difficulty,
  Heading,
  Locale
} from './types/blog';

export {
  REQUIRED_FRONTMATTER_FIELDS,
  VALID_CATEGORIES,
  VALID_DIFFICULTIES,
  VALID_LOCALES
} from './types/blog';

// Lib functions
export { calculateReadingTime } from './lib/calculateReadingTime';
export {
  validateFrontmatter,
  type ValidationResult
} from './lib/validateFrontmatter';
export { getBlogPosts, sortPostsByDate } from './lib/getBlogPosts';
export { getBlogPost, postExists, getPostLocales } from './lib/getBlogPost';
export { extractHeadings, generateHeadingId } from './lib/extractHeadings';
