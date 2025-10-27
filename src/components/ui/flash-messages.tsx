"use client";

import { useEffect, useMemo, useRef } from "react";
import { useToast } from "@/components/ui/toast-provider";

export type FlashMessage = {
  id?: string;
  variant: "success" | "warning" | "error";
  title: string;
  description?: string;
};

function serializeMessage(message: FlashMessage) {
  return `${message.variant}:${message.title}:${message.description ?? ""}`;
}

export function FlashMessages({ messages }: { messages: FlashMessage[] }) {
  const { addToast } = useToast();
  const displayed = useRef<Set<string>>(new Set());

  const serialized = useMemo(() => messages.map(serializeMessage), [messages]);

  useEffect(() => {
    messages.forEach((message, index) => {
      const key = message.id ?? serialized[index];
      if (!displayed.current.has(key)) {
        addToast({
          variant: message.variant,
          title: message.title,
          description: message.description,
          duration: 6000,
        });
        displayed.current.add(key);
      }
    });
  }, [addToast, messages, serialized]);

  return null;
}
