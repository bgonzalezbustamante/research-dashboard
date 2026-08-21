type PageHeaderProps = {
  title: string
  description?: string
}

export default function PageHeader({
  title,
  description,
}: PageHeaderProps) {
  return (
    <div className="mb-8">
      <h1 className="font-serif text-3xl font-semibold tracking-tight text-oxford-blue">
        {title}
      </h1>

      {description && (
        <p className="mt-2 max-w-3xl text-base leading-7 text-oxford-ash">
          {description}
        </p>
      )}
    </div>
  )
}