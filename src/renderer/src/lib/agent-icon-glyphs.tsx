import type React from 'react'

export function AgentLetterIcon({
  letter,
  size = 14
}: {
  letter: string
  size?: number
}): React.JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 14 14"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      className="text-current"
    >
      <rect width="14" height="14" rx="3" fill="currentColor" fillOpacity="0.2" />
      <text
        x="7"
        y="10.5"
        textAnchor="middle"
        fontSize="8.5"
        fill="currentColor"
        fontWeight="700"
        fontFamily="system-ui, -apple-system, sans-serif"
      >
        {letter}
      </text>
    </svg>
  )
}
