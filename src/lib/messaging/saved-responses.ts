export type SavedResponseFormat = "PLAINTEXT" | "HTML";

export type SavedResponse = {
  id: string;
  title: string;
  description: string | null;
  content: string;
  format: SavedResponseFormat;
  builtIn: boolean;
  slug: string | null;
  createdAt: string;
  updatedAt: string;
};

