export default function SiteFooter() {
  return (
    <footer className="border-t border-oxford-stone bg-white px-6 py-4">
      <p className="text-center text-sm text-oxford-ash">
        <a
          href="https://bgonzalezbustamante.com"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-oxford-blue hover:underline"
        >
          Dr. Bastián González-Bustamante
        </a>{' '}
        dashboard, developed by{' '}
        <a
          href="https://empirialab.cl"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-oxford-blue hover:underline"
        >
          Empiria Lab
        </a>
      </p>
    </footer>
  )
}