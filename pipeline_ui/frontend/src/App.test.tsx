import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('App', () => {
  it('renders the page title', () => {
    render(<App />)
    expect(screen.getByText('Pipeline TikTok → Postiz')).toBeInTheDocument()
  })
})
