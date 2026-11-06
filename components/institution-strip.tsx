import Image from 'next/image'

// Current affiliations: the University of Oxford square mark (the Dashboard
// favicon), the Academic Website's marks in its order (Leiden, UDP, OCPSG),
// then Empiria Lab and OBPEX. Files live in public/branding as 128 px square
// WebP marks.
const affiliations = [
  {
    id: 'oxford',
    name: 'University of Oxford',
    src: '/branding/oxford.webp',
  },
  {
    id: 'leiden',
    name: 'Leiden University',
    src: '/branding/leiden.webp',
  },
  {
    id: 'udp',
    name: 'Universidad Diego Portales',
    src: '/branding/udp.webp',
  },
  {
    id: 'ocpsg',
    name: 'Oxford Computational Political Science Group',
    src: '/branding/ocpsg.webp',
  },
  {
    id: 'empiria-lab',
    name: 'Empiria Lab',
    src: '/branding/empiria-lab.webp',
  },
  {
    id: 'obpex',
    name: 'OBPEX',
    src: '/branding/obpex.webp',
  },
] as const

const sizes = {
  header: {
    box: 'size-[38px]',
    image: 'size-[31px]',
    pixels: 31,
  },
  auth: {
    box: 'size-[44px]',
    image: 'size-[36px]',
    pixels: 36,
  },
} as const

type InstitutionStripProps = {
  size?: keyof typeof sizes
}

// Marks shown in their normal colours. Wrap the strip in a link where it
// should navigate.
export default function InstitutionStrip({
  size = 'header',
}: InstitutionStripProps) {
  const dimensions =
    sizes[size]

  return (
    <span
      role="img"
      aria-label={affiliations
        .map(
          (affiliation) =>
            affiliation.name
        )
        .join(', ')}
      className="inline-flex items-center gap-1.5"
    >
      {affiliations.map(
        (affiliation) => (
          <span
            key={affiliation.id}
            title={affiliation.name}
            className={`inline-flex ${dimensions.box} items-center justify-center overflow-hidden rounded-md`}
          >
            <Image
              src={affiliation.src}
              alt=""
              width={dimensions.pixels}
              height={dimensions.pixels}
              unoptimized
              priority
              className={`${dimensions.image} object-contain`}
            />
          </span>
        )
      )}
    </span>
  )
}
