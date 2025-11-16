export type DocumentEmailActionInput = {
  email: string;
  subject?: string;
};

export type DocumentEmailActionResult = {
  status:
    | "queued"
    | "duplicate"
    | "invalid"
    | "config-missing"
    | "error";
  variant: "success" | "warning" | "error";
  message: string;
  jobId?: string;
  deduped?: boolean;
};
