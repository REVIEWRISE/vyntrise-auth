import { CopyButton } from '@/components/copy-button';

export function CodeBlock({ code, lang = 'bash' }: { code: string; lang?: string }) {
  return (
    <div className="my-3 overflow-hidden rounded-lg border bg-muted/40">
      <div className="flex items-center justify-between border-b bg-muted/60 px-4 py-2">
        <span className="font-mono text-xs text-muted-foreground">{lang}</span>
        <CopyButton text={code} />
      </div>
      <pre className="overflow-x-auto whitespace-pre-wrap break-all px-4 py-3 font-mono text-[13px] leading-relaxed">{code}</pre>
    </div>
  );
}

export function IC({ children }: { children: React.ReactNode }) {
  return <code className="rounded border bg-muted px-1.5 py-0.5 font-mono text-xs text-primary">{children}</code>;
}
