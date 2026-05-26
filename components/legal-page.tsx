import Link from "next/link";

type LegalPageProps = {
  eyebrow: string;
  title: string;
  updatedAt: string;
  children: React.ReactNode;
};

const legalLinks = [
  { href: "/politica-de-privacidad", label: "Politica de privacidad" },
  { href: "/terminos-y-condiciones", label: "Terminos y condiciones" },
  { href: "/eliminacion-de-datos", label: "Eliminacion de datos" },
];

export default function LegalPage({
  eyebrow,
  title,
  updatedAt,
  children,
}: LegalPageProps) {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,_#F6FAF7_0%,_#EEF7F1_50%,_#FAFCFA_100%)] px-4 py-10 text-[#1E3229] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <section className="overflow-hidden rounded-[34px] border border-[#CFE4D8] bg-white/95 p-6 shadow-[0_24px_60px_rgba(95,125,102,0.14)] md:p-10">
          <div className="h-1.5 w-full rounded-full bg-gradient-to-r from-[#C7EEE1] via-[#8CB88D] to-[#4F7B63]" />

          <div className="mt-8">
            <Link
              href="/"
              className="inline-flex rounded-full border border-[#CFE4D8] bg-[#F7FCF8] px-4 py-2 text-sm font-semibold text-[#4F6F5B] shadow-sm transition hover:-translate-y-0.5 hover:bg-white"
            >
              Prevital
            </Link>
            <p className="mt-8 text-sm font-semibold uppercase tracking-[0.24em] text-[#6A8774]">
              {eyebrow}
            </p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight text-[#1E3229] md:text-5xl">
              {title}
            </h1>
            <p className="mt-3 text-sm text-[#65766B]">Ultima actualizacion: {updatedAt}</p>
          </div>

          <div className="mt-10 space-y-5 text-base leading-8 text-[#41584B]">
            {children}
          </div>

          <nav className="mt-10 flex flex-wrap gap-3 border-t border-[#DCEDE3] pt-6">
            {legalLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="inline-flex rounded-2xl border border-[#CFE4D8] bg-white px-4 py-2 text-sm font-medium text-[#4F6F5B] shadow-sm transition hover:-translate-y-0.5 hover:bg-[#F7FCF8]"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </section>
      </div>
    </main>
  );
}
