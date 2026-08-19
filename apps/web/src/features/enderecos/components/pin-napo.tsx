/**
 * O pin da etapa de confirmação.
 *
 * Não é o ícone de mapa da biblioteca: aquele é um contorno de traço fino, e
 * sobre foto de satélite ou telhado claro ele desaparece. Aqui a silhueta é
 * **branca e sólida** — o branco é a única cor que se separa igualmente bem de
 * asfalto, telhado, mato e água — com o amarelo da marca no miolo, onde ele é
 * identidade sem depender de contraste para ser visto.
 *
 * O contorno escuro e a sombra existem pelo caso oposto: sobre fundo claro, o
 * branco precisa de borda para ter forma.
 */
export function PinNapo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 44"
      width="34"
      height="47"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {/* Sombra no chão: ancora o pin no ponto exato e o separa do fundo. */}
      <ellipse cx="16" cy="41" rx="4.5" ry="1.8" fill="#0a0a0a" opacity="0.35" />

      <path
        d="M16 1.5c-7.5 0-13.5 6-13.5 13.5 0 9.9 12 24 13.1 25.3a.5.5 0 0 0 .8 0C17.5 39 29.5 24.9 29.5 15 29.5 7.5 23.5 1.5 16 1.5z"
        fill="#ffffff"
        stroke="#0a0a0a"
        strokeWidth="1.6"
        strokeOpacity="0.55"
      />

      <circle cx="16" cy="15" r="6.2" fill="#f5c518" />
      {/* Anel escuro fino: separa o amarelo do branco sem escurecer a marca. */}
      <circle cx="16" cy="15" r="6.2" fill="none" stroke="#0a0a0a" strokeWidth="1" strokeOpacity="0.25" />
    </svg>
  );
}
