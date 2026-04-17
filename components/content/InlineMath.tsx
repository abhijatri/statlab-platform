// Server component — renders inline $...$ math segments through KaTeX.
// Falls back to plain text for segments that contain no delimiters.
import katex from 'katex'

function processInlineMath(text: string): string {
  return text.replace(/\$([^$]+)\$/g, (_, latex) => {
    try {
      return katex.renderToString(latex, {
        throwOnError: false,
        output: 'html',
        displayMode: false,
      })
    } catch {
      return latex
    }
  })
}

interface Props { children: string }

export function InlineMath({ children }: Props) {
  const html = processInlineMath(children)
  const hasLatex = html !== children
  if (!hasLatex) return <span>{children}</span>
  return <span dangerouslySetInnerHTML={{ __html: html }} />
}
