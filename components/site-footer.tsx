export default function SiteFooter() {
  return (
    <footer className="border-t border-oxford-stone bg-white px-6 py-4">
      <div className="space-y-1 text-center text-sm text-oxford-ash">
        <p>
          Research Dashboard - v0.1.0-beta.3 &quot;Misty Delta&quot;
        </p>

        <p>
          <a
            href="https://bgonzalezbustamante.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-oxford-blue hover:underline"
          >
            Dr. Bastián González-Bustamante
          </a>
          , developed by{' '}
          <a
            href="https://empirialab.cl/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-oxford-blue hover:underline"
          >
            Empiria Lab
          </a>
        </p>
      </div>
    </footer>
  )
}
