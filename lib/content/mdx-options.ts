// MDX compilation options — remark/rehype plugin pipeline.
// Imported by MDXContent.tsx and passed to next-mdx-remote/rsc.

import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import rehypeSlug from 'rehype-slug'
import rehypeAutolinkHeadings from 'rehype-autolink-headings'
import type { MDXRemoteProps } from 'next-mdx-remote/rsc'

type MDXOptions = NonNullable<MDXRemoteProps['options']>['mdxOptions']

export const MDX_OPTIONS: MDXOptions = {
  remarkPlugins: [
    remarkMath,
  ],
  rehypePlugins: [
    rehypeKatex,
    rehypeSlug,
    [
      rehypeAutolinkHeadings,
      {
        behavior: 'wrap',
        properties: {
          className: ['anchor-link'],
          ariaHidden: true,
          tabIndex: -1,
        },
      },
    ],
  ],
  format: 'mdx',
}
