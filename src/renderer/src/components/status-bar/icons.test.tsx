import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { OpenAIIcon } from './icons'

describe('OpenAIIcon', () => {
  it('honors a custom size prop', () => {
    const markup = renderToStaticMarkup(<OpenAIIcon size={20} />)
    expect(markup).toContain('width="20"')
    expect(markup).toContain('height="20"')
  })

  it('uses the default size when no override is supplied', () => {
    const markup = renderToStaticMarkup(<OpenAIIcon />)
    expect(markup).toContain('width="14"')
    expect(markup).toContain('height="14"')
  })
})
