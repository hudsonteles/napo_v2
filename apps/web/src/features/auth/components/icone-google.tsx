/**
 * Logotipo do Google. Marca de terceiro: não existe em `lucide-react` e as
 * diretrizes da própria Google exigem as cores originais — por isso é SVG
 * inline e não um ícone do catálogo (design §4.4.2).
 */
export function IconeGoogle({ className }: { className?: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden className={className}>
      <path
        fill="#EA4335"
        d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.6 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.8 6c1.9-5.6 7.1-9.7 13.6-9.7z"
      />
      <path
        fill="#4285F4"
        d="M46.5 24.5c0-1.6-.1-3.2-.4-4.7H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.3z"
      />
      <path
        fill="#FBBC05"
        d="M10.4 28.8c-.5-1.4-.8-2.9-.8-4.4s.3-3 .8-4.4l-7.8-6C1 17.1 0 20.4 0 24s1 6.9 2.6 10l7.8-5.2z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.8 2.2-8.4 2.2-6.5 0-11.7-4.1-13.6-9.7l-7.8 5.2C6.5 42.6 14.6 48 24 48z"
      />
    </svg>
  );
}
