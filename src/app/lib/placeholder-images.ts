import data from './placeholder-images.json';

export type ImagePlaceholder = {
  id: string;
  description: string;
  imageUrl: string;
  imageHint: string;
};

/**
 * Exported placeholder images array.
 * Includes a fallback to an empty array to prevent runtime crashes if JSON is missing or malformed.
 */
export const PlaceHolderImages: ImagePlaceholder[] = data?.placeholderImages || [];
