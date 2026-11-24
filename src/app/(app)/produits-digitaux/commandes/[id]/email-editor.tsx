"use client";

import { Bold, Code, Italic, Link2, List, Underline } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * HTML shown in the formatted view. The source view accepts anything typed or
 * pasted there: active content is removed before it reaches this page (the
 * server sanitizes again what is sent).
 */
function inertHtml(html: string) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("script,iframe,object,embed,link,meta,base,form,svg,math,template,noscript").forEach((node) => node.remove());
  doc.querySelectorAll("*").forEach((node) => {
    for (const { name, value } of Array.from(node.attributes)) {
      const unsafeUrl = /^(href|src|action|formaction|xlink:href)$/i.test(name) && !/^\s*(https?:|mailto:|tel:|data:image\/|#)/i.test(value);
      if (/^on/i.test(name) || name.toLowerCase() === "srcdoc" || unsafeUrl) node.removeAttribute(name);
    }
  });
  return doc.body.innerHTML;
}

/**
 * Small HTML editor for the order e-mail: formatted view or HTML source. The
 * initial HTML is sanitized server-side, pasted content is inserted as plain
 * text, and whatever is submitted is sanitized again on the server.
 */
export function EmailEditor({ initialHtml, onChange }: { initialHtml: string; onChange: (html: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [html, setHtml] = useState(initialHtml);
  const [source, setSource] = useState(false);

  // Uncontrolled while editing (React must not move the caret).
  useEffect(() => {
    if (!source && ref.current && ref.current.innerHTML !== html) ref.current.innerHTML = inertHtml(html);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the view changes
  }, [source]);

  const update = (value: string) => {
    setHtml(value);
    onChange(value);
  };
  const command = (name: string, value?: string) => {
    ref.current?.focus();
    document.execCommand(name, false, value);
    if (ref.current) update(ref.current.innerHTML);
  };
  const tool = (label: string, icon: ReactNode, run: () => void, disabled = source) => (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={run}
      className="rounded p-1.5 text-zinc-600 hover:bg-zinc-100 disabled:opacity-40 dark:text-zinc-300 dark:hover:bg-zinc-800"
    >
      {icon}
    </button>
  );

  return (
    <div className="rounded-md border border-zinc-300 dark:border-zinc-700">
      <div className="flex flex-wrap items-center gap-1 border-b border-zinc-200 p-1 dark:border-zinc-800">
        {tool("Gras", <Bold className="h-4 w-4" />, () => command("bold"))}
        {tool("Italique", <Italic className="h-4 w-4" />, () => command("italic"))}
        {tool("Souligné", <Underline className="h-4 w-4" />, () => command("underline"))}
        {tool("Liste", <List className="h-4 w-4" />, () => command("insertUnorderedList"))}
        {tool("Lien", <Link2 className="h-4 w-4" />, () => {
          const url = window.prompt("Adresse du lien (https://…)");
          if (url && /^(https?:\/\/|mailto:)/i.test(url.trim())) command("createLink", url.trim());
        })}
        <button
          type="button"
          aria-pressed={source}
          onClick={() => setSource((value) => !value)}
          className="ml-auto inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          <Code className="h-4 w-4" aria-hidden="true" /> {source ? "Vue normale" : "HTML"}
        </button>
      </div>
      {source ? (
        <textarea
          aria-label="Contenu HTML de l’e-mail"
          value={html}
          onChange={(event) => update(event.target.value)}
          spellCheck={false}
          className="block h-80 w-full resize-y bg-white p-3 font-mono text-xs text-zinc-900 outline-none"
        />
      ) : (
        <div
          ref={ref}
          role="textbox"
          aria-multiline="true"
          aria-label="Contenu de l’e-mail"
          contentEditable
          suppressContentEditableWarning
          onInput={(event) => update(event.currentTarget.innerHTML)}
          onDrop={(event) => event.preventDefault()}
          onPaste={(event) => {
            event.preventDefault();
            document.execCommand("insertText", false, event.clipboardData.getData("text/plain"));
          }}
          className="min-h-80 overflow-auto bg-white p-3 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
        />
      )}
    </div>
  );
}
