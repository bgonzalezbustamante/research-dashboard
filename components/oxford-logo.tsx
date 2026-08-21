import Image from 'next/image'

type OxfordLogoProps = {
  className?: string
}

export default function OxfordLogo({
  className = 'w-[190px]',
}: OxfordLogoProps) {
  return (
    <Image
      src="/branding/oxford-logo.svg"
      alt="University of Oxford"
      width={547}
      height={161}
      priority
      className={`h-auto ${className}`}
    />
  )
}