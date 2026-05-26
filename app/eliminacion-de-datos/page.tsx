import type { Metadata } from "next";
import LegalPage from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Eliminacion de datos | Prevital",
  description:
    "Instrucciones para solicitar la eliminacion de datos personales en Prevital Antioquia SAS.",
};

export default function DataDeletionPage() {
  return (
    <LegalPage
      eyebrow="Informacion legal"
      title="Eliminacion de datos"
      updatedAt="26 de mayo de 2026"
    >
      <p>
        Los usuarios que deseen solicitar la eliminacion de sus datos personales
        registrados en los canales digitales de Prevital Antioquia SAS podran
        hacerlo escribiendo a:{" "}
        <a className="font-semibold text-[#3F6952] underline" href="mailto:gerencia@prevital.co">
          gerencia@prevital.co
        </a>
      </p>

      <div>
        <p>La solicitud debe incluir:</p>
        <ul className="mt-3 list-disc space-y-2 pl-6">
          <li>nombre completo</li>
          <li>numero de telefono</li>
          <li>correo electronico usado en el registro</li>
          <li>descripcion breve de la solicitud</li>
        </ul>
      </div>

      <p>
        Prevital revisara la solicitud y realizara el tramite correspondiente
        conforme a la normativa aplicable en Colombia y a los procedimientos
        internos de proteccion de datos.
      </p>
    </LegalPage>
  );
}
