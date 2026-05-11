// Inline / block Markdown renderer used wherever the dashboard surfaces
// .md content authored by the mumei user (Wave goals, verify clauses,
// task descriptions, AC bodies, review findings).
//
// Built on react-markdown + remark-gfm. The library escapes raw HTML by
// default so user-supplied content cannot inject script tags; we
// intentionally do NOT enable rehype-raw. URLs are kept as-is via the
// default urlTransform.
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'

import { cn } from '@/lib/utils'

const remarkPlugins = [remarkGfm]

const components: Components = {
  // react-markdown delivers inline code and fenced code blocks through
  // the same `code` mapping. Fenced blocks always carry a `language-*`
  // className; inline backticks do not.
  code({ children, className, ...rest }) {
    const isFenced = className?.startsWith('language-') ?? false
    if (isFenced) {
      return (
        <code className={cn('font-mono', className)} {...rest}>
          {children}
        </code>
      )
    }
    return (
      <code className="rounded bg-zinc-800/80 px-1 py-0.5 text-[0.92em] text-zinc-200" {...rest}>
        {children}
      </code>
    )
  },
  pre: (props) => (
    <pre
      className="my-2 overflow-x-auto rounded border border-zinc-800/80 bg-zinc-900/60 p-2 text-[0.92em]"
      {...props}
    />
  ),
  a: (props) => (
    <a
      className="text-violet-300 underline decoration-violet-500/40 hover:decoration-violet-300"
      target="_blank"
      rel="noreferrer noopener"
      {...props}
    />
  ),
  ul: (props) => <ul className="my-1 ml-4 list-disc space-y-0.5" {...props} />,
  ol: (props) => <ol className="my-1 ml-4 list-decimal space-y-0.5" {...props} />,
  li: (props) => <li className="leading-snug" {...props} />,
  p: (props) => <p className="my-1 leading-snug" {...props} />,
  strong: (props) => <strong className="font-semibold text-zinc-100" {...props} />,
  em: (props) => <em className="italic" {...props} />,
  blockquote: (props) => (
    <blockquote className="my-2 border-l-2 border-zinc-700 pl-3 text-zinc-400" {...props} />
  ),
  h1: (props) => <h1 className="my-2 text-[1.1em] font-semibold text-zinc-100" {...props} />,
  h2: (props) => <h2 className="my-2 text-[1.05em] font-semibold text-zinc-100" {...props} />,
  h3: (props) => <h3 className="my-1.5 font-semibold text-zinc-100" {...props} />,
  table: (props) => (
    <div className="my-2 overflow-x-auto">
      <table className="border-collapse text-[0.92em]" {...props} />
    </div>
  ),
  th: (props) => (
    <th className="border border-zinc-800 px-2 py-1 text-left font-semibold" {...props} />
  ),
  td: (props) => <td className="border border-zinc-800 px-2 py-1" {...props} />,
}

interface MarkdownProps {
  children: string
  className?: string
  /** Render as inline content (no surrounding block container). */
  inline?: boolean
}

export function Markdown({ children, className, inline }: MarkdownProps) {
  const tree = (
    <ReactMarkdown remarkPlugins={remarkPlugins} components={components}>
      {children}
    </ReactMarkdown>
  )
  if (inline) {
    return <span className={cn('font-mono text-[14px]', className)}>{tree}</span>
  }
  return <div className={cn('font-mono text-[14px] text-zinc-300', className)}>{tree}</div>
}
