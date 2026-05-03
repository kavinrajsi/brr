import Image from 'next/image'

const BLUR_PLACEHOLDER =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 300'%3E%3Crect fill='%23f0f0f0' width='400' height='300'/%3E%3C/svg%3E"

// next/image throws if `placeholder="blur"` is combined with `fill` and no
// `blurDataURL` matches the rendered aspect ratio, AND fill is incompatible
// with width/height. Forward the right props for each layout mode and only
// apply blur when we have explicit dimensions.
export function OptimizedImage({
  src,
  alt,
  width,
  height,
  fill = false,
  priority = false,
  className = '',
  sizes,
}) {
  const baseProps = {
    src,
    alt,
    priority,
    quality: 85,
    className,
  }

  if (fill) {
    return <Image {...baseProps} fill sizes={sizes ?? '100vw'} />
  }

  return (
    <Image
      {...baseProps}
      width={width}
      height={height}
      placeholder="blur"
      blurDataURL={BLUR_PLACEHOLDER}
    />
  )
}
