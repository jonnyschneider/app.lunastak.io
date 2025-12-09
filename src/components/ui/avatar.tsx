import clsx from 'clsx'
import React from 'react'

export function Avatar({
  src,
  initials,
  alt = '',
  className,
  ...props
}: {
  src?: string | null
  initials?: string
  alt?: string
  className?: string
} & React.ComponentPropsWithoutRef<'span'>) {
  return (
    <span
      data-slot="avatar"
      className={clsx(
        className,
        'inline-grid size-10 shrink-0 align-middle [--avatar-radius:20%] [--ring-opacity:20%] *:col-start-1 *:row-start-1',
        'outline outline-1 -outline-offset-1 outline-black/[--ring-opacity] dark:outline-white/[--ring-opacity]'
      )}
      {...props}
    >
      {initials && (
        <svg
          className="size-full select-none fill-current text-[48px] font-medium uppercase"
          viewBox="0 0 100 100"
          aria-hidden={alt ? undefined : 'true'}
        >
          {alt && <title>{alt}</title>}
          <text
            x="50%"
            y="50%"
            alignmentBaseline="middle"
            dominantBaseline="middle"
            textAnchor="middle"
            dy=".125em"
          >
            {initials}
          </text>
        </svg>
      )}
      {src && <img className="rounded-[--avatar-radius]" src={src} alt={alt} />}
    </span>
  )
}
