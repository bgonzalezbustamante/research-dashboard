type PageHeaderProps = {
  title: string
  description?: string
  wide?: boolean
}

export default function PageHeader({
  title,
  description,
  wide = false,
}: PageHeaderProps) {
  return (
    <div className="mb-8">
      <h1 className="font-serif text-3xl font-semibold tracking-tight text-oxford-blue">
        {title}
      </h1>

      {description && (
        <p
          className={
            wide
              ? 'mt-2 text-base leading-7 text-oxford-ash'
              : 'mt-2 max-w-3xl text-base leading-7 text-oxford-ash'
          }
        >
          {description}
        </p>
      )}
    </div>
  )
}
